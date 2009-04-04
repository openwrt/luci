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
		local f = loadfile(i18ndir .. file .. "." .. lang .. ".lua") or
			loadfile(i18ndir .. file .. "." .. lang .. ".lua.gz")

		if f then
			table[lang] = table[lang] or {}
			setfenv(f, table[lang])
			f()
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
	return load(file, context.lang, force)
end

--- Set the context default translation language.
-- @param lang	Two-letter language code
function setlanguage(lang)
	context.lang = lang:gsub("_", "-")
end

--- Return the translated value for a specific translation key.
-- @param key	Translation key
-- @param def	Default translation
-- @return		Translated string
function translate(key, def)
	return (table[context.lang] and table[context.lang][key])
		or (table[default] and table[default][key])
		or def
end

--- Return the translated value for a specific translation key and use it as sprintf pattern.
-- @param key		Translation key
-- @param default	Default translation
-- @param ...		Format parameters
-- @return			Translated and formatted string
function translatef(key, default, ...)
	return translate(key, default):format(...)
end
