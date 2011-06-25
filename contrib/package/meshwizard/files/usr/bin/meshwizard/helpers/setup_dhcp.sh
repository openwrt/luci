#!/bin/sh
# Sets up the dhcp part of dnsmasq

. /etc/functions.sh
. $dir/functions.sh

net="$1"

handle_dnsmasq() {
	config_get interface "$1" interface
	if [ "$interface" == "${netrenamed}dhcp" ]; then
		if [ "$cleanup" == 1 ]; then
			section_cleanup dhcp.$1
		else
			if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
				section_rename dhcp $1 ${netrenamed}dhcp
                        fi
                fi
        fi
}
config_load dhcp
config_foreach handle_dnsmasq dhcp

uci batch << EOF
set dhcp.${netrenamed}dhcp="dhcp"
set dhcp.${netrenamed}dhcp.leasetime="${dhcp_leasetime}"
set dhcp.${netrenamed}dhcp.force="1"
set dhcp.${netrenamed}dhcp.interface="${netrenamed}dhcp"
EOF

echo "    leasetime: ${dhcp_leasetime}
    interface: ${netrenamed}dhcp"

