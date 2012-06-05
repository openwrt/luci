#!/bin/sh
# Setup static interface settings for lan if lan is not an olsr interface

[ ! "$(uci -q get network.lan)" == "interface" ] && exit

. /lib/functions.sh
. $dir/functions.sh

uci batch << EOF
	set network.lan.proto='$lan_proto'
	set network.lan.ipaddr='$lan_ip4addr'
	set network.lan.netmask='$lan_netmask'
EOF

uci_commitverbose "Setup static ip settings for lan" network

uci delete meshwizard.lan && uci commit meshwizard
