#!/bin/sh
# sets up a wifi interface for meshing
# Arguments: $1 = network interface

net="$1"
. /lib/functions.sh
. $dir/functions.sh

##### wifi-device #####

# Get the type before we delete the wifi-device
config_load wireless
config_get type $net type

# Rename wifi-device for $net

handle_wifidevice() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename wireless $1 $net
	fi
}
config_foreach handle_wifidevice wifi-device

# create new wifi-device for $net
uci set wireless.${net}=wifi-device

# get and set wifi-device defaults
set_defaults "wifi_device_" wireless.${net}

channel="$(uci -q get meshwizard.netconfig.$net\_channel)"

if [ -z "$channel" -o "$channel" == "default" ]; then
	channel=$wifi_device_channel
fi

uci batch << EOF
	set wireless.${net}.type="$type"
	set wireless.${net}.channel="$channel"
EOF

uci_commitverbose "Setup wifi device for $netrenamed" wireless

##### wifi iface

# Rename wifi-iface for $net
handle_interface() {
	config_get device "$1" device
	if [ "$device" == "$net" ]; then
		if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
			section_rename wireless $1 ${net}_iface
		fi
	fi
} 
config_foreach handle_interface wifi-iface

# create new wifi-device for $net
uci set wireless.$net\_iface=wifi-iface

# create new wifi-iface for $net from defaults
set_defaults "wifi_iface_" wireless.$net\_iface

# overwrite some settings for type atheros (madwifi)
if [ "$type" = "atheros" ]; then
       set_defaults "madwifi_wifi_iface_" wireless.${net}
fi

# overwrite defaults
bssid="$($dir/helpers/gen_bssid.sh $channel $community)"

ssid="$profile_ssid"
if [ "$profile_ssid_scheme" == "addchannel" ]; then
	ssid="$ssid - ch$channel"
elif [ "$profile_ssid_scheme" == "addchannelbefore" ]; then
	ssid="ch$channel.$ssid"
fi

uci batch << EOF
	set wireless.$net\_iface.device="${net}"
	set wireless.$net\_iface.network="$netrenamed"
	set wireless.$net\_iface.ssid="$ssid"
	set wireless.$net\_iface.bssid="$bssid"
EOF

uci_commitverbose "Setup wifi interface for $netrenamed" wireless

