--[[
LuCI - Lua Configuration Interface

Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.admin.servicectl", package.seeall)

function index()
	luci.i18n.loadc("base")
	local i18n = luci.i18n.translate

	entry({"servicectl"}, alias("servicectl", "status"), nil, 1).sysauth = "root"
	entry({"servicectl", "status"}, call("action_status"), nil, 2).leaf = true
	entry({"servicectl", "restart"}, call("action_restart"), nil, 3).leaf = true
end

function action_status()
	local data = nixio.fs.readfile("/var/run/luci-reload-status")
	if data then
		luci.http.write("/etc/config/")
		luci.http.write(data)
	else
		luci.http.write("finish")
	end
end

function action_restart()
	if luci.dispatcher.context.requestpath[3] then
		local service
		local services = { }

		for service in luci.dispatcher.context.requestpath[3]:gmatch("%w+") do
			services[#services+1] = service
		end

		if nixio.fork() == 0 then
			local i = nixio.open("/dev/null", "r")
			local o = nixio.open("/dev/null", "w")

			nixio.dup(i, nixio.stdin)
			nixio.dup(o, nixio.stdout)

			i:close()
			o:close()

			nixio.exec("/bin/sh", "/sbin/luci-reload", unpack(services))
		else
			luci.http.write("OK")
			os.exit(0)
		end
	end
end
