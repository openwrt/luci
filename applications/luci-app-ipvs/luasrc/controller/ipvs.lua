-- Copyright 2017 Mauro Mozzarelli <mauro@ezplanet.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.ipvs", package.seeall)

function index()
	entry({"admin", "network", "ipvs"}, cbi("ipvs/ipvs"), "VS Load Balancer", 30).dependent=false
	entry({"admin", "network", "ipvs", "real"},    cbi("ipvs/real"),    nil ).leaf = true
	entry({"admin", "network", "ipvs", "virtual"}, cbi("ipvs/virtual"), nil ).leaf = true
	entry({"admin", "status", "ipvs"}, template("ipvs"), _("VS Load Balancer"))
end

