-- Copyright 2011 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

local fs = require "nixio.fs"
local uci = require "luci.model.uci".cursor()
local community = uci:get("freifunk", "community", "name")

if community == nil then
        luci.http.redirect(luci.dispatcher.build_url("admin", "freifunk", "profile_error"))
        return
else
        community = "/etc/config/profile_" .. community
	f = SimpleForm("community", translate("Community profile"), translate("You can manually edit the selected community profile here."))

	t = f:field(TextValue, "cop")
	t.rmempty = true
	t.rows = 30
	function t.cfgvalue()
		return fs.readfile(community) or ""
	end

	function f.handle(self, state, data)
		if state == FORM_VALID then
			if data.cop then
				fs.writefile(community, data.cop:gsub("\r\n", "\n"))
			end
		end
		return true
	end
	return f
end

