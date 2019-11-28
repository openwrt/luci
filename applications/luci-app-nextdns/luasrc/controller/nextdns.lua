-- Copyright 2019 Olivier Poitrey (rs@nextdns.io)
-- This is free software, licensed under the Apache License, Version 2.0

module("luci.controller.nextdns", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/nextdns") then
		return
	end

	entry({"admin", "services", "nextdns"}, firstchild(), _("NextDNS"), 60).dependent = false
	entry({"admin", "services", "nextdns", "overview"}, view("nextdns/overview"), _("Overview"), 10).leaf = true
	entry({"admin", "services", "nextdns", "log"}, view("nextdns/logread"), _("Logs"), 30).leaf = true
end
