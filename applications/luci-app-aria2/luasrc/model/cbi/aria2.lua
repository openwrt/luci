--[[
RA-MOD
]]--

local fs = require "nixio.fs"
local util = require "nixio.util"

local running=(luci.sys.call("pidof aria2c > /dev/null") == 0)
yaaw="&nbsp;&nbsp;&nbsp;&nbsp;<input type=\"button\" value=\" " .. "yaaw" .. " \" onclick=\"window.open('http://binux.github.io/yaaw/demo')\"/>"
aria2_webui="&nbsp;&nbsp;&nbsp;&nbsp;<input type=\"button\" value=\" " .. "aria2-webui" .. " \" onclick=\"window.open('http://ziahamza.github.io/webui-aria2')\"/>"

if running then
	m = Map("aria2", translate("aria2"), translate("aria2 is running") .. yaaw .. aria2_webui)
else
	m = Map("aria2", translate("aria2"), translate("aria2 is not running,make sure you have mounted USB Storage device"))
end

s = m:section(TypedSection, "aria2", translate("Settings"))
s.anonymous = true

s:tab("basic",  translate("Basic Settings"))

switch = s:taboption("basic", Flag, "enabled", translate("Enable"))
switch.rmempty = false

local devices = {}
util.consume((fs.glob("/dev/sd??*")), devices)

device = s:taboption("basic", ListValue, "device", translate("Device"))
for i, dev in ipairs(devices) do
	device:value(dev)
end

download_folder = s:taboption("basic", Value, "download_folder", translate("Download Folder"), translate("Where Your Files Save"))
download_folder.default = "Downloads"
download_folder.placeholder = "Downloads"

maxjobs = s:taboption("basic", Value, "maxjobs", translate("Max Concurrent Queue"), translate("Default 5"))
maxjobs.default = "5"
maxjobs.placeholder = "5"
maxjobs.datatype = "uinteger"

diskcache = s:taboption("basic", ListValue, "diskcache", translate("Enable Disk Cache"))
diskcache:value("1M")
diskcache:value("2M")
diskcache:value("4M")
diskcache:value("8M")

s:tab("editconf", translate("Edit Configuration"))
editconf = s:taboption("editconf", Value, "conf", 
	translate("You can customize aria2 configuration here"), 
	translate("Comment Using #"))
editconf.template = "cbi/tvalue"
editconf.rows = 20
editconf.wrap = "off"

function editconf.cfgvalue(self, section)
	return fs.readfile("/etc/aria2/aria2.conf") or ""
end
function editconf.write(self, section, value)
	if value then
		value = value:gsub("\r\n?", "\n")
		fs.writefile("/tmp/aria2.conf", value)
		if (luci.sys.call("cmp -s /tmp/aria2.conf /etc/aria2/aria2.conf") == 1) then
			fs.writefile("/etc/aria2/aria2.conf", value)
		end
		fs.remove("/tmp/aria2.conf")
	end
end

-- Network
network=m:section(TypedSection, "aria2", translate("Network"))
network.anonymous = true

maxthread = network:option(Value, "maxthread", translate("Max Thread"), translate("Default 5"))
maxthread.default = "5"
maxthread.placeholder = "5"
maxthread.datatype = "uinteger"

download_limit = network:option(Value, "download_limit", translate("Download Limit"), translate("Default Bytes"))
download_limit.default = "0"
download_limit.placeholder = "0"

upload_limit = network:option(Value, "upload_limit", translate("Upload Limit"), translate("Default Bytes"))
upload_limit.default = "0"
upload_limit.placeholder = "0"

tcp_port = network:option(Value, "tcp_port", translate("TCP Port"), translate("Default 51413"))
tcp_port.default = "51413"
tcp_port.placeholder = "51413"
tcp_port.datatype = "portrange"

udp_port = network:option(Value, "udp_port", translate("UDP Port"), translate("Default 51413"))
udp_port.default = "51413"
udp_port.placeholder = "51413"
udp_port.datatype = "portrange"

bt_maxpeers = network:option(Value, "btmaxpeers", translate("BT/PT Max Peers"), translate("Recommand 25"))
bt_maxpeers.datatype = "uinteger"
bt_maxpeers.default = "25"
bt_maxpeers.placeholder = "25"

seedtime = network:option(Value, "seedtime", translate("Seed Time"), translate("Minute"))
seedtime.default = "525600"
seedtime.placeholder = "525600"
seedtime.datatype = "uinteger"

-- Authentication
rpc=m:section(TypedSection, "aria2", translate("Authentication"))
rpc.anonymous = true
rpc_auth = rpc:option(Flag, "rpc_auth", translate("Enable"))
rpc_auth.default = false
rpc_token = rpc:option(Value, "rpc_token", translate("RPC secret authorization token"))
rpc_token.default = ""
rpc_token:depends("rpc_auth", 1)

-- Subtitle
autosub=m:section(TypedSection, "aria2", translate("Auto Download Subtitle"))
autosub.anonymous = true

autosub_enable = autosub:option(Flag, "autosub_enable", translate("Enable"))
autosub_enable.default = false

autosub_filetype = autosub:option(Value, "autosub_filetype", translate("FileType"), translate("Separate with Comma"))
autosub_filetype.placeholder = "avi,mkv"
autosub_filetype.default = "avi,mkv"
autosub_filetype:depends("autosub_enable", 1)

return m
