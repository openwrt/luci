-- Copyright 2009 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.ff_p2pblock", package.seeall)

function index()
	entry({"admin", "network", "firewall", "p2pblock"}, cbi("luci_fw/p2pblock"),
		_("P2P-Block"), 40)
end
