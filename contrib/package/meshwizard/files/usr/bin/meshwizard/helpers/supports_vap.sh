#!/bin/sh
# checks if a given device can be used for a VAP interface (1 adhoc + 1 ap)
dev="$1"
type="$2"


if [ -z "$dev" -o -z "$type" ]; then
	exit 1
fi

if [ "$type" = "mac80211" ]; then
	# not hostapd[-mini], no VAP
	if [ ! -x /usr/sbin/hostapd ]; then
		echo "WARNING: hostapd[-mini] is required to be able to use VAP with mac80211."
		exit 1
	fi
        # get driver in use
        netindex="$(echo $dev |sed 's/[a-zA-z]*//')"
	if [ -d /sys/class/net/wlan${netindex}/device/driver/module ]; then
	        driver="$(basename $(ls -l /sys/class/net/wlan${netindex}/device/driver/module | sed -ne 's/.* -> //p'))"
	        if [ "$driver" = "ath9k" -o  "$driver" = "ath5k" ]; then
	                exit 0
		else
			exit 1
	        fi
	else
		exit 1
	fi
else
	exit 1
fi

