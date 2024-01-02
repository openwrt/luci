-- Copyright 2022 Jo-Philipp Wich <jo@mein.io>
-- Licensed to the public under the Apache License 2.0.

local coroutine, assert, error, type, require = coroutine, assert, error, type, require
local tmpl  = require "luci.template"
local util  = require "luci.util"
local http  = require "luci.http"
local sys   = require "luci.sys"
local ltn12 = require "luci.ltn12"


--- LuCI ucode bridge library.
module "luci.ucodebridge"

local function run(fn, ...)
	local co = coroutine.create(fn)
	local ok, ret

	while coroutine.status(co) ~= "dead" do
		ok, ret = coroutine.resume(co, ...)

		if not ok then
			error(ret)
		end
	end

	return ret
end

function compile(path)
	run(function(path)
		return tmpl.Template(path)
	end, path)
end

function render(path, scope)
	run(tmpl.render, path, scope)
end

function call(modname, method, ...)
	return run(function(module, method, ...)
		local mod = require(modname)
		local func = mod[method]

		assert(func ~= nil,
		       'Cannot resolve function "' .. method .. '". Is it misspelled or local?')

		assert(type(func) == "function",
		       'The symbol "' .. method .. '" does not refer to a function but data ' ..
		       'of type "' .. type(func) .. '".')

		return func(...)
	end, modname, method, ...)
end
