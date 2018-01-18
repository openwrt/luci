module("luci.controller.mwan3", package.seeall)

sys = require "luci.sys"
ut = require "luci.util"

ip = "ip -4 "

function index()
	if not nixio.fs.access("/etc/config/mwan3") then
		return
	end

	entry({"admin", "status", "mwan"},
		alias("admin", "status", "mwan", "overview"),
		_("Load Balancing"), 600)

	entry({"admin", "status", "mwan", "overview"},
		template("mwan/status_interface"))
	entry({"admin", "status", "mwan", "detail"},
		template("mwan/status_detail"))
	entry({"admin", "status", "mwan", "diagnostics"},
		template("mwan/status_diagnostics"))
	entry({"admin", "status", "mwan", "troubleshooting"},
		template("mwan/status_troubleshooting"))
	entry({"admin", "status", "mwan", "interface_status"},
		call("mwan_Status"))
	entry({"admin", "status", "mwan", "detailed_status"},
		call("detailedStatus"))
	entry({"admin", "status", "mwan", "diagnostics_display"},
		call("diagnosticsData"), nil).leaf = true
	entry({"admin", "status", "mwan", "troubleshooting_display"},
		call("troubleshootingData"))


	entry({"admin", "network", "mwan"},
		alias("admin", "network", "mwan", "interface"),
		_("Load Balancing"), 600)

	entry({"admin", "network", "mwan", "globals"},
		cbi("mwan/globalsconfig"),
		_("Globals"), 5).leaf = true
	entry({"admin", "network", "mwan", "interface"},
		arcombine(cbi("mwan/interface"), cbi("mwan/interfaceconfig")),
		_("Interfaces"), 10).leaf = true
	entry({"admin", "network", "mwan", "member"},
		arcombine(cbi("mwan/member"), cbi("mwan/memberconfig")),
		_("Members"), 20).leaf = true
	entry({"admin", "network", "mwan", "policy"},
		arcombine(cbi("mwan/policy"), cbi("mwan/policyconfig")),
		_("Policies"), 30).leaf = true
	entry({"admin", "network", "mwan", "rule"},
		arcombine(cbi("mwan/rule"), cbi("mwan/ruleconfig")),
		_("Rules"), 40).leaf = true
	entry({"admin", "network", "mwan", "notify"},
		cbi("mwan/notify"),
		_("Notification"), 50).leaf = true
end

function mwan_Status()
	local status = ut.ubus("mwan3", "status", {})

	luci.http.prepare_content("application/json")
	if status ~= nil then
		luci.http.write_json(status)
	else
		luci.http.write_json({})
	end
end

function detailedStatus()
	local statusInfo = ut.trim(sys.exec("/usr/sbin/mwan3 status"))
	luci.http.prepare_content("text/plain")
	if statusInfo ~= "" then
		luci.http.write(statusInfo)
	else
		luci.http.write("Unable to get status information")
	end
end

function diagnosticsData(interface, task)
	function getInterfaceNumber(interface)
		local number = 0
		local interfaceNumber
		uci.cursor():foreach("mwan3", "interface",
			function (section)
				number = number+1
				if section[".name"] == interface then
					interfaceNumber = number
				end
			end
		)
		return interfaceNumber
	end

	function diag_command(cmd, addr)
		if addr and addr:match("^[a-zA-Z0-9%-%.:_]+$") then
			local util = io.popen(cmd % addr)
			if util then
				while true do
					local ln = util:read("*l")
					if not ln then break end
					luci.http.write(ln)
					luci.http.write("\n")
				end
				util:close()
			end
			return
		end
	end

	function get_gateway(inteface)
		local dump = require("luci.util").ubus("network.interface.%s" % interface, "status", {})
		local gateway
		if dump then
			local _, route
			for _, route in ipairs(dump.route) do
				if dump.route[_].target == "0.0.0.0" then
					gateway =  dump.route[_].nexthop
				end
			end
		end
		return gateway
	end

	local mArray = {}
	local results = ""
	local number = getInterfaceNumber(interface)

	local uci = uci.cursor(nil, "/var/state")
	local device = uci:get("network", interface, "ifname")

	luci.http.prepare_content("text/plain")
	if device ~= "" then
		if task == "ping_gateway" then
			local gateway = get_gateway(interface)
			if gateway ~= nil then
				diag_command("ping -c 5 -W 1 %q 2>&1", gateway)
			else
				luci.http.prepare_content("text/plain")
				luci.http.write(string.format("No gateway for interface %s found.", interface))
			end
		elseif task == "ping_trackips" then
			local trackips = uci:get("mwan3", interface, "track_ip")
			if #trackips > 0 then
				for i in pairs(trackips) do
					diag_command("ping -c 5 -W 1 %q 2>&1", trackips[i])
				end
			else
				luci.http.write(string.format("No tracking Hosts for interface %s defined.", interface))
			end
		elseif task == "check_rules" then
			local number = getInterfaceNumber(interface)
			local iif = 1000 + number
			local fwmark = 2000 + number
			local iif_rule  = sys.exec(string.format("ip rule | grep %d", iif))
			local fwmark_rule = sys.exec(string.format("ip rule | grep %d", fwmark))
			if iif_rule ~= "" and fwmark_rule ~= "" then
				luci.http.write(string.format("All required IP rules for interface %s found", interface))
				luci.http.write("\n")
				luci.http.write(fwmark_rule)
				luci.http.write(iif_rule)
			elseif iif_rule == "" and fwmark_rule ~= "" then
				luci.http.write(string.format("Only one IP rules for interface %s found", interface))
				luci.http.write("\n")
				luci.http.write(fwmark_rule)
			elseif iif_rule ~= "" and fwmark_rule == "" then
				luci.http.write(string.format("Only one IP rules for interface %s found", interface))
				luci.http.write("\n")
				luci.http.write(iif_rule)
			else
				luci.http.write(string.format("Missing both IP rules for interface %s", interface))
			end
		elseif task == "check_routes" then
			local number = getInterfaceNumber(interface)
			local routeTable = sys.exec(string.format("ip route list table %s", number))
			if routeTable ~= "" then
				luci.http.write(string.format("Routing table %s for interface %s found", number, interface))
				luci.http.write("\n")
				luci.http.write(routeTable)
			else
				luci.http.write(string.format("Routing table %s for interface %s not found", number, interface))
			end
		elseif task == "hotplug_ifup" then
			os.execute(string.format("/usr/sbin/mwan3 ifup %s", interface))
			luci.http.write(string.format("Hotplug ifup sent to interface %s", interface))
		elseif task == "hotplug_ifdown" then
			os.execute(string.format("/usr/sbin/mwan3 ifdown %s", interface))
			luci.http.write(string.format("Hotplug ifdown sent to interface %s", interface))
		else
			luci.http.write("Unknown task")
		end
	else
		luci.http.write(string.format("Unable to perform diagnostic tests on %s.", interface))
		luci.http.write("\n")
		luci.http.write("There is no physical or virtual device associated with this interface.")
	end
end

function troubleshootingData()
	local ver = require "luci.version"

	local mArray = {}

	-- software versions
	local wrtRelease = ut.trim(ver.distversion)
		if wrtRelease ~= "" then
			wrtRelease = "OpenWrt - " .. wrtRelease
		else
			wrtRelease = "OpenWrt - unknown"
		end
	local luciRelease = ut.trim(ver.luciversion)
		if luciRelease ~= "" then
			luciRelease = "\nLuCI - " .. luciRelease
		else
			luciRelease = "\nLuCI - unknown"
		end
	local mwanVersion = ut.trim(sys.exec("opkg info mwan3 | grep Version | awk '{print $2}'"))
		if mwanVersion ~= "" then
			mwanVersion = "\n\nmwan3 - " .. mwanVersion
		else
			mwanVersion = "\n\nmwan3 - unknown"
		end
	local mwanLuciVersion = ut.trim(sys.exec("opkg info luci-app-mwan3 | grep Version | awk '{print $2}'"))
		if mwanLuciVersion ~= "" then
			mwanLuciVersion = "\nmwan3-luci - " .. mwanLuciVersion
		else
			mwanLuciVersion = "\nmwan3-luci - unknown"
		end
	mArray.versions = { wrtRelease .. luciRelease .. mwanVersion .. mwanLuciVersion }

	-- mwan config
	local mwanConfig = ut.trim(sys.exec("cat /etc/config/mwan3"))
		if mwanConfig == "" then
			mwanConfig = "No data found"
		end
	mArray.mwanconfig = { mwanConfig }

	-- network config
	local networkConfig = ut.trim(sys.exec("cat /etc/config/network | sed -e 's/.*username.*/	USERNAME HIDDEN/' -e 's/.*password.*/	PASSWORD HIDDEN/'"))
		if networkConfig == "" then
			networkConfig = "No data found"
		end
	mArray.netconfig = { networkConfig }

	-- wireless config
	local wirelessConfig = ut.trim(sys.exec("cat /etc/config/wireless | sed -e 's/.*username.*/	USERNAME HIDDEN/' -e 's/.*password.*/	PASSWORD HIDDEN/' -e 's/.*key.*/	KEY HIDDEN/'"))
		if wirelessConfig == "" then
			wirelessConfig = "No data found"
		end
	mArray.wificonfig = { wirelessConfig }
	
	-- ifconfig
	local ifconfig = ut.trim(sys.exec("ifconfig"))
		if ifconfig == "" then
			ifconfig = "No data found"
		end
	mArray.ifconfig = { ifconfig }

	-- route -n
	local routeShow = ut.trim(sys.exec("route -n"))
		if routeShow == "" then
			routeShow = "No data found"
		end
	mArray.routeshow = { routeShow }

	-- ip rule show
	local ipRuleShow = ut.trim(sys.exec(ip .. "rule show"))
		if ipRuleShow == "" then
			ipRuleShow = "No data found"
		end
	mArray.iprule = { ipRuleShow }

	-- ip route list table 1-250
	local routeList, routeString = ut.trim(sys.exec(ip .. "rule | sed 's/://g' 2>/dev/null | awk '$1>=2001 && $1<=2250' | awk '{print $NF}'")), ""
		if routeList ~= "" then
			for line in routeList:gmatch("[^\r\n]+") do
				routeString = routeString .. line .. "\n" .. sys.exec(ip .. "route list table " .. line)
			end
			routeString = ut.trim(routeString)
		else
			routeString = "No data found"
		end
	mArray.routelist = { routeString }

	-- default firewall output policy
	local firewallOut = ut.trim(sys.exec("uci -q -p /var/state get firewall.@defaults[0].output"))
		if firewallOut == "" then
			firewallOut = "No data found"
		end
	mArray.firewallout = { firewallOut }

	-- iptables
	local iptables = ut.trim(sys.exec("iptables -L -t mangle -v -n"))
		if iptables == "" then
			iptables = "No data found"
		end
	mArray.iptables = { iptables }

	luci.http.prepare_content("application/json")
	luci.http.write_json(mArray)
end
