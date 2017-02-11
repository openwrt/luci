m = Map("vpnbypass", translate("VPN Bypass Settings"), translate("Configuration of VPN Bypass Settings"))
s = m:section(NamedSection, "config", "vpnbypass")

-- General options
o1 = s:option(Flag, "enabled", translate("Enable VPN Bypass"))
o1.rmempty = false
o1.default = 0

-- Local Ports
p1 = s:option(DynamicList, "localport", translate("Local Ports to Bypass"), translate("Local ports to trigger VPN Bypass"))
p1.addremove = true
p1.optional = true

-- Remote Ports
p2 = s:option(DynamicList, "remoteport", translate("Remote Ports to Bypass"), translate("Remote ports to trigger VPN Bypass"))
p2.addremove = true
p2.optional = true

-- Local Subnets
r1 = s:option(DynamicList, "localsubnet", translate("Local IP Subnets to Bypass"), translate("Local IP ranges with direct internet access (outside of the VPN tunnel)"))
r1.addremove = true
r1.optional = true

-- Remote Subnets
r2 = s:option(DynamicList, "remotesubnet", translate("Remote IP Subnets to Bypass"), translate("Remote IP ranges which will be accessed directly (outside of the VPN tunnel)"))
r2.addremove = true
r2.optional = true

-- Domains
d1 = s:option(DynamicList, "domain", translate("Domains to Bypass"), translate("Domains which will be accessed directly (outside of the VPN tunnel)"))
d1.addremove = true
d1.optional = true

return m

