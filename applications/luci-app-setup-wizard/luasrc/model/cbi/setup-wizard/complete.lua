-- Copyright 2018 Rosy Song <rosysong@rosinson.com>
-- Licensed to the public under the Apache License 2.0.

local uci = require "luci.model.uci".cursor()
--local fromurl = luci.http.formvalue("fromurl")
local has_wan_changes = luci.http.formvalue("has_wan_changes")
local has_wifi_changes = luci.http.formvalue("has_wifi_changes")

m = SimpleForm("setup-wizard", translate("Setup Wizard - Completion"),
	translate("Congratulation! Setup wizard is about to complete, click 'Complete' to apply your changes"))
--m.back = translate("Back")
--m.redirect = luci.dispatcher.build_url("admin/system/setup-wizard/" .. fromurl)
m.submit = translate("Complete")
m.reset = false

function m.handle(self, state, data)
	if state == FORM_VALID then
		if uci:changes() then
			uci:save("network")
			uci:save("wireless")
			uci:commit("network")
			uci:commit("wireless")
			luci.util.exec("/etc/init.d/network restart")
		end
		luci.http.redirect(luci.dispatcher.build_url("admin/status/overview"))
	end
	return true
end

return m
