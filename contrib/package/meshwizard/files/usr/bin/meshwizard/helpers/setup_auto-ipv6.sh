#!/bin/sh

. $dir/functions.sh

# Setup auto-ipv6

if [ "$profile_ipv6_config" = "auto-ipv6-dhcpv6" ]; then
	uci set autoipv6.olsr_node.enable=1
	uci_commitverbose "Setup auto-ipv6 for dhcpv6 mode" autoipv6
fi

	

