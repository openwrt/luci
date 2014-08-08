#!/bin/sh
# sets up qos-scripts for the wan interface

. /lib/functions.sh
. $dir/functions.sh

if [ ! -f /etc/config/qos ]; then
	echo "NOT setting up QOS because /etc/config/qos-scripts was not found"
else
	uci batch <<- EOF
		set qos.wan.enabled=1
		set qos.wan.upload=$wan_up
		set qos.wan.download=$wan_down
	EOF
	uci_commitverbose "Setup QOS on WAN interface." qos

fi
