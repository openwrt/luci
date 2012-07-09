#!/bin/sh
# Setup dhcp interface settings for wan. This is the OpenWrt default,
# so all we need to do here is to delete wan from meshwizard after setup.

[ ! "$(uci -q get network.wan)" == "interface" ] && exit

. /lib/functions.sh
. $dir/functions.sh

uci delete meshwizard.wan && uci commit meshwizard

