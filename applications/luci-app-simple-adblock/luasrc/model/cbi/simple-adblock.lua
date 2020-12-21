-- Copyright 2016-2018 Stan Grishin <stangri@melmac.net>
-- Licensed to the public under the Apache License 2.0.

local packageName = "simple-adblock"
local readmeURL = "https://docs.openwrt.melmac.net/" .. packageName .. "/"
local uci = require "luci.model.uci".cursor()
local util = require "luci.util"
local sys = require "luci.sys"
local jsonc = require "luci.jsonc"
local fs = require "nixio.fs"
local nutil = require "nixio.util"
local http = require "luci.http"
local dispatcher = require "luci.dispatcher"

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

function getFileLines(file)
	local f = io.open(file)
	if f then
		local t = f:read("*a")
		local _,n = t:gsub("\n","")
		f:close()
		return n
	else 
		return "0"
	end
end

function checkDnsmasq() return fs.access("/usr/sbin/dnsmasq") end
function checkUnbound() return fs.access("/usr/sbin/unbound") end
function checkIpset() 
	if fs.access("/usr/sbin/ipset") and sys.call("/usr/sbin/ipset help hash:net >/dev/null 2>&1") == 0 then
		return true
	else
		return false
	end
end

function checkDnsmasqIpset()
	if checkDnsmasq() then
		local o = util.trim(util.exec("/usr/sbin/dnsmasq -v 2>/dev/null"))
		if not o:match("no%-ipset") and o:match("ipset") and checkIpset() then
			return true
		else
			return false
		end
	else
		return false
	end
end

local enabledFlag = uci:get(packageName, "config", "enabled")
local command, outputFile, outputCache, outputGzip
local targetDNS = uci:get(packageName, "config", "dns")

if not targetDNS or targetDNS == "" then
	targetDNS = "dnsmasq.servers"
end

if targetDNS ~= "dnsmasq.addnhosts" and targetDNS ~= "dnsmasq.conf" and 
	 targetDNS ~= "dnsmasq.ipset" and targetDNS ~= "dnsmasq.servers" and 
	 targetDNS ~= "unbound.adb_list" then
	targetDNS = "dnsmasq.servers"
end

if targetDNS == "dnsmasq.addnhosts" then
	outputFile="/var/run/" .. packageName .. ".addnhosts"
	outputCache="/var/run/" .. packageName .. ".addnhosts.cache"
	outputGzip="/etc/" .. packageName .. ".addnhosts.gz"
elseif targetDNS == "dnsmasq.conf" then
	outputFile="/var/dnsmasq.d/" .. packageName .. ""
	outputCache="/var/run/" .. packageName .. ".dnsmasq.cache"
	outputGzip="/etc/" .. packageName .. ".dnsmasq.gz"
elseif targetDNS == "dnsmasq.servers" then
	outputFile="/var/run/" .. packageName .. ".servers"
	outputCache="/var/run/" .. packageName .. ".servers.cache"
	outputGzip="/etc/" .. packageName .. ".servers.gz"
elseif targetDNS == "unbound.adb_list" then
	outputFile="/var/lib/unbound/adb_list." .. packageName .. ""
	outputCache="/var/run/" .. packageName .. ".unbound.cache"
	outputGzip="/etc/" .. packageName .. ".unbound.gz"
end

local packageVersion = getPackageVersion()
local tmpfs, tmpfsMessage, tmpfsError, tmpfsStats, tmpfsStatus

if packageVersion == "" then
	tmpfsStatus = "statusNoInstall"
else
	tmpfsStatus = "statusStopped"
end

if fs.access("/var/run/" .. packageName .. ".json") then
	local f = io.open("/var/run/" .. packageName .. ".json")
	local s = f:read("*a")
	f:close()
	tmpfs = jsonc.parse(s)
end

if tmpfs and tmpfs['data'] then
	if tmpfs['data']['status'] and tmpfs['data']['status'] ~= "" then
		tmpfsStatus = tmpfs['data']['status']
	end
	if tmpfs['data']['message'] and tmpfs['data']['message'] ~= "" then
		tmpfsMessage = tmpfs['data']['message']
	end
	if tmpfs['data']['error'] and tmpfs['data']['error'] ~= "" then
		tmpfsError = tmpfs['data']['error']
	end
	if tmpfs['data']['stats'] and tmpfs['data']['stats'] ~= "" then
		tmpfsStats = tmpfs['data']['stats']
	end
end

local statusTable = {}
local errorTable = {}
statusTable["statusNoInstall"] = translatef("%s is not installed or not found", packageName)
statusTable["statusStopped"] = translate("Stopped")
statusTable["statusStarting"] = translate("Starting")
statusTable["statusRestarting"] = translate("Restarting")
statusTable["statusForceReloading"] = translate("Force Reloading")
statusTable["statusDownloading"] = translate("Downloading")
statusTable["statusError"] = translate("Error")
statusTable["statusWarning"] = translate("Warning")
statusTable["statusFail"] = translate("Fail")
statusTable["statusSuccess"] = translate("Success")
errorTable["errorOutputFileCreate"] = translatef("failed to create '%s' file", outputFile)
errorTable["errorFailDNSReload"] = translate("failed to restart/reload DNS resolver")
errorTable["errorSharedMemory"] = translate("failed to access shared memory")
errorTable["errorSorting"] = translate("failed to sort data file")
errorTable["errorOptimization"] = translate("failed to optimize data file")
errorTable["errorAllowListProcessing"] = translate("failed to process allow-list")
errorTable["errorDataFileFormatting"] = translate("failed to format data file")
errorTable["errorMovingDataFile"] = translatef("failed to move temporary data file to '%s'", outputFile)
errorTable["errorCreatingCompressedCache"] = translate("failed to create compressed cache")
errorTable["errorRemovingTempFiles"] = translate("failed to remove temporary files")
errorTable["errorRestoreCompressedCache"] = translate("failed to unpack compressed cache")
errorTable["errorRestoreCache"] = translatef("failed to move '%s' to '%s'", outputCache, outputFile)
errorTable["errorOhSnap"] = translate("failed to create block-list or restart DNS resolver")
errorTable["errorStopping"] = translatef("failed to stop %s", packageName)
errorTable["errorDNSReload"] = translate("failed to reload/restart DNS resolver")
errorTable["errorDownloadingConfigUpdate"] = translate("failed to download Config Update file")
errorTable["errorDownloadingList"] = translate("failed to download")
errorTable["errorParsingConfigUpdate"] = translate("failed to parse Config Update file")
errorTable["errorParsingList"] = translate("failed to parse")
errorTable["errorNoSSLSupport"] = translate("no HTTPS/SSL support on device")

m = Map("simple-adblock", translate("Simple AdBlock Settings"))
m.apply_on_parse = true
m.on_after_apply = function(self)
	sys.call("/etc/init.d/simple-adblock restart")
end

h = m:section(NamedSection, "config", "simple-adblock", translatef("Service Status [%s %s]", packageName, packageVersion))

if tmpfsStatus == "statusStarting" or
	 tmpfsStatus == "statusRestarting" or
	 tmpfsStatus == "statusForceReloading" or
	 tmpfsStatus == "statusDownloading" then
	ss = h:option(DummyValue, "_dummy", translate("Service Status"))
	ss.template = "simple-adblock/status"
	ss.value = statusTable[tmpfsStatus] .. '...'
	if tmpfsMessage then
		sm = h:option(DummyValue, "_dummy", translate("Task"))
		sm.template = "simple-adblock/status"
		sm.value = tmpfsMessage
	end
else
	if tmpfsStatus == "statusStopped" then
		ss = h:option(DummyValue, "_dummy", translate("Service Status"))
		ss.template = "simple-adblock/status"
		ss.value = statusTable[tmpfsStatus]
		if fs.access(outputCache) then
			sm = h:option(DummyValue, "_dummy", translate("Info"))
			sm.template = "simple-adblock/status"
			sm.value = translatef("Cache file containing %s domains found.", getFileLines(outputCache))
		elseif fs.access(outputGzip) then
			sm = h:option(DummyValue, "_dummy", translate("Info"))
			sm.template = "simple-adblock/status"
			sm.value = translate("Compressed cache file found.")
		end
	else
		ss = h:option(DummyValue, "_dummy", translate("Service Status"))
		ss.template = "simple-adblock/status"
		if tmpfsStatus == "statusSuccess" then
			ss.value = translatef("%s is blocking %s domains (with %s).", packageVersion, getFileLines(outputFile), targetDNS)
		else
			ss.value = statusTable[tmpfsStatus]
		end
		if tmpfsMessage then
			ms = h:option(DummyValue, "_dummy", translate("Message"))
			ms.template = "simple-adblock/status"
			ms.value = tmpfsMessage
		end
		if tmpfsError then
			es = h:option(DummyValue, "_dummy", translate("Collected Errors"))
			es.template = "simple-adblock/error"
			es.value = ""
			local err, e, url
			for err in tmpfsError:gmatch("[%p%w]+") do
				if err:match("|") then
					e,url = err:match("(.+)|(.+)")
					es.value = translatef("%s Error: %s %s", es.value, errorTable[e], url) .. ".\n"
				else
					es.value = translatef("%s Error: %s", es.value, errorTable[err]) .. ".\n"
				end
			end
		end
	end
	if packageVersion ~= "" then
		buttons = h:option(DummyValue, "_dummy")
		buttons.template = packageName .. "/buttons"
	end
end

s = m:section(NamedSection, "config", "simple-adblock", translate("Configuration"))
-- General options
s:tab("basic", translate("Basic Configuration"))

o1 = s:taboption("basic", ListValue, "config_update_enabled", translate("Automatic Config Update"), translate("Perform config update before downloading the block/allow-lists."))
o1:value("0", translate("Disable"))
o1:value("1", translate("Enable"))
o1.default = 0

o2 = s:taboption("basic", ListValue, "verbosity", translate("Output Verbosity Setting"), translate("Controls system log and console output verbosity."))
o2:value("0", translate("Suppress output"))
o2:value("1", translate("Some output"))
o2:value("2", translate("Verbose output"))
o2.default = 2

o3 = s:taboption("basic", ListValue, "force_dns", translate("Force Router DNS"), translate("Forces Router DNS use on local devices, also known as DNS Hijacking."))
o3:value("0", translate("Let local devices use their own DNS servers if set"))
o3:value("1", translate("Force Router DNS server to all local devices"))
o3.default = 1

local sysfs_path = "/sys/class/leds/"
local leds = {}
if fs.access(sysfs_path) then
	leds = nutil.consume((fs.dir(sysfs_path)))
end
if #leds ~= 0 then
	o4 = s:taboption("basic", Value, "led", translate("LED to indicate status"),
		translatef("Pick the LED not already used in %sSystem LED Configuration%s.", "<a href=\"" .. dispatcher.build_url("admin", "system", "leds") .. "\">", "</a>"))
	o4.rmempty = false
	o4:value("", translate("none"))
	for k, v in ipairs(leds) do
		o4:value(v)
	end
end

s:tab("advanced", translate("Advanced Configuration"))

local dns_descr = translatef("Pick the DNS resolution option to create the adblock list for, see the %sREADME%s for details.", "<a href=\"" .. readmeURL .. "#dns-resolution-option\" target=\"_blank\">", "</a>")

if not checkDnsmasq() then
	dns_descr = dns_descr .. "<br />" .. translatef("Please note that %s is not supported on this system.", "<i>dnsmasq.addnhosts</i>")
	dns_descr = dns_descr .. "<br />" .. translatef("Please note that %s is not supported on this system.", "<i>dnsmasq.conf</i>")
	dns_descr = dns_descr .. "<br />" .. translatef("Please note that %s is not supported on this system.", "<i>dnsmasq.ipset</i>")
	dns_descr = dns_descr .. "<br />" .. translatef("Please note that %s is not supported on this system.", "<i>dnsmasq.servers</i>")
elseif not checkDnsmasqIpset() then 
	dns_descr = dns_descr .. "<br />" .. translatef("Please note that %s is not supported on this system.", "<i>dnsmasq.ipset</i>")
end
if not checkUnbound() then 
	dns_descr = dns_descr .. "<br />" .. translatef("Please note that %s is not supported on this system.", "<i>unbound.adb_list</i>")
end

dns = s:taboption("advanced", ListValue, "dns", translate("DNS Service"), dns_descr)
if checkDnsmasq() then
	dns:value("dnsmasq.addnhosts", translate("DNSMASQ Additional Hosts"))
	dns:value("dnsmasq.conf", translate("DNSMASQ Config"))
	if checkDnsmasqIpset() then
		dns:value("dnsmasq.ipset", translate("DNSMASQ IP Set"))
	end
	dns:value("dnsmasq.servers", translate("DNSMASQ Servers File"))
end
if checkUnbound() then
	dns:value("unbound.adb_list", translate("Unbound AdBlock List"))
end
dns.default = "dnsmasq.servers"

ipv6 = s:taboption("advanced", ListValue, "ipv6_enabled", translate("IPv6 Support"), translate("Add IPv6 entries to block-list."))
ipv6:value("", translate("Do not add IPv6 entries"))
ipv6:value("1", translate("Add IPv6 entries"))
ipv6:depends({dns="dnsmasq.addnhosts"}) 
ipv6.default = ""
ipv6.rmempty = true

o5 = s:taboption("advanced", Value, "boot_delay", translate("Delay (in seconds) for on-boot start"), translate("Run service after set delay on boot."))
o5.default = 120
o5.datatype = "range(1,600)"

o6 = s:taboption("advanced", Value, "download_timeout", translate("Download time-out (in seconds)"), translate("Stop the download if it is stalled for set number of seconds."))
o6.default = 10
o6.datatype = "range(1,60)"

o7 = s:taboption("advanced", Value, "curl_retry", translate("Curl download retry"), translate("If curl is installed and detected, it would retry download this many times on timeout/fail."))
o7.default = 3
o7.datatype = "range(0,30)"

o8 = s:taboption("advanced", ListValue, "parallel_downloads", translate("Simultaneous processing"), translate("Launch all lists downloads and processing simultaneously, reducing service start time."))
o8:value("0", translate("Do not use simultaneous processing"))
o8:value("1", translate("Use simultaneous processing"))
o8.default = 1

o10 = s:taboption("advanced", ListValue, "compressed_cache", translate("Store compressed cache file on router"), translate("Attempt to create a compressed cache of block-list in the persistent memory."))
o10:value("0", translate("Do not store compressed cache"))
o10:value("1", translate("Store compressed cache"))
o10.default = "0"

o11 = s:taboption("advanced", ListValue, "debug", translate("Enable Debugging"), translate("Enables debug output to /tmp/simple-adblock.log."))
o11:value("0", translate("Disable Debugging"))
o11:value("1", translate("Enable Debugging"))
o11.default = "0"


s2 = m:section(NamedSection, "config", "simple-adblock", translate("Allowed and Blocked Lists Management"))
-- Allowed Domains
d1 = s2:option(DynamicList, "allowed_domain", translate("Allowed Domains"), translate("Individual domains to be allowed."))
d1.addremove = false
d1.optional = false

-- Allowed Domains URLs
d2 = s2:option(DynamicList, "allowed_domains_url", translate("Allowed Domain URLs"), translate("URLs to lists of domains to be allowed."))
d2.addremove = false
d2.optional = false

-- Blocked Domains
d3 = s2:option(DynamicList, "blocked_domain", translate("Blocked Domains"), translate("Individual domains to be blocked."))
d3.addremove = false
d3.optional = false

-- Blocked Domains URLs
d4 = s2:option(DynamicList, "blocked_domains_url", translate("Blocked Domain URLs"), translate("URLs to lists of domains to be blocked."))
d4.addremove = false
d4.optional = false

-- Blocked Hosts URLs
d5 = s2:option(DynamicList, "blocked_hosts_url", translate("Blocked Hosts URLs"), translate("URLs to lists of hosts to be blocked."))
d5.addremove = false
d5.optional = false

return m