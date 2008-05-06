module("ffluci.controller.admin.index", package.seeall)

function action_wizard()
	if ffluci.http.formvalue("ip") then
		return configure_freifunk()
	end
	
	local ifaces = {}
	local wldevs = ffluci.model.uci.sections("wireless")
	
	if wldevs then
		for k, v in pairs(wldevs) do
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
	
	-- Load UCI
	uci:t_load("network")
	uci:t_load("dhcp")
	uci:t_load("freifunk")
	uci:t_load("luci_splash")
	uci:t_load("olsr")
	uci:t_load("wireless")
	
	
	-- Configure FF-Interface
	uci:t_del("network", "ff")
	uci:t_del("network", "ffdhcp")
	
	uci:t_set("network", "ff", nil, "interface")
	uci:t_set("network", "ff", "type", "bridge")
	uci:t_set("network", "ff", "proto", "static")
	uci:t_set("network", "ff", "ipaddr", ip)
	uci:t_set("network", "ff", "netmask", uci:t_get("freifunk", "community", "mask")) 
	uci:t_set("network", "ff", "dns", uci:t_get("freifunk", "community", "dns")) 
	
	-- Enable internal routing
	uci:t_set("freifunk", "routing", "internal", "1")
	
	-- Enable internet routing
	if ffluci.http.formvalue("shareinet") then
		uci:t_set("freifunk", "routing", "internet", "1")
	else
		uci:t_set("freifunk", "routing", "internet", "0")
	end
	
	-- Configure DHCP
	if ffluci.http.formvalue("dhcp") then
		local dhcpnet = uci:t_get("freifunk", "community", "dhcp"):match("^([0-9]+)")
		local dhcpip  = ip:gsub("^[0-9]+", dhcpnet)
	
		uci:t_set("network", "ffdhcp", nil, "interface")
		uci:t_set("network", "ffdhcp", "proto", "static")
		uci:t_set("network", "ffdhcp", "ifname", "br-ff:dhcp")
		uci:t_set("network", "ffdhcp", "ipaddr", dhcpip)
		uci:t_set("network", "ffdhcp", "netmask", uci:t_get("freifunk", "community", "dhcpmask"))
		
		local dhcp = uci:t_sections("dhcp")
		if dhcp then
			for k, v in pairs(dhcp) do
				if v[".type"] == "dhcp" and v.interface == "ffdhcp" then
					uci:t_del("dhcp", k)
				end
			end		
			
			local dhcpbeg = 48 + tonumber(ip:match("[0-9]+$")) * 4
			
			local sk = uci:t_add("dhcp", "dhcp")
			uci:t_set("dhcp", sk, "interface", "ffdhcp")
			uci:t_set("dhcp", sk, "start", dhcpbeg)
			uci:t_set("dhcp", sk, "limit", (dhcpbeg < 252) and 3 or 2)
			uci:t_set("dhcp", sk, "leasetime", "30m")
		end 
		
		local splash = uci:t_sections("luci_splash")
		if splash then
			for k, v in pairs(splash) do
				if v[".type"] == "iface" then
					uci:t_del("luci_splash", k)
				end
			end		
			
			local sk = uci:t_add("luci_splash", "iface")
			uci:t_set("luci_splash", sk, "network", "ffdhcp")
		end 		
	end
	
	-- Configure OLSR
	if ffluci.http.formvalue("olsr") and uci:t_sections("olsr") then
		for k, v in pairs(uci:t_sections("olsr")) do
			if v[".type"] == "Interface" or v[".type"] == "LoadPlugin" then
				uci:t_del("olsr", k)
			end
		end
		
		if ffluci.http.formvalue("shareinet") then
			uci:t_set("olsr", "dyn_gw", nil, "LoadPlugin")
			uci:t_set("olsr", "dyn_gw", "Library", "olsrd_dyn_gw.so.0.4")
		end
		
		uci:t_set("olsr", "nameservice", nil, "LoadPlugin")
		uci:t_set("olsr", "nameservice", "Library", "olsrd_nameservice.so.0.3")
		uci:t_set("olsr", "nameservice", "name", ip:gsub("%.", "-"))
		uci:t_set("olsr", "nameservice", "hosts_file", "/var/etc/hosts")
		uci:t_set("olsr", "nameservice", "suffix", ".olsr")
		uci:t_set("olsr", "nameservice", "latlon_infile", "/tmp/latlon.txt")
		
		uci:t_set("olsr", "txtinfo", nil, "LoadPlugin")
		uci:t_set("olsr", "txtinfo", "Library", "olsrd_txtinfo.so.0.1")
		uci:t_set("olsr", "txtinfo", "Accept", "127.0.0.1")
		
		local oif = uci:t_add("olsr", "Interface")
		uci:t_set("olsr", oif, "Interface", "ff")
		uci:t_set("olsr", oif, "HelloInterval", "6.0")
		uci:t_set("olsr", oif, "HelloValidityTime", "108.0")
		uci:t_set("olsr", oif, "TcInterval", "4.0")
		uci:t_set("olsr", oif, "TcValidityTime", "324.0")
		uci:t_set("olsr", oif, "MidInterval", "18.0")
		uci:t_set("olsr", oif, "MidValidityTime", "324.0")
		uci:t_set("olsr", oif, "HnaInterval", "18.0")
		uci:t_set("olsr", oif, "HnaValidityTime", "108.0")
	end
	
	-- Configure Wifi
	local wcfg = uci:t_sections("wireless")
	if wcfg then
		for iface, v in pairs(wcfg) do
			if v[".type"] == "wifi-device" and ffluci.http.formvalue("wifi."..iface) then
				-- Cleanup
				for k, j in pairs(wcfg) do
					if j[".type"] == "wifi-iface" and j.device == iface then
						uci:t_del("wireless", k)
					end
				end
				
				uci:t_set("wireless", iface, "disabled", "0")
				uci:t_set("wireless", iface, "mode", "11g")
				uci:t_set("wireless", iface, "txantenna", 1)
				uci:t_set("wireless", iface, "rxantenna", 1)
				uci:t_set("wireless", iface, "channel", uci:t_get("freifunk", "community", "channel")) 
				
				local wif = uci:t_add("wireless", "wifi-iface")
				uci:t_set("wireless", wif, "device", iface)
				uci:t_set("wireless", wif, "network", "ff")
				uci:t_set("wireless", wif, "mode", "adhoc")
				uci:t_set("wireless", wif, "ssid", uci:t_get("freifunk", "community", "essid"))
				uci:t_set("wireless", wif, "bssid", uci:t_get("freifunk", "community", "bssid"))
				uci:t_set("wireless", wif, "txpower", 13)
			end
		end
	end
	
	-- Save UCI
	uci:t_save("network")
	uci:t_save("dhcp")
	uci:t_save("freifunk")
	uci:t_save("luci_splash")
	uci:t_save("olsr")
	uci:t_save("wireless")

	ffluci.http.redirect(ffluci.dispatcher.build_url("admin", "uci", "changes"))
end