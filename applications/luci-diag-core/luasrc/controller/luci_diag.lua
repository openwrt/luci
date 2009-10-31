--[[

Luci Voice Core
(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

]]--

require("luci.i18n")

module("luci.controller.luci_diag", package.seeall)

function index()
   require("luci.i18n")
   luci.i18n.loadc("diag_core")

   local e = entry({"admin", "network", "diag_config"}, template("diag/network_config_index") , luci.i18n.translate("Configure Diagnostics"), 120)
   e.index = true
   e.i18n = "diag_core"
   e.dependent = true

   e = entry({"mini", "diag"}, template("diag/index"), luci.i18n.translate("l_d_diag"), 120)
   e.index = true
   e.i18n = "diag_core"
   e.dependent = true
end
