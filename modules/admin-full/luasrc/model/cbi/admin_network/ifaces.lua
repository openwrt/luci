--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs = require "nixio.fs"
local ut = require "luci.util"
local nw = require "luci.model.network"
local fw = require "luci.model.firewall"

arg[1] = arg[1] or ""

local has_dnsmasq  = fs.access("/etc/config/dhcp")
local has_firewall = fs.access("/etc/config/firewall")

local has_3g     = fs.access("/usr/bin/gcom")
local has_pptp   = fs.access("/usr/sbin/pptp")
local has_pppd   = fs.access("/usr/sbin/pppd")
local has_pppoe  = fs.glob("/usr/lib/pppd/*/rp-pppoe.so")()
local has_pppoa  = fs.glob("/usr/lib/pppd/*/pppoatm.so")()
local has_ipv6   = fs.access("/proc/net/ipv6_route")
local has_6in4   = fs.access("/lib/network/6in4.sh")
local has_6to4   = fs.access("/lib/network/6to4.sh")

m = Map("network", translate("Interfaces") .. " - " .. arg[1]:upper(), translate("On this page you can configure the network interfaces. You can bridge several interfaces by ticking the \"bridge interfaces\" field and enter the names of several network interfaces separated by spaces. You can also use <abbr title=\"Virtual Local Area Network\">VLAN</abbr> notation <samp>INTERFACE.VLANNR</samp> (<abbr title=\"for example\">e.g.</abbr>: <samp>eth0.1</samp>)."))
m:chain("wireless")

if has_firewall then
	m:chain("firewall")
end

nw.init(m.uci)
fw.init(m.uci)


local net = nw:get_network(arg[1])

-- redirect to overview page if network does not exist anymore (e.g. after a revert)
if not net then
	luci.http.redirect(luci.dispatcher.build_url("admin/network/network"))
	return
end

local ifc = net:get_interfaces()[1]

s = m:section(NamedSection, arg[1], "interface", translate("Common Configuration"))
s.addremove = false

s:tab("general", translate("General Setup"))
if has_ipv6  then s:tab("ipv6", translate("IPv6 Setup")) end
if has_pppd  then s:tab("ppp", translate("PPP Settings")) end
if has_pppoa then s:tab("atm", translate("ATM Settings")) end
if has_6in4 or has_6to4 then s:tab("tunnel", translate("Tunnel Settings")) end
s:tab("physical", translate("Physical Settings"))
if has_firewall then s:tab("firewall", translate("Firewall Settings")) end

st = s:taboption("general", DummyValue, "__status", translate("Status"))
st.template = "admin_network/iface_status"
st.network  = arg[1]

--[[
back = s:taboption("general", DummyValue, "_overview", translate("Overview"))
back.value = ""
back.titleref = luci.dispatcher.build_url("admin", "network", "network")
]]

p = s:taboption("general", ListValue, "proto", translate("Protocol"))
p.override_scheme = true
p.default = "static"
p:value("static", translate("static"))
p:value("dhcp", "DHCP")
if has_pppd  then p:value("ppp",   "PPP")     end
if has_pppoe then p:value("pppoe", "PPPoE")   end
if has_pppoa then p:value("pppoa", "PPPoA")   end
if has_3g    then p:value("3g",    "UMTS/3G") end
if has_pptp  then p:value("pptp",  "PPTP")    end
if has_6in4  then p:value("6in4",  "6in4")    end
if has_6to4  then p:value("6to4",  "6to4")    end
p:value("none", translate("none"))

if not ( has_pppd and has_pppoe and has_pppoa and has_3g and has_pptp ) then
	p.description = translate("You need to install \"comgt\" for UMTS/GPRS, \"ppp-mod-pppoe\" for PPPoE, \"ppp-mod-pppoa\" for PPPoA or \"pptp\" for PPtP support")
end

br = s:taboption("physical", Flag, "type", translate("Bridge interfaces"), translate("creates a bridge over specified interface(s)"))
br.enabled = "bridge"
br.rmempty = true
br:depends("proto", "static")
br:depends("proto", "dhcp")
br:depends("proto", "none")

stp = s:taboption("physical", Flag, "stp", translate("Enable <abbr title=\"Spanning Tree Protocol\">STP</abbr>"),
	translate("Enables the Spanning Tree Protocol on this bridge"))
stp:depends("type", "bridge")
stp.rmempty = true

ifname_single = s:taboption("physical", Value, "ifname_single", translate("Interface"))
ifname_single.template = "cbi/network_ifacelist"
ifname_single.widget = "radio"
ifname_single.nobridges = true
ifname_single.network = arg[1]
ifname_single.rmempty = true
ifname_single:depends({ type = "", proto = "static" })
ifname_single:depends({ type = "", proto = "dhcp"   })
ifname_single:depends({ type = "", proto = "pppoe"  })
ifname_single:depends({ type = "", proto = "pppoa"  })
ifname_single:depends({ type = "", proto = "none"   })

function ifname_single.cfgvalue(self, s)
	return self.map.uci:get("network", s, "ifname")
end

function ifname_single.write(self, s, val)
	local n = nw:get_network(s)
	if n then
		local i
		for _, i in ipairs(n:get_interfaces()) do
			n:del_interface(i)
		end

		for i in ut.imatch(val) do
			n:add_interface(i)

			-- if this is not a bridge, only assign first interface
			if self.option == "ifname_single" then
				break
			end
		end
	end
end

ifname_multi = s:taboption("physical", Value, "ifname_multi", translate("Interface"))
ifname_multi.template = "cbi/network_ifacelist"
ifname_multi.nobridges = true
ifname_multi.network = arg[1]
ifname_multi.widget = "checkbox"
ifname_multi:depends("type", "bridge")
ifname_multi.cfgvalue = ifname_single.cfgvalue
ifname_multi.write = ifname_single.write


if has_firewall then
	fwzone = s:taboption("firewall", Value, "_fwzone",
		translate("Create / Assign firewall-zone"),
		translate("Choose the firewall zone you want to assign to this interface. Select <em>unspecified</em> to remove the interface from the associated zone or fill out the <em>create</em> field to define a new zone and attach the interface to it."))

	fwzone.template = "cbi/firewall_zonelist"
	fwzone.network = arg[1]
	fwzone.rmempty = false

	function fwzone.cfgvalue(self, section)
		self.iface = section
		local z = fw:get_zone_by_network(section)
		return z and z:name()
	end

	function fwzone.write(self, section, value)
		local zone = fw:get_zone(value)

		if not zone and value == '-' then
			value = m:formvalue(self:cbid(section) .. ".newzone")
			if value and #value > 0 then
				zone = fw:add_zone(value)
			else
				fw:del_network(section)
			end
		end

		if zone then
			fw:del_network(section)
			zone:add_network(section)
		end
	end
end

ipaddr = s:taboption("general", Value, "ipaddr", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
ipaddr.optional = true
ipaddr.datatype = "ip4addr"
ipaddr:depends("proto", "static")

nm = s:taboption("general", Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"))
nm.optional = true
nm.datatype = "ip4addr"
nm:depends("proto", "static")
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s:taboption("general", Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))
gw.optional = true
gw.datatype = "ip4addr"
gw:depends("proto", "static")

bcast = s:taboption("general", Value, "bcast", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Broadcast"))
bcast.optional = true
bcast.datatype = "ip4addr"
bcast:depends("proto", "static")

if has_ipv6 then
	ip6addr = s:taboption("ipv6", Value, "ip6addr", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address"), translate("<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix"))
	ip6addr.optional = true
	ip6addr.datatype = "ip6addr"
	ip6addr:depends("proto", "static")
	ip6addr:depends("proto", "6in4")

	ip6gw = s:taboption("ipv6", Value, "ip6gw", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway"))
	ip6gw.optional = true
	ip6gw.datatype = "ip6addr"
	ip6gw:depends("proto", "static")
end

dns = s:taboption("general", DynamicList, "dns", translate("<abbr title=\"Domain Name System\">DNS</abbr>-Server"),
	translate("You can specify multiple DNS servers here, press enter to add a new entry. Servers entered here will override " ..
		"automatically assigned ones."))

dns.optional = true
dns.cast = "string"
dns.datatype = "ipaddr"
dns:depends({ peerdns = "", proto = "static" })
dns:depends({ peerdns = "", proto = "dhcp"   })
dns:depends({ peerdns = "", proto = "pppoe"  })
dns:depends({ peerdns = "", proto = "pppoa"  })
dns:depends({ peerdns = "", proto = "none"   })

mtu = s:taboption("physical", Value, "mtu", "MTU")
mtu.optional = true
mtu.datatype = "uinteger"
mtu.placeholder = 1500

srv = s:taboption("general", Value, "server", translate("<abbr title=\"Point-to-Point Tunneling Protocol\">PPTP</abbr>-Server"))
srv:depends("proto", "pptp")
srv.optional = false
srv.datatype = "ip4addr"

if has_6in4 then
	peer = s:taboption("general", Value, "peeraddr", translate("Server IPv4-Address"))
	peer.optional = false
	peer.datatype = "ip4addr"
	peer:depends("proto", "6in4")
end

if has_6in4 or has_6to4 then
	ttl = s:taboption("physical", Value, "ttl", translate("TTL"))
	ttl.default = "64"
	ttl.optional = true
	ttl.datatype = "uinteger"
	ttl:depends("proto", "6in4")
	ttl:depends("proto", "6to4")
end

if has_6to4 then
	advi = s:taboption("general", Value, "adv_interface", translate("Advertise IPv6 on network"))
	advi.widget = "checkbox"
	advi.exclude = arg[1]
	advi.default = "lan"
	advi.template = "cbi/network_netlist"
	advi.nocreate = true
	advi.nobridges = true
	advi:depends("proto", "6to4")

	advn = s:taboption("general", Value, "adv_subnet", translate("Advertised network ID"), translate("Allowed range is 1 to FFFF"))
	advn.default = "1"
	advn:depends("proto", "6to4")

	function advn.write(self, section, value)
		value = tonumber(value, 16) or 1

		if value > 65535 then value = 65535
		elseif value < 1 then value = 1 end

		Value.write(self, section, "%X" % value)
	end
end

mac = s:taboption("physical", Value, "macaddr", translate("<abbr title=\"Media Access Control\">MAC</abbr>-Address"))
mac:depends("proto", "none")
mac:depends("proto", "static")
mac:depends("proto", "dhcp")
mac.placeholder = ifc and ifc:mac():upper()

if has_3g then
	service = s:taboption("general", ListValue, "service", translate("Service type"))
	service:value("", translate("-- Please choose --"))
	service:value("umts", "UMTS/GPRS")
	service:value("cdma", "CDMA")
	service:value("evdo", "EV-DO")
	service:depends("proto", "3g")
	service.rmempty = true

	apn = s:taboption("general", Value, "apn", translate("Access point (APN)"))
	apn:depends("proto", "3g")

	pincode = s:taboption("general", Value, "pincode",
	 translate("PIN code"),
	 translate("Make sure that you provide the correct pin code here or you might lock your sim card!")
	)
	pincode:depends("proto", "3g")
end

if has_6in4 then
	tunid = s:taboption("general", Value, "tunnelid", translate("HE.net Tunnel ID"))
	tunid.optional = true
	tunid.datatype = "uinteger"
	tunid:depends("proto", "6in4")
end

if has_pppd or has_pppoe or has_pppoa or has_3g or has_pptp or has_6in4 then
	user = s:taboption("general", Value, "username", translate("Username"))
	user.rmempty = true
	user:depends("proto", "pptp")
	user:depends("proto", "pppoe")
	user:depends("proto", "pppoa")
	user:depends("proto", "ppp")
	user:depends("proto", "3g")
	user:depends("proto", "6in4")

	pass = s:taboption("general", Value, "password", translate("Password"))
	pass.rmempty = true
	pass.password = true
	pass:depends("proto", "pptp")
	pass:depends("proto", "pppoe")
	pass:depends("proto", "pppoa")
	pass:depends("proto", "ppp")
	pass:depends("proto", "3g")
	pass:depends("proto", "6in4")
end

if has_pppd or has_pppoe or has_pppoa or has_3g or has_pptp then
	ka = s:taboption("ppp", Value, "keepalive",
	 translate("Keep-Alive"),
	 translate("Number of failed connection tests to initiate automatic reconnect")
	)
	ka:depends("proto", "pptp")
	ka:depends("proto", "pppoe")
	ka:depends("proto", "pppoa")
	ka:depends("proto", "ppp")
	ka:depends("proto", "3g")

	demand = s:taboption("ppp", Value, "demand",
	 translate("Automatic Disconnect"),
	 translate("Time (in seconds) after which an unused connection will be closed")
	)
	demand.optional = true
	demand.datatype = "uinteger"
	demand:depends("proto", "pptp")
	demand:depends("proto", "pppoe")
	demand:depends("proto", "pppoa")
	demand:depends("proto", "ppp")
	demand:depends("proto", "3g")
end

if has_pppoa then
	encaps = s:taboption("atm", ListValue, "encaps", translate("PPPoA Encapsulation"))
	encaps:depends("proto", "pppoa")
	encaps:value("vc", "VC-Mux")
	encaps:value("llc", "LLC")

	atmdev = s:taboption("atm", Value, "atmdev", translate("ATM device number"))
	atmdev:depends("proto", "pppoa")
	atmdev.default = "0"
	atmdev.datatype = "uinteger"

	vci = s:taboption("atm", Value, "vci", translate("ATM Virtual Channel Identifier (VCI)"))
	vci:depends("proto", "pppoa")
	vci.default = "35"
	vci.datatype = "uinteger"

	vpi = s:taboption("atm", Value, "vpi", translate("ATM Virtual Path Identifier (VPI)"))
	vpi:depends("proto", "pppoa")
	vpi.default = "8"
	vpi.datatype = "uinteger"
end

if has_pptp or has_pppd or has_pppoe or has_pppoa or has_3g then
	device = s:taboption("general", Value, "device",
	 translate("Modem device"),
	 translate("The device node of your modem, e.g. /dev/ttyUSB0")
	)
	device:depends("proto", "ppp")
	device:depends("proto", "3g")

	defaultroute = s:taboption("ppp", Flag, "defaultroute",
	 translate("Replace default route"),
	 translate("Let pppd replace the current default route to use the PPP interface after successful connect")
	)
	defaultroute:depends("proto", "ppp")
	defaultroute:depends("proto", "pppoa")
	defaultroute:depends("proto", "pppoe")
	defaultroute:depends("proto", "pptp")
	defaultroute:depends("proto", "3g")
	defaultroute.rmempty = false
	function defaultroute.cfgvalue(...)
		return ( AbstractValue.cfgvalue(...) or '1' )
	end

	peerdns = s:taboption("ppp", Flag, "peerdns",
	 translate("Use peer DNS"),
	 translate("Configure the local DNS server to use the name servers adverticed by the PPP peer")
	)
	peerdns:depends("proto", "ppp")
	peerdns:depends("proto", "pppoa")
	peerdns:depends("proto", "pppoe")
	peerdns:depends("proto", "pptp")
	peerdns:depends("proto", "3g")
	peerdns.rmempty = false
	function peerdns.cfgvalue(...)
		return ( AbstractValue.cfgvalue(...) or '1' )
	end

	if has_ipv6 then
		ipv6 = s:taboption("ppp", Flag, "ipv6", translate("Enable IPv6 on PPP link") )
		ipv6:depends("proto", "ppp")
		ipv6:depends("proto", "pppoa")
		ipv6:depends("proto", "pppoe")
		ipv6:depends("proto", "pptp")
		ipv6:depends("proto", "3g")
	end

	connect = s:taboption("ppp", Value, "connect",
	 translate("Connect script"),
	 translate("Let pppd run this script after establishing the PPP link")
	)
	connect:depends("proto", "ppp")
	connect:depends("proto", "pppoe")
	connect:depends("proto", "pppoa")
	connect:depends("proto", "pptp")
	connect:depends("proto", "3g")

	disconnect = s:taboption("ppp", Value, "disconnect",
	 translate("Disconnect script"),
	 translate("Let pppd run this script before tearing down the PPP link")
	)
	disconnect:depends("proto", "ppp")
	disconnect:depends("proto", "pppoe")
	disconnect:depends("proto", "pppoa")
	disconnect:depends("proto", "pptp")
	disconnect:depends("proto", "3g")

	pppd_options = s:taboption("ppp", Value, "pppd_options",
	 translate("Additional pppd options"),
	 translate("Specify additional command line arguments for pppd here")
	)
	pppd_options:depends("proto", "ppp")
	pppd_options:depends("proto", "pppoa")
	pppd_options:depends("proto", "pppoe")
	pppd_options:depends("proto", "pptp")
	pppd_options:depends("proto", "3g")

	maxwait = s:taboption("ppp", Value, "maxwait",
	 translate("Setup wait time"),
	 translate("Seconds to wait for the modem to become ready before attempting to connect")
	)
	maxwait:depends("proto", "3g")
	maxwait.default  = "0"
	maxwait.optional = true
	maxwait.datatype = "uinteger"
end

s2 = m:section(TypedSection, "alias", translate("IP-Aliases"))
s2.addremove = true

s2:depends("interface", arg[1])
s2.defaults.interface = arg[1]

s2:tab("general", translate("General Setup"))
s2.defaults.proto = "static"

ip = s2:taboption("general", Value, "ipaddr", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Address"))
ip.optional = true
ip.datatype = "ip4addr"

nm = s2:taboption("general", Value, "netmask", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"))
nm.optional = true
nm.datatype = "ip4addr"
nm:value("255.255.255.0")
nm:value("255.255.0.0")
nm:value("255.0.0.0")

gw = s2:taboption("general", Value, "gateway", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Gateway"))
gw.optional = true
gw.datatype = "ip4addr"

if has_ipv6 then
	s2:tab("ipv6", translate("IPv6 Setup"))

	ip6 = s2:taboption("ipv6", Value, "ip6addr", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Address"), translate("<abbr title=\"Classless Inter-Domain Routing\">CIDR</abbr>-Notation: address/prefix"))
	ip6.optional = true
	ip6.datatype = "ip6addr"

	gw6 = s2:taboption("ipv6", Value, "ip6gw", translate("<abbr title=\"Internet Protocol Version 6\">IPv6</abbr>-Gateway"))
	gw6.optional = true
	gw6.datatype = "ip6addr"
end

s2:tab("advanced", translate("Advanced Settings"))

bcast = s2:taboption("advanced", Value, "bcast", translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Broadcast"))
bcast.optional = true
bcast.datatype = "ip4addr"

dns = s2:taboption("advanced", Value, "dns", translate("<abbr title=\"Domain Name System\">DNS</abbr>-Server"))
dns.optional = true
dns.datatype = "ip4addr"


--
-- Display DNS settings if dnsmasq is available
--

if has_dnsmasq then
	m2 = Map("dhcp", "", "")
	function m2.on_parse()
		local has_section = false

		m2.uci:foreach("dhcp", "dhcp", function(s)
			if s.interface == arg[1] then
				has_section = true
				return false
			end
		end)

		if not has_section then
			m2.uci:section("dhcp", "dhcp", nil, { interface = arg[1], ignore = "1" })
			m2.uci:save("dhcp")
		end
	end

	s = m2:section(TypedSection, "dhcp", translate("DHCP Server"))
	s.addremove = false
	s.anonymous = true
	s:tab("general",  translate("General Setup"))
	s:tab("advanced", translate("Advanced Settings"))

	function s.filter(self, section)
		return m2.uci:get("dhcp", section, "interface") == arg[1]
	end

	local ignore = s:taboption("general", Flag, "ignore",
		translate("Ignore interface"),
		translate("Disable <abbr title=\"Dynamic Host Configuration Protocol\">DHCP</abbr> for " ..
			"this interface."))

	ignore.rmempty = false

	local start = s:taboption("general", Value, "start", translate("Start"),
		translate("Lowest leased address as offset from the network address."))
	start.optional = true
	start.datatype = "uinteger"
	start.default = "100"

	local limit = s:taboption("general", Value, "limit", translate("Limit"),
		translate("Maximum number of leased addresses."))
	limit.optional = true
	limit.datatype = "uinteger"
	limit.default = "150"

	local ltime = s:taboption("general", Value, "leasetime", translate("Leasetime"),
		translate("Expiry time of leased addresses, minimum is 2 Minutes (<code>2m</code>)."))
	ltime.rmempty = true
	ltime.default = "12h"

	local dd = s:taboption("advanced", Flag, "dynamicdhcp",
		translate("Dynamic <abbr title=\"Dynamic Host Configuration Protocol\">DHCP</abbr>"),
		translate("Dynamically allocate DHCP addresses for clients. If disabled, only " ..
			"clients having static leases will be served."))

	dd.rmempty = false
	function dd.cfgvalue(self, section)
		return Flag.cfgvalue(self, section) or "1"
	end

	s:taboption("advanced", Flag, "force", translate("Force"),
		translate("Force DHCP on this network even if another server is detected."))

	-- XXX: is this actually useful?
	--s:taboption("advanced", Value, "name", translate("Name"),
	--	translate("Define a name for this network."))

	mask = s:taboption("advanced", Value, "netmask",
		translate("<abbr title=\"Internet Protocol Version 4\">IPv4</abbr>-Netmask"),
		translate("Override the netmask sent to clients. Normally it is calculated " ..
			"from the subnet that is served."))

	mask.optional = true
	mask.datatype = "ip4addr"

	s:taboption("advanced", DynamicList, "dhcp_option", translate("DHCP-Options"),
		translate("Define additional DHCP options, for example \"<code>6,192.168.2.1," ..
			"192.168.2.2</code>\" which advertises different DNS servers to clients."))

	for i, n in ipairs(s.children) do
		if n ~= ignore then
			n:depends("ignore", "")
		end
	end
end

return m, m2
