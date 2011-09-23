#!/bin/sh

#check if dyngw_plain is installed and enabled, else exit
dyngwplainlib=`uci show olsrd |grep dyn_gw_plain |awk {' FS="."; print $1"."$2 '}`
if [ -n "$dyngwplainlib" ]; then
	if [ ! "$(uci -q get $dyngwplainlib.ignore)" == 0 ]; then
		exit 1
	fi
else
	echo "dyngw_plain not found in olsrd config, exit"
	exit 1
fi


# check if we have a defaultroute with metric=0 in one of these tables: main table and gw-check table.
# If not exit here.
defroutemain="$(ip r s |grep default |grep -v metric)"
defroutegw-check="$(ip r s t gw-check |grep default |grep -v metric)"
if [ -z "$defroutegw-check" -a -z "$defroutemain" ]; then
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
			logger -t gw-check "Could not get test file from http://$t/conntest.html"
		fi
	done
}

iw=$(check_internet)

if [ "$iw" == 0 ]; then
	# check if we have a seperate routing table for our tests.
	# If yes, move defaultroute to normal table and delete table gw-check
	if [ -n "$defroutegw-check" ]; then
		ip r a $defroutegw-check
		ip r d $defroutegw-check t gw-check
		ip ru del fwmark 0x2 lookup gw-check
		for host in $testserver; do
			iptables -t mangle -D OUTPUT -d $host -p tcp --dport 80 -j MARK --set-mark 0x2
		done
		logger -t gw-check "Internet is available again, restoring default route ( $defroutegw-check)"
	fi
	
else
	# Check failed. If we have a defaultroute with metric=0 and it is already in table gw-check then do nothing.
	# If there is a defaultroute with metric=0 then remove it from the main routing table and add to table gw-check.
	if [ -z "$(ip ru s | grep gw-check)" -a -n "$defroutemain" ]; then
		ip rule add fwmark 0x2 lookup gw-check
		for host in $testserver; do
			iptables -t mangle -I OUTPUT -d $host -p tcp --dport 80 -j MARK --set-mark 0x2
		done
		ip r a $defroutemain table gw-check
		ip r d $defroutemain
		logger -t gw-check "Internet is not available, deactivating the default route ( $defroutemain)"
	fi
fi
