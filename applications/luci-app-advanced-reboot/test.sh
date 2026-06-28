#!/bin/sh

ubus -S call luci.advanced-reboot obtain_device_info | grep 'NO_BOARD_NAME_MATCH' && \
ubus -S call luci.advanced-reboot boot_partition '{ "number": "1" }' | grep 'NO_BOARD_NAME_MATCH' && \
ubus -S call luci.advanced-reboot boot_partition '{ "number": "2" }' | grep 'NO_BOARD_NAME_MATCH'
