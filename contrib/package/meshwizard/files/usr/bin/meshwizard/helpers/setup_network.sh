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
	eval $(sh $dir/helpers/ipcalc-cidr.sh $dhcprange 1 0)

	# setup wifi-dhcp interface or alias (using interface notation)

	# Setup alias for $net

	if [ "$vap" == 1 ]; then
		uci set network.${netrenamed}dhcp=interface
	else
		uci set network.${netrenamed}dhcp=interface
		uci set network.${netrenamed}dhcp.ifname="@${netrenamed}"
	fi

	uci batch <<- EOF
		set network.${netrenamed}dhcp.proto=static
		set network.${netrenamed}dhcp.ipaddr="$START"
		set network.${netrenamed}dhcp.netmask="$NETMASK"
	EOF
	uci_commitverbose  "Setup interface for ${netrenamed}dhcp" network
fi
