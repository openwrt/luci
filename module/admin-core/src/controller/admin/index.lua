module("ffluci.controller.admin.index", package.seeall)

function action_wizard()
	if ffluci.http.formvalue("ip") then
		return configure_freifunk()
	end
	
	local ifaces = {}
	local wldevs = ffluci.model.uci.show("wireless")
	
	if wldevs then
		for k, v in pairs(wldevs.wireless) do
			if v[".type"] == "wifi-device" then
				table.insert(ifaces, k)
			end
		end
	end
	
	ffluci.template.render("admin_index/wizard", {ifaces=ifaces})
end

function configure_freifunk()
	local ip  = ffluci.http.formvalue("ip")
	local uci = ffluci.model.uci.Session()
	
	-- Configure FF-Interface
	uci:del("network", "ff")
	uci:del("network", "ffdhcp")
	
	uci:set("network", "ff", nil, "interface")
	uci:set("network", "ff", "type", "bridge")
	uci:set("network", "ff", "proto", "static")
	uci:set("network", "ff", "ipaddr", ip)
	uci:set("network", "ff", "netmask", uci:get("freifunk", "community", "mask")) 
	uci:set("network", "ff", "dns", uci:get("freifunk", "community", "dns")) 
	
	-- Enable internal routing
	uci:set("freifunk", "routing", "internal", "1")
	
	-- Enable internet routing
	if ffluci.http.formvalue("shareinet") then
		uci:set("freifunk", "routing", "internet", "1")
	else
		uci:set("freifunk", "routing", "internet", "0")
	end
	
	-- Configure DHCP
	if ffluci.http.formvalue("dhcp") then
		local dhcpnet = uci:get("freifunk", "community", "dhcp"):match("^([0-9]+)")
		local dhcpip  = ip:gsub("^[0-9]+", dhcpnet)
	
		uci:set("network", "ffdhcp", nil, "interface")
		uci:set("network", "ffdhcp", "proto", "static")
		uci:set("network", "ffdhcp", "ifname", "br-ff:dhcp")
		uci:set("network", "ffdhcp", "ipaddr", dhcpip)
		uci:set("network", "ffdhcp", "netmask", uci:get("freifunk", "community", "dhcpmask"))
		
		local dhcp = uci:show("dhcp")
		if dhcp then
			for k, v in pairs(dhcp.dhcp) do
				if v[".type"] == "dhcp" and v.interface == "ffdhcp" then
					uci:del("dhcp", k)
				end
			end		
			
			local dhcpbeg = 48 + tonumber(ip:match("[0-9]+$")) * 4
			
			local sk = uci:add("dhcp", "dhcp")
			uci:set("dhcp", sk, "interface", "ffdhcp")
			uci:set("dhcp", sk, "start", dhcpbeg)
			uci:set("dhcp", sk, "limit", (dhcpbeg < 252) and 3 or 2)
			uci:set("dhcp", sk, "leasetime", "30m")
		end 
		
		local splash = uci:show("luci_splash")
		if splash then
			for k, v in pairs(splash.luci_splash) do
				if v[".type"] == "iface" then
					uci:del("luci_splash", k)
				end
			end		
			
			local sk = uci:add("luci_splash", "iface")
			uci:set("luci_splash", sk, "network", "ffdhcp")
		end 		
	end
	
	-- Configure OLSR
	if ffluci.http.formvalue("olsr") and uci:show("olsr") then
		for k, v in pairs(uci:show("olsr").olsr) do
			if v[".type"] == "Interface" or v[".type"] == "LoadPlugin" then
				uci:del("olsr", k)
			end
		end
		
		if ffluci.http.formvalue("shareinet") then
			uci:set("olsr", "dyn_gw", nil, "LoadPlugin")
			uci:set("olsr", "dyn_gw", "Library", "olsrd_dyn_gw.so.0.4")
		end
		
		uci:set("olsr", "nameservice", nil, "LoadPlugin")
		uci:set("olsr", "nameservice", "Library", "olsrd_nameservice.so.0.3")
		uci:set("olsr", "nameservice", "name", ip:gsub("%.", "-"))
		uci:set("olsr", "nameservice", "hosts_file", "/var/etc/hosts")
		uci:set("olsr", "nameservice", "suffix", ".olsr")
		uci:set("olsr", "nameservice", "latlon_infile", "/tmp/latlon.txt")
		
		uci:set("olsr", "txtinfo", nil, "LoadPlugin")
		uci:set("olsr", "txtinfo", "Library", "olsrd_txtinfo.so.0.1")
		uci:set("olsr", "txtinfo", "Accept", "127.0.0.1")
		
		local oif = uci:add("olsr", "Interface")
		uci:set("olsr", oif, "Interface", "ff")
		uci:set("olsr", oif, "HelloInterval", "6.0")
		uci:set("olsr", oif, "HelloValidityTime", "108.0")
		uci:set("olsr", oif, "TcInterval", "4.0")
		uci:set("olsr", oif, "TcValidityTime", "324.0")
		uci:set("olsr", oif, "MidInterval", "18.0")
		uci:set("olsr", oif, "MidValidityTime", "324.0")
		uci:set("olsr", oif, "HnaInterval", "18.0")
		uci:set("olsr", oif, "HnaValidityTime", "108.0")
	end
	
	-- Configure Wifi
	local wifi = ffluci.http.formvalue("wifi")
	local wcfg = uci:show("wireless")
	if type(wifi) == "table" and wcfg then
		for iface, v in pairs(wifi) do
			if wcfg.wireless[iface] then
				-- Cleanup
				for k, v in pairs(wcfg.wireless) do
					if v[".type"] == "wifi-iface" and v.device == iface then
						uci:del("wireless", k)
					end
				end
				
				uci:set("wireless", iface, "disabled", "0")
				uci:set("wireless", iface, "mode", "11g")
				uci:set("wireless", iface, "txantenna", 1)
				uci:set("wireless", iface, "rxantenna", 1)
				uci:set("wireless", iface, "channel", uci:get("freifunk", "community", "channel")) 
				
				local wif = uci:add("wireless", "wifi-iface")
				uci:set("wireless", wif, "device", iface)
				uci:set("wireless", wif, "network", "ff")
				uci:set("wireless", wif, "mode", "adhoc")
				uci:set("wireless", wif, "ssid", uci:get("freifunk", "community", "essid"))
				uci:set("wireless", wif, "bssid", uci:get("freifunk", "community", "bssid"))
				uci:set("wireless", wif, "txpower", 13)
			end
		end
	end
		

	ffluci.http.request_redirect("admin", "uci", "changes")
end