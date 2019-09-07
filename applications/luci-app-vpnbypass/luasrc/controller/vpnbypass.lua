module("luci.controller.vpnbypass", package.seeall)
function index()
	if nixio.fs.access("/etc/config/vpnbypass") then
		if luci.dispatcher.lookup("admin/vpn") then
			entry({"admin", "vpn", "vpnbypass"}, cbi("vpnbypass"), _("VPN Bypass"))
		else
			entry({"admin", "services", "vpnbypass"}, cbi("vpnbypass"), _("VPN Bypass"))
		end
	end
end
