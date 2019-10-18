module("luci.controller.https_dns_proxy", package.seeall)
function index()
	if nixio.fs.access("/etc/config/https_dns_proxy") then
		entry({"admin", "services", "https_dns_proxy"}, cbi("https_dns_proxy"), _("HTTPS DNS Proxy"))
		entry({"admin", "services", "https_dns_proxy", "action"}, call("https_dns_proxy_action"), nil).leaf = true
	end
end

function https_dns_proxy_action(name)
	local packageName = "https_dns_proxy"
	if name == "start" then
		servers_backup()
		luci.sys.init.start(packageName)
		servers_apply_doh()
		luci.util.exec("/etc/init.d/dnsmasq restart >/dev/null 2>&1")
	elseif name == "action" then
		luci.util.exec("/etc/init.d/" .. packageName .. " reload >/dev/null 2>&1")
		luci.util.exec("/etc/init.d/dnsmasq restart >/dev/null 2>&1")
	elseif name == "stop" then
		servers_restore()
		luci.util.exec("/etc/init.d/dnsmasq restart >/dev/null 2>&1")
		luci.sys.init.stop(packageName)
	elseif name == "enable" then
		luci.sys.init.enable(packageName)
	elseif name == "disable" then
		luci.sys.init.disable(packageName)
	end
	luci.http.prepare_content("text/plain")
	luci.http.write("0")
end

local uci = require("luci.model.uci").cursor()

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

function servers_restore()
  local k, v
	if uci:get("dhcp", "@dnsmasq[0]", "doh_backup_server") then
		uci:delete("dhcp", "@dnsmasq[0]", "server")
		for k, v in pairs(uci:get("dhcp", "@dnsmasq[0]", "doh_backup_server")) do
			uci_del_list("dhcp", "@dnsmasq[0]", "server", v)
			uci_add_list("dhcp", "@dnsmasq[0]", "server", v)
		end
	end
	uci:commit("dhcp")
end

function servers_backup()
  if not uci:get("dhcp", "@dnsmasq[0]", "doh_backup_server") then
    uci:set("dhcp", "@dnsmasq[0]", "doh_backup_server", uci:get("dhcp", "@dnsmasq[0]", "server"))
  end
end

function servers_apply_doh()
	local n = 0
	uci:delete("dhcp", "@dnsmasq[0]", "server")
	uci:foreach("https_dns_proxy", "https_dns_proxy", function(s)
		local la_val, lp_val
		la_val = s[".listen_addr"] or "127.0.0.1"
		lp_val = s[".listen_port"] or n + 5053
		uci_del_list("dhcp", "@dnsmasq[0]", "server", tostring(la_val) .. "#" .. tostring(lp_val))
		uci_add_list("dhcp", "@dnsmasq[0]", "server", tostring(la_val) .. "#" .. tostring(lp_val))
    n = n + 1
		uci:save("dhcp")
	end)
	uci:commit("dhcp")
end
