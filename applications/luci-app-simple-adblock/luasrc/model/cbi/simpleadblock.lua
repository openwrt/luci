m = Map("simple-adblock", translate("Simple AdBlock Settings"), translate("Configuration of Simple AdBlock Settings"))
s = m:section(NamedSection, "config", "simple-adblock")

-- General options
o1 = s:option(Flag, "enabled", translate("Enable Simple AdBlock"))
o1.rmempty = false
o1.default = 0

o2 = s:option(ListValue, "verbosity", translate("Output Verbosity Setting"),translate("Controls system log and console output verbosity"))
o2:value("0", translate("Suppress output"))
o2:value("1", translate("Some output"))
o2:value("2", translate("Verbose output"))
o2.rmempty = false
o2.default = 2

o3 = s:option(ListValue, "force_dns", translate("Force Router DNS"), translate("Forces Router DNS use on local devices, also known as DNS Hijacking"))
o3:value("0", translate("Let local devices use their own DNS servers if set"))
o3:value("1", translate("Force Router DNS server to all local devices"))
o3.rmempty = false
o3.default = 1

-- Whitelisted Domains
d1 = s:option(DynamicList, "whitelist_domain", translate("Whitelisted Domains"), translate("Individual domains to be whitelisted"))
d1.addremove = true
d1.optional = true

-- Blacklisted Domains
d3 = s:option(DynamicList, "blacklist_domain", translate("Blacklisted Domains"), translate("Individual domains to be blacklisted"))
d3.addremove = true
d3.optional = true

-- Whitelisted Domains URLs
d2 = s:option(DynamicList, "whitelist_domains_url", translate("Whitelisted Domain URLs"), translate("URLs to lists of domains to be whitelisted"))
d2.addremove = true
d2.optional = true

-- Blacklisted Domains URLs
d4 = s:option(DynamicList, "blacklist_domains_url", translate("Blacklisted Domain URLs"), translate("URLs to lists of domains to be blacklisted"))
d4.addremove = true
d4.optional = true

-- Blacklisted Hosts URLs
d5 = s:option(DynamicList, "blacklist_hosts_url", translate("Blacklisted Hosts URLs"), translate("URLs to lists of hosts to be blacklisted"))
d5.addremove = true
d5.optional = true

return m

