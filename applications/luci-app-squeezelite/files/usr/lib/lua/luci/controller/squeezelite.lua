module("luci.controller.squeezelite", package.seeall)

function index()
	entry({"admin", "services", "squeezelite"}, firstchild(), "Squeezelite", 60)
	entry({"admin", "services", "squeezelite", "config"}, cbi("squeezelite"), "Configure", 1)
	entry({"admin", "services", "squeezelite", "info"}, template("squeezelite"), "Info", 2)
end
