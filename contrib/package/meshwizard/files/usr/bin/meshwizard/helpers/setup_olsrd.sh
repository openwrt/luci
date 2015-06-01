#!/bin/sh
# Sets up olsrd

. /lib/functions.sh
. $dir/functions.sh

local protocols="4"
if [ "$ipv6_enabled" = 1 ] && [ "$has_ipv6" == "1" ]; then
    protocols="4 6"
fi

clean_config() {
    # Clean the config, remove interface wlan
    handle_interface() {
            config_get interface "$1" interface
            if [ "$interface" = "wlan" ]; then
                    uci delete $cfg.$1
            fi
    }
    config_foreach handle_interface Interface
}

rename_olsrd() {
    #Rename olsrd basic settings
    handle_olsrd() {
	if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
		section_rename $cfg $1 olsrd
	fi
    }
    config_foreach handle_olsrd olsrd
}

rename_interface_defaults() {
    # Rename interface defaults
    handle_interfacedefaults() {
            if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
                    section_rename $cfg $1 InterfaceDefaults
            fi
    }
    config_foreach handle_interfacedefaults InterfaceDefaults
}

cleanup_plugins() {
    # Rename nameservice, dyngw and httpinfo plugins
    handle_plugin() {
            config_get library "$1" library
            if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
                    new="$(echo $library | cut -d '.' -f 1)"
                    section_rename $cfg "$1" "$new"
            fi
    }
    config_foreach handle_plugin LoadPlugin
    uci -q delete $cfg.olsrd_httpinfo
    uci -q delete $cfg.olsrd_dyn_gw
}

setup_nameservice() {
    # Setup nameservice plugin
    if [ -n "$profile_suffix" ]; then
            suffix=".$profile_suffix"
    else
            suffix=".olsr"
    fi
    local llfile="/var/run/latlon.js"
    local hosts="/var/etc/hosts.olsr"
    local services="/var/run/services_olsr"

    if [ "$proto" = "6" ]; then
        local llfile="/var/run/latlon.js.ipv6"
        local hosts="/var/etc/hosts.olsr.ipv6"
        local services="/var/run/services_olsr.ipv6"
    fi

	uci batch <<- EOF
		set $cfg.olsrd_nameservice=LoadPlugin
		set $cfg.olsrd_nameservice.library="olsrd_nameservice.so.0.3"
		set $cfg.olsrd_nameservice.latlon_file="$llfile"
		set $cfg.olsrd_nameservice.hosts_file="$hosts"
		set $cfg.olsrd_nameservice.sighup_pid_file="/var/run/dnsmasq.pid"
		set $cfg.olsrd_nameservice.services_file="$services"
		set $cfg.olsrd_nameservice.suffix="$suffix"
	EOF

    uci_commitverbose "Setup olsr nameservice plugin" $cfg
}

setup_dyngw_plain() {
    # Setup dyngw_plain
    # If Sharing of Internet is enabled then enable dyngw_plain plugin

    if [ "$general_sharenet" == 1 ]; then
	uci set $cfg.dyngw_plain=LoadPlugin
	uci set $cfg.dyngw_plain.ignore=0
	uci set $cfg.dyngw_plain.library="olsrd_dyn_gw_plain.so.0.4"
	uci_commitverbose "Setup olsrd_dyngw_plain plugin" $cfg
    fi

}

setup_watchdog() {
    # Setup watchdog
    local watchdogfile="/var/run/olsrd.watchdog"
    if [ "$proto" = "6" ]; then
        watchdogfile="/var/run/olsrd.watchdog.ipv6"
    fi

	uci batch <<- EOF
		set $cfg.olsrd_watchdog=LoadPlugin
		set $cfg.olsrd_watchdog.library="olsrd_watchdog.so.0.1"
		set $cfg.olsrd_watchdog.file="$watchdogfile"
		set $cfg.olsrd_watchdog.interval=30
	EOF
    uci_commitverbose "Setup olsr watchdog plugin" $cfg

}

setup_jsoninfo() {
	proto="$1"
	uci batch <<- EOF
		set $cfg.olsrd_jsoninfo=LoadPlugin
		set $cfg.olsrd_jsoninfo.library="olsrd_jsoninfo.so.0.0"
	EOF
	if [ "$proto" = "6" ]; then
		uci set $cfg.olsrd_jsoninfo.ipv6only='1'
	fi
	uci_commitverbose "Setup olsr jsoninfo plugin" $cfg
}

setup_txtinfo() {
	proto="$1"
	uci batch <<- EOF
	    set $cfg.olsrd_txtinfo=LoadPlugin
	    set $cfg.olsrd_txtinfo.library="olsrd_txtinfo.so.0.1"
	EOF
	if [ "$proto" = "6" ]; then
		uci set $cfg.olsrd_txtinfo.ipv6only='1'
	fi
	uci_commitverbose "Setup olsr txtinfo plugin" $cfg
} 


for proto in $protocols; do
    cfg="olsrd"
    [ "$proto" == "6" ] && cfg="olsrd6"
    config_load $cfg
    clean_config
    rename_olsrd
    cleanup_plugins

    uci set $cfg.olsrd.IpVersion="$proto"
    uci set $cfg.InterfaceDefaults=InterfaceDefaults
    set_defaults "olsr_interfacedefaults_" $cfg.InterfaceDefaults
    uci_commitverbose "Cleanup olsrd config" $cfg

    setup_nameservice
    setup_dyngw_plain
    setup_watchdog
    setup_jsoninfo $proto
    setup_txtinfo $proto
done
