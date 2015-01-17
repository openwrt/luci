-- Copyright 2011 Manuel Munz <freifunk at somakoma de>
-- Licensed to the public under the Apache License 2.0.

module "luci.controller.freifunk.policy-routing"

function index()
	entry({"admin", "freifunk", "policyrouting"}, cbi("freifunk/policyrouting"),
		_("Policy Routing"), 60)
end
