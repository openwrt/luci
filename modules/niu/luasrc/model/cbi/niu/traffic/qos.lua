local uci = require "luci.model.uci"
local cursor = uci.cursor()

if not cursor:get("qos", "wan", "_niuinit") then
	-- Load some more sensible default classifications
	cursor:delete_all("qos", "classify")
	cursor:section("qos", "classify", "dns", 
		{target = "Priority", ports = "53", _name = "DNS"}
	)
	cursor:section("qos", "classify", "inet1",
		{target = "Normal", ports = "20,21,22,80,443", _name = "WWW, SSH, FTP"}
	)
	cursor:section("qos", "classify", "inet2",
		{target = "Normal", ports = "25,110,119,143", _name = "E-Mail, News"}
	)

	cursor:set("qos", "wan", "_niuinit", "1")
	cursor:save("qos")
end

local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("qos1", load("niu/traffic/qos1"))

function d.on_cancel()
	cursor:revert("qos")
end

function d.on_done()
	cursor:commit("qos")
end

return d