#!/bin/sh
local PREFIX="$(echo $profile_ipv6_prefix| cut -d "/" -f 1| sed 's/::/:/')"
local MAC="$(ifconfig $1 |grep HWaddr | awk '{ print $5 '})"
local IPV6_UNIQ="$(echo $MAC | awk -F: '{ print $1$2":"$3$4":"$5$6 }')"

echo "${PREFIX}${IPV6_UNIQ}:1"

