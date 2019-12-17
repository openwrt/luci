module("luci.controller.yggdrasil", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/yggdrasil") then
		return
	end

	entry({"admin", "network", "yggdrasil"}, firstchild(), "Yggdrasil").dependent = true
	entry({"admin", "network", "yggdrasil", "status"}, view("yggdrasil/status"), _("Status"), 1).leaf = false

	entry({"admin", "network", "yggdrasil", "peers"}, view("yggdrasil/peers"), _("Peers"), 2).leaf = false
	entry({"admin", "network", "yggdrasil", "settings"}, view("yggdrasil/settings"), _("Settings"), 3).leaf = false
	entry({"admin", "network", "yggdrasil", "keys"}, view("yggdrasil/keys"), _("Encryption keys"), 4).leaf = false
	entry({"admin", "network", "yggdrasil", "session_firewall"}, view("yggdrasil/session_firewall"), _("Session firewall"), 5).leaf = false
	entry({"admin", "network", "yggdrasil", "tunnel_routing"}, view("yggdrasil/tunnel_routing"), _("Tunnel routing"), 6).leaf = false
end
