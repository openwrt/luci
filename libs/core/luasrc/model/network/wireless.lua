--[[
LuCI - Network model - Wireless extension

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

local pairs, i18n, uci = pairs, luci.i18n, luci.model.uci

local iwi = require "iwinfo"
local utl = require "luci.util"
local uct = require "luci.model.uci.bind"

module "luci.model.network.wireless"

local ub = uct.bind("wireless")
local st, ifs

function init(self, cursor)
	cursor:unload("wireless")
	cursor:load("wireless")
	ub:init(cursor)

	st = uci.cursor_state()
	ifs = { }

	local count = 0
		
	ub.uci:foreach("wireless", "wifi-iface",
		function(s)
			count = count + 1

			local device = s.device or "wlan0"
			local state = st:get_all("wireless", s['.name'])
			local name = device .. ".network" .. count
			
			ifs[name] = {
				idx      = count,
				name     = name,
				rawname  = state and state.ifname or name,
				flags    = { },
				ipaddrs  = { },
				ip6addrs = { },

				type     = "wifi",
				network  = s.network,
				handler  = self,
				wifi     = state or s,
				sid      = s['.name']
			}
		end)
end

function shortname(self, iface)
	if iface.dev and iface.dev.wifi then
		return "%s %q" %{
			i18n.translate("a_s_if_iwmode_" .. (iface.dev.wifi.mode or "ap")), 
			iface.dev.wifi.ssid or iface.dev.wifi.bssid or "(hidden)"
		}
	else
		return iface:name()
	end
end

function get_i18n(self, iface)
	if iface.dev and iface.dev.wifi then
		return "%s: %s %q" %{
			i18n.translate("Wireless Network"),
			i18n.translate("a_s_if_iwmode_" .. (iface.dev.wifi.mode or "ap"), iface.dev.wifi.mode or "AP"),
			iface.dev.wifi.ssid or iface.dev.wifi.bssid or "(hidden)"
		}
	else
		return "%s: %q" %{ i18n.translate("Wireless Network"), iface:name() }
	end
end

function rename_network(self, old, new)
	local i
	for i, _ in pairs(ifs) do
		if ifs[i].network == old then
			ifs[i].network = new
		end
	end

	ub.uci:foreach("wireless", "wifi-iface",
		function(s)
			if s.network == old then
				if new then 
					ub.uci:set("wireless", s['.name'], "network", new)
				else
					ub.uci:delete("wireless", s['.name'], "network")
				end
			end
		end)
end

function del_network(self, old)
	return self:rename_network(old, nil)
end

function find_interfaces(self, iflist, brlist)
	local iface
	for iface, _ in pairs(ifs) do
		iflist[iface] = ifs[iface]
	end
end

function ignore_interface(self, iface)
	if ifs and ifs[iface] then
		return false
	else
		return iwi.type(iface) and true or false
	end
end

function add_interface(self, net, iface)
	if ifs and ifs[iface] and ifs[iface].sid then
		ub.uci:set("wireless", ifs[iface].sid, "network", net:name())
		ifs[iface].network = net:name()
		return true
	end

	return false
end

function del_interface(self, net, iface)
	if ifs and ifs[iface] and ifs[iface].sid then
		ub.uci:delete("wireless", ifs[iface].sid, "network")
		--return true
	end

	return false
end

return _M

