--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.ddns", package.seeall)

local NX   = require "nixio"
local NXFS = require "nixio.fs"
local DISP = require "luci.dispatcher"
local HTTP = require "luci.http"
local UCI  = require "luci.model.uci"
local SYS  = require "luci.sys"
local DDNS = require "luci.tools.ddns"		-- ddns multiused functions
local UTIL = require "luci.util"

local luci_ddns_version = "2.1.0-2"	-- luci-app-ddns / openwrt Makefile compatible version
local ddns_scripts_min  = "2.1.0-2"	-- minimum version of ddns-scripts required

function index()
	-- above 'require "mod"' definitions are not recognized
	-- inside index() during initialisation

	-- no configuration file, don't start
	if not nixio.fs.access("/etc/config/ddns") then
		return
	end
	-- ddns-scripts 1.0.0 installed, run old luci app
	if not nixio.fs.access("/usr/lib/ddns/services_ipv6")
	    or nixio.fs.access("/usr/lib/ddns/url_escape.sed") then
		local page
		page = entry({"admin", "services", "ddns"}, cbi("ddns/ddns"), _("Dynamic DNS"), 60)
		page.dependent = true
		page = entry({"mini", "network", "ddns"}, cbi("ddns/ddns", {autoapply=true}), _("Dynamic DNS"), 60)
		page.dependent = true
	-- it looks like ddns-scripts 2.x.x are installed
	else
		entry( {"admin", "services", "ddns"}, cbi("ddns/overview"), _("Dynamic DNS"), 59)
		entry( {"admin", "services", "ddns", "detail"}, cbi("ddns/detail"), nil ).leaf = true
		entry( {"admin", "services", "ddns", "hints"}, cbi("ddns/hints",
			{hideapplybtn=true, hidesavebtn=true, hideresetbtn=true}), nil ).leaf = true
		entry( {"admin", "services", "ddns", "logview"}, call("logread") ).leaf = true
		entry( {"admin", "services", "ddns", "startstop"}, call("startstop") ).leaf = true
		entry( {"admin", "services", "ddns", "status"}, call("status") ).leaf = true
	end
end

-- function to read all sections status and return data array
local function _get_status()
	local uci	 = UCI.cursor()
	local service	 = SYS.init.enabled("ddns") and 1 or 0
	local url_start	 = DISP.build_url("admin", "system", "startup")
	local luci_build = DDNS.ipkg_version("luci-app-ddns").version
	local ddns_act   = DDNS.ipkg_version("ddns-scripts").version
	local data	 = {}	-- Array to transfer data to javascript

	data[#data+1] 	= {
		enabled	   = service,		-- service enabled
		url_up	   = url_start,		-- link to enable DDS (System-Startup)
		luci_ver   = luci_ddns_version,	-- luci-app-ddns / openwrt Makefile compatible version
		luci_build = luci_build,	-- installed luci build
		script_min = ddns_scripts_min,	-- minimum version of ddns-scripts needed
		script_ver = ddns_act		-- installed ddns-scripts
	}

	uci:foreach("ddns", "service", function (s)

		-- Get section we are looking at
		-- and enabled state
		local section	= s[".name"]
		local enabled	= tonumber(s["enabled"]) or 0
		local datelast	= "_empty_"	-- formated date of last update
		local datenext	= "_empty_"	-- formated date of next update

		-- get force seconds
		local force_seconds = DDNS.calc_seconds(
				tonumber(s["force_interval"]) or 72 ,
				s["force_unit"] or "hours" )
		-- get/validate pid and last update
		local pid      = DDNS.get_pid(section)
		local uptime   = SYS.uptime()
		local lasttime = DDNS.get_lastupd(section)
		if lasttime > uptime then 	-- /var might not be linked to /tmp
			lasttime = 0 		-- and/or not cleared on reboot
		end

		-- no last update happen
		if lasttime == 0 then
			datelast = "_never_"

		-- we read last update
		else
			-- calc last update
			--             sys.epoch - sys uptime   + lastupdate(uptime)
			local epoch = os.time() - uptime + lasttime
			-- use linux date to convert epoch
			datelast = DDNS.epoch2date(epoch)
			-- calc and fill next update
			datenext = DDNS.epoch2date(epoch + force_seconds)
		end

		-- process running but update needs to happen
		-- problems it force_seconds > uptime
		force_seconds = (force_seconds > uptime) and uptime or force_seconds
		if pid > 0 and ( lasttime + force_seconds - uptime ) <= 0 then
			datenext = "_verify_"

		-- run once
		elseif force_seconds == 0 then
			datenext = "_runonce_"

		-- no process running and NOT enabled
		elseif pid == 0 and enabled == 0 then
			datenext  = "_disabled_"

		-- no process running and NOT
		elseif pid == 0 and enabled ~= 0 then
			datenext = "_stopped_"
		end

		-- get/set monitored interface and IP version
		local iface	= s["interface"] or "_nonet_"
		local use_ipv6	= tonumber(s["use_ipv6"]) or 0
		if iface ~= "_nonet_" then
			local ipv = (use_ipv6 == 1) and "IPv6" or "IPv4"
			iface = ipv .. " / " .. iface
		end

		-- try to get registered IP
		local domain	= s["domain"] or "_nodomain_"
		local dnsserver	= s["dns_server"] or ""
		local force_ipversion = tonumber(s["force_ipversion"] or 0)
		local force_dnstcp = tonumber(s["force_dnstcp"] or 0)
		local command = [[/usr/lib/ddns/dynamic_dns_lucihelper.sh]]
		command = command .. [[ get_registered_ip ]] .. domain .. [[ ]] .. use_ipv6 ..
			[[ ]] .. force_ipversion .. [[ ]] .. force_dnstcp .. [[ ]] .. dnsserver
		local reg_ip = SYS.exec(command)
		if reg_ip == "" then
			reg_ip = "_nodata_"
		end

		-- fill transfer array
		data[#data+1]	= {
			section  = section,
			enabled  = enabled,
			iface    = iface,
			domain   = domain,
			reg_ip   = reg_ip,
			pid      = pid,
			datelast = datelast,
			datenext = datenext
		}
	end)

	uci:unload("ddns")
	return data
end

-- called by XHR.get from detail_logview.htm
function logread(section)
	-- read application settings
	local uci	  = UCI.cursor()
	local log_dir	  = uci:get("ddns", "global", "log_dir") or "/var/log/ddns"
	local lfile=log_dir .. "/" .. section .. ".log"

	local ldata=NXFS.readfile(lfile)
	if not ldata or #ldata == 0 then
		ldata="_nodata_"
	end
	uci:unload("ddns")
	HTTP.write(ldata)
end

-- called by XHR.get from overview_status.htm
function startstop(section, enabled)
	local uci  = UCI.cursor()
	local data = {}		-- Array to transfer data to javascript

	-- if process running we want to stop and return
	local pid = DDNS.get_pid(section)
	if pid > 0 then
		local tmp = NX.kill(pid, 15)	-- terminate
		NX.nanosleep(2)	-- 2 second "show time"
		-- status changed so return full status
		data = _get_status()
		HTTP.prepare_content("application/json")
		HTTP.write_json(data)
		return
	end

	-- read uncommited changes
	-- we don't save and commit data from other section or other options
	-- only enabled will be done
	local exec	  = true
	local changed     = uci:changes("ddns")
	for k_config, v_section in pairs(changed) do
		-- security check because uci.changes only gets our config
		if k_config ~= "ddns" then
			exec = false
			break
		end
		for k_section, v_option in pairs(v_section) do
			-- check if only section of button was changed
			if k_section ~= section then
				exec = false
				break
			end
			for k_option, v_value in pairs(v_option) do
				-- check if only enabled was changed
				if k_option ~= "enabled" then
					exec = false
					break
				end
			end
		end
	end

	-- we can not execute because other
	-- uncommited changes pending, so exit here
	if not exec then
		HTTP.write("_uncommited_")
		return
	end

	-- save enable state
	uci:set("ddns", section, "enabled", ( (enabled == "true") and "1" or "0") )
	uci:save("ddns")
	uci:commit("ddns")
	uci:unload("ddns")

	-- start dynamic_dns_updater.sh script
	os.execute ([[/usr/lib/ddns/dynamic_dns_updater.sh %s 0 > /dev/null 2>&1 &]] % section)
	NX.nanosleep(3)	-- 3 seconds "show time"

	-- status changed so return full status
	data = _get_status()
	HTTP.prepare_content("application/json")
	HTTP.write_json(data)
end

-- called by XHR.poll from overview_status.htm
function status()
	local data = _get_status()
	HTTP.prepare_content("application/json")
	HTTP.write_json(data)
end

-- check if installed ddns-scripts version < required version
function update_needed()
	local sver = DDNS.ipkg_version("ddns-scripts")
	local rver = UTIL.split(ddns_scripts_min, "[%.%-]", nil, true)
	return (sver.major < (tonumber(rver[1]) or 0))
	    or (sver.minor < (tonumber(rver[2]) or 0))
	    or (sver.patch < (tonumber(rver[3]) or 0))
	    or (sver.build < (tonumber(rver[4]) or 0))
end

