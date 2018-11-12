-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.index", package.seeall)

function index()
	function toplevel_page(page, preflookup, preftarget)
		if preflookup and preftarget then
			if lookup(preflookup) then
				page.target = preftarget
			end
		end

		if not page.target then
			page.target = firstchild()
		end
	end

	local uci = require("luci.model.uci").cursor()

	local root = node()
	if not root.target then
		root.target = alias("admin")
		root.index = true
	end

	local page   = node("admin")

	page.title   = _("Administration")
	page.order   = 10
	page.sysauth = "root"
	page.sysauth_authenticator = "htmlauth"
	page.ucidata = true
	page.index = true
	page.target = firstnode()

	-- Empty menu tree to be populated by addons and modules

	page = node("admin", "status")
	page.title = _("Status")
	page.order = 10
	page.index = true
	-- overview is from mod-admin-full
	toplevel_page(page, "admin/status/overview", alias("admin", "status", "overview"))

	page = node("admin", "system")
	page.title = _("System")
	page.order = 20
	page.index = true
	-- system/system is from mod-admin-full
	toplevel_page(page, "admin/system/system", alias("admin", "system", "system"))

	-- Only used if applications add items
	page = node("admin", "services")
	page.title = _("Services")
	page.order = 40
	page.index = true
	toplevel_page(page, false, false)

	-- Even for mod-admin-full network just uses first submenu item as landing
	page = node("admin", "network")
	page.title = _("Network")
	page.order = 50
	page.index = true
	toplevel_page(page, false, false)

	if nixio.fs.access("/etc/config/dhcp") then
		page = entry({"admin", "dhcplease_status"}, call("lease_status"), nil)
		page.leaf = true
	end

	local has_wifi = false

	uci:foreach("wireless", "wifi-device",
		function(s)
			has_wifi = true
			return false
		end)

	if has_wifi then
		page = entry({"admin", "wireless_assoclist"}, call("wifi_assoclist"), nil)
		page.leaf = true

		page = entry({"admin", "wireless_deauth"}, post("wifi_deauth"), nil)
		page.leaf = true
	end

	page = entry({"admin", "translations"}, call("action_translations"), nil)
	page.leaf = true

	-- Logout is last
	entry({"admin", "logout"}, call("action_logout"), _("Logout"), 999)
end

function action_logout()
	local dsp = require "luci.dispatcher"
	local utl = require "luci.util"
	local sid = dsp.context.authsession

	if sid then
		utl.ubus("session", "destroy", { ubus_rpc_session = sid })

		luci.http.header("Set-Cookie", "sysauth=%s; expires=%s; path=%s" %{
			'', 'Thu, 01 Jan 1970 01:00:00 GMT', dsp.build_url()
		})
	end

	luci.http.redirect(dsp.build_url())
end

function action_translations(lang)
	local i18n = require "luci.i18n"
	local http = require "luci.http"
	local fs = require "nixio".fs

	if lang and #lang > 0 then
		lang = i18n.setlanguage(lang)
		if lang then
			local s = fs.stat("%s/base.%s.lmo" %{ i18n.i18ndir, lang })
			if s then
				http.header("Cache-Control", "public, max-age=31536000")
				http.header("ETag", "%x-%x-%x" %{ s["ino"], s["size"], s["mtime"] })
			end
		end
	end

	http.prepare_content("application/javascript; charset=utf-8")
	http.write("window.TR=")
	http.write_json(i18n.dump())
end


function lease_status()
	local s = require "luci.tools.status"

	luci.http.prepare_content("application/json")
	luci.http.write('[')
	luci.http.write_json(s.dhcp_leases())
	luci.http.write(',')
	luci.http.write_json(s.dhcp6_leases())
	luci.http.write(']')
end

function wifi_assoclist()
	local s = require "luci.tools.status"

	luci.http.prepare_content("application/json")
	luci.http.write_json(s.wifi_assoclist())
end

function wifi_deauth()
	local iface = luci.http.formvalue("iface")
	local bssid = luci.http.formvalue("bssid")

	if iface and bssid then
		luci.util.ubus("hostapd.%s" % iface, "del_client", {
			addr = bssid,
			deauth = true,
			reason = 5,
			ban_time = 60000
		})
	end
	luci.http.status(200, "OK")
end
