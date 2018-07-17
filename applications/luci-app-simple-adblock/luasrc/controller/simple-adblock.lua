module("luci.controller.simple-adblock", package.seeall)
function index()
	if not nixio.fs.access("/etc/config/simple-adblock") then
		return
	end
	entry({"admin", "services", "simple-adblock"}, cbi("simple-adblock"), _("Simple AdBlock"))
end
