#!/bin/sh
# This will add $net to the zone firewall (and remove it from other zones where it is referenced)
# It will also setup rules defined in /etc/config/freifunk and /etc/config/profile_<community>
# Arg $1 = $net

net=$1
. /lib/functions.sh
. $dir/functions.sh
config_load firewall

# Get some variables
type="$(uci -q get wireless.$net.type)"
vap="$(uci -q get meshwizard.netconfig.$net\_vap)"
wan_is_olsr=$(uci -q get meshwizard.netconfig.wan_config)

# Delete old firewall zone for freifunk
handle_fwzone() {
	config_get name "$1" name
	config_get network "$1" network

	if [ "$2" == "zoneconf" ]; then
		if [ "$name" == "freifunk" ]; then
			# rename section if unnamed
			if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
				section_rename firewall $1 zone_freifunk
			fi
		else
			if [ ! "$name" == "freifunk" ] && [ -n "$netrenamed" -a -n "$(echo $network | grep $netrenamed)" ]; then
				echo "    Removed $netrenamed from firewall zone $name."
				network_new=$(echo $network | sed -e 's/'$netrenamed'//' -e 's/^ //' -e 's/  / /' -e 's/ $//')
				uci set firewall.$1.network="$network_new"
			fi
		fi
	fi
}

config_foreach handle_fwzone zone zoneconf

# Add $netrenamed and if needed ${netrenamed}dhcp to the "freifunk" zone
config_get network zone_freifunk network

# remove ${netrenamed}dhcp from networks list
[ -n "$network" -a -n "$net" ] && network="${network/${netrenamed}dhcp/}"
network=$(echo $network) # Removes leading and trailing whitespaces

[ -n "$netrenamed" ] && [ -z "$(echo $network | grep $netrenamed)" ] && network="$network $netrenamed"

# check if this hardware supports VAPs
supports_vap="0"
$dir/helpers/supports_vap.sh $net $type && supports_vap=1

if [ "$supports_vap" == "1" -a "$vap" == 1 ]; then
        [ -n "$netrenamed" ] && [ "$network" == "${network/${netrenamed}dhcp/}" ] && network="$network ${netrenamed}dhcp"
fi

uci set firewall.zone_freifunk.network="$network"

uci_commitverbose "Add '$netrenamed' to freifunk firewall zone" firewall

currms=$(uci -q get firewall.zone_freifunk.masq_src)

# If interfaces are outside of the mesh network they should be natted

# Get dhcprange and meshnet
if_ip="$(uci -q get network.${netrenamed}dhcp.ipaddr)"
if_mask="$(uci -q get network.${netrenamed}dhcp.netmask)"

[ -n "$if_ip" -a "$if_mask" ] && export $(ipcalc.sh $if_ip $if_mask)
[ -n "$NETWORK" -a "$PREFIX" ] && dhcprange="$NETWORK/$PREFIX"

if [ -n "$dhcprange" ]; then
	meshnet="$(uci get profile_$community.profile.mesh_network)"
	# check if the dhcprange is inside meshnet
	dhcpinmesh="$($dir/helpers/check-range-in-range.sh $dhcprange $meshnet)"
	if [ "$dhcpinmesh" == 1 ]; then
		# needed or splash will not work
		if [ "$has_luci_splash" == TRUE ]; then
			uci set firewall.zone_freifunk.contrack="1"
		fi
	else
		uci set firewall.zone_freifunk.masq=1
		[ -z "$(echo $currms |grep ${netrenamed}dhcp)" ] && uci add_list firewall.zone_freifunk.masq_src="${netrenamed}dhcp"
	fi
fi

for i in IP NETMASK BROADCAST NETWORK PREFIX; do
	unset $i
done

uci_commitverbose "Setup masquerading rules for '$netrenamed'" firewall
