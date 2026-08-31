# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# Snapshot from the fwlive monorepo (lucas-albers-lz4/fwlive). Do not edit by hand.
# CLASSIFY_SPEC parity with htdocs/.../fwlive/log.js — regenerate upstream of this tree.
# Shared isFirewallEvent parity logic (shell). Sourced by fwlive-log-filter.sh and tests.
# One awk process classifies a batch (MODE=json) or one message (default).

_fwlive_run_classify() {
	awk -v MODE="${1:-msg}" "$(cat <<'AWK'
function normalize(s, keys, n, i, k) {
	n = split("IN OUT SRC DST PROTO SPT DPT LEN MAC TYPE CODE TTL TOS PREC DF", keys, " ")
	for (i = 1; i <= n; i++) {
		k = keys[i]
		while (match(s, "[^[:space:]]" k "="))
			s = substr(s, 1, RSTART) " " substr(s, RSTART + 1)
	}
	return s
}
function trim(s) {
	sub(/^[[:space:]]+/, "", s)
	sub(/[[:space:]]+$/, "", s)
	return s
}
function has_kv(s, key) {
	return s ~ "(^|[^A-Za-z0-9_])" key "="
}
function has_hint(s, lc) {
	lc = tolower(s)
	return lc ~ "(^|[^a-z0-9_])(fw4|nft|iptables|kernel|firewall)([^a-z0-9_]|$)"
}
function non_fw_prefix(s, lc) {
	lc = tolower(s)
	return lc ~ "^(dnsmasq|procd|ubusd|netifd|odhcpd|logd|dropbear|uhttpd|hostapd|wpad)([^a-z0-9_]|$)"
}
function detect_action(s, words, n, i, w, wl, lc, start, pos, before, afterc, best, bestpos) {
	n = split("ACCEPT ALLOW PASS DROP REJECT DENY BLOCK", words, " ")
	lc = tolower(s)
	best = ""
	bestpos = length(s) + 1
	for (i = 1; i <= n; i++) {
		w = words[i]
		wl = tolower(w)
		start = 1
		while (start <= length(lc) && match(substr(lc, start), wl)) {
			pos = start + RSTART - 1
			before = (pos == 1) ? " " : substr(lc, pos - 1, 1)
			afterc = substr(lc, pos + length(wl), 1)
			if (before !~ /[a-z0-9_]/ && (afterc == "" || afterc !~ /[a-z0-9_]/)) {
				if (pos < bestpos) { bestpos = pos; best = w }
				break
			}
			start = pos + 1
		}
	}
	return best == "" ? "UNKNOWN" : best
}
function json_get_msg(obj, s, i, c, esc, out) {
	if (!match(obj, /"msg"[[:space:]]*:[[:space:]]*"/)) return ""
	s = substr(obj, RSTART + RLENGTH)
	out = ""
	esc = 0
	for (i = 1; i <= length(s); i++) {
		c = substr(s, i, 1)
		if (esc) {
			if (c == "n") out = out "\n"
			else if (c == "t") out = out "\t"
			else if (c == "r") out = out "\r"
			else out = out c
			esc = 0
		} else if (c == "\\") {
			esc = 1
		} else if (c == "\"") {
			return out
		} else {
			out = out c
		}
	}
	return out
}
function is_fw(s, action) {
	s = trim(normalize(s))
	if (s == "") return 0
	if (non_fw_prefix(s)) return 0
	action = detect_action(s)
	if (has_kv(s, "SRC") && has_kv(s, "DST")) return 1
	if ((has_kv(s, "IN") || has_kv(s, "OUT")) && (has_kv(s, "SRC") || has_kv(s, "DST") || has_kv(s, "PROTO") || has_kv(s, "SPT") || has_kv(s, "DPT"))) return 1
	if (action != "UNKNOWN" && (has_kv(s, "IN") || has_kv(s, "OUT") || has_kv(s, "PROTO") || has_kv(s, "SRC") || has_kv(s, "DST"))) return 1
	if (has_hint(s) && action != "UNKNOWN") return 1
	if (has_hint(s) && (has_kv(s, "IN") || has_kv(s, "OUT") || has_kv(s, "SRC") || has_kv(s, "DST") || has_kv(s, "PROTO"))) return 1
	return 0
}
BEGIN { if (MODE != "json") ORS = "" }
{
	if (MODE == "json") {
		msg = json_get_msg($0)
		if (is_fw(msg)) {
			if (out_n++) printf ","
			printf "%s", $0
		}
		next
	}
	buf = (NR == 1) ? $0 : buf "\n" $0
}
END {
	if (MODE != "json")
		print is_fw(buf) ? 1 : 0
}
AWK
)"
}

is_firewall_event_msg() {
	_r=$(printf '%s' "$1" | _fwlive_run_classify msg)
	[ "$_r" = 1 ]
}

_fwlive_filter_json_entries() {
	_fwlive_run_classify json
}
