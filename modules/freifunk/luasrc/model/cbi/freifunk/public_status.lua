require "luci.sys"
require "luci.tools.webadmin"

local bit = require "bit"
local uci = luci.model.uci.cursor_state()

local ffzone = luci.tools.webadmin.firewall_find_zone("freifunk")
local ffznet = ffzone and uci:get("firewall", ffzone, "network")
local ffwifs = ffznet and luci.util.split(ffznet, " ") or {}

-- System --

f = SimpleForm("system", "System")
f.submit = false
f.reset = false
local system, model, memtotal, memcached, membuffers, memfree = luci.sys.sysinfo()
local uptime = luci.sys.uptime()

f:field(DummyValue, "_system", translate("system")).value = system
f:field(DummyValue, "_cpu", translate("m_i_processor")).value = model

local load1, load5, load15 = luci.sys.loadavg()
f:field(DummyValue, "_la", translate("load")).value =
string.format("%.2f, %.2f, %.2f", load1, load5, load15)

f:field(DummyValue, "_memtotal", translate("m_i_memory")).value =
string.format("%.2f MB (%.0f%% %s, %.0f%% %s, %.0f%% %s)",
	tonumber(memtotal) / 1024,
	100 * memcached / memtotal,
	tostring(translate("mem_cached"), "")),
	100 * membuffers / memtotal,
	tostring(translate("mem_buffered", "")),
	100 * memfree / memtotal,
	tostring(translate("mem_free", ""))

f:field(DummyValue, "_systime", translate("m_i_systemtime")).value =
os.date("%c")

f:field(DummyValue, "_uptime", translate("m_i_uptime")).value =
luci.tools.webadmin.date_format(tonumber(uptime))


-- Wireless --

local wireless = uci:get_all("wireless")
local wifidata = luci.sys.wifi.getiwconfig()
local ifaces = {}

for k, v in pairs(wireless) do
	if v[".type"] == "wifi-iface" and (
		luci.util.contains(ffwifs, v.device) or
		( #ffwifs == 0 and (not v.encryption or v.encryption == "none") ) )
	then
		table.insert(ifaces, v)
	end
end


m = SimpleForm("wireless", "Freifunk WLAN")
m.submit = false
m.reset = false

s = m:section(Table, ifaces, translate("networks"))

link = s:option(DummyValue, "_link", translate("link"))
function link.cfgvalue(self, section)
	local ifname = self.map:get(section, "ifname")
	return wifidata[ifname] and wifidata[ifname]["Link Quality"] or "-"
end

essid = s:option(DummyValue, "ssid", "ESSID")

bssid = s:option(DummyValue, "_bsiid", "BSSID")
function bssid.cfgvalue(self, section)
	local ifname = self.map:get(section, "ifname")
	return (wifidata[ifname] and (wifidata[ifname].Cell
		or wifidata[ifname]["Access Point"])) or "-"
end

channel = s:option(DummyValue, "channel", translate("channel"))
	function channel.cfgvalue(self, section)
	return wireless[self.map:get(section, "device")].channel
end

protocol = s:option(DummyValue, "_mode", translate("protocol"))
function protocol.cfgvalue(self, section)
	local mode = wireless[self.map:get(section, "device")].mode
	return mode and "802." .. mode
end

mode = s:option(DummyValue, "mode", translate("mode"))
encryption = s:option(DummyValue, "encryption", translate("iwscan_encr"))

power = s:option(DummyValue, "_power", translate("power"))
function power.cfgvalue(self, section)
	local ifname = self.map:get(section, "ifname")
	return wifidata[ifname] and wifidata[ifname]["Tx-Power"] or "-"
end

scan = s:option(Button, "_scan", translate("scan"))
scan.inputstyle = "find"

function scan.cfgvalue(self, section)
	return self.map:get(section, "ifname") or false
end

t2 = m:section(Table, {}, translate("iwscan"), translate("iwscan1"))

function scan.write(self, section)
	t2.render = t2._render
	local ifname = self.map:get(section, "ifname")
	luci.util.update(t2.data, luci.sys.wifi.iwscan(ifname))
end

t2._render = t2.render
t2.render = function() end

t2:option(DummyValue, "Quality", translate("iwscan_link"))
essid = t2:option(DummyValue, "ESSID", "ESSID")
function essid.cfgvalue(self, section)
	return luci.util.pcdata(self.map:get(section, "ESSID"))
end

t2:option(DummyValue, "Address", "BSSID")
t2:option(DummyValue, "Mode", translate("mode"))
chan = t2:option(DummyValue, "channel", translate("channel"))
function chan.cfgvalue(self, section)
	return self.map:get(section, "Channel")
	or self.map:get(section, "Frequency")
	or "-"
end

t2:option(DummyValue, "Encryption key", translate("iwscan_encr"))

t2:option(DummyValue, "Signal level", translate("iwscan_signal"))

t2:option(DummyValue, "Noise level", translate("iwscan_noise"))


-- Routes --
r = SimpleForm("routes", "Standardrouten")
r.submit = false
r.reset = false

local routes = {}
for i, route in ipairs(luci.sys.net.routes()) do
	if route.dest:prefix() == 0 then
		routes[#routes+1] = route
	end
end

v = r:section(Table, routes)

net = v:option(DummyValue, "iface", translate("network"))
function net.cfgvalue(self, section)
	return luci.tools.webadmin.iface_get_network(routes[section].device)
	or routes[section].device
end

target  = v:option(DummyValue, "target", translate("target"))
function target.cfgvalue(self, section)
	return routes[section].dest:network():string()
end

netmask = v:option(DummyValue, "netmask", translate("netmask"))
function netmask.cfgvalue(self, section)
	return routes[section].dest:mask():string()
end

gateway = v:option(DummyValue, "gateway", translate("gateway"))
function gateway.cfgvalue(self, section)
	return routes[section].gateway:string()
end

metric = v:option(DummyValue, "metric", translate("metric"))
function metric.cfgvalue(self, section)
	return routes[section].metric
end


local routes6 = {}
for i, route in ipairs(luci.sys.net.routes6() or {}) do
	if route.dest:prefix() == 0 then
		routes6[#routes6+1] = route
	end
end

if #routes6 > 0 then
	v6 = r:section(Table, routes6)

	net = v6:option(DummyValue, "iface", translate("network"))
	function net.cfgvalue(self, section)
		return luci.tools.webadmin.iface_get_network(routes6[section].device)
		or routes6[section].device
	end

	target  = v6:option(DummyValue, "target", translate("target"))
	function target.cfgvalue(self, section)
		return routes6[section].dest:string()
	end

	gateway = v6:option(DummyValue, "gateway6", translate("gateway6"))
	function gateway.cfgvalue(self, section)
		return routes6[section].source:string()
	end

	metric = v6:option(DummyValue, "metric", translate("metric"))
	function metric.cfgvalue(self, section)
		local metr = routes6[section].metric
		local lower = bit.band(metr, 0xffff)
		local higher = bit.rshift(bit.band(metr, 0xffff0000), 16)
		return "%04X%04X" % {higher, lower}
	end
end

return f, m, r
