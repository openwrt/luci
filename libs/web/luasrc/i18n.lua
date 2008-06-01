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

module("luci.i18n", package.seeall)
require("luci.sys")

table   = {}
i18ndir = luci.sys.libpath() .. "/i18n/"
loaded  = {}

-- Clears the translation table
function clear()
	table = {}
end

-- Loads a translation and copies its data into the global translation table
function load(file, force)
	if force or not loaded[file] then
		local f = loadfile(i18ndir..file..".lua") or loadfile(i18ndir..file)
		if f then
			setfenv(f, table)
			f()
			loaded[file] = true
			return true
		else
			return false
		end
	else
		return true
	end
end

-- Same as load but autocompletes the filename with .LANG from config.lang
function loadc(file, force)
	return load(file .. "." .. require("luci.config").main.lang, force)
end

-- Returns the i18n-value defined by "key" or if there is no such: "default"
function translate(key, default)
	return table[key] or default
end

-- Translate shourtcut with sprintf/string.format inclusion
function translatef(key, default, ...)
	return translate(key, default):format(...)
end