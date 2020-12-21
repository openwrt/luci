module("luci.controller.https-dns-proxy", package.seeall)
function index()
	if nixio.fs.access("/etc/config/https-dns-proxy") then
		entry({"admin", "services", "https-dns-proxy"}, cbi("https-dns-proxy"), _("DNS HTTPS Proxy")).acl_depends = { "luci-app-https-dns-proxy" }
		entry({"admin", "services", "https-dns-proxy", "action"}, call("https_dns_proxy_action"), nil).leaf = true
	end
end

function https_dns_proxy_action(name)
	local packageName = "https-dns-proxy"
	local http = require "luci.http"
	local sys = require "luci.sys"
	local util = require "luci.util"
	if name == "start" then
		sys.init.start(packageName)
	elseif name == "action" then
		util.exec("/etc/init.d/" .. packageName .. " reload >/dev/null 2>&1")
	elseif name == "stop" then
		sys.init.stop(packageName)
	elseif name == "enable" then
		sys.init.enable(packageName)
	elseif name == "disable" then
		sys.init.disable(packageName)
	end
	http.prepare_content("text/plain")
	http.write("0")
end
