module("ffluci.controller.splash.splash", package.seeall)

function action_activate()
	local mac = ffluci.sys.net.ip4mac(ffluci.http.env.REMOTE_ADDR)
	if mac and ffluci.http.formvalue("accept") then
		os.execute("luci-splash add "..mac.." >/dev/null 2>&1")
		ffluci.http.redirect(ffluci.model.uci.get("freifunk", "community", "homepage"))
	else
		ffluci.http.redirect(ffluci.dispatcher.build_url())
	end
end

function action_accepted()
	ffluci.http.redirect(ffluci.dispatcher.build_url())
end

function action_unknown()
	ffluci.http.redirect(ffluci.dispatcher.build_url())
end