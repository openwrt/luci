#!/bin/sh
# This is only run once (usually after flashing an image from the imagebuilder)
# It sets up the initial config for this node.


. /etc/functions.sh
. $dir/functions.sh

### System config

config_load system

# Rename system config
handle_system() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename system $1 system
	fi
}
config_foreach handle_system system

if [ -n "$(uci -q get meshwizard.community)" ]; then
	echo "    + Setup community"
	set_defaults "community_" freifunk.community
	uci -q delete meshwizard.community
	uci_commitverbose freifunk
fi

if [ -n "$(uci -q get meshwizard.contact)" ]; then
	echo "    + Setup contact"
	set_defaults "contact_" freifunk.contact
	uci -q delete meshwizard.contact && uci_commitverbose freifunk
fi

if [ "$has_luci" == TRUE ]; then
	echo "    + Setup luci"
	set_defaults "luci_main_" luci.main
	uci -q delete meshwizard.luci_main && uci_commitverbose luci
fi

uci commit


