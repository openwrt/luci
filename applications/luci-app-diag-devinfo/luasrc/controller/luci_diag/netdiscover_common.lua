-- Copyright 2009 Daniel Dickinson
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.luci_diag.netdiscover_common", package.seeall)

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

   local netdiscover_uci = luci.model.uci.cursor()
   netdiscover_uci:load("luci_devinfo")
   local nettable = netdiscover_uci:get_all("luci_devinfo")

   local i 
   local subnet
   local netdout

   local outnets = {}

   i = next(nettable, nil)

   while (i) do
      if (netdiscover_uci:get("luci_devinfo", i) == "netdiscover_scannet") then 
	 local scannet = netdiscover_uci:get_all("luci_devinfo", i)
	 if scannet["subnet"] and (scannet["subnet"] ~= "") and scannet["enable"] and ( scannet["enable"] == "1") then
	    local output = ""
	    local outrow = {}
	    outrow["interface"] = scannet["interface"]
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

	    outrow["subnet"] = scannet["subnet"]    
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
   
   return "/usr/bin/netdiscover-to-devinfo " .. outnets[i]["subnet"] .. " " .. interface .. " " .. outnets[i]["timeout"] .. " -r " .. outnets[i]["repeat_count"] .. " -s " .. outnets[i]["sleepreq"] .. " </dev/null"
end

function action_links(netdiscovermap, mini) 
   s = netdiscovermap:section(SimpleSection, "", translate("Actions")) 
   b = s:option(DummyValue, "_config", translate("Configure Scans"))
   b.value = ""
   if (mini) then
      b.titleref = luci.dispatcher.build_url("mini", "network", "netdiscover_devinfo_config")
   else
      b.titleref = luci.dispatcher.build_url("admin", "network", "diag_config", "netdiscover_devinfo_config")
   end
   b = s:option(DummyValue, "_scans", translate("Repeat Scans (this can take a few minutes)"))
   b.value = ""
   if (mini) then
      b.titleref = luci.dispatcher.build_url("mini", "diag", "netdiscover_devinfo")
   else
      b.titleref = luci.dispatcher.build_url("admin", "status", "netdiscover_devinfo")
   end
end
