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
require("ffluci.fs")

-- Returns the hostname
function hostname()
	return io.lines("/proc/sys/kernel/hostname")()
end

-- Returns the load average
function loadavg()
	local loadavg = io.lines("/proc/loadavg")()
	return loadavg:match("^(.-) (.-) (.-) (.-) (.-)$")
end

-- Returns all available network interfaces
function net_devices()
	local devices = {}
	for line in io.lines("/proc/net/dev") do
		table.insert(devices, line:match(" *(.-):"))
	end
	return devices
end