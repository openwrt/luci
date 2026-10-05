# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# Generated classifier snapshot.
# CLASSIFY_SPEC parity with htdocs/.../fwlive/log.js.
# Shared isFirewallEvent parity logic (shell). Sourced by fwlive-log-filter.sh and tests.
# Sourced library: do not add set -euo here; callers own strict mode.
# MODE=json prints matching records comma-joined, with no array wrapper or trailing newline.
# MODE=json_reply wraps a poll reply; default MODE=msg classifies one message.

# The caller sets FILTER_DIR when this file is sourced. Resolve the asset
# once, not once per classification call.
CLASSIFY_AWK="${FILTER_DIR:-${0%/*}}/fwlive-is-firewall-event.awk"

_fwlive_run_classify() {
	if [ "${1:-msg}" = json_reply ]; then
		LC_ALL=C awk -v MODE="${1:-msg}" -v SUMMARY="${FWLIVE_SUMMARY:-1}" -f "$CLASSIFY_AWK"
	else
		awk -v MODE="${1:-msg}" -v SUMMARY="${FWLIVE_SUMMARY:-1}" -f "$CLASSIFY_AWK"
	fi
}

is_firewall_event_msg() {
	_r=$(printf '%s' "$1" | _fwlive_run_classify msg)
	[ "$_r" = 1 ]
}

_fwlive_filter_json_entries() {
	_fwlive_run_classify json
}

_fwlive_filter_json_reply() {
	_fwlive_run_classify json_reply
}
