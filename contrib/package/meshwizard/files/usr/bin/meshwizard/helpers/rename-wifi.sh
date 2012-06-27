#!/bin/sh
# This script renames IB_wifi_ interface names into real interface names used on this system.
# E.g. wireless.IB_wifi0 would become wireless.wifi0 on madwifi and wireless.radio0 on mac80211

. $dir/functions.sh

posIB=-1

IBwifis="$(uci show meshwizard.netconfig | grep 'IB_' | sed 's/meshwizard.netconfig\.\(IB_wifi.*\)_.*/\1/' |uniq)"
[ -z "$(echo $IBwifis |grep IB_wifi)" ] && exit

for w in $IBwifis; do
	posIB=$(( $posIB + 1 ))
	export IB_wifi$posIB="$w"
done

pos=0
syswifis="$(uci show wireless |grep wifi-device | sed 's/wireless\.\(.*\)=.*/\1/' |uniq)"

for s in $syswifis; do
	export syswifi$pos="$s"
	pos=$(( $pos + 1 ))
done

for i in `seq 0 $posIB`; do
	IBwifi=$(eval echo \$IB_wifi$i)
	syswifi=$(eval echo \$syswifi$i)

	if [ -n "$syswifi" ]; then
		case $IBwifi in
		IB_wifi* )
			# replace IB_wifi_* with actual wifi interface names, delete old ones first
			uci show meshwizard.netconfig | grep $IBwifi | while read line; do
				oldline=$(echo $line | cut -d "=" -f 1)
				uci set $oldline=""
				newline=$(echo $line |sed "s/$IBwifi/$syswifi/g")
				uci set $newline
			done
		;;
		esac
		unset IBwifi
		unset syswifi
	fi
done

uci_commitverbose "Renaming wifi-devices in /etc/config/meshwizard" meshwizard
