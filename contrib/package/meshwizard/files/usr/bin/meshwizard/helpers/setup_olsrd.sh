#!/bin/sh
# Sets up olsrd

. /lib/functions.sh
. $dir/functions.sh

# Clean the config, remove interface wlan
handle_interface() {
        config_get interface "$1" interface
        if [ "$interface" = "wlan" ]; then
		uci delete olsrd.$1
        fi
}
config_load olsrd
config_foreach handle_interface Interface

#Rename olsrd basic settings
handle_olsrd() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename olsrd $1 olsrd
	fi
}
config_foreach handle_olsrd olsrd

# Rename interface defaults
handle_interfacedefaults() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename olsrd $1 InterfaceDefaults
	fi
}
config_foreach handle_interfacedefaults InterfaceDefaults

# Set basic olsrd settings
if [ "$ipv6_enabled" = 1 ] && [ "$has_ipv6" == "1" ]; then
	uci set olsrd.olsrd.IpVersion="6and4"
fi


# Setup new InterfaceDefaults
uci set olsrd.InterfaceDefaults=InterfaceDefaults
set_defaults "olsr_interfacedefaults_" olsrd.InterfaceDefaults

# Rename nameservice, dyngw and httpinfo plugins

handle_plugin() {
	config_get library "$1" library
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		new="$(echo $library | cut -d '.' -f 1)"
		section_rename olsrd "$1" "$new"
	fi
}
config_foreach handle_plugin LoadPlugin
uci -q delete olsrd.olsrd_httpinfo
uci -q delete olsrd.olsrd_dyn_gw

uci_commitverbose "Cleanup olsrd config" olsrd


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
