-- Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed to the public under the Apache License 2.0.

local NX   = require "nixio"
local NXFS = require "nixio.fs"
local DISP = require "luci.dispatcher"
local SYS  = require "luci.sys"
local DDNS = require "luci.tools.ddns"		-- ddns multiused functions

-- cbi-map definition -- #######################################################
local m = Map("ddns")

-- first need to close <a> from cbi map template our <a> closed by template
m.title = [[</a><a href="]] .. DISP.build_url("admin", "services", "ddns") .. [[">]] 
	.. translate("Dynamic DNS")

m.description = translate("Dynamic DNS allows that your router can be reached with " ..
			"a fixed hostname while having a dynamically changing IP address.")

m.redirect = DISP.build_url("admin", "services", "ddns")

function m.commit_handler(self)
	if self.changed then	-- changes ?
		os.execute("/etc/init.d/ddns reload &")	-- reload configuration
	end
end

-- cbi-section definition -- ###################################################
local ns = m:section( NamedSection, "global", "ddns",
	translate("Global Settings"),
	translate("Configure here the details for all Dynamic DNS services including this LuCI application.") 
	.. [[<br /><strong>]]
	.. translate("It is NOT recommended for casual users to change settings on this page.")
	.. [[</strong><br />]]
	.. [[<a href="http://wiki.openwrt.org/doc/uci/ddns#version_2x1" target="_blank">]]
	.. translate("For detailed information about parameter settings look here.")
	.. [[</a>]]
	)

-- section might not exist
function ns.cfgvalue(self, section)
	if not self.map:get(section) then
		self.map:set(section, nil, self.sectiontype)
	end
	return self.map:get(section)
end

-- allow_local_ip  -- ##########################################################
local ali	= ns:option(Flag, "allow_local_ip")
ali.title	= translate("Allow non-public IP's")
ali.description = translate("Non-public and by default blocked IP's") .. ":"
		.. [[<br /><strong>IPv4: </strong>]]
		.. "0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16"
		.. [[<br /><strong>IPv6: </strong>]]
		.. "::/32, f000::/4"
ali.reempty	= true
ali.default	= "0"
function ali.parse(self, section)
	DDNS.flag_parse(self, section)
end
function ali.validate(self, value)
	if value == self.default then
		return "" -- default = empty
	end
	return value
end

-- date_format  -- #############################################################
local df	= ns:option(Value, "date_format")
df.title	= translate("Date format")
df.description	= [[<a href="http://www.cplusplus.com/reference/ctime/strftime/" target="_blank">]]
		.. translate("For supported codes look here") 
		.. [[</a>]]
df.template	= "ddns/global_value"
df.rmempty	= true
df.default	= "%F %R"
df.date_string	= ""
function df.cfgvalue(self, section)
	local value = AbstractValue.cfgvalue(self, section) or self.default
	local epoch = os.time()
	self.date_string = DDNS.epoch2date(epoch, value)
	return value
end
function df.validate(self, value)
	if value == self.default then
		return "" -- default = empty
	end
	return value
end

-- run_dir  -- #################################################################
local rd	= ns:option(Value, "run_dir")
rd.title	= translate("Status directory")
rd.description	= translate("Directory contains PID and other status information for each running section")
rd.rmempty	= true
rd.default	= "/var/run/ddns"
function rd.validate(self, value)
	if value == self.default then
		return "" -- default = empty
	end
	return value
end

-- log_dir  -- #################################################################
local ld	= ns:option(Value, "log_dir")
ld.title	= translate("Log directory")
ld.description	= translate("Directory contains Log files for each running section")
ld.rmempty	= true
ld.default	= "/var/log/ddns"
function ld.validate(self, value)
	if value == self.default then
		return "" -- default = empty
	end
	return value
end

-- log_lines  -- ###############################################################
local ll	= ns:option(Value, "log_lines")
ll.title	= translate("Log length")
ll.description	= translate("Number of last lines stored in log files")
ll.rmempty	= true
ll.default	= "250"
function ll.validate(self, value)
	local n = tonumber(value)
	if not n or math.floor(n) ~= n or n < 1 then
		return nil, self.title .. ": " .. translate("minimum value '1'")
	end
	if value == self.default then
		return "" -- default = empty
	end
	return value
end

-- use_curl  -- ################################################################
if (SYS.call([[ grep -i "\+ssl" /usr/bin/wget >/dev/null 2>&1 ]]) == 0) 
and NXFS.access("/usr/bin/curl") then
	local pc	= ns:option(Flag, "use_curl")
	pc.title	= translate("Use cURL")
	pc.description	= translate("If both cURL and GNU Wget are installed, Wget is used by default.")
		.. [[<br />]]
		.. translate("To use cURL activate this option.")
	pc.orientation	= "horizontal"
	pc.rmempty	= true
	pc.default	= "0"
	function pc.parse(self, section)
		DDNS.flag_parse(self, section)
	end
	function pc.validate(self, value)
		if value == self.default then
			return "" -- default = empty
		end
		return value
	end
end

return m
