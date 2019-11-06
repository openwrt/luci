-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008 Jo-Philipp Wich <jow@openwrt.org>
-- Copyright 2013 Manuel Munz <freifunk at somakoma dot de>
-- Copyright 2014-2018 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.ddns", package.seeall)

function index()
	entry( {"admin", "services", "ddns"}, view("ddns/overview"), _("Dynamic DNS"), 59)
end
