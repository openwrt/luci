--[[
FFLuCI - Filesystem tools

Description:
A module offering often needed filesystem manipulation functions

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

module("ffluci.fs", package.seeall)

require("lfs")

-- Returns the content of file
function readfile(filename)
	local fp = io.open(filename)
	if fp == nil then
		error("Unable to open file for reading: " .. filename)
	end
	local data = fp:read("*a")
	fp:close()
	return data	
end

-- Writes given data to a file
function writefile(filename, data)
	local fp = io.open(filename, "w")
	if fp == nil then
		error("Unable to open file for writing: " .. filename)
	end
	fp:write(data)
	fp:close()
end

-- Returns the file modification date/time of "path"
function mtime(path)
	return lfs.attributes(path, "modification")
end

-- Simplified dirname function
function dirname(file)
	return string.gsub(file, "[^/]+$", "")
end

-- Diriterator - alias for lfs.dir - filter . and ..
function dir(path)
	local e = {}
	for entry in lfs.dir(path) do
		if not(entry == "." or entry == "..") then
			table.insert(e, entry)
		end
	end
	return e
end