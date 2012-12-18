--[[
LuCI - Lua Configuration Interface

(c) 2008-2011 Jo-Philipp Wich <xm@subsignal.org>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

]]--

local os   = require "os"
local io   = require "io"
local fs   = require "nixio.fs"
local util = require "luci.util"

local type  = type
local pairs = pairs
local error = error
local table = table

local ipkg = "opkg --force-removal-of-dependent-packages --force-overwrite --nocase"
local icfg = "/etc/opkg.conf"

--- LuCI OPKG call abstraction library
module "luci.model.ipkg"


-- Internal action function
local function _action(cmd, ...)
	local pkg = ""
	for k, v in pairs({...}) do
		pkg = pkg .. " '" .. v:gsub("'", "") .. "'"
	end

	local c = "%s %s %s >/tmp/opkg.stdout 2>/tmp/opkg.stderr" %{ ipkg, cmd, pkg }
	local r = os.execute(c)
	local e = fs.readfile("/tmp/opkg.stderr")
	local o = fs.readfile("/tmp/opkg.stdout")

	fs.unlink("/tmp/opkg.stderr")
	fs.unlink("/tmp/opkg.stdout")

	return r, o or "", e or ""
end

-- Internal parser function
local function _parselist(rawdata)
	if type(rawdata) ~= "function" then
		error("OPKG: Invalid rawdata given")
	end

	local data = {}
	local c = {}
	local l = nil

	for line in rawdata do
		if line:sub(1, 1) ~= " " then
			local key, val = line:match("(.-): ?(.*)%s*")

			if key and val then
				if key == "Package" then
					c = {Package = val}
					data[val] = c
				elseif key == "Status" then
					c.Status = {}
					for j in val:gmatch("([^ ]+)") do
						c.Status[j] = true
					end
				else
					c[key] = val
				end
				l = key
			end
		else
			-- Multi-line field
			c[l] = c[l] .. "\n" .. line
		end
	end

	return data
end

-- Internal lookup function
local function _lookup(act, pkg)
	local cmd = ipkg .. " " .. act
	if pkg then
		cmd = cmd .. " '" .. pkg:gsub("'", "") .. "'"
	end

	-- OPKG sometimes kills the whole machine because it sucks
	-- Therefore we have to use a sucky approach too and use
	-- tmpfiles instead of directly reading the output
	local tmpfile = os.tmpname()
	os.execute(cmd .. (" >%s 2>/dev/null" % tmpfile))

	local data = _parselist(io.lines(tmpfile))
	os.remove(tmpfile)
	return data
end


--- Return information about installed and available packages.
-- @param pkg Limit output to a (set of) packages
-- @return Table containing package information
function info(pkg)
	return _lookup("info", pkg)
end

--- Return the package status of one or more packages.
-- @param pkg Limit output to a (set of) packages
-- @return Table containing package status information
function status(pkg)
	return _lookup("status", pkg)
end

--- Install one or more packages.
-- @param ... List of packages to install
-- @return Boolean indicating the status of the action
-- @return OPKG return code, STDOUT and STDERR
function install(...)
	return _action("install", ...)
end

--- Determine whether a given package is installed.
-- @param pkg Package
-- @return Boolean
function installed(pkg)
	local p = status(pkg)[pkg]
	return (p and p.Status and p.Status.installed)
end

--- Remove one or more packages.
-- @param ... List of packages to install
-- @return Boolean indicating the status of the action
-- @return OPKG return code, STDOUT and STDERR
function remove(...)
	return _action("remove", ...)
end

--- Update package lists.
-- @return Boolean indicating the status of the action
-- @return OPKG return code, STDOUT and STDERR
function update()
	return _action("update")
end

--- Upgrades all installed packages.
-- @return Boolean indicating the status of the action
-- @return OPKG return code, STDOUT and STDERR
function upgrade()
	return _action("upgrade")
end

-- List helper
function _list(action, pat, cb)
	local fd = io.popen(ipkg .. " " .. action ..
		(pat and (" '%s'" % pat:gsub("'", "")) or ""))

	if fd then
		local name, version, desc
		while true do
			local line = fd:read("*l")
			if not line then break end

			name, version, desc = line:match("^(.-) %- (.-) %- (.+)")

			if not name then
				name, version = line:match("^(.-) %- (.+)")
				desc = ""
			end

			cb(name, version, desc)

			name    = nil
			version = nil
			desc    = nil
		end

		fd:close()
	end
end

--- List all packages known to opkg.
-- @param pat	Only find packages matching this pattern, nil lists all packages
-- @param cb	Callback function invoked for each package, receives name, version and description as arguments
-- @return	nothing
function list_all(pat, cb)
	_list("list", pat, cb)
end

--- List installed packages.
-- @param pat	Only find packages matching this pattern, nil lists all packages
-- @param cb	Callback function invoked for each package, receives name, version and description as arguments
-- @return	nothing
function list_installed(pat, cb)
	_list("list_installed", pat, cb)
end

--- Find packages that match the given pattern.
-- @param pat	Find packages whose names or descriptions match this pattern, nil results in zero results
-- @param cb	Callback function invoked for each patckage, receives name, version and description as arguments
-- @return	nothing
function find(pat, cb)
	_list("find", pat, cb)
end


--- Determines the overlay root used by opkg.
-- @return		String containing the directory path of the overlay root.
function overlay_root()
	local od = "/"
	local fd = io.open(icfg, "r")

	if fd then
		local ln

		repeat
			ln = fd:read("*l")
			if ln and ln:match("^%s*option%s+overlay_root%s+") then
				od = ln:match("^%s*option%s+overlay_root%s+(%S+)")

				local s = fs.stat(od)
				if not s or s.type ~= "dir" then
					od = "/"
				end

				break
			end
		until not ln

		fd:close()
	end

	return od
end
