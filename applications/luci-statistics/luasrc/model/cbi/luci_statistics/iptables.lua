--[[

Luci configuration model for statistics - collectd iptables plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("luci.sys.iptparser")

ip = luci.sys.iptparser.IptParser()
chains  = { }
targets = { }

for i, rule in ipairs( ip:find() ) do 
	chains[rule.chain] = true
	targets[rule.target] = true
end


m = Map("luci_statistics")

-- collectd_iptables config section
s = m:section( NamedSection, "collectd_iptables", "luci_statistics" )

-- collectd_iptables.enable
enable = s:option( Flag, "enable" )
enable.default = 0


-- collectd_iptables_match config section (Chain directives)
rule = m:section( TypedSection, "collectd_iptables_match" )
rule.addremove = true
rule.anonymous = true


-- collectd_iptables_match.name
rule_table = rule:option( Value, "name" )

-- collectd_iptables_match.table
rule_table = rule:option( ListValue, "table" )
rule_table.default  = "filter"
rule_table.rmempty  = true
rule_table.optional = true
rule_table:value("")
rule_table:value("filter")
rule_table:value("nat")
rule_table:value("mangle")


-- collectd_iptables_match.chain
rule_chain = rule:option( ListValue, "chain" )
rule_chain.rmempty  = true
rule_chain.optional = true
rule_chain:value("")

for chain, void in pairs( chains ) do
	rule_chain:value( chain )
end


-- collectd_iptables_match.target
rule_target = rule:option( ListValue, "target" )
rule_target.rmempty  = true
rule_target.optional = true
rule_target:value("")

for target, void in pairs( targets ) do
	rule_target:value( target )
end


-- collectd_iptables_match.protocol
rule_protocol = rule:option( ListValue, "protocol" )
rule_protocol.rmempty  = true
rule_protocol.optional = true
rule_protocol:value("")
rule_protocol:value("tcp")
rule_protocol:value("udp")
rule_protocol:value("icmp")

-- collectd_iptables_match.source
rule_source = rule:option( Value, "source" )
rule_source.default  = "0.0.0.0/0"
rule_source.rmempty  = true
rule_source.optional = true

-- collectd_iptables_match.destination
rule_destination = rule:option( Value, "destination" )
rule_destination.default  = "0.0.0.0/0"
rule_destination.rmempty  = true
rule_destination.optional = true

-- collectd_iptables_match.inputif
rule_inputif = rule:option( Value, "inputif" )
rule_inputif.rmempty  = true
rule_inputif.optional = true

-- collectd_iptables_match.outputif
rule_outputif = rule:option( Value, "outputif" )
rule_outputif.rmempty  = true
rule_outputif.optional = true

-- collectd_iptables_match.options
rule_options = rule:option( Value, "options" )
rule_options.rmempty  = true
rule_options.optional = true

return m
