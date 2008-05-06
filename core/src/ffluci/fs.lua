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

require("posix")

-- Glob
function glob(pattern)
	return posix.glob(pattern)
end

-- Checks whether a file exists
function isfile(filename)
	local fp = io.open(path, "r")
	if file then file:close() end
	return file ~= nil
end	

-- Returns the content of file
function readfile(filename)
	local fp, err = io.open(filename)
	
	if fp == nil then
		return nil, err
	end
	
	local data = fp:read("*a")
	fp:close()
	return data	
end

-- Returns the content of file as array of lines
function readfilel(filename)
	local fp, err = io.open(filename)
	local line = ""
	local data = {}
		
	if fp == nil then
		return nil, err
	end
	
	while true do
		line = fp:read()
		if (line == nil) then break end
		table.insert(data, line)
	end 	
	
	fp:close()
	return data	
end

-- Writes given data to a file
function writefile(filename, data)
	local fp, err = io.open(filename, "w")
	
	if fp == nil then
		return nil, err
	end
	
	fp:write(data)
	fp:close()
	
	return true
end

-- Returns the file modification date/time of "path"
function mtime(path)
	return posix.stat(path, "mtime")
end

-- basename wrapper
basename = posix.basename

-- dirname wrapper
dirname = posix.dirname

-- dir wrapper
function dir(path)
	local dir = {}
	for node in posix.files(path) do
		table.insert(dir, 1, node)
	end 
	return dir
end

-- Alias for lfs.mkdir
mkdir = posix.mkdir