#!/bin/sh
netrenamed=$1

local PREFIX="$(echo $ipv6_prefix| cut -d "/" -f 1| sed 's/::/:/')"

# Get the devices mac address
local device="$(uci -p/var/state -q get network.$1.ifname)"
if [ -n "$device" ]; then
	local MAC="$(ifconfig $netrenamed |grep HWaddr | awk '{ print $5 '})"
else 
	local MAC="$(cat /sys/class/net/$1/address)"
	local IPV6_UNIQ="$(echo $MAC | awk -F: '{ print $1$2":"$3$4":"$5$6 }')"
fi

echo "${PREFIX}${IPV6_UNIQ}:1"

