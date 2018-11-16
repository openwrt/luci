-- Copyright 2018 Rosy Song <rosysong@rosinson.com>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.setup-wizard.setup-wizard", package.seeall)

function index()
	entry({"admin", "system", "setup-wizard"}, form("setup-wizard/setup-wizard"),
		_("Setup Wizard"), 3)
	entry({"admin", "system", "setup-wizard", "internet"}, form("setup-wizard/internet"),
		_("Internet Access"), 10).leaf = true
	entry({"admin", "system", "setup-wizard", "wireless"}, form("setup-wizard/wireless"),
		_("WiFi Configuration"), 20).leaf = true
	entry({"admin", "system", "setup-wizard", "complete"}, form("setup-wizard/complete"),
		_("Completion"), 30).leaf = true
end
