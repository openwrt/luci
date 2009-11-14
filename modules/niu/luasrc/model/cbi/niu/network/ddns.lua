local uci = require "luci.model.uci"
local cursor = uci.cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("ddns1", load("niu/network/ddns1"))

function d.on_cancel()
	cursor:revert("ddns")
end

function d.on_done()
	cursor:commit("ddns")
end

return d