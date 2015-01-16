-- Copyright 2011 Manuel Munz <freifunk somakoma de>
-- Licensed to the public under the Apache License 2.0.

module "luci.controller.wshaper"

function index()
	entry({"admin", "network", "wshaper"}, cbi("wshaper"), _("Wondershaper"), 80)
end

