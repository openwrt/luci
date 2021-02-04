-- stub lua controller for 19.07 backward compatibility

module("luci.controller.banip", package.seeall)

function index()
	entry({"admin", "services", "banip"}, firstchild(), _("banIP"), 60).acl_depends = { "luci-app-banip" }
	entry({"admin", "services", "banip", "overview"}, view("banip/overview"), _("Overview"), 10)
	entry({"admin", "services", "banip", "ipsetreport"}, view("banip/ipsetreport"), _("IPSet Report"), 20)
	entry({"admin", "services", "banip", "blacklist"}, view("banip/blacklist"), _("Edit Blacklist"), 30)
	entry({"admin", "services", "banip", "whitelist"}, view("banip/whitelist"), _("Edit Whitelist"), 40)
	entry({"admin", "services", "banip", "maclist"}, view("banip/maclist"), _("Edit Maclist"), 50)
	entry({"admin", "services", "banip", "logread"}, view("banip/logread"), _("Log View"), 60)
end
