#!/bin/sh
# This will add $net to the zone firewall (and remove it from other zones where it is referenced)
# It will also setup rules defined in /etc/config/freifunk and /etc/config/profile_<community>
# Arg $1 = $net

net=$1
. /etc/functions.sh
. $dir/functions.sh
config_load firewall

# Get some variables
type="$(uci -q get wireless.$net.type)"
vap="$(uci -q get meshwizard.netconfig.$net\_vap)"

# Add local_restrict to wan firewall zone
handle_zonewan() {
	config_get name "$1" name
	if [ "$name" == "wan" ]; then
		uci set firewall.$1.local_restrict=1
	fi
}
config_foreach handle_zonewan zone && uci_commitverbose "Enable local_restrict for zone wan" firewall

# Delete old firewall zone for freifunk
handle_fwzone() {
	config_get name "$1" name
	config_get network "$1" network

	if [ "$2" == "zoneconf" ]; then
		# clean zone
		if [ "$name" == "freifunk" ]; then
			if [ "$cleanup" == 1 ]; then
				section_cleanup firewall.$1
			else
				# rename section if unnamed
				if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
					section_rename firewall $1 zone_freifunk
				fi
			fi
		else

			if [ "$name" == "$netrenamed" ]; then
				section_cleanup firewall.$1
			fi
			if [ -n "$netrenamed" -a -n "$(echo $network | grep $netrenamed)" ] && [ ! "$name" == "freifunk" ]; then
				echo "    Removed $netrenamed from firewall zone $name."
				network_new=$(echo $network | sed -e 's/'$netrenamed'//' -e 's/^ //' -e 's/  / /' -e 's/ $//')
				uci set firewall.$1.network="$network_new"
			fi
		fi
	else
		# clean fw_rule, fw_forwarding, include and advanced
		for option in src tcp_ecn path; do
			config_get $option $1 $option
		done
		if [ "$src" == "freifunk" -o "$path" == "/etc/firewall.freifunk" -o -n "$tcpecn" ]; then
			section_cleanup firewall.$1
		fi
	fi
}

config_foreach handle_fwzone zone zoneconf

if [ "$cleanup" == 1 ]; then
	for target in include advanced rule forwarding; do
		config_foreach handle_fwzone $target
	done
fi

# setup freifunk firewall zone

# add $netrenamed and if needed ${netrenamed}dhcp to the networks for this zone
config_get network zone_freifunk network

# remove ${netrenamed}dhcp from networks list
[ -n "$network" -a -n "$net" ] && network="${network/${netrenamed}dhcp/}"
network=$(echo $network) # Removes leading and trailing whitespaces

[ -n "$netrenamed" ] && [ -z "$(echo $network | grep $netrenamed)" ] && network="$network $netrenamed"

if [ "$type" == "atheros" -a "$vap" == 1 ]; then
        [ -n "$netrenamed" ] && [ "$network" == "${network/${netrenamed}dhcp/}" ] && network="$network ${netrenamed}dhcp"
fi

uci batch << EOF
set firewall.zone_freifunk="zone"
set firewall.zone_freifunk.name="freifunk"
set firewall.zone_freifunk.network="$network"
set firewall.zone_freifunk.input="$zone_freifunk_input"
set firewall.zone_freifunk.forward="$zone_freifunk_forward"
set firewall.zone_freifunk.output="$zone_freifunk_output"
EOF

uci_commitverbose "Setup freifunk firewall zone" firewall

# Usually we need to setup masquerading for lan, except lan is an olsr interface or has an olsr hna

handle_interface() {
        config_get interface "$1" interface
        if [ "$interface" == "lan" ]; then
                no_masq_lan=1
        fi
}
config_load olsrd
config_foreach handle_interface Interface

handle_hna() {
        config_get netaddr "$1" netaddr
        if [ "$NETWORK" == "$netaddr" ]; then
                no_masq_lan=1
        fi
}
config_foreach handle_hna Hna4

currms=$(uci -q get firewall.zone_freifunk.masq_src)
if [ ! "$no_masq_lan" == "1" ]; then
	uci set firewall.zone_freifunk.masq="1"
	[ -z "$(echo $currms |grep lan)" ] && uci add_list firewall.zone_freifunk.masq_src="lan"
fi

# If wifi-interfaces are outside of the mesh network they should be natted
for i in $networks; do
        # Get dhcprange and meshnet
        dhcprange=$(uci get meshwizard.netconfig.$i\_dhcprange)
        meshnet="$(uci get profile_$community.profile.mesh_network)"
        # check if the dhcprange is inside meshnet
        dhcpinmesh="$($dir/helpers/check-range-in-range.sh $dhcprange $meshnet)"
        if [ ! "$dhcpinmesh" == 1 ]; then
                [ -z "$(echo $currms |grep ${netrenamed}dhcp)" ] && uci add_list firewall.zone_freifunk.masq_src="${netrenamed}dhcp"
        fi
done

uci_commitverbose "Setup masquerading rules" firewall

# Rules, Forwardings, advanced config and includes
# Clear firewall configuration

for config in freifunk profile_$community; do

	config_load $config

	for section in advanced include fw_rule fw_forwarding; do
		handle_firewall() {
		        local options=$(uci show $config."$1")
			options=$(echo "$options" | sed -e "s/fw_//g" -e "s/^$config/firewall/g")
			for o in $options; do
				uci set $o
			done
		}
		config_foreach handle_firewall $section
	done
done

uci_commitverbose "Setup rules, forwardings, advanced config and includes." firewall
