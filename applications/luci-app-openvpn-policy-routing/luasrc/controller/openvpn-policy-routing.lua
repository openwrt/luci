module("luci.controller.openvpn-policy-routing", package.seeall)
function index()
	if not nixio.fs.access("/etc/config/openvpn-policy-routing") then
		return
	end
	entry({"admin", "services", "openvpn-policy-routing"}, cbi("openvpn-policy-routing"), _("OpenVPN Routing"))
end
