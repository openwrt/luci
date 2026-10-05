# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# Generated classifier snapshot.
# CLASSIFY_SPEC parity with htdocs/.../fwlive/log.js.
# Standalone awk program loaded by fwlive-is-firewall-event.sh.

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
	sub(/^([ \t\n\r]|\302\240)+/, "", s)
	sub(/([ \t\n\r]|\302\240)+$/, "", s)
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
	return lc ~ "^(dnsmasq|procd|ubusd|netifd|odhcpd|logd|dropbear|uhttpd|hostapd|wpad)([^a-z0-9_-]|$)"
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
function json_unhex4(h, n, i, c, v) {
	n = 0
	h = tolower(h)
	for (i = 1; i <= 4; i++) {
		c = substr(h, i, 1)
		v = index("0123456789abcdef", c)
		if (v == 0) return -1
		n = n * 16 + v - 1
	}
	return n
}
function json_get_msg(obj, s, i, c, esc, out, hex, n) {
	# Summary decoder is ASCII/Latin-1 oriented. \uXXXX outside 1..255 is
	# collapsed (not UTF-8). Invalid \u appends u. NUL is dropped.
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
			else if (c == "b") out = out "\b"
			else if (c == "f") out = out "\f"
			else if (c == "u") {
				hex = substr(s, i + 1, 4)
				n = (length(hex) == 4) ? json_unhex4(hex) : -1
				# 1..255: Latin-1 %c. n>255: collapse. n<0: append u.
				# n==0 (NUL): BusyBox awk strings cannot hold NUL; drop it.
				if (n >= 1 && n <= 255) out = out sprintf("%c", n)
				else if (n < 0) out = out "u"
				if (n >= 0) i += 4
			} else out = out c
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
	if (((has_kv(s, "SRC") && has_kv(s, "DST")) || ((has_kv(s, "IN") || has_kv(s, "OUT")) && (has_kv(s, "SRC") || has_kv(s, "DST") || has_kv(s, "PROTO") || has_kv(s, "SPT") || has_kv(s, "DPT"))) || (action != "UNKNOWN" && (has_kv(s, "IN") || has_kv(s, "OUT") || has_kv(s, "PROTO") || has_kv(s, "SRC") || has_kv(s, "DST"))))) return 1
	if ((has_hint(s) && action != "UNKNOWN")) return 1
	if ((has_hint(s) && (has_kv(s, "IN") || has_kv(s, "OUT") || has_kv(s, "SRC") || has_kv(s, "DST") || has_kv(s, "PROTO")))) return 1
	return 0
}
function utf8_prefix(s, max_bytes, out, i, c, width) {
	out = ""
	i = 1
	while (i <= length(s)) {
		c = substr(s, i, 1)
		width = 1
		if (c ~ ("^[\302-\337]$")) width = 2
		else if (c ~ ("^[\340-\357]$")) width = 3
		else if (c ~ ("^[\360-\367]$")) width = 4
		if (i + width - 1 > max_bytes) break
		out = out substr(s, i, width)
		i += width
	}
	return out
}
function summary_kv(s, key, part) {
	s = normalize(s)
	if (!match(s, "(^|[[:space:]])" key "=[^[:space:]]+")) return ""
	part = substr(s, RSTART, RLENGTH)
	sub(/^[^=]*=/, "", part)
	return part
}
function summary_rule(s, first) {
	s = trim(normalize(s))
	sub(/^\[[[:space:]]*[0-9.]+\][[:space:]]*/, "", s)
	if (tolower(s) ~ /^fw4:[[:space:]]*/) return "fw4"
	# Shared with parseRuleHint: token then IN=/OUT=/SRC=/DST=/PROTO=, else colon tag.
	if (match(s, "^[A-Za-z0-9_.-]+(:|[[:space:]]+)(IN=|OUT=|SRC=|DST=|PROTO=)")) {
		match(s, "^[A-Za-z0-9_.-]+")
		return utf8_prefix(substr(s, RSTART, RLENGTH), 64)
	}
	if (match(s, "^[A-Za-z0-9_.-]+:")) {
		first = substr(s, RSTART, RLENGTH - 1)
		if (tolower(first) == "kernel" || tolower(first) == "iptables") return ""
		return utf8_prefix(first, 64)
	}
	return ""
}
function summary_add_count(counts, key) {
	if (key != "") counts[key]++
}
function json_escape(s, out, i, c) {
	out = ""
	for (i = 1; i <= length(s); i++) {
		c = substr(s, i, 1)
		if (c == "\\") out = out "\\\\"
		else if (c == "\"") out = out "\\\""
		else if (c == "\n") out = out "\\n"
		else if (c == "\r") out = out "\\r"
		else if (c == "\t") out = out "\\t"
		else if (c in json_control_ord) out = out sprintf("\\u%04x", json_control_ord[c])
		else out = out c
	}
	return out
}
function summary_top(counts, limit, out, i, k, best, best_n) {
	for (k in summary_picked) delete summary_picked[k]
	out = "["
	for (i = 0; i < limit; i++) {
		best = ""; best_n = 0
		for (k in counts) {
			if (!(k in summary_picked) && (counts[k] > best_n || (counts[k] == best_n && (best == "" || k < best)))) {
				best = k; best_n = counts[k]
			}
		}
		if (best == "") break
		summary_picked[best] = 1
		if (i) out = out ","
		out = out "{\"value\":\"" json_escape(best) "\",\"count\":" best_n "}"
	}
	return out "]"
}
function summary_add(s, action, src, dst, rule) {
	summary_count++
	action = tolower(detect_action(normalize(s)))
	if (action == "drop" || action == "reject" || action == "deny" || action == "block") summary_add_count(summary_drop_counts, action)
	src = summary_kv(s, "SRC")
	if (src == "") src = summary_kv(s, "DST")
	if (src != "") summary_add_count(summary_talker_counts, utf8_prefix(src, 64))
	rule = summary_rule(s)
	if (rule != "") summary_add_count(summary_rule_counts, rule)
}
function summary_json(out) {
	out = "{\"scope\":\"top of shown sample\",\"top_talkers\":" summary_top(summary_talker_counts, 3)
	out = out ",\"top_drops\":" summary_top(summary_drop_counts, 3)
	out = out ",\"top_rules\":" summary_top(summary_rule_counts, 3) "}"
	# LC_ALL=C makes this a byte budget; utf8_prefix keeps field cuts valid.
	if (length(out) > 1024) return "{\"scope\":\"top of shown sample\",\"truncated\":true}"
	return out
}
BEGIN {
	for (i = 1; i < 32; i++) json_control_ord[sprintf("%c", i)] = i
	json_control_ord[sprintf("%c", 127)] = 127
	if (MODE == "json_reply") {
		ORS = ""
		printf "{\"log\":["
	} else if (MODE != "json") ORS = ""
}
{
	if (MODE == "json" || MODE == "json_reply") {
		msg = json_get_msg($0)
		if (is_fw(msg)) {
			if (MODE == "json_reply" && SUMMARY != "0") summary_add(msg)
			if (out_n++) printf ","
			printf "%s", $0
		}
		next
	}
	buf = (NR == 1) ? $0 : buf "\n" $0
}
END {
	if (MODE == "json_reply") {
		printf "],\"messages_received\":%d", NR
		if (SUMMARY != "0" && summary_count > 0) printf ",\"summary\":%s", summary_json()
		printf "}"
	}
	else if (MODE != "json")
		print is_fw(buf) ? 1 : 0
}
