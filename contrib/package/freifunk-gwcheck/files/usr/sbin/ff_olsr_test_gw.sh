#!/bin/sh
# Copyright 2013 Manuel Munz <freifunk at somakoma dot de>
# Licensed under the GNU General Public License (GPL) v3
# This script monitors the local internet gateway

. /lib/functions/network.sh

# exit if dyngw_plain is not installed or enabled
dgwlib=`uci show olsrd |grep dyn_gw_plain |awk {' FS="."; print $1"."$2 '}`
if [ -n "$dgwlib" ]; then
	if [ "$(uci -q get $dgwlib.ignore)" == 1 ]; then
		exit 1
	fi
else
	exit 1
fi

#Exit if this script is already running
pid="$(pidof ff_olsr_test_gw.sh)"
if [ ${#pid} -gt 5 ]; then
	logger -p debug -t gwcheck "Gateway check script is already running, exit now"
	exit 1
fi

# exit if there is no defaultroute with metric=0 in main or gw-check table.
defroutemain="$(ip r s |grep default |grep -v metric)"
defroutegwcheck="$(ip r s t gw-check |grep default |grep -v metric)"
if [ -z "$defroutegwcheck" -a -z "$defroutemain" ]; then
	exit 1
fi

# get and shuffle list of testservers
testserver="$(uci -q get freifunk-gwcheck.hosts.host)"
[ -z "$testserver" ] && echo "No testservers found, exit" && exit

testserver="$(for t in $testserver; do echo $t; done | awk 'BEGIN {
	srand();
}
{
	l[NR] = $0;
}

END {
	for (i = 1; i <= NR; i++) {
		n = int(rand() * (NR - i + 1)) + i;
		print l[n];
		l[n] = l[i];
	}
}')"

check_internet() {
	for t in $testserver; do
		local test
		test=$(wget -q http://$t/conntest.html -O -| grep "Internet_works")
		if [ "$test" == "Internet_works" ]; then
			echo 0
			break
		else
			logger -p debug -t gw-check "Could not fetch http://$t/conntest.html"
		fi
	done
}

resolve() {
	echo "$(nslookup $1 2>/dev/null |grep 'Address' |grep -v '127.0.0.1' |awk '{ print $3 }')"
}

get_dnsservers() {
	# this gets all dns servers for the interface which has the default route

	dns=""
	if [ ! -x /bin/ubus ]; then
		# ubus not present (versions before Attitude): fallback to get these from /var/state/network.
		# We always assume that wan is the default route interface here
		dns="$(grep network.wan.resolv_dns /var/state/network | cut -d "=" -f 2)"
	else
		network_find_wan wan
		network_get_dnsserver dns $wan
	fi
}

iw=$(check_internet)

if [ "$iw" == 0 ]; then
	# Internet available again, restore default route and remove ip rules
	if [ -n "$defroutegwcheck" ]; then
		ip r a $defroutegwcheck
		ip r d $defroutegwcheck t gw-check
		for host in $testserver; do
			ips="$(resolve $host)"
			for ip in $ips; do
				[ -n "$(ip ru s | grep "to $ip lookup gw-check")" ] && ip rule del to $ip table gw-check
			done
		done
		get_dnsservers
		for d in $dns; do
			[ -n "$(ip ru s | grep "to $d lookup gw-check")" ] && ip rule del to $d table gw-check
		done
		logger -p err -t gw-check "Internet is available again, default route restored ( $defroutegwcheck)"
	fi

else
	# Check failed. Move default route to table gw-check and setup ip rules.
	if [ -z "$(ip ru s | grep gw-check)" -a -n "$defroutemain" ]; then
		ip r a $defroutemain table gw-check
		ip r d $defroutemain
		logger -p err -t gw-check "Internet is not available, default route deactivated ( $defroutemain)"
	fi
	for host in $testserver; do
		ips="$(resolve $host)"
		for ip in $ips; do
			[ -z "$(ip ru s | grep "to $ip lookup gw-check")" ] && ip rule add to $ip table gw-check
		done
	done
	get_dnsservers
	for d in $dns; do
		[ -z "$(ip ru s | grep "to $d lookup gw-check")" ] && ip rule add to $d table gw-check
	done
	logger -p err -t gw-check "Check your internet connection!"
fi
