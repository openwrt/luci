#!/bin/sh
# Setup_splash, takes 1 argument: 1=net

. /etc/functions.sh
. $dir/functions.sh

net=$1

handle_splash() {
	config_get network "$1" network
	if [ "$network" == "${netrenamed}dhcp" ]; then
		if [ "$cleanup" == 1 ]; then
			section_cleanup luci_splash.$1
		else
			if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
				section_rename luci_splash $1 ${netrenamed}dhcp
			fi
		fi
	fi
}
config_load luci_splash
config_foreach handle_splash iface

uci batch << EOF
set luci_splash.${netrenamed}dhcp="iface"
set luci_splash.${netrenamed}dhcp.network="${netrenamed}dhcp"
set luci_splash.${netrenamed}dhcp.zone="freifunk"
EOF

echo "    network: ${netrenamed}dhcp"

uci commit

/etc/init.d/luci_splash enable

