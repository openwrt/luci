#!/bin/sh

# This collection of scripts will take settings from /etc/config/meshwizard, /etc/config/freifunk
# and /etc/config/profile_<community> and setup the router to participate in wireless mesh networks

# Copyright 2011 Manuel Munz <freifunk at somakoma dot de>

# Licensed under the Apache License, Version 2.0 (the "License")
# You may not use this file except in compliance with the License.
# You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

. /lib/functions.sh

echo "
/* Meshwizard 0.0.8 */
"

# config
export dir="/usr/bin/meshwizard"
. $dir/functions.sh
[ -f /proc/net/ipv6_route ] && export has_ipv6=1

# Check which packages we have installed
export has_luci=FALSE
opkg list_installed |grep luci-mod-admin > /dev/null && export has_luci=TRUE
export has_luci_splash=FALSE
opkg list_installed |grep luci-app-splash > /dev/null && export has_luci_splash=TRUE

# Check whether we want to cleanup/restore uci config before setting new options
cleanup=$(uci -q get meshwizard.general.cleanup)
[ "$cleanup" == 1 ] && $dir/helpers/restore_default_config.sh

# Rename wifi interfaces
$dir/helpers/rename-wifi.sh

# Get community
community=$(uci -q get meshwizard.community.name || uci -q get freifunk.community.name)
[ -z "$community" ] && echo "Error: Community is not set in /etc/config/freifunk, aborting now." && exit 1
export community="$community"
echo $community

# Get a list of networks we need to setup
networks=$(uci show meshwizard.netconfig | grep -v "netconfig=" | sed -e 's/meshwizard.netconfig\.\(.*\)\_.*/\1/' |sort|uniq)
export networks
[ -z "$networks" ] && echo "Error: No networks to setup could be found in /etc/config/meshwizard, aborting now." && exit 1

# Read default values (first from /etc/config/freifunk, then from /etc/config/profile_$community
# then /etc/config/meshwizard
# last will overwrite first

$dir/helpers/read_defaults.sh $community > /tmp/meshwizard.tmp
while read line; do
	export "${line//\"/}"
done < /tmp/meshwizard.tmp

# Do config
$dir/helpers/initial_config.sh
$dir/helpers/setup_dnsmasq.sh
$dir/helpers/setup_system.sh
$dir/helpers/setup_olsrd.sh
$dir/helpers/setup_firewall.sh
$dir/helpers/setup_ssh.sh
$dir/helpers/setup_uhttpd.sh
$dir/helpers/setup_widgets.sh

if [ "$wan_proto" == "static" ] && [ -n "$wan_ip4addr" ] && [ -n "$wan_netmask" ]; then
	$dir/helpers/setup_wan_static.sh
fi

if [ "$wan_proto" == "dhcp" ]; then
	$dir/helpers/setup_wan_dhcp.sh
fi

if [ "$lan_proto" == "static" ] && [ -n "$lan_ip4addr" ] && [ -n "$lan_netmask" ]; then
	$dir/helpers/setup_lan_static.sh
fi

if [ "$ipv6_enabled" == 1 ] && [ "$has_ipv6" = 1 ]; then
	$dir/helpers/setup_lan_ipv6.sh
	# Setup auto-ipv6
	if [ -n "$(echo "$ipv6_config" |grep auto-ipv6)" ]; then
		$dir/helpers/setup_auto-ipv6.sh
	fi
fi

# Setup policyrouting if internet sharing is disabled and wan is not used for olsrd
# Always disable it first to make sure its disabled when the user decied to share his internet
uci set freifunk-policyrouting.pr.enable=0
if [ ! "$general_sharenet" == 1 ] && [ ! "$(uci -q get meshwizard.netconfig.wan_proto)" == "olsr" ]; then
	$dir/helpers/setup_policyrouting.sh
fi

# Configure found networks
for net in $networks; do
	# radioX devices need to be renamed
	netrenamed="${net/radio/wireless}"
	export netrenamed
	$dir/helpers/setup_network.sh $net
	if [ ! "$net" == "wan" ] && [ ! "$net" == "lan" ]; then
		$dir/helpers/setup_wifi.sh $net
	fi
	$dir/helpers/setup_olsrd_interface.sh $net

	net_dhcp=$(uci -q get meshwizard.netconfig.${net}_dhcp)
	if [ "$net_dhcp" == 1 ]; then
		$dir/helpers/setup_dhcp.sh $net
	fi

	$dir/helpers/setup_splash.sh $net
	$dir/helpers/setup_firewall_interface.sh $net

	if [ -n "$(echo "$ipv6_config" |grep auto-ipv6)" ]; then
		$dir/helpers/setup_auto-ipv6-interface.sh $net
	fi
done

##### Reboot the router (because simply restarting services gave errors)

echo "+ The wizard has finished and the router will reboot now."

reboot
