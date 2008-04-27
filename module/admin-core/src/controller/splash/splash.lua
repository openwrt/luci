module("ffluci.controller.public.splash", package.seeall)

function action_activate()
	local mac = ffluci.sys.net.ip4mac(ffluci.http.remote_addr())
	os.execute("luci-splash add "..mac)
	ffluci.http.request_redirect()
end

function action_accepted()
	ffluci.http.request_redirect()
end

function action_unknown()
	ffluci.http.request_redirect()
end