#!/bin/sh

DEVICE="$1"
shift
CMD="$*"

case "$CMD" in
	AT+COPS\?|AT+COPS=0|AT+COPS=0,,,2|AT+COPS=0,,,7)
		;;
	*)
		echo "ERROR: command not allowed"
		exit 1
		;;
esac

if [ -z "$DEVICE" ] || [ "$DEVICE" = "auto" ]; then
	for d in /dev/ttyUSB* /dev/ttyACM* /dev/ttyHS*; do
		[ -c "$d" ] && DEVICE="$d"
	done
fi

if [ -z "$DEVICE" ] || [ ! -c "$DEVICE" ]; then
	echo "ERROR: No modem device found"
	exit 1
fi

if ! command -v comgt >/dev/null 2>&1; then
	echo "ERROR: comgt not found, install package 'comgt'"
	exit 1
fi

TMPSCRIPT=$(mktemp /tmp/netmode.XXXXXX)

printf 'opengt\nset com 115200n81\nset senddelay 0.05\nsend "%s^m"\nwaitfor 8 "OK","ERROR","+COPS:"\nget 1 "^m" $s\nprint $s\n' "$CMD" > "$TMPSCRIPT"

comgt -d "$DEVICE" -s "$TMPSCRIPT" 2>/dev/null
result=$?

rm -f "$TMPSCRIPT"
exit $result
