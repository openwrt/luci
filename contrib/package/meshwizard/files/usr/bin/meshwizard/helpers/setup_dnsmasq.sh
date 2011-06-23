#!/bin/sh

. /etc/functions.sh
. $dir/functions.sh

# Set dnsmasq config
handle_dhcp() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename dhcp $1 dnsmasq
	fi
}

config_load dhcp
config_foreach handle_dhcp dnsmasq

echo "    + Setup dnsmasq"

uci set dhcp.dnsmasq.local="/$profile_suffix/"
uci set dhcp.dnsmasq.domain="$profile_suffix"

echo "    local: /$profile_suffix/
    domain: $profile_suffix"

config_get addnhosts dnsmasq addnhosts
if [ -z "${addnhosts/\var\/etc\/hosts.olsr/}" ]; then
	uci add_list dhcp.dnsmasq.addnhosts="/var/etc/hosts.olsr"
	echo "    addnhosts: /var/etc/hosts.olsr"
fi

uci commit

