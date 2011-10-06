#!/bin/sh

. $dir/functions.sh

set_defaults "system_" system.system
uci -q delete meshwizard.system && uci commit meshwizard
uci_commitverbose "System config" system
