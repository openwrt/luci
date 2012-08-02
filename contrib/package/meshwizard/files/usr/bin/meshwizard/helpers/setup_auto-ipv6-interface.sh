#!/bin/sh

net=$1
. $dir/functions.sh

ra="$(uci -q get meshwizard.netconfig.${net}_ipv6ra)"
uci set autoipv6.${netrenamed}="interface"
if [ -n "$ra" ]; then
	uci set autoipv6.${netrenamed}.ra=1
fi

uci_commitverbose "Setup auto-ipv6 for interface $netrenamed" autoipv6
