--[[

Luci diag - Diagnostics controller module
(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

module("luci.controller.luci_diag.smap_common", package.seeall)

require("luci.i18n")
require("luci.util")
require("luci.sys")
require("luci.cbi")
require("luci.model.uci")

local translate = luci.i18n.translate
local DummyValue = luci.cbi.DummyValue
local SimpleSection = luci.cbi.SimpleSection

function index()
	return -- no-op
end

function get_params()

   local smapnets_uci = luci.model.uci.cursor()
   smapnets_uci:load("luci_devinfo")
   local nettable = smapnets_uci:get_all("luci_devinfo")

   local i 
   local subnet
   local smapout

   local outnets = {}

   i = next(nettable, nil)

   while (i) do
      if (smapnets_uci:get("luci_devinfo", i) == "smap_scannet") then 
	 local scannet = smapnets_uci:get_all("luci_devinfo", i)
	 if scannet["subnet"] and (scannet["subnet"] ~= "") and scannet["enable"] and ( scannet["enable"] == "1") then
	    local output = ""
	    local outrow = {}
	    outrow["subnet"] = scannet["subnet"]
	    ports = "5060"
	    if scannet["ports"] and ( scannet["ports"] ~= "" ) then
	       ports = scannet["ports"]		 
	    end
	    outrow["timeout"] = 10
	    local timeout = tonumber(scannet["timeout"]) 
	    if timeout and ( timeout > 0 ) then
	       outrow["timeout"] = scannet["timeout"]
	    end

	    outrow["repeat_count"] = 1
	    local repcount = tonumber(scannet["repeat_count"]) 
	    if repcount and ( repcount > 0 ) then
	       outrow["repeat_count"] = scannet["repeat_count"]
	    end

	    outrow["sleepreq"] = 100
	    local repcount = tonumber(scannet["sleepreq"]) 
	    if repcount and ( repcount > 0 ) then
	       outrow["sleepreq"] = scannet["sleepreq"]
	    end

	    if scannet["interface"] and ( scannet["interface"] ~= "" ) then
	       outrow["interface"] = scannet["interface"]
	    else
	       outrow["interface"] = ""
	    end

	    outrow["ports"] = ports
	    outrow["output"] = output
	    outnets[i] = outrow
	 end
      end
      i = next(nettable, i)
   end
   return outnets
end

function command_function(outnets, i) 

   local interface = luci.controller.luci_diag.devinfo_common.get_network_device(outnets[i]["interface"])

   return "/usr/bin/netsmap-to-devinfo -r " .. outnets[i]["subnet"] .. " -t " .. outnets[i]["timeout"] .. " -i " .. interface .. " -x -p " ..  outnets[i]["ports"]  .. " -c " .. outnets[i]["repeat_count"] .. " -s " .. outnets[i]["sleepreq"] .. " </dev/null"
end

function action_links(smapmap, mini) 
   s = smapmap:section(SimpleSection, "", translate("Actions")) 
   b = s:option(DummyValue, "_config", translate("Configure Scans"))
   b.value = ""
   if (mini) then
      b.titleref = luci.dispatcher.build_url("mini", "voice", "phones", "phone_scan_config")
   else
      b.titleref = luci.dispatcher.build_url("admin", "network", "diag_config", "smap_devinfo_config")
   end
   b = s:option(DummyValue, "_scans", translate("Repeat Scans (this can take a few minutes)"))
   b.value = ""
   if (mini) then
      b.titleref = luci.dispatcher.build_url("mini", "diag", "phone_scan")
   else
      b.titleref = luci.dispatcher.build_url("admin", "status", "smap_devinfo")
   end
end
