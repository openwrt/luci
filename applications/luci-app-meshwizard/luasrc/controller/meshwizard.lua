-- Copyright 2011 Manuel Munz <freifunk somakoma de>
-- Licensed to the public under the Apache License 2.0.

module "luci.controller.meshwizard"

function index()
	entry({"admin", "freifunk", "meshwizard"}, cbi("freifunk/meshwizard"), _("Mesh Wizard"), 40)
end

