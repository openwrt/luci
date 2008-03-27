module(..., package.seeall)

menu = {
	descr   = "Netzwerk",
	order   = 20,
	entries = {
		{action = "vlan", descr = "VLAN"},
		{action = "ifaces", descr = "Schnittstellen"},
		{action = "ptp", descr = "PPPoE / PPTP"},
	}
}