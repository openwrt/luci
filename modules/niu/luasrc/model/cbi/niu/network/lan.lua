local cursor = require "luci.model.uci".cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("lan1", load("niu/network/lan1"))

function d.on_cancel()
	cursor:revert("network")
	cursor:revert("dhcp")
end

function d.on_done()
	cursor:commit("network")
	cursor:commit("dhcp")
end

return d