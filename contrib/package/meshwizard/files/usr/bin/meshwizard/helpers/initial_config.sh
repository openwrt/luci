#!/bin/sh
# This is only run once (usually after flashing an image from the imagebuilder)
# It sets up the initial config for this node.

. /lib/functions.sh
. $dir/functions.sh

config_load system

# Rename system config
handle_system() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename system $1 system
	fi
}
config_foreach handle_system system

if [ -n "$(uci -q get meshwizard.community)" ]; then
	set_defaults "community_" freifunk.community
	uci -q delete meshwizard.community
fi

[ -n "$profile_homepage" ] && uci set freifunk.community.homepage="$profile_homepage"

[ -n "$profile_mapserver" ] && {
	uci -q delete freifunk.community.mapserver
	for m in $profile_mapserver; do
		uci add_list freifunk.community.mapserver="$m"
	done
}

uci_commitverbose "Setup community" freifunk

if [ -n "$(uci -q get meshwizard.contact)" ]; then
	set_defaults "contact_" freifunk.contact
	uci -q delete meshwizard.contact && uci_commitverbose "Setup contact" freifunk
fi

if [ "$has_luci" == TRUE ]; then
	set_defaults "luci_main_" luci.main
	uci -q delete meshwizard.luci_main && uci_commitverbose "Setup luci" luci
fi
