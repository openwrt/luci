module("luci.controller.splash.splash", package.seeall)

function index()
	entry({"admin", "services", "splash"}, cbi("splash/splash"), "Client-Splash")

	node("splash").target = call("action_dispatch")
	node("splash", "activate").target = call("action_activate")
	node("splash", "splash").target   = template("splash_splash/splash")
end

function action_dispatch()
	local mac = luci.sys.net.ip4mac(luci.http.getenv("REMOTE_ADDR")) or ""
	local status = luci.util.execl("luci-splash status "..mac)[1]
	if #mac > 0 and ( status == "whitelisted" or status == "lease" ) then
		luci.http.redirect(luci.dispatcher.build_url())
	else
		luci.http.redirect(luci.dispatcher.build_url("splash", "splash"))
	end
end

function action_activate()
	local mac = luci.sys.net.ip4mac(luci.http.getenv("REMOTE_ADDR"))
	if mac and luci.http.formvalue("accept") then
		os.execute("luci-splash add "..mac.." >/dev/null 2>&1")
		luci.http.redirect(luci.model.uci.cursor():get("freifunk", "community", "homepage"))
	else
		luci.http.redirect(luci.dispatcher.build_url())
	end
end
