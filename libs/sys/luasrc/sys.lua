--[[
LuCI - System library

Description:
Utilities for interaction with the Linux system

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
local posix = require "posix"
local table = require "table"

local luci  = {}
luci.util   = require "luci.util"
luci.fs     = require "luci.fs"
luci.ip     = require "luci.ip"

local tonumber, ipairs, pairs, pcall = tonumber, ipairs, pairs, pcall


--- LuCI Linux and POSIX system utilities.
module "luci.sys"

--- Execute a given shell command and return the error code
-- @class		function
-- @name		call
-- @param 		...		Command to call
-- @return		Error code of the command
function call(...)
	return os.execute(...) / 256
end

--- Execute a given shell command and capture its standard output
-- @class		function
-- @name		exec
-- @param command	Command to call
-- @return			String containg the return the output of the command
exec = luci.util.exec

--- Invoke the luci-flash executable to write an image to the flash memory.
-- @param image		Local path or URL to image file
-- @param kpattern	Pattern of files to keep over flash process
-- @return			Return value of os.execute()
function flash(image, kpattern)
	local cmd = "luci-flash "
	if kpattern then
		cmd = cmd .. "-k '" .. kpattern:gsub("'", "") .. "' "
	end
	cmd = cmd .. "'" .. image:gsub("'", "") .. "' >/dev/null 2>&1"

	return os.execute(cmd)
end

--- Retrieve information about currently mounted file systems.
-- @return 	Table containing mount information
function mounts()
	local data = {}
	local k = {"fs", "blocks", "used", "available", "percent", "mountpoint"}
	local ps = luci.util.execi("df")

	if not ps then
		return
	else
		ps()
	end

	for line in ps do
		local row = {}

		local j = 1
		for value in line:gmatch("[^%s]+") do
			row[k[j]] = value
			j = j + 1
		end

		if row[k[1]] then

			-- this is a rather ugly workaround to cope with wrapped lines in
			-- the df output:
			--
			--	/dev/scsi/host0/bus0/target0/lun0/part3
			--                   114382024  93566472  15005244  86% /mnt/usb
			--

			if not row[k[2]] then
				j = 2
				line = ps()
				for value in line:gmatch("[^%s]+") do
					row[k[j]] = value
					j = j + 1
				end
			end

			table.insert(data, row)
		end
	end

	return data
end

--- Retrieve environment variables. If no variable is given then a table
-- containing the whole environment is returned otherwise this function returns
-- the corresponding string value for the given name or nil if no such variable
-- exists.
-- @class		function
-- @name		getenv
-- @param var	Name of the environment variable to retrieve (optional)
-- @return		String containg the value of the specified variable
-- @return		Table containing all variables if no variable name is given
getenv = posix.getenv

--- Determine the current hostname.
-- @return		String containing the system hostname
function hostname()
	return io.lines("/proc/sys/kernel/hostname")()
end

--- Returns the contents of a documented referred by an URL.
-- @param url	 The URL to retrieve
-- @param stream Return a stream instead of a buffer
-- @param target Directly write to target file name
-- @return		String containing the contents of given the URL
function httpget(url, stream, target)
	if not target then
		local source = stream and io.open or luci.util.exec
		return source("wget -qO- '"..url:gsub("'", "").."'")
	else
		return os.execute("wget -qO '%s' '%s'" %
			{target:gsub("'", ""), url:gsub("'", "")})
	end
end

--- Returns the system load average values.
-- @return	String containing the average load value 1 minute ago
-- @return	String containing the average load value 5 minutes ago
-- @return	String containing the average load value 15 minutes ago
-- @return	String containing the active and total number of processes
-- @return	String containing the last used pid
function loadavg()
	local loadavg = io.lines("/proc/loadavg")()
	return loadavg:match("^(.-) (.-) (.-) (.-) (.-)$")
end

--- Initiate a system reboot.
-- @return	Return value of os.execute()
function reboot()
	return os.execute("reboot >/dev/null 2>&1")
end

--- Returns the system type, cpu name and installed physical memory.
-- @return	String containing the system or platform identifier
-- @return	String containing hardware model information
-- @return	String containing the total memory amount in kB
-- @return	String containing the memory used for caching in kB
-- @return	String containing the memory used for buffering in kB
-- @return	String containing the free memory amount in kB
function sysinfo()
	local c1 = "cat /proc/cpuinfo|grep system\\ typ|cut -d: -f2 2>/dev/null"
	local c2 = "uname -m 2>/dev/null"
	local c3 = "cat /proc/cpuinfo|grep model\\ name|cut -d: -f2 2>/dev/null"
	local c4 = "cat /proc/cpuinfo|grep cpu\\ model|cut -d: -f2 2>/dev/null"
	local c5 = "cat /proc/meminfo|grep MemTotal|awk {' print $2 '} 2>/dev/null"
	local c6 = "cat /proc/meminfo|grep ^Cached|awk {' print $2 '} 2>/dev/null"
	local c7 = "cat /proc/meminfo|grep MemFree|awk {' print $2 '} 2>/dev/null"
	local c8 = "cat /proc/meminfo|grep Buffers|awk {' print $2 '} 2>/dev/null"

	local system = luci.util.trim(luci.util.exec(c1))
	local model = ""
	local memtotal = tonumber(luci.util.trim(luci.util.exec(c5)))
	local memcached = tonumber(luci.util.trim(luci.util.exec(c6)))
	local memfree = tonumber(luci.util.trim(luci.util.exec(c7)))
	local membuffers = tonumber(luci.util.trim(luci.util.exec(c8)))

	if system == "" then
		system = luci.util.trim(luci.util.exec(c2))
		model = luci.util.trim(luci.util.exec(c3))
	else
		model = luci.util.trim(luci.util.exec(c4))
	end

	return system, model, memtotal, memcached, membuffers, memfree
end

--- Retrieves the output of the "logread" command.
-- @return	String containing the current log buffer
function syslog()
	return luci.util.exec("logread")
end

--- Generates a random id with specified length.
-- @param bytes	Number of bytes for the unique id
-- @return		String containing hex encoded id
function uniqueid(bytes)
	local fp    = io.open("/dev/urandom")
	local chunk = { fp:read(bytes):byte(1, bytes) }
	fp:close()

	local hex = ""

	local pattern = "%02X"
	for i, byte in ipairs(chunk) do
		hex = hex .. pattern:format(byte)
	end

	return hex
end

--- Returns the current system uptime stats.
-- @return	String containing total uptime in seconds
-- @return	String containing idle time in seconds
function uptime()
	local loadavg = io.lines("/proc/uptime")()
	return loadavg:match("^(.-) (.-)$")
end

--- LuCI system utilities / POSIX user group related functions.
-- @class	module
-- @name	luci.sys.group
group = {}

--- Returns information about a POSIX user group.
-- @class function
-- @name		getgroup
-- @param group Group ID or name of a system user group
-- @return	Table with information about the requested group
group.getgroup = posix.getgroup


--- LuCI system utilities / network related functions.
-- @class	module
-- @name	luci.sys.net
net = {}

--- Returns the current arp-table entries as two-dimensional table.
-- @return	Table of table containing the current arp entries.
--			The following fields are defined for arp entry objects:
--			{ "IP address", "HW address", "HW type", "Flags", "Mask", "Device" }
function net.arptable()
	return _parse_delimited_table(io.lines("/proc/net/arp"), "%s%s+")
end

--- Returns conntrack information
-- @return	Table with the currently tracked IP connections
function net.conntrack()
	local connt = {}
	if luci.fs.access("/proc/net/nf_conntrack") then
		for line in io.lines("/proc/net/nf_conntrack") do
			local entry, flags = _parse_mixed_record(line, " +")
			entry.layer3 = flags[1]
			entry.layer4 = flags[2]
			for i=1, #entry do
				entry[i] = nil
			end

			connt[#connt+1] = entry
		end
	elseif luci.fs.access("/proc/net/ip_conntrack") then
		for line in io.lines("/proc/net/ip_conntrack") do
			local entry, flags = _parse_mixed_record(line, " +")
			entry.layer3 = "ipv4"
			entry.layer4 = flags[1]
			for i=1, #entry do
				entry[i] = nil
			end

			connt[#connt+1] = entry
		end
	else
		return nil
	end
	return connt
end

--- Determine the current default route.
-- @return	Table with the properties of the current default route.
--			The following fields are defined:
--			{ "Mask", "RefCnt", "Iface", "Flags", "Window", "IRTT",
--			  "MTU", "Gateway", "Destination", "Metric", "Use" }
function net.defaultroute()
	local routes = net.routes()
	local route = nil

	for i, r in pairs(luci.sys.net.routes()) do
		if r.Destination == "00000000" and (not route or route.Metric > r.Metric) then
			route = r
		end
	end

	return route
end

--- Determine the names of available network interfaces.
-- @return	Table containing all current interface names
function net.devices()
	local devices = {}
	for line in io.lines("/proc/net/dev") do
		table.insert(devices, line:match(" *(.-):"))
	end
	return devices
end


--- Return information about available network interfaces.
-- @return	Table containing all current interface names and their information
function net.deviceinfo()
	local devices = {}
	for line in io.lines("/proc/net/dev") do
		local name, data = line:match("^ *(.-): *(.*)$")
		if name and data then
			devices[name] = luci.util.split(data, " +", nil, true)
		end
	end
	return devices
end


-- Determine the MAC address belonging to the given IP address.
-- @param ip	IPv4 address
-- @return		String containing the MAC address or nil if it cannot be found
function net.ip4mac(ip)
	local mac = nil

	for i, l in ipairs(net.arptable()) do
		if l["IP address"] == ip then
			mac = l["HW address"]
		end
	end

	return mac
end

--- Returns the current kernel routing table entries.
-- @return	Table of tables with properties of the corresponding routes.
--			The following fields are defined for route entry tables:
--			{ "Mask", "RefCnt", "Iface", "Flags", "Window", "IRTT",
--			  "MTU", "Gateway", "Destination", "Metric", "Use" }
function net.routes()
	return _parse_delimited_table(io.lines("/proc/net/route"))
end


--- Tests whether the given host responds to ping probes.
-- @param host	String containing a hostname or IPv4 address
-- @return		Number containing 0 on success and >= 1 on error
function net.pingtest(host)
	return os.execute("ping -c1 '"..host:gsub("'", '').."' >/dev/null 2>&1")
end


--- LuCI system utilities / process related functions.
-- @class	module
-- @name	luci.sys.process
process = {}

--- Get the current process id.
-- @class function
-- @name  process.info
-- @return	Number containing the current pid
process.info = posix.getpid

--- Retrieve information about currently running processes.
-- @return 	Table containing process information
function process.list()
	local data = {}
	local k
	local ps = luci.util.execi("top -bn1")

	if not ps then
		return
	end

	while true do
		local line = ps()
		if not line then
			return
		end

		k = luci.util.split(luci.util.trim(line), "%s+", nil, true)
		if k[1] == "PID" then
			break
		end
	end

	for line in ps do
		local row = {}

		line = luci.util.trim(line)
		for i, value in ipairs(luci.util.split(line, "%s+", #k-1, true)) do
			row[k[i]] = value
		end

		local pid = tonumber(row[k[1]])
		if pid then
			data[pid] = row
		end
	end

	return data
end

--- Set the gid of a process identified by given pid.
-- @param pid	Number containing the process id
-- @param gid	Number containing the Unix group id
-- @return		Boolean indicating successful operation
-- @return		String containing the error message if failed
-- @return		Number containing the error code if failed
function process.setgroup(pid, gid)
	return posix.setpid("g", pid, gid)
end

--- Set the uid of a process identified by given pid.
-- @param pid	Number containing the process id
-- @param uid	Number containing the Unix user id
-- @return		Boolean indicating successful operation
-- @return		String containing the error message if failed
-- @return		Number containing the error code if failed
function process.setuser(pid, uid)
	return posix.setpid("u", pid, uid)
end

--- Send a signal to a process identified by given pid.
-- @class function
-- @name  process.signal
-- @param pid	Number containing the process id
-- @param sig	Signal to send (default: 15 [SIGTERM])
-- @return		Boolean indicating successful operation
-- @return		Number containing the error code if failed
process.signal = posix.kill


--- LuCI system utilities / user related functions.
-- @class	module
-- @name	luci.sys.user
user = {}

--- Retrieve user informations for given uid.
-- @class		function
-- @name		getuser
-- @param uid	Number containing the Unix user id
-- @return		Table containing the following fields:
--				{ "uid", "gid", "name", "passwd", "dir", "shell", "gecos" }
user.getuser = posix.getpasswd

--- Test whether given string matches the password of a given system user.
-- @param username	String containing the Unix user name
-- @param password	String containing the password to compare
-- @return			Boolean indicating wheather the passwords are equal
function user.checkpasswd(username, password)
	local account = user.getuser(username)

	if account then
		local pwd = account.passwd
		local shadowpw
		if #pwd == 1 then
			if luci.fs.stat("/etc/shadow") then
				if not pcall(function()
					for l in io.lines("/etc/shadow") do
						shadowpw = l:match("^%s:([^:]+)" % username)
						if shadowpw then
							pwd = shadowpw
							break
						end
					end
				end) then
					return nil, "Unable to access shadow-file"
				end
			end

			if pwd == "!" then
				return true
			end
		end

		if pwd and #pwd > 0 and password and #password > 0 then
			return (pwd == posix.crypt(password, pwd))
		end
	end

	return false
end

--- Change the password of given user.
-- @param username	String containing the Unix user name
-- @param password	String containing the password to compare
-- @return			Number containing 0 on success and >= 1 on error
function user.setpasswd(username, password)
	if password then
		password = password:gsub("'", "")
	end

	if username then
		username = username:gsub("'", "")
	end

	local cmd = "(echo '"..password.."';sleep 1;echo '"..password.."')|"
	cmd = cmd .. "passwd '"..username.."' >/dev/null 2>&1"
	return os.execute(cmd)
end


--- LuCI system utilities / wifi related functions.
-- @class	module
-- @name	luci.sys.wifi
wifi = {}

--- Get iwconfig output for all wireless devices.
-- @return	Table of tables containing the iwconfing output for each wifi device
function wifi.getiwconfig()
	local cnt = luci.util.exec("/usr/sbin/iwconfig 2>/dev/null")
	local iwc = {}

	for i, l in pairs(luci.util.split(luci.util.trim(cnt), "\n\n")) do
		local k = l:match("^(.-) ")
		l = l:gsub("^(.-) +", "", 1)
		if k then
			local entry, flags = _parse_mixed_record(l)
			if entry then
				entry.flags = flags
			end
			iwc[k] = entry
		end
	end

	return iwc
end

--- Get iwlist scan output from all wireless devices.
-- @return	Table of tables contaiing all scan results
function wifi.iwscan(iface)
	local siface = iface or ""
	local cnt = luci.util.exec("iwlist "..siface.." scan 2>/dev/null")
	local iws = {}

	for i, l in pairs(luci.util.split(luci.util.trim(cnt), "\n\n")) do
		local k = l:match("^(.-) ")
		l = l:gsub("^[^\n]+", "", 1)
		l = luci.util.trim(l)
		if k then
			iws[k] = {}
			for j, c in pairs(luci.util.split(l, "\n          Cell")) do
				c = c:gsub("^(.-)- ", "", 1)
				c = luci.util.split(c, "\n", 7)
				c = table.concat(c, "\n", 1)
				local entry, flags = _parse_mixed_record(c)
				if entry then
					entry.flags = flags
				end
				table.insert(iws[k], entry)
			end
		end
	end

	return iface and (iws[iface] or {}) or iws
end


--- LuCI system utilities / init related functions.
-- @class	module
-- @name	luci.sys.init
init = {}
init.dir = "/etc/init.d/"

--- Get the names of all installed init scripts
-- @return	Table containing the names of all inistalled init scripts
function init.names()
	local names = { }
	for _, name in ipairs(luci.fs.glob(init.dir.."*")) do
		names[#names+1] = luci.fs.basename(name)
	end
	return names
end

--- Test whether the given init script is enabled
-- @param name	Name of the init script
-- @return		Boolean indicating whether init is enabled
function init.enabled(name)
	if luci.fs.access(init.dir..name) then
		return ( call(init.dir..name.." enabled") == 0 )
	end
	return false
end

--- Get the index of he given init script
-- @param name	Name of the init script
-- @return		Numeric index value
function init.index(name)
	if luci.fs.access(init.dir..name) then
		return call("source "..init.dir..name.."; exit $START")
	end
end

--- Enable the given init script
-- @param name	Name of the init script
-- @return		Boolean indicating success
function init.enable(name)
	if luci.fs.access(init.dir..name) then
		return ( call(init.dir..name.." enable") == 1 )
	end
end

--- Disable the given init script
-- @param name	Name of the init script
-- @return		Boolean indicating success
function init.disable(name)
	if luci.fs.access(init.dir..name) then
		return ( call(init.dir..name.." disable") == 0 )
	end
end


-- Internal functions

function _parse_delimited_table(iter, delimiter)
	delimiter = delimiter or "%s+"

	local data  = {}
	local trim  = luci.util.trim
	local split = luci.util.split

	local keys = split(trim(iter()), delimiter, nil, true)
	for i, j in pairs(keys) do
		keys[i] = trim(keys[i])
	end

	for line in iter do
		local row = {}
		line = trim(line)
		if #line > 0 then
			for i, j in pairs(split(line, delimiter, nil, true)) do
				if keys[i] then
					row[keys[i]] = j
				end
			end
		end
		table.insert(data, row)
	end

	return data
end

function _parse_mixed_record(cnt, delimiter)
	delimiter = delimiter or "  "
	local data = {}
	local flags = {}

	for i, l in pairs(luci.util.split(luci.util.trim(cnt), "\n")) do
		for j, f in pairs(luci.util.split(luci.util.trim(l), delimiter, nil, true)) do
        	local k, x, v = f:match('([^%s][^:=]+) *([:=]*) *"*([^\n"]*)"*')

            if k then
				if x == "" then
					table.insert(flags, k)
				else
            		data[k] = v
				end
            end
    	end
	end

    return data, flags
end
