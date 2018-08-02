-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.index", package.seeall)

function index()
	local root = node()
	if not root.target then
		root.target = alias("admin")
		root.index = true
	end

	local page   = node("admin")
	if lookup("admin/status/overview") then
		page.target  = firstchild()
	else
		page.target = template("admin/admin_placeholder")
	end
	page.title   = _("Administration")
	page.order   = 10
	page.sysauth = "root"
	page.sysauth_authenticator = "htmlauth"
	page.ucidata = true
	page.index = true

	-- Empty menu tree to be populated by addons and modules

	-- overview is from mod-admin-full
	if lookup("admin/status/overview") then
		entry({"admin", "status"}, alias("admin/status/overview"), _("Status"), 10).index = true
	else
		entry({"admin", "status"}, firstchild(), _("Status"), 10).index = true
	end

	-- system/systme is from mod-admin-full
	if lookup("admin/system/system") then
		entry({"admin", "system"}, alias("admin/system/system"), _("System"), 20).index = true
	else
		entry({"admin", "system"}, firstchild(), _("System"), 20).index = true
	end
	-- Only used if applications add items
	entry({"admin", "services"}, firstchild(), _("Services"), 40).index = true

	-- Even for mod-admin-full network just users first submenu item as landing
	entry({"admin", "network"}, firstchild(), _("Network"), 50).index = true

	-- Logout is last
	entry({"admin", "logout"}, call("action_logout"), _("Logout"), 90)
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
