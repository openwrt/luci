#!/bin/sh
# Checks whether a netrange is inside another netrange, returns 1 if true
# Takes two arguments: $1: net from which we want to know if it is inside $2
# nets need to be given in CIDR notation

dir=$(dirname $0)

awk -f $dir/common.awk -f - $* <<EOF
BEGIN {

	slpos=index(ARGV[1],"/")
	ipaddr=ip2int(substr(ARGV[1],0,slpos-1))
	netmask=compl(2**(32-int(substr(ARGV[1],slpos+1)))-1)
	network=and(ipaddr,netmask)
	broadcast=or(network,compl(netmask))

	slpos2=index(ARGV[2],"/")
	ipaddr2=ip2int(substr(ARGV[2],0,slpos2-1))
	netmask2=compl(2**(32-int(substr(ARGV[2],slpos2+1)))-1)
	network2=and(ipaddr2,netmask2)
	broadcast2=or(network2,compl(netmask2))

	if (network >= network2) {
		if (network <= broadcast2) {
			if (broadcast <= broadcast2) {
				print "1"
			}
		}
	}
}
EOF
