local readmeURL = "https://github.com/openwrt/packages/tree/master/net/vpn-policy-routing/files/README.md"

local packageName = "vpn-policy-routing"
local uci = require "luci.model.uci".cursor()
local sys = require "luci.sys"
local util = require "luci.util"
local ip = require "luci.ip"
local fs = require "nixio.fs"
local jsonc = require "luci.jsonc"
local http = require "luci.http"
local nutil = require "nixio.util"
local dispatcher = require "luci.dispatcher"
local enabledFlag = uci:get(packageName, "config", "enabled")
local enc

function getPackageVersion()
	local opkgFile = "/usr/lib/opkg/status"
	local line
	local flag = false
	for line in io.lines(opkgFile) do
		if flag then
			return line:match('[%d%.$-]+') or ""
		elseif line:find("Package: " .. packageName:gsub("%-", "%%%-")) then
			flag = true
		end
	end
	return ""
end

local ubusStatus = util.ubus("service", "list", { name = packageName })
if ubusStatus and ubusStatus[packageName] and 
	 ubusStatus[packageName]["instances"] and 
	 ubusStatus[packageName]["instances"]["main"] and 
	 ubusStatus[packageName]["instances"]["main"]["data"] and
	 ubusStatus[packageName]["instances"]["main"]["data"]["status"] and 
	 ubusStatus[packageName]["instances"]["main"]["data"]["status"][1] then
	serviceGateways = ubusStatus[packageName]["instances"]["main"]["data"]["status"][1]["gateway"]
	serviceGateways = serviceGateways and serviceGateways:gsub('\\n', '\n')
	serviceGateways = serviceGateways and serviceGateways:gsub('\\033%[0;32m%[\\xe2\\x9c\\x93%]\\033%[0m', '✓')
	serviceErrors = ubusStatus[packageName]["instances"]["main"]["data"]["status"][1]["error"]
	serviceErrors = serviceErrors and serviceErrors:gsub('\\n', '\n')
	serviceErrors = serviceErrors and serviceErrors:gsub('\\033%[0;31mERROR\\033%[0m: ', '')
	serviceWarnings = ubusStatus[packageName]["instances"]["main"]["data"]["status"][1]["warning"]
	serviceWarnings = serviceWarnings and serviceWarnings:gsub('\\n', '\n')
	serviceWarnings = serviceWarnings and serviceWarnings:gsub('\\033%[0;33mWARNING\\033%[0m: ', '')
	serviceMode = ubusStatus[packageName]["instances"]["main"]["data"]["status"][1]["mode"]
end

local serviceRunning, statusText = false, nil
local packageVersion = getPackageVersion()
if packageVersion == "" then
	statusText = translatef("%s is not installed or not found", packageName)
end 
if sys.call("iptables -t mangle -L | grep -q VPR_PREROUTING") == 0 then
	serviceRunning = true
	statusText = translate("Running")
	if serviceMode and serviceMode == "strict" then
		statusText = translatef("%s (strict mode)", statusText)
	end
else
	statusText = translate("Stopped")
	if uci:get(packageName, "config", "enabled") ~= "1" then
		statusText = translatef("%s (disabled)", statusText)
	end
end

local t = uci:get("vpn-policy-routing", "config", "supported_interface")
if not t then
	supportedIfaces = ""
elseif type(t) == "table" then
	for key,value in pairs(t) do supportedIfaces = supportedIfaces and supportedIfaces .. ' ' .. value or value end
elseif type(t) == "string" then
	supportedIfaces = t
end

t = uci:get("vpn-policy-routing", "config", "ignored_interface")
if not t then
	ignoredIfaces = ""
elseif type(t) == "table" then
	for key,value in pairs(t) do ignoredIfaces = ignoredIfaces and ignoredIfaces .. ' ' .. value or value end
elseif type(t) == "string" then
	ignoredIfaces = t
end

local lanIPAddr = uci:get("network", "lan", "ipaddr")
local lanNetmask = uci:get("network", "lan", "netmask")
-- if multiple ip addresses on lan interface, will be returned as table of CIDR notations i.e. {"10.0.0.1/24","10.0.0.2/24"}
if (type(lanIPAddr) == "table") then
				first = true
				for i,line in ipairs(lanIPAddr) do
								lanIPAddr = lanIPAddr[i]
								break
				end
				lanIPAddr = lanIPAddr:match("[0-9.]+")
end
if lanIPAddr and lanNetmask then
	laPlaceholder = ip.new(lanIPAddr .. "/" .. lanNetmask )
end

function is_wan(name)
	return name:sub(1,3) == "wan" or name:sub(-3) == "wan"
end

function is_supported_interface(arg)
	local name=arg['.name']
	local proto=arg['proto']
	local ifname=arg['ifname']

	if name and is_wan(name) then return true end
	if name and supportedIfaces:match('%f[%w]' .. name .. '%f[%W]') then return true end
	if name and not ignoredIfaces:match('%f[%w]' .. name .. '%f[%W]') then
		if type(ifname) == "table" then
			for key,value in pairs(ifname) do
				if value and value:sub(1,3) == "tun" then return true end
				if value and value:sub(1,3) == "tap" then return true end
				if value and value:sub(1,3) == "tor" then return true end
				if value and fs.access("/sys/devices/virtual/net/" .. value .. "/tun_flags") then return true end
			end
		elseif type(ifname) == "string" then
			if ifname and ifname:sub(1,3) == "tun" then return true end
			if ifname and ifname:sub(1,3) == "tap" then return true end
			if ifname and ifname:sub(1,3) == "tor" then return true end
			if ifname and fs.access("/sys/devices/virtual/net/" .. ifname .. "/tun_flags") then return true end
		end
		if proto and proto:sub(1,11) == "openconnect" then return true end
		if proto and proto:sub(1,4) == "pptp" then return true end
		if proto and proto:sub(1,4) == "l2tp" then return true end
		if proto and proto:sub(1,9) == "wireguard" then return true end
	end
end

m = Map("vpn-policy-routing", translate("VPN and WAN Policy-Based Routing"))

h = m:section(NamedSection, "config", packageName, translatef("Service Status [%s %s]", packageName, packageVersion))
status = h:option(DummyValue, "_dummy", translate("Service Status"))
status.template = "vpn-policy-routing/status"
status.value = statusText
if serviceRunning and serviceGateways and serviceGateways ~= "" then
	gateways = h:option(DummyValue, "_dummy", translate("Service Gateways"))
	gateways.template = packageName .. "/status-gateways"
	gateways.value = serviceGateways
end
if serviceErrors and serviceErrors ~= "" then
	errors = h:option(DummyValue, "_dummy", translate("Service Errors"))
	errors.template = packageName .. "/status-textarea"
	errors.value = serviceErrors
end
if serviceWarnings and serviceWarnings ~= "" then
	warnings = h:option(DummyValue, "_dummy", translate("Service Warnings"))
	warnings.template = packageName .. "/status-textarea"
	warnings.value = serviceWarnings
end
if packageVersion ~= "" then
	buttons = h:option(DummyValue, "_dummy")
	buttons.template = packageName .. "/buttons"
end

-- General Options
config = m:section(NamedSection, "config", "vpn-policy-routing", translate("Configuration"))
config.override_values = true
config.override_depends = true

-- Basic Options
config:tab("basic", translate("Basic Configuration"))

verb = config:taboption("basic", ListValue, "verbosity", translate("Output verbosity"), translate("Controls both system log and console output verbosity."))
verb:value("0", translate("Suppress/No output"))
verb:value("1", translate("Condensed output"))
verb:value("2", translate("Verbose output"))
verb.default = 2

se = config:taboption("basic", ListValue, "strict_enforcement", translate("Strict enforcement"),
	translatef("See the %sREADME%s for details.", "<a href=\"" .. readmeURL .. "#strict-enforcement" .. "\" target=\"_blank\">", "</a>"))
se:value("0", translate("Do not enforce policies when their gateway is down"))
se:value("1", translate("Strictly enforce policies when their gateway is down"))
se.default = 1

dest_ipset = config:taboption("basic", ListValue, "dest_ipset", translate("The ipset option for remote policies"),
	translatef("Please check the %sREADME%s before changing this option.", "<a href=\"" .. readmeURL .. "#service-configuration-settings" .. "\" target=\"_blank\">", "</a>"))
dest_ipset:value("", translate("Disabled"))
dest_ipset:value("ipset", translate("Use ipset command"))
dest_ipset:value("dnsmasq.ipset", translate("Use DNSMASQ ipset"))
dest_ipset.default = ""
dest_ipset.rmempty = true

src_ipset = config:taboption("basic", ListValue, "src_ipset", translate("The ipset option for local policies"),
	translatef("Please check the %sREADME%s before changing this option.", "<a href=\"" .. readmeURL .. "#service-configuration-settings" .. "\" target=\"_blank\">", "</a>"))
src_ipset:value("0", translate("Disabled"))
src_ipset:value("1", translate("Use ipset command"))

ipv6 = config:taboption("basic", ListValue, "ipv6_enabled", translate("IPv6 Support"))
ipv6:value("0", translate("Disabled"))
ipv6:value("1", translate("Enabled"))

-- Advanced Options
config:tab("advanced", translate("Advanced Configuration"),
	translatef("%sWARNING:%s Please make sure to check the %sREADME%s before changing anything in this section! Change any of the settings below with extreme caution!%s" , "<br/>&nbsp;&nbsp;&nbsp;&nbsp;<b>", "</b>", "<a href=\"" .. readmeURL .. "#service-configuration-settings" .. "\" target=\"_blank\">", "</a>", "<br/><br/>"))

supportedIface = config:taboption("advanced", DynamicList, "supported_interface", translate("Supported Interfaces"), translate("Allows to specify the list of interface names (in lower case) to be explicitly supported by the service. Can be useful if your OpenVPN tunnels have dev option other than tun* or tap*."))
supportedIface.optional = false

ignoredIface = config:taboption("advanced", DynamicList, "ignored_interface", translate("Ignored Interfaces"), translate("Allows to specify the list of interface names (in lower case) to be ignored by the service. Can be useful if running both VPN server and VPN client on the router."))
ignoredIface.optional = false

timeout = config:taboption("advanced", Value, "boot_timeout", translate("Boot Time-out"), translate("Time (in seconds) for service to wait for WAN gateway discovery on boot."))
timeout.optional = false
timeout.rmempty = true

insert = config:taboption("advanced", ListValue, "iptables_rule_option", translate("IPTables rule option"), translate("Select Append for -A and Insert for -I."))
insert:value("append", translate("Append"))
insert:value("insert", translate("Insert"))
insert.default = "append"

iprule = config:taboption("advanced", ListValue, "iprule_enabled", translate("IP Rules Support"), translate("Add an ip rule, not an iptables entry for policies with just the local address. Use with caution to manipulte policies priorities."))
iprule:value("0", translate("Disabled"))
iprule:value("1", translate("Enabled"))

icmp = config:taboption("advanced", ListValue, "icmp_interface", translate("Default ICMP Interface"), translate("Force the ICMP protocol interface."))
icmp:value("", translate("No Change"))
icmp:value("wan", translate("WAN"))
uci:foreach("network", "interface", function(s)
	local name=s['.name']
	if is_supported_interface(s) then icmp:value(name, name:upper()) end
end)
icmp.rmempty = true

append_local = config:taboption("advanced", Value, "append_src_rules", translate("Append local IP Tables rules"), translate("Special instructions to append iptables rules for local IPs/netmasks/devices."))
append_local.rmempty = true

append_remote = config:taboption("advanced", Value, "append_dest_rules", translate("Append remote IP Tables rules"), translate("Special instructions to append iptables rules for remote IPs/netmasks."))
append_remote.rmempty = true

wantid = config:taboption("advanced", Value, "wan_tid", translate("WAN Table ID"), translate("Starting (WAN) Table ID number for tables created by the service."))
wantid.rmempty = true
wantid.placeholder = "201"
wantid.datatype    = 'and(uinteger, min(201))'

wanmark = config:taboption("advanced", Value, "wan_mark", translate("WAN Table FW Mark"), translate("Starting (WAN) FW Mark for marks used by the service. High starting mark is used to avoid conflict with SQM/QoS. Change with caution together with") .. " " .. translate("Service FW Mask") .. ".")
wanmark.rmempty = true
wanmark.placeholder = "0x010000"
wanmark.datatype    = "hex(8)"

fwmask = config:taboption("advanced", Value, "fw_mask", translate("Service FW Mask"), translate("FW Mask used by the service. High mask is used to avoid conflict with SQM/QoS. Change with caution together with") .. " " .. translate("WAN Table FW Mark") .. ".")
fwmask.rmempty = true
fwmask.placeholder = "0xff0000"
fwmask.datatype    = "hex(8)"

config:tab("webui", translate("Web UI Configuration"))

webui_enable_column = config:taboption("webui", ListValue, "webui_enable_column", translate("Show Enable Column"), translate("Shows the enable checkbox column for policies, allowing you to quickly enable/disable specific policy without deleting it."))
webui_enable_column:value("0", translate("Disabled"))
webui_enable_column:value("1", translate("Enabled"))

webui_protocol_column = config:taboption("webui", ListValue, "webui_protocol_column", translate("Show Protocol Column"), translate("Shows the protocol column for policies, allowing you to assign a specific protocol to a policy."))
webui_protocol_column:value("0", translate("Disabled"))
webui_protocol_column:value("1", translate("Enabled"))

webui_supported_protocol = config:taboption("webui", DynamicList, "webui_supported_protocol", translate("Supported Protocols"), translate("Display these protocols in protocol column in Web UI."))
webui_supported_protocol.optional = false

webui_chain_column = config:taboption("webui", ListValue, "webui_chain_column", translate("Show Chain Column"), translate("Shows the chain column for policies, allowing you to assign a PREROUTING, FORWARD, INPUT or OUTPUT chain to a policy."))
webui_chain_column:value("0", translate("Disabled"))
webui_chain_column:value("1", translate("Enabled"))

webui_sorting = config:taboption("webui", ListValue, "webui_sorting", translate("Show Up/Down Buttons"), translate("Shows the Up/Down buttons for policies, allowing you to move a policy up or down in the list."))
webui_sorting:value("0", translate("Disabled"))
webui_sorting:value("1", translate("Enabled"))
webui_sorting.default = "1"


-- Policies
p = m:section(TypedSection, "policy", translate("Policies"), translate("Comment, interface and at least one other field are required. Multiple local and remote addresses/devices/domains and ports can be space separated. Placeholders below represent just the format/syntax and will not be used if fields are left blank."))
p.template = "cbi/tblsection"
enc = tonumber(uci:get("vpn-policy-routing", "config", "webui_sorting"))
if not enc or enc ~= 0 then
	p.sortable  = true
end
p.anonymous = true
p.addremove = true

enc = tonumber(uci:get("vpn-policy-routing", "config", "webui_enable_column"))
if enc and enc ~= 0 then
	le = p:option(Flag, "enabled", translate("Enabled"))
	le.default = "1"
end

local comment = uci:get_first("vpn-policy-routing", "policy", "comment")
if comment then
	p:option(Value, "comment", translate("Comment"))
else
	p:option(Value, "name", translate("Name"))
end

la = p:option(Value, "src_addr", translate("Local addresses / devices"))
if laPlaceholder then
	la.placeholder = laPlaceholder
end
la.rmempty = true
la.datatype    = 'list(neg(or(host,network,macaddr,string)))'

lp = p:option(Value, "src_port", translate("Local ports"))
lp.datatype    = 'list(neg(or(portrange, string)))'
lp.placeholder = "0-65535"
lp.rmempty = true

ra = p:option(Value, "dest_addr", translate("Remote addresses / domains"))
ra.datatype    = 'list(neg(host))'
ra.placeholder = "0.0.0.0/0"
ra.rmempty = true

rp = p:option(Value, "dest_port", translate("Remote ports"))
rp.datatype    = 'list(neg(or(portrange, string)))'
rp.placeholder = "0-65535"
rp.rmempty = true

enc = tonumber(uci:get("vpn-policy-routing", "config", "webui_protocol_column"))
if enc and enc ~= 0 then
	proto = p:option(ListValue, "proto", translate("Protocol"))
	proto:value("", "AUTO")
	proto.default = ""
	proto.rmempty = true
	enc = uci:get_list("vpn-policy-routing", "config", "webui_supported_protocol")
	local count = 0
	for key, value in pairs(enc) do
		count = count + 1
		proto:value(value:lower(), value:gsub(" ", "/"):upper())
	end
	if count == 0 then
		enc = { "tcp", "udp", "tcp udp", "icmp", "all" }
		for key,value in pairs(enc) do
			proto:value(value:lower(), value:gsub(" ", "/"):upper())
		end
	end
end

enc = tonumber(uci:get("vpn-policy-routing", "config", "webui_chain_column"))
if enc and enc ~= 0 then
	chain = p:option(ListValue, "chain", translate("Chain"))
	chain:value("", "PREROUTING")
	chain:value("FORWARD", "FORWARD")
	chain:value("INPUT", "INPUT")
	chain:value("OUTPUT", "OUTPUT")
	chain.default = ""
	chain.rmempty = true
end

gw = p:option(ListValue, "interface", translate("Interface"))
gw.datatype = "network"
gw.rmempty = false
uci:foreach("network", "interface", function(s)
	local name=s['.name']
	if is_wan(name) then
		gw:value(name, name:upper())
		if not gw.default then gw.default = name end
	elseif is_supported_interface(s) then 
		gw:value(name, name:upper()) 
	end
end)

dscp = m:section(NamedSection, "config", "vpn-policy-routing", translate("DSCP Tagging"), 
	translatef("Set DSCP tags (in range between 1 and 63) for specific interfaces. See the %sREADME%s for details.", "<a href=\"" .. readmeURL .. "#dscp-tag-based-policies" .. "\" target=\"_blank\">", "</a>"))
uci:foreach("network", "interface", function(s)
	local name=s['.name']
	if is_supported_interface(s) then 
		local x = dscp:option(Value, name .. "_dscp", name:upper() .. " " .. translate("DSCP Tag"))
		x.rmempty = true
		x.datatype = "range(1,63)"
	end
end)

-- Includes
inc = m:section(TypedSection, "include", translate("Custom User File Includes"), 
	translatef("Run the following user files after setting up but before restarting DNSMASQ. See the %sREADME%s for details.", "<a href=\"" .. readmeURL .. "#custom-user-files" .. "\" target=\"_blank\">", "</a>"))
inc.template = "cbi/tblsection"
inc.sortable  = true
inc.anonymous = true
inc.addremove = true

finc = inc:option(Flag, "enabled", translate("Enabled"))
finc.optional = false
finc.default = "1"
inc:option(Value, "path", translate("Path")).optional = false

return m
