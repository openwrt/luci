#!/bin/sh
# Add "freifunk" firewall zone
# If wan is used for olsr then delete wan zone and all wan rules
# Also setup rules defined in /etc/config/freifunk and /etc/config/profile_<community>

. /etc/functions.sh
. $dir/functions.sh

wan_is_olsr=$(uci -q get meshwizard.netconfig.wan_config)

config_load firewall

# Add local_restrict to wan firewall zone (if wan is not used for olsr)
# If wan is used for olsr then remove the firewall zone wan
handle_zonewan() {
	config_get name "$1" name
	if [ "$name" == "wan" ]; then
		if  [ "$wan_is_olsr" == 1 ]; then
			uci del firewall.$1 && uci_commitverbose "WAN is used for olsr, delete firewall zone wan" firewall
		else
			uci set firewall.$1.local_restrict=1 && uci_commitverbose "Enable local_restrict for zone wan" firewall
		fi
	fi
}
config_foreach handle_zonewan zone

# Rename firewall zone for freifunk if unnamed and delete wan zone if it is used for olsr; else enable local restrict
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
			uci del firewall.$1 && uci_commitverbose "WAN is used for olsr, delete firewall zone wan" firewall
		else
			uci set firewall.$1.local_restrict=1 && uci_commitverbose "Enable local_restrict for zone wan" firewall
		fi
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
if [ ! "$no_masq_lan" == "1" ]; then
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
uci_commitverbose "Setup rules, forwardings, advanced config and includes." firewall

# If wan is used for olsr we need to cleanup old wan (forward) rules

if  [ "$wan_is_olsr" == 1 ]; then
	handle_wanrules() {
	config_get src "$1" src
		config_get dest "$1" dest
		if [ "$src" == "wan" ] || [ "$dest" == "wan" ]; then
			uci del firewall.$1
		fi
	}
	for i in rule forwarding; do
		config_load firewall
		config_foreach handle_wanrules $i
	done
	uci_commitverbose "Wan is used for olsr, delete wan firewall rules and forwardings" firewall
fi

