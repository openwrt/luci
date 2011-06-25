#!/bin/sh
# generates a dhcp-ip and netrange from a given ip/subnet
# takes 2 arguments:
# $1: Ip Address (of the Interface for which we want to generate an ip)

echo "$1" | awk 'BEGIN { FS = "." } ; { print "6."$3"."$4".1" }'
