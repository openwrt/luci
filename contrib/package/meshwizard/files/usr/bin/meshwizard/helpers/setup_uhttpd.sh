#!/bin/sh
. $dir/functions.sh
if [ "$ipv6_enabled" = "1" ]; then
	uci batch <<- EOF
		set uhttpd.main.listen_http=":80"
		set uhttpd.main.listen_https=:"443"
	EOF
fi

uci_commitverbose "Setup uhttpd" uhttpd

