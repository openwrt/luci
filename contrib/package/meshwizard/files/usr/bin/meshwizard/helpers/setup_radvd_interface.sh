#!/bin/sh
# Sets up olsrd interfaces
# arg $1 = net

net=$1

. /lib/functions.sh
. $dir/functions.sh

uci batch << EOF
	set radvd.${net}_iface=interface
	set radvd.${net}_iface.interface="${net}"
	set radvd.${net}_iface.AdvSendAdvert=1
	set radvd.${net}_iface.ignore=0
	set radvd.${net}_prefix=prefix
	set radvd.${net}_prefix.interface="$net"
	set radvd.${net}_prefix.ignore=0
EOF

if [ "$profile_ipv6_config" = "auto-ipv6-dhcpv6" ]; then
	uci batch <<- EOF
		set radvd.${net}_iface.AdvManagedFlag=1
		set radvd.${net}_prefix.AdvOnLink=0
	EOF
fi

uci_commitverbose "Setup radvd for interface $net" radvd
