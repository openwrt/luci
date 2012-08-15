#!/bin/sh

. $dir/functions.sh

if [ "$ipv6_config" = "auto-ipv6-fromv4" ]; then
	mode="fromv4"
else
	mode="random"
fi

uci set autoipv6.olsr_node.enabled=1
uci set autoipv6.olsr_node.mode="$mode"
uci_commitverbose "Setup auto-ipv6" autoipv6

uci set network.wan.accept_ra=0
uci_commitverbose "Do not accept ra's on wan when using auto-ipv6" network

