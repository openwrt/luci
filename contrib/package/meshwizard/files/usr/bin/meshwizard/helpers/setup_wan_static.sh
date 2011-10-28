#!/bin/sh
# Setup static interface settings for wan if wan is not an olsr interface

[ ! "$(uci -q get network.wan)" == "interface" ] && exit

. /etc/functions.sh
. $dir/functions.sh

uci batch << EOF
set network.wan.proto='$wan_proto'
set network.wan.ipaddr='$wan_ip4addr'
set network.wan.netmask='$wan_netmask'
set network.wan.gateway='$wan_gateway'
set network.wan.dns='$wan_dns'
EOF

uci_commitverbose "Setup static ip settings for wan" network

uci delete meshwizard.wan && uci commit meshwizard

# Firewall rules to allow incoming ssh and web

if [ "$wan_allowssh" == 1 ]; then
	uci batch <<- EOF
		set firewall.wanssh=rule
		set firewall.wanssh.src=wan
		set firewall.wanssh.target=ACCEPT
		set firewall.wanssh.proto=tcp
		set firewall.wanssh.dest_port=22
	EOF
	uci_commitverbose "Allow incoming connections to port 22 (ssh) on wan" firewall
fi

if [ "$wan_allowweb" == 1 ]; then
	uci batch <<- EOF
		set firewall.wanweb=rule
		set firewall.wanweb.src=wan
		set firewall.wanweb.target=ACCEPT
		set firewall.wanweb.proto=tcp
		set firewall.wanweb.dest_port=80
		set firewall.wanwebhttps=rule
		set firewall.wanwebhttps.src=wan
		set firewall.wanwebhttps.target=ACCEPT
		set firewall.wanwebhttps.proto=tcp
		set firewall.wanwebhttps.dest_port=443
	EOF
	uci_commitverbose "Allow incoming connections to port 80 and 443 (http and https) on wan" firewall
fi
