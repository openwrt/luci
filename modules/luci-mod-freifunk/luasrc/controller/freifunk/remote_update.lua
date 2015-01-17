-- Copyright 2009 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.freifunk.remote_update", package.seeall)

function index()
	if not nixio.fs.access("/usr/sbin/remote-update") then
		return
	end

	entry({"admin", "system", "remote_update"}, call("act_remote_update"),
		_("Freifunk Remote Update"), 90)
end

function act_remote_update()
	if luci.http.formvalue("flash") == "1" then
		if luci.http.formvalue("confirm") == "1" then
			local nobackup = ( luci.http.formvalue("keepcfg") ~= "1" )
			local noverify = ( luci.http.formvalue("verify")  ~= "1" )

			luci.http.redirect("/luci-static/flashing.html")

			os.execute("start-stop-daemon -S -b -x /usr/sbin/remote-update -- %s%s-s 5 -y" % {
				noverify and "-v " or "",
				nobackup and "-n " or ""
			})
		else
			luci.template.render("freifunk/remote_update", {confirm=1})
		end
	else
		local fd = io.popen("remote-update -c")
		local update = { }

		if fd then
			while true do
				local ln=fd:read("*l")

				if not ln                  then break
				elseif ln:find("Local: ")  then update.locvar = ln:match("Local: (%d+)")
				elseif ln:find("Remote: ") then update.remver = ln:match("Remote: (%d+)")
				elseif ln == "--"          then update.info   = ""
				elseif update.info ~= nil  then
					update.info = update.info .. ln .. "\n"
				end
			end

			fd:close()
		end

		luci.template.render("freifunk/remote_update", {update=update})
	end
end
