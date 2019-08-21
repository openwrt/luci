module("luci.controller.sysupgrade", package.seeall)

function index()
        entry({"admin", "system", "sysupgrade"}, template("sysupgrade"), _("Sysupgrade"), 1)
end
