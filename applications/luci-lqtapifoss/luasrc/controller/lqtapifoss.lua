--[[
LuCI - Lua Configuration Interface

Copyright 2019 John Crispin <blogic@openwrt.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--

module("luci.controller.lqtapifoss", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/telephony") then
		return
	end

	local e

	e = entry({"admin", "telephony"}, template("luci_lqvoip/index") , _("VoIP"), 90)
	e.index = true
	e.i18n = "telephony"

	--entry({"admin", "telephony", "config"}, cbi("luci_lqvoip/config") , _("Config"), 10)
	entry({"admin", "telephony", "account"}, cbi("luci_lqvoip/account") , _("Account"), 20)
	entry({"admin", "telephony", "contact"}, cbi("luci_lqvoip/contact") , _("Contacts"), 30)
end
