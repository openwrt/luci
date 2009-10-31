--[[

LuCI UVC Streamer
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.controller.p910nd", package.seeall)

function index()
       require("luci.i18n")
       luci.i18n.loadc("p910nd")
       if not nixio.fs.access("/etc/config/p910nd") then
               return
       end

       local page = entry({"admin", "services", "p910nd"}, cbi("p910nd"), luci.i18n.translate("p910nd - Printer server"), 60)
       page.i18n = "p910nd"
       page.dependent = true
end
