-- ToDo: Translate, Add descriptions and help texts
require("luci.sys")
m = Map("luci_fw", "Routing", [[An dieser Stelle wird festlegt, welcher Netzverkehr zwischen einzelnen
Schnittstellen erlaubt werden soll. Es werden jeweils nur neue Verbindungen
betrachtet, d.h. Pakete von aufgebauten oder zugehörigen Verbindungen werden automatisch in beide Richtungen
akzeptiert, auch wenn das Feld "beide Richtungen" nicht explizit gesetzt ist.
NAT ermöglicht Adressübersetzung.]])

s = m:section(TypedSection, "routing")
s.template  = "cbi/tblsection"
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "iface", "Eingang", "Eingangsschnittstelle")
oface = s:option(ListValue, "oface", "Ausgang", "Ausgangsschnittstelle")

for k, v in pairs(luci.model.uci.sections("network")) do
	if v[".type"] == "interface" and k ~= "loopback" then
		iface:value(k)
		oface:value(k)
	end
end

s:option(Flag, "fwd", "FWD", "weiterleiten").rmempty = true
s:option(Flag, "nat", "NAT", "übersetzen").rmempty = true
s:option(Flag, "bidi", "<->", "beide Richtungen").rmempty = true

return m
