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

--- LuCI system utilities.
module("luci.sys", package.seeall)
require("posix")
require("luci.bits")
require("luci.util")
require("luci.fs")

--- Test wheather the current system is operating in big endian mode.
-- @return	Boolean value indicating wheather system is big endian
function bigendian()
	local fp = io.open("/bin/sh")
	fp:seek("set", 5)
	local be = (fp:read(1):byte() ~= 1)
	fp:close()
	return be
end

--- Execute given commandline and gather stdout.
-- @param command	String containing command to execute
-- @return			String containing the command's stdout
function exec(command)
	local pp   = io.popen(command)
	local data = pp:read("*a")
	pp:close()

	return data
end

--- Execute given commandline and gather stdout.
-- @param command	String containing the command to execute
-- @return			Table containing the command's stdout splitted up in lines
function execl(command)
	local pp   = io.popen(command)
	local line = ""
	local data = {}

	while true do
		line = pp:read()
		if (line == nil) then break end
		table.insert(data, line)
	end
	pp:close()

	return data
end

--- Invoke the luci-flash executable to write an image to the flash memory.
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
-- @param url	The URL to retrieve
-- @return		String containing the contents of given the URL
function httpget(url)
	return exec("wget -qO- '"..url:gsub("'", "").."'")
end

--- Returns the absolute path to LuCI base directory.
-- @return		String containing the directory path
function libpath()
	return luci.fs.dirname(require("luci.debug").__file__)
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
-- @return	Number containing free memory in percent
-- @return	Number containing buffer memory in percent
-- @return	Number containing cache memory in percent
function sysinfo()
	local c1 = "cat /proc/cpuinfo|grep system\\ typ|cut -d: -f2 2>/dev/null"
	local c2 = "uname -m 2>/dev/null"
	local c3 = "cat /proc/cpuinfo|grep model\\ name|cut -d: -f2 2>/dev/null"
	local c4 = "cat /proc/cpuinfo|grep cpu\\ model|cut -d: -f2 2>/dev/null"
	local c5 = "cat /proc/meminfo|grep MemTotal|awk {' print $2 '} 2>/dev/null"
	local c6 = "cat /proc/meminfo|grep ^Cached|awk {' print $2 '} 2>/dev/null"
	local c7 = "cat /proc/meminfo|grep MemFree|awk {' print $2 '} 2>/dev/null"
	local c8 = "cat /proc/meminfo|grep Buffers|awk {' print $2 '} 2>/dev/null"

	local system = luci.util.trim(exec(c1))
	local model = ""
	local memtotal = luci.util.trim(exec(c5))
	local memcached = luci.util.trim(exec(c6))
	local memfree = luci.util.trim(exec(c7))
	local membuffers = luci.util.trim(exec(c8))
	local perc_memfree = math.floor((memfree/memtotal)*100)
	local perc_membuffers = math.floor((membuffers/memtotal)*100)
	local perc_memcached = math.floor((memcached/memtotal)*100)

	if system == "" then
		system = luci.util.trim(exec(c2))
		model = luci.util.trim(exec(c3))
	else
		model = luci.util.trim(exec(c4))
	end

	return system, model, memtotal, memcached, membuffers, memfree, perc_memfree, perc_membuffers, perc_memcached
end

--- Retrieves the output of the "logread" command.
-- @return	String containing the current log buffer
function syslog()
	return exec("logread")
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

--- Test whether an IP-Adress belongs to a certain net.
-- @param ip		IPv4 address to test
-- @param ipnet		IPv4 network address of the net range to compare against
-- @param prefix	Network prefix of the net range to compare against
-- @return			Boolean indicating wheather the ip is within the range
function net.belongs(ip, ipnet, prefix)
	return (net.ip4bin(ip):sub(1, prefix) == net.ip4bin(ipnet):sub(1, prefix))
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

--- Calculate the prefix from a given netmask.
-- @param mask	IPv4 net mask
-- @return		Number containing the corresponding numerical prefix
function net.mask4prefix(mask)
	local bin = net.ip4bin(mask)

	if not bin then
		return nil
	end

	return #luci.util.split(bin, "1")-1
end

--- Returns the current kernel routing table entries.
-- @return	Table of tables with properties of the corresponding routes.
--			The following fields are defined for route entry tables:
--			{ "Mask", "RefCnt", "Iface", "Flags", "Window", "IRTT",
--			  "MTU", "Gateway", "Destination", "Metric", "Use" }
function net.routes()
	return _parse_delimited_table(io.lines("/proc/net/route"))
end

--- Convert hexadecimal 32 bit value to IPv4 address.
-- @param hex	String containing the hexadecimal value
-- @param be	Boolean indicating wheather the given value is big endian
-- @return		String containing the corresponding IP4 address
function net.hexip4(hex, be)
	if #hex ~= 8 then
		return nil
	end

	be = be or bigendian()

	local hexdec = luci.bits.Hex2Dec

	local ip = ""
	if be then
		ip = ip .. tostring(hexdec(hex:sub(1,2))) .. "."
		ip = ip .. tostring(hexdec(hex:sub(3,4))) .. "."
		ip = ip .. tostring(hexdec(hex:sub(5,6))) .. "."
		ip = ip .. tostring(hexdec(hex:sub(7,8)))
	else
		ip = ip .. tostring(hexdec(hex:sub(7,8))) .. "."
		ip = ip .. tostring(hexdec(hex:sub(5,6))) .. "."
		ip = ip .. tostring(hexdec(hex:sub(3,4))) .. "."
		ip = ip .. tostring(hexdec(hex:sub(1,2)))
	end

	return ip
end

--- Convert given IPv4 address to binary value.
-- @param ip	String containing a IPv4 address
-- @return		String containing corresponding binary value
function net.ip4bin(ip)
	local parts = luci.util.split(ip, '.')
	if #parts ~= 4 then
		return nil
	end

	local decbin = luci.bits.Dec2Bin

	local bin = ""
	bin = bin .. decbin(parts[1], 8)
	bin = bin .. decbin(parts[2], 8)
	bin = bin .. decbin(parts[3], 8)
	bin = bin .. decbin(parts[4], 8)

	return bin
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
-- @return	Number containing the current pid
process.info = posix.getpid

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

	-- FIXME: detect testing environment
	if luci.fs.stat("/etc/shadow") and not luci.fs.access("/etc/shadow", "r") then
		return true
	elseif account then
		if account.passwd == "!" then
			return true
		else
			return (account.passwd == posix.crypt(password, account.passwd))
		end
	end
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
	local cnt = exec("/usr/sbin/iwconfig 2>/dev/null")
	local iwc = {}

	for i, l in pairs(luci.util.split(luci.util.trim(cnt), "\n\n")) do
		local k = l:match("^(.-) ")
		l = l:gsub("^(.-) +", "", 1)
		if k then
			iwc[k] = _parse_mixed_record(l)
		end
	end

	return iwc
end

--- Get iwlist scan output from all wireless devices.
-- @return	Table of tables contaiing all scan results
function wifi.iwscan()
	local cnt = exec("iwlist scan 2>/dev/null")
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
				table.insert(iws[k], _parse_mixed_record(c))
			end
		end
	end

	return iws
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

function _parse_mixed_record(cnt)
	local data = {}

	for i, l in pairs(luci.util.split(luci.util.trim(cnt), "\n")) do
    	for j, f in pairs(luci.util.split(luci.util.trim(l), "  ")) do
        	local k, x, v = f:match('([^%s][^:=]+) *([:=]*) *"*([^\n"]*)"*')

            if k then
				if x == "" then
					table.insert(data, k)
				else
            		data[k] = v
				end
            end
    	end
	end

    return data
end
