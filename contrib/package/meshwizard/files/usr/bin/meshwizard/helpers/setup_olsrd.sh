#!/bin/sh
# Sets up olsrd
# arg $1 = net

net=$1

. /etc/functions.sh
. $dir/functions.sh

# Rename interface defaults
handle_interfacedefaults() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename olsrd $1 InterfaceDefaults
	fi
}
config_load olsrd
config_foreach handle_interfacedefaults InterfaceDefaults

# Setup new InterfaceDefaults
uci set olsrd.InterfaceDefaults=InterfaceDefaults
set_defaults "olsr_interfacedefaults_" olsrd.InterfaceDefaults
uci_commitverbose "Setup olsr interface defaults" olsrd

# Rename interface for $netrenamed
handle_interface() {
	config_get interface "$1" Interface
	if [ "$interface" == "$netrenamed" ]; then
		if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
			section_rename olsrd $1 $netrenamed
		fi
	fi
}

config_foreach handle_interface Interface

# Setup new interface for $netrenamed

uci set olsrd.$netrenamed=Interface
set_defaults "olsr_interface_" olsrd.$net
uci set olsrd.$netrenamed.interface="$netrenamed"

uci_commitverbose "Setup olsr interface for $netrenamed." olsrd

# If dhcp-network is inside the mesh_network then add HNA for it
dhcprange=$(uci get meshwizard.netconfig.$net\_dhcprange)
meshnet="$(uci get profile_$community.profile.mesh_network)"

uci -q delete olsrd.${netrenamed}clients

# check if the dhcprange is inside meshnet
dhcpinmesh="$($dir/helpers/check-range-in-range.sh $dhcprange $meshnet)"

# If it is setup hna for it
if [ "$dhcpinmesh" == 1 ]; then
	uci set olsrd.${netrenamed}clients="Hna4"
	eval $(sh $dir/helpers/ipcalc-cidr.sh $dhcprange)
	uci set olsrd.${netrenamed}clients.netaddr="$NETWORK"
	uci set olsrd.${netrenamed}clients.netmask="$NETMASK"
	uci_commitverbose "Setup HNA for network $dhcprange" olsrd
fi


# Rename nameservice, dyngw and httpinfo plugins

handle_plugin() {
        config_get library "$1" library
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		new="$(echo $library | cut -d '.' -f 1)"
		section_rename olsrd $1 $new
	fi		
}
config_foreach handle_plugin LoadPlugin

# Setup nameservice plugin
if [ -n "$profile_suffix" ]; then
	suffix=".$profile_suffix"
else
	suffix=".olsr"
fi
uci batch << EOF
set olsrd.olsrd_nameservice=LoadPlugin
set olsrd.olsrd_nameservice.library="olsrd_nameservice.so.0.3"
set olsrd.olsrd_nameservice.latlon_file="/var/run/latlon.js"
set olsrd.olsrd_nameservice.hosts_file="/var/etc/hosts.olsr"
set olsrd.olsrd_nameservice.sighup_pid_file="/var/run/dnsmasq.pid"
set olsrd.olsrd_nameservice.suffix="$suffix"
EOF

uci_commitverbose "Setup olsr nameservice plugin" olsrd

# Setup dyngw_plain

# If Sharing of Internet is enabled then enable dyngw_plain plugin
sharenet=$(uci -q get meshwizard.general.sharenet)

if [ "$sharenet" == 1 ]; then
	uci set olsrd.dyngw_plain=LoadPlugin
	uci set olsrd.dyngw_plain.ignore=0
	uci set olsrd.dyngw_plain.library="olsrd_dyn_gw_plain.so.0.4"
	uci_commitverbose "Setup olsrd_dyngw_plain plugin" olsrd
fi

