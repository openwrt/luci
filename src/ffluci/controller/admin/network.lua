module(..., package.seeall)

menu = {
	descr   = "Netzwerk",
	order   = 30,
	entries = {
		{action = "vlan", descr = "Switch"},
		{action = "ifaces", descr = "Schnittstellen"},
		{action = "ptp", descr = "PPPoE / PPTP"},
		{action = "routes", descr = "Statische Routen"},
	}
}