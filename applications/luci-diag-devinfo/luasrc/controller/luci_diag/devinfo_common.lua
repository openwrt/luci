--[[

Luci diag - Diagnostics controller module
(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

module("luci.controller.luci_diag.devinfo_common", package.seeall)

require("luci.i18n")
require("luci.util")
require("luci.sys")
require("luci.cbi")
require("luci.model.uci")

local translate = luci.i18n.translate
local DummyValue = luci.cbi.DummyValue
local SimpleSection = luci.cbi.SimpleSection

function run_processes(outnets, cmdfunc)
   i = next(outnets, nil)
   while (i) do
      outnets[i]["output"] = luci.sys.exec(cmdfunc(outnets, i))
      i = next(outnets, i)
   end
end

function parse_output(devmap, outnets, haslink, type, mini, debug)
   local curnet = next(outnets, nil)

   luci.i18n.loadc("diag_devinfo")

   while (curnet) do
      local output = outnets[curnet]["output"]
      local subnet = outnets[curnet]["subnet"]
      local ports = outnets[curnet]["ports"]
      local interface = outnets[curnet]["interface"]
      local netdevs = {}
      devlines = luci.util.split(output)
      if not devlines then
	 devlines = {}
	 table.insert(devlines, output)
      end
	    
      local j = nil
      j = next(devlines, j)
      
      local found_a_device = false
      
      while (j) do
	 if devlines[j] and ( devlines[j] ~= "" ) then
	    found_a_device = true
	    local devtable
	    local row = {}
	    devtable = luci.util.split(devlines[j], ' | ')
	    row["ip"] = devtable[1]
	    if (not mini) then
	       row["mac"] = devtable[2]
	    end
	    if ( devtable[4] == 'unknown' ) then 
	       row["vendor"] = devtable[3]
	    else
	       row["vendor"] = devtable[4]
	    end
	    row["type"] = devtable[5]
	    if (not mini) then
	       row["model"] = devtable[6]
	    end
	    if (haslink) then
	       row["config_page"] = devtable[7]
	    end
	    
	    if (debug) then
	       row["raw"] = devlines[j]
	    end
	    table.insert(netdevs, row)
	 end
	 j = next(devlines, j)
      end
      if not found_a_device then
	 local row = {}
	 row["ip"] = curnet
	 if (not mini) then
	    row["mac"] = ""
	 end
	 if (type == "smap") then
	    row["vendor"] = luci.i18n.translate("l_d_d_dc_nosipdev")
	 else
	    row["vendor"] = luci.i18n.translate("l_d_d_dc_nodev")
	 end
	 row["type"] = luci.i18n.translate("l_d_d_dc_checkothernet")
	 if (not mini) then
	    row["model"] = ""
	 end
	 if (haslink) then
	    row["config_page"] = ""
	 end
	 if (debug) then
	    row["raw"] = output
	 end
	 table.insert(netdevs, row)
      end	 
      local s
      if (type == "smap") then
	 if (mini) then
	    s = devmap:section(luci.cbi.Table, netdevs, luci.i18n.translate("l_d_d_dc_sipdev_found_mini") .. " " .. curnet)
	 else
	    local interfacestring = ""
	    if ( interface ~= "" ) then
	       interfacestring = ", " .. interface
	    end
	    s = devmap:section(luci.cbi.Table, netdevs, luci.i18n.translate("l_d_d_dc_sipdev_found_admin") .. " " .. curnet .. " (" .. subnet .. ":" .. ports .. interfacestring .. ")")
	 end
	 s.template = "diag/smapsection"
      else
	 if (mini) then
	    s = devmap:section(luci.cbi.Table, netdevs, luci.i18n.translate("l_dd_dc_netdev_found_mini") .. " " .. curnet)
	 else
	    local interfacestring = ""
	    if ( interface ~= "" ) then
	       interfacestring = ", " .. interface
	    end
	    s = devmap:section(luci.cbi.Table, netdevs, luci.i18n.translate("l_d_d_dc_netdev_found_admin", "Devices discovered for") .. " " .. curnet .. " (" .. subnet .. interfacestring .. ")")
	 end
      end
      s:option(DummyValue, "ip", translate("l_d_d_dc_mac_ip"))
      if (not mini) then
	 s:option(DummyValue, "mac", translate("l_d_d_dc_mac_address"))
      end
      s:option(DummyValue, "vendor", translate("l_d_d_dc_mac_vendor"))
      s:option(DummyValue, "type", translate("l_d_d_dc_mac_device_type"))
      if (not mini) then
	 s:option(DummyValue, "model", translate("l_d_d_dc_mac_model"))
      end
      if (haslink) then
	 s:option(DummyValue, "config_page", translate("l_d_d_dc_config_page"))
      end
      if (debug) then
	 s:option(DummyValue, "raw", translate("l_d_d_dc_raw"))
      end
      curnet = next(outnets, curnet)
   end
end

function get_network_device(interface)
   local state = luci.model.uci.cursor_state()
   state:load("network")
   local dev
   
   return state:get("network", interface, "ifname")
end


function cbi_add_networks(field)
	uci.cursor():foreach("network", "interface",
		function (section)
			if section[".name"] ~= "loopback" then
				field:value(section[".name"])
			end
		end
	)
	field.titleref = luci.dispatcher.build_url("admin", "network", "network")
end

function config_devinfo_scan(map, scannet)
   local o
   o = scannet:option(luci.cbi.Flag, "enable", translate("l_d_d_dc_enable"))
   o.optional = false
   o.rmempty = false

   o = scannet:option(luci.cbi.Value, "interface", translate("l_d_d_dc_interface"))
   o.optional = false
   luci.controller.luci_diag.devinfo_common.cbi_add_networks(o)
   
   local scansubnet
   scansubnet = scannet:option(luci.cbi.Value, "subnet", translate("l_d_d_dc_subnet"))
   scansubnet.optional = false
   
   o = scannet:option(luci.cbi.Value, "timeout", translate("l_d_d_dc_timeout"), translate("l_d_d_dc_timeout_descr"))
   o.optional = true
   
   o = scannet:option(luci.cbi.Value, "repeat_count", translate("l_d_d_dc_repeat_count"), translate("l_d_d_dc_repeat_count_descr"))
   o.optional = true
   
   o = scannet:option(luci.cbi.Value, "sleepreq", translate("l_d_d_dc_sleep"), translate("l_d_d_dc_sleep_desc"))
   o.optional = true
end