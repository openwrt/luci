#!/bin/sh
# This script will take settings from /etc/config/meshwizard, /etc/config/freifunk and /etc/config/profile_<selected in freifunk>
# and setup the router to participate in wireless mesh networks

. /etc/functions.sh

# config
export dir="/usr/bin/meshwizard"
. $dir/functions.sh
debug=1

# Rename wifi interfaces
	echo "++++ Renaming wifi-devices in /etc/config/meshwizard"
	$dir/helpers/rename-wifi.sh

# Firstboot/initial config
	echo "++++ Initial config"
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

echo "+++ wizard 0.0.2 +++
Community=$community
Network(s)=$networks"

# Read default values (first from /etc/config/freifunk, then from /etc/config/profile_$community,
# last will overwrite first


$dir/helpers/read_defaults.sh $community > /tmp/meshwizard.tmp
while read line; do
	export "${line//\"/}"
done < /tmp/meshwizard.tmp

# dnsmasq
	echo "++++ dnsmasq config"
	$dir/helpers/setup_dnsmasq.sh

# system
	$dir/helpers/setup_system.sh

# Configure found networks
for net in $networks; do

	netrenamed="${net/radio/wireless}"
	export netrenamed

	echo "++++ Configure interface $net"

	config="network"
	echo "$(msg_start $config)"
	$dir/helpers/setup_network.sh $net

	config="wireless"
	echo "$(msg_start $config)"
	$dir/helpers/setup_wifi.sh $net

	config="OLSRd"
	echo "$(msg_start $config)"
	$dir/helpers/setup_olsrd.sh $net

	net_dhcp=$(uci -q get meshwizard.netconfig.${net}_dhcp)
	if [ "$net_dhcp" == 1 ]; then
		config="DHCP"
		echo "$(msg_start $config)"
		$dir/helpers/setup_dhcp.sh $net
	fi

	config="luci_splash"
	echo "$(msg_start $config)"
	$dir/helpers/setup_splash.sh $net

	config="firewall"
	echo "$(msg_start $config)"
	$dir/helpers/setup_firewall.sh $net

	echo "  Configuration of $net finished."
done

##### Reboot the router (because simply restarting services gave errors)

reboot
