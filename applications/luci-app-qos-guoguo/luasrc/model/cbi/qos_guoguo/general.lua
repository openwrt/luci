--[[
luci for QoS by GuoGuo
Based on luci-app-qos-gargoyle.
]]--

local wa = require "luci.tools.webadmin"
local fs = require "nixio.fs"
require "luci.sys"
local qos_gargoyle_enabled=luci.sys.init.enabled("qos_guoguo")

m = Map("qos_guoguo", translate("General Settings"), translate("QoS by GuoGuo.Based on the QoS scripts in Gargoyle firmware."))


s = m:section(TypedSection, "global", translate("Toggle"), translate("Toggle QoS here."))

s.anonymous = true

e = s:option(Button, "endisable", " ", " ")
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
		luci.sys.call("/etc/init.d/qos_guoguo stop >/dev/null")
		return luci.sys.init.disable("qos_guoguo")
	else
		qos_gargoyle_enabled=true
		luci.sys.call("/etc/init.d/qos_guoguo restart >/dev/null")
		return luci.sys.init.enable("qos_guoguo")
	end
end

s = m:section(TypedSection, "upload", translate("Upload Settings"))
s.anonymous = true

uclass = s:option(Value, "default_class", translate("Default Service Class"), translate("The <em>Default Service Class</em> specifies how packets that do not match any rule should be classified."))
uclass.rmempty = "true"
for line in io.lines("/etc/config/qos_guoguo") do
	local str = line
	line = string.gsub(line, "config ['\"]*upload_class['\"]* ", "")
	if str ~= line then
		line = string.gsub(line, "^'", "")
		line = string.gsub(line, "^\"", "")
		line = string.gsub(line, "'$", "")
		line = string.gsub(line, "\"$", "")
		uclass:value(line, m.uci:get("qos_guoguo", line, "name"))
	end
end

tb = s:option(Value, "total_bandwidth", translate("Total Upload Bandwidth"), translate("<em>Total Upload Bandwidth</em> should be set to around 98% of your available upload bandwidth. Entering a number which is too high will result in QoS not meeting its class requirements. Entering a number which is too low will needlessly penalize your upload speed. You should use a speed test program (with QoS off) to determine available upload bandwidth. Note that bandwidth is specified in kbps. There are 8 kilobits per kilobyte."))
tb.datatype = "and(uinteger,min(0))"


s = m:section(TypedSection, "download", translate("Download Settings"))
s.anonymous = true

dclass = s:option(Value, "default_class", translate("Default Service Class"), translate("The <em>Default Service Class</em> specifies how packets that do not match any rule should be classified."))
dclass.rmempty = "true"
for l in io.lines("/etc/config/qos_guoguo") do
	local s = l
	l = string.gsub(l, "config ['\"]*download_class['\"]* ", "")
	if s ~= l then
		l = string.gsub(l, "^'", "")
		l = string.gsub(l, "^\"", "")
		l = string.gsub(l, "'$", "")
		l = string.gsub(l, "\"$", "")
		dclass:value(l, translate(m.uci:get("qos_guoguo", l, "name")))
	end
end

tb = s:option(Value, "total_bandwidth", translate("Total Download Bandwidth"), translate("Specifying <em>Total Download Bandwidth</em> correctly is crucial to making QoS work.Note that bandwidth is specified in kbps. There are 8 kilobits per kilobyte."))
tb.datatype = "and(uinteger,min(1))"

return m
