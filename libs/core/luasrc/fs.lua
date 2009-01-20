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

local io    = require "io"
local os    = require "os"
local ltn12 = require "luci.ltn12"
local posix = require "posix"

local type  = type

--- LuCI filesystem library.
module "luci.fs"

--- Test for file access permission on given path.
-- @class		function
-- @name		access
-- @param str	String value containing the path
-- @return		Number containing the return code, 0 on sucess or nil on error
-- @return		String containing the error description (if any)
-- @return		Number containing the os specific errno (if any)
access = posix.access

--- Evaluate given shell glob pattern and return a table containing all matching
-- file and directory entries.
-- @class			function
-- @name			glob
-- @param filename	String containing the path of the file to read
-- @return			Table containing file and directory entries or nil if no matches
-- @return			String containing the error description (if no matches)
-- @return			Number containing the os specific errno (if no matches)
glob = posix.glob

--- Checks wheather the given path exists and points to a regular file.
-- @param filename	String containing the path of the file to test
-- @return			Boolean indicating wheather given path points to regular file
function isfile(filename)
	return posix.stat(filename, "type") == "regular"
end

--- Checks wheather the given path exists and points to a directory.
-- @param dirname	String containing the path of the directory to test
-- @return			Boolean indicating wheather given path points to directory
function isdirectory(dirname)
	return posix.stat(dirname, "type") == "directory"
end

--- Read the whole content of the given file into memory.
-- @param filename	String containing the path of the file to read
-- @return			String containing the file contents or nil on error
-- @return			String containing the error message on error
function readfile(filename)
	local fp, err = io.open(filename)

	if fp == nil then
		return nil, err
	end

	local data = fp:read("*a")
	fp:close()
	return data
end

--- Write the contents of given string to given file.
-- @param filename	String containing the path of the file to read
-- @param data		String containing the data to write
-- @return			Boolean containing true on success or nil on error
-- @return			String containing the error message on error
function writefile(filename, data)
	local fp, err = io.open(filename, "w")

	if fp == nil then
		return nil, err
	end

	fp:write(data)
	fp:close()

	return true
end

--- Copies a file.
-- @param source	Source file
-- @param dest		Destination
-- @return			Boolean containing true on success or nil on error
function copy(source, dest)
	return ltn12.pump.all(
		ltn12.source.file(io.open(source)),
		ltn12.sink.file(io.open(dest, "w"))
	)
end

--- Renames a file.
-- @param source	Source file
-- @param dest		Destination
-- @return			Boolean containing true on success or nil on error
function rename(source, dest)
	local stat, err, code = os.rename(source, dest)
	if code == 18 then
		stat, err, code = copy(source, dest)
		if stat then
			stat, err, code = unlink(source)
		end
	end
	return stat, err, code
end

--- Get the last modification time of given file path in Unix epoch format.
-- @param path	String containing the path of the file or directory to read
-- @return		Number containing the epoch time or nil on error
-- @return		String containing the error description (if any)
-- @return		Number containing the os specific errno (if any)
function mtime(path)
	return posix.stat(path, "mtime")
end

--- Set the last modification time  of given file path in Unix epoch format.
-- @param path	String containing the path of the file or directory to read
-- @param mtime	Last modification timestamp
-- @param atime Last accessed timestamp
-- @return		0 in case of success nil on error
-- @return		String containing the error description (if any)
-- @return		Number containing the os specific errno (if any)
utime = posix.utime

--- Return the last element - usually the filename - from the given path with
-- the directory component stripped.
-- @class		function
-- @name		basename
-- @param path	String containing the path to strip
-- @return		String containing the base name of given path
-- @see			dirname
basename = posix.basename

--- Return the directory component of the given path with the last element
-- stripped of.
-- @class		function
-- @name		dirname
-- @param path	String containing the path to strip
-- @return		String containing the directory component of given path
-- @see			basename
dirname = posix.dirname

--- Return a table containing all entries of the specified directory.
-- @class		function
-- @name		dir
-- @param path	String containing the path of the directory to scan
-- @return		Table containing file and directory entries or nil on error
-- @return		String containing the error description on error
-- @return		Number containing the os specific errno on error
dir = posix.dir

--- Create a new directory, recursively on demand.
-- @param path		String with the name or path of the directory to create
-- @param recursive	Create multiple directory levels (optional, default is true)
-- @return			Number with the return code, 0 on sucess or nil on error
-- @return			String containing the error description on error
-- @return			Number containing the os specific errno on error
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

--- Remove the given empty directory.
-- @class		function
-- @name		rmdir
-- @param path	String containing the path of the directory to remove
-- @return		Number with the return code, 0 on sucess or nil on error
-- @return		String containing the error description on error
-- @return		Number containing the os specific errno on error
rmdir = posix.rmdir

--- Get information about given file or directory.
-- @class		function
-- @name		stat
-- @param path	String containing the path of the directory to query
-- @return		Table containing file or directory properties or nil on error
-- @return		String containing the error description on error
-- @return		Number containing the os specific errno on error
stat = posix.stat

--- Set permissions on given file or directory.
-- @class		function
-- @name		chmod
-- @param path	String containing the path of the directory
-- @param perm	String containing the permissions to set ([ugoa][+-][rwx])
-- @return		Number with the return code, 0 on sucess or nil on error
-- @return		String containing the error description on error
-- @return		Number containing the os specific errno on error
chmod = posix.chmod

--- Create a hard- or symlink from given file (or directory) to specified target
-- file (or directory) path.
-- @class			function
-- @name			link
-- @param path1		String containing the source path to link
-- @param path2		String containing the destination path for the link
-- @param symlink	Boolean indicating wheather to create a symlink (optional)
-- @return			Number with the return code, 0 on sucess or nil on error
-- @return			String containing the error description on error
-- @return			Number containing the os specific errno on error
link = posix.link

--- Remove the given file.
-- @class		function
-- @name		unlink
-- @param path	String containing the path of the file to remove
-- @return		Number with the return code, 0 on sucess or nil on error
-- @return		String containing the error description on error
-- @return		Number containing the os specific errno on error
unlink = posix.unlink

--- Retrieve target of given symlink.
-- @class		function
-- @name		readlink
-- @param path	String containing the path of the symlink to read
-- @return		String containing the link target or nil on error
-- @return		String containing the error description on error
-- @return		Number containing the os specific errno on error
readlink = posix.readlink
