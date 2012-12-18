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

local util = require "luci.util"
local config = require "luci.config"
local tparser = require "luci.template.parser"

local tostring, pairs, loadstring = tostring, pairs, loadstring
local setmetatable, loadfile = setmetatable, loadfile
local getfenv, setfenv, rawget = getfenv, setfenv, rawget
local assert, type, error = assert, type, error

--- LuCI template library.
module "luci.template"

config.template = config.template or {}
viewdir = config.template.viewdir or util.libpath() .. "/view"


-- Define the namespace for template modules
context = util.threadlocal()

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

	self.template = self.cache[name]
	self.name = name
	
	-- Create a new namespace for this template
	self.viewns = context.viewns
	
	-- If we have a cached template, skip compiling and loading
	if not self.template then

		-- Compile template
		local err
		local sourcefile = viewdir .. "/" .. name .. ".htm"

		self.template, _, err = tparser.parse(sourcefile)

		-- If we have no valid template throw error, otherwise cache the template
		if not self.template then
			error("Failed to load template '" .. name .. "'.\n" ..
			      "Error while parsing template '" .. sourcefile .. "':\n" ..
			      (err or "Unknown syntax error"))
		else
			self.cache[name] = self.template
		end
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
		error("Failed to execute template '" .. self.name .. "'.\n" ..
		      "A runtime error occured: " .. tostring(err or "(nil)"))
	end
end
