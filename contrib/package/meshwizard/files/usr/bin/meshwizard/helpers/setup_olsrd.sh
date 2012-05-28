#!/bin/sh
# Sets up olsrd

. /etc/functions.sh
. $dir/functions.sh

# Rename interface defaults

handle_interfacedefaults() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename olsrd $1 InterfaceDefaults
	fi
}
config_load olsrd
config_foreach handle_interfacedefaults InterfaceDefaults

# Setup new InterfaceDefaults
uci set olsrd.InterfaceDefaults=InterfaceDefaults
set_defaults "olsr_interfacedefaults_" olsrd.InterfaceDefaults
uci_commitverbose "Setup olsr interface defaults" olsrd

# Rename nameservice, dyngw and httpinfo plugins

handle_plugin() {
	config_get library "$1" library
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		new="$(echo $library | cut -d '.' -f 1)"
		section_rename olsrd $1 $new
	fi
}
config_foreach handle_plugin LoadPlugin

# Setup nameservice plugin
if [ -n "$profile_suffix" ]; then
	suffix=".$profile_suffix"
else
	suffix=".olsr"
fi
uci batch << EOF
	set olsrd.olsrd_nameservice=LoadPlugin
	set olsrd.olsrd_nameservice.library="olsrd_nameservice.so.0.3"
	set olsrd.olsrd_nameservice.latlon_file="/var/run/latlon.js"
	set olsrd.olsrd_nameservice.hosts_file="/var/etc/hosts.olsr"
	set olsrd.olsrd_nameservice.sighup_pid_file="/var/run/dnsmasq.pid"
	set olsrd.olsrd_nameservice.suffix="$suffix"
EOF

uci_commitverbose "Setup olsr nameservice plugin" olsrd

# Setup dyngw_plain

# If Sharing of Internet is enabled then enable dyngw_plain plugin

if [ "$general_sharenet" == 1 ]; then
	uci set olsrd.dyngw_plain=LoadPlugin
	uci set olsrd.dyngw_plain.ignore=0
	uci set olsrd.dyngw_plain.library="olsrd_dyn_gw_plain.so.0.4"

	uci_commitverbose "Setup olsrd_dyngw_plain plugin" olsrd
fi

# Setup watchdog
uci batch << EOF
	set olsrd.olsrd_watchdog=LoadPlugin
	set olsrd.olsrd_watchdog.library="olsrd_watchdog.so.0.1"
	set olsrd.olsrd_watchdog.file="/var/run/olsrd.watchdog"
	set olsrd.olsrd_watchdog.interval=30
EOF
uci_commitverbose "Setup olsr watchdog plugin" olsrd
