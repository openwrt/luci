module("luci.controller.splash.splash", package.seeall)

function index()
	local page = node("admin", "services", "splash")
	page.target = cbi("splash/splash")
	page.title  = "Client-Splash"

	node("splash", "splash", "activate").target = call("action_activate")
	node("splash", "splash", "allowed").target  = call("action_allowed")
	node("splash", "splash", "unknown").target  = call("action_unknown")
	node("splash", "splash", "splash").target   = template("splash_splash/splash")
end

function action_activate()
	local mac = luci.sys.net.ip4mac(luci.http.env.REMOTE_ADDR)
	if mac and luci.http.formvalue("accept") then
		os.execute("luci-splash add "..mac.." >/dev/null 2>&1")
		luci.http.redirect(luci.model.uci.get("freifunk", "community", "homepage"))
	else
		luci.http.redirect(luci.dispatcher.build_url())
	end
end

function action_allowed()
	luci.http.redirect(luci.dispatcher.build_url())
end

function action_unknown()
	luci.http.redirect(luci.dispatcher.build_url())
end