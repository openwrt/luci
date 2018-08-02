-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2010-2015 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.uci", package.seeall)

function index()
	local redir = luci.http.formvalue("redir", true)
		or table.concat(luci.dispatcher.context.request, "/")

	entry({"admin", "uci"}, nil, _("Configuration"))
	entry({"admin", "uci", "changes"}, post_on({ trigger_apply = true }, "action_changes"), _("Changes"), 40).query = {redir=redir}
	entry({"admin", "uci", "revert"}, post("action_revert"), _("Revert"), 30).query = {redir=redir}

	local node
	local authen = function(checkpass, allowed_users)
		return "root", luci.http.formvalue("sid")
	end

	node = entry({"admin", "uci", "apply_rollback"}, post("action_apply_rollback"), nil)
	node.cors = true
	node.sysauth_authenticator = authen

	node = entry({"admin", "uci", "apply_unchecked"}, post("action_apply_unchecked"), nil)
	node.cors = true
	node.sysauth_authenticator = authen

	node = entry({"admin", "uci", "confirm"}, call("action_confirm"), nil)
	node.cors = true
	node.sysauth = false
end


function action_changes()
	local uci  = require "luci.model.uci"
	local changes = uci:changes()

	luci.template.render("admin_uci/changes", {
		changes       = next(changes) and changes,
		timeout       = timeout,
		trigger_apply = luci.http.formvalue("trigger_apply") and true or false
	})
end

function action_revert()
	local uci = require "luci.model.uci"
	local changes = uci:changes()

	-- Collect files to be reverted
	local r, tbl
	for r, tbl in pairs(changes) do
		uci:revert(r)
	end

	luci.template.render("admin_uci/revert", {
		changes        = next(changes) and changes,
		trigger_revert = true
	})
end


local function ubus_state_to_http(errstr)
	local map = {
		["Invalid command"]   = 400,
		["Invalid argument"]  = 400,
		["Method not found"]  = 404,
		["Entry not found"]   = 404,
		["No data"]           = 204,
		["Permission denied"] = 403,
		["Timeout"]           = 504,
		["Not supported"]     = 500,
		["Unknown error"]     = 500,
		["Connection failed"] = 503
	}

	local code = map[errstr] or 200
	local msg  = errstr      or "OK"

	luci.http.status(code, msg)

	if code ~= 204 then
		luci.http.prepare_content("text/plain")
		luci.http.write(msg)
	end
end

function action_apply_rollback()
	local uci = require "luci.model.uci"
	local token, errstr = uci:apply(true)
	if token then
		luci.http.prepare_content("application/json")
		luci.http.write_json({ token = token })
	else
		ubus_state_to_http(errstr)
	end
end

function action_apply_unchecked()
	local uci = require "luci.model.uci"
	local _, errstr = uci:apply(false)
	ubus_state_to_http(errstr)
end

function action_confirm()
	local uci = require "luci.model.uci"
	local token = luci.http.formvalue("token")
	local _, errstr = uci:confirm(token)
	ubus_state_to_http(errstr)
end
