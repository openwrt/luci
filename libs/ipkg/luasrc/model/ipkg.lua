--[[
LuCI - Lua Configuration Interface

(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local os   = require "os"
local io   = require "io"
local util = require "luci.util"

local type  = type
local pairs = pairs
local error = error

local ipkg = "opkg -force-defaults"

--- LuCI IPKG/OPKG call abstraction library
module "luci.model.ipkg"


-- Internal action function
local function _action(cmd, ...)
	local pkg = ""
	arg.n = nil
	for k, v in pairs(arg) do
		pkg = pkg .. " '" .. v:gsub("'", "") .. "'"
	end

	local c = ipkg.." "..cmd.." "..pkg.." >/dev/null 2>&1"
	local r = os.execute(c)
	return (r == 0), r
end

-- Internal parser function
local function _parselist(rawdata)
	if type(rawdata) ~= "function" then
		error("IPKG: Invalid rawdata given")
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

	-- IPKG sometimes kills the whole machine because it sucks
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
-- @return IPKG return code
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
-- @return IPKG return code
function remove(...)
	return _action("remove", ...)
end

--- Update package lists.
-- @return Boolean indicating the status of the action
-- @return IPKG return code
function update()
	return _action("update")
end

--- Upgrades all installed packages.
-- @return Boolean indicating the status of the action
-- @return IPKG return code
function upgrade()
	return _action("upgrade")
end
