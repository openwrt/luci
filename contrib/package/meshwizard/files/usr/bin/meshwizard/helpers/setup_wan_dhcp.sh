#!/bin/sh
# Setup dhcp interface settings for wan. This is the OpenWrt default,
# so all we need to do here is to delete wan from meshwizard after setup.
# Also disallow ra on wan if ipv6 is enabled

[ ! "$(uci -q get network.wan)" == "interface" ] && exit

. /lib/functions.sh
. $dir/functions.sh

if [ "$ipv6_enabled" = "1" ]; then
	uci set network.wan.accept_ra='0'
	uci_commitverbose "Do not accept ra on wan interface" network
fi


uci delete meshwizard.wan && uci commit meshwizard

