#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# Filter log.read JSON to firewall-only entries (isFirewallEvent parity).
# Log messages are treated as data (jsonfilter + awk stdin); never interpolated
# into shell command strings. Usage: ubus call log read '...' | fwlive-log-filter.sh
#
# Perf (#219): one jsonfilter for @.log[*] plus one awk classify. Process
# count is constant per poll, not O(entries).

if ! command -v jsonfilter >/dev/null 2>&1; then
	command -v logger >/dev/null 2>&1 && logger -t fwlive "jsonfilter not found; cannot filter firewall logs"
	printf '%s' '{"log":[],"error":"jsonfilter_missing"}'
	exit 1
fi

FILTER_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091 # classifier is a sibling file next to this script
. "$FILTER_DIR/fwlive-is-firewall-event.sh"

input="$(cat)"
[ -n "$input" ] || input='{"log":[]}'

printf '%s' '{"log":['
jsonfilter -s "$input" -e '@.log[*]' 2>/dev/null | _fwlive_filter_json_entries
printf '%s' ']}'
