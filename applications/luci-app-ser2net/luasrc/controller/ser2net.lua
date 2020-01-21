module("luci.controller.ser2net", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/ser2net") then
		return
	end

	entry({"admin", "services", "ser2net"}, firstchild(), "ser2net").dependent = true
	entry({"admin", "services", "ser2net", "settings"}, view("ser2net/settings"), _("Settings"), 1).leaf = false
	entry({"admin", "services", "ser2net", "proxies"}, view("ser2net/proxies"), _("Proxies"), 2).leaf = false
	entry({"admin", "services", "ser2net", "leds"}, view("ser2net/leds"), _("LEDs"), 3).leaf = false
end
