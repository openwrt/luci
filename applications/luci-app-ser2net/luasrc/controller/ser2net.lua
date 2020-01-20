module("luci.controller.ser2net", package.seeall)

function index()
        entry({"admin", "services", "ser2net"}, alias("admin", "services", "ser2net", "config"), "ser2net").i18n = "ser2net"
        entry({"admin", "services", "ser2net", "config"}, cbi("ser2net"))
end

