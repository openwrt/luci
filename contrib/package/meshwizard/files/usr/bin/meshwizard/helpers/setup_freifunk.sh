#!/bin/sh
# Sets values in /etc/config/freifunk

. /etc/functions.sh
. $dir/functions.sh

# Set community homepage
hp=$(uci -q get profile_$community.profile.homepage)

if [ -n "$hp" ]; then
	uci set freifunk.community.homepage="$hp"
fi


