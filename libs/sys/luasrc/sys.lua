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


local io     = require "io"
local os     = require "os"
local table  = require "table"
local nixio  = require "nixio"
local fs     = require "nixio.fs"
local uci    = require "luci.model.uci"

local luci  = {}
luci.util   = require "luci.util"
luci.ip     = require "luci.ip"

local tonumber, ipairs, pairs, pcall, type, next, setmetatable, require, select =
	tonumber, ipairs, pairs, pcall, type, next, setmetatable, require, select


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
getenv = nixio.getenv

--- Get or set the current hostname.
-- @param		String containing a new hostname to set (optional)
-- @return		String containing the system hostname
function hostname(newname)
	if type(newname) == "string" and #newname > 0 then
		fs.writefile( "/proc/sys/kernel/hostname", newname )
		return newname
	else
		return nixio.uname().nodename
	end
end

--- Returns the contents of a documented referred by an URL.
-- @param url	 The URL to retrieve
-- @param stream Return a stream instead of a buffer
-- @param target Directly write to target file name
-- @return		String containing the contents of given the URL
function httpget(url, stream, target)
	if not target then
		local source = stream and io.popen or luci.util.exec
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
function loadavg()
	local info = nixio.sysinfo()
	return info.loads[1], info.loads[2], info.loads[3]
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
-- @return	String containing the cpu bogomips (number)
function sysinfo()
	local cpuinfo = fs.readfile("/proc/cpuinfo")
	local meminfo = fs.readfile("/proc/meminfo")

	local memtotal = tonumber(meminfo:match("MemTotal:%s*(%d+)"))
	local memcached = tonumber(meminfo:match("\nCached:%s*(%d+)"))
	local memfree = tonumber(meminfo:match("MemFree:%s*(%d+)"))
	local membuffers = tonumber(meminfo:match("Buffers:%s*(%d+)"))
	local bogomips = tonumber(cpuinfo:match("[Bb]ogo[Mm][Ii][Pp][Ss].-: ([^\n]+)")) or 0
	local swaptotal = tonumber(meminfo:match("SwapTotal:%s*(%d+)"))
	local swapcached = tonumber(meminfo:match("SwapCached:%s*(%d+)"))
	local swapfree = tonumber(meminfo:match("SwapFree:%s*(%d+)"))

	local system =
		cpuinfo:match("system type\t+: ([^\n]+)") or
		cpuinfo:match("Processor\t+: ([^\n]+)") or
		cpuinfo:match("model name\t+: ([^\n]+)")

	local model =
		luci.util.pcdata(fs.readfile("/tmp/sysinfo/model")) or
		cpuinfo:match("machine\t+: ([^\n]+)") or
		cpuinfo:match("Hardware\t+: ([^\n]+)") or
		luci.util.pcdata(fs.readfile("/proc/diag/model")) or
		nixio.uname().machine or
		system

	return system, model, memtotal, memcached, membuffers, memfree, bogomips, swaptotal, swapcached, swapfree
end

--- Retrieves the output of the "logread" command.
-- @return	String containing the current log buffer
function syslog()
	return luci.util.exec("logread")
end

--- Retrieves the output of the "dmesg" command.
-- @return	String containing the current log buffer
function dmesg()
	return luci.util.exec("dmesg")
end

--- Generates a random id with specified length.
-- @param bytes	Number of bytes for the unique id
-- @return		String containing hex encoded id
function uniqueid(bytes)
	local rand = fs.readfile("/dev/urandom", bytes)
	return rand and nixio.bin.hexlify(rand)
end

--- Returns the current system uptime stats.
-- @return	String containing total uptime in seconds
function uptime()
	return nixio.sysinfo().uptime
end


--- LuCI system utilities / network related functions.
-- @class	module
-- @name	luci.sys.net
net = {}

--- Returns the current arp-table entries as two-dimensional table.
-- @return	Table of table containing the current arp entries.
--			The following fields are defined for arp entry objects:
--			{ "IP address", "HW address", "HW type", "Flags", "Mask", "Device" }
function net.arptable(callback)
	local arp, e, r, v
	if fs.access("/proc/net/arp") then
		for e in io.lines("/proc/net/arp") do
			local r = { }, v
			for v in e:gmatch("%S+") do
				r[#r+1] = v
			end

			if r[1] ~= "IP" then
				local x = {
					["IP address"] = r[1],
					["HW type"]    = r[2],
					["Flags"]      = r[3],
					["HW address"] = r[4],
					["Mask"]       = r[5],
					["Device"]     = r[6]
				}

				if callback then
					callback(x)
				else
					arp = arp or { }
					arp[#arp+1] = x
				end
			end
		end
	end
	return arp
end

local function _nethints(what, callback)
	local _, k, e, mac, ip, name
	local cur = uci.cursor()
	local ifn = { }
	local hosts = { }

	local function _add(i, ...)
		local k = select(i, ...)
		if k then
			if not hosts[k] then hosts[k] = { } end
			hosts[k][1] = select(1, ...) or hosts[k][1]
			hosts[k][2] = select(2, ...) or hosts[k][2]
			hosts[k][3] = select(3, ...) or hosts[k][3]
			hosts[k][4] = select(4, ...) or hosts[k][4]
		end
	end

	if fs.access("/proc/net/arp") then
		for e in io.lines("/proc/net/arp") do
			ip, mac = e:match("^([%d%.]+)%s+%S+%s+%S+%s+([a-fA-F0-9:]+)%s+")
			if ip and mac then
				_add(what, mac:upper(), ip, nil, nil)
			end
		end
	end

	if fs.access("/etc/ethers") then
		for e in io.lines("/etc/ethers") do
			mac, ip = e:match("^([a-f0-9]%S+) (%S+)")
			if mac and ip then
				_add(what, mac:upper(), ip, nil, nil)
			end
		end
	end

	if fs.access("/var/dhcp.leases") then
		for e in io.lines("/var/dhcp.leases") do
			mac, ip, name = e:match("^%d+ (%S+) (%S+) (%S+)")
			if mac and ip then
				_add(what, mac:upper(), ip, nil, name ~= "*" and name)
			end
		end
	end

	cur:foreach("dhcp", "host",
		function(s)
			for mac in luci.util.imatch(s.mac) do
				_add(what, mac:upper(), s.ip, nil, s.name)
			end
		end)

	for _, e in ipairs(nixio.getifaddrs()) do
		if e.name ~= "lo" then
			ifn[e.name] = ifn[e.name] or { }
			if e.family == "packet" and e.addr and #e.addr == 17 then
				ifn[e.name][1] = e.addr:upper()
			elseif e.family == "inet" then
				ifn[e.name][2] = e.addr
			elseif e.family == "inet6" then
				ifn[e.name][3] = e.addr
			end
		end
	end

	for _, e in pairs(ifn) do
		if e[what] and (e[2] or e[3]) then
			_add(what, e[1], e[2], e[3], e[4])
		end
	end

	for _, e in luci.util.kspairs(hosts) do
		callback(e[1], e[2], e[3], e[4])
	end
end

--- Returns a two-dimensional table of mac address hints.
-- @return  Table of table containing known hosts from various sources.
--          Each entry contains the values in the following order:
--          [ "mac", "name" ]
function net.mac_hints(callback)
	if callback then
		_nethints(1, function(mac, v4, v6, name)
			name = name or nixio.getnameinfo(v4 or v6, nil, 100) or v4
			if name and name ~= mac then
				callback(mac, name or nixio.getnameinfo(v4 or v6, nil, 100) or v4)
			end
		end)
	else
		local rv = { }
		_nethints(1, function(mac, v4, v6, name)
			name = name or nixio.getnameinfo(v4 or v6, nil, 100) or v4
			if name and name ~= mac then
				rv[#rv+1] = { mac, name or nixio.getnameinfo(v4 or v6, nil, 100) or v4 }
			end
		end)
		return rv
	end
end

--- Returns a two-dimensional table of IPv4 address hints.
-- @return  Table of table containing known hosts from various sources.
--          Each entry contains the values in the following order:
--          [ "ip", "name" ]
function net.ipv4_hints(callback)
	if callback then
		_nethints(2, function(mac, v4, v6, name)
			name = name or nixio.getnameinfo(v4, nil, 100) or mac
			if name and name ~= v4 then
				callback(v4, name)
			end
		end)
	else
		local rv = { }
		_nethints(2, function(mac, v4, v6, name)
			name = name or nixio.getnameinfo(v4, nil, 100) or mac
			if name and name ~= v4 then
				rv[#rv+1] = { v4, name }
			end
		end)
		return rv
	end
end

--- Returns a two-dimensional table of IPv6 address hints.
-- @return  Table of table containing known hosts from various sources.
--          Each entry contains the values in the following order:
--          [ "ip", "name" ]
function net.ipv6_hints(callback)
	if callback then
		_nethints(3, function(mac, v4, v6, name)
			name = name or nixio.getnameinfo(v6, nil, 100) or mac
			if name and name ~= v6 then
				callback(v6, name)
			end
		end)
	else
		local rv = { }
		_nethints(3, function(mac, v4, v6, name)
			name = name or nixio.getnameinfo(v6, nil, 100) or mac
			if name and name ~= v6 then
				rv[#rv+1] = { v6, name }
			end
		end)
		return rv
	end
end

--- Returns conntrack information
-- @return	Table with the currently tracked IP connections
function net.conntrack(callback)
	local connt = {}
	if fs.access("/proc/net/nf_conntrack", "r") then
		for line in io.lines("/proc/net/nf_conntrack") do
			line = line:match "^(.-( [^ =]+=).-)%2"
			local entry, flags = _parse_mixed_record(line, " +")
			if flags[6] ~= "TIME_WAIT" then
				entry.layer3 = flags[1]
				entry.layer4 = flags[3]
				for i=1, #entry do
					entry[i] = nil
				end

				if callback then
					callback(entry)
				else
					connt[#connt+1] = entry
				end
			end
		end
	elseif fs.access("/proc/net/ip_conntrack", "r") then
		for line in io.lines("/proc/net/ip_conntrack") do
			line = line:match "^(.-( [^ =]+=).-)%2"
			local entry, flags = _parse_mixed_record(line, " +")
			if flags[4] ~= "TIME_WAIT" then
				entry.layer3 = "ipv4"
				entry.layer4 = flags[1]
				for i=1, #entry do
					entry[i] = nil
				end

				if callback then
					callback(entry)
				else
					connt[#connt+1] = entry
				end
			end
		end
	else
		return nil
	end
	return connt
end

--- Determine the current IPv4 default route. If multiple default routes exist,
-- return the one with the lowest metric.
-- @return	Table with the properties of the current default route.
--			The following fields are defined:
--			{ "dest", "gateway", "metric", "refcount", "usecount", "irtt",
--			  "flags", "device" }
function net.defaultroute()
	local route

	net.routes(function(rt)
		if rt.dest:prefix() == 0 and (not route or route.metric > rt.metric) then
			route = rt
		end
	end)

	return route
end

--- Determine the current IPv6 default route. If multiple default routes exist,
-- return the one with the lowest metric.
-- @return	Table with the properties of the current default route.
--			The following fields are defined:
--			{ "source", "dest", "nexthop", "metric", "refcount", "usecount",
--			  "flags", "device" }
function net.defaultroute6()
	local route

	net.routes6(function(rt)
		if rt.dest:prefix() == 0 and rt.device ~= "lo" and
		   (not route or route.metric > rt.metric)
		then
			route = rt
		end
	end)

	if not route then
		local global_unicast = luci.ip.IPv6("2000::/3")
		net.routes6(function(rt)
			if rt.dest:equal(global_unicast) and
			   (not route or route.metric > rt.metric)
			then
				route = rt
			end
		end)
	end

	return route
end

--- Determine the names of available network interfaces.
-- @return	Table containing all current interface names
function net.devices()
	local devs = {}
	for k, v in ipairs(nixio.getifaddrs()) do
		if v.family == "packet" then
			devs[#devs+1] = v.name
		end
	end
	return devs
end


--- Return information about available network interfaces.
-- @return	Table containing all current interface names and their information
function net.deviceinfo()
	local devs = {}
	for k, v in ipairs(nixio.getifaddrs()) do
		if v.family == "packet" then
			local d = v.data
			d[1] = d.rx_bytes
			d[2] = d.rx_packets
			d[3] = d.rx_errors
			d[4] = d.rx_dropped
			d[5] = 0
			d[6] = 0
			d[7] = 0
			d[8] = d.multicast
			d[9] = d.tx_bytes
			d[10] = d.tx_packets
			d[11] = d.tx_errors
			d[12] = d.tx_dropped
			d[13] = 0
			d[14] = d.collisions
			d[15] = 0
			d[16] = 0
			devs[v.name] = d
		end
	end
	return devs
end


-- Determine the MAC address belonging to the given IP address.
-- @param ip	IPv4 address
-- @return		String containing the MAC address or nil if it cannot be found
function net.ip4mac(ip)
	local mac = nil
	net.arptable(function(e)
		if e["IP address"] == ip then
			mac = e["HW address"]
		end
	end)
	return mac
end

--- Returns the current kernel routing table entries.
-- @return	Table of tables with properties of the corresponding routes.
--			The following fields are defined for route entry tables:
--			{ "dest", "gateway", "metric", "refcount", "usecount", "irtt",
--			  "flags", "device" }
function net.routes(callback)
	local routes = { }

	for line in io.lines("/proc/net/route") do

		local dev, dst_ip, gateway, flags, refcnt, usecnt, metric,
			  dst_mask, mtu, win, irtt = line:match(
			"([^%s]+)\t([A-F0-9]+)\t([A-F0-9]+)\t([A-F0-9]+)\t" ..
			"(%d+)\t(%d+)\t(%d+)\t([A-F0-9]+)\t(%d+)\t(%d+)\t(%d+)"
		)

		if dev then
			gateway  = luci.ip.Hex( gateway,  32, luci.ip.FAMILY_INET4 )
			dst_mask = luci.ip.Hex( dst_mask, 32, luci.ip.FAMILY_INET4 )
			dst_ip   = luci.ip.Hex(
				dst_ip, dst_mask:prefix(dst_mask), luci.ip.FAMILY_INET4
			)

			local rt = {
				dest     = dst_ip,
				gateway  = gateway,
				metric   = tonumber(metric),
				refcount = tonumber(refcnt),
				usecount = tonumber(usecnt),
				mtu      = tonumber(mtu),
				window   = tonumber(window),
				irtt     = tonumber(irtt),
				flags    = tonumber(flags, 16),
				device   = dev
			}

			if callback then
				callback(rt)
			else
				routes[#routes+1] = rt
			end
		end
	end

	return routes
end

--- Returns the current ipv6 kernel routing table entries.
-- @return	Table of tables with properties of the corresponding routes.
--			The following fields are defined for route entry tables:
--			{ "source", "dest", "nexthop", "metric", "refcount", "usecount",
--			  "flags", "device" }
function net.routes6(callback)
	if fs.access("/proc/net/ipv6_route", "r") then
		local routes = { }

		for line in io.lines("/proc/net/ipv6_route") do

			local dst_ip, dst_prefix, src_ip, src_prefix, nexthop,
				  metric, refcnt, usecnt, flags, dev = line:match(
				"([a-f0-9]+) ([a-f0-9]+) " ..
				"([a-f0-9]+) ([a-f0-9]+) " ..
				"([a-f0-9]+) ([a-f0-9]+) " ..
				"([a-f0-9]+) ([a-f0-9]+) " ..
				"([a-f0-9]+) +([^%s]+)"
			)

			if dst_ip and dst_prefix and
			   src_ip and src_prefix and
			   nexthop and metric and
			   refcnt and usecnt and
			   flags and dev
			then
				src_ip = luci.ip.Hex(
					src_ip, tonumber(src_prefix, 16), luci.ip.FAMILY_INET6, false
				)

				dst_ip = luci.ip.Hex(
					dst_ip, tonumber(dst_prefix, 16), luci.ip.FAMILY_INET6, false
				)

				nexthop = luci.ip.Hex( nexthop, 128, luci.ip.FAMILY_INET6, false )

				local rt = {
					source   = src_ip,
					dest     = dst_ip,
					nexthop  = nexthop,
					metric   = tonumber(metric, 16),
					refcount = tonumber(refcnt, 16),
					usecount = tonumber(usecnt, 16),
					flags    = tonumber(flags, 16),
					device   = dev,

					-- lua number is too small for storing the metric
					-- add a metric_raw field with the original content
					metric_raw = metric
				}

				if callback then
					callback(rt)
				else
					routes[#routes+1] = rt
				end
			end
		end

		return routes
	end
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
function process.info(key)
	local s = {uid = nixio.getuid(), gid = nixio.getgid()}
	return not key and s or s[key]
end

--- Retrieve information about currently running processes.
-- @return 	Table containing process information
function process.list()
	local data = {}
	local k
	local ps = luci.util.execi("/bin/busybox top -bn1")

	if not ps then
		return
	end

	for line in ps do
		local pid, ppid, user, stat, vsz, mem, cpu, cmd = line:match(
			"^ *(%d+) +(%d+) +(%S.-%S) +([RSDZTW][W ][<N ]) +(%d+) +(%d+%%) +(%d+%%) +(.+)"
		)

		local idx = tonumber(pid)
		if idx then
			data[idx] = {
				['PID']     = pid,
				['PPID']    = ppid,
				['USER']    = user,
				['STAT']    = stat,
				['VSZ']     = vsz,
				['%MEM']    = mem,
				['%CPU']    = cpu,
				['COMMAND'] = cmd
			}
		end
	end

	return data
end

--- Set the gid of a process identified by given pid.
-- @param gid	Number containing the Unix group id
-- @return		Boolean indicating successful operation
-- @return		String containing the error message if failed
-- @return		Number containing the error code if failed
function process.setgroup(gid)
	return nixio.setgid(gid)
end

--- Set the uid of a process identified by given pid.
-- @param uid	Number containing the Unix user id
-- @return		Boolean indicating successful operation
-- @return		String containing the error message if failed
-- @return		Number containing the error code if failed
function process.setuser(uid)
	return nixio.setuid(uid)
end

--- Send a signal to a process identified by given pid.
-- @class function
-- @name  process.signal
-- @param pid	Number containing the process id
-- @param sig	Signal to send (default: 15 [SIGTERM])
-- @return		Boolean indicating successful operation
-- @return		Number containing the error code if failed
process.signal = nixio.kill


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
user.getuser = nixio.getpw

--- Retrieve the current user password hash.
-- @param username	String containing the username to retrieve the password for
-- @return			String containing the hash or nil if no password is set.
-- @return			Password database entry
function user.getpasswd(username)
	local pwe = nixio.getsp and nixio.getsp(username) or nixio.getpw(username)
	local pwh = pwe and (pwe.pwdp or pwe.passwd)
	if not pwh or #pwh < 1 or pwh == "!" or pwh == "x" then
		return nil, pwe
	else
		return pwh, pwe
	end
end

--- Test whether given string matches the password of a given system user.
-- @param username	String containing the Unix user name
-- @param pass		String containing the password to compare
-- @return			Boolean indicating wheather the passwords are equal
function user.checkpasswd(username, pass)
	local pwh, pwe = user.getpasswd(username)
	if pwe then
		return (pwh == nil or nixio.crypt(pass, pwh) == pwh)
	end
	return false
end

--- Change the password of given user.
-- @param username	String containing the Unix user name
-- @param password	String containing the password to compare
-- @return			Number containing 0 on success and >= 1 on error
function user.setpasswd(username, password)
	if password then
		password = password:gsub("'", [['"'"']])
	end

	if username then
		username = username:gsub("'", [['"'"']])
	end

	return os.execute(
		"(echo '" .. password .. "'; sleep 1; echo '" .. password .. "') | " ..
		"passwd '" .. username .. "' >/dev/null 2>&1"
	)
end


--- LuCI system utilities / wifi related functions.
-- @class	module
-- @name	luci.sys.wifi
wifi = {}

--- Get wireless information for given interface.
-- @param ifname        String containing the interface name
-- @return              A wrapped iwinfo object instance
function wifi.getiwinfo(ifname)
	local stat, iwinfo = pcall(require, "iwinfo")

	if ifname then
		local c = 0
		local u = uci.cursor_state()
		local d, n = ifname:match("^(%w+)%.network(%d+)")
		if d and n then
			ifname = d
			n = tonumber(n)
			u:foreach("wireless", "wifi-iface",
				function(s)
					if s.device == d then
						c = c + 1
						if c == n then
							ifname = s.ifname or s.device
							return false
						end
					end
				end)
		elseif u:get("wireless", ifname) == "wifi-device" then
			u:foreach("wireless", "wifi-iface",
				function(s)
					if s.device == ifname and s.ifname then
						ifname = s.ifname
						return false
					end
				end)
		end

		local t = stat and iwinfo.type(ifname)
		local x = t and iwinfo[t] or { }
		return setmetatable({}, {
			__index = function(t, k)
				if k == "ifname" then
					return ifname
				elseif x[k] then
					return x[k](ifname)
				end
			end
		})
	end
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
	for name in fs.glob(init.dir.."*") do
		names[#names+1] = fs.basename(name)
	end
	return names
end

--- Get the index of he given init script
-- @param name	Name of the init script
-- @return		Numeric index value
function init.index(name)
	if fs.access(init.dir..name) then
		return call("env -i sh -c 'source %s%s enabled; exit ${START:-255}' >/dev/null"
			%{ init.dir, name })
	end
end

local function init_action(action, name)
	if fs.access(init.dir..name) then
		return call("env -i %s%s %s >/dev/null" %{ init.dir, name, action })
	end
end

--- Test whether the given init script is enabled
-- @param name	Name of the init script
-- @return		Boolean indicating whether init is enabled
function init.enabled(name)
	return (init_action("enabled", name) == 0)
end

--- Enable the given init script
-- @param name	Name of the init script
-- @return		Boolean indicating success
function init.enable(name)
	return (init_action("enable", name) == 1)
end

--- Disable the given init script
-- @param name	Name of the init script
-- @return		Boolean indicating success
function init.disable(name)
	return (init_action("disable", name) == 0)
end

--- Start the given init script
-- @param name	Name of the init script
-- @return		Boolean indicating success
function init.start(name)
	return (init_action("start", name) == 0)
end

--- Stop the given init script
-- @param name	Name of the init script
-- @return		Boolean indicating success
function init.stop(name)
	return (init_action("stop", name) == 0)
end


-- Internal functions

function _parse_mixed_record(cnt, delimiter)
	delimiter = delimiter or "  "
	local data = {}
	local flags = {}

	for i, l in pairs(luci.util.split(luci.util.trim(cnt), "\n")) do
		for j, f in pairs(luci.util.split(luci.util.trim(l), delimiter, nil, true)) do
			local k, x, v = f:match('([^%s][^:=]*) *([:=]*) *"*([^\n"]*)"*')

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
