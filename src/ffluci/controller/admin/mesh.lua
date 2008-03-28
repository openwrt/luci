module("ffluci.controller.admin.mesh", package.seeall)

menu = {
	descr   = "Mesh",
	order   = 50,
	entries = {
		{action = "olsrd", descr = "OLSR"},
	}
}