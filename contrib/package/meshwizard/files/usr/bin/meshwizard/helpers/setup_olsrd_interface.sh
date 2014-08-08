#!/bin/sh
# Sets up olsrd interfaces
# arg $1 = net

net=$1

. /lib/functions.sh
. $dir/functions.sh

local protocols="4"
if [ "$ipv6_enabled" = 1 ] && [ "$has_ipv6" == "1" ]; then
	protocols="4 6"
fi

for proto in $protocols; do

	cfg="olsrd"
	[ "$proto" == "6" ] && cfg="olsrd6"

	# Rename interface for $netrenamed
	handle_interface() {
		config_get interface "$1" Interface
		if [ "$interface" == "$netrenamed" ]; then
			if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
				section_rename $cfg $1 $netrenamed
			fi
		fi
	}

	config_foreach handle_interface Interface

	# Setup new interface for $netrenamed

	uci set $cfg.$netrenamed=Interface
	set_defaults "olsr_interface_" $cfg.$net
	uci set $cfg.$netrenamed.interface="$netrenamed"

	uci_commitverbose "Setup olsr interface for $netrenamed." $cfg

	if [ "$proto" = "4" ]; then
		# If dhcp-network is inside the mesh_network then add HNA for it

		dhcprange=$(uci -q get meshwizard.netconfig.$net\_dhcprange)
		uci -q delete $cfg.${netrenamed}clients

		if [ -n "$dhcprange" ]; then
			meshnet="$(uci get profile_$community.profile.mesh_network)"
			dhcpinmesh="$($dir/helpers/check-range-in-range.sh $dhcprange $meshnet)"

			if [ "$dhcpinmesh" == 1 ] && [ -n "$meshnet" ]; then
				uci set $cfg.${netrenamed}clients="Hna4"
				eval $(sh $dir/helpers/ipcalc-cidr.sh $dhcprange)
				uci set $cfg.${netrenamed}clients.netaddr="$NETWORK"
				uci set $cfg.${netrenamed}clients.netmask="$NETMASK"
				uci_commitverbose "Setup HNA for network $dhcprange" $cfg
			fi
		fi
	fi

	if [ "$proto" = "6" ]; then
		# Set Hna entry for ipv6 net for static ipv6 config
		uci -q delete $cfg.${netrenamed}static
		if [ "$ipv6_config" = "static" ]; then
			local v6range="$(uci -q get meshwizard.netconfig.$net\_ip6addr)"
			local v6net="$(echo $v6range | cut -d '/' -f 1)"
			local v6mask="$(echo $v6range | cut -d '/' -f 2)"
			if [ -n "$v6net" ] && [ -n "$v6mask" ]; then
				uci set $cfg.${netrenamed}static="Hna6"
				uci set $cfg.${netrenamed}static.netaddr="$v6net"
				uci set $cfg.${netrenamed}static.prefix="$v6mask"
				uci_commitverbose "Setup HNA for network $v6range" $cfg
			fi
		fi
	fi

done