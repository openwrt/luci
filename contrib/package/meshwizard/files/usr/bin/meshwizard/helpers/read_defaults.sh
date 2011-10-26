#!/bin/sh
# This reads the settings we need to have to configure everything
# Argument $1: community

community="$1"

# reads variables from uci files, parameter $1 is the section
get_var() {
	uci -q show $1 | cut -d "." -f 2-100 |grep "\." | sed -e 's/^\([a-z_]*\)\./\1_/g' -e 's/=\(.*\)$/="\1"/g'
}

# read default values from /etc/config/freifunk
for v in system wifi_device wifi_iface interface alias dhcp olsr_interface olsr_interfacedefaults zone_freifunk include; do
	get_var freifunk.$v
done

# now read all values from the selected community profile, will override some values from the defaults before
for v in system wifi_device wifi_iface interface alias dhcp olsr_interface olsr_interfacedefaults profile zone_freifunk include; do
	get_var profile_$community.$v
done

# read values from meshwizard
for v in system luci_main contact community wan; do
        get_var meshwizard.$v
done
