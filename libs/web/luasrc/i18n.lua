--[[
LuCI - Internationalisation

Description:
A very minimalistic but yet effective internationalisation module

FileId:
$Id$

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

--- LuCI translation library.
module("luci.i18n", package.seeall)
require("luci.util")
require("lmo")

table   = {}
i18ndir = luci.util.libpath() .. "/i18n/"
loaded  = {}
context = luci.util.threadlocal()
default = "en"

--- Clear the translation table.
function clear()
	table = {}
end

--- Load a translation and copy its data into the translation table.
-- @param file	Language file
-- @param lang	Two-letter language code
-- @param force	Force reload even if already loaded (optional)
-- @return		Success status
function load(file, lang, force)
	lang = lang and lang:gsub("_", "-") or ""
	if force or not loaded[lang] or not loaded[lang][file] then
		local f = lmo.open(i18ndir .. file .. "." .. lang .. ".lmo")
		if f then
			if not table[lang] then
				table[lang] = { f }
				setmetatable(table[lang], {
					__index = function(tbl, key)
						for i = 1, #tbl do
							local s = rawget(tbl, i):lookup(key)
							if s then return s end
						end
					end
				})
			else
				table[lang][#table[lang]+1] = f
			end

			loaded[lang] = loaded[lang] or {}
			loaded[lang][file] = true
			return true
		else
			return false
		end
	else
		return true
	end
end

--- Load a translation file using the default translation language.
-- Alternatively load the translation of the fallback language.
-- @param file	Language file
-- @param force	Force reload even if already loaded (optional)
function loadc(file, force)
	load(file, default, force)
	if context.parent then load(file, context.parent, force) end
	return load(file, context.lang, force)
end

--- Set the context default translation language.
-- @param lang	Two-letter language code
function setlanguage(lang)
	context.lang   = lang:gsub("_", "-")
	context.parent = (context.lang:match("^([a-z][a-z])_"))
end

--- Return the translated value for a specific translation key.
-- @param key	Translation key
-- @param def	Default translation
-- @return		Translated string
function translate(key, def)
	return (table[context.lang] and table[context.lang][key])
		or (table[context.parent] and table[context.parent][key])
		or (table[default] and table[default][key])
		or def
end

--- Return the translated value for a specific translation key and use it as sprintf pattern.
-- @param key		Translation key
-- @param default	Default translation
-- @param ...		Format parameters
-- @return			Translated and formatted string
function translatef(key, default, ...)
	return tostring(translate(key, default)):format(...)
end

--- Return the translated value for a specific translation key
-- and ensure that the returned value is a Lua string value.
-- This is the same as calling <code>tostring(translate(...))</code>
-- @param key		Translation key
-- @param default	Default translation
-- @return			Translated string
function string(key, default)
	return tostring(translate(key, default))
end

--- Return the translated value for a specific translation key and use it as sprintf pattern.
-- Ensure that the returned value is a Lua string value.
-- This is the same as calling <code>tostring(translatef(...))</code>
-- @param key		Translation key
-- @param default	Default translation
-- @param ...		Format parameters
-- @return			Translated and formatted string
function stringf(key, default, ...)
	return tostring(translate(key, default)):format(...)
end
