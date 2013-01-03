#!/bin/sh
# create essid from channel, takes two args:
# $1 = channel (integer)
# $2 = community (optional)
channel=$1
community=$2

. /lib/functions.sh


# Try to get BSSID from profile first
config_load profile_$community
config_get bssid bssidscheme $channel
if [ -z "$bssid" ]; then
	config_get bssid bssidscheme "all"
fi

if [ -z "$bssid" ]; then
	case $channel in
	[1-9])
		bssid="$(printf "%X\n" $channel)2:CA:FF:EE:BA:BE"
		;;
	1[0-4])
		bssid="$(printf "%X\n" $channel)2:CA:FF:EE:BA:BE"
		;;
	[3-9][0-9])
		bssid="02:$channel:CA:FF:EE:EE"
		;;
	1[0-9][0-9])
		bssid="${channel/1/12:}:CA:FF:EE:EE"
		;;
	*)	bssid="02:CA:FF:EE:BA:BE"
		;;
	esac
fi
echo $bssid
