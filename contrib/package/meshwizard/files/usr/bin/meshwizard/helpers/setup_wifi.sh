#!/bin/sh
# sets up a wifi interface for meshing
# Arguments: $1 = network interface

net="$1"
. /etc/functions.sh
. $dir/functions.sh

##### wifi-device #####

echo "    + Setup wifi-device"

# Get the type before we delete the wifi-device
config_load wireless
config_get type $net type

# Delete old wifi-device for $net

handle_wifidevice() {
	if [ "$1" == "$net" -a "$cleanup" == 1 ]; then
		section_cleanup wireless.${net}
	else
		if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
			section_rename wireless $1 $net
		fi
	fi
}
config_foreach handle_wifidevice wifi-device

# create new wifi-device for $net
uci set wireless.${net}=wifi-device

# get and set wifi-device defaults
set_defaults "wifi_device_" wireless.${net}

channel="$(uci -q get meshwizard.netconfig.$net\_channel)"
vap="$(uci -q get meshwizard.netconfig.$net\_vap)"

if [ -z "$channel" -o "$channel" == "default" ]; then
	channel=$wifi_device_channel
fi

uci batch << EOF
set wireless.${net}.type="$type"
set wireless.${net}.channel="$channel"
EOF

echo "    Type: $type"
echo "    Channel: $channel"

##### wifi iface

echo "    + Setup wifi-iface"

# Delete old wifi-iface for $net
handle_interface() {
	config_get device "$1" device
	if [ "$device" == "$net" ]; then
		if [ "$cleanup" == 1 ]; then
			section_cleanup wireless.${net}_iface
		else
			if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
				section_rename wireless $1 ${net}_iface
			fi
		fi
	fi
} 
config_foreach handle_interface wifi-iface

# create new wifi-device for $net
uci set wireless.$net\_iface=wifi-iface

# create new wifi-iface for $net from defaults
set_defaults "wifi_iface_" wireless.$net\_iface

# overwrite defaults
bssid="$($dir/helpers/gen_bssid.sh $channel $community)"
uci batch << EOF
set wireless.$net\_iface.device="${net}"
set wireless.$net\_iface.network="$netrenamed"
set wireless.$net\_iface.ssid="$profile_ssid - ch$channel"
set wireless.$net\_iface.bssid="$bssid"
EOF

echo "    device: $net
    network: $netrenamed
    ssid: $profile_ssid - ch$channel
    bssid: $bssid"

## VAP
ip4addr="$(uci get meshwizard.netconfig.$net\_ip4addr)"
if [ "$type" == "atheros" -a "$vap" == 1 ]; then
	uci batch << EOF
set wireless.$net\_iface_dhcp="wifi-iface"
set wireless.$net\_iface_dhcp.device="$net"
set wireless.$net\_iface_dhcp.mode="ap"
set wireless.$net\_iface_dhcp.encryption="none"
set wireless.$net\_iface_dhcp.network="${netrenamed}dhcp"
set wireless.$net\_iface_dhcp.ssid="FF-AP-$ip4addr"
EOF
	echo "    + Setting up VAP interface for $net
    device: $net
    network: ${netrenamed}dhcp
    ssid: AP-$profile_ssid-$ip4addr"
fi

uci commit
