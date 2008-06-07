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
module("luci.template", package.seeall)

require("luci.config")
require("luci.util")
require("luci.fs")
require("luci.http")

luci.config.template = luci.config.template or {}

viewdir    = luci.config.template.viewdir or luci.sys.libpath() .. "/view"
compiledir = luci.config.template.compiledir or luci.sys.libpath() .. "/view"

-- Enforce cache security
compiledir = compiledir .. "/" .. luci.sys.process.info("uid")


-- Compile modes:
-- none:	Never compile, only use precompiled data from files
-- memory:	Always compile, do not save compiled files, ignore precompiled 
-- file:	Compile on demand, save compiled files, update precompiled
compiler_mode = luci.config.template.compiler_mode or "memory"


-- Define the namespace for template modules
viewns = {
	write      = io.write,
	include    = function(name) Template(name):render(getfenv(2)) end,	
}

-- Compiles a given template into an executable Lua module
function compile(template)	
	-- Search all <% %> expressions (remember: Lua table indexes begin with #1)
	local function expr_add(command)
		table.insert(expr, command)
		return "<%" .. tostring(#expr) .. "%>"
	end
	
	-- As "expr" should be local, we have to assign it to the "expr_add" scope 
	local expr = {}
	luci.util.extfenv(expr_add, "expr", expr)
	
	-- Save all expressiosn to table "expr"
	template = template:gsub("<%%(.-)%%>", expr_add)
	
	local function sanitize(s)
		s = luci.util.escape(s)
		s = luci.util.escape(s, "'")
		s = luci.util.escape(s, "\n")
		return s
	end
	
	-- Escape and sanitize all the template (all non-expressions)
	template = sanitize(template)

	-- Template module header/footer declaration
	local header = "write('"
	local footer = "')"
	
	template = header .. template .. footer
	
	-- Replacements
	local r_include = "')\ninclude('%s')\nwrite('"
	local r_i18n    = "'..translate('%1','%2')..'"
	local r_pexec   = "'..(%s or '')..'"
	local r_exec    = "')\n%s\nwrite('"
	
	-- Parse the expressions
	for k,v in pairs(expr) do
		local p = v:sub(1, 1)
		local re = nil
		if p == "+" then
			re = r_include:format(sanitize(string.sub(v, 2)))
		elseif p == ":" then
			re = sanitize(v):gsub(":(.-) (.+)", r_i18n)
		elseif p == "=" then
			re = r_pexec:format(v:sub(2))
		else
			re = r_exec:format(v)
		end
		template = template:gsub("<%%"..tostring(k).."%%>", re)
	end

	return loadstring(template)
end

-- Oldstyle render shortcut
function render(name, scope, ...)
	scope = scope or getfenv(2)
	local s, t = pcall(Template, name)
	if not s then
		error(t)
	else
		t:render(scope, ...)
	end
end


-- Template class
Template = luci.util.class()

-- Shared template cache to store templates in to avoid unnecessary reloading
Template.cache = {}


-- Constructor - Reads and compiles the template on-demand
function Template.__init__(self, name)	
	if self.cache[name] then
		self.template = self.cache[name]
	else
		self.template = nil
	end
	
	-- Create a new namespace for this template
	self.viewns = {}
	
	-- Copy over from general namespace
	for k, v in pairs(viewns) do
		self.viewns[k] = v
	end	
	
	-- If we have a cached template, skip compiling and loading
	if self.template then
		return
	end
	
	-- Compile and build
	local sourcefile   = viewdir    .. "/" .. name .. ".htm"
	local compiledfile = compiledir .. "/" .. luci.http.urlencode(name) .. ".lua"
	local err	
	
	if compiler_mode == "file" then
		local tplmt = luci.fs.mtime(sourcefile)
		local commt = luci.fs.mtime(compiledfile)
		
		if not luci.fs.mtime(compiledir) then
			luci.fs.mkdir(compiledir, true)
		end
				
		-- Build if there is no compiled file or if compiled file is outdated
		if ((commt == nil) and not (tplmt == nil))
		or (not (commt == nil) and not (tplmt == nil) and commt < tplmt) then
			local source
			source, err = luci.fs.readfile(sourcefile)
			
			if source then
				local compiled, err = compile(source)
				
				luci.fs.writefile(compiledfile, luci.util.dump(compiled))
				self.template = compiled
			end
		else
			self.template, err = loadfile(compiledfile)
		end
		
	elseif compiler_mode == "none" then
		self.template, err = loadfile(self.compiledfile)
		
	elseif compiler_mode == "memory" then
		local source
		source, err = luci.fs.readfile(sourcefile)
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
	
	-- Save old environment
	local oldfenv = getfenv(self.template)
	
	-- Put our predefined objects in the scope of the template
	luci.util.resfenv(self.template)
	luci.util.updfenv(self.template, scope)
	luci.util.updfenv(self.template, self.viewns)
	
	-- Now finally render the thing
	self.template()
	
	-- Reset environment
	setfenv(self.template, oldfenv)
end
