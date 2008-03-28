module("ffluci.controller.admin.wifi", package.seeall)

menu = {
	descr   = "Drahtlos",
	order   = 40,
	entries = {
		{action = "devices", descr = "Geräte"},
		{action = "networks", descr = "Netze"},
	}
}