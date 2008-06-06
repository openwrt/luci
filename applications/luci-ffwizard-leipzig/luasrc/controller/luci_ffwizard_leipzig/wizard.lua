module("luci.controller.luci_ffwizard_leipzig.wizard", package.seeall)

function index()
	entry({"admin", "index", "wizard"}, call("action_wizard"), "Freifunkassistent", 20)
end


function action_wizard()
	if luci.http.formvalue("ip") then
		return configure_freifunk()
	end
	
	local ifaces = {}
	luci.model.uci.foreach("wireless", "wifi-device",
		function(section)
			table.insert(ifaces, section[".name"])
		end)
	
	luci.template.render("freifunk/wizard", {ifaces=ifaces})
end

function configure_freifunk()
	local ip  = luci.http.formvalue("ip")
	local uci = luci.model.uci
	local cfg = {
		wireless = uci.load("wireless"),
		luci_fw = uci.load("luci_fw"),
		luci_splash = uci.load("luci_splash"),
		olsr = uci.load("olsr")
	}
	
	-- Configure FF-Interface
	uci.delete("network", "ff")
	uci.delete("network", "ffdhcp")
	
	uci.section("network", "interface", "ff", {
		type = "bridge",
		proto = "static",
		ipaddr = ip,
		netmask = uci.get("freifunk", "community", "mask"), 
		dns = uci.get("freifunk", "community", "dns")
	}) 
	
	-- Reset Routing
	uci.delete_all("luci_fw", "routing",
		function (section)
			return (section.iface == "ff" or section.oface == "ff")
		end)
	
	if cfg.luci_fw then
		uci.section("luci_fw", "routing", nil, {
			iface = "ff",
			oface = "ff",
			fwd = "1"
		})
	end
	
	-- Routing from Internal
	local iface = luci.http.formvalue("frominternal")
	if iface and iface ~= "" then
		uci.delete_all("luci_fw", "routing",
			function (section)
				return (section.iface == iface and section.oface == "ff")
			end)
		
		if cfg.luci_fw then
			uci.section("luci_fw", "routing", nil, {
				iface = iface,
				oface = "ff",
				fwd = "1",
				nat = "1"
			})
		end	
	end	
							
	-- Routing to External
	local iface = luci.http.formvalue("toexternal")
	if iface and iface ~= "" then
		uci.delete_all("luci_fw", "routing",
			function (section)
				return (section.oface == iface and section.iface == "ff")
			end)
		
		if cfg.luci_fw then
			uci.section("luci_fw", "routing", nil, {
				oface = iface,
				iface = "ff",
				fwd = "1",
				nat = "1"
			})
		end	
	end	
	
	-- Configure DHCP
	if luci.http.formvalue("dhcp") then
		local dhcpnet = uci.get("freifunk", "community", "dhcp"):match("^([0-9]+)")
		local dhcpip  = ip:gsub("^[0-9]+", dhcpnet)
	
		uci.section("network", "interface", "ffdhcp", {
			proto = "static",
			ifname = "br-ff:dhcp",
			ipaddr = dhcpip,
			netmask = uci.get("freifunk", "community", "dhcpmask")
		})
		
		uci.delete_all("dhcp", "dhcp",
			function (section) 	
				return (section.interface == "ffdhcp")
			end)				
			
		local dhcpbeg = 48 + tonumber(ip:match("[0-9]+$")) * 4
		uci.section("dhcp", "dhcp", nil, {
			interface = "ffdhcp",
			start = dhcpbeg,
			limit = ((dhcpbeg < 252) and 3 or 2),
			leasetime = "30m"
		})

					
		uci.delete_all("luci_splash", "iface",
			function (section)
				return (section.network == "ffdhcp")
			end)  	
		
		if cfg.luci_splash then
			uci.section("luci_splash", "iface", nil, {
				network = "ffdhcp"
			})
		end
		
		
		uci.delete_all("luci_fw", "routing",
			function (section)
				return (section.iface == "ffdhcp" or section.oface == "ffdhcp")
			end)

		if cfg.luci_fw then	
			uci.section("luci_fw", "routing", nil, {		
				iface = "ffdhcp",
				oface = "ff",
				nat = "1"
			})	
			
			local iface = luci.http.formvalue("toexternal")
			if iface and iface ~= "" then
				uci.section("luci_fw", "routing", nil, {		
					iface = "ffdhcp",
					oface = iface,
					nat = "1"
				})		
			end
		end	
	end

	-- Configure OLSR
	if luci.http.formvalue("olsr") and cfg.olsr then
		uci.delete_all("olsr", "Interface")
		uci.delete_all("olsr", "LoadPlugin")
		
		if luci.http.formvalue("shareinet") then
			uci.section("olsr", "LoadPlugin", "dyn_gw", {
				Library = "olsrd_dyn_gw.so.0.4"
			})
		end
		
		uci.section("olsr", "LoadPlugin", "nameservice", {
			Library = "olsrd_nameservice.so.0.3",
			name = ip:gsub("%.", "-"),
			hosts_file = "/var/etc/hosts",
			suffix = ".olsr",
			latlon_infile = "/tmp/latlon.txt"
		})
		
		uci.section("olsr", "LoadPlugin", "txtinfo", {
			Library = "olsrd_txtinfo.so.0.1",
			Accept = "127.0.0.1"
		})
		
		uci.section("olsr", "Interface", nil, {
			Interface = "ff",
			HelloInterval = "6.0",
			HelloValidityTime = "108.0",
			TcInterval = "4.0",
			TcValidityTime = "324.0",
			MidInterval = "18.0",
			MidValidityTime = "324.0",
			HnaInterval = "18.0",
			HnaValidityTime = "108.0"
		})
	end

	-- Configure Wifi
	if cfg.wireless then
		uci.foreach("wireless", "wifi-device",
			function (section)
				local device = section[".name"]
				
				if luci.http.formvalue("wifi."..iface) then
					uci.delete_all("wireless", "wifi-iface",
						function (section)
							return (section.device == device)
						end)
				end
				
				uci.tset("wireless", device, {
					disabled = "0",
					mode = "11g",
					txantenna = "1",
					rxantenna = "1",
					channel = uci.get("freifunk", "community", "channel")
				})
				
				uci.section("wireless", "wifi-iface", nil, {
					device = iface,
					network = "ff",
					mode = "adhoc",
					ssid = uci.get("freifunk", "community", "essid"),
					bssid = uci.get("freifunk", "community", "bssid"),
					txpower = 13
				})
			end)
	end

	-- Save UCI
	uci.save()


	luci.http.redirect(luci.dispatcher.build_url("admin", "uci", "changes"))
end