#!/bin/sh

if [ ! "$(uci -q get freifunk-mapupdate.mapupdate.enabled)" == 1 ]; then
	exit 1
fi

MAPSERVER="$(uci -q get freifunk-mapupdate.mapupdate.mapserver)"
[ -z "$MAPSERVER" ] && logger -t "freifunk-mapupdate:" "No mapserver configured" && exit 1

#check if nameservice plugin is installed and enabled, else exit
nslib=`uci show olsrd |grep olsrd_nameservice |awk {' FS="."; print $1"."$2 '}`
if [ -n "$nslib" ]; then
		LATLONFILE="$(uci -q get $nslib.latlon_file)"
		if [ -z "$LATLONFILE" ]; then
			LATLONFILE="/var/run/latlon.js"
		fi
		if [ ! -p "$LATLONFILE" ]; then
			logger -t "freifunk-mapupdate:" "latlon_file not found."; exit 1
		fi
else
        logger -t "freifunk-mapupdate:" "nameservice plugin not found in olsrd config."
        exit 1
fi

HOSTNAME="$(uci show system |grep hostname |cut -d "=" -f 2)"
HF_INFO=""

# Get info for myself
SELF=$(cat $LATLONFILE |grep ^Self | sed -e 's/Self(//' -e 's/);//' -e "s/'//g")
OLSR_IP="$(echo $SELF |awk '{ FS=",";print $1 }')"
LOCATION="$(uci show system |grep .location |cut -d "=" -f 2)"
[ -n "$LOCATION" ] && NOTE="$LOCATION<br>"
FFNOTE="$(uci -q get freifunk.contact.note)"
[ -n "$FFNOTE" ] && NOTE="$NOTE $FFNOTE"
NOTE="<h3><a href='http://$OLSR_IP' target='_blank'>$HOSTNAME</a></h3><p>$NOTE"
NOTE=`echo -e "$NOTE" | sed -e 's/\ /%20/g' -e 's/&/%26/g' -e 's/"/%22/g'`

UPDATESTRING="$(echo $SELF |awk '{ FS=",";print $2 }'), $(echo $SELF |awk '{ FS=",";print $3 }')"

# write our coordinates to mygooglemapscoords.txt to make Freifunk Firmware happy
echo "$UPDATESTRING" > /tmp/mygooglemapscoords.txt
[ ! -L /www/mygooglemapscoords.txt ] && ln -s /tmp/mygooglemapscoords.txt /www/mygooglemapscoords.txt

# get neighbor Info (lat, lon, lq)
while read line; do
	NEIGHUPD="$(echo $line |awk '{ FS=","; print $6 }'), $(echo $line |awk '{ FS=","; print $7 }'), $(echo $line |awk '{ FS=",";print $4 }')"
	UPDATESTRING="${UPDATESTRING}, ${NEIGHUPD}"
done << EOF
`grep "PLink('$OLSR_IP" $LATLONFILE | sed -e 's/PLink(//' -e 's/);//' -e "s/'//g"`
EOF

# Send UPDATESTRING
UPDATE=`echo -e "$UPDATESTRING" | sed s/\ /%20/g`
result="$(wget "$MAPSERVER?update=$UPDATE&updateiv=3600&olsrip=$OLSR_IP&note=${NOTE}${HF_INFO}" -qO -)"

if [ ! "$result" == "success update" ]; then
	logger -t "freifunk-mapupdate:" "Update failed: $result"
fi
	
