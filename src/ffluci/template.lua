--[[
FFLuCI - Template Parser

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
module("ffluci.template", package.seeall)

require("ffluci.config")
require("ffluci.util")
require("ffluci.fs")
require("ffluci.i18n")
require("ffluci.model.uci")

viewdir = ffluci.fs.dirname(ffluci.util.__file__()) .. "view/"


-- Compile modes:
-- none:	Never compile, only render precompiled
-- memory:	Always compile, do not save compiled files, ignore precompiled 
-- always:  Same as "memory" but also saves compiled files
-- smart:	Compile on demand, save compiled files, update precompiled
compiler_mode = "smart"


-- This applies to compiler modes "always" and "smart"
--
-- Produce compiled lua code rather than lua sourcecode
-- WARNING: Increases template size heavily!!!
-- This produces the same bytecode as luac but does not have a strip option
compiler_enable_bytecode = false


-- Define the namespace for template modules
viewns = {
	translate  = ffluci.i18n.translate,
	config     = ffluci.model.uci.get,
	controller = os.getenv("SCRIPT_NAME"),
	media      = ffluci.config.mediaurlbase,
	include    = function(name) return render(name, getfenv(2)) end, 
	write      = io.write
}


-- Compiles and builds a given template
function build(template, compiled)	
	local template = compile(ffluci.fs.readfile(template))
	
	if compiled then
		ffluci.fs.writefile(compiled, template)
	end
	
	return template
end


-- Compiles a given template into an executable Lua module
function compile(template)
	-- Search all <% %> expressions (remember: Lua table indexes begin with #1)
	local function expr_add(command)
		table.insert(expr, command)
		return "<%" .. tostring(#expr) .. "%>"
	end
	
	-- As "expr" should be local, we have to assign it to the "expr_add" scope 
	local expr = {}
	ffluci.util.extfenv(expr_add, "expr", expr)
	
	-- Save all expressiosn to table "expr"
	template = template:gsub("<%%(.-)%%>", expr_add)
	
	local function sanitize(s)
		s = ffluci.util.escape(s)
		s = ffluci.util.escape(s, "'")
		s = ffluci.util.escape(s, "\n")
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
	local r_uci     = "'..config('%1','%2','%3')..'"
	local r_pexec   = "'..%s..'"
	local r_exec    = "')\n%s\nwrite('"
	
	-- Parse the expressions
	for k,v in pairs(expr) do
		local p = v:sub(1, 1)
		local re = nil
		if p == "+" then
			re = r_include:format(sanitize(string.sub(v, 2)))
		elseif p == ":" then
			re = sanitize(v):gsub(":(.-) (.+)", r_i18n)
		elseif p == "~" then
			re = sanitize(v):gsub("~(.-)%.(.-)%.(.+)", r_uci)
		elseif p == "=" then
			re = r_pexec:format(string.sub(v, 2))
		else
			re = r_exec:format(v)
		end
		template = template:gsub("<%%"..tostring(k).."%%>", re)
	end

	if compiler_enable_bytecode then 
		tf = loadstring(template)
		template = string.dump(tf)
	end
	
	return template
end


-- Returns and builds the template for "name" depending on the compiler mode
function get(name)	
	local templatefile = viewdir .. name .. ".htm"
	local compiledfile = viewdir .. name .. ".lua"
	local template = nil
	
	if compiler_mode == "smart" then
		local tplmt = ffluci.fs.mtime(templatefile)
		local commt = ffluci.fs.mtime(compiledfile)
				
		-- Build if there is no compiled file or if compiled file is outdated
		if ((commt == nil) and not (tplmt == nil))
		or (not (commt == nil) and not (tplmt == nil) and commt < tplmt) then
			template = loadstring(build(templatefile, compiledfile))
		else
			template = loadfile(compiledfile)
		end
		
	elseif compiler_mode == "none" then
		template = loadfile(compiledfile)
		
	elseif compiler_mode == "memory" then
		template = loadstring(build(templatefile))
		
	elseif compiler_mode == "always" then
		template = loadstring(build(templatefile, compiledfile))
				
	else
		error("Invalid compiler mode: " .. compiler_mode)
		
	end
	
	return template or error("Unable to load template: " .. name)
end

-- Renders a template
function render(name, scope)
	scope = scope or getfenv(2)
	
	-- Our template module
	local view = get(name)
	
	-- Put our predefined objects in the scope of the template
	ffluci.util.updfenv(view, scope)
	ffluci.util.updfenv(view, viewns)
	
	-- Now finally render the thing
	return view()
end