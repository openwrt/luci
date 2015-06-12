-- Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed under the Apache License, Version 2.0

module("luci.controller.radicale", package.seeall)

local NX    = require("nixio")
local NXFS  = require("nixio.fs")
local DISP  = require "luci.dispatcher"
local HTTP  = require("luci.http")
local I18N = require("luci.i18n")	-- not globally avalible here
local UTIL  = require("luci.util")
local SYS   = require("luci.sys")

function index()
	entry( {"admin", "services", "radicale"}, alias("admin", "services", "radicale", "edit"), _("CalDAV/CardDAV"), 58)
	entry( {"admin", "services", "radicale", "edit"}, cbi("radicale") ).leaf = true
	entry( {"admin", "services", "radicale", "logview"}, call("_logread") ).leaf = true
	entry( {"admin", "services", "radicale", "startstop"}, call("_startstop") ).leaf = true
	entry( {"admin", "services", "radicale", "status"}, call("_status") ).leaf = true
end

-- called by XHR.get from detail_logview.htm
function _logread()
	-- read application settings
	local uci     = UCI.cursor()
	local logfile = uci:get("radicale", "radicale", "logfile") or "/var/log/radicale"
	uci:unload("radicale")

	local ldata=NXFS.readfile(logfile)
	if not ldata or #ldata == 0 then
		ldata="_nodata_"
	end
	HTTP.write(ldata)
end

-- called by XHR.get from detail_startstop.htm
function _startstop()
	local pid = get_pid()
	if pid > 0 then
		SYS.call("/etc/init.d/radicale stop")
		NX.nanosleep(1)		-- sleep a second
		if NX.kill(pid, 0) then	-- still running
			NX.kill(pid, 9)	-- send SIGKILL
		end
		pid = 0
	else
		SYS.call("/etc/init.d/radicale start")
		NX.nanosleep(1)		-- sleep a second
		pid = get_pid()
		if pid > 0 and not NX.kill(pid, 0) then
			pid = 0		-- process did not start
		end
	end
	HTTP.write(tostring(pid))	-- HTTP needs string not number
end

-- called by XHR.poll from detail_startstop.htm
function _status()
	local pid = get_pid()
	HTTP.write(tostring(pid))	-- HTTP needs string not number
end

-- Application / Service specific information functions ########################
function luci_app_name()
	return	"luci-app-radicale"
end

function service_name()
	return	"radicale"
end
function service_required()
	return	"0.10-1"
end
function service_installed()
	local v = ipkg_ver_installed("radicale-py2")
	if not v or #v == 0 then v = ipkg_ver_installed("radicale-py3") end
	if not v or #v == 0 then v = "0" end
	return v
end
function service_ok()
	return	ipkg_ver_compare(service_installed(),">=",service_required())
end

function app_title_main()
	return	[[</a><a href="javascript:alert(']]
			.. I18N.translate("Version Information")
			.. [[\n\n]] .. luci_app_name()
			.. [[\n\t]] .. I18N.translate("Version") .. [[:\t]]
				.. (ipkg_ver_installed(luci_app_name()) == ""
					and I18N.translate("NOT installed")
					or ipkg_ver_installed(luci_app_name()) )
			.. [[\n\n]] .. service_name() .. [[ ]] .. I18N.translate("required") .. [[:]]
			.. [[\n\t]] .. I18N.translate("Version") .. [[:\t]]
				.. service_required() .. [[ ]] .. I18N.translate("or higher")
			.. [[\n\n]] .. service_name() .. [[ ]] .. I18N.translate("installed") .. [[:]]
			.. [[\n\t]] .. I18N.translate("Version") .. [[:\t]]
				.. (service_installed() == "0"
					and I18N.translate("NOT installed")
					or service_installed())
			.. [[\n\n]]
	 	.. [[')">]]
		.. I18N.translate("Radicale CalDAV/CardDAV Server")
end
function app_title_back()
	return	[[</a><a href="]]
			.. DISP.build_url("admin", "services", "radicale")
		.. [[">]]
		.. I18N.translate("Radicale CalDAV/CardDAV Server")
end
function app_description()
	return	I18N.translate("The Radicale Project is a complete CalDAV (calendar) and CardDAV (contact) server solution.") .. [[<br />]]
	     .. I18N.translate("Calendars and address books are available for both local and remote access, possibly limited through authentication policies.") .. [[<br />]]
	     .. I18N.translate("They can be viewed and edited by calendar and contact clients on mobile phones or computers.")
end

-- other multiused functions ###################################################

--return pid of running process
function get_pid()
	return tonumber(SYS.exec([[ps | grep "[p]ython.*[r]adicale" 2>/dev/null | awk '{print $1}']])) or 0
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
	local version = ""
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
