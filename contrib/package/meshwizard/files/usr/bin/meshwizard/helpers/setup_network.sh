# setup entry in /etc/config/network for a interface
# Argument $1: network interface

net="$1"
. /etc/functions.sh
. $dir/functions.sh

# Delete the network interface section for $net
if [ "$cleanup" == 1 ]; then
	section_cleanup network.$netrenamed
fi

# Setup a (new) interface section for $net

ipaddr=$(uci get meshwizard.netconfig.$net\_ip4addr)
[ -z "$ipaddr" ] && msg_missing_value meshwizard $net\_ip4addr

[ -z "$interface_netmask" ] && interface netmask="255.255.0.0"

uci batch << EOF
set network.$netrenamed="interface"
set network.$netrenamed.proto="static"
set network.$netrenamed.ipaddr="$ipaddr"
set network.$netrenamed.netmask="$interface_netmask"
set network.$netrenamed.dns="$interface_dns"
EOF

echo "    IP address: $ipaddr"
echo "    Netmask   : $interface_netmask"

# setup dhcp alias/interface

net_dhcp=$(uci -q get meshwizard.netconfig.${net}_dhcp)
if [ "$net_dhcp" == 1 ]; then

	# Load meshwizard_settings
	dhcprange="$(uci -q get meshwizard.netconfig.${net}_dhcprange)"
	interface_ip="$(uci -q get meshwizard.netconfig.${net}_ip4addr)"
	vap=$(uci -q get meshwizard.netconfig.${net}_vap)

	# Clean/rename config
	handle_dhcpalias() {
			config_get interface "$1" interface
			if [ "$interface" == "$netrenamed" ]; then
				if [ "$cleanup" == 1 ]; then
					section_cleanup network.$1
				else
					if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
						section_rename network $1 ${netrenamed}dhcp
					fi
				fi
			fi
	}
	config_load network
	config_foreach handle_dhcpalias alias

	# Get IP/netmask and start-ip for $net dhcp
	# If no dhcprange is given in /etc/config/meshwizard we autogenerate one

	if [ -z "$dhcprange" ]; then
		dhcprange="$($dir/helpers/gen_dhcp_ip.sh $interface_ip)/24"
		uci set meshwizard.netconfig.${net}_dhcprange="$dhcprange"
	fi
	eval $(sh $dir/helpers/ipcalc-cidr.sh $dhcprange 1 0)

	# setup wifi-dhcp interface or alias

	# Setup alias for $net

	if [ "$vap" == 1 ]; then
		echo "    + Setup interface ${netrenamed}dhcp."
		uci set network.${netrenamed}dhcp=interface
	else
		echo "    + Setup alias interface ${netrenamed}dhcp."
		uci set network.${netrenamed}dhcp=alias
		uci set network.${netrenamed}dhcp.interface="$netrenamed"
	fi

	uci batch << EOF
set network.${netrenamed}dhcp.proto=static
set network.${netrenamed}dhcp.ipaddr="$START"
set network.${netrenamed}dhcp.netmask="$NETMASK"
EOF

	echo "    interface: $net
    ipaddr: $START
    netmask: $NETMASK"

fi

uci commit
