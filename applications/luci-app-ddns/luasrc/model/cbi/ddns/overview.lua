-- Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed to the public under the Apache License 2.0.

local NXFS = require "nixio.fs"
local CTRL = require "luci.controller.ddns"	-- this application's controller
local DISP = require "luci.dispatcher"
local HTTP = require "luci.http"
local SYS  = require "luci.sys"
local DDNS = require "luci.tools.ddns"		-- ddns multiused functions

-- show hints ?
show_hints = not (DDNS.check_ipv6()		-- IPv6 support
		and DDNS.check_ssl()		-- HTTPS support
		and DDNS.check_proxy()		-- Proxy support
		and DDNS.check_bind_host()	-- DNS TCP support
		)
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
m.title	= [[</a><a href="javascript:alert(']]
		.. translate("Version Information")
		.. [[\n\nluci-app-ddns]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]] .. DDNS.ipkg_ver_installed("luci-app-ddns")
		.. [[\n\nddns-scripts ]] .. translate("required") .. [[:]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]] .. CTRL.DDNS_MIN .. [[ ]] .. translate("or higher")
		.. [[\n\nddns-scripts ]] .. translate("installed") .. [[:]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]] .. DDNS.ipkg_ver_installed("ddns-scripts")
		.. [[\n\n]]
	.. [[')">]]
	.. translate("Dynamic DNS")

m.description = translate("Dynamic DNS allows that your router can be reached with " ..
			"a fixed hostname while having a dynamically changing " ..
			"IP address.")

m.on_after_commit = function(self)
	if self.changed then	-- changes ?
		if SYS.init.enabled("ddns") then	-- ddns service enabled, restart all
			os.execute("/etc/init.d/ddns restart")
		else	-- ddns service disabled, send SIGHUP to running
			os.execute("killall -1 dynamic_dns_updater.sh")
		end
	end
end

-- SimpleSection definiton -- ##################################################
-- with all the JavaScripts we need for "a good Show"
a = m:section( SimpleSection )
a.template = "ddns/overview_status"

-- SimpleSection definition -- #################################################
-- show Hints to optimize installation and script usage
-- only show if 	service not enabled
--		or	no IPv6 support
--		or	not GNU Wget and not cURL	(for https support)
--		or	not GNU Wget but cURL without proxy support
--		or	not BIND's host
--		or	ddns-scripts package need update
if show_hints or need_update or not SYS.init.enabled("ddns") then
	s = m:section( SimpleSection, translate("Hints") )

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
				"You can start/stop each configuration here. It will run until next reboot.")
	end

	-- Show more hints on a separate page
	if show_hints then
		local dv = s:option(DummyValue, "_separate")
		dv.titleref = DISP.build_url("admin", "services", "ddns", "hints")
		dv.rawhtml  = true
		dv.title = bold_on ..
			translate("Show more") .. bold_off
		dv.value = translate("Follow this link" .. "<br />" ..
				"You will find more hints to optimize your system to run DDNS scripts with all options")
	end
end

-- TableSection definition -- ##################################################
ts = m:section( TypedSection, "service",
	translate("Overview"),
	translate("Below is a list of configured DDNS configurations and their current state.") 
	.. "<br />" 
	.. translate("If you want to send updates for IPv4 and IPv6 you need to define two separate Configurations " 
		.. "i.e. 'myddns_ipv4' and 'myddns_ipv6'") 
	.. "<br />" 
	.. [[<a href="]] .. DISP.build_url("admin", "services", "ddns", "global") .. [[">]]
	.. translate("To change global settings click here") .. [[</a>]] )
ts.sectionhead = translate("Configuration")
ts.template = "cbi/tblsection"
ts.addremove = true
ts.extedit = DISP.build_url("admin", "services", "ddns", "detail", "%s")
function ts.create(self, name)
	AbstractSection.create(self, name)
	HTTP.redirect( self.extedit:format(name) )
end

-- Domain and registered IP -- #################################################
dom = ts:option(DummyValue, "_domainIP",
	translate("Hostname/Domain") .. "<br />" .. translate("Registered IP") )
dom.template = "ddns/overview_doubleline"
function dom.set_one(self, section)
	local domain = self.map:get(section, "domain") or ""
	if domain ~= "" then
		return domain
	else
		return [[<em>]] .. translate("config error") .. [[</em>]]
	end
end
function dom.set_two(self, section)
	local domain = self.map:get(section, "domain") or ""
	if domain == "" then return "" end
	local dnsserver = self.map:get(section, "dnsserver") or ""
	local use_ipv6 = tonumber(self.map:get(section, "use_ipv6") or 0)
	local force_ipversion = tonumber(self.map:get(section, "force_ipversion") or 0)
	local force_dnstcp = tonumber(self.map:get(section, "force_dnstcp") or 0)
	local command = [[/usr/lib/ddns/dynamic_dns_lucihelper.sh]]
	if not NXFS.access(command, "rwx", "rx", "rx") then
		NXFS.chmod(command, 755)
	end
	command = command .. [[ get_registered_ip ]] .. domain .. [[ ]] .. use_ipv6 ..
		[[ ]] .. force_ipversion .. [[ ]] .. force_dnstcp .. [[ ]] .. dnsserver
	local ip = SYS.exec(command)
	if ip == "" then ip = translate("no data") end
	return ip
end

-- enabled
ena = ts:option( Flag, "enabled",
	translate("Enabled"))
ena.template = "ddns/overview_enabled"
ena.rmempty = false
function ena.parse(self, section)
	DDNS.flag_parse(self, section)
end

-- show PID and next update
upd = ts:option( DummyValue, "_update",
	translate("Last Update") .. "<br />" .. translate("Next Update"))
upd.template = "ddns/overview_doubleline"
function upd.set_one(self, section)	-- fill Last Update
	-- get/validate last update
	local uptime   = SYS.uptime()
	local lasttime = DDNS.get_lastupd(section)
	if lasttime > uptime then 	-- /var might not be linked to /tmp and cleared on reboot
		lasttime = 0
	end

	-- no last update happen
	if lasttime == 0 then
		return translate("never")

	-- we read last update
	else
		-- calc last update
		--            os.epoch  - sys.uptime + lastupdate(uptime)
		local epoch = os.time() - uptime + lasttime
		-- use linux date to convert epoch
		return DDNS.epoch2date(epoch)
	end
end
function upd.set_two(self, section)	-- fill Next Update
	-- get enabled state
	local enabled	= tonumber(self.map:get(section, "enabled") or 0)
	local datenext	= translate("unknown error")	-- formatted date of next update

	-- get force seconds
	local force_interval = tonumber(self.map:get(section, "force_interval") or 72)
	local force_unit = self.map:get(section, "force_unit") or "hours"
	local force_seconds = DDNS.calc_seconds(force_interval, force_unit)

	-- get last update and get/validate PID
	local uptime   = SYS.uptime()
	local lasttime = DDNS.get_lastupd(section)
	if lasttime > uptime then 	-- /var might not be linked to /tmp and cleared on reboot
		lasttime = 0
	end
	local pid      = DDNS.get_pid(section)

	-- calc next update
	if lasttime > 0 then
		local epoch = os.time() - uptime + lasttime + force_seconds
		-- use linux date to convert epoch
		datelast = DDNS.epoch2date(epoch)
	end

	-- process running but update needs to happen
	if pid > 0 and ( lasttime + force_seconds - uptime ) < 0 then
		datenext = translate("Verify")

	-- run once
	elseif force_seconds == 0 then
		datenext = translate("Run once")

	-- no process running and NOT enabled
	elseif pid == 0 and enabled == 0 then
		datenext  = translate("Disabled")

	-- no process running and NOT
	elseif pid == 0 and enabled ~= 0 then
		datenext = translate("Stopped")
	end

	return datenext
end

-- start/stop button
btn = ts:option( Button, "_startstop",
	translate("Process ID") .. "<br />" .. translate("Start / Stop") )
btn.template = "ddns/overview_startstop"
function btn.cfgvalue(self, section)
	local pid = DDNS.get_pid(section)
	if pid > 0 then
		btn.inputtitle	= "PID: " .. pid
		btn.inputstyle	= "reset"
		btn.disabled	= false
	elseif (self.map:get(section, "enabled") or "0") ~= "0" then
		btn.inputtitle	= translate("Start")
		btn.inputstyle	= "apply"
		btn.disabled	= false
	else
		btn.inputtitle	= "----------"
		btn.inputstyle	= "button"
		btn.disabled	= true
	end
	return true
end

return m
