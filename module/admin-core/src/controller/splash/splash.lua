module("ffluci.controller.splash.splash", package.seeall)

function action_activate()
	local mac = ffluci.sys.net.ip4mac(ffluci.http.remote_addr())
	if mac and ffluci.http.formvalue("accept") then
		os.execute("luci-splash add "..mac.." >/dev/null 2>&1")
		ffluci.http.redirect(ffluci.model.uci.get("freifunk", "community", "homepage"))
	else
		ffluci.http.request_redirect()
	end
end

function action_accepted()
	ffluci.http.request_redirect()
end

function action_unknown()
	ffluci.http.request_redirect()
end