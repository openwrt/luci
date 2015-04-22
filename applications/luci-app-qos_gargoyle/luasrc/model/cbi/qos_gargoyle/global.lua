
local wa = require "luci.tools.webadmin"
local fs = require "nixio.fs"
require "luci.sys"
local qos_gargoyle_enabled=luci.sys.init.enabled("qos_gargoyle")

m = Map("qos_gargoyle", translate("Global"),translate("Global set"))


s = m:section(TypedSection, "global", translate("Global"), translate("<b><font color=\"#FF0000\" size=\"4\"></font></b>"))

s.anonymous = true
--s.sortable  = true
local count = 0
for line in io.lines("/etc/config/qos_gargoyle") do
	line = string.match(line, "config ['\"]*global['\"]* ")
	if line ~= nil then
		count = count + 1
	end
end
if count == 0 then
	os.execute("echo \"\nconfig global 'global'\" >> /etc/config/qos_gargoyle")
end

e = s:option(Button, "endisable", " ", translate("Toggle QoS here."))
e.render = function(self, section, scope)
	if qos_gargoyle_enabled then
		self.title = translate("Disable QoS")
		self.inputstyle = "reset"
	else
		self.title = translate("Enable QoS")
		self.inputstyle = "apply"
	end
	Button.render(self, section, scope)
end

e.write = function(self, section)
	if qos_gargoyle_enabled then
		qos_gargoyle_enabled=false
		luci.sys.call("/etc/init.d/qos_gargoyle stop >/dev/null")
		return luci.sys.init.disable("qos_gargoyle")
	else
		qos_gargoyle_enabled=true
		luci.sys.call("/etc/init.d/qos_gargoyle restart >/dev/null")
		return luci.sys.init.enable("qos_gargoyle")
	end
end

network = s:option(Value, "network", translate("network"),translate("Choose an interface that QoS should be applied to."))
network.default = ""
wa.cbi_add_networks(network)

mtu = s:option(Value, "mtu", translate("mtu"))
mtu.datatype = "and(uinteger,min(1))"

s = m:section(TypedSection, "upload", translate("UpLoad"))
s.anonymous = true

uclass = s:option(Value, "default_class", translate("default_class"))
uclass.rmempty = "true"
for line in io.lines("/etc/config/qos_gargoyle") do
	local str = line
	line = string.gsub(line, "config ['\"]*upload_class['\"]* ", "")
	if str ~= line then
		line = string.gsub(line, "^'", "")
		line = string.gsub(line, "^\"", "")
		line = string.gsub(line, "'$", "")
		line = string.gsub(line, "\"$", "")
		uclass:value(line, translate(m.uci:get("qos_gargoyle", line, "name")))
	end
end

tb = s:option(Value, "total_bandwidth", translate("total_bandwidth"), translate("In KBit/s."))
tb.datatype = "and(uinteger,min(1))"


s = m:section(TypedSection, "download", translate("DownLoad"))
s.anonymous = true

dclass = s:option(Value, "default_class", translate("default_class"))
dclass.rmempty = "true"
for l in io.lines("/etc/config/qos_gargoyle") do
	local s = l
	l = string.gsub(l, "config ['\"]*download_class['\"]* ", "")
	if s ~= l then
		l = string.gsub(l, "^'", "")
		l = string.gsub(l, "^\"", "")
		l = string.gsub(l, "'$", "")
		l = string.gsub(l, "\"$", "")
		dclass:value(l, translate(m.uci:get("qos_gargoyle", l, "name")))
	end
end

tb = s:option(Value, "total_bandwidth", translate("total_bandwidth"), translate("In KBit/s."))
tb.datatype = "and(uinteger,min(1))"

return m
