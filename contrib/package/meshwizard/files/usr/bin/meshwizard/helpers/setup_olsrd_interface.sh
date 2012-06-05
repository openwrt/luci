#!/bin/sh
# Sets up olsrd interfaces
# arg $1 = net

net=$1

. /lib/functions.sh
. $dir/functions.sh

# Rename interface for $netrenamed
handle_interface() {
	config_get interface "$1" Interface
	if [ "$interface" == "$netrenamed" ]; then
		if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
			section_rename olsrd $1 $netrenamed
		fi
	fi
}

config_foreach handle_interface Interface

# Setup new interface for $netrenamed

uci set olsrd.$netrenamed=Interface
set_defaults "olsr_interface_" olsrd.$net
uci set olsrd.$netrenamed.interface="$netrenamed"

uci_commitverbose "Setup olsr interface for $netrenamed." olsrd

# If dhcp-network is inside the mesh_network then add HNA for it

dhcprange=$(uci -q get meshwizard.netconfig.$net\_dhcprange)
uci -q delete olsrd.${netrenamed}clients

if [ -n "$dhcprange" ]; then
	meshnet="$(uci get profile_$community.profile.mesh_network)"
	dhcpinmesh="$($dir/helpers/check-range-in-range.sh $dhcprange $meshnet)"

	if [ "$dhcpinmesh" == 1 ] && [ -n "$meshnet" ]; then
		uci set olsrd.${netrenamed}clients="Hna4"
		eval $(sh $dir/helpers/ipcalc-cidr.sh $dhcprange)
		uci set olsrd.${netrenamed}clients.netaddr="$NETWORK"
		uci set olsrd.${netrenamed}clients.netmask="$NETMASK"
		uci_commitverbose "Setup HNA for network $dhcprange" olsrd
	fi
fi
