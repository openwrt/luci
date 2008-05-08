module("ffluci.controller.public.status", package.seeall)

function action_index()
	local data = {}
	
	data.s, data.m, data.r = ffluci.sys.sysinfo()
	
	data.wifi = ffluci.sys.wifi.getiwconfig()
	
	data.routes = {}
	for i, r in pairs(ffluci.sys.net.routes()) do
		if r.Destination == "00000000" then
			table.insert(data.routes, r)
		end
	end

	
	ffluci.template.render("public_status/index", data)
end


