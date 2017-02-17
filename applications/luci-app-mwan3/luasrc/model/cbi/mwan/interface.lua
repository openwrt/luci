-- ------ extra functions ------ --

function interfaceCheck() -- find issues with too many interfaces, reliability and metric
	uci.cursor():foreach("mwan3", "interface",
		function (section)
			local interfaceName = section[".name"]
			interfaceNumber = interfaceNumber+1 -- count number of mwan interfaces configured
			-- create list of metrics for none and duplicate checking
			local metricValue = ut.trim(sys.exec("uci -p /var/state get network." .. interfaceName .. ".metric"))
			if metricValue == "" then
				errorFound = 1
				errorNoMetricList = errorNoMetricList .. interfaceName .. " "
			else
				metricList = metricList .. interfaceName .. " " .. metricValue .. "\n"
			end
			-- check if any interfaces have a higher reliability requirement than tracking IPs configured
			local trackingNumber = tonumber(ut.trim(sys.exec("echo $(uci -p /var/state get mwan3." .. interfaceName .. ".track_ip) | wc -w")))
			if trackingNumber > 0 then
				local reliabilityNumber = tonumber(ut.trim(sys.exec("uci -p /var/state get mwan3." .. interfaceName .. ".reliability")))
				if reliabilityNumber and reliabilityNumber > trackingNumber then
					errorFound = 1
					errorReliabilityList = errorReliabilityList .. interfaceName .. " "
				end
			end
			-- check if any interfaces are not properly configured in /etc/config/network or have no default route in main routing table
			if ut.trim(sys.exec("uci -p /var/state get network." .. interfaceName)) == "interface" then
				local interfaceDevice = ut.trim(sys.exec("uci -p /var/state get network." .. interfaceName .. ".ifname"))
				if interfaceDevice == "uci: Entry not found" or interfaceDevice == "" then
					errorFound = 1
					errorNetConfigList = errorNetConfigList .. interfaceName .. " "
					errorRouteList = errorRouteList .. interfaceName .. " "
				else
					local routeCheck = ut.trim(sys.exec("route -n | awk '{if ($8 == \"" .. interfaceDevice .. "\" && $1 == \"0.0.0.0\" && $3 == \"0.0.0.0\") print $1}'"))
					if routeCheck == "" then
						errorFound = 1
						errorRouteList = errorRouteList .. interfaceName .. " "
					end
				end
			else
				errorFound = 1
				errorNetConfigList = errorNetConfigList .. interfaceName .. " "
				errorRouteList = errorRouteList .. interfaceName .. " "
			end
		end
	)
	-- check if any interfaces have duplicate metrics
	local metricDuplicateNumbers = sys.exec("echo '" .. metricList .. "' | awk '{print $2}' | uniq -d")
	if metricDuplicateNumbers ~= "" then
		errorFound = 1
		local metricDuplicates = ""
		for line in metricDuplicateNumbers:gmatch("[^\r\n]+") do
			metricDuplicates = sys.exec("echo '" .. metricList .. "' | grep '" .. line .. "' | awk '{print $1}'")
			errorDuplicateMetricList = errorDuplicateMetricList .. metricDuplicates
		end
		errorDuplicateMetricList = sys.exec("echo '" .. errorDuplicateMetricList .. "' | tr '\n' ' '")
	end
end

function interfaceWarnings() -- display status and warning messages at the top of the page
	local warnings = ""
	if interfaceNumber <= 250 then
		warnings = "<strong>There are currently " .. interfaceNumber .. " of 250 supported interfaces configured</strong>"
	else
		warnings = "<font color=\"ff0000\"><strong>WARNING: " .. interfaceNumber .. " interfaces are configured exceeding the maximum of 250!</strong></font>"
	end
	if errorReliabilityList ~= " " then
		warnings = warnings .. "<br /><br /><font color=\"ff0000\"><strong>WARNING: some interfaces have a higher reliability requirement than there are tracking IP addresses!</strong></font>"
	end
	if errorRouteList ~= " " then
		warnings = warnings .. "<br /><br /><font color=\"ff0000\"><strong>WARNING: some interfaces have no default route in the main routing table!</strong></font>"
	end
	if errorNetConfigList ~= " " then
		warnings = warnings .. "<br /><br /><font color=\"ff0000\"><strong>WARNING: some interfaces are configured incorrectly or not at all in /etc/config/network!</strong></font>"
	end
	if errorNoMetricList ~= " " then
		warnings = warnings .. "<br /><br /><font color=\"ff0000\"><strong>WARNING: some interfaces have no metric configured in /etc/config/network!</strong></font>"
	end
	if errorDuplicateMetricList ~= " " then
		warnings = warnings .. "<br /><br /><font color=\"ff0000\"><strong>WARNING: some interfaces have duplicate metrics configured in /etc/config/network!</strong></font>"
	end
	return warnings
end

-- ------ interface configuration ------ --

dsp = require "luci.dispatcher"
sys = require "luci.sys"
ut = require "luci.util"

interfaceNumber = 0
metricList = ""
errorFound = 0
errorDuplicateMetricList = " "
errorNetConfigList = " "
errorNoMetricList = " "
errorReliabilityList = " "
errorRouteList = " "
interfaceCheck()


m5 = Map("mwan3", translate("MWAN Interface Configuration"),
	translate(interfaceWarnings()))
	m5:append(Template("mwan/config_css"))


mwan_interface = m5:section(TypedSection, "interface", translate("Interfaces"),
	translate("MWAN supports up to 250 physical and/or logical interfaces<br />" ..
	"MWAN requires that all interfaces have a unique metric configured in /etc/config/network<br />" ..
	"Names must match the interface name found in /etc/config/network (see advanced tab)<br />" ..
	"Names may contain characters A-Z, a-z, 0-9, _ and no spaces<br />" ..
	"Interfaces may not share the same name as configured members, policies or rules"))
	mwan_interface.addremove = true
	mwan_interface.dynamic = false
	mwan_interface.sectionhead = "Interface"
	mwan_interface.sortable = true
	mwan_interface.template = "cbi/tblsection"
	mwan_interface.extedit = dsp.build_url("admin", "network", "mwan", "configuration", "interface", "%s")
	function mwan_interface.create(self, section)
		TypedSection.create(self, section)
		m5.uci:save("mwan3")
		luci.http.redirect(dsp.build_url("admin", "network", "mwan", "configuration", "interface", section))
	end


enabled = mwan_interface:option(DummyValue, "enabled", translate("Enabled"))
	enabled.rawhtml = true
	function enabled.cfgvalue(self, s)
		if self.map:get(s, "enabled") == "1" then
			return "Yes"
		else
			return "No"
		end
	end

track_ip = mwan_interface:option(DummyValue, "track_ip", translate("Tracking IP"))
	track_ip.rawhtml = true
	function track_ip.cfgvalue(self, s)
		tracked = self.map:get(s, "track_ip")
		if tracked then
			local ipList = ""
			for k,v in pairs(tracked) do
				ipList = ipList .. v .. "<br />"
			end
			return ipList
		else
			return "&#8212;"
		end
	end

reliability = mwan_interface:option(DummyValue, "reliability", translate("Tracking reliability"))
	reliability.rawhtml = true
	function reliability.cfgvalue(self, s)
		if tracked then
			return self.map:get(s, "reliability") or "&#8212;"
		else
			return "&#8212;"
		end
	end

count = mwan_interface:option(DummyValue, "count", translate("Ping count"))
	count.rawhtml = true
	function count.cfgvalue(self, s)
		if tracked then
			return self.map:get(s, "count") or "&#8212;"
		else
			return "&#8212;"
		end
	end

timeout = mwan_interface:option(DummyValue, "timeout", translate("Ping timeout"))
	timeout.rawhtml = true
	function timeout.cfgvalue(self, s)
		if tracked then
			local timeoutValue = self.map:get(s, "timeout")
			if timeoutValue then
				return timeoutValue .. "s"
			else
				return "&#8212;"
			end
		else
			return "&#8212;"
		end
	end

interval = mwan_interface:option(DummyValue, "interval", translate("Ping interval"))
	interval.rawhtml = true
	function interval.cfgvalue(self, s)
		if tracked then
			local intervalValue = self.map:get(s, "interval")
			if intervalValue then
				return intervalValue .. "s"
			else
				return "&#8212;"
			end
		else
			return "&#8212;"
		end
	end

down = mwan_interface:option(DummyValue, "down", translate("Interface down"))
	down.rawhtml = true
	function down.cfgvalue(self, s)
		if tracked then
			return self.map:get(s, "down") or "&#8212;"
		else
			return "&#8212;"
		end
	end

up = mwan_interface:option(DummyValue, "up", translate("Interface up"))
	up.rawhtml = true
	function up.cfgvalue(self, s)
		if tracked then
			return self.map:get(s, "up") or "&#8212;"
		else
			return "&#8212;"
		end
	end

metric = mwan_interface:option(DummyValue, "metric", translate("Metric"))
	metric.rawhtml = true
	function metric.cfgvalue(self, s)
		local metricValue = sys.exec("uci -p /var/state get network." .. s .. ".metric")
		if metricValue ~= "" then
			return metricValue
		else
			return "&#8212;"
		end
	end

errors = mwan_interface:option(DummyValue, "errors", translate("Errors"))
	errors.rawhtml = true
	function errors.cfgvalue(self, s)
		if errorFound == 1 then
			local mouseOver, lineBreak = "", ""
			if string.find(errorReliabilityList, " " .. s .. " ") then
				mouseOver = "Higher reliability requirement than there are tracking IP addresses"
				lineBreak = "&#10;&#10;"
			end
			if string.find(errorRouteList, " " .. s .. " ") then
				mouseOver = mouseOver .. lineBreak .. "No default route in the main routing table"
				lineBreak = "&#10;&#10;"
			end
			if string.find(errorNetConfigList, " " .. s .. " ") then
				mouseOver = mouseOver .. lineBreak .. "Configured incorrectly or not at all in /etc/config/network"
				lineBreak = "&#10;&#10;"
			end
			if string.find(errorNoMetricList, " " .. s .. " ") then
				mouseOver = mouseOver .. lineBreak .. "No metric configured in /etc/config/network"
				lineBreak = "&#10;&#10;"
			end
			if string.find(errorDuplicateMetricList, " " .. s .. " ") then
				mouseOver = mouseOver .. lineBreak .. "Duplicate metric configured in /etc/config/network"
			end
			if mouseOver == "" then
				return ""
			else
				return "<span title=\"" .. mouseOver .. "\"><img src=\"/luci-static/resources/cbi/reset.gif\" alt=\"error\"></img></span>"
			end
		else
			return ""
		end
	end


return m5
