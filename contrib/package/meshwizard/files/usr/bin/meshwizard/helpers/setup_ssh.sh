#!/bin/sh
# Setup ssh. At this point only used to store pubkeys.

[ ! "$(uci -q get meshwizard.ssh)" == "system" ] && exit

. /lib/functions.sh
. $dir/functions.sh
authorized="/etc/dropbear/authorized_keys"


config_load meshwizard

i=0
handle_pubkeys() {
	local k="$1"
	( [ -f "$authorized" ] && grep -q "$k" $authorized) || {
		echo "$k" >> $authorized
		i=`expr $i + 1`
	}
}

config_list_foreach ssh pubkey handle_pubkeys

uci delete meshwizard.ssh
uci_commitverbose "Added $i pubkeys to authorized_keys" meshwizard

