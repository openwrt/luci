-- ToDo: Autodetect things, maybe use MultiValue instead, Translate, Add descriptions
m = Map("network", "VLAN", [[Die Netzwerkschnittstellen am Router
können zu verschienden VLANs zusammengefasst werden, in denen Geräte miteinander direkt
kommunizieren können. VLANs werden auch häufig dazu genutzt, um Netzwerke voneiander zu trennen.
So ist oftmals eine Schnittstelle als Uplink zu einem größerem Netz, wie dem Internet vorkonfiguriert
und die anderen Schnittstellen bilden ein VLAN für das lokale Netzwerk.]])

s = m:section(TypedSection, "switch", "", [[Die zu einem VLAN gehörenden Schnittstellen
werden durch Leerzeichen getrennt. Die Schnittstelle mit der höchsten Nummer (meistens 5) bildet
in der Regel die Verbindung zur internen Netzschnittstelle des Routers. Bei Geräten mit 5 Schnittstellen
ist in der Regel die Schnittstelle mit der niedrigsten Nummer (0) die standardmäßige Uplinkschnittstelle des Routers.]])

for i = 0, 15 do
	s:option(Value, "vlan"..i, "vlan"..i).optional = true
end

return m