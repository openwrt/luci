#!/bin/sh
# Setup static interface settings for wan if wan is not an olsr interface

[ ! "$(uci -q get network.wan)" == "interface" ] && exit

. /lib/functions.sh
. $dir/functions.sh

uci batch << EOF
set network.wan.proto='$wan_proto'
set network.wan.ipaddr='$wan_ip4addr'
set network.wan.netmask='$wan_netmask'
set network.wan.gateway='$wan_gateway'
set network.wan.dns='$wan_dns'
EOF

uci_commitverbose "Setup static ip settings for wan" network

uci delete meshwizard.wan && uci commit meshwizard

