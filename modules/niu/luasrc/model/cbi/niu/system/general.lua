local cursor = require "luci.model.uci".cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("general1", load("niu/system/general1"))

function d.on_cancel()
	cursor:revert("system")
end

function d.on_done()
	cursor:commit("system")
end

return d