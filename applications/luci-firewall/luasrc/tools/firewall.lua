--[[
LuCI - Lua Configuration Interface

Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.tools.firewall", package.seeall)

local ut = require "luci.util"
local ip = require "luci.ip"
local nx = require "nixio"

local tr, trf = luci.i18n.translate, luci.i18n.translatef

function fmt_neg(x)
	if type(x) == "string" then
		local v, neg = x:gsub("^ *! *", "")
		if neg > 0 then
			return v, "%s " % tr("not")
		else
			return x, ""
		end
	end
	return x, ""
end

function fmt_mac(x)
	if x and #x > 0 then
		local m, n
		local l = { tr("MAC"), " " }
		for m in ut.imatch(x) do
			m, n = fmt_neg(m)
			l[#l+1] = "<var>%s%s</var>" %{ n, m }
			l[#l+1] = ", "
		end
		if #l > 1 then
			l[#l] = nil
			if #l > 3 then
				l[1] = tr("MACs")
			end
			return table.concat(l, "")
		end
	end
end

function fmt_port(x)
	if x and #x > 0 then
		local p, n
		local l = { tr("port"), " " }
		for p in ut.imatch(x) do
			p, n = fmt_neg(p)
			local a, b = p:match("(%d+)%D+(%d+)")
			if a and b then
				l[1] = tr("ports")
				l[#l+1] = "<var>%s%d-%d</var>" %{ n, a, b }
			else
				l[#l+1] = "<var>%s%d</var>" %{ n, p }
			end
			l[#l+1] = ", "
		end
		if #l > 1 then
			l[#l] = nil
			if #l > 3 then
				l[1] = tr("ports")
			end
			return table.concat(l, "")
		end
	end
end

function fmt_ip(x)
	if x and #x > 0 then
		local l = { tr("IP"), " " }
		local v, a, n
		for v in ut.imatch(x) do
			v, n = fmt_neg(v)
			a, m = v:match("(%S+)/(%d+%.%S+)")
			a = a or v
			a = a:match(":") and ip.IPv6(a, m) or ip.IPv4(a, m)
			if a and (a:is6() or a:prefix() < 32) then
				l[1] = tr("IP range")
				l[#l+1] = "<var title='%s - %s'>%s%s</var>" %{
					a:minhost():string(),
					a:maxhost():string(),
					n, a:string()
				}
			else
				l[#l+1] = "<var>%s%s</var>" %{
					n,
					a and a:string() or v
				}
			end
			l[#l+1] = ", "
		end
		if #l > 1 then
			l[#l] = nil
			if #l > 3 then
				l[1] = tr("IPs")
			end
			return table.concat(l, "")
		end
	end
end

function fmt_zone(x)
	if x == "*" then
		return "<var>%s</var>" % tr("any zone")
	elseif x and #x > 0 then
		return "<var>%s</var>" % x
	end
end

function fmt_icmp_type(x)
	if x and #x > 0 then
		local t, v, n
		local l = { tr("type"), " " }
		for v in ut.imatch(x) do
			v, n = fmt_neg(v)
			l[#l+1] = "<var>%s%s</var>" %{ n, v }
			l[#l+1] = ", "
		end
		if #l > 1 then
			l[#l] = nil
			if #l > 3 then
				l[1] = tr("types")
			end
			return table.concat(l, "")
		end
	end
end

function fmt_proto(x, icmp_types)
	if x and #x > 0 then
		local v, n
		local l = { }
		local t = fmt_icmp_type(icmp_types)
		for v in ut.imatch(x) do
			v, n = fmt_neg(v)
			if v == "tcpudp" then
				l[#l+1] = "TCP"
				l[#l+1] = "UDP"
				l[#l+1] = ", "
			elseif v ~= "all" then
				local p = nx.getproto(v)
				if p then
					-- ICMP
					if (p.proto == 1 or p.proto == 58) and t then
						l[#l+1] = trf(
							"%s%s with %s",
							n, p.aliases[1] or p.name, t
						)
					else
						l[#l+1] = "%s%s" %{
							n,
							p.aliases[1] or p.name
						}
					end
					l[#l+1] = ", "
				end
			end
		end
		if #l > 0 then
			l[#l] = nil
			return table.concat(l, "")
		end
	end
end

function fmt_limit(limit, burst)
	burst = tonumber(burst)
	if limit and #limit > 0 then
		local l, u = limit:match("(%d+)/(%w+)")
		l = tonumber(l or limit)
		u = u or "second"
		if l then
			if u:match("^s") then
				u = tr("second")
			elseif u:match("^m") then
				u = tr("minute")
			elseif u:match("^h") then
				u = tr("hour")
			elseif u:match("^d") then
				u = tr("day")
			end
			if burst and burst > 0 then
				return trf("<var>%d</var> pkts. per <var>%s</var>, \
				    burst <var>%d</var> pkts.", l, u, burst)
			else
				return trf("<var>%d</var> pkts. per <var>%s</var>", l, u)
			end
		end
	end
end

function fmt_target(x)
	if x == "ACCEPT" then
		return tr("Accept")
	elseif x == "REJECT" then
		return tr("Refuse")
	elseif x == "NOTRACK" then
		return tr("Do not track")
	else --if x == "DROP" then
		return tr("Discard")
	end
end
