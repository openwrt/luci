# setup entry in /etc/config/network for a interface
# Argument $1: network interface

net="$1"
. /lib/functions.sh
. $dir/functions.sh

# Setup a (new) interface section for $net

ipaddr=$(uci -q get meshwizard.netconfig.$net\_ip4addr)
ip6addr=$(uci -q get meshwizard.netconfig.$net\_ip6addr)
[ -z "$ipaddr" ] && msg_missing_value meshwizard $net\_ip4addr

netmask=$(uci -q get meshwizard.netconfig.$net\_netmask)
[ -z "$netmask" ] && netmask="$interface_netmask"
[ -z "$netmask" ] && netmask="255.255.0.0"

uci set network.$netrenamed="interface"
set_defaults "interface_" network.$netrenamed

uci batch << EOF
	set network.$netrenamed.proto="static"
	set network.$netrenamed.ipaddr="$ipaddr"
	set network.$netrenamed.netmask="$netmask"
EOF

if [ "$netrenamed" = "lan" ]; then
	# remove the bridge if the interface is used for olsr
	# since this script is only run in this case, no need
	# to check for lan_proto = "olsr" currently.
	uci -q delete network.lan.type
fi

# Setup IPv6 for the interface
local ip6addr
if [ "$ipv6_enabled" = 1 ]; then
	if [ "$ipv6_config" = "auto-ipv6-dhcpv6" ]; then
		ip6addr="$($dir/helpers/gen_auto-ipv6-dhcpv6-ip.sh $netrenamed)"
		uci set network.$netrenamed.ip6addr="${ip6addr}/112"
	fi
	if [ "$ipv6_config" = "static" ] && [ -n "$ip6addr" ]; then
		uci set network.$netrenamed.ip6addr="$ip6addr"
	fi
fi

uci_commitverbose "Setup interface $netrenamed" network

# setup dhcp alias/interface

net_dhcp=$(uci -q get meshwizard.netconfig.${net}_dhcp)
if [ "$net_dhcp" == 1 ]; then

	# Load meshwizard_settings
	dhcprange="$(uci -q get meshwizard.netconfig.${net}_dhcprange)"
	interface_ip="$(uci -q get meshwizard.netconfig.${net}_ip4addr)"
	vap=$(uci -q get meshwizard.netconfig.${net}_vap)

	# Rename config
	handle_dhcpalias() {
			config_get interface "$1" interface
			if [ "$interface" == "$netrenamed" ]; then
				if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
					section_rename network $1 ${netrenamed}dhcp
				fi
			fi
	}
	config_load network
	config_foreach handle_dhcpalias interface

	# Get IP/netmask and start-ip for $net dhcp
	# If no dhcprange is given in /etc/config/meshwizard we autogenerate one

	if [ -z "$dhcprange" ]; then
		dhcprange="$($dir/helpers/gen_dhcp_ip.sh $interface_ip)/24"
		uci set meshwizard.netconfig.${net}_dhcprange="$dhcprange"
	fi

	# If we use VAP and also offer dhcp on the adhoc interface then cut the dhcp
	# range in two halves. one for the adhoc, one for the managed VAP interface
	ahdhcp_when_vap="$(uci get profile_$community.profile.adhoc_dhcp_when_vap)"

	if [ "$supports_vap" = 1 -a "$vap" = 1 -a "$ahdhcp_when_vap" = 1 ]; then
		# VAPs are enabled for this interface, supported and we want to
		# also use DHCP on the adhoc interface
		local network
		local mask
		network=${dhcprange%%/*}
		mask=${dhcprange##*/}
		# Divide network size by adding 1 to the netmask
		mask=$(($mask + 1))
		# Get first ip and netmask for the adhoc dhcp network
		eval $(sh $dir/helpers/ipcalc-cidr.sh ${network}/${mask} 1 0)
		STARTADHOC=$START
		NETMASKADHOC=$NETMASK
		# Get first ip and netmask for the managed dhcp network
		eval $(sh $dir/helpers/ipcalc-cidr.sh ${NEXTNET}/${mask} 1 0)
		STARTVAP=$START
		NETMASKVAP=$NETMASK
		# Add dhcp interface
		uci batch <<- EOF
			set network.${netrenamed}dhcp=interface
			set network.${netrenamed}dhcp.proto=static
			set network.${netrenamed}dhcp.ipaddr="$STARTVAP"
			set network.${netrenamed}dhcp.netmask="$NETMASKVAP"
		EOF
		uci_commitverbose  "Setup interface for ${netrenamed}dhcp" network
	else
		eval $(sh $dir/helpers/ipcalc-cidr.sh $dhcprange 1 0)
		STARTADHOC=$START
		NETMASKADHOC=$NETMASK
	fi
	if [ "$supports_vap" = 1 -a "$vap" = 1 -a "$ahdhcp_when_vap" != 1 ]; then
		# vaps are enabled and supported and we do not use DHCP on adhoc
		# Add dhcp interface
		uci batch <<- EOF
			set network.${netrenamed}dhcp=interface
			set network.${netrenamed}dhcp.proto=static
			set network.${netrenamed}dhcp.ipaddr="$STARTADHOC"
			set network.${netrenamed}dhcp.netmask="$NETMASKADHOC"
		EOF
		uci_commitverbose  "Setup interface for ${netrenamed}dhcp" network
	fi


	# Setup alias for $net adhoc interface 
	if  [ "$supports_vap" = 0 ] || \
		[ "$vap" = 0 ] || \
		[ "$supports_vap" = 1 -a "$vap" = 1 -a "$ahdhcp_when_vap" = 1 ] || \
		[ "$lan_is_olsr" = "1" ]; then
		# setup an alias interface for the main interface to use as a network for clients
		# when one of the following conditions is met
		# * vaps are not supported
		# * or not enabled
		# * or they are supported and enabled but we also want to use DHCP on the adhoc interface
		# * or this is the lan interface and it is used for olsrd (and dhcp is enabled)
		uci batch <<- EOF
			set network.${netrenamed}ahdhcp=interface
			set network.${netrenamed}ahdhcp.ifname="@${netrenamed}"
			set network.${netrenamed}ahdhcp.proto=static
			set network.${netrenamed}ahdhcp.ipaddr="$STARTADHOC"
			set network.${netrenamed}ahdhcp.netmask="$NETMASKADHOC"
		EOF
		uci_commitverbose  "Setup interface for ${netrenamed}ahdhcp" network
	fi
fi
