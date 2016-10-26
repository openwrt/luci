--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2014 HackPascal <hackpascal@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local data = {}
local ds = require "luci.dispatcher"
local ps = luci.util.execi("/bin/busybox top -bn1 | grep '/usr/sbin/pppd'")
for line in ps do
	local pid, ppid, speed, gateway, vip, cip = line:match(
		"^ *(%d+) +(%d+) +.+options%.pptpd +(%d+) +(%S.-%S)%:(%S.-%S) +.+ +(.+)"
	)

	local idx = tonumber(pid)
	if idx then
		data["%02i.%s" % { idx, "online" }] = {
			['PID'] = pid,
			['PPID'] = ppid,
			['SPEED'] = speed,
			['GATEWAY'] = gateway,
			['VIP'] = vip,
			['CIP'] = cip,
			['BLACKLIST'] = 0
		}
	end
end

-- local ps = luci.util.execi("sed -n '/## pptpd-blacklist-/p' /etc/firewall.user")
local ps = luci.util.execi("sed = /etc/firewall.user | sed 'N;s/\\n/:/'")
for line in ps do
	local idx, ip = line:match(
		"^ *(%d+)%:.+%#%# pptpd%-blacklist%-(.+)"
	)

	local idx = tonumber(idx)
	if idx then
		data["%02i.%s" % { idx, "blacklist" }] = {
			['PID'] = "-1",
			['PPID'] = "-1",
			['SPEED'] = "-1",
			['GATEWAY'] = "-",
			['VIP'] = "-",
			['CIP'] = ip,
			['BLACKLIST'] = 1
		}
	end
end

f = SimpleForm("processes")
f.reset = false
f.submit = false

t = f:section(Table, data, translate("Online Users"))
t:option(DummyValue, "GATEWAY", translate("Server IP"))
t:option(DummyValue, "VIP", translate("Client IP"))
t:option(DummyValue, "CIP", translate("IP address"))

blacklist = t:option(Button, "_blacklist", translate("Blacklist"))
function blacklist.render(self, section, scope)
	if self.map:get(section, "BLACKLIST")==0 then
		self.title = translate("Add to Blacklist")
		self.inputstyle = "remove"
	else
		self.title = translate("Remove from Blacklist")
		self.inputstyle = "apply"
	end

	Button.render(self, section, scope)
end
function blacklist.write(self, section)
	local CIP = self.map:get(section, "CIP")
	if self.map:get(section, "BLACKLIST")==0 then
		luci.util.execi("echo 'iptables -A input_rule -s %s -p tcp --dport 1723 -j DROP ## pptpd-blacklist-%s' >> /etc/firewall.user" % { CIP, CIP })
		luci.util.execi("iptables -A input_rule -s %s -p tcp --dport 1723 -j DROP" % { CIP })
		null, self.tag_error[section] = luci.sys.process.signal(self.map:get(section, "PID"), 9)
	else
		luci.util.execi("sed -i -e '/## pptpd-blacklist-%s/d' /etc/firewall.user" % { CIP })
		luci.util.execi("iptables -D input_rule -s %s -p tcp --dport 1723 -j DROP" % { CIP })
	end
	luci.http.redirect(ds.build_url("admin/services/pptpd/online"))
end

kill = t:option(Button, "_kill", translate("Forced offline"))
kill.inputstyle = "reset"
function kill.write(self, section)
	null, self.tag_error[section] = luci.sys.process.signal(self.map:get(section, "PID"), 9)
	luci.http.redirect(ds.build_url("admin/services/pptpd/online"))
end

return f
