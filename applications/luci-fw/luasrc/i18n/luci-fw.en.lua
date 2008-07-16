fw_portfw = "Port forwarding"
fw_routing = "Routing"
fw_fw = "Firewall"
fw_fw1 = "Here you can grant, access or redirect network traffic."
lucifw_rule_chain = "Chain"
lucifw_rule_iface = "Input interface"
lucifw_rule_oface = "Output interface"
lucifw_rule_source = "Source address"
lucifw_rule_destination = "Destination address"
lucifw_rule_mac = "MAC-Address"
lucifw_rule_sport = "Source port"
lucifw_rule_dport = "Destination port"
lucifw_rule_tosrc = "New source address [SNAT]"
lucifw_rule_todest = "New target address [DNAT]" 
lucifw_rule_jump = "Action"
lucifw_rule_command = "Custom Command"
fw_accept = "accept"
fw_reject = "reject"
fw_drop = "drop"
fw_log = "log"
fw_dnat = "change destination (DNAT) [prerouting only]"
fw_masq = "masquerade [postrouting only]"
fw_snat = "change source (SNAT) [postrouting only]"

fw_portfw1 = [[Port forwarding allows to provide network services 
in the internal network to an external network.]]
lucifw_portfw_iface_desc = "External interface"
lucifw_portfw_dport = "External port"
lucifw_portfw_dport_desc = "single port or first port-last port"
lucifw_portfw_to = "Internal address"
lucifw_portfw_to_desc = "IP, IP:port or IP:first port-last port"

fw_routing1 = [[Here you can specify which network traffic is allowed to flow between network interfaces.
Only new connections will be matched. Packets belonging to already open connections are automatically allowed
to pass the firewall in this case you do not need to set the "bidirectional" flag. NAT provides
address translation.]]
lucifw_routing_iface = "Input"
lucifw_routing_iface_desc = lucifw_rule_iface
lucifw_routing_oface = "Output" 
lucifw_routing_oface_desc = lucifw_rule_oface
lucifw_routing_fwd_desc = "forward"
lucifw_routing_nat_desc = "translate"
lucifw_routing_bidi_desc = "bidirectional"