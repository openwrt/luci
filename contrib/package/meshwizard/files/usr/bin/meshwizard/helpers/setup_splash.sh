#!/bin/sh
# Setup_splash, takes 1 argument: 1=net

. /lib/functions.sh
. $dir/functions.sh

net=$1
vap=$(uci -q get meshwizard.netconfig.${net}_vap)

if [ ! "$has_luci_splash" == TRUE ]; then
	echo "    Luci Splash is not installed, skipping setup of it."
	exit
fi

set_defaults "luci_splash_" luci_splash.general
uci_commitverbose "Setup general splash settings" luci_splash

dhcprange=$(uci -q get meshwizard.netconfig.$net\_dhcprange)

splash_net_add() {
	uci batch <<- EOF
		set luci_splash.$1="iface"
		set luci_splash.$1.network="$1"
		set luci_splash.$1.zone="freifunk"
	EOF
}

if [ "$(uci -q get meshwizard.netconfig.$net\_dhcp)" = 1 ] && [ -n "$dhcprange" ]; then
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

	if [ "$supports_vap" = 1 -a "$vap" = 1 ]; then
		splash_net_add ${netrenamed}dhcp
		uci_commitverbose "Setup dhcpsplash for ${netrenamed}dhcp" luci_splash
	fi

	ahdhcp_when_vap="$(uci get profile_$community.profile.adhoc_dhcp_when_vap)"
	if [ "$supports_vap" = 0 ] || \
		[ "$supports_vap" = 1 -a "$vap" = 1 -a "$ahdhcp_when_vap" = 1 ] || \
		[ "$lan_dhcp" = 1 ]; then
		splash_net_add ${netrenamed}ahdhcp
		uci_commitverbose "Setup dhcpsplash for ${netrenamed}ahdhcp" luci_splash
	fi
	/etc/init.d/luci_splash enable
fi

