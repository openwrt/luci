#!/bin/sh
# sets up a wifi interface for meshing
# Arguments: $1 = network interface

net="$1"
. /lib/functions.sh
. $dir/functions.sh

## Setup a VAP interface in AP Mode
ip4addr="$(uci get meshwizard.netconfig.$net\_ip4addr)"
vap="$(uci -q get meshwizard.netconfig.$net\_vap)"

if [ "$supports_vap" == 1 -a "$vap" == 1 ]; then
	uci batch <<- EOF
		set wireless.$net\_iface_dhcp="wifi-iface"
		set wireless.$net\_iface_dhcp.device="$net"
		set wireless.$net\_iface_dhcp.mode="ap"
		set wireless.$net\_iface_dhcp.encryption="none"
		set wireless.$net\_iface_dhcp.network="${netrenamed}dhcp"
		set wireless.$net\_iface_dhcp.ssid="Freifunk-$ip4addr"
	EOF
	uci_commitverbose "Setup VAP interface for $netrenamed" wireless
fi
