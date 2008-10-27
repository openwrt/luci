--[[

LuCI mmc_over_gpio
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.controller.mmc_over_gpio", package.seeall)

function index()
       require("luci.i18n")
       luci.i18n.loadc("mmc_over_gpio")
       if not luci.fs.isfile("/etc/config/mmc_over_gpio") then
               return
       end

       local page = entry({"admin", "system", "mmc_over_gpio"}, cbi("mmc_over_gpio"), luci.i18n.translate("mmc_over_gpio", "mmc_over_gpio"), 60)
       page.i18n = "mmc_over_gpio"
       page.dependent = true
end
