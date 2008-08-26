-- ToDo: Translate, Add descriptions and help texts
require("luci.model.uci")

m = Map("luci_splash", "Client-Splash", [[Client-Splash ist das Freifunk Hotspot-Authentifizierungs-System.]])

s = m:section(NamedSection, "general", "core", "Allgemein")
s:option(Value, "leasetime", "Freigabezeit", "h")

s = m:section(TypedSection, "iface", "Schnittstellen")
s.template = "cbi/tblsection"
s.addremove = true
s.anonymous = true

local uci = luci.model.uci.cursor()

zone = s:option(ListValue, "zone", "Firewallzone")
uci:foreach("firewall", "zone",
	function (section)
		zone:value(section.name)
	end)
	
iface = s:option(ListValue, "network", "Netzwerk")
uci:foreach("network", "interface",
	function (section)
		if section[".name"] ~= "loopback" then
			iface:value(section[".name"])
		end
	end)
	
uci:foreach("network", "alias",
	function (section)
		iface:value(section[".name"])
	end)

s = m:section(TypedSection, "whitelist", "Automatische Freigabe")
s.template = "cbi/tblsection"
s.addremove = true
s.anonymous = true
s:option(Value, "mac", "MAC-Adresse")

s = m:section(TypedSection, "blacklist", "Automatische Sperrung")
s.template = "cbi/tblsection"
s.addremove = true
s.anonymous = true
s:option(Value, "mac", "MAC-Adresse")
	
return m