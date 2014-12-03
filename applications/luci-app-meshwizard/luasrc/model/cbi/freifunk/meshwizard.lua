-- wizard rewrite wip

local uci = require "luci.model.uci".cursor()
local sys = require "luci.sys"
local util = require "luci.util"
local ip = require "luci.ip"

local community = "profile_" .. (uci:get("freifunk", "community", "name") or "Freifunk")
local mesh_network = ip.IPv4(uci:get_first(community, "community", "mesh_network") or "10.0.0.0/8")
local community_ipv6 = uci:get_first(community, "community", "ipv6") or 0
local community_ipv6mode = uci:get_first(community, "community", "ipv6_config") or "static"
local meshkit_ipv6 = uci:get("meshwizard", "ipv6", "enabled") or 0
local community_vap = uci:get_first(community, "community", "vap") or 0

m = Map("meshwizard", translate("Wizard"), translate("This wizard will assist you in setting up your router for Freifunk " ..
	"or another similar wireless community network."))

n = m:section(NamedSection, "netconfig", nil, translate("Interfaces"))
n.anonymous = true

-- common functions

function cbi_configure(device)
	local configure = n:taboption(device, Flag, device .. "_config", translate("Configure this interface"),
		translate("Note: this will set up this interface for mesh operation, i.e. add it to zone 'freifunk' and enable olsr."))
end

function cbi_ip4addr(device)
	local ip4addr = n:taboption(device, Value, device .. "_ip4addr", translate("Mesh IP address"),
		translate("This is a unique address in the mesh (e.g. 10.1.1.1) and has to be registered at your local community."))
		ip4addr:depends(device .. "_config", 1)
		ip4addr.datatype = "ip4addr"
	function ip4addr.validate(self, value)
		local x = ip.IPv4(value)
		if mesh_network:contains(x) then
			return value
		else
			return nil, translate("The given IP address is not inside the mesh network range ") ..
			"(" .. mesh_network:string() .. ")."
		end
	end
end

function cbi_ip6addr(device)
	local ip6addr = n:taboption(device, Value, device .. "_ip6addr", translate("Mesh IPv6 address"),
		translate("This is a unique IPv6 address in CIDR notation (e.g. 2001:1:2:3::1/64) and has to be registered at your local community."))
		ip6addr:depends(device .. "_config", 1)
		ip6addr.datatype = "ip6addr"
end


function cbi_dhcp(device)
	local dhcp = n:taboption(device, Flag, device .. "_dhcp", translate("Enable DHCP"),
		translate("DHCP will automatically assign ip addresses to clients"))
	dhcp:depends(device .. "_config", 1)
	dhcp.rmempty = true
end

function cbi_ra(device)
	local ra = n:taboption(device, Flag, device .. "_ipv6ra", translate("Enable RA"),
		translate("Send router advertisements on this device."))
	ra:depends(device .. "_config", 1)
	ra.rmempty = true
end

function cbi_dhcprange(device)
	local dhcprange = n:taboption(device, Value, device .. "_dhcprange", translate("DHCP IP range"),
		translate("The IP range from which clients are assigned ip addresses (e.g. 10.1.2.1/28). " ..
		"If this is a range inside your mesh network range, then it will be announced as HNA. Any other range will use NAT. " ..
		"If left empty then the defaults from the community profile will be used."))
	dhcprange:depends(device .. "_dhcp", "1")
	dhcprange.rmempty = true
	dhcprange.datatype = "ip4addr"
end
-- create tabs and config for wireless
local nets={}
uci:foreach("wireless", "wifi-device", function(section)
        local device = section[".name"]
	table.insert(nets, device)
end)

local wired_nets = {}
uci:foreach("network", "interface", function(section)
	local device = section[".name"]
	if not util.contains(nets, device) and device ~= "loopback" and not device:find("wireless") then
		table.insert(nets, device)
		table.insert(wired_nets, device)
	end
end)

for _, net in util.spairs(nets, function(a,b) return (nets[a] < nets[b]) end) do
	n:tab(net, net)
end

-- create cbi config for wireless
uci:foreach("wireless", "wifi-device", function(section)
	local device = section[".name"]
	local hwtype = section.type
	local syscc = section.country or uci:get(community, "wifi_device", "country") or
		uci:get("freifunk", "wifi_device", "country")

	cbi_configure(device)

	-- Channel selection

	if hwtype == "atheros" then
		local cc = util.trim(sys.exec("grep -i '" .. syscc .. "' /lib/wifi/cc_translate.txt |cut -d ' ' -f 2")) or 0
		sys.exec('"echo " .. cc .. " > /proc/sys/dev/" .. device .. "/countrycode"')
	elseif hwtype == "mac80211" then
		sys.exec("iw reg set " .. syscc)
	elseif hwtype == "broadcom" then
		sys.exec ("wlc country " .. syscc)
	end

	local chan = n:taboption(device, ListValue, device .. "_channel", translate("Channel"),
		translate("Your device and neighbouring nodes have to use the same channel."))
	chan:depends(device .. "_config", 1)
	chan:value('default')

	local iwinfo = sys.wifi.getiwinfo(device)
	if iwinfo and iwinfo.freqlist then
		for _, f in ipairs(iwinfo.freqlist) do
			if not f.restricted then
				chan:value(f.channel)
			end
		end
	end
	-- IPv4 address
	cbi_ip4addr(device)

	-- DHCP enable
	cbi_dhcp(device)

	-- DHCP range
	cbi_dhcprange(device)

	-- IPv6 addr and RA
	if community_ipv6 == "1" then
		if community_ipv6mode == "static" then
			cbi_ip6addr(device)
		end
		cbi_ra(device)
	end

	-- Enable VAP
	local supports_vap = 0
	if sys.call("/usr/bin/meshwizard/helpers/supports_vap.sh " .. device .. " " .. hwtype) == 0 then
		supports_vap = 1
	end
	if supports_vap == 1 then
		local vap = n:taboption(device, Flag, device .. "_vap", translate("Virtual Access Point (VAP)"),
			translate("This will setup a new virtual wireless interface in Access Point mode."))
		vap:depends(device .. "_dhcp", "1")
                vap.rmempty = true
                if community_vap == "1" then
			vap.default = "1"
		end
	end
end)

for _, device in pairs(wired_nets) do
	cbi_configure(device)
	cbi_ip4addr(device)
	cbi_dhcp(device)
	cbi_dhcprange(device)
	-- IPv6 addr and RA
	if community_ipv6 == "1" then
		if community_ipv6mode == "static" then
			cbi_ip6addr(device)
		end
		cbi_ra(device)
	end
end

-- General settings
g = m:section(TypedSection, "general", translate("General Settings"))
g.anonymous = true

local cleanup = g:option(Flag, "cleanup", translate("Cleanup config"),
        translate("If this is selected then config is cleaned before setting new config options."))
cleanup.default = "1"

local restrict = g:option(Flag, "local_restrict", translate("Protect LAN"), 
	translate("Check this to protect your LAN from other nodes or clients") .. " (" .. translate("recommended") .. ").")

local share = g:option(Flag, "sharenet", translate("Share your internet connection"),
	translate("Select this to allow others to use your connection to access the internet."))
	share.rmempty = true

-- IPv6 config
if community_ipv6 == "1" then
	v6 = m:section(NamedSection, "ipv6", nil, translate("IPv6 Settings"))
	local enabled = v6:option(Flag, "enabled", translate("Enabled"),
        	translate("Activate or deactivate IPv6 config globally."))
	enabled.default = meshkit_ipv6
	enabled.rmempty = false
end

return m
