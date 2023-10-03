module("luci.controller.usteer", package.seeall)

function index()
    entry({ "admin", "network", "usteer_status" }, cbi("usteer/usteer_status"), "Usteer status", 70)

end
