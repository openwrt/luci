--[[
LuCI - Filesystem tools

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

module("luci.fs", package.seeall)

require("posix")

-- Glob
glob = posix.glob

-- Checks whether a file exists
function isfile(filename)
	local fp = io.open(filename, "r")
	if fp then fp:close() end
	return fp ~= nil
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
dir = posix.dir

-- wrapper for posix.mkdir
function mkdir(path, recursive)
	if recursive then
		local base = "."

		if path:sub(1,1) == "/" then
			base = ""
			path = path:gsub("^/+","")
		end

		for elem in path:gmatch("([^/]+)/*") do
			base = base .. "/" .. elem

			local stat = posix.stat( base )

			if not stat then
				local stat, errmsg, errno = posix.mkdir( base )

				if type(stat) ~= "number" or stat ~= 0 then
					return stat, errmsg, errno
				end
			else
				if stat.type ~= "directory" then
					return nil, base .. ": File exists", 17
				end
			end
		end

		return 0
	else
		return posix.mkdir( path )
	end
end

-- Alias for posix.rmdir
rmdir = posix.rmdir

-- Alias for posix.stat
stat = posix.stat

-- Alias for posix.chmod
chmod = posix.chmod

-- Alias for posix.link
link = posix.link

-- Alias for posix.unlink
unlink = posix.unlink
