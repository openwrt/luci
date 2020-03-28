-- stub lua controller for 19.07 backward compatibility

module("luci.controller.adblock", package.seeall)

function index()
	entry({"admin", "services", "adblock"}, firstchild(), _("Adblock"), 60)
	entry({"admin", "services", "adblock", "overview"}, view("adblock/overview"), _("Overview"), 10)
	entry({"admin", "services", "adblock", "dnsreport"}, view("adblock/dnsreport"), _("DNS Report"), 20)
	entry({"admin", "services", "adblock", "blacklist"}, view("adblock/blacklist"), _("Edit Blacklist"), 30)
	entry({"admin", "services", "adblock", "whitelist"}, view("adblock/whitelist"), _("Edit Whitelist"), 40)
	entry({"admin", "services", "adblock", "logread"}, view("adblock/logread"), _("Log View"), 50)
end
