--[[
LuCI - Template Parser

Description:
A template parser supporting includes, translations, Lua code blocks
and more. It can be used either as a compiler or as an interpreter.

FileId: $Id$

License:
Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at 

	http://www.apache.org/licenses/LICENSE-2.0 

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

]]--

local fs = require "luci.fs"
local sys = require "luci.sys"
local util = require "luci.util"
local table = require "table"
local string = require "string"
local config = require "luci.config"
local coroutine = require "coroutine"
local nixio = require "nixio", require "nixio.util"

local tostring, pairs, loadstring = tostring, pairs, loadstring
local setmetatable, loadfile = setmetatable, loadfile
local getfenv, setfenv, rawget = getfenv, setfenv, rawget
local assert, type, error = assert, type, error

--- LuCI template library.
module "luci.template"

config.template = config.template or {}

viewdir    = config.template.viewdir or util.libpath() .. "/view"
compiledir = config.template.compiledir or util.libpath() .. "/view"


-- Compile modes:
-- memory:	Always compile, do not save compiled files, ignore precompiled 
-- file:	Compile on demand, save compiled files, update precompiled
compiler_mode = config.template.compiler_mode or "memory"


-- Define the namespace for template modules
context = util.threadlocal()

--- Manually  compile a given template into an executable Lua function
-- @param template	LuCI template
-- @return 			Lua template function
function compile(template)	
	local expr = {}

	-- Search all <% %> expressions
	local function expr_add(ws1, skip1, command, skip2, ws2)
		expr[#expr+1] = command
		return ( #skip1 > 0 and "" or ws1 ) .. 
		       "<%" .. tostring(#expr) .. "%>" ..
		       ( #skip2 > 0 and "" or ws2 )
	end
	
	-- Save all expressiosn to table "expr"
	template = template:gsub("(%s*)<%%(%-?)(.-)(%-?)%%>(%s*)", expr_add)
	
	local function sanitize(s)
		s = "%q" % s
		return s:sub(2, #s-1)
	end
	
	-- Escape and sanitize all the template (all non-expressions)
	template = sanitize(template)

	-- Template module header/footer declaration
	local header = 'write("'
	local footer = '")'
	
	template = header .. template .. footer
	
	-- Replacements
	local r_include = '")\ninclude("%s")\nwrite("'
	local r_i18n    = '")\nwrite(translate("%1","%2"))\nwrite("'
	local r_i18n2   = '")\nwrite(translate("%1", ""))\nwrite("'
	local r_pexec   = '")\nwrite(tostring(%s or ""))\nwrite("'
	local r_exec    = '")\n%s\nwrite("'
	
	-- Parse the expressions
	for k,v in pairs(expr) do
		local p = v:sub(1, 1)
		v = v:gsub("%%", "%%%%")
		local re = nil
		if p == "+" then
			re = r_include:format(sanitize(string.sub(v, 2)))
		elseif p == ":" then
			if v:find(" ") then
				re = sanitize(v):gsub(":(.-) (.*)", r_i18n)
			else
				re = sanitize(v):gsub(":(.+)", r_i18n2)
			end
		elseif p == "=" then
			re = r_pexec:format(v:sub(2))
		elseif p == "#" then
			re = ""
		else
			re = r_exec:format(v)
		end
		template = template:gsub("<%%"..tostring(k).."%%>", re)
	end

	return loadstring(template)
end

--- Render a certain template.
-- @param name		Template name
-- @param scope		Scope to assign to template (optional)
function render(name, scope)
	return Template(name):render(scope or getfenv(2))
end


-- Template class
Template = util.class()

-- Shared template cache to store templates in to avoid unnecessary reloading
Template.cache = setmetatable({}, {__mode = "v"})


-- Constructor - Reads and compiles the template on-demand
function Template.__init__(self, name)	
	local function _encode_filename(str)

		local function __chrenc( chr )
			return "%%%02x" % string.byte( chr )
		end

		if type(str) == "string" then
			str = str:gsub(
				"([^a-zA-Z0-9$_%-%.%+!*'(),])",
				__chrenc
			)
		end

		return str
	end

	self.template = self.cache[name]
	self.name = name
	
	-- Create a new namespace for this template
	self.viewns = context.viewns
	
	-- If we have a cached template, skip compiling and loading
	if self.template then
		return
	end
	
	-- Enforce cache security
	local cdir = compiledir .. "/" .. sys.process.info("uid")
	
	-- Compile and build
	local sourcefile   = viewdir    .. "/" .. name
	local compiledfile = cdir .. "/" .. _encode_filename(name) .. ".lua"
	local err	
	
	if compiler_mode == "file" then
		local tplmt = fs.mtime(sourcefile) or fs.mtime(sourcefile .. ".htm")
		local commt = fs.mtime(compiledfile)
		
		if not fs.mtime(cdir) then
			fs.mkdir(cdir, true)
			fs.chmod(fs.dirname(cdir), 777)
		end
		
		assert(tplmt or commt, "No such template: " .. name)
				
		-- Build if there is no compiled file or if compiled file is outdated
		if not commt or (commt	and tplmt and commt < tplmt) then
			local source
			source, err = fs.readfile(sourcefile) or fs.readfile(sourcefile .. ".htm")
			
			if source then
				local compiled, err = compile(source)
				
				local f = nixio.open(compiledfile, "w", 600)
				f:writeall(util.get_bytecode(compiled))
				f:close()
				self.template = compiled
			end
		else
			assert(
				sys.process.info("uid") == fs.stat(compiledfile, "uid")
				and fs.stat(compiledfile, "modestr") == "rw-------",
				"Fatal: Cachefile is not sane!"
			)
			self.template, err = loadfile(compiledfile)
		end
		
	elseif compiler_mode == "memory" then
		local source
		source, err = fs.readfile(sourcefile) or fs.readfile(sourcefile .. ".htm")
		if source then
			self.template, err = compile(source)
		end
			
	end
	
	-- If we have no valid template throw error, otherwise cache the template
	if not self.template then
		error(err)
	else
		self.cache[name] = self.template
	end
end


-- Renders a template
function Template.render(self, scope)
	scope = scope or getfenv(2)
	
	-- Put our predefined objects in the scope of the template
	setfenv(self.template, setmetatable({}, {__index =
		function(tbl, key)
			return rawget(tbl, key) or self.viewns[key] or scope[key]
		end}))
	
	-- Now finally render the thing
	local stat, err = util.copcall(self.template)
	if not stat then
		error("Error in template %s: %s" % {self.name, err})
	end
end
