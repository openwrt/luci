--[[

LuCI uShare
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.controller.ushare", package.seeall)

function index()
       require("luci.i18n")
       luci.i18n.loadc("ushare")
       if not luci.fs.access("/etc/config/ushare") then
               return
       end

       local page = entry({"admin", "services", "ushare"}, cbi("ushare"), luci.i18n.translate("ushare", "uShare"), 60)
       page.i18n = "uvc_streamer"
       page.dependent = true
end
