--[[

Luci diag - Diagnostics controller module
(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--


module("luci.controller.luci_diag.luci_diag_devinfo", package.seeall)

function index()
   require("luci.i18n")
   luci.i18n.loadc("diag_devinfo")

   local e = entry({"admin", "voice", "diag", "phones"}, arcombine(cbi("luci_diag/smap_devinfo"), cbi("luci_diag/smap_devinfo_config")), luci.i18n.translate("Phones"), 10)
   e.leaf = true
   e.subindex = true
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"admin", "voice", "diag", "phones", "config"}, cbi("luci_diag/smap_devinfo_config"), luci.i18n.translate("Configure"), 10)
   e.i18n = "diag_devinfo"

   e = entry({"admin", "status", "smap_devinfo"}, cbi("luci_diag/smap_devinfo"), luci.i18n.translate("SIP Devices on Network"), 120)
   e.leaf = true
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"admin", "network", "diag_config", "netdiscover_devinfo_config"}, cbi("luci_diag/netdiscover_devinfo_config"), luci.i18n.translate("Network Device Scan"), 100)
   e.leaf = true
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"admin", "network", "diag_config", "smap_devinfo_config"}, cbi("luci_diag/smap_devinfo_config"), luci.i18n.translate("SIP Device Scan"))
   e.leaf = true
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"admin", "status", "netdiscover_devinfo"}, cbi("luci_diag/netdiscover_devinfo"), luci.i18n.translate("Devices on Network"), 90)
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"admin", "network", "mactodevinfo"}, cbi("luci_diag/mactodevinfo"), luci.i18n.translate("MAC Device Info Overrides"), 190)
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"mini", "diag", "phone_scan"}, cbi("luci_diag/smap_devinfo_mini"), luci.i18n.translate("Phone Scan"), 100)
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"mini", "voice", "phones", "phone_scan_config"}, cbi("luci_diag/smap_devinfo_config_mini"), luci.i18n.translate("Config Phone Scan"), 90)
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"mini", "diag", "netdiscover_devinfo"}, cbi("luci_diag/netdiscover_devinfo_mini"), luci.i18n.translate("Network Device Scan"), 10)
   e.i18n = "diag_devinfo"
   e.dependent = true

   e = entry({"mini", "network", "netdiscover_devinfo_config"}, cbi("luci_diag/netdiscover_devinfo_config_mini"), luci.i18n.translate("Device Scan Config"))
   e.i18n = "diag_devinfo"
   e.dependent = true

end
