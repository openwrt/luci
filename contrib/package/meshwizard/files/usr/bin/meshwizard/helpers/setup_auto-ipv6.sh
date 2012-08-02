#!/bin/sh

. $dir/functions.sh

if [ "$general_ipv6_config" = "auto-ipv6-fromv4" ]; then
	mode="fromv4"
else
	mode="random"
fi

uci set autoipv6.olsr_node.enabled=1
uci set autoipv6.olsr_node.mode="$mode"
uci_commitverbose "Setup auto-ipv6" autoipv6
