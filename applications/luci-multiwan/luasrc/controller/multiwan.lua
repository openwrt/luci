module("luci.controller.multiwan", package.seeall)

function index()
    local fs = luci.fs or nixio.fs
    if not fs.access("/etc/config/multiwan") then
		return
	end
	
	local page = entry({"admin", "network", "multiwan"}, cbi("multiwan/multiwan"), "Multi-WAN")
	page.i18n = "multiwan"
	page.dependent = true

        local page = entry({"mini", "network", "multiwan"}, cbi("multiwan/multiwanmini", {autoapply=true}), "Multi-WAN")
        page.i18n = "multiwan"
        page.dependent = true


end
