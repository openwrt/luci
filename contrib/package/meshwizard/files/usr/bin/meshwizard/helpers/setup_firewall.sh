#!/bin/sh
# Add "freifunk" firewall zone
# If wan/lan is used for olsr then remove these networks from wan/lan zones
# Also setup rules defined in /etc/config/freifunk and /etc/config/profile_<community>

. /lib/functions.sh
. $dir/functions.sh

wan_is_olsr=$(uci -q get meshwizard.netconfig.wan_config)
lan_is_olsr=$(uci -q get meshwizard.netconfig.lan_config)

config_load firewall

# Rename firewall zone for freifunk if unnamed
# If wan is used for olsr then set network for the firewall zone wan to ' ' to remove the wan interface from it, else add local restrict to it
# If lan is used for olsr then set network for the firewall zone lan to ' ' to remove the lan interface from it

handle_fwzone() {
	config_get name "$1" name
	config_get network "$1" network

	if [ "$name" == "freifunk" ]; then
		# rename section if unnamed
		if [ -z "${1/cfg[0-9a-fA-F]*/}" ]; then
			section_rename firewall $1 zone_freifunk
		fi
	fi

	if [ "$name" == "wan" ]; then
		if  [ "$wan_is_olsr" == 1 ]; then
			uci set firewall.$1.network=' ' && uci_commitverbose "WAN is used for olsr, removed the wan interface from zone wan" firewall
		else
			uci set firewall.$1.local_restrict=1 && uci_commitverbose "Enable local_restrict for zone wan" firewall
		fi
	fi

	if [ "$name" == "lan" ] && [ "$lan_is_olsr" == 1 ]; then
			uci set firewall.$1.network=' ' && uci_commitverbose "LAN is used for olsr, removed the lan interface from zone lan" firewall
	fi
}

config_foreach handle_fwzone zone

uci batch << EOF
	set firewall.zone_freifunk="zone"
	set firewall.zone_freifunk.name="freifunk"
	set firewall.zone_freifunk.input="$zone_freifunk_input"
	set firewall.zone_freifunk.forward="$zone_freifunk_forward"
	set firewall.zone_freifunk.output="$zone_freifunk_output"
EOF

uci_commitverbose "Setup firewall zones" firewall

# Usually we need to setup masquerading for lan, except lan is an olsr interface or has an olsr hna-entry

handle_interface() {
        config_get interface "$1" interface
        if [ "$interface" == "lan" ]; then
                no_masq_lan=1
        fi
}
config_load olsrd
config_foreach handle_interface Interface

LANIP="$(uci -q get network.lan.ipaddr)"
if [ -n "$LANIP" ]; then
	handle_hna() {
		config_get netaddr "$1" netaddr
			if [ "$LANIP" == "$netaddr" ]; then
			no_masq_lan=1
		fi
	}
	config_foreach handle_hna Hna4
fi

currms=$(uci -q get firewall.zone_freifunk.masq_src)
if [ ! "$no_masq_lan" == "1" ] && [ ! "$(uci -q get meshwizard.netconfig.lan_config)" == 1 ]; then
	uci set firewall.zone_freifunk.masq="1"
	[ -z "$(echo $currms |grep lan)" ] && uci add_list firewall.zone_freifunk.masq_src="lan"
fi


# Rules, Forwardings, advanced config and includes

for config in freifunk profile_$community; do

	config_load $config

	for section in advanced include fw_rule fw_forwarding; do
		handle_firewall() {
		        local options=$(uci show $config."$1")
			options=$(echo "$options" | sed -e "s/fw_//g" -e "s/^$config/firewall/g")
			for o in $options; do
				uci set $o
			done
		}
		config_foreach handle_firewall $section
	done
done

# If we use auto-ipv6-dhcp then allow 547/udp on the freifunk zone
if [ "$ipv6_config" = "auto-ipv6-dhcpv6" ]; then
	uci batch <<- EOF
		set firewall.dhcpv6=rule
		set firewall.dhcpv6.src=freifunk
		set firewall.dhcpv6.target=ACCEPT
		set firewall.dhcpv6.dest_port=547
		set firewall.dhcpv6.proto=udp
	EOF
fi

# Firewall rules to allow incoming ssh and web if enabled

if [ "$wan_allowssh" == 1 ]; then
	uci batch <<- EOF
		set firewall.wanssh=rule
		set firewall.wanssh.src=wan
		set firewall.wanssh.target=ACCEPT
		set firewall.wanssh.proto=tcp
		set firewall.wanssh.dest_port=22
	EOF
fi

if [ "$wan_allowweb" == 1 ]; then
	uci batch <<- EOF
		set firewall.wanweb=rule
		set firewall.wanweb.src=wan
		set firewall.wanweb.target=ACCEPT
		set firewall.wanweb.proto=tcp
		set firewall.wanweb.dest_port=80
		set firewall.wanwebhttps=rule
		set firewall.wanwebhttps.src=wan
		set firewall.wanwebhttps.target=ACCEPT
		set firewall.wanwebhttps.proto=tcp
		set firewall.wanwebhttps.dest_port=443
	EOF
fi

uci_commitverbose "Setup rules, forwardings, advanced config and includes." firewall
