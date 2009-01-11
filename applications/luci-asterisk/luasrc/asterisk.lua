--[[
LuCI - Lua Configuration Interface
Asterisk PBX interface library

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.asterisk", package.seeall)

local _io  = require("io")
local sys  = require("luci.sys")
local util = require("luci.util")

AST_BIN   = "/usr/sbin/asterisk"
AST_FLAGS = "-r -x"


--- LuCI Asterisk io interface
-- Handles low level io.
-- @type	module
io = luci.util.class()

--- Execute command and return output
-- @param command	String containing the command to execute
-- @return			String containing the command output
function io.exec(command)
	local fh = _io.popen( "%s %s %q" %{ AST_BIN, AST_FLAGS, command }, "r" )
	assert(fh, "Failed to invoke asterisk")

	local buffer = fh:read("*a")
	fh:close()
	return buffer
end

--- Execute command and invoke given callback for each readed line
-- @param command	String containing the command to execute
-- @param callback	Function to call back for each line
-- @return			Always true
function io.execl(command, callback)
	local ln
	local fh = _io.popen( "%s %s %q" %{ AST_BIN, AST_FLAGS, command }, "r" )
	assert(fh, "Failed to invoke asterisk")

	repeat
		ln = fh:read("*l")
		callback(ln)
	until not ln

	fh:close()
	return true
end

--- Execute command and return an iterator that returns one line per invokation
-- @param command	String containing the command to execute
-- @return			Iterator function
function io.execi(command)
	local fh = _io.popen( "%s %s %q" %{ AST_BIN, AST_FLAGS, command }, "r" )
	assert(fh, "Failed to invoke asterisk")

	return function()
		local ln = fh:read("*l")
		if not ln then fh:close() end
		return ln
	end
end


--- LuCI Asterisk - core status
core = luci.util.class()

--- Retrive version string.
-- @return	String containing the reported asterisk version
function core.version(self)
	local version = io.exec("core show version")
	return version:gsub(" *\n", "")
end


--- LuCI Asterisk - SIP information.
-- @type module
sip = luci.util.class()

--- Get a list of known SIP peers
-- @return		Table containing each SIP peer
function sip.peers(self)
	local head  = false
	local peers = { }

	for line in io.execi("sip show peers") do
		if not head then
			head = true
		elseif not line:match(" sip peers ") then
			local online, delay, id, uid
			local name, host, dyn, nat, acl, port, status =
				line:match("(.-) +(.-) +([D ])   ([N ])   (.)  (%d+) +(.+)")

			if host == '(Unspecified)' then host = nil end
			if port == '0' then port = nil else port = tonumber(port) end

			dyn = ( dyn == 'D' and true or false )
			nat = ( nat == 'N' and true or false )
			acl = ( acl ~= ' ' and true or false )

			online, delay = status:match("(OK) %((%d+) ms%)")

			if online == 'OK' then
				online = true
				delay  = tonumber(delay)
			elseif status ~= 'Unmonitored' then
				online = false
				delay  = 0
			else
				online = nil
				delay  = 0
			end

			id, uid = name:match("(.+)/(.+)")

			if not ( id and uid ) then
				id  = name .. "..."
				uid = nil
			end

			peers[#peers+1] = {
				online  = online,
				delay   = delay,
				name    = id,
				user    = uid,
				dynamic = dyn,
				nat     = nat,
				acl     = acl,
				host    = host,
				port    = port
			}
		end
	end

	return peers
end

--- Get informations of given SIP peer
-- @param peer	String containing the name of the SIP peer
function sip.peer(peer)
	local info = { }
	local keys = { }

	for line in io.execi("sip show peer " .. peer) do
		if #line > 0 then
			local key, val = line:match("(.-) *: +(.*)")
			if key and val then

				key = key:gsub("^ +",""):gsub(" +$", "")
				val = val:gsub("^ +",""):gsub(" +$", "")

				if key == "* Name" then
					key = "Name"
				elseif key == "Addr->IP" then
					info.address, info.port = val:match("(.+) Port (.+)")
					info.port = tonumber(info.port)
				elseif key == "Status" then
					info.online, info.delay = val:match("(OK) %((%d+) ms%)")
					if info.online == 'OK' then
						info.online = true
						info.delay  = tonumber(info.delay)
					elseif status ~= 'Unmonitored' then
						info.online = false
						info.delay  = 0
					else
						info.online = nil
						info.delay  = 0
					end
				end

				if val == 'Yes' or val == 'yes' or val == '<Set>' then
					val = true
				elseif val == 'No' or val == 'no' then
					val = false
				elseif val == '<Not set>' or val == '(none)' then
					val = nil
				end

				keys[#keys+1] = key
				info[key] = val
			end
		end
	end

	return info, keys
end
