module("luci.controller.olsr2", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/olsrd2","f") then
		return
	end

	require("luci.model.uci")
	local uci = luci.model.uci.cursor_state()

	local page  = node("admin", "status", "olsr2")
	page.target = alias("admin", "status", "olsr2", "overview")
	page.title  = _("OLSR2")
	page.subindex = true

	local page  = node("admin", "status", "olsr2", "overview")
	page.target = template("status-olsr2/overview")
	page.title  = _("Overview")
	page.subindex = true
	page.order  = 1

	local page  = node("admin", "status", "olsr2", "overview", "version")
	page.target = call("action_version")
	page.title = nil
	page.leaf = true

	local page  = node("admin", "status", "olsr2", "overview", "lan")
	page.target = call("action_lan")
	page.title = nil
	page.leaf = true

	local page  = node("admin", "status", "olsr2", "neighbors")
	page.target = call("action_neigh")
	page.title  = _("Neighbours")
	page.subindex = true
	page.order  = 5

	local page  = node("admin", "status", "olsr2", "node")
	page.target = call("action_node")
	page.title  = _("Node")
	page.subindex = true
	page.order  = 6

	local page  = node("admin", "status", "olsr2", "anet")
	page.target = call("action_anet")
	page.title  = _("AttachedNetwork")
	page.subindex = true
	page.order  = 7

	if nixio.fs.access("/etc/config/freifunk","f") then
		local page = assign({"freifunk", "olsr2"}, {"admin", "status", "olsr2"}, _("OLSR2"), 31)
		page.setuser = false
		page.setgroup = false
	end

end

function action_version()
	local utl = require "luci.util"
	local http = require "luci.http"
	local telnet_port = 2009
	local req_json

	req_json = utl.exec("(echo '/systeminfo json version /quit' | nc ::1 %d) 2>/dev/null" % telnet_port)
	http.prepare_content("application/json")
	http.write(req_json)
end

function action_lan()
	local utl = require "luci.util"
	local http = require "luci.http"
	local telnet_port = 2009
	local req_json

	req_json = utl.exec("(echo '/olsrv2info json lan /quit' | nc ::1 %d) 2>/dev/null" % telnet_port)
	http.prepare_content("application/json")
	http.write(req_json)
end

function action_node()
	local http = require "luci.http"
	local utl = require "luci.util"
	local telnet_port = 2009
	local req_json
	if luci.http.formvalue("status") == "1" then
		req_json = utl.exec("(echo '/olsrv2info json node /quit' | nc ::1 %d) 2>/dev/null" % telnet_port)
		http.prepare_content("application/json")
		http.write(req_json)
	else
		luci.template.render("status-olsr2/node")
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
	local req_json
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


	req_json = json.decode(utl.exec("(echo '/nhdpinfo json neighbor /quit' | nc ::1 %d) 2>/dev/null" % telnet_port))

	for _, neighbors in pairs(req_json) do
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

function action_anet()
	local http = require "luci.http"
	local utl = require "luci.util"
	local telnet_port = 2009
	local req_json
	if luci.http.formvalue("status") == "1" then
		req_json = utl.exec("(echo '/olsrv2info json attached_network /quit' | nc ::1 %d) 2>/dev/null" % telnet_port)
		http.prepare_content("application/json")
		http.write(req_json)
	else
		luci.template.render("status-olsr2/anet")
	end
end
