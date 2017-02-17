-- ------ extra functions ------ --

function interfaceCheck()
	metricValue = ut.trim(sys.exec("uci -p /var/state get network." .. arg[1] .. ".metric"))
	if metricValue == "" then -- no metric
		errorNoMetric = 1
	else -- if metric exists create list of interface metrics to compare against for duplicates
		uci.cursor():foreach("mwan3", "interface",
			function (section)
				local metricValue = ut.trim(sys.exec("uci -p /var/state get network." .. section[".name"] .. ".metric"))
				metricList = metricList .. section[".name"] .. " " .. metricValue .. "\n"
			end
		)
		-- compare metric against list
		local metricDuplicateNumbers, metricDuplicates = sys.exec("echo '" .. metricList .. "' | awk '{print $2}' | uniq -d"), ""
		for line in metricDuplicateNumbers:gmatch("[^\r\n]+") do
			metricDuplicates = sys.exec("echo '" .. metricList .. "' | grep '" .. line .. "' | awk '{print $1}'")
			errorDuplicateMetricList = errorDuplicateMetricList .. metricDuplicates
		end
		if sys.exec("echo '" .. errorDuplicateMetricList .. "' | grep -w " .. arg[1]) ~= "" then
			errorDuplicateMetric = 1
		end
	end
	-- check if this interface has a higher reliability requirement than track IPs configured
	local trackingNumber = tonumber(ut.trim(sys.exec("echo $(uci -p /var/state get mwan3." .. arg[1] .. ".track_ip) | wc -w")))
	if trackingNumber > 0 then
		local reliabilityNumber = tonumber(ut.trim(sys.exec("uci -p /var/state get mwan3." .. arg[1] .. ".reliability")))
		if reliabilityNumber and reliabilityNumber > trackingNumber then
			errorReliability = 1
		end
	end
	-- check if any interfaces are not properly configured in /etc/config/network or have no default route in main routing table
	if ut.trim(sys.exec("uci -p /var/state get network." .. arg[1])) == "interface" then
		local interfaceDevice = ut.trim(sys.exec("uci -p /var/state get network." .. arg[1] .. ".ifname"))
		if interfaceDevice == "uci: Entry not found" or interfaceDevice == "" then
			errorNetConfig = 1
			errorRoute = 1
		else
			local routeCheck = ut.trim(sys.exec("route -n | awk '{if ($8 == \"" .. interfaceDevice .. "\" && $1 == \"0.0.0.0\" && $3 == \"0.0.0.0\") print $1}'"))
			if routeCheck == "" then
				errorRoute = 1
			end
		end
	else
		errorNetConfig = 1
		errorRoute = 1
	end
end

function interfaceWarnings() -- display warning messages at the top of the page
	local warns, lineBreak = "", ""
	if errorReliability == 1 then
		warns = "<font color=\"ff0000\"><strong>WARNING: this interface has a higher reliability requirement than there are tracking IP addresses!</strong></font>"
		lineBreak = "<br /><br />"
	end
	if errorRoute == 1 then
		warns = warns .. lineBreak .. "<font color=\"ff0000\"><strong>WARNING: this interface has no default route in the main routing table!</strong></font>"
		lineBreak = "<br /><br />"
	end
	if errorNetConfig == 1 then
		warns = warns .. lineBreak .. "<font color=\"ff0000\"><strong>WARNING: this interface is configured incorrectly or not at all in /etc/config/network!</strong></font>"
		lineBreak = "<br /><br />"
	end
	if errorNoMetric == 1 then
		warns = warns .. lineBreak .. "<font color=\"ff0000\"><strong>WARNING: this interface has no metric configured in /etc/config/network!</strong></font>"
	elseif errorDuplicateMetric == 1 then
		warns = warns .. lineBreak .. "<font color=\"ff0000\"><strong>WARNING: this and other interfaces have duplicate metrics configured in /etc/config/network!</strong></font>"
	end
	return warns
end

-- ------ interface configuration ------ --

dsp = require "luci.dispatcher"
sys = require "luci.sys"
ut = require "luci.util"
arg[1] = arg[1] or ""

metricValue = ""
metricList = ""
errorDuplicateMetricList = ""
errorNoMetric = 0
errorDuplicateMetric = 0
errorRoute = 0
errorNetConfig = 0
errorReliability = 0
interfaceCheck()


m5 = Map("mwan3", translate("MWAN Interface Configuration - " .. arg[1]),
	translate(interfaceWarnings()))
	m5.redirect = dsp.build_url("admin", "network", "mwan", "configuration", "interface")


mwan_interface = m5:section(NamedSection, arg[1], "interface", "")
	mwan_interface.addremove = false
	mwan_interface.dynamic = false


enabled = mwan_interface:option(ListValue, "enabled", translate("Enabled"))
	enabled.default = "1"
	enabled:value("1", translate("Yes"))
	enabled:value("0", translate("No"))

track_ip = mwan_interface:option(DynamicList, "track_ip", translate("Tracking IP"),
	translate("This IP address will be pinged to dermine if the link is up or down. Leave blank to assume interface is always online"))
	track_ip.datatype = "ipaddr"

reliability = mwan_interface:option(Value, "reliability", translate("Tracking reliability"),
	translate("Acceptable values: 1-100. This many Tracking IP addresses must respond for the link to be deemed up"))
	reliability.datatype = "range(1, 100)"
	reliability.default = "1"

count = mwan_interface:option(ListValue, "count", translate("Ping count"))
	count.default = "1"
	count:value("1")
	count:value("2")
	count:value("3")
	count:value("4")
	count:value("5")

timeout = mwan_interface:option(ListValue, "timeout", translate("Ping timeout"))
	timeout.default = "2"
	timeout:value("1", translate("1 second"))
	timeout:value("2", translate("2 seconds"))
	timeout:value("3", translate("3 seconds"))
	timeout:value("4", translate("4 seconds"))
	timeout:value("5", translate("5 seconds"))
	timeout:value("6", translate("6 seconds"))
	timeout:value("7", translate("7 seconds"))
	timeout:value("8", translate("8 seconds"))
	timeout:value("9", translate("9 seconds"))
	timeout:value("10", translate("10 seconds"))

interval = mwan_interface:option(ListValue, "interval", translate("Ping interval"))
	interval.default = "5"
	interval:value("1", translate("1 second"))
	interval:value("3", translate("3 seconds"))
	interval:value("5", translate("5 seconds"))
	interval:value("10", translate("10 seconds"))
	interval:value("20", translate("20 seconds"))
	interval:value("30", translate("30 seconds"))
	interval:value("60", translate("1 minute"))
	interval:value("300", translate("5 minutes"))
	interval:value("600", translate("10 minutes"))
	interval:value("900", translate("15 minutes"))
	interval:value("1800", translate("30 minutes"))
	interval:value("3600", translate("1 hour"))

down = mwan_interface:option(ListValue, "down", translate("Interface down"),
	translate("Interface will be deemed down after this many failed ping tests"))
	down.default = "3"
	down:value("1")
	down:value("2")
	down:value("3")
	down:value("4")
	down:value("5")
	down:value("6")
	down:value("7")
	down:value("8")
	down:value("9")
	down:value("10")

up = mwan_interface:option(ListValue, "up", translate("Interface up"),
	translate("Downed interface will be deemed up after this many successful ping tests"))
	up.default = "3"
	up:value("1")
	up:value("2")
	up:value("3")
	up:value("4")
	up:value("5")
	up:value("6")
	up:value("7")
	up:value("8")
	up:value("9")
	up:value("10")

metric = mwan_interface:option(DummyValue, "metric", translate("Metric"),
	translate("This displays the metric assigned to this interface in /etc/config/network"))
	metric.rawhtml = true
	function metric.cfgvalue(self, s)
		if errorNoMetric == 0 then
			return metricValue
		else
			return "&#8212;"
		end
	end


return m5
