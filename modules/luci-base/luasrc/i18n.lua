-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.i18n", package.seeall)
require("luci.util")

local tparser = require "luci.template.parser"

table   = {}
i18ndir = luci.util.libpath() .. "/i18n/"
loaded  = {}
context = luci.util.threadlocal()
default = "en"

function clear()
end

function load(file, lang, force)
end

-- Alternatively load the translation of the fallback language.
function loadc(file, force)
end

function setlanguage(lang)
	local code, subcode = lang:match("^([A-Za-z][A-Za-z])[%-_]([A-Za-z][A-Za-z])$")
	if not (code and subcode) then
		subcode = lang:match("^([A-Za-z][A-Za-z])$")
		if not subcode then
			return nil
		end
	end

	context.parent = code and code:lower()
	context.lang   = context.parent and context.parent.."-"..subcode:lower() or subcode:lower()

	if tparser.load_catalog(context.lang, i18ndir) and
	   tparser.change_catalog(context.lang)
	then
		return context.lang

	elseif context.parent then
		if tparser.load_catalog(context.parent, i18ndir) and
		   tparser.change_catalog(context.parent)
		then
			return context.parent
		end
	end

	return nil
end

function translate(key)
	return tparser.translate(key) or key
end

function translatef(key, ...)
	return tostring(translate(key)):format(...)
end

-- and ensure that the returned value is a Lua string value.
-- This is the same as calling <code>tostring(translate(...))</code>
function string(key)
	return tostring(translate(key))
end

-- Ensure that the returned value is a Lua string value.
-- This is the same as calling <code>tostring(translatef(...))</code>
function stringf(key, ...)
	return tostring(translate(key)):format(...)
end
