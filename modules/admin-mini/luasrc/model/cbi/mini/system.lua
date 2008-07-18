--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.http.protocol.date")

m = Map("system", translate("system"), translate("a_s_desc"))

s = m:section(TypedSection, "system", "")
s.anonymous = true

s:option(Value, "hostname", translate("hostname"))

tz = s:option(ListValue, "timezone", translate("timezone"))
for k, offset in luci.util.vspairs(luci.http.protocol.date.TZ) do
	local zone = k:upper()	
	local osgn = (offset > 0 and "+" or "")
	local ohrs = math.floor(offset / 3600)
	local omin = (offset % 3600) / 60
	
	local ptz = zone .. osgn .. (ohrs ~= 0 and ohrs or "") .. (omin ~= 0 and ":" .. omin or "")
	local dtz = string.format("%+03d:%02d ", ohrs, omin) .. zone
	
	tz:value(ptz, dtz)
end

return m