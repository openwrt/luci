local uci = require("luci.model.uci").cursor()

m = Map("https_dns_proxy", translate("HTTPS DNS Proxy Settings"))
m.template="cbi/map"

s3 = m:section(TypedSection, "https_dns_proxy", translate("Instances"))
s3.template = "cbi/tblsection"
s3.sortable  = false
s3.anonymous = true
s3.addremove = true

prov = s3:option(ListValue, "url_prefix", translate("Provider"))
prov:value("https://cloudflare-dns.com/dns-query?ct=application/dns-json&","Cloudflare")
prov:value("https://dns.google.com/resolve?","Google")
prov.write = function(self, section, value)
  if value and value:match("cloudflare") then
    uci:set("https_dns_proxy", section, "bootstrap_dns", "1.1.1.1,1.0.0.1")
    uci:set("https_dns_proxy", section, "url_prefix", "https://cloudflare-dns.com/dns-query?ct=application/dns-json&")
  else
    uci:set("https_dns_proxy", section, "bootstrap_dns", "8.8.8.8,8.8.4.4")
    uci:set("https_dns_proxy", section, "url_prefix", "https://dns.google.com/resolve?")
  end
  uci:set("https_dns_proxy", section, "user", "nobody")
  uci:set("https_dns_proxy", section, "group", "nogroup")
  uci:save("https_dns_proxy")
end

la = s3:option(Value, "listen_addr", translate("Listen address"))
la.value   = "127.0.0.1"
la.rmempty = true

lp = s3:option(Value, "listen_port", translate("Listen port"))
lp.datatype    = "port"
lp.placeholder = "5053"
lp.rmempty     = true

-- user = s3:option(Value, "user", translate("User name"))
-- user.placeholder = "nobody"
-- user.rmempty = true

-- group = s3:option(Value, "group", translate("Group name"))
-- group.placeholder = "nogroup"
-- group.rmempty = true

sa = s3:option(Value, "subnet_addr", translate("Subnet address"))
sa.datatype = "ip4addr"
sa.rmempty  = true

ps = s3:option(Value, "proxy_server", translate("Proxy server"))
-- ps.datatype = "or(ipaddr,hostname)"
ps.rmempty = true

return m
