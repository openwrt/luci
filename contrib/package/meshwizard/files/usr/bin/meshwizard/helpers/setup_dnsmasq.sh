#!/bin/sh

. /lib/functions.sh
. $dir/functions.sh

# Set dnsmasq config
handle_dhcp() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename dhcp $1 dnsmasq
	fi
}

config_load dhcp
config_foreach handle_dhcp dnsmasq

uci batch << EOF
	set dhcp.dnsmasq.local="/$profile_suffix/"
	set dhcp.dnsmasq.domain="$profile_suffix"
EOF

config_get addnhosts dnsmasq addnhosts
if [ -z "${addnhosts/\var\/etc\/hosts.olsr/}" ]; then
	uci add_list dhcp.dnsmasq.addnhosts="/var/etc/hosts.olsr"
	if [ "$ipv6_enabled" = 1 ]; then
		uci add_list dhcp.dnsmasq.addnhosts="/var/etc/hosts.olsr.ipv6"
	fi
fi

uci_commitverbose "Setup dnsmasq" dhcp
