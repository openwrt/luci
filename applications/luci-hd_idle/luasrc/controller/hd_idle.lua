--[[

LuCI hd-idle
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.controller.hd_idle", package.seeall)

function index()
       require("luci.i18n")
       luci.i18n.loadc("hd_idle")
       if not luci.fs.isfile("/etc/config/hd-idle") then
               return
       end

       local page = entry({"admin", "services", "hd_idle"}, cbi("hd_idle"), luci.i18n.translate("hd_idle", "hd-idle"), 60)
       page.i18n = "hd_idle"
       page.dependent = true
end
