#!/bin/sh
# This script will take settings from /etc/config/meshwizard, /etc/config/freifunk and /etc/config/profile_<selected in freifunk>
# and setup the router to participate in wireless mesh networks

. /etc/functions.sh

echo "
Meshwizard 0.0.3
"

# config
export dir="/usr/bin/meshwizard"
. $dir/functions.sh
debug=1

# Check which packages we have installed
export has_luci=FALSE
opkg list_installed |grep luci-mod-admin > /dev/null && export has_luci=TRUE
export has_luci_splash=FALSE
opkg list_installed |grep luci-app-splash > /dev/null && export has_luci_splash=TRUE

# Rename wifi interfaces
	echo "+ Renaming wifi-devices in /etc/config/meshwizard"
	$dir/helpers/rename-wifi.sh

# Firstboot/initial config
	echo "+ Initial config"
	$dir/helpers/initial_config.sh

# Get community
export community=$(uci get freifunk.community.name)
[ -z "$community" ] && echo "Error: Community is not set in /etc/config/freifunk, aborting now." && exit 1

# Check whether we want to cleanup uci config before setting new options or not
cleanup=$(uci -q get meshwizard.general.cleanup)

[ "$cleanup" == 1 ] && export cleanup=1

# Get a list of networks we need to setup
networks=$(uci show meshwizard.netconfig | grep -v "netconfig=" | sed -e 's/meshwizard.netconfig\.\(.*\)\_.*/\1/' |sort|uniq)
export networks

[ -z "$networks" ] && echo "Error: No networks to setup could be found in /etc/config/meshwizard, aborting now." && exit 1

echo "    Community=$community
    Network(s)=$networks"

# Read default values (first from /etc/config/freifunk, then from /etc/config/profile_$community,
# last will overwrite first


$dir/helpers/read_defaults.sh $community > /tmp/meshwizard.tmp
while read line; do
	export "${line//\"/}"
done < /tmp/meshwizard.tmp

$dir/helpers/setup_dnsmasq.sh
$dir/helpers/setup_system.sh
$dir/helpers/setup_freifunk.sh

# Configure found networks
for net in $networks; do

	netrenamed="${net/radio/wireless}"
	export netrenamed

	$dir/helpers/setup_network.sh $net
	$dir/helpers/setup_wifi.sh $net
	$dir/helpers/setup_olsrd.sh $net

	net_dhcp=$(uci -q get meshwizard.netconfig.${net}_dhcp)
	if [ "$net_dhcp" == 1 ]; then
		$dir/helpers/setup_dhcp.sh $net
	fi

	$dir/helpers/setup_splash.sh $net
	$dir/helpers/setup_firewall.sh $net
done

##### Reboot the router (because simply restarting services gave errors)

reboot
