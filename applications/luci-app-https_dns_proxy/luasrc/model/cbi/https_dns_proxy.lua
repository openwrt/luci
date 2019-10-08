local uci = require("luci.model.uci").cursor()
local dispatcher = require("luci.dispatcher")

function uci_del_list(conf, sect, opt, value)
  local lval = uci:get(conf, sect, opt)
  if lval == nil or lval == "" then
    lval = {}
  elseif type(lval) ~= "table" then
    lval = { lval }
  end

  local i
  local changed = false
  for i = #lval, 1 do
    if lval[i] == value then
      table.remove(lval, i)
      changed = true
    end
  end

  if changed then
    if #lval > 0 then
      uci:set(conf, sect, opt, lval)
    else
      uci:delete(conf, sect, opt)
    end
  end
end

function uci_add_list(conf, sect, opt, value)
  local lval = uci:get(conf, sect, opt)
  if lval == nil or lval == "" then
    lval = {}
  elseif type(lval) ~= "table" then
    lval = { lval }
  end

  lval[#lval+1] = value
  uci:set(conf, sect, opt, lval)
end

m = Map("https_dns_proxy", translate("HTTPS DNS Proxy Settings"))
m.template="cbi/map"

s3 = m:section(TypedSection, "https_dns_proxy", translate("Instances"), translate("When you add/remove any instances below, they will be used to override the 'DNS forwardings' section of ")
		.. [[ <a href="]] .. dispatcher.build_url("admin/network/dhcp") .. [[">]]
    .. translate("DHCP and DNS") .. [[</a>]] .. "."
--    .. "</br>"
--    .. translate("For more information on different options check ")
--		.. [[ <a href="https://adguard.com/en/adguard-dns/overview.html#instruction">]]
--    .. "AdGuard.com" .. [[</a>]] .. ", "
--		.. [[ <a href="https://cleanbrowsing.org/guides/dnsoverhttps">]]
--    .. "CleanBrowsing.org" .. [[</a>]] .. " " .. translate("and") .. " "
--		.. [[ <a href="https://www.quad9.net/doh-quad9-dns-servers/">]]
--    .. "Quad9.net" .. [[</a>]] .. "."
    )
s3.template = "cbi/tblsection"
s3.sortable  = false
s3.anonymous = true
s3.addremove = true

prov = s3:option(ListValue, "url_prefix", translate("Provider"))
-- prov:value("https://dns.adguard.com/dns-query?", "AdGuard (Standard)")
-- prov:value("https://dns-family.adguard.com/dns-query?", "AdGuard (Family Protection)")
-- prov:value("https://doh.cleanbrowsing.org/doh/security-filter/?ct&", "CleanBrowsing (Security Filter)")
-- prov:value("https://doh.cleanbrowsing.org/doh/family-filter/?ct&", "CleanBrowsing (Family Filter)")
-- prov:value("https://doh.cleanbrowsing.org/doh/adult-filter/?ct&", "CleanBrowsing (Adult Filter)")
prov:value("https://cloudflare-dns.com/dns-query?ct=application/dns-json&", "Cloudflare")
-- prov:value("https://dns.digitale-gesellschaft.ch/dns-query?", "Digitale Gesellschaft (ch)")
prov:value("https://doh.dns.sb/dns-query?", "DNS.SB")
prov:value("https://dns.google.com/resolve?", "Google")
-- prov:value("https://odvr.nic.cz/doh?", "ODVR (nic.cz)")
-- prov:value("https://dns.quad9.net:5053/dns-query?", "Quad9 (Recommended)")
-- prov:value("https://dns9.quad9.net:5053/dns-query?", "Quad9 (Secured)")
-- prov:value("https://dns10.quad9.net:5053/dns-query?", "Quad9 (Unsecured)")
-- prov:value("https://dns11.quad9.net:5053/dns-query?", "Quad9 (Secured with ECS Support)")
prov.default = "https://dns.google.com/resolve?"
prov.forcewrite = true
prov.write = function(self, section, value)
  if not value then return end
  local n = 0
  uci:foreach("https_dns_proxy", "https_dns_proxy", function(s)
      if s[".name"] == section then
          return false
      end
      n = n + 1
  end)
  local la_val = la:formvalue(section)
  local lp_val = lp:formvalue(section)
  if not la_val or la_val == "" then la_val = "127.0.0.1" end
  if not lp_val or lp_val == "" then lp_val = n + 5053 end
  if value:match("dns\.adguard") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "176.103.130.130,176.103.130.131")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns.adguard.com/dns-query?ct&")
  elseif value:match("family\.adguard") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "176.103.130.132,176.103.130.134")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns-family.adguard.com/dns-query?ct&")
  elseif value:match("cleanbrowsing\.org/doh/security") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "185.228.168.168")
    uci:set("https_dns_proxy", section, "url_prefix", "https://doh.cleanbrowsing.org/doh/security-filter/?ct&")
  elseif value:match("cleanbrowsing\.org/doh/family") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "185.228.168.168")
    uci:set("https_dns_proxy", section, "url_prefix", "https://doh.cleanbrowsing.org/doh/family-filter/?ct&")
  elseif value:match("cleanbrowsing\.org/doh/adult") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "185.228.168.168")
    uci:set("https_dns_proxy", section, "url_prefix", "https://doh.cleanbrowsing.org/doh/adult-filter/?ct&")
  elseif value:match("cloudflare") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "1.1.1.1,1.0.0.1")
    uci:set("https_dns_proxy", section, "url_prefix", "https://cloudflare-dns.com/dns-query?ct=application/dns-json&")
  elseif value:match("gesellschaft\.ch") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "185.95.218.42,185.95.218.43")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns.digitale-gesellschaft.ch/dns-query?")
  elseif value:match("dns\.sb") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "185.222.222.222,185.184.222.222")
    uci:set("https_dns_proxy", section, "url_prefix", "https://doh.dns.sb/dns-query?")
  elseif value:match("google") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "8.8.8.8,8.8.4.4")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns.google.com/resolve?")
  elseif value:match("odvr\.nic\.cz") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "193.17.47.1,185.43.135.1")
    uci:set("https_dns_proxy", section, "url_prefix", "https://odvr.nic.cz/doh?")
  elseif value:match("dns\.quad9") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "9.9.9.9,149.112.112.112")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns.quad9.net:5053/dns-query?")
  elseif value:match("dns9\.quad9") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "9.9.9.9,149.112.112.9")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns9.quad9.net:5053/dns-query?")
  elseif value:match("dns10\.quad9") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "9.9.9.10,149.112.112.10")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns10.quad9.net:5053/dns-query?")
  elseif value:match("dns11\.quad9") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "9.9.9.11,149.112.112.11")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns11.quad9.net:5053/dns-query?")
  end
  uci:save("https_dns_proxy")
  if n == 0 then
    uci:delete("dhcp", "@dnsmasq[0]", "server")
  end
  uci_del_list("dhcp", "@dnsmasq[0]", "server", tostring(la_val) .. "#" .. tostring(lp_val))
  uci_add_list("dhcp", "@dnsmasq[0]", "server", tostring(la_val) .. "#" .. tostring(lp_val))
  uci:save("dhcp")
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
