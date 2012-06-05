#!/bin/sh
# Sets up the dhcp part of dnsmasq

. /lib/functions.sh
. $dir/functions.sh

net="$1"

handle_dnsmasq() {
	config_get interface "$1" interface
	if [ "$interface" == "${netrenamed}dhcp" ]; then
		if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
			section_rename dhcp $1 ${netrenamed}dhcp
		fi
	fi
}
config_load dhcp
config_foreach handle_dnsmasq dhcp

[ "$net" == "lan" ] && uci -q delete dhcp.lan

uci batch << EOF
	set dhcp.${netrenamed}dhcp="dhcp"
	set dhcp.${netrenamed}dhcp.interface="${netrenamed}dhcp"
EOF

set_defaults "dhcp_" dhcp.${netrenamed}dhcp

uci_commitverbose "Setup DHCP for $netrenamed" dhcp

