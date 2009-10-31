--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
m = Map("dhcp", "Dnsmasq",
	translate("Dnsmasq is a combined <abbr title=\"Dynamic Host Configuration Protocol" ..
		"\">DHCP</abbr>-Server and <abbr title=\"Domain Name System\">DNS</abbr>-" ..
		"Forwarder for <abbr title=\"Network Address Translation\">NAT</abbr> " ..
		"firewalls"))

s = m:section(TypedSection, "dnsmasq", translate("Settings"))
s.anonymous = true
s.addremove = false

s:option(Flag, "domainneeded",
	translate("Domain required"),
	translate("Don't forward <abbr title=\"Domain Name System\">DNS</abbr>-Requests without " ..
		"<abbr title=\"Domain Name System\">DNS</abbr>-Name"))

s:option(Flag, "authoritative",
	translate("Authoritative"),
	translate("This is the only <abbr title=\"Dynamic Host Configuration Protocol\">DHCP</" ..
		"abbr> in the local network"))

s:option(Flag, "boguspriv",
	translate("Filter private"),
	translate("Don't forward reverse lookups for local networks"))

s:option(Flag, "filterwin2k",
	translate("Filter useless"),
	translate("filter useless <abbr title=\"Domain Name System\">DNS</abbr>-queries of " ..
		"Windows-systems"))

s:option(Flag, "localise_queries",
	translate("Localise queries"),
	translate("localises the hostname depending on its subnet"))

s:option(Value, "local",
	translate("Local Server"))

s:option(Value, "domain",
	translate("Local Domain"))

s:option(Flag, "expandhosts",
	translate("Expand Hosts"),
	translate("adds domain names to hostentries in the resolv file"))

s:option(Flag, "nonegcache",
	translate("don't cache unknown"),
	translate("prevents caching of negative <abbr title=\"Domain Name System\">DNS</abbr>-" ..
		"replies"))

s:option(Flag, "readethers",
	translate("Use <code>/etc/ethers</code>"),
	translate("Read <code>/etc/ethers</code> to configure the <abbr title=\"Dynamic Host " ..
		"Configuration Protocol\">DHCP</abbr>-Server"))

s:option(Value, "leasefile",
	translate("Leasefile"),
	translate("file where given <abbr title=\"Dynamic Host Configuration Protocol\">DHCP</" ..
		"abbr>-leases will be stored"))

s:option(Value, "resolvfile",
	translate("Resolvfile"),
	translate("local <abbr title=\"Domain Name System\">DNS</abbr> file"))

s:option(Flag, "nohosts",
	translate("Ignore <code>/etc/hosts</code>")).optional = true

s:option(Flag, "strictorder",
	translate("Strict order"),
	translate("<abbr title=\"Domain Name System\">DNS</abbr>-Server will be queried in the " ..
		"order of the resolvfile")).optional = true

s:option(Flag, "logqueries",
	translate("Log queries")).optional = true

s:option(Flag, "noresolv",
	translate("Ignore resolve file")).optional = true

s:option(Value, "dnsforwardmax",
	translate("concurrent queries")).optional = true

s:option(Value, "port",
	translate("<abbr title=\"Domain Name System\">DNS</abbr>-Port")).optional = true

s:option(Value, "ednspacket_max",
	translate("<abbr title=\"maximal\">max.</abbr> <abbr title=\"Extension Mechanisms for " ..
		"Domain Name System\">EDNS0</abbr> paket size")).optional = true

s:option(Value, "dhcpleasemax",
	translate("<abbr title=\"maximal\">max.</abbr> <abbr title=\"Dynamic Host Configuration " ..
		"Protocol\">DHCP</abbr>-Leases")).optional = true

s:option(Value, "addnhosts",
	translate("additional hostfile")).optional = true

s:option(Value, "queryport",
	translate("query port")).optional = true

s:option(Flag, "enable_tftp",
	translate("Enable TFTP-Server")).optional = true

s:option(Value, "tftp_root",
	translate("TFTP-Server Root")).optional = true

s:option(Value, "dhcp_boot",
	translate("Network Boot Image")).optional = true

return m
