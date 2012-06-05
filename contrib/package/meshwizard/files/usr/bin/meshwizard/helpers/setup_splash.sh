#!/bin/sh
# Setup_splash, takes 1 argument: 1=net

. /lib/functions.sh
. $dir/functions.sh

net=$1

if [ ! "$has_luci_splash" == TRUE ]; then
	echo "    Luci Splash is not installed, skipping setup of it."
	exit
fi

set_defaults "luci_splash_" luci_splash.general
uci_commitverbose "Setup general splash settings" luci_splash

dhcprange=$(uci -q get meshwizard.netconfig.$net\_dhcprange)

if [ "$(uci -q get meshwizard.netconfig.$net\_dhcp)" == 1 ] && [ -n "$dhcprange" ]; then
	handle_splash() {
		config_get network "$1" network
		if [ "$network" == "${netrenamed}dhcp" ]; then
			if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
				section_rename luci_splash $1 ${netrenamed}dhcp
			fi
		fi
	}
	config_load luci_splash
	config_foreach handle_splash iface

	uci batch <<- EOF
		set luci_splash.${netrenamed}dhcp="iface"
		set luci_splash.${netrenamed}dhcp.network="${netrenamed}dhcp"
		set luci_splash.${netrenamed}dhcp.zone="freifunk"
	EOF

	uci_commitverbose "Setup dhcpsplash for ${netrenamed}dhcp" luci_splash
	/etc/init.d/luci_splash enable
fi

