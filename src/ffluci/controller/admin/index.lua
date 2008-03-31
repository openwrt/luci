module("ffluci.controller.admin.index", package.seeall)

menu = {
	descr   = "Übersicht",
	order   = 10,
	entries = {
		{action = "luci", descr = "FFLuCI"},
		{action = "contact", descr = "Kontakt"}
	}
}