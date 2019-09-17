-- Copyright 2008 Freifunk Leipzig / Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

local ip = require("luci.sys.iptparser").IptParser()

local chains  = { }
local targets = { }

for i, rule in ipairs( ip:find() ) do
	if rule.chain and rule.target then
		chains[rule.chain] = true
		targets[rule.target] = true
	end
end

m = Map("luci_collectd",
	translate("Iptables Plugin Configuration"),
	translate(
		"The iptables plugin will monitor selected firewall rules and " ..
		"collect information about processed bytes and packets per rule."
	))

-- iptables config section
s = m:section( NamedSection, "iptables", "plugin" )

-- iptables.enable
enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

-- iptables_match config section (Chain directives)
rule = m:section( TypedSection, "iptables_match",
	translate("Add matching rule"),
	translate(
		"Here you can define various criteria by which the monitored " ..
		"iptables rules are selected."
	))
rule.addremove = true
rule.anonymous = true

-- iptables_match.name
rule_table = rule:option( Value, "name",
	translate("Name of the rule"), translate("max. 16 chars") )

-- iptables_match.table
rule_table = rule:option( ListValue, "table", translate("Table") )
rule_table.default  = "filter"
rule_table.rmempty  = true
rule_table.optional = true
rule_table:value("")
rule_table:value("filter")
rule_table:value("nat")
rule_table:value("mangle")

-- iptables_match.chain
rule_chain = rule:option( ListValue, "chain", translate("Chain") )
rule_chain.rmempty  = true
rule_chain.optional = true
rule_chain:value("")
for chain, void in pairs( chains ) do
	rule_chain:value( chain )
end

-- The follwing values are not needed by the collectd but this is needed
-- to find the rule index
rule_target = rule:option( ListValue, "target", translate("Action (target)") )
rule_target.rmempty  = true
rule_target.optional = true
rule_target:value("")
for target, void in pairs( targets ) do
	rule_target:value( target )
end

rule_protocol = rule:option( ListValue, "protocol", translate("Network protocol") )
rule_protocol.rmempty  = true
rule_protocol.optional = true
rule_protocol:value("")
rule_protocol:value("tcp")
rule_protocol:value("udp")
rule_protocol:value("icmp")

rule_source = rule:option( Value, "source", translate("Source ip range") )
rule_source.default  = "0.0.0.0/0"
rule_source.rmempty  = true
rule_source.optional = true

rule_destination = rule:option( Value, "destination", translate("Destination ip range") )
rule_destination.default  = "0.0.0.0/0"
rule_destination.rmempty  = true
rule_destination.optional = true

rule_inputif = rule:option( Value, "inputif",
	translate("Incoming interface"), translate("e.g. br-lan") )
rule_inputif.rmempty  = true
rule_inputif.optional = true

rule_outputif = rule:option( Value, "outputif",
	translate("Outgoing interface"), translate("e.g. br-ff") )
rule_outputif.rmempty  = true
rule_outputif.optional = true

rule_options = rule:option( Value, "options",
	translate("Options"), translate("e.g. reject-with tcp-reset") )
rule_options.rmempty  = true
rule_options.optional = true

return m
