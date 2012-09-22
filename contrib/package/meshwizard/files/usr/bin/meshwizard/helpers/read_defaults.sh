#!/bin/sh
# This reads the settings we need to have to configure everything
# Argument $1: community

. /lib/functions.sh
community="$1"

# reads variables from uci files, parameter $1 is the section
get_var() {
	uci -q show $1 | cut -d "." -f 2-100 |grep "\." | sed -e 's/^\([A-Za-z0-9_]*\)\./\1_/g' -e 's/=\(.*\)$/="\1"/g'
}

handle_widgets() {
        widgets="$widgets $1"
}
config_load freifunk
config_foreach handle_widgets widget
config_load profile_$community
config_foreach handle_widgets widget
echo "widgets=$widgets"

# read default values from /etc/config/freifunk
for v in system wifi_device wifi_iface interface alias dhcp olsr_interface olsr_interfacedefaults zone_freifunk include $widgets; do
	get_var freifunk.$v
done

# now read all values from the selected community profile, will override some values from the defaults before
for v in system wifi_device wifi_iface interface alias dhcp olsr_interface olsr_interfacedefaults profile zone_freifunk include luci_splash ipv6 $widgets; do
	get_var profile_$community.$v
done

# read values from meshwizard
for v in system luci_main contact community wan lan general ipv6; do
        get_var meshwizard.$v
done
