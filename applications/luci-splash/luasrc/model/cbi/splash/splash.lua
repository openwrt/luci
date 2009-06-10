-- ToDo: Translate, Add descriptions and help texts
require("luci.model.uci")

m = Map("luci_splash", "Client-Splash", [[Client-Splash ist das Freifunk Hotspot-Authentifizierungs-System.]])

s = m:section(NamedSection, "general", "core", "Allgemein")
s:option(Value, "leasetime", "Freigabezeit", "h")

s:option(Value, "limit_up", "Upload-Limitierung", "Kilobit/s - limitiert die Upload-Geschwindigkeit von Clients")
s:option(Value, "limit_down", "Download-Limitierung", "Kilobit/s - limitiert die Download-Geschwindigkeit von Clients")

s:option(DummyValue, "_tmp", "",
	"Bandbreitenlimitierung für Clients wird aktiviert wenn sowohl Up- als auch " ..
	"Download-Geschwindigkeit angegeben werden. Auf 0 setzen um die Limitierung zu deaktivieren. " ..
	"Clients in der Whitelist werden nicht limitiert.")

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
