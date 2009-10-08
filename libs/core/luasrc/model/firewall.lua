--[[
LuCI - Firewall model

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

]]--

local type, pairs, ipairs, table, luci, math
	= type, pairs, ipairs, table, luci, math

local lmo = require "lmo"
local utl = require "luci.util"
local uct = require "luci.model.uci.bind"

module "luci.model.firewall"


local ub = uct.bind("firewall")

function init(cursor)
	if cursor then
		cursor:unload("firewall")
		cursor:load("firewall")
		ub:init(cursor)
	end
end

function add_zone(n)
	if n then
		local z = ub.uci:section("firewall", "zone", nil, {
			name    = n,
			network = " ",
			input   = defaults:input()   or "DROP",
			forward = defaults:forward() or "DROP",
			output  = defaults:output()  or "DROP"
		})

		return z and zone(z)
	end
end

function get_zone(n)
	local z
	ub.uci:foreach("firewall", "zone",
		function(s)
			if n and s.name == n then
				z = s['.name']
				return false
			end
		end)
	return z and zone(z)
end

function get_zones()
	local zones = { }
	ub.uci:foreach("firewall", "zone",
		function(s)
			if s.name then
				zones[#zones+1] = zone(s['.name'])
			end
		end)
	return zones
end

function get_zones_by_network(net)
	local zones = { }
	ub.uci:foreach("firewall", "zone",
		function(s)
			if s.name then
				local n
				for _, n in ipairs(ub:list(s.network or s.name)) do
					if n == net then
						zones[#zones+1] = zone(s['.name'])
						return true
					end
				end
			end
		end)
	return zones
end

function del_zone(n)
	local r = false
	ub.uci:foreach("firewall", "zone",
		function(s)
			if n and s.name == n then
				r = ub.uci:delete("firewall", s['.name'])
				return false
			end
		end)
	if r then
		ub.uci:foreach("firewall", "rule",
			function(s)
				if s.src == n or s.dest == n then
					ub.uci:delete("firewall", s['.name'])
				end
			end)
		ub.uci:foreach("firewall", "redirect",
			function(s)
				if s.src == n then
					ub.uci:delete("firewall", s['.name'])
				end
			end)
		ub.uci:foreach("firewall", "forwarding",
			function(s)
				if s.src == n then
					ub.uci:delete("firewall", s['.name'])
				end
			end)
	end
	return r
end

function del_network(net)
	local z
	if net then
		for _, z in ipairs(get_zones()) do
			z:del_network(net)
		end
	end
end


defaults = ub:usection("defaults")
defaults:property_bool("syn_flood")
defaults:property_bool("drop_invalid")
defaults:property("input")
defaults:property("forward")
defaults:property("output")


zone = ub:section("zone")
zone:property_bool("masq")
zone:property("name")
zone:property("network")
zone:property("input")
zone:property("forward")
zone:property("output")

function zone.add_network(self, net)
	if ub.uci:get("network", net) == "interface" then
		local networks = ub:list(self:network() or self:name(), net)
		if #networks > 0 then
			self:network(table.concat(networks, " "))
		else
			self:network(" ")
		end
	end
end

function zone.del_network(self, net)
	local networks = ub:list(self:network() or self:name(), nil, net)
	if #networks > 0 then
		self:network(table.concat(networks, " "))
	else
		self:network(" ")
	end
end

function zone.get_networks(self)
	return ub:list(self:network() or self:name())
end

function zone.get_forwardings_by(self, what)
	local name = self:name()
	local forwards = { }
	ub.uci:foreach("firewall", "forwarding",
		function(s)
			if s.src and s.dest and s[what] == name then
				forwards[#forwards+1] = forwarding(s['.name'])
			end
		end)
	return forwards
end

function zone.add_forwarding_to(self, dest, with_mtu_fix)
	local exist, forward
	for _, forward in ipairs(self:get_forwardings_by('src')) do
		if forward:dest() == dest then
			exist = true
			break
		end
	end
	if not exist and dest ~= self:name() then
		local s = ub.uci:section("firewall", "forwarding", nil, {
			src     = self:name(),
			dest    = dest,
			mtu_fix = with_mtu_fix and true or false
		})
		return s and forwarding(s)
	end
end

function zone.add_forwarding_from(self, src, with_mtu_fix)
	local exist, forward
	for _, forward in ipairs(self:get_forwardings_by('dest')) do
		if forward:src() == src then
			exist = true
			break
		end
	end
	if not exist and src ~= self:name() then
		local s = ub.uci:section("firewall", "forwarding", nil, {
			src     = src,
			dest    = self:name(),
			mtu_fix = with_mtu_fix and true or false
		})
		return s and forwarding(s)
	end
end

function zone.add_redirect(self, options)
	options = options or { }
	options.src = self:name()
	local s = ub.uci:section("firewall", "redirect", nil, options)
	return s and redirect(s)
end

function zone.add_rule(self, options)
	options = options or { }
	options.src = self:name()
	local s = ub.uci:section("firewall", "rule", nil, options)
	return s and rule(s)
end

function zone.get_color(self)
	if self and self:name() == "lan" then
		return "#90f090"
	elseif self and self:name() == "wan" then
		return "#f09090"
	elseif self then
		math.randomseed(lmo.hash(self:name()))

		local r   = math.random(128)
		local g   = math.random(128)
		local min = 0
		local max = 128

		if ( r + g ) < 128 then
			min = 128 - r - g
		else
			max = 255 - r - g
		end

		local b = min + math.floor( math.random() * ( max - min ) )

		return "#%02x%02x%02x" % { 0xFF - r, 0xFF - g, 0xFF - b }
	else
		return "#eeeeee"
	end
end


forwarding = ub:section("forwarding")
forwarding:property_bool("mtu_fix")
forwarding:property("src")
forwarding:property("dest")

function forwarding.src_zone(self)
	return zone(self:src())
end

function forwarding.dest_zone(self)
	return zone(self:dest())
end


rule = ub:section("rule")
rule:property("src")
rule:property("src_ip")
rule:property("src_mac")
rule:property("src_port")
rule:property("dest")
rule:property("dest_ip")
rule:property("dest_port")
rule:property("proto")
rule:property("target")

function rule.src_zone(self)
	return zone(self:src())
end


redirect = ub:section("redirect")
redirect:property("src")
redirect:property("src_ip")
redirect:property("src_mac")
redirect:property("src_port")
redirect:property("src_dport")
redirect:property("dest_ip")
redirect:property("dest_port")
redirect:property("proto")

function redirect.src_zone(self)
	return zone(self:src())
end

