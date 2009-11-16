local uci = require "luci.model.uci"
local cursor = uci.cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("portfw1", load("niu/traffic/portfw1"))

function d.on_cancel()
	cursor:revert("firewall")
	cursor:revert("upnpd")
end

function d.on_done()
	cursor:commit("firewall")
	cursor:commit("upnpd")
end

return d