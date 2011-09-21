#!/bin/sh
# Sets values in /etc/config/freifunk

. $dir/functions.sh

# Set community homepage
hp=$(uci -q get profile_$community.profile.homepage)

if [ -n "$hp" ]; then
	uci set freifunk.community.homepage="$hp"
fi

uci_commitverbose "/etc/init.d/freifunk config" freifunk

