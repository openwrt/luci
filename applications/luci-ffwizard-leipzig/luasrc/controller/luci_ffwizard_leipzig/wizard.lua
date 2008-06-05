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
	local cfg = uci.config
	
	
	-- Configure FF-Interface
	uci.delete("network", "ff")
	uci.delete("network", "ffdhcp")
	
	cfg.network.ff = "interface"
	cfg.network.ff.type = "bridge"
	cfg.network.ff.proto = "static"
	cfg.network.ff.ipaddr = ip
	cfg.network.ff.netmask = cfg.freifunk.community.mask 
	cfg.network.ff.dns = cfg.freifunk.community.dns 
	
	-- Reset Routing
	uci.foreach("luci_fw", "routing",
		function (section)
			if section.iface == "ff" or section.oface == "ff" then
				uci.delete("luci_fw", section[".name"])
			end
		end)
	
	if cfg.luci_fw then
		cfg.luci_fw[""] = "routing"
		cfg.luci_fw[""].iface = "ff"
		cfg.luci_fw[""].oface = "ff"
		cfg.luci_fw[""].fwd = "1"
	end
	
	-- Routing from Internal
	local iface = luci.http.formvalue("frominternal")
	if iface and iface ~= "" then
		uci.foreach("luci_fw", "routing",
			function (section)
				if section.iface == iface and section.oface == "ff" then
					uci.delete("luci_fw", section[".name"])
				end
			end)
		
		if cfg.luci_fw then
			cfg.luci_fw[""] = "routing"
			cfg.luci_fw[""].iface = iface
			cfg.luci_fw[""].oface = "ff"
			cfg.luci_fw[""].fwd = "1"
			cfg.luci_fw[""].nat = "1"
		end	
	end	
	
	-- Routing to External
	local iface = luci.http.formvalue("toexternal")
	if iface and iface ~= "" then
		uci.foreach("luci_fw", "routing",
			function (section)
				if section.oface == iface and section.iface == "ff" then
					uci.delete("luci_fw", section[".name"])
				end
			end)
		
		if cfg.luci_fw then
			cfg.luci_fw[""] = "routing"
			cfg.luci_fw[""].oface = iface
			cfg.luci_fw[""].iface = "ff"
			cfg.luci_fw[""].fwd = "1"
			cfg.luci_fw[""].nat = "1"
		end	
	end	
	
	-- Configure DHCP
	if luci.http.formvalue("dhcp") then
		local dhcpnet = cfg.freifunk.community.dhcp:match("^([0-9]+)")
		local dhcpip  = ip:gsub("^[0-9]+", dhcpnet)
	
		cfg.network.ffdhcp = "interface"
		cfg.network.ffdhcp.proto = "static"
		cfg.network.ffdhcp.ifname = "br-ff:dhcp"
		cfg.network.ffdhcp.ipaddr = dhcpip
		cfg.network.ffdhcp.netmask = cfg.freifunk.community.dhcpmask
		
		uci.foreach("dhcp", "dhcp",
			function (section)
				if section.interface == "ffdhcp" then
					uci.delete("dhcp", section[".name"])
				end
			end)  	
			
		local dhcpbeg = 48 + tonumber(ip:match("[0-9]+$")) * 4
		
		cfg.dhcp[""] = "dhcp"
		cfg.dhcp[""].interface = "ffdhcp"
		cfg.dhcp[""].start = dhcpbeg
		cfg.dhcp[""].limit = (dhcpbeg < 252) and 3 or 2
		cfg.dhcp[""].leasetime = "30m"
		
		
		uci.foreach("luci_splash", "iface",
			function (section)
				if section.network == "ffdhcp" then
					uci.delete("luci_splash", section[".name"])
				end
			end)  	
			
		if cfg.luci_splash then
			cfg.luci_splash[""] = "iface"
			cfg.luci_splash[""].network = "ffdhcp"
		end
		
		
		uci.foreach("luci_fw", "routing",
			function (section)
				if section.iface == "ffdhcp" or section.oface == "ffdhcp" then
					uci.delete("luci_fw", section[".name"])
				end
			end)

		if cfg.luci_fw then			
			cfg.luci_fw[""] = "routing"
			cfg.luci_fw[""].iface = "ffdhcp"
			cfg.luci_fw[""].oface = "ff"
			cfg.luci_fw[""].nat = "1"	
			
			local iface = luci.http.formvalue("toexternal")
			if iface and iface ~= "" then
				cfg.luci_fw[""] = "routing"
				cfg.luci_fw[""].iface = "ffdhcp"
				cfg.luci_fw[""].oface = iface
				cfg.luci_fw[""].nat = "1"			
			end
		end	
	end
	
	-- Configure OLSR
	if luci.http.formvalue("olsr") and cfg.olsr then
		uci.foreach("olsr", "Interface",
			function (section)
				uci.delete("olsr", section[".name"])
			end)
			
		uci.foreach("olsr", "LoadPlugin",
			function (section)
				uci.delete("olsr", section[".name"])
			end)
		
		if luci.http.formvalue("shareinet") then
			cfg.olsr.dyn_gw = "LoadPlugin"
			cfg.olsr.dyn_gw.Library = "olsrd_dyn_gw.so.0.4"
		end
		
		cfg.olsr.nameservice = "LoadPlugin"
		cfg.olsr.nameservice.Library = "olsrd_nameservice.so.0.3"
		cfg.olsr.nameservice.name = ip:gsub("%.", "-")
		cfg.olsr.nameservice.hosts_file = "/var/etc/hosts"
		cfg.olsr.nameservice.suffix = ".olsr"
		cfg.olsr.nameservice.latlon_infile = "/tmp/latlon.txt"
		
		cfg.olsr.txtinfo = "LoadPlugin"
		cfg.olsr.txtinfo.Library = "olsrd_txtinfo.so.0.1"
		cfg.olsr.txtinfo.Accept = "127.0.0.1"
		
		cfg.olsr[""] = "Interface"
		cfg.olsr[""].Interface = "ff"
		cfg.olsr[""].HelloInterval = "6.0"
		cfg.olsr[""].HelloValidityTime = "108.0"
		cfg.olsr[""].TcInterval = "4.0"
		cfg.olsr[""].TcValidityTime = "324.0"
		cfg.olsr[""].MidInterval = "18.0"
		cfg.olsr[""].MidValidityTime = "324.0"
		cfg.olsr[""].HnaInterval = "18.0"
		cfg.olsr[""].HnaValidityTime = "108.0"
	end
	
	-- Configure Wifi
	if cfg.wireless then
		uci.foreach("wireless", "wifi-device",
			function (section)
				local device = section[".name"]
				
				if luci.http.formvalue("wifi."..iface) then
					uci.foreach("wireless", "wifi-iface",
						function (section)
							if section.device == device then
								uci.delete("wireless", section[".name"]) 
							end
						end)
				end
				
				cfg.wireless[device].disabled = "0"
				cfg.wireless[device].mode = "11g"
				cfg.wireless[device].txantenna = "1"
				cfg.wireless[device].rxantenna = "1"
				cfg.wireless[device].channel = cfg.freifunk.community.channel
				
				cfg.wireless[""] = "wifi-iface"
				cfg.wireless[""].device = iface
				cfg.wireless[""].network = "ff"
				cfg.wireless[""].mode = "adhoc"
				cfg.wireless[""].ssid = cfg.freifunk.community.essid
				cfg.wireless[""].bssid = cfg.freifunk.community.bssid
				cfg.wireless[""].txpower = 13
			end)
	end
	
	-- Save UCI
	uci.save()

	luci.http.redirect(luci.dispatcher.build_url("admin", "uci", "changes"))
end