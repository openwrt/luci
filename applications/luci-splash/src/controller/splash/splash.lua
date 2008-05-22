module("ffluci.controller.splash.splash", package.seeall)

function index()
	local page = node("admin", "services", "splash")
	page.target = cbi("splash/splash")
	page.title  = "Client-Splash"

	node("splash", "splash", "activate").target = action_activate
	node("splash", "splash", "allowed").target  = action_allowed
	node("splash", "splash", "unknown").target  = action_unknown
	node("splash", "splash", "splash").target   = template("splash_splash/splash")
end

function action_activate()
	local mac = ffluci.sys.net.ip4mac(ffluci.http.env.REMOTE_ADDR)
	if mac and ffluci.http.formvalue("accept") then
		os.execute("luci-splash add "..mac.." >/dev/null 2>&1")
		ffluci.http.redirect(ffluci.model.uci.get("freifunk", "community", "homepage"))
	else
		ffluci.http.redirect(ffluci.dispatcher.build_url())
	end
end

function action_allowed()
	ffluci.http.redirect(ffluci.dispatcher.build_url())
end

function action_unknown()
	ffluci.http.redirect(ffluci.dispatcher.build_url())
end