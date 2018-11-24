#!/bin/sh
chnroute_data=$(curl -s -L --connect-timeout 3 http://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest)
[ $? -eq 0 ] && {
    echo "$chnroute_data" | grep ipv4 | grep CN | awk -F\| '{ printf("%s/%d\n", $4, 32-log($5)/log(2)) }' > $1
}