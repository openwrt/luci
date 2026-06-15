#!/bin/sh
# advanced-reboot helper for Linksys MX6200
# Sets bootconfig partitions after fw_setenv boot_part has been called.
# Usage: linksys-mx6200.sh <partition_number>

. /lib/upgrade/platform.sh

case "$1" in
	1)
		linksys_bootconfig_set_primaryboot "0:bootconfig" 0
		linksys_bootconfig_set_primaryboot "0:bootconfig1" 0
		;;
	2)
		linksys_bootconfig_set_primaryboot "0:bootconfig" 1
		linksys_bootconfig_set_primaryboot "0:bootconfig1" 1
		;;
	*)
		exit 1
		;;
esac
