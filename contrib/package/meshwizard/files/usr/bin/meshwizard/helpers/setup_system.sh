#!/bin/sh
# Sets values from /etc/config/freifunk and/or the community profile in /etc/config/system

if [ -n "$(env | grep '^system_')" ]; then
	echo "++++ Setup system"
	env | grep "^system_" | sed "s/system_/uci set system.system./g" | while read line; do
		eval $line
		echo "    $line"
	done
fi

uci commit system
