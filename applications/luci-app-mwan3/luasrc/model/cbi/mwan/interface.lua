-- Copyright 2014 Aedan Renner <chipdankly@gmail.com
-- Copyright 2018 Florian Eckert <fe@dev.tdt.de>
-- Licensed to the public under the GNU General Public License v2.

dsp = require "luci.dispatcher"


function interfaceWarnings(overview, count)
	local warnings = ""
	if count <= 250 then
		warnings = string.format("<strong>%s</strong></br>",
			translatef("There are currently %d of 250 supported interfaces configured", count)
			)
	else
		warnings = string.format("<strong>%s</strong></br>",
			translatef("WARNING: %d interfaces are configured exceeding the maximum of 250!", count)
			)
	end

	for i, k in pairs(overview) do
		if overview[i]["network"] == false then
			warnings = warnings .. string.format("<strong>%s</strong></br>",
					translatef("WARNING: Interface %s are not found in /etc/config/network", i)
					)
		end

		if overview[i]["default_route"] == false then
			warnings = warnings .. string.format("<strong>%s</strong></br>",
				translatef("WARNING: Interface %s has no default route in the main routing table", i)
				)
		end

		if overview[i]["reliability"] == false then
			warnings = warnings .. string.format("<strong>%s</strong></br>",
				translatef("WARNING: Interface %s has a higher reliability " ..
				"requirement than tracking hosts (%d)", i, overview[i]["tracking"])
				)
		end

		if overview[i]["duplicate_metric"] == true then
			warnings = warnings .. string.format("<strong>%s</strong></br>",
				translatef("WARNING: Interface %s has a duplicate metric %s configured", i, overview[i]["metric"])
				)
		end
	end

	return warnings
end

function configCheck()
	local overview = {}
	local count = 0
	local duplicate_metric = {}
	uci.cursor():foreach("mwan3", "interface",
		function (section)
			local uci = uci.cursor(nil, "/var/state")
			local iface = section[".name"]
			overview[iface] = {}
			count = count + 1
			local network = uci:get("network", iface)
			overview[iface]["network"] = false
			if network ~= nil then
				overview[iface]["network"] = true

				local device = uci:get("network", iface, "ifname")
				if device ~= nil then
					overview[iface]["device"] = device
				end

				local metric = uci:get("network", iface, "metric")
				if metric ~= nil then
					overview[iface]["metric"] = metric
					overview[iface]["duplicate_metric"] = false
					for _, m in ipairs(duplicate_metric) do
						if m == metric then
							overview[iface]["duplicate_metric"] = true
						end
					end
					table.insert(duplicate_metric, metric)
				end

				local dump = require("luci.util").ubus("network.interface.%s" % iface, "status", {})
				overview[iface]["default_route"] = false
				if dump and dump.route then
					local _, route
					for _, route in ipairs(dump.route) do
						if dump.route[_].target == "0.0.0.0" then
							overview[iface]["default_route"] = true
						end
					end
				end
			end

			local trackingNumber = uci:get("mwan3", iface, "track_ip")
			overview[iface]["tracking"] = 0
			if trackingNumber and #trackingNumber > 0 then
				overview[iface]["tracking"] = #trackingNumber
				overview[iface]["reliability"] = false
				local reliabilityNumber = tonumber(uci:get("mwan3", iface, "reliability"))
				if reliabilityNumber and reliabilityNumber <= #trackingNumber then
					overview[iface]["reliability"] = true
				end
			end
		end
	)
	return overview, count
end

m5 = Map("mwan3", translate("MWAN - Interfaces"),
	interfaceWarnings(configCheck()))

mwan_interface = m5:section(TypedSection, "interface", nil,
	translate("MWAN supports up to 250 physical and/or logical interfaces<br />" ..
	"MWAN requires that all interfaces have a unique metric configured in /etc/config/network<br />" ..
	"Names must match the interface name found in /etc/config/network (see advanced tab)<br />" ..
	"Names may contain characters A-Z, a-z, 0-9, _ and no spaces<br />" ..
	"Interfaces may not share the same name as configured members, policies or rules"))
mwan_interface.addremove = true
mwan_interface.dynamic = false
mwan_interface.sectionhead = translate("Interface")
mwan_interface.sortable = false
mwan_interface.template = "cbi/tblsection"
mwan_interface.extedit = dsp.build_url("admin", "network", "mwan", "interface", "%s")
function mwan_interface.create(self, section)
	TypedSection.create(self, section)
	m5.uci:save("mwan3")
	luci.http.redirect(dsp.build_url("admin", "network", "mwan", "interface", section))
end

enabled = mwan_interface:option(DummyValue, "enabled", translate("Enabled"))
enabled.rawhtml = true
function enabled.cfgvalue(self, s)
	if self.map:get(s, "enabled") == "1" then
		return translate("Yes")
	else
		return translate("No")
	end
end

track_method = mwan_interface:option(DummyValue, "track_method", translate("Tracking method"))
track_method.rawhtml = true
function track_method.cfgvalue(self, s)
	local tracked = self.map:get(s, "track_ip")
	if tracked then
		return self.map:get(s, "track_method") or "&#8212;"
	else
		return "&#8212;"
	end
end

reliability = mwan_interface:option(DummyValue, "reliability", translate("Tracking reliability"))
reliability.rawhtml = true
function reliability.cfgvalue(self, s)
	local tracked = self.map:get(s, "track_ip")
	if tracked then
		return self.map:get(s, "reliability") or "&#8212;"
	else
		return "&#8212;"
	end
end

interval = mwan_interface:option(DummyValue, "interval", translate("Ping interval"))
interval.rawhtml = true
function interval.cfgvalue(self, s)
	local tracked = self.map:get(s, "track_ip")
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
	local tracked = self.map:get(s, "track_ip")
	if tracked then
		return self.map:get(s, "down") or "&#8212;"
	else
		return "&#8212;"
	end
end

up = mwan_interface:option(DummyValue, "up", translate("Interface up"))
up.rawhtml = true
function up.cfgvalue(self, s)
	local tracked = self.map:get(s, "track_ip")
	if tracked then
		return self.map:get(s, "up") or "&#8212;"
	else
		return "&#8212;"
	end
end

metric = mwan_interface:option(DummyValue, "metric", translate("Metric"))
metric.rawhtml = true
function metric.cfgvalue(self, s)
	local uci = uci.cursor(nil, "/var/state")
	local metric = uci:get("network", s, "metric")
	if metric then
		return metric
	else
		return "&#8212;"
	end
end

return m5
