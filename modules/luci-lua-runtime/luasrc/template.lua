-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

local util = require "luci.util"
local config = require "luci.config"
local tparser = require "luci.template.parser"

local tostring, pairs, loadstring = tostring, pairs, loadstring
local setmetatable, loadfile = setmetatable, loadfile
local getfenv, setfenv, rawget = getfenv, setfenv, rawget
local assert, type, error = assert, type, error
local table, string, unpack = table, string, unpack


---
--- bootstrap
---
local _G = _G
local L = _G.L

local http = _G.L.http

local disp = require "luci.dispatcher"
local i18n = require "luci.i18n"
local xml = require "luci.xml"
local fs = require "nixio.fs"


--- LuCI template library.
module "luci.template"

config.template = config.template or {}
viewdir = config.template.viewdir or util.libpath() .. "/view"


-- Define the namespace for template modules
context = {} --util.threadlocal()

--- Render a certain template.
-- @param name		Template name
-- @param scope		Scope to assign to template (optional)
function render(name, scope)
	return Template(name):render(scope or getfenv(2))
end

--- Render a template from a string.
-- @param template	Template string
-- @param scope		Scope to assign to template (optional)
function render_string(template, scope)
	return Template(nil, template):render(scope or getfenv(2))
end


-- Template class
Template = util.class()

-- Shared template cache to store templates in to avoid unnecessary reloading
Template.cache = setmetatable({}, {__mode = "v"})



local function _ifattr(cond, key, val, noescape)
	if cond then
		local env = getfenv(3)
		local scope = (type(env.self) == "table") and env.self
		if type(val) == "table" then
			if not next(val) then
				return ''
			else
				val = util.serialize_json(val)
			end
		end

		val = tostring(val or
			(type(env[key]) ~= "function" and env[key]) or
			(scope and type(scope[key]) ~= "function" and scope[key]) or "")

		if noescape ~= true then
			val = xml.pcdata(val)
		end

		return string.format(' %s="%s"', tostring(key), val)
	else
		return ''
	end
end

context.viewns = setmetatable({
	include     = function(name)
		if fs.access(viewdir .. "/" .. name .. ".htm") then
			Template(name):render(getfenv(2))
		else
			L.include(name, getfenv(2))
		end
	end;
	translate   = i18n.translate;
	translatef  = i18n.translatef;
	export      = function(k, v) if context.viewns[k] == nil then context.viewns[k] = v end end;
	striptags   = xml.striptags;
	pcdata      = xml.pcdata;
	ifattr      = function(...) return _ifattr(...) end;
	attr        = function(...) return _ifattr(true, ...) end;
	url         = disp.build_url;
}, {__index=function(tbl, key)
	if key == "controller" then
		return disp.build_url()
	elseif key == "REQUEST_URI" then
		return disp.build_url(unpack(disp.context.requestpath))
	elseif key == "FULL_REQUEST_URI" then
		local url = { http:getenv("SCRIPT_NAME") or "", http:getenv("PATH_INFO") }
		local query = http:getenv("QUERY_STRING")
		if query and #query > 0 then
			url[#url+1] = "?"
			url[#url+1] = query
		end
		return table.concat(url, "")
	elseif key == "token" then
		return disp.context.authtoken
	elseif key == "theme" then
		return L.media and fs.basename(L.media) or tostring(L)
	elseif key == "resource" then
		return L.config.main.resourcebase
	else
		return rawget(tbl, key) or _G[key] or L[key]
	end
end})


-- Constructor - Reads and compiles the template on-demand
function Template.__init__(self, name, template)
	if name then
		self.template = self.cache[name]
		self.name = name
	else
		self.name = "[string]"
	end

	-- Create a new namespace for this template
	self.viewns = context.viewns

	-- If we have a cached template, skip compiling and loading
	if not self.template then

		-- Compile template
		local err
		local sourcefile

		if name then
			sourcefile = viewdir .. "/" .. name .. ".htm"
			self.template, _, err = tparser.parse(sourcefile)
		else
			sourcefile = "[string]"
			self.template, _, err = tparser.parse_string(template)
		end

		-- If we have no valid template throw error, otherwise cache the template
		if not self.template then
			error("Failed to load template '" .. self.name .. "'.\n" ..
			      "Error while parsing template '" .. sourcefile .. "':\n" ..
			      (err or "Unknown syntax error"))
		elseif name then
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
		      "A runtime error occurred: " .. tostring(err or "(nil)"))
	end
end
