--[[
openwrt-dist-luci: ChinaDNS
]]--

local m, s, o

if luci.sys.call("pidof chinadns >/dev/null") == 0 then
	m = Map("chinadns", translate("ChinaDNS"), translate("ChinaDNS is running"))
else
	m = Map("chinadns", translate("ChinaDNS"), translate("ChinaDNS is not running"))
end

s = m:section(TypedSection, "chinadns", translate("General Setting"))
s.anonymous = true

o = s:option(Flag, "enable", translate("Enable"))
o.rmempty = false

o = s:option(Flag, "bidirectional",
	translate("Enable Bidirectional Filter"),
	translate("Also filter results inside China from foreign DNS servers"))
o.rmempty = false

o = s:option(Flag, "apnt_en",
	translate("Enable DNS compression pointer"),
	translate("use DNS compression pointer mutation."))
o.rmempty = false

o = s:option(Value, "port", translate("Local Port"))
o.placeholder = 1053
o.default = 1053
o.datatype = "port"
o.rmempty = false

o = s:option(Value, "chnroute", translate("CHNRoute File"))
o.placeholder = "/etc/chinadns_chnroute.txt"
o.default = "/etc/chinadns_chnroute.txt"
o.datatype = "file"
o.rmempty = false

o = s:option(Value, "server",
	translate("Upstream Servers"),
	translate("Use commas to separate multiple ip address"))
o.placeholder = "114.114.114.114,208.67.222.222:443,8.8.8.8"
o.default = "114.114.114.114,208.67.222.222:443,8.8.8.8"
o.rmempty = false

return m
