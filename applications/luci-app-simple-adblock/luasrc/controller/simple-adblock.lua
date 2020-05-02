module("luci.controller.simple-adblock", package.seeall)
function index()
	if nixio.fs.access("/etc/config/simple-adblock") then
		entry({"admin", "services", "simple-adblock"}, cbi("simple-adblock"), _("Simple AdBlock")).acl_depends = { "luci-app-simple-adblock" }
		entry({"admin", "services", "simple-adblock", "action"}, call("simple_adblock_action"), nil).leaf = true
	end
end

function simple_adblock_action(name)
	local packageName = "simple-adblock"
	if name == "start" then
		luci.sys.init.start(packageName)
	elseif name == "action" then
		luci.util.exec("/etc/init.d/" .. packageName .. " dl >/dev/null 2>&1")
	elseif name == "stop" then
		luci.sys.init.stop(packageName)
	elseif name == "enable" then
		luci.util.exec("uci set " .. packageName .. ".config.enabled=1; uci commit " .. packageName)
	elseif name == "disable" then
		luci.util.exec("uci set " .. packageName .. ".config.enabled=0; uci commit " .. packageName)
	end
	luci.http.prepare_content("text/plain")
	luci.http.write("0")
end
