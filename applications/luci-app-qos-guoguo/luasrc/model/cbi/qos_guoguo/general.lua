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
tb.datatype = "and(uinteger,min(0))"

monen = s:option(ListValue, "qos_monenabled", translate("Enable Active Congestion Control"),
	translate("<p>The active congestion control (ACC) observes your download activity and automatically adjusts your download link limit to maintain proper QoS performance. ACC automatically compensates for changes in your ISP's download speed and the demand from your network adjusting the link speed to the highest speed possible which will maintain proper QoS function. The effective range of this control is between 15% and 100% of the total download bandwidth you entered above.</p>") .. 
	translate("<p>While ACC does not adjust your upload link speed you must enable and properly configure your upload QoS for it to function properly.</p>") ..
	translate("<p><em>Ping Target-</em> The segment of network between your router and the ping target is where congestion is controlled. By monitoring the round trip ping times to the target congestion is detected. By default ACC uses your WAN gateway as the ping target. If you know that congestion on your link will occur in a different segment then you can enter an alternate ping target.</p>") ..
	translate("<p><em>Manual Ping Limit</em> Round trip ping times are compared against the ping limits. ACC controls the link limit to maintain ping times under the appropriate limit. By default ACC attempts to automatically select appropriate target ping limits for you based on the link speeds you entered and the performance of your link it measures during initialization. You cannot change the target ping time for the minRTT mode but by entering a manual time you can control the target ping time of the active mode. The time you enter becomes the increase in the target ping time between minRTT and active mode.")
	)
monen:value("true",translate("Enable"))
monen:value("false",translate("Disable"))
monen.default = "false"

ptip = s:option(Value, "ptarget_ip", translate("Use non-standard ping target"),translate("Specify a custom ping target here if you want.Leave empty to use the default settings."))
ptip.datatype = "ipaddr"
ptip:depends({qos_monenabled="true"})

ptime = s:option(Value, "pinglimit", translate("Manual Ping Limit"),translate("Specify a custom ping time limit here if you want.Leave empty to use the default settings."))
ptime.datatype = "range(100,2000)"
ptime:depends({qos_monenabled="true"})

return m
