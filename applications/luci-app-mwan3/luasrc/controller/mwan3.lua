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
	local mArray = {}

	-- detailed mwan status
	local detailStatusInfo = ut.trim(sys.exec("/usr/sbin/mwan3 status"))
	if detailStatusInfo ~= "" then
		mArray.mwandetail = { detailStatusInfo }
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json(mArray)
end

function diagnosticsData(interface, tool, task)
	function getInterfaceNumber()
		local number = 0
		uci.cursor():foreach("mwan3", "interface",
			function (section)
				number = number+1
				if section[".name"] == interface then
					interfaceNumber = number
				end
			end
		)
	end

	local mArray = {}

	local results = ""
	local interfaceDevice = ut.trim(sys.exec("uci -q -p /var/state get network." .. interface .. ".ifname"))
	if interfaceDevice ~= "" then
		if tool == "ping" then
			local gateway = ut.trim(sys.exec("route -n | awk '{if ($8 == \"" .. interfaceDevice .. "\" && $1 == \"0.0.0.0\" && $3 == \"0.0.0.0\") print $2}'"))
			if gateway ~= "" then
				if task == "gateway" then
					local pingCommand = "ping -c 3 -W 2 -I " .. interfaceDevice .. " " .. gateway
					results = pingCommand .. "\n\n" .. sys.exec(pingCommand)
				else
					local tracked = ut.trim(sys.exec("uci -q -p /var/state get mwan3." .. interface .. ".track_ip"))
					if tracked ~= "" then
						for z in tracked:gmatch("[^ ]+") do
							local pingCommand = "ping -c 3 -W 2 -I " .. interfaceDevice .. " " .. z
							results = results .. pingCommand .. "\n\n" .. sys.exec(pingCommand) .. "\n\n"
						end
					else
						results = "No tracking IP addresses configured on " .. interface
					end
				end
			else
				results = "No default gateway for " .. interface .. " found. Default route does not exist or is configured incorrectly"
			end
		elseif tool == "rulechk" then
			getInterfaceNumber()
			local rule1 = sys.exec(ip .. "rule | grep $(echo $((" .. interfaceNumber .. " + 1000)))")
			local rule2 = sys.exec(ip .. "rule | grep $(echo $((" .. interfaceNumber .. " + 2000)))")
			if rule1 ~= "" and rule2 ~= "" then
				results = "All required interface IP rules found:\n\n" .. rule1 .. rule2
			elseif rule1 ~= "" or rule2 ~= "" then
				results = "Missing 1 of the 2 required interface IP rules\n\n\nRules found:\n\n" .. rule1 .. rule2
			else
				results = "Missing both of the required interface IP rules"
			end
		elseif tool == "routechk" then
			getInterfaceNumber()
			local routeTable = sys.exec(ip .. "route list table " .. interfaceNumber)
			if routeTable ~= "" then
				results = "Interface routing table " .. interfaceNumber .. " was found:\n\n" .. routeTable
			else
				results = "Missing required interface routing table " .. interfaceNumber
			end
		elseif tool == "hotplug" then
			if task == "ifup" then
				os.execute("/usr/sbin/mwan3 ifup " .. interface)
				results = "Hotplug ifup sent to interface " .. interface .. "..."
			else
				os.execute("/usr/sbin/mwan3 ifdown " .. interface)
				results = "Hotplug ifdown sent to interface " .. interface .. "..."
			end
		end
	else
		results = "Unable to perform diagnostic tests on " .. interface .. ". There is no physical or virtual device associated with this interface"
	end
	if results ~= "" then
		results = ut.trim(results)
		mArray.diagnostics = { results }
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json(mArray)
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
