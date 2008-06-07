--[[
LuCI - HTTP-Interaction

Description:
HTTP-Header manipulator and form variable preprocessor

FileId:
$Id$

ToDo:
- Cookie handling

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

module("luci.http", package.seeall)

if ENV and ENV.HASERLVER then
	require("luci.sgi.haserl")
elseif webuci then
	require("luci.sgi.webuci")
end

function build_querystring(table)
	local s="?"
	
	for k, v in pairs(table) do
		s = s .. k .. "=" .. v .. "&"
	end
	
	return s
end

function urldecode(str)
	str = str:gsub("+", " ")
	str = str:gsub("%%(%x%x)",
		function(h) return string.char(tonumber(h,16)) end)
	str = str:gsub("\r\n", "\n")
	return str	
end

function urlencode(str)
	str = str:gsub("\n", "\r\n")
	str = str:gsub("([^%w ])",
		function (c) return string.format ("%%%02X", string.byte(c)) end)
	str = str:gsub(" ", "+")
	return str	
end