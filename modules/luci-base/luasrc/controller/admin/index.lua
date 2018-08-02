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
	toplevel_page(page, "admin/status/overview", alias("admin", "status"))

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

	-- Logout is last
	entry({"admin", "logout"}, call("action_logout"), _("Logout"), 999)
end

function action_logout()
	local dsp = require "luci.dispatcher"
	local utl = require "luci.util"
	local sid = dsp.context.authsession

	if sid then
		utl.ubus("session", "destroy", { ubus_rpc_session = sid })

		luci.http.header("Set-Cookie", "sysauth=%s; expires=%s; path=%s/" %{
			sid, 'Thu, 01 Jan 1970 01:00:00 GMT', dsp.build_url()
		})
	end

	luci.http.redirect(dsp.build_url())
end
