--[[
LuCI - Lua Configuration Interface

Copyright 2012 Christian Gagneraud <chris@techworks.ie>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.watchcat", package.seeall)

function index()
   if not nixio.fs.access("/etc/config/system") then
      return
   end
   entry({"admin", "services", "watchcat"}, cbi("watchcat/watchcat"), _("Watchcat"), 90)
end
