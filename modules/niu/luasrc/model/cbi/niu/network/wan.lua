local cursor = require "luci.model.uci".cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("device", load("niu/network/wandevice"))
d:add("etherwan", load("niu/network/etherwan"))

function d.on_cancel()
	cursor:revert("network")
	cursor:revert("wireless")
end

function d.on_done()
	cursor:commit("network")
	cursor:commit("wireless")
end

return d