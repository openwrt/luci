#!/bin/sh
# Sets up the dhcp part of dnsmasq

. /lib/functions.sh
. $dir/functions.sh

net="$1"
vap="$(uci -q get meshwizard.netconfig.${net}_vap)"

handle_dnsmasq() {
	config_get interface "$1" interface
	if [ "$interface" == "${netrenamed}dhcp" ]; then
		if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
			section_rename dhcp $1 ${netrenamed}dhcp
		fi
	fi
}
config_load dhcp
config_foreach handle_dnsmasq dhcp

[ "$net" == "lan" ] && uci -q delete dhcp.lan

if [ "$supports_vap" = 1 -a "$vap" = 1 ]; then
	uci batch <<- EOF
		set dhcp.${netrenamed}dhcp="dhcp"
		set dhcp.${netrenamed}dhcp.ignore="0"
		set dhcp.${netrenamed}dhcp.interface="${netrenamed}dhcp"
	EOF
	set_defaults "dhcp_" dhcp.${netrenamed}dhcp
fi

ahdhcp_when_vap="$(uci get profile_$community.profile.adhoc_dhcp_when_vap)"
if [ "$supports_vap" = 0 ] || \
	[ "$supports_vap" = 1 -a "$vap" = 1 -a "$ahdhcp_when_vap" = 1 ] || \
	[ "$lan_is_olsr" = "1" -a "$lan_dhcp" = 1 ]; then
	uci batch <<- EOF
		set dhcp.${netrenamed}ahdhcp="dhcp"
		set dhcp.${netrenamed}ahdhcp.ignore="0"
		set dhcp.${netrenamed}ahdhcp.interface="${netrenamed}ahdhcp"
	EOF
fi
set_defaults "dhcp_" dhcp.${netrenamed}ahdhcp

uci_commitverbose "Setup DHCP for $netrenamed" dhcp


