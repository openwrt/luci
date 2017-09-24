-- Copyright 2014-2016 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed to the public under the Apache License 2.0.

module("luci.tools.ddns", package.seeall)

local NX   = require "nixio"
local NXFS = require "nixio.fs"
local OPKG = require "luci.model.ipkg"
local UCI  = require "luci.model.uci"
local SYS  = require "luci.sys"
local UTIL = require "luci.util"

local function _check_certs()
	local _, v = NXFS.glob("/etc/ssl/certs/*.crt")
	if ( v == 0 ) then _, v = NXFS.glob("/etc/ssl/certs/*.pem") end
	return (v > 0)
end

has_wgetssl	= (SYS.call( [[which wget-ssl >/dev/null 2>&1]] ) == 0)	-- and true or nil
has_curl	= (SYS.call( [[which curl >/dev/null 2>&1]] ) == 0)
has_curlssl	= (SYS.call( [[$(which curl) -V 2>&1 | grep "Protocols:" | grep -qF "https"]] ) ~= 0)
has_curlpxy	= (SYS.call( [[grep -i "all_proxy" /usr/lib/libcurl.so* >/dev/null 2>&1]] ) == 0)
has_fetch	= (SYS.call( [[which uclient-fetch >/dev/null 2>&1]] ) == 0)
has_fetchssl	= NXFS.access("/lib/libustream-ssl.so")
has_bbwget	= (SYS.call( [[$(which wget) -V 2>&1 | grep -iqF "busybox"]] ) == 0)
has_bindhost	= (SYS.call( [[which host >/dev/null 2>&1]] ) == 0)
		or (SYS.call( [[which khost >/dev/null 2>&1]] ) == 0)
		or (SYS.call( [[which drill >/dev/null 2>&1]] ) == 0)
has_hostip	= (SYS.call( [[which hostip >/dev/null 2>&1]] ) == 0)
has_nslookup	= (SYS.call( [[$(which nslookup) localhost 2>&1 | grep -qF "(null)"]] ) ~= 0)
has_ipv6	= (NXFS.access("/proc/net/ipv6_route") and NXFS.access("/usr/sbin/ip6tables"))
has_ssl		= (has_wgetssl or has_curlssl or (has_fetch and has_fetchssl))
has_proxy	= (has_wgetssl or has_curlpxy or has_fetch or has_bbwget)
has_forceip	= (has_wgetssl or has_curl or has_fetch) -- only really needed for transfer
has_dnsserver	= (has_bindhost or has_hostip or has_nslookup)
has_bindnet	= (has_wgetssl or has_curl)
has_cacerts	= _check_certs()

-- function to calculate seconds from given interval and unit
function calc_seconds(interval, unit)
	if not tonumber(interval) then
		return nil
	elseif unit == "days" then
		return (tonumber(interval) * 86400)	-- 60 sec * 60 min * 24 h
	elseif unit == "hours" then
		return (tonumber(interval) * 3600)	-- 60 sec * 60 min
	elseif unit == "minutes" then
		return (tonumber(interval) * 60)	-- 60 sec
	elseif unit == "seconds" then
		return tonumber(interval)
	else
		return nil
	end
end

-- convert epoch date to given format
function epoch2date(epoch, format)
	if not format or #format < 2 then
		local uci = UCI.cursor()
		format    = uci:get("ddns", "global", "ddns_dateformat") or "%F %R"
		uci:unload("ddns")
	end
	format = format:gsub("%%n", "<br />")	-- replace newline
	format = format:gsub("%%t", "    ")	-- replace tab
	return os.date(format, epoch)
end

-- read lastupdate from [section].update file
function get_lastupd(section)
	local uci   = UCI.cursor()
	local rdir  = uci:get("ddns", "global", "ddns_rundir") or "/var/run/ddns"
	local etime = tonumber(NXFS.readfile("%s/%s.update" % { rdir, section } ) or 0 )
	uci:unload("ddns")
	return etime
end

-- read PID from run file and verify if still running
function get_pid(section)
	local uci  = UCI.cursor()
	local rdir = uci:get("ddns", "global", "ddns_rundir") or "/var/run/ddns"
	local pid  = tonumber(NXFS.readfile("%s/%s.pid" % { rdir, section } ) or 0 )
	if pid > 0 and not NX.kill(pid, 0) then
		pid = 0
	end
	uci:unload("ddns")
	return pid
end

-- replacement of build-in read of UCI option
-- modified AbstractValue.cfgvalue(self, section) from cbi.lua
-- needed to read from other option then current value definition
function read_value(self, section, option)
	local value
	if self.tag_error[section] then
		value = self:formvalue(section)
	else
		value = self.map:get(section, option)
	end

	if not value then
		return nil
	elseif not self.cast or self.cast == type(value) then
		return value
	elseif self.cast == "string" then
		if type(value) == "table" then
			return value[1]
		end
	elseif self.cast == "table" then
		return { value }
	end
end

-- replacement of build-in parse of "Value"
-- modified AbstractValue.parse(self, section, novld) from cbi.lua
-- validate is called if rmempty/optional true or false
-- before write check if forcewrite, value eq default, and more
function value_parse(self, section, novld)
	local fvalue = self:formvalue(section)
	local fexist = ( fvalue and (#fvalue > 0) )	-- not "nil" and "not empty"
	local cvalue = self:cfgvalue(section)
	local rm_opt = ( self.rmempty or self.optional )
	local eq_cfg					-- flag: equal cfgvalue

	-- If favlue and cvalue are both tables and have the same content
	-- make them identical
	if type(fvalue) == "table" and type(cvalue) == "table" then
		eq_cfg = (#fvalue == #cvalue)
		if eq_cfg then
			for i=1, #fvalue do
				if cvalue[i] ~= fvalue[i] then
					eq_cfg = false
				end
			end
		end
		if eq_cfg then
			fvalue = cvalue
		end
	end

	-- removed parameter "section" from function call because used/accepted nowhere
	-- also removed call to function "transfer"
	local vvalue, errtxt = self:validate(fvalue)

	-- error handling; validate return "nil"
	if not vvalue then
		if novld then 		-- and "novld" set
			return		-- then exit without raising an error
		end

		if fexist then		-- and there is a formvalue
			self:add_error(section, "invalid", errtxt or self.title .. ": invalid")
			return		-- so data are invalid
		elseif not rm_opt then	-- and empty formvalue but NOT (rmempty or optional) set
			self:add_error(section, "missing", errtxt or self.title .. ": missing")
			return		-- so data is missing
		elseif errtxt then
			self:add_error(section, "invalid", errtxt)
			return
		end
--		error  ("\n option: " .. self.option ..
--			"\n fvalue: " .. tostring(fvalue) ..
--			"\n fexist: " .. tostring(fexist) ..
--			"\n cvalue: " .. tostring(cvalue) ..
--			"\n vvalue: " .. tostring(vvalue) ..
--			"\n vexist: " .. tostring(vexist) ..
--			"\n rm_opt: " .. tostring(rm_opt) ..
--			"\n eq_cfg: " .. tostring(eq_cfg) ..
--			"\n eq_def: " .. tostring(eq_def) ..
--			"\n novld : " .. tostring(novld) ..
--			"\n errtxt: " .. tostring(errtxt) )
	end

	-- lets continue with value returned from validate
	eq_cfg  = ( vvalue == cvalue )					-- update equal_config flag
	local vexist = ( vvalue and (#vvalue > 0) ) and true or false	-- not "nil" and "not empty"
	local eq_def = ( vvalue == self.default )			-- equal_default flag

	-- (rmempty or optional) and (no data or equal_default)
	if rm_opt and (not vexist or eq_def) then
		if self:remove(section) then		-- remove data from UCI
			self.section.changed = true	-- and push events
		end
		return
	end

	-- not forcewrite and no changes, so nothing to write
	if not self.forcewrite and eq_cfg then
		return
	end

	-- we should have a valid value here
	assert (vvalue, "\n option: " .. self.option ..
			"\n fvalue: " .. tostring(fvalue) ..
			"\n fexist: " .. tostring(fexist) ..
			"\n cvalue: " .. tostring(cvalue) ..
			"\n vvalue: " .. tostring(vvalue) ..
			"\n vexist: " .. tostring(vexist) ..
			"\n rm_opt: " .. tostring(rm_opt) ..
			"\n eq_cfg: " .. tostring(eq_cfg) ..
			"\n eq_def: " .. tostring(eq_def) ..
			"\n errtxt: " .. tostring(errtxt) )

	-- write data to UCI; raise event only on changes
	if self:write(section, vvalue) and not eq_cfg then
		self.section.changed = true
	end
end

-----------------------------------------------------------------------------
-- copied from https://svn.nmap.org/nmap/nselib/url.lua
-- @author Diego Nehab
-- @author Eddie Bell <ejlbell@gmail.com>
--[[
    URI parsing, composition and relative URL resolution
    LuaSocket toolkit.
    Author: Diego Nehab
    RCS ID: $Id: url.lua,v 1.37 2005/11/22 08:33:29 diego Exp $
    parse_query and build_query added For nmap (Eddie Bell <ejlbell@gmail.com>)
]]--
---
-- Parses a URL and returns a table with all its parts according to RFC 2396.
--
-- The following grammar describes the names given to the URL parts.
-- <code>
-- <url> ::= <scheme>://<authority>/<path>;<params>?<query>#<fragment>
-- <authority> ::= <userinfo>@<host>:<port>
-- <userinfo> ::= <user>[:<password>]
-- <path> :: = {<segment>/}<segment>
-- </code>
--
-- The leading <code>/</code> in <code>/<path></code> is considered part of
-- <code><path></code>.
-- @param url URL of request.
-- @param default Table with default values for each field.
-- @return A table with the following fields, where RFC naming conventions have
--   been preserved:
--     <code>scheme</code>, <code>authority</code>, <code>userinfo</code>,
--     <code>user</code>, <code>password</code>, <code>host</code>,
--     <code>port</code>, <code>path</code>, <code>params</code>,
--     <code>query</code>, and <code>fragment</code>.
-----------------------------------------------------------------------------
function parse_url(url)	--, default)
	-- initialize default parameters
	local parsed = {}
--	for i,v in base.pairs(default or parsed) do
--		parsed[i] = v
--	end

	-- remove whitespace
--	url = string.gsub(url, "%s", "")
	-- get fragment
	url = string.gsub(url, "#(.*)$",
		function(f)
			parsed.fragment = f
			return ""
		end)
	-- get scheme. Lower-case according to RFC 3986 section 3.1.
	url = string.gsub(url, "^([%w][%w%+%-%.]*)%:",
		function(s)
			parsed.scheme = string.lower(s);
			return ""
		end)
	-- get authority
	url = string.gsub(url, "^//([^/]*)",
		function(n)
			parsed.authority = n
			return ""
		end)
	-- get query stringing
	url = string.gsub(url, "%?(.*)",
		function(q)
			parsed.query = q
			return ""
		end)
	-- get params
	url = string.gsub(url, "%;(.*)",
		function(p)
			parsed.params = p
			return ""
		end)
	-- path is whatever was left
	parsed.path = url

	local authority = parsed.authority
	if not authority then
		return parsed
	end
	authority = string.gsub(authority,"^([^@]*)@",
		function(u)
			parsed.userinfo = u;
			return ""
		end)
	authority = string.gsub(authority, ":([0-9]*)$",
		function(p)
			if p ~= "" then
				parsed.port = p
			end;
			return ""
		end)
	if authority ~= "" then
		parsed.host = authority
	end

	local userinfo = parsed.userinfo
	if not userinfo then
		return parsed
	end
	userinfo = string.gsub(userinfo, ":([^:]*)$",
		function(p)
			parsed.password = p;
			return ""
		end)
	parsed.user = userinfo
	return parsed
end
