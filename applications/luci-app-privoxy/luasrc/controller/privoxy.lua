-- Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed under the Apache License, Version 2.0

module("luci.controller.privoxy", package.seeall)

local NX   = require "nixio"
local NXFS = require "nixio.fs"
local HTTP = require "luci.http"
local UCI  = require "luci.model.uci"
local SYS  = require "luci.sys"

PRIVOXY_MIN = "3.0.22-0"	-- minimum version of service required

function index()
	local _sys	= require "luci.sys"
	local _verinst	= _sys.exec([[opkg list-installed ]] .. "privoxy" .. [[ | cut -d " " -f 3 ]])
	local _cmd 	= [[opkg compare-versions "]] .. _verinst .. [[" ">=" "]] .. "3.0.22-0" .. [["]]
	local _verok	= tonumber(_sys.call(_cmd))

	-- check config file and version
	if not nixio.fs.access("/etc/config/privoxy") or (_verok == 0) then
		entry( {"admin", "services", "privoxy"}, cbi("privoxy/apperror",
			{hideapplybtn=true, hidesavebtn=true, hideresetbtn=true }), _("Privoxy WEB proxy"), 59)
	else
		entry( {"admin", "services", "privoxy"}, cbi("privoxy/detail"), _("Privoxy WEB proxy"), 59)
		entry( {"admin", "services", "privoxy", "logview"}, call("logread") ).leaf = true
		entry( {"admin", "services", "privoxy", "startstop"}, call("startstop") ).leaf = true
		entry( {"admin", "services", "privoxy", "status"}, call("get_pid") ).leaf = true
	end
end

-- called by XHR.get from detail_logview.htm
function logread()
	-- read application settings
	local uci     = UCI.cursor()
	local logdir  = uci:get("privoxy", "privoxy", "logdir") or "/var/log"
	local logfile = uci:get("privoxy", "privoxy", "logfile") or "privoxy.log"
	uci:unload("privoxy")

	local lfile=logdir .. "/" .. logfile
	local ldata=NXFS.readfile(lfile)
	if not ldata or #ldata == 0 then
		ldata="_nodata_"
	end
	HTTP.write(ldata)
end

-- called by XHR.get from detail_startstop.htm
function startstop()
	local pid = get_pid(true)
	if pid > 0 then
		SYS.call("/etc/init.d/privoxy stop")
		NX.nanosleep(1)		-- sleep a second
		if NX.kill(pid, 0) then	-- still running
			NX.kill(pid, 9)	-- send SIGKILL
		end
		pid = 0
	else
		SYS.call("/etc/init.d/privoxy start")
		NX.nanosleep(1)		-- sleep a second
		pid = tonumber(NXFS.readfile("/var/run/privoxy.pid") or 0 )
		if pid > 0 and not NX.kill(pid, 0) then
			pid = 0		-- process did not start
		end
	end
	HTTP.write(tostring(pid))	-- HTTP needs string not number
end

-- called by XHR.poll from detail_startstop.htm
-- and from lua (with parameter "true")
function get_pid(from_lua)
	local pid = tonumber(NXFS.readfile("/var/run/privoxy.pid") or 0 )
	if pid > 0 and not NX.kill(pid, 0) then
		pid = 0
	end
	if from_lua then
		return pid
	else
		HTTP.write(tostring(pid))	-- HTTP needs string not number
	end
end

-- get the "name" of the current active theme
function get_theme()
	local _uci  = UCI.cursor()
	local _base = _uci:get("luci", "main", "mediaurlbase")	-- only pathname
	_uci:unload("luci")

	for k, v in pairs(luci.config.themes) do
		if k:sub(1, 1) ~= "." and v == _base then
			return k
		end
	end
	return nil
end

-- replacement of build-in Flag.parse of cbi.lua
-- modified to mark section as changed if value changes
-- current parse did not do this, but it is done AbstaractValue.parse()
function flag_parse(self, section)
	local fexists = self.map:formvalue(
		luci.cbi.FEXIST_PREFIX .. self.config .. "." .. section .. "." .. self.option)

	if fexists then
		local fvalue = self:formvalue(section) and self.enabled or self.disabled
		local cvalue = self:cfgvalue(section)
		if fvalue ~= self.default or (not self.optional and not self.rmempty) then
			self:write(section, fvalue)
		else
			self:remove(section)
		end
		if (fvalue ~= cvalue) then self.section.changed = true end
	else
		self:remove(section)
		self.section.changed = true
	end
end
