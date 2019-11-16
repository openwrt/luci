local sys = require "luci.sys"
local util = require "luci.util"
local fs = require "nixio.fs"
local dispatcher = require "luci.dispatcher"
local i18n = require "luci.i18n"
local uci = require("luci.model.uci").cursor()

local packageName = "https_dns_proxy"
local providers_dir = "/usr/lib/lua/luci/" .. packageName .. "/providers/"

function get_provider_name(value)
	for filename in fs.dir(providers_dir) do
		local p_func = loadfile(providers_dir .. filename)
		setfenv(p_func, { _ = i18n.translate })
		local p = p_func()
		value = value:gsub('[%p%c%s]', '')
		p.url_match = p.url_prefix:gsub('[%p%c%s]', '')
		if value:match(p.url_match) then
			return p.label
		end
	end
	return translate("Uknown Provider")
end

local tmpfsStatus, tmpfsStatusCode
local ubusStatus = util.ubus("service", "list", { name = packageName })
local tmpfsVersion = tostring(util.trim(sys.exec("opkg list-installed " .. packageName .. " | awk '{print $3}'")))

if not tmpfsVersion or tmpfsVersion == "" then
	tmpfsStatusCode = -1
	tmpfsVersion = ""
	tmpfsStatus = packageName .. " " .. translate("is not installed or not found")
else  
	tmpfsVersion = " [" .. packageName .. " " .. tmpfsVersion .. "]"
	if not ubusStatus or not ubusStatus[packageName] then
		tmpfsStatusCode = 0
		tmpfsStatus = translate("Stopped")
	else
		tmpfsStatusCode, tmpfsStatus = 1, ""
		for n = 1,1000 do
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
				tmpfsStatus = tmpfsStatus .. translate("Running") .. ": " .. get_provider_name(url) .. " " .. translate("DoH") .. " " .. translate("at") .. " " .. la .. ":" .. lp .. "\n"
			else
				break
			end
		end
	end
end

m = Map("https_dns_proxy", translate("DNS over HTTPS Proxy Settings"))

h = m:section(TypedSection, "_dummy", translate("Service Status") .. tmpfsVersion)
h.template = "cbi/nullsection"
ss = h:option(DummyValue, "_dummy", translate("Service Status"))
if tmpfsStatusCode == -1 then
	ss.template = packageName .. "/status"
	ss.value = tmpfsStatus
else
		if tmpfsStatusCode == 0 then
			ss.template = packageName .. "/status"
		else
			ss.template = packageName .. "/status-textarea"
		end
	ss.value = tmpfsStatus
	buttons = h:option(DummyValue, "_dummy")
	buttons.template = packageName .. "/buttons"
end

s3 = m:section(TypedSection, "https_dns_proxy", translate("Instances"), translate("When you add/remove any instances below, they will be used to override the 'DNS forwardings' section of ")
		.. [[ <a href="]] .. dispatcher.build_url("admin/network/dhcp") .. [[">]]
		.. translate("DHCP and DNS") .. [[</a>]] .. ".")
s3.template = "cbi/tblsection"
s3.sortable  = false
s3.anonymous = true
s3.addremove = true

prov = s3:option(ListValue, "url_prefix", translate("Provider"))
for filename in fs.dir(providers_dir) do
	local p_func = loadfile(providers_dir .. filename)
	setfenv(p_func, { _ = i18n.translate })
	local p = p_func()
	prov:value(p.url_prefix, p.label)
	if p.default then
		prov.default = p.url_prefix
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
		p.url_match = p.url_prefix:gsub('[%p%c%s]', '')
		if value:match(p.url_match) then
			uci:set("https_dns_proxy", section, "bootstrap_dns", p.bootstrap_dns)
			uci:set("https_dns_proxy", section, "url_prefix", p.url_prefix)
		end
	end
	uci:save("https_dns_proxy")
end

la = s3:option(Value, "listen_addr", translate("Listen address"))
la.datatype    = "host"
la.placeholder = "127.0.0.1"
la.rmempty     = true

local n = 0
uci:foreach("https_dns_proxy", "https_dns_proxy", function(s)
		if s[".name"] == section then
				return false
		end
		n = n + 1
end)

lp = s3:option(Value, "listen_port", translate("Listen port"))
lp.datatype = "port"
lp.value    = n + 5053

sa = s3:option(Value, "subnet_addr", translate("Subnet address"))
sa.datatype = "host"
sa.rmempty  = true

ps = s3:option(Value, "proxy_server", translate("Proxy server"))
ps.datatype = "host"
ps.rmempty  = true

return m
