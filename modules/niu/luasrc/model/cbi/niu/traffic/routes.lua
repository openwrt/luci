local cursor = require "luci.model.uci".cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("routes1", load("niu/traffic/routes1"))

function d.on_cancel()
	cursor:revert("network")
end

function d.on_done()
	cursor:commit("network")
end

return d