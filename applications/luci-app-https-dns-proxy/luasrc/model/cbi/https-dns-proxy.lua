local sys = require "luci.sys"
local util = require "luci.util"
local fs = require "nixio.fs"
local dispatcher = require "luci.dispatcher"
local i18n = require "luci.i18n"
local uci = require("luci.model.uci").cursor()

local packageName = "https-dns-proxy"
local readmeURL = "https://docs.openwrt.melmac.net/" .. packageName .. "/"
local providers_dir = "/usr/lib/lua/luci/" .. packageName .. "/providers/"
local helperText = ""
local http2Supported = false

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

function createHelperText()
	local initText = translate("For more information on different options check") .. " "
	for filename in fs.dir(providers_dir) do
		local p_func = loadfile(providers_dir .. filename)
		setfenv(p_func, { _ = i18n.translate })
		local p = p_func()
		if p.help_link and (not p.http2_only or http2Supported) then
			local url, domain
			url = p.help_link
			domain = p.help_link_text or url:match('^%w+://([^/]+)')
			if not helperText:find(domain) then
				if helperText == "" then
					helperText = initText
				else
					helperText = helperText .. ", "
				end
				helperText = helperText .. [[<a href="]] .. url .. [[" target="_blank">]] .. domain .. [[</a>]]
			end
		end
	end
	if helperText ~= "" then
		local a = helperText:gsub('(.*),%s.*$', '%1')
		helperText = a .. " " .. translate("and") .. helperText:sub(#a + 2) .. "."
	end
end

function getProviderName(value)
	for filename in fs.dir(providers_dir) do
		local p_func = loadfile(providers_dir .. filename)
		setfenv(p_func, { _ = i18n.translate })
		local p = p_func()
		value = value:gsub('[%p%c%s]', '')
		p.url_match = p.resolver_url:gsub('[%p%c%s]', '')
		if value:match(p.url_match) then
			return p.label
		end
	end
	return translate("Unknown Provider")
end

local packageStatus, packageStatusCode
local ubusStatus = util.ubus("service", "list", { name = packageName })
local packageVersion = getPackageVersion()

if packageVersion == "" then
	packageStatusCode, packageStatus = -1, translatef("%s is not installed or not found", packageName)
else  
	packageStatusCode, packageStatus = 1, ""
	for n = 1,20 do
		if ubusStatus and ubusStatus[packageName] and 
			 ubusStatus[packageName]["instances"] and 
			 ubusStatus[packageName]["instances"]["instance" .. n] and 
			 ubusStatus[packageName]["instances"]["instance" .. n]["running"] then
			local value, k, v, url, url_flag, la, la_flag, lp, lp_flag
			for k, v in pairs(ubusStatus[packageName]["instances"]["instance" .. n]["command"]) do
				if la_flag then la, la_flag = v, false end
				if lp_flag then lp, lp_flag = v, false end
				if url_flag then url, url_flag = v, false end
				if v == "-a" then la_flag = true end
				if v == "-p" then lp_flag = true end
				if v == "-r" then url_flag = true end
			end
			la = la or "127.0.0.1"
			lp = lp or n + 5053
			packageStatus = packageStatus .. translatef("%s DoH at %s:%s", getProviderName(url), la, lp) .. "\n"
		else
			break
		end
	end
	if packageStatus == "" then
		packageStatusCode = 0
		packageStatus = translate("Stopped")
		if not sys.init.enabled(packageName) then
			packageStatus = packageStatus .. " (" .. translate("disabled") .. ")"
		end
	end
end

if sys.call("grep -q 'Provides: libnghttp2' /usr/lib/opkg/status") == 0 then
	http2Supported = true
end

m = Map("https-dns-proxy", translate("DNS HTTPS Proxy Settings"))

h = m:section(TypedSection, "_dummy", translatef("Service Status [%s %s]", packageName, packageVersion))
h.template = "cbi/nullsection"
ss = h:option(DummyValue, "_dummy", translate("Service Status"))
ss.template = packageName .. "/status"
ss.value = packageStatus
if packageStatusCode ~= -1 then
	buttons = h:option(DummyValue, "_dummy", translate("Service Control"))
	buttons.template = packageName .. "/buttons"
end

c = m:section(NamedSection, "config", "https-dns-proxy", translate("Configuration"))
d1 = c:option(ListValue, "dnsmasq_config_update", translate("Update DNSMASQ Config on Start/Stop"), translatef("If update option is selected, the 'DNS forwardings' section of %sDHCP and DNS%s will be automatically updated to use selected DoH providers (%smore information%s).", "<a href=\"" .. dispatcher.build_url("admin/network/dhcp") .. "\">", "</a>", "<a href=\"" .. readmeURL .. "#default-settings" .. "\" target=\"_blank\">", "</a>"))
d1:value('*', translate("Update all configs"))
local dnsmasq_num = 0
uci:foreach("dhcp", "dnsmasq", function(s)
d1:value(tostring(dnsmasq_num), translatef("Update %s config", "dhcp.@dnsmasq[" .. tostring(dnsmasq_num) .. "]"))
dnsmasq_num = dnsmasq_num + 1
end)
d1:value('-', translate("Do not update configs"))
d1.default = '*'
f1 = c:option(ListValue, "force_dns", translate("Force Router DNS"), translate("Forces Router DNS use on local devices, also known as DNS Hijacking."))
f1:value("0", translate("Let local devices use their own DNS servers if set"))
f1:value("1", translate("Force Router DNS server to all local devices"))
f1.default = "1"
cdi = c:option(ListValue, "canary_domains_icloud", translate("Canary Domains iCloud"), translatef("Blocks access to iCloud Private Relay resolvers, forcing local devices to use router for DNS resolution (%smore information%s).", "<a href=\"" .. readmeURL .. "#canary_domains_icloud" .. "\" target=\"_blank\">", "</a>"))
cdi:value("0", translate("Let local devices use iCloud Private Relay"))
cdi:value("1", translate("Force Router DNS server to all local devices"))
cdi:depends({force_dns="1"}) 
cdi.default = "1"
cdm = c:option(ListValue, "canary_domains_mozilla", translate("Canary Domains Mozilla"), translatef("Blocks access to Mozilla resolvers, forcing local devices to use router for DNS resolution (%smore information%s).", "<a href=\"" .. readmeURL .. "#canary_domains_mozilla" .. "\" target=\"_blank\">", "</a>"))
cdm:value("0", translate("Let local devices use Mozilla resolvers"))
cdm:value("1", translate("Force Router DNS server to all local devices"))
cdm:depends({force_dns="1"}) 
cdm.default = "1"

createHelperText()
s3 = m:section(TypedSection, "https-dns-proxy", translate("Instances"), 
	helperText)
s3.template = "cbi/tblsection"
s3.sortable  = false
s3.anonymous = true
s3.addremove = true

prov = s3:option(ListValue, "resolver_url", translate("Resolver"))
for filename in fs.dir(providers_dir) do
	local p_func = loadfile(providers_dir .. filename)
	setfenv(p_func, { _ = i18n.translate })
	local p = p_func()
	if not p.http2_only or http2Supported then
		prov:value(p.resolver_url, p.label)
	end
	if p.default then
		prov.default = p.resolver_url
	end
end
prov.forcewrite = true
prov.write = function(self, section, value)
	if not value then return end
	for filename in fs.dir(providers_dir) do
		local p_func = loadfile(providers_dir .. filename)
		setfenv(p_func, { _ = i18n.translate })
		local p = p_func()
		value = value:gsub('[%p%c%s]', '')
		p.url_match = p.resolver_url:gsub('[%p%c%s]', '')
		if value:match(p.url_match) then
			if p.bootstrap_dns then
				uci:set(packageName, section, "bootstrap_dns", p.bootstrap_dns)
			end
			if p.resolver_url then
				uci:set(packageName, section, "resolver_url", p.resolver_url)
			end
		end
	end
	uci:save(packageName)
end

la = s3:option(Value, "listen_addr", translate("Listen Address"))
la.datatype    = "host"
la.placeholder = "127.0.0.1"
la.rmempty     = true

local n = 0
uci:foreach(packageName, packageName, function(s)
		if s[".name"] == section then
				return false
		end
		n = n + 1
end)

lp = s3:option(Value, "listen_port", translate("Listen Port"))
lp.datatype = "port"
lp.value    = n + 5053

dscp = s3:option(Value, "dscp_codepoint", translate("DSCP Codepoint"))
dscp.datatype = "range(0,63)"
dscp.rmempty  = true

ps = s3:option(Value, "proxy_server", translate("Proxy Server"))
ps.rmempty  = true

return m
