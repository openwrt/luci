module("luci.controller.olsr2", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/olsrd2","f") then
		return
	end

	require("luci.model.uci")
	local uci = luci.model.uci.cursor_state()

	local page  = node("admin", "status", "olsr2")
	page.target = template("status-olsr2/overview")
	page.title  = _("OLSR2")
	page.subindex = true

	local page  = node("admin", "status", "olsr2", "neighbors")
	page.target = call("action_neigh")
	page.title  = _("Neighbours")
	page.subindex = true
	page.order  = 5

	if nixio.fs.access("/etc/config/freifunk","f") then
		local page = assign({"freifunk", "olsr2"}, {"admin", "status", "olsr2"}, _("OLSR2"), 31)
		page.setuser = false
		page.setgroup = false
	end

end

function action_neigh()
	local json = require "luci.json"
	local utl = require "luci.util"
	local ipc = require "luci.ip"
	local uci = require "luci.model.uci".cursor()
	local ntm = require "luci.model.network".init()
	local devices  = ntm:get_wifidevs()
	local assoclist = {}
	local data = {}
	local req_neighbors
	local telnet_port = 2009
	local resolve = 1

	for _, dev in ipairs(devices) do
		for _, net in ipairs(dev:get_wifinets()) do
				local radio = net:get_device()
				assoclist[#assoclist+1] = {}
				assoclist[#assoclist]['ifname'] = net:ifname()
				assoclist[#assoclist]['network'] = net:network()[1]
				assoclist[#assoclist]['device'] = radio and radio:name() or nil
				assoclist[#assoclist]['list'] = net:assoclist()
		end
	end


	req_neighbors = json.decode(utl.exec("(echo '/nhdpinfo json neighbor /quit' | nc ::1 %d) 2>/dev/null" % telnet_port))

	for _, neighbors in pairs(req_neighbors) do
		for nidx, neighbor in pairs(neighbors) do
			if not neighbor then
				return
			end
			neighbors[nidx].proto = 6
			local rt = ipc.route(neighbor["neighbor_originator"])
			local localIP=rt.src:string()
			neighbors[nidx].localIP=localIP
			neighbors[nidx].interface = ntm:get_status_by_address(localIP) or "?"
			utl.exec("ping6 -q -c1 %s" % rt.gw:string().."%"..rt.dev)
			ipc.neighbors({ dest = rt.gw:string() }, function(ipn)
				neighbors[nidx].mac = ipn.mac
				neighbors[nidx].signal = 0
				neighbors[nidx].noise = 0
				neighbors[nidx].snr = 0
				for _, val in ipairs(assoclist) do
					if val.network == interface and val.list then
						local assocmac, assot
						for assocmac, assot in pairs(val.list) do
							if ipn.mac == luci.ip.checkmac(assocmac) then
								neighbors[nidx].signal = tonumber(assot.signal)
								neighbors[nidx].noise = tonumber(assot.noise)
								neighbors[nidx].snr = (noise*-1) - (signal*-1)
							end
						end
					end
				end
			end)
			if resolve == "1" then
				local hostname = nixio.getnameinfo(neighbor["neighbor_originator"])
				if hostname then
					neighbors[nidx].hostname = hostname
				end
			end
		end
		data = neighbors
	end

luci.template.render("status-olsr2/neighbors", {links=data})
end
