-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011 Jo-Philipp Wich <jow@openwrt.org>
-- Copyright 2013 Manuel Munz <freifunk@somakoma.de>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.freifunk.diag", package.seeall)

function index()
	local uci = require("luci.model.uci").cursor()
	local page
	page = node("freifunk", "status", "diagnostics")
	page.target = template("freifunk/diagnostics")
	page.title  = _("Diagnostics")
	page.order  = 60

	page = entry({"freifunk", "status", "diag_ping"}, call("diag_ping"), nil)
	page.leaf = true

	page = entry({"freifunk", "status", "diag_nslookup"}, call("diag_nslookup"), nil)
	page.leaf = true

	page = entry({"freifunk", "status", "diag_traceroute"}, call("diag_traceroute"), nil)
	page.leaf = true

	page = entry({"freifunk", "status", "diag_ping6"}, call("diag_ping6"), nil)
	page.leaf = true

	page = entry({"freifunk", "status", "diag_traceroute6"}, call("diag_traceroute6"), nil)
	page.leaf = true
end

function diag_command(cmd, addr)
	if addr and addr:match("^[a-zA-Z0-9%-%.:_]+$") then
		luci.http.prepare_content("text/plain")

		local util = io.popen(cmd % addr)
		if util then
			while true do
				local ln = util:read("*l")
				if not ln then break end
				luci.http.write(ln)
				luci.http.write("\n")
			end

			util:close()
		end

		return
	end

	luci.http.status(500, "Bad address")
end

function diag_ping(addr)
	diag_command("ping -c 5 -W 1 %q 2>&1", addr)
end

function diag_traceroute(addr)
	diag_command("traceroute -q 1 -w 1 -n %q 2>&1", addr)
end

function diag_nslookup(addr)
	diag_command("nslookup %q 2>&1", addr)
end

function diag_ping6(addr)
	diag_command("ping6 -c 5 %q 2>&1", addr)
end

function diag_traceroute6(addr)
	diag_command("traceroute6 -q 1 -w 2 -n %q 2>&1", addr)
end
