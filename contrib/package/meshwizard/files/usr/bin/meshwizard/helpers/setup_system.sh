#!/bin/sh
# Sets values from /etc/config/freifunk and/or the community profile in /etc/config/system

. $dir/functions.sh

if [ -n "$(env | grep '^system_')" ]; then
	env | grep "^system_" | sed "s/system_/uci set system.system./g" | while read line; do
		eval $line
	done
fi

uci -q delete meshwizard.system && uci commit meshwizard
uci_commitverbose "System config" system
