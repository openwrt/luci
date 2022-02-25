module("luci.controller.socatg", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/socatg") then
		return
	end

	entry({"admin", "network", "socatg"}, cbi("socatg"), _("SocatG"), 100).dependent = true
end
