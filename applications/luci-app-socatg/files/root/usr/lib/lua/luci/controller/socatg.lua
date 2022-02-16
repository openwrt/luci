module("luci.controller.socatg", package.seeall)

function index()
        entry({"admin", "network", "socatg"}, cbi("socatg"), _("SocatG"), 100)
        end