#!/bin/sh
# Sets values in /etc/config/freifunk

. $dir/functions.sh

# Set community homepage

if [ -n "$profile_homepage" ]; then
	uci set freifunk.community.homepage="$profile_homepage"
fi

uci_commitverbose freifunk

