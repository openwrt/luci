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

if [ -n "$(uci -q get meshwizard.system)" ]; then
	echo "    + Setup system"
	uci show meshwizard.system | sed 's/^meshwizard/uci set system/g' | while read line; do
		eval $line
		echo "    $line"
	done
	uci -q delete meshwizard.system
fi

if [ -n "$(uci -q get meshwizard.community)" ]; then
	echo "    + Setup community"
	uci show meshwizard.community | sed 's/^meshwizard/freifunk/g' | while read line; do
		eval uci set $line
		echo "    $line"
	done
	uci -q delete meshwizard.community
fi

if [ -n "$(uci -q get meshwizard.contact)" ]; then
	echo "    + Setup contact"
	uci show meshwizard.contact | sed 's/^meshwizard/freifunk/g' | while read line; do
		eval uci set $line
		echo "    $line"
	done
	uci -q delete meshwizard.contact
fi

if [ -n "$(uci -q get meshwizard.luci_main)" ]; then
	echo "    + Setup luci"
	uci show meshwizard.luci_main |sed -e 's/^meshwizard/luci/g' -e 's/luci_main/main/' | while read line; do 
		eval uci set $line
		echo "    $line"
	done
	uci -q delete meshwizard.luci_main
fi

uci commit


