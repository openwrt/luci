--[[
LuCI - Lua Configuration Interface

Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

require "luci.sys"
require "luci.dispatcher"
require "luci.tools.ddns"

-- check supported options
-- saved to local vars here because doing multiple os calls slow down the system
has_ssl    = luci.tools.ddns.check_ssl()	-- HTTPS support
has_proxy  = luci.tools.ddns.check_proxy()	-- Proxy support
has_dnstcp = luci.tools.ddns.check_bind_host()	-- DNS TCP support

-- html constants
bold_on  = [[<strong>]]
bold_off = [[</strong>]]

-- cbi-map definition
m = Map("ddns")

m.title = [[<a href="]] .. luci.dispatcher.build_url("admin", "services", "ddns") .. [[">]] .. 
		translate("Dynamic DNS") .. [[</a>]]

m.description = translate("Dynamic DNS allows that your router can be reached with " ..
			"a fixed hostname while having a dynamically changing " ..
			"IP address.")

m.redirect = luci.dispatcher.build_url("admin", "services", "ddns")

-- SimpleSection definition
-- show Hints to optimize installation and script usage
s = m:section( SimpleSection, 
	translate("Hints"), 
	translate("Below a list of configuration tips for your system to run Dynamic DNS updates without limitations") )
-- DDNS Service disabled
if not luci.sys.init.enabled("ddns") then
	local dv = s:option(DummyValue, "_not_enabled")
	dv.titleref = luci.dispatcher.build_url("admin", "system", "startup")
	dv.rawhtml  = true
	dv.title = bold_on .. 
		translate("DDNS Autostart disabled") .. bold_off
	dv.value = translate("Currently DDNS updates are not started at boot or on interface events." .. "<br />" .. 
			"This is the default if you run DDNS scripts by yourself (i.e. via cron with force_interval set to '0')" )
end

-- No IPv6 support
if not luci.tools.ddns.check_ipv6() then
	local dv = s:option(DummyValue, "_no_ipv6")
	dv.titleref = 'http://www.openwrt.org" target="_blank'
	dv.rawhtml  = true
	dv.title = bold_on .. 
		translate("IPv6 not supported") .. bold_off
	dv.value = translate("IPv6 is currently not (fully) supported by this system" .. "<br />" .. 
			"Please follow the instructions on OpenWrt's homepage to enable IPv6 support" .. "<br />" ..
			"or update your system to the latest OpenWrt Release")
end

-- No HTTPS support
if not has_ssl then
	local dv = s:option(DummyValue, "_no_https")
	dv.titleref = luci.dispatcher.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = bold_on .. 
		translate("HTTPS not supported") .. bold_off
	dv.value = translate("Neither GNU Wget with SSL nor cURL installed to support updates via HTTPS protocol.") .. 
			"<br />- " .. 
			translate("You should install GNU Wget with SSL (prefered) or cURL package.") .. 
			"<br />- " ..
			translate("In some versions cURL/libcurl in OpenWrt is compiled without proxy support.")
end

-- cURL without proxy support
if has_ssl and not has_proxy then
	local dv = s:option(DummyValue, "_no_proxy")
	dv.titleref = luci.dispatcher.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = bold_on .. 
		translate("cURL without Proxy Support") .. bold_off
	dv.value = translate("cURL is installed, but libcurl was compiled without proxy support.") .. 
			"<br />- " .. 
			translate("You should install GNU Wget with SSL or replace libcurl.") .. 
			"<br />- " ..
			translate("In some versions cURL/libcurl in OpenWrt is compiled without proxy support.")
end

-- "Force IP Version not supported"
if not (has_ssl and has_dnstcp) then
	local dv = s:option(DummyValue, "_no_force_ip")
	dv.titleref = luci.dispatcher.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = bold_on .. 
		translate("Force IP Version not supported") .. bold_off
	local value = translate("BusyBox's nslookup and Wget do not support to specify " ..
			"the IP version to use for communication with DDNS Provider.") 
	if not has_ssl then
		value = value .. "<br />- " ..
			translate("You should install GNU Wget with SSL (prefered) or cURL package.")
	end
	if not has_dnstcp then
		value = value .. "<br />- " ..
			translate("You should install BIND host package for DNS requests.")
	end
	dv.value = value
end

-- "DNS requests via TCP not supported"
if not has_dnstcp then
	local dv = s:option(DummyValue, "_no_dnstcp")
	dv.titleref = luci.dispatcher.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = bold_on .. 
		translate("DNS requests via TCP not supported") .. bold_off
	dv.value = translate("BusyBox's nslookup does not support to specify to use TCP instead of default UDP when requesting DNS server") .. 
			"<br />- " ..
			translate("You should install BIND host package for DNS requests.")
end

return m
