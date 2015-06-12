-- Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed under the Apache License, Version 2.0

module("luci.controller.privoxy", package.seeall)

local NX   = require "nixio"
local NXFS = require "nixio.fs"
local HTTP = require "luci.http"
local UCI  = require "luci.model.uci"
local UTIL = require "luci.util"
local SYS  = require "luci.sys"

PRIVOXY_MIN = "3.0.22-0"	-- minimum version of service required

function index()
	entry( {"admin", "services", "privoxy"}, cbi("privoxy"), _("Privoxy WEB proxy"), 59)
	entry( {"admin", "services", "privoxy", "logview"}, call("logread") ).leaf = true
	entry( {"admin", "services", "privoxy", "startstop"}, call("startstop") ).leaf = true
	entry( {"admin", "services", "privoxy", "status"}, call("get_pid") ).leaf = true
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

-- compare versions using "<=" "<" ">" ">=" "=" "<<" ">>"
function ipkg_ver_compare(ver1, comp, ver2)
	if not ver1 or not ver2
	or not comp or not (#comp > 0) then return nil end
	-- correct compare string
	if comp == "<>" or comp == "><" or comp == "!=" or comp == "~=" then comp = "~="
	elseif comp == "<=" or comp == "<" or comp == "=<" then comp = "<="
	elseif comp == ">=" or comp == ">" or comp == "=>" then comp = ">="
	elseif comp == "="  or comp == "==" then comp = "=="
	elseif comp == "<<" then comp = "<"
	elseif comp == ">>" then comp = ">"
	else return nil end

	local av1 = UTIL.split(ver1, "[%.%-]", nil, true)
	local av2 = UTIL.split(ver2, "[%.%-]", nil, true)

	for i = 1, math.max(table.getn(av1),table.getn(av2)), 1  do
		local s1 = av1[i] or ""
		local s2 = av2[i] or ""

		-- first "not equal" found return true
		if comp == "~=" and (s1 ~= s2) then return true end
		-- first "lower" found return true
		if (comp == "<" or comp == "<=") and (s1 < s2) then return true end
		-- first "greater" found return true
		if (comp == ">" or comp == ">=") and (s1 > s2) then return true end
		-- not equal then return false
		if (s1 ~= s2) then return false end
	end

	-- all equal and not compare greater or lower then true
	return not (comp == "<" or comp == ">")
end

-- read version information for given package if installed
function ipkg_ver_installed(pkg)
	local version = nil
	local control = io.open("/usr/lib/opkg/info/%s.control" % pkg, "r")
	if control then
		local ln
		repeat
			ln = control:read("*l")
			if ln and ln:match("^Version: ") then
				version = ln:gsub("^Version: ", "")
				break
			end
		until not ln
		control:close()
	end
	return version
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
