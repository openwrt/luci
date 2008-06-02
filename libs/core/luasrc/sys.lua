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

module("luci.sys", package.seeall)
require("posix")
require("luci.bits")
require("luci.util")
require("luci.fs")

-- Returns whether a system is bigendian
function bigendian()
	local fp = io.open("/bin/sh")
	fp:seek("set", 5)
	local be = (fp:read(1):byte() ~= 1)
	fp:close()
	return be
end

-- Runs "command" and returns its output
function exec(command)
	local pp   = io.popen(command)
	local data = pp:read("*a")
	pp:close()
	
	return data
end

-- Runs "command" and returns its output as a array of lines
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

-- Uses "luci-flash" to flash a new image file to the system
function flash(image, kpattern)
	local cmd = "luci-flash "
	if kpattern then
		cmd = cmd .. "-k '" .. kpattern:gsub("'", "") .. "' "
	end
	cmd = cmd .. "'" .. image:gsub("'", "") .. "' >/dev/null 2>&1"
	
	return os.execute(cmd)
end

-- Returns the hostname
function hostname()
	return io.lines("/proc/sys/kernel/hostname")()
end

-- Returns the contents of a documented referred by an URL
function httpget(url)
	return exec("wget -qO- '"..url:gsub("'", "").."'")
end

-- Returns the FFLuci-Basedir
function libpath()
	return luci.fs.dirname(require("luci.debug").__file__)
end

-- Returns the load average
function loadavg()
	local loadavg = io.lines("/proc/loadavg")()
	return loadavg:match("^(.-) (.-) (.-) (.-) (.-)$")
end

-- Reboots the system
function reboot()
	return os.execute("reboot >/dev/null 2>&1")
end

-- Returns the system type, cpu name, and installed physical memory
function sysinfo()
	local c1 = "cat /proc/cpuinfo|grep system\\ typ|cut -d: -f2 2>/dev/null"
	local c2 = "uname -m 2>/dev/null"
	local c3 = "cat /proc/cpuinfo|grep model\\ name|cut -d: -f2 2>/dev/null"
	local c4 = "cat /proc/cpuinfo|grep cpu\\ model|cut -d: -f2 2>/dev/null"
	local c5 = "cat /proc/meminfo|grep MemTotal|cut -d: -f2 2>/dev/null"
	
	local s = luci.util.trim(exec(c1))
	local m = ""
	local r = ""
	
	if s == "" then
		s = luci.util.trim(exec(c2))
		m = luci.util.trim(exec(c3))
	else
		m = luci.util.trim(exec(c4))
	end
	
	r = luci.util.trim(exec(c5))
	
	return s, m, r
end

-- Reads the syslog
function syslog()
	return exec("logread")
end


group = {}
group.getgroup = posix.getgroup

net = {}
-- Returns the ARP-Table
function net.arptable()
	return _parse_delimited_table(io.lines("/proc/net/arp"), "%s%s+")
end

-- Returns whether an IP-Adress belongs to a certain net
function net.belongs(ip, ipnet, prefix)
	return (net.ip4bin(ip):sub(1, prefix) == net.ip4bin(ipnet):sub(1, prefix))
end

-- Detect the default route
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

-- Returns all available network interfaces
function net.devices()
	local devices = {}
	for line in io.lines("/proc/net/dev") do
		table.insert(devices, line:match(" *(.-):"))
	end
	return devices
end

-- Returns the MAC-Address belonging to the given IP-Address
function net.ip4mac(ip)
	local mac = nil
	
	for i, l in ipairs(net.arptable()) do
		if l["IP address"] == ip then
			mac = l["HW address"]
		end
	end
	
	return mac
end

-- Returns the prefix to a given netmask
function net.mask4prefix(mask)
	local bin = net.ip4bin(mask)
	
	if not bin then
		return nil
	end
	
	return #luci.util.split(bin, "1")-1
end

-- Returns the kernel routing table
function net.routes()
	return _parse_delimited_table(io.lines("/proc/net/route"))
end

-- Returns the numeric IP to a given hexstring
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

-- Returns the binary IP to a given IP
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

-- Tests whether a host is pingable
function net.pingtest(host)
	return os.execute("ping -c1 '"..host:gsub("'", '').."' >/dev/null 2>&1")
end


process = {}
process.info = posix.getpid 

-- Sets the gid of a process
function process.setgroup(pid, gid)
	return posix.setpid("g", pid, gid)
end

-- Sets the uid of a process
function process.setuser(pid, uid)
	return posix.setpid("u", pid, uid)
end

user = {}
-- returns user information to a given uid
user.getuser = posix.getpasswd

-- checks whether a string matches the password of a certain system user
function user.checkpasswd(user, password)
	local account = user.getuser(user)
	if posix.crypt and account then
		return (account.passwd == posix.crypt(account.passwd, password))
	end
end
	
-- Changes the user password of given user
function user.setpasswd(user, pwd)
	if pwd then
		pwd = pwd:gsub("'", "")
	end
	
	if user then
		user = user:gsub("'", "")
	end
	
	local cmd = "(echo '"..pwd.."';sleep 1;echo '"..pwd.."')|"
	cmd = cmd .. "passwd '"..user.."' >/dev/null 2>&1"
	return os.execute(cmd)
end


wifi = {}

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
