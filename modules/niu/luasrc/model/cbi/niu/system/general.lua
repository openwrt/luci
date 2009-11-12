local cursor = require "luci.model.uci".cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("general1", load("niu/system/general1"))

function d.on_cancel()
	cursor:revert("luci")
end

function d.on_done()
	local pw1 = cursor:get("luci", "main", "_pw1")
	if pw1 and pw1 ~= "**********" then
		cursor:delete("luci", "main", "_pw1")
		require "luci.sys".user.setpasswd("root", pw1)
	end

	local hn = cursor:get("luci", "main", "_uniquename")
	if hn then
		cursor:foreach("system", "system", function(s)
			cursor:set("system", s[".name"], "hostname", hn)
		end)
		cursor:commit("system")

		require "nixio.fs".writefile("/proc/sys/kernel/hostname", hn)
		cursor:delete("luci", "main", "_uniquename")
	end

	cursor:commit("luci")
end

return d