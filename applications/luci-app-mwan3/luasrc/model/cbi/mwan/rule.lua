-- ------ extra functions ------ --

function ruleCheck() -- determine if rules needs a proper protocol configured
	uci.cursor():foreach("mwan3", "rule",
		function (section)
			local sourcePort = ut.trim(sys.exec("uci -p /var/state get mwan3." .. section[".name"] .. ".src_port"))
			local destPort = ut.trim(sys.exec("uci -p /var/state get mwan3." .. section[".name"] .. ".dest_port"))
			if sourcePort ~= "" or destPort ~= "" then -- ports configured
				local protocol = ut.trim(sys.exec("uci -p /var/state get mwan3." .. section[".name"] .. ".proto"))
				if protocol == "" or protocol == "all" then -- no or improper protocol
					error_protocol_list = error_protocol_list .. section[".name"] .. " "
				end
			end
		end
	)
end

function ruleWarn() -- display warning messages at the top of the page
	if error_protocol_list ~= " " then
		return "<font color=\"ff0000\"><strong>WARNING: some rules have a port configured with no or improper protocol specified! Please configure a specific protocol!</strong></font>"
	else
		return ""
	end
end

-- ------ rule configuration ------ --

dsp = require "luci.dispatcher"
sys = require "luci.sys"
ut = require "luci.util"

error_protocol_list = " "
ruleCheck()


m5 = Map("mwan3", translate("MWAN Rule Configuration"),
	translate(ruleWarn()))
	m5:append(Template("mwan/config_css"))


mwan_rule = m5:section(TypedSection, "rule", translate("Traffic Rules"),
	translate("Rules specify which traffic will use a particular MWAN policy based on IP address, port or protocol<br />" ..
	"Rules are matched from top to bottom. Rules below a matching rule are ignored. Traffic not matching any rule is routed using the main routing table<br />" ..
	"Traffic destined for known (other than default) networks is handled by the main routing table. Traffic matching a rule, but all WAN interfaces for that policy are down will be blackholed<br />" ..
	"Names may contain characters A-Z, a-z, 0-9, _ and no spaces<br />" ..
	"Rules may not share the same name as configured interfaces, members or policies"))
	mwan_rule.addremove = true
	mwan_rule.anonymous = false
	mwan_rule.dynamic = false
	mwan_rule.sectionhead = "Rule"
	mwan_rule.sortable = true
	mwan_rule.template = "cbi/tblsection"
	mwan_rule.extedit = dsp.build_url("admin", "network", "mwan", "configuration", "rule", "%s")
	function mwan_rule.create(self, section)
		TypedSection.create(self, section)
		m5.uci:save("mwan3")
		luci.http.redirect(dsp.build_url("admin", "network", "mwan", "configuration", "rule", section))
	end


src_ip = mwan_rule:option(DummyValue, "src_ip", translate("Source address"))
	src_ip.rawhtml = true
	function src_ip.cfgvalue(self, s)
		return self.map:get(s, "src_ip") or "&#8212;"
	end

src_port = mwan_rule:option(DummyValue, "src_port", translate("Source port"))
	src_port.rawhtml = true
	function src_port.cfgvalue(self, s)
		return self.map:get(s, "src_port") or "&#8212;"
	end

dest_ip = mwan_rule:option(DummyValue, "dest_ip", translate("Destination address"))
	dest_ip.rawhtml = true
	function dest_ip.cfgvalue(self, s)
		return self.map:get(s, "dest_ip") or "&#8212;"
	end

dest_port = mwan_rule:option(DummyValue, "dest_port", translate("Destination port"))
	dest_port.rawhtml = true
	function dest_port.cfgvalue(self, s)
		return self.map:get(s, "dest_port") or "&#8212;"
	end

proto = mwan_rule:option(DummyValue, "proto", translate("Protocol"))
	proto.rawhtml = true
	function proto.cfgvalue(self, s)
		return self.map:get(s, "proto") or "all"
	end

sticky = mwan_rule:option(DummyValue, "sticky", translate("Sticky"))
	sticky.rawhtml = true
	function sticky.cfgvalue(self, s)
		if self.map:get(s, "sticky") == "1" then
			stickied = 1
			return "Yes"
		else
			stickied = nil
			return "No"
		end
	end

timeout = mwan_rule:option(DummyValue, "timeout", translate("Sticky timeout"))
	timeout.rawhtml = true
	function timeout.cfgvalue(self, s)
		if stickied then
			local timeoutValue = self.map:get(s, "timeout")
			if timeoutValue then
				return timeoutValue .. "s"
			else
				return "600s"
			end
		else
			return "&#8212;"
		end
	end

ipset = mwan_rule:option(DummyValue, "ipset", translate("IPset"))
	ipset.rawhtml = true
	function ipset.cfgvalue(self, s)
		return self.map:get(s, "ipset") or "&#8212;"
	end

use_policy = mwan_rule:option(DummyValue, "use_policy", translate("Policy assigned"))
	use_policy.rawhtml = true
	function use_policy.cfgvalue(self, s)
		return self.map:get(s, "use_policy") or "&#8212;"
	end

errors = mwan_rule:option(DummyValue, "errors", translate("Errors"))
	errors.rawhtml = true
	function errors.cfgvalue(self, s)
		if not string.find(error_protocol_list, " " .. s .. " ") then
			return ""
		else
			return "<span title=\"No protocol specified\"><img src=\"/luci-static/resources/cbi/reset.gif\" alt=\"error\"></img></span>"
		end
	end


return m5
