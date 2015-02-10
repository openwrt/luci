-- Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed to the public under the Apache License 2.0.

local CTRL = require "luci.controller.ddns"	-- this application's controller
local DISP = require "luci.dispatcher"
local SYS  = require "luci.sys"
local DDNS = require "luci.tools.ddns"		-- ddns multiused functions

-- check supported options -- ##################################################
-- saved to local vars here because doing multiple os calls slow down the system
has_ssl     = DDNS.check_ssl()		-- HTTPS support and --bind-network / --interface
has_proxy   = DDNS.check_proxy()	-- Proxy support
has_dnstcp  = DDNS.check_bind_host()	-- DNS TCP support
-- correct ddns-scripts version
need_update = DDNS.ipkg_ver_compare(DDNS.ipkg_ver_installed("ddns-scripts"), "<<", CTRL.DDNS_MIN)

-- html constants
font_red = [[<font color="red">]]
font_off = [[</font>]]
bold_on  = [[<strong>]]
bold_off = [[</strong>]]

-- cbi-map definition -- #######################################################
m = Map("ddns")

-- first need to close <a> from cbi map template our <a> closed by template
m.title = [[</a><a href="]] .. DISP.build_url("admin", "services", "ddns") .. [[">]] ..
		translate("Dynamic DNS")

m.description = translate("Dynamic DNS allows that your router can be reached with " ..
			"a fixed hostname while having a dynamically changing " ..
			"IP address.")

m.redirect = DISP.build_url("admin", "services", "ddns")

-- SimpleSection definition -- #################################################
-- show Hints to optimize installation and script usage
s = m:section( SimpleSection,
	translate("Hints"),
	translate("Below a list of configuration tips for your system to run Dynamic DNS updates without limitations") )

-- ddns_scripts needs to be updated for full functionality
if need_update then
	local dv = s:option(DummyValue, "_update_needed")
	dv.titleref = DISP.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = font_red .. bold_on ..
		translate("Software update required") .. bold_off .. font_off
	dv.value = translate("The currently installed 'ddns-scripts' package did not support all available settings.") ..
			"<br />" ..
			translate("Please update to the current version!")
end

-- DDNS Service disabled
if not SYS.init.enabled("ddns") then
	local dv = s:option(DummyValue, "_not_enabled")
	dv.titleref = DISP.build_url("admin", "system", "startup")
	dv.rawhtml  = true
	dv.title = bold_on ..
		translate("DDNS Autostart disabled") .. bold_off
	dv.value = translate("Currently DDNS updates are not started at boot or on interface events." .. "<br />" ..
			"This is the default if you run DDNS scripts by yourself (i.e. via cron with force_interval set to '0')" )
end

-- No IPv6 support
if not DDNS.check_ipv6() then
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
	dv.titleref = DISP.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = bold_on ..
		translate("HTTPS not supported") .. bold_off
	dv.value = translate("Neither GNU Wget with SSL nor cURL installed to support updates via HTTPS protocol.") ..
			"<br />- " ..
			translate("You should install GNU Wget with SSL (prefered) or cURL package.") ..
			"<br />- " ..
			translate("In some versions cURL/libcurl in OpenWrt is compiled without proxy support.")
end

-- No bind_network
if not has_ssl then
	local dv = s:option(DummyValue, "_no_bind_network")
	dv.titleref = DISP.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = bold_on ..
		translate("Binding to a specific network not supported") .. bold_off
	dv.value = translate("Neither GNU Wget with SSL nor cURL installed to select a network to use for communication.") ..
			"<br />- " ..
			translate("You should install GNU Wget with SSL or cURL package.") ..
			"<br />- " ..
			translate("GNU Wget will use the IP of given network, cURL will use the physical interface.") ..
			"<br />- " ..
			translate("In some versions cURL/libcurl in OpenWrt is compiled without proxy support.")
end

-- cURL without proxy support
if has_ssl and not has_proxy then
	local dv = s:option(DummyValue, "_no_proxy")
	dv.titleref = DISP.build_url("admin", "system", "packages")
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
	dv.titleref = DISP.build_url("admin", "system", "packages")
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
	dv.titleref = DISP.build_url("admin", "system", "packages")
	dv.rawhtml  = true
	dv.title = bold_on ..
		translate("DNS requests via TCP not supported") .. bold_off
	dv.value = translate("BusyBox's nslookup does not support to specify to use TCP instead of default UDP when requesting DNS server") ..
			"<br />- " ..
			translate("You should install BIND host package for DNS requests.")
end

return m
