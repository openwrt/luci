-- Copyright 2018 Rosy Song <rosysong@rosinson.com>
-- Licensed to the public under the Apache License 2.0.

local fs = require "nixio.fs"
local ntm = require "luci.model.network".init()
local has_wifi =  ((fs.stat("/etc/config/wireless", "size") or 0) > 0)
local has_wan = false
local nurl = "complete"

for _, net in ipairs(ntm:get_networks()) do
	if net:name() == "wan" or net:name() == "wan6" then
		has_wan = true
		nurl = "internet"
		break
	end
end

if not has_wan and has_wifi then
	nurl = "wireless"
end

m = SimpleForm("setup-wizard", translate("Setup Wizard - Start"),
	translate("Setting parameters has never been so easy as it is now, this setup wizard will guide you set the basic parameters related to the network, click 'Next' to start it. If you want to set a specific function or parameter in detail, click the relevant column on the navigation bar."))
m.submit = translate("Next")
m.reset = false

function m.handle(self, state, data)
	if state == FORM_VALID then
		luci.http.redirect(luci.dispatcher.build_url("admin/system/setup-wizard/" .. nurl) .. "?fromurl=setup-wizard")
	end
	return true
end

return m
