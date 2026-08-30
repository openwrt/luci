#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# Filter log.read JSON to firewall-only entries (isFirewallEvent parity).
# Log messages are treated as data (jsonfilter + grep stdin); never interpolated
# into shell command strings. Usage: ubus call log read '...' | fwlive-log-filter.sh
#
# Perf (#85): stream @.log[*] once instead of an O(n) length probe plus two
# jsonfilter spawns per index (~3n+1 → ~n+1 process execs per poll).

FILTER_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091 # classifier is a sibling file next to this script
. "$FILTER_DIR/fwlive-is-firewall-event.sh"

input="$(cat)"
[ -n "$input" ] || input='{"log":[]}'

if ! command -v jsonfilter >/dev/null 2>&1; then
	printf '%s' '{"log":[]}'
	exit 0
fi

printf '%s' '{"log":['
sep=''
# Pipe group keeps sep local while still writing the filtered array to stdout.
jsonfilter -s "$input" -e '@.log[*]' 2>/dev/null | {
	while IFS= read -r entry || [ -n "$entry" ]; do
		[ -n "$entry" ] || continue
		msg=$(printf '%s' "$entry" | jsonfilter -e '@.msg' 2>/dev/null)
		if is_firewall_event_msg "$msg"; then
			printf '%s%s' "$sep" "$entry"
			sep=','
		fi
	done
}
printf '%s' ']}'
