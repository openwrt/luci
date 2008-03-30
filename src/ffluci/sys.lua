--[[
FFLuCI - System library

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

module("ffluci.sys", package.seeall)
require("posix")

-- Returns the hostname
function hostname()
	return io.lines("/proc/sys/kernel/hostname")()
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


group = {}
group.getgroup = posix.getgroup

net = {}
-- Returns all available network interfaces
function net.devices()
	local devices = {}
	for line in io.lines("/proc/net/dev") do
		table.insert(devices, line:match(" *(.-):"))
	end
	return devices
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