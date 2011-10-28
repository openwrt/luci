#!/bin/sh

[ -d ./build ] || {
	echo "Please execute as ./build/mkbasepot.sh" >&2
	exit 1
}

echo -n "Updating po/templates/base.pot ... "

./build/i18n-scan.pl \
	libs/core/ libs/web/ protocols/ \
	modules/admin-core/ modules/admin-full/ \
	themes/base/ themes/openwrt/ \
> po/templates/base.pot

echo "done"
