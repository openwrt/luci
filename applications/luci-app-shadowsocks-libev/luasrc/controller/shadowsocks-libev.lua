-- Copyright 2015 Jian Chang <aa65535@live.com>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.shadowsocks-libev", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/shadowsocks-libev") then
		return
	end

	entry({"admin", "services", "shadowsocks-libev"},
		alias("admin", "services", "shadowsocks-libev", "general"),
		_("ShadowSocks"), 10).dependent = true

	entry({"admin", "services", "shadowsocks-libev", "general"},
		cbi("shadowsocks-libev/general"),
		_("General Settings"), 10).leaf = true

	entry({"admin", "services", "shadowsocks-libev", "servers-manage"},
		cbi("shadowsocks-libev/servers-manage"),
		_("Servers Manage"), 20).leaf = true

	if luci.sys.call("command -v ss-redir >/dev/null") ~= 0 then
		return
	end

	entry({"admin", "services", "shadowsocks-libev", "access-control"},
		cbi("shadowsocks-libev/access-control"),
		_("Access Control"), 30).leaf = true
end
