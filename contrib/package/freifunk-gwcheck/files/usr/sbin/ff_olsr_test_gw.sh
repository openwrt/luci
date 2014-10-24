#!/bin/sh
# Copyright 2013 Manuel Munz <freifunk at somakoma dot de>
# Licensed under the GNU General Public License (GPL) v3
# This script monitors the local internet gateway

. /lib/functions.sh
. /lib/functions/network.sh
. /usr/share/libubox/jshn.sh

# exit if dyngw_plain is not enabled or RtTable is not (254 or unset)
config_load olsrd

check_dyngw_plain()
{
        local cfg="$1"
	config_get library "$cfg" library
	if [ "${library#olsrd_dyn_gw_plain}" != "$library" ]; then
		config_get ignore "$cfg" ignore
		config_get RtTable "$cfg" RtTable
		if [ "$ignore" != "1" ] && [ -z "$RtTable" -o "$RtTable" = "254" ]; then
			exit=0
		fi
	fi
}

exit=1
config_foreach check_dyngw_plain LoadPlugin
[ "$exit" = "1" ] && exit 1

#Exit if this script is already running
pid="$(pidof ff_olsr_test_gw.sh)"
if [ ${#pid} -gt 5 ]; then
	logger -p debug -t gwcheck "Gateway check script is already running, exit now"
	exit 1
fi

# exit if there is no defaultroute with metric=0 in main or gw-check table.
defroutemain="$(ip route show |grep default |grep -v metric)"
defroutegwcheck="$(ip route show table gw-check |grep default |grep -v metric)"
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
		ip route add $defroutegwcheck
		ip route del $defroutegwcheck table gw-check
		for host in $testserver; do
			ips="$(resolve $host)"
			for ip in $ips; do
				[ -n "$(ip rule show | grep "to $ip lookup gw-check")" ] && ip rule del to $ip table gw-check
			done
		done
		get_dnsservers
		for d in $dns; do
			[ -n "$(ip rule show | grep "to $d lookup gw-check")" ] && ip rule del to $d table gw-check
		done
		logger -p err -t gw-check "Internet is available again, default route restored ( $defroutegwcheck)"
	fi

else
	# Check failed. Move default route to table gw-check and setup ip rules.
	if [ -z "$(ip rule show | grep gw-check)" -a -n "$defroutemain" ]; then
		ip route add $defroutemain table gw-check
		ip route del $defroutemain
		logger -p err -t gw-check "Internet is not available, default route deactivated ( $defroutemain)"
	fi
	for host in $testserver; do
		ips="$(resolve $host)"
		for ip in $ips; do
			[ -z "$(ip rule show | grep "to $ip lookup gw-check")" ] && ip rule add to $ip table gw-check
		done
	done
	get_dnsservers
	for d in $dns; do
		[ -z "$(ip rule show | grep "to $d lookup gw-check")" ] && ip rule add to $d table gw-check
	done
	logger -p err -t gw-check "Check your internet connection!"
fi
