module("luci.controller.splash.splash", package.seeall)

function index()
	entry({"admin", "services", "splash"}, cbi("splash/splash"), "Client-Splash")

	node("splash").target = call("action_dispatch")
	node("splash", "activate").target = call("action_activate")
	node("splash", "splash").target   = template("splash_splash/splash")

	entry({"admin", "status", "splash"}, call("action_status_admin"), "Client-Splash")
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
	local ip = luci.http.getenv("REMOTE_ADDR") or "127.0.0.1"
	local mac = luci.sys.net.ip4mac(ip:match("^[\[::ffff:]*(%d+.%d+%.%d+%.%d+)\]*$"))
	if mac and luci.http.formvalue("accept") then
		os.execute("luci-splash add "..mac.." >/dev/null 2>&1")
		luci.http.redirect(luci.model.uci.cursor():get("freifunk", "community", "homepage"))
	else
		luci.http.redirect(luci.dispatcher.build_url())
	end
end

function action_status_admin()
	local uci = luci.model.uci.cursor_state()
	local macs = luci.http.formvaluetable("save")

	local function delete_mac(what, mac)
		uci:delete_all("luci_splash", what,
			function(s)
				return ( s.mac and s.mac:lower() == mac )
			end)
	end

	local function leases(mac)
		local leases = { }

		uci:foreach("luci_splash", "lease", function(s)
			if s.start and s.mac and s.mac:lower() ~= mac then
				leases[#leases+1] = {
					start = s.start,
					mac   = s.mac
				}
			end
		end)

		uci:revert("luci_splash")

		return leases
	end

	local function commit(leases, no_commit)
		if not no_commit then
			uci:save("luci_splash")
			uci:commit("luci_splash")
		end

		for _, l in ipairs(leases) do
			uci:section("luci_splash", "lease", nil, l)
		end

		uci:save("luci_splash")
		os.execute("/etc/init.d/luci_splash restart")
	end

	for key, _ in pairs(macs) do
		local policy = luci.http.formvalue("policy.%s" % key)
		local mac    = luci.http.protocol.urldecode(key)
		local lslist = leases(policy ~= "kick" and mac)

		delete_mac("blacklist", mac)
		delete_mac("whitelist", mac)

		if policy == "whitelist" or policy == "blacklist" then
			uci:section("luci_splash", policy, nil, { mac = mac })
		elseif policy == "normal" then			
			lslist[#lslist+1] = { mac = mac, start = os.time() }
		elseif policy == "kick" then
			for _, l in ipairs(lslist) do
				if l.mac:lower() == mac then l.kicked="1" end
			end
		end

		commit(lslist)
	end

	luci.template.render("admin_status/splash", { is_admin = true })
end
