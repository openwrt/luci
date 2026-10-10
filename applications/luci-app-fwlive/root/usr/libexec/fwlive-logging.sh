#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# WAN zone logging helpers for ubus fwlive (logging_status / enable / disable).
#
# Sourced library (rpcd plugin, package prerm). Do not `set -euo pipefail`
# here: prerm is best-effort (`restore ... || logger`; exit 0) and callers
# expect soft failures. The rpcd entry point enables strict mode; critical
# paths use explicit `|| return 1` / `|| true`.

NF_LOG_IPV4="${FWLIVE_NF_LOG_IPV4_PATH:-/proc/sys/net/netfilter/nf_log/2}"
NF_LOG_IPV6="${FWLIVE_NF_LOG_IPV6_PATH:-/proc/sys/net/netfilter/nf_log/10}"
# /proc/sys/net/netfilter/nf_log/10 is a backend selector, not an IPv6
# availability probe.  A missing or empty /proc/net/if_inet6 means the IPv6
# stack is absent (compiled out or ipv6.disable=1), so an IPv6 backend is
# not required.  Any content, including loopback ::1, means the IPv6 stack
# is present and the IPv6 logger is required.  This is not a WAN-address
# probe: stock OpenWrt with CONFIG_IPV6 still has lo ::1 on an IPv4-only WAN.
NF_LOG_IPV6_AVAILABLE_PATH="${FWLIVE_IPV6_AVAILABLE_PATH:-/proc/net/if_inet6}"

NF_LOG_STATE_COMPUTED=0
NF_LOG_IPV4_READY=false
NF_LOG_IPV6_READY=false

# Serialize the WAN logging read->compute->set->commit window across
# concurrent ubus write-ACL callers: each toggle re-reads the current
# firewall.<zone>.log bit, computes a target, then uci set + uci commit. Two
# concurrent callers could otherwise interleave and last-commit-wins.
#
# BusyBox flock has no -w timeout, so acquire with `flock -n 9` and poll for
# WAN_LOG_LOCK_WAIT_SEC one-second retry intervals. In ash/dash, `>>` clears
# close-on-exec, so a live child can keep fd 9 after this holder dies; callers
# fail closed when that stale lock outlives the wait budget. The critical
# section MUST stay SHORT (a few uci commands). Do NOT hold the lock across
# the /etc/init.d/firewall reload (can take seconds); the lock is released
# before reload. Reload-failure rollback re-acquires the lock and checks the
# volatile commit generation so an intervening off->on write is not mistaken
# for an unchanged value; do not drop that re-acquire or generation check.
# The lock path can be overridden for tests/containers (default is root-only
# /etc/fwlive); generation tests use the analogous FWLIVE_WAN_LOG_GENERATION_FILE.
WAN_LOG_LOCK_FILE="${FWLIVE_WAN_LOG_LOCK_FILE:-/etc/fwlive/logging.lock}"
WAN_LOG_BASELINE_FILE="${FWLIVE_WAN_LOG_BASELINE_FILE:-/etc/fwlive/wan-log-baseline}"
WAN_LOG_GENERATION_FILE="${FWLIVE_WAN_LOG_GENERATION_FILE:-/var/run/fwlive/wan-log-generation}"
WAN_LOG_LOCK_WAIT_SEC=5
WAN_LOG_COMMIT_GENERATION='unavailable'
WAN_ZONE_DIAGNOSTIC_JSON=''
WAN_ZONE_FOUND=''

weak_device_detected() {
	# Path overrides are test hooks; production defaults stay in procfs.
	_meminfo=${FWLIVE_MEMINFO_PATH:-/proc/meminfo}
	_cpuinfo=${FWLIVE_CPUINFO_PATH:-/proc/cpuinfo}
	_mem_total=
	if [ -r "$_meminfo" ]; then
		while IFS= read -r _line; do
			case "$_line" in
				MemTotal:*)
					_mem_total=${_line#MemTotal:}
					while :; do
						case "$_mem_total" in
							[[:space:]]*) _mem_total=${_mem_total#?} ;;
							*) break ;;
						esac
					done
					_mem_total=${_mem_total%%[[:space:]]*}
					break
					;;
			esac
		done <"$_meminfo" || :
	fi

	_cores=0
	_cpu_valid=0
	if [ -r "$_cpuinfo" ]; then
		while IFS= read -r _line; do
			case "$_line" in
				processor[[:space:]]*:*)
					_cores=$((_cores + 1))
					_cpu_valid=1
					;;
			esac
		done <"$_cpuinfo" || :
	fi

	case "$_mem_total" in
		''|*[!0-9]*) printf 'false\n'; return 0 ;;
	esac
	[ "$_cpu_valid" = 1 ] || { printf 'false\n'; return 0; }
	# MemTotal is reported in KiB; 256 MiB is 262144 KiB.
	if [ "$_mem_total" -lt 262144 ] || [ "$_cores" -le 1 ]; then
		printf 'true\n'
	else
		printf 'false\n'
	fi
}

# RFC 8259 string escape. Lives here so prerm can source this file
# standalone. rpcd sources us and must not redefine this.
json_escape() {
	# Escape for JSON string content per RFC 8259 (including remaining C0 controls).
	# Slurp stdin as one string. Default awk RS is newline — RS="" is
	# paragraph mode and drops blank-line separators (a\n\nb → ab). A
	# sentinel is appended so a leading, trailing, or lone newline is kept.
	{ cat; printf '%s' '_'; } | awk '
	BEGIN {
		ORS = ""
		for (n = 1; n < 128; n++)
			ord[sprintf("%c", n)] = n
	}
	{
		if (NR > 1) buf = buf "\n"
		buf = buf $0
	}
	END {
		if (length(buf) > 0)
			buf = substr(buf, 1, length(buf) - 1)
		for (i = 1; i <= length(buf); i++) {
			c = substr(buf, i, 1)
			if (c == "\\") printf "\\\\"
			else if (c == "\"") printf "\\\""
			else if (c == "\t") printf "\\t"
			else if (c == "\r") printf "\\r"
			else if (c == "\n") printf "\\n"
			else {
				o = ord[c] + 0
				if (o > 0 && o < 32)
					printf "\\u%04x", o
				else if (o == 127)
					printf "\\u007f"
				else
					printf "%s", c
			}
		}
	}'
}

# Production lock dir must be owned by euid with no group/other write.
# Avoid GNU/BusyBox `stat -c` — stock OpenWrt omits FEATURE_STAT_FORMAT.
wan_log_lock_dir_safe() {
	dir="$1"
	[ -n "$dir" ] || return 1
	[ -L "$dir" ] && return 1
	[ -d "$dir" ] || return 1
	# POSIX -O: true when the effective uid owns the directory (rpcd → root).
	# shellcheck disable=SC3067 # BusyBox/dash implement -O; SC3067 is overly strict
	[ -O "$dir" ] || return 1
	# Fail closed if group or other write is set. find -perm is on BusyBox;
	# -prune limits the walk to this directory only.
	_writable=$(find "$dir" -prune \( -perm -020 -o -perm -002 \) -print 2>/dev/null) || return 1
	[ -z "$_writable" ]
}

# Acquire the exclusive logging lock on fd 9. Polls non-blocking flock for a
# bounded retry budget; fails closed if the lock file cannot be opened, flock is
# unavailable, or the lock stays busy for WAN_LOG_LOCK_WAIT_SEC intervals.
# Create/tighten the lock to 0600 so unprivileged UIDs cannot take LOCK_EX on
# a world-readable fd (flock(2) allows exclusive locks on O_RDONLY).
acquire_wan_log_lock() {
	# Fail closed on symlinks: chmod/chown/exec O_TRUNC follow the target as root
	# Default lock lives under /etc/fwlive (root-only), not world-writable
	# /var/lock. Re-check after create/tighten (TOCTOU).
	lock_dir="$(dirname "$WAN_LOG_LOCK_FILE")"
	[ -L "$lock_dir" ] && return 1
	[ -L "$WAN_LOG_LOCK_FILE" ] && return 1
	( umask 077; mkdir -p "$lock_dir" ) 2>/dev/null || return 1
	[ -L "$lock_dir" ] && return 1
	if [ -z "${FWLIVE_WAN_LOG_LOCK_FILE:-}" ]; then
		wan_log_lock_dir_safe "$lock_dir" || return 1
	fi
	# An existing FIFO would block even the create/tighten append below.
	# Permit an absent path so normal first-use creation still works.
	if [ -e "$WAN_LOG_LOCK_FILE" ] && [ ! -f "$WAN_LOG_LOCK_FILE" ]; then
		return 1
	fi
	( umask 077; : >> "$WAN_LOG_LOCK_FILE" ) 2>/dev/null || return 1
	[ -f "$WAN_LOG_LOCK_FILE" ] || return 1
	[ -L "$WAN_LOG_LOCK_FILE" ] && return 1
	chmod 0600 "$WAN_LOG_LOCK_FILE" 2>/dev/null || true
	chown 0:0 "$WAN_LOG_LOCK_FILE" 2>/dev/null || true
	[ -L "$WAN_LOG_LOCK_FILE" ] && return 1
	[ -f "$WAN_LOG_LOCK_FILE" ] || return 1
	# Probe in a subshell first: a failed `exec` redirection aborts a POSIX
	# non-interactive shell outright, so `|| return 1` on the real exec would
	# never run — and `2>/dev/null` on the same exec would permanently
	# silence this process's stderr on the success path.
	( exec 9>>"$WAN_LOG_LOCK_FILE" ) 2>/dev/null || return 1
	exec 9>>"$WAN_LOG_LOCK_FILE"
	_waited=0
	while :; do
		if flock -n 9 2>/dev/null; then
			return 0
		else
			_flock_rc=$?
		fi
		# BusyBox and util-linux both use status 1 for lock contention. Other
		# failures (including a missing flock command) are setup errors.
		if [ "$_flock_rc" -ne 1 ]; then
			exec 9>&-
			return 1
		fi
		[ "$_waited" -ge "$WAN_LOG_LOCK_WAIT_SEC" ] && break
		sleep 1
		_waited=$((_waited + 1))
	done
	exec 9>&-
	return 1
}

# Release the logging lock (explicit unlock, then close fd 9).
release_wan_log_lock() {
	flock -u 9 2>/dev/null || true
	exec 9>&-
}

# WAN_LOG_GENERATION_FILE is under a root-only volatile directory. Each
# fwlive writer increments it while holding fd 9, before staging/committing
# the UCI update. Atomic replacement keeps a killed writer from leaving a
# truncated token; a token write that succeeds but is followed by a failed
# commit is conservative (it can only suppress a later rollback).
wan_log_generation_read() {
	_generation_dir="$(dirname "$WAN_LOG_GENERATION_FILE")"
	[ -L "$_generation_dir" ] && return 1
	wan_log_lock_dir_safe "$_generation_dir" || return 1
	[ -L "$WAN_LOG_GENERATION_FILE" ] && return 1
	if [ ! -e "$WAN_LOG_GENERATION_FILE" ]; then
		printf '0'
		return 0
	fi
	[ -f "$WAN_LOG_GENERATION_FILE" ] || return 1
	_generation_value=$(cat "$WAN_LOG_GENERATION_FILE" 2>/dev/null) || return 1
	case "$_generation_value" in
		''|*[!0-9]*|0[0-9]*) return 1 ;;
	esac
	printf '%s' "$_generation_value"
}

wan_log_generation_bump() {
	_generation_dir="$(dirname "$WAN_LOG_GENERATION_FILE")"
	[ -L "$_generation_dir" ] && return 1
	( umask 077; mkdir -p "$_generation_dir" ) 2>/dev/null || return 1
	[ -L "$_generation_dir" ] && return 1
	wan_log_lock_dir_safe "$_generation_dir" || return 1
	[ -L "$WAN_LOG_GENERATION_FILE" ] && return 1
	_generation_value=$(wan_log_generation_read) || return 1
	# Keep below signed 32-bit ash arithmetic bounds. Exhaustion fails closed;
	# it must never wrap and let an old rollback token compare equal again.
	[ "$_generation_value" -lt 2147483646 ] || return 1
	_generation_next=$((_generation_value + 1))
	_generation_tmp=$(mktemp "${WAN_LOG_GENERATION_FILE}.XXXXXX") || return 1
	if ! printf '%s\n' "$_generation_next" >"$_generation_tmp"; then
		rm -f "$_generation_tmp"
		return 1
	fi
	chmod 0600 "$_generation_tmp" 2>/dev/null || {
		rm -f "$_generation_tmp"
		return 1
	}
	[ -L "$WAN_LOG_GENERATION_FILE" ] && {
		rm -f "$_generation_tmp"
		return 1
	}
	mv -f "$_generation_tmp" "$WAN_LOG_GENERATION_FILE" 2>/dev/null || {
		rm -f "$_generation_tmp"
		return 1
	}
	printf '%s' "$_generation_next"
}

wan_log_error_json() {
	printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"%s"}' "$1" "$2"
}

wan_log_tracking_failed_json() {
	_zone_json="$1"
	logger -t fwlive "WAN log toggle aborted: commit generation unavailable" 2>/dev/null || true
	wan_log_error_json "$_zone_json" rollback_tracking_failed
}

find_wan_zone_section_state() {
	# Match the first zone whose name is 'wan' or whose effective network list
	# contains 'wan'/'wan6'. UCI defaults an omitted network option to the
	# section name, so a renamed zone such as internet with network=wan is
	# supported while a fully renamed zone remains an explicit no-WAN result.
	# The diagnostic list is reset on every lookup and records zone names for
	# no_wan_zone callers; it is JSON-escaped before it reaches a reply.
	# uci missing / no wan zone is empty, not fatal. pipefail + set -e
	# cannot apply to this pipeline.
	WAN_ZONE_DIAGNOSTIC_JSON=''
	WAN_ZONE_FOUND=''
	_firewall_show=$(uci -q show firewall 2>/dev/null || true)
	_zones=$(printf '%s\n' "$_firewall_show" \
		| sed -n 's/^firewall\.\([^.=]*\)=zone$/\1/p')
	# Line-wise here-doc (not an unquoted for-loop): @zone[N] is a glob
	# character class and would expand when cwd contains @zoneN. The
	# while-read stays in the current shell (here-doc, not a pipeline)
	# so WAN_ZONE_* mutations and return reach the caller.
	while IFS= read -r zone || [ -n "$zone" ]; do
		[ -n "$zone" ] || continue
		_name=$(uci -q get "firewall.${zone}.name" 2>/dev/null || true)
		if [ -z "$_name" ]; then
			_name=$(printf '%s\n' "$_firewall_show" \
				| awk -v key="firewall.${zone}.name=" \
					'index($0, key) == 1 {
						value = substr($0, length(key) + 1)
						sub(/^'\''/, "", value)
						sub(/'\''$/, "", value)
						print value
						exit
					}')
		fi
		# UCI permits a zone section without an explicit name. In that case
		# the section id is the effective zone name for omitted network lists.
		[ -n "$_name" ] || _name="$zone"
		[ -n "$_name" ] && _zone_label="$_name" || _zone_label="$zone"
		_esc=$(printf '%s' "$_zone_label" | json_escape)
		if [ -n "$WAN_ZONE_DIAGNOSTIC_JSON" ]; then
			WAN_ZONE_DIAGNOSTIC_JSON="${WAN_ZONE_DIAGNOSTIC_JSON},"
		fi
		WAN_ZONE_DIAGNOSTIC_JSON="${WAN_ZONE_DIAGNOSTIC_JSON}\"${_esc}\""

		# uci -q get exits 1 on a missing section. Capture with || true so
		# set -e cannot abort inside "$(…)" before || continue.
		_type=$(uci -q get "firewall.${zone}" 2>/dev/null || true)
		[ "$_type" = "zone" ] || continue
		_network=$(uci -q get "firewall.${zone}.network" 2>/dev/null || true)
		[ -n "$_network" ] || _network="$_name"
		_is_wan=0
		[ "$_name" = wan ] && _is_wan=1
		case " ${_network} " in
			*' wan '*|*' wan6 '*) _is_wan=1 ;;
		esac
		if [ "$_is_wan" = 1 ]; then
			WAN_ZONE_FOUND="$zone"
			return 0
		fi
	done <<EOF
$_zones
EOF
	return 0
}

find_wan_zone_section() {
	find_wan_zone_section_state
	printf '%s' "$WAN_ZONE_FOUND"
}

wan_zone_diagnostic_json() {
	printf '[%s]' "${WAN_ZONE_DIAGNOSTIC_JSON:-}"
}

no_wan_zone_error_json() {
	_candidates=$(wan_zone_diagnostic_json)
	printf '{"ok":false,"changed":false,"wan_zone":null,"error":"no_wan_zone","wan_zone_candidates":%s}' \
		"$_candidates"
}

firewall_changes_pending() {
	# uci miss is "no pending changes". set -e cannot apply.
	pending="$(uci -q changes firewall 2>/dev/null || true)"
	[ -n "$pending" ]
}

wan_zone_log_value() {
	zone="$1"
	[ -n "$zone" ] || return 1
	# Unset option is a valid empty value; uci -q get exits 1.
	uci -q get "firewall.${zone}.log" 2>/dev/null || true
}

# Resolve a firewall section id to its canonical cfgXXXX form.
# `uci -X show` disables @type[N] aliases so @zone[0] and
# cfgXXXX for the same anonymous section compare equal. Empty on failure.
uci_canonical_firewall_section() {
	_sid="$1"
	[ -n "$_sid" ] || return 1
	uci -q -X show "firewall.${_sid}" 2>/dev/null \
		| sed -n '1s/^firewall\.\([^=.]*\)=.*/\1/p'
}

# True when two firewall section ids refer to the same WAN zone.
# Compare canonical cfg ids — do NOT treat every name=wan zone as identical
# (duplicate wan sections would under-match foreign .log deltas as ours).
wan_firewall_zone_same() {
	_a="$1"
	_b="$2"
	[ -n "$_a" ] && [ -n "$_b" ] || return 1
	[ "$_a" = "$_b" ] && return 0
	_ca=$(uci_canonical_firewall_section "$_a") || return 1
	_cb=$(uci_canonical_firewall_section "$_b") || return 1
	[ -n "$_ca" ] && [ -n "$_cb" ] && [ "$_ca" = "$_cb" ]
}

wan_log_staged_line_section() {
	_line="$1"
	case "$_line" in
		firewall.*.log=*)
			_rest=${_line#firewall.}
			printf '%s' "${_rest%%.log=*}"
			;;
		-firewall.*.log)
			_rest=${_line#-firewall.}
			printf '%s' "${_rest%.log}"
			;;
		"- firewall."*.log)
			_rest=${_line#- firewall.}
			printf '%s' "${_rest%.log}"
			;;
	esac
}

# Zone ids that may appear in `uci changes` for firewall.<id>.log.
wan_log_staged_zone_ids() {
	_zone="$1"
	_staged="$2"
	_seen="|${_zone}|"
	printf '%s\n' "$_zone"
	while IFS= read -r _line || [ -n "$_line" ]; do
		[ -n "$_line" ] || continue
		_sid=$(wan_log_staged_line_section "$_line")
		[ -n "$_sid" ] || continue
		case "$_seen" in *"|${_sid}|"*) continue ;; esac
		wan_firewall_zone_same "$_zone" "$_sid" || continue
		_seen="${_seen}${_sid}|"
		printf '%s\n' "$_sid"
	done <<EOF
$_staged
EOF
}

# Match only firewall.<zone>.log deltas in `uci changes` — not log_limit.
wan_log_foreign_staged_lines() {
	_zone="$1"
	_staged="$2"
	_ids=$(wan_log_staged_zone_ids "$_zone" "$_staged")
	printf '%s\n' "$_staged" | awk -v ids="$_ids" '
		BEGIN {
			n = split(ids, id, "\n")
			for (i = 1; i <= n; i++) {
				if (id[i] == "") continue
				np++
				p[np] = "firewall." id[i] ".log="
				d[np] = "-firewall." id[i] ".log"
				ds[np] = "- firewall." id[i] ".log"
			}
		}
		NF == 0 { next }
		{
			ours = 0
			for (i = 1; i <= np; i++) {
				if (index($0, p[i]) == 1) { ours = 1; break }
				if ($0 == d[i] || $0 == ds[i]) { ours = 1; break }
			}
			if (!ours) print
		}
	'
}

wan_log_count_our_staged_lines() {
	_zone="$1"
	_staged="$2"
	_ids=$(wan_log_staged_zone_ids "$_zone" "$_staged")
	printf '%s\n' "$_staged" | awk -v ids="$_ids" '
		BEGIN {
			n = split(ids, id, "\n")
			for (i = 1; i <= n; i++) {
				if (id[i] == "") continue
				np++
				p[np] = "firewall." id[i] ".log="
				d[np] = "-firewall." id[i] ".log"
				ds[np] = "- firewall." id[i] ".log"
			}
		}
		NF == 0 { next }
		{
			for (i = 1; i <= np; i++) {
				if (index($0, p[i]) == 1) { c++; break }
				if ($0 == d[i] || $0 == ds[i]) { c++; break }
			}
		}
		END { print c+0 }
	'
}

wan_log_baseline_path() {
	printf '%s' "$WAN_LOG_BASELINE_FILE"
}

# Snapshot firewall.<wan>.log once before the first enable changes UCI.
# Empty file means the option was unset. Skipped when baseline already exists.
# Disable does not snapshot: a pre-existing/foreign log bit is an operator
# request to turn logging off; uninstall must not put that bit back.
maybe_snapshot_wan_log_baseline() {
	zone="$1"
	path="$(wan_log_baseline_path)"
	[ -n "$zone" ] || return 1
	[ -L "$path" ] && return 1
	[ -f "$path" ] && return 0
	_dir=$(dirname "$path")
	[ -n "$_dir" ] || return 1
	[ -L "$_dir" ] && return 1
	mkdir -p "$_dir" 2>/dev/null || return 1
	[ -L "$_dir" ] && return 1
	[ -L "$path" ] && return 1
	# Production path only: tests relocate WAN_LOG_BASELINE_FILE.
	if [ -z "${FWLIVE_WAN_LOG_BASELINE_FILE:-}" ] && [ "$path" = /etc/fwlive/wan-log-baseline ]; then
		wan_log_lock_dir_safe "$_dir" || return 1
	fi
	if [ "$#" -ge 2 ]; then
		current="$2"
	else
		current=$(wan_zone_log_value "$zone")
	fi
	printf '%s' "$current" >"$path" 2>/dev/null || return 1
	return 0
}

# Restore WAN zone log from the install-time baseline (package prerm).
# No-op when baseline is missing. Returns 1 on failure; baseline file is
# kept until restore commits and the post-restore firewall reload succeeds.
#
# Hold the logging lock across the current-value read, equality check,
# and commit — otherwise a concurrent enable can snapshot the old baseline
# (or race the unlink) and lose the only restore value. Reload runs
# without the lock (BusyBox flock has no -w); unlink after a successful
# reload.
restore_wan_log_baseline() {
	path="$(wan_log_baseline_path)"
	[ -f "$path" ] || return 0
	# Empty file is a valid "option was unset" baseline.
	baseline=$(cat "$path" 2>/dev/null || true)
	find_wan_zone_section_state
	zone=$WAN_ZONE_FOUND
	if [ -z "$zone" ]; then
		logger -t fwlive "WAN log baseline restore skipped: no WAN zone" 2>/dev/null || true
		return 1
	fi
	if ! acquire_wan_log_lock; then
		logger -t fwlive "WAN log baseline restore skipped: lock unavailable" 2>/dev/null || true
		return 1
	fi
	current=$(wan_zone_log_value "$zone")
	if [ "${current:-}" = "${baseline:-}" ]; then
		# UCI already matches; live fw4 may still be stale after a
		# previous reload failure. Retry reload before dropping the
		# marker.
		if firewall_changes_pending; then
			release_wan_log_lock
			logger -t fwlive "WAN log baseline restore skipped: firewall changes pending" 2>/dev/null || true
			return 1
		fi
		release_wan_log_lock
		if ! restore_wan_log_after_reload "$path" "$zone" "$baseline"; then
			return 1
		fi
		return 0
	fi
	zone_json=$(json_null_or_string "$zone")
	if firewall_changes_pending; then
		release_wan_log_lock
		logger -t fwlive "WAN log baseline restore skipped: firewall changes pending" 2>/dev/null || true
		return 1
	fi
	_commit_rc=0
	commit_wan_log_change "$zone" "$zone_json" "$baseline" || _commit_rc=$?
	if [ "$_commit_rc" -eq 2 ]; then
		# Commit landed; live fw4 still needs a reload. Baseline file
		# stays so a later restore can retry — read-back was not ours.
		release_wan_log_lock
		reload_firewall || logger -t fwlive "WAN log baseline restore: firewall reload failed after raced commit" 2>/dev/null || true
		logger -t fwlive "WAN log baseline restore: post-commit verify raced" 2>/dev/null || true
		return 1
	fi
	if [ "$_commit_rc" -ne 0 ]; then
		release_wan_log_lock
		logger -t fwlive "WAN log baseline restore: commit gate failed" 2>/dev/null || true
		return 1
	fi
	release_wan_log_lock
	if ! restore_wan_log_after_reload "$path" "$zone" "$baseline"; then
		return 1
	fi
	return 0
}

# Reload without the logging lock (BusyBox flock has no -w). Re-acquire
# before unlinking so a concurrent enable cannot snapshot-skip then leave
# UCI off the saved baseline while this path still deletes the marker.
restore_wan_log_after_reload() {
	path="$1"
	zone="$2"
	baseline="$3"
	if ! reload_firewall; then
		logger -t fwlive "WAN log baseline restored; firewall reload failed" 2>/dev/null || true
		return 1
	fi
	if ! acquire_wan_log_lock; then
		logger -t fwlive "WAN log baseline restore: lock unavailable after reload" 2>/dev/null || true
		return 1
	fi
	current=$(wan_zone_log_value "$zone")
	if [ "${current:-}" != "${baseline:-}" ]; then
		release_wan_log_lock
		logger -t fwlive "WAN log baseline restore: post-reload verify raced" 2>/dev/null || true
		return 1
	fi
	rm -f "$path"
	release_wan_log_lock
	return 0
}

wan_filter_log_enabled() {
	log_val=$(wan_filter_log_decimal "$1") || return 1
	[ $((log_val & 1)) -ne 0 ]
}

wan_filter_log_decimal() {
	_log_val="$1"
	case "$_log_val" in
		''|*[!0-9]*) return 1 ;;
	esac
	# Bitmask option. Reject oversized digit runs before $(( )) so a
	# 20-digit UCI value cannot kill dash or wrap on BusyBox.
	if [ "${#_log_val}" -gt 10 ]; then
		return 1
	fi
	while [ "${_log_val#0}" != "$_log_val" ]; do
		_log_val=${_log_val#0}
	done
	[ -n "$_log_val" ] || _log_val=0
	printf '%s' "$_log_val"
}

wan_filter_log_target_value() {
	current=$(wan_filter_log_decimal "$1") || {
		printf '1'
		return 0
	}
	if wan_filter_log_enabled "$current"; then
		printf '%s' "$current"
		return 0
	fi
	printf '%d' $((current | 1))
}

# Clear filter-log bit 0 only. Prints remaining value, or empty when the option
# should be deleted (no bits left / non-numeric / already empty).
wan_filter_log_clear_value() {
	current=$(wan_filter_log_decimal "$1") || {
		printf ''
		return 0
	}
	cleared=$((current & ~1))
	if [ "$cleared" -eq 0 ]; then
		printf ''
	else
		printf '%d' "$cleared"
	fi
}

read_nf_log_backend() {
	path="$1"
	[ -f "$path" ] || return 1
	val=$(cat "$path" 2>/dev/null) || return 1
	# Sysctl values are single-line, but trim surrounding whitespace before
	# interpreting the no-backend sentinel. This keeps a malformed `NONE `
	# value from becoming a fail-open logger.
	while case "$val" in [[:space:]]*) true ;; *) false ;; esac; do
		val=${val#?}
	done
	while case "$val" in *[[:space:]]) true ;; *) false ;; esac; do
		val=${val%?}
	done
	[ -n "$val" ] || return 1
	case "$val" in
		[Nn][Oo][Nn][Ee]) return 1 ;;
	esac
	return 0
}

nf_log_family_available() {
	family="$1"
	case "$family" in
		ipv4)
			# Supported fwlive deployments require IPv4 for the WAN path.
			return 0
			;;
		ipv6)
			# Content probe: missing/empty => stack absent; any row
			# (including lo ::1) => stack present. Not a WAN check.
			path="${FWLIVE_IPV6_AVAILABLE_PATH:-$NF_LOG_IPV6_AVAILABLE_PATH}"
			[ -r "$path" ] || return 1
			grep -q '[^[:space:]]' "$path" 2>/dev/null
			;;
		*)
			return 1
			;;
	esac
}

check_nf_log_ipv4() {
	read_nf_log_backend "$NF_LOG_IPV4"
}

check_nf_log_ipv6() {
	# Effective readiness: an absent IPv6 stack is not a blocker.  When
	# if_inet6 has any address, including lo, the IPv6 logger is required.
	nf_log_family_available ipv6 || return 0
	read_nf_log_backend "$NF_LOG_IPV6"
}

compute_nf_log_state() {
	NF_LOG_IPV4_READY=false
	check_nf_log_ipv4 && NF_LOG_IPV4_READY=true
	NF_LOG_IPV6_READY=false
	check_nf_log_ipv6 && NF_LOG_IPV6_READY=true
	NF_LOG_STATE_COMPUTED=1
}

logging_blockers_append() {
	blocker="$1"
	[ -n "$blocker" ] || return 0
	esc=$(printf '%s' "$blocker" | json_escape)
	if [ -n "$LOGGING_BLOCKERS" ]; then
		LOGGING_BLOCKERS="${LOGGING_BLOCKERS},"
	fi
	LOGGING_BLOCKERS="${LOGGING_BLOCKERS}\"${esc}\""
}

logging_warnings_append() {
	warning="$1"
	[ -n "$warning" ] || return 0
	esc=$(printf '%s' "$warning" | json_escape)
	if [ -n "$LOGGING_WARNINGS" ]; then
		LOGGING_WARNINGS="${LOGGING_WARNINGS},"
	fi
	LOGGING_WARNINGS="${LOGGING_WARNINGS}\"${esc}\""
}

collect_logging_blockers() {
	zone="$1"
	LOGGING_BLOCKERS=''
	[ "$NF_LOG_STATE_COMPUTED" = 1 ] || compute_nf_log_state

	[ -n "$zone" ] || logging_blockers_append 'no_wan_zone'
	[ "$NF_LOG_IPV4_READY" = true ] || logging_blockers_append 'nf_log_ipv4_missing'
	[ "$NF_LOG_IPV6_READY" = true ] || logging_blockers_append 'nf_log_ipv6_missing'

	# Report via LOGGING_BLOCKERS, not exit status: return 1 would abort
	# build_logging_status_json under set -e.
	return 0
}

legacy_iptables_active() {
	for _path in \
		"${FWLIVE_IP_TABLES_NAMES_PATH:-/proc/net/ip_tables_names}" \
		"${FWLIVE_IP6_TABLES_NAMES_PATH:-/proc/net/ip6_tables_names}"; do
		if [ -r "$_path" ] && grep -q '[^[:space:]]' "$_path" 2>/dev/null; then
			return 0
		fi
	done
	return 1
}

collect_logging_warnings() {
	LOGGING_WARNINGS=''

	# Diagnostic only: supported releases use nftables, but a registered legacy
	# iptables table can still exist in the namespace visible to rpcd. LuCI
	# surfaces this warning in the backend label; it must not affect readiness
	# or the enable gate. A registered table can come from a loaded module even
	# when it has no rules, so this is inventory evidence, not proof of traffic.
	legacy_iptables_active && logging_warnings_append 'legacy_iptables_detected'

	# Report via LOGGING_WARNINGS, not exit status.
	return 0
}

json_null_or_string() {
	val="$1"
	if [ -z "$val" ]; then
		printf 'null'
	else
		esc=$(printf '%s' "$val" | json_escape)
		printf '"%s"' "$esc"
	fi
}

build_logging_status_json() {
	find_wan_zone_section_state
	zone=$WAN_ZONE_FOUND
	candidates=$(wan_zone_diagnostic_json)
	NF_LOG_STATE_COMPUTED=0
	compute_nf_log_state
	# Empty zone / unset log bit are valid; set -e cannot apply.
	log_val=$(wan_zone_log_value "$zone") || log_val=
	# Unset log_limit is a valid empty value; uci -q get exits 1.
	limit_val=
	if [ -n "$zone" ]; then
		limit_val=$(uci -q get "firewall.${zone}.log_limit" 2>/dev/null || true)
	fi
	wan_log=false
	if wan_filter_log_enabled "$log_val"; then
		wan_log=true
	fi

	nf4=$NF_LOG_IPV4_READY
	nf6=$NF_LOG_IPV6_READY

	collect_logging_blockers "$zone"
	blockers="[${LOGGING_BLOCKERS:-}]"
	collect_logging_warnings
	warnings="[${LOGGING_WARNINGS:-}]"

	ready=false
	if [ -n "$zone" ] && [ "$wan_log" = true ] && [ "$nf4" = true ] && [ "$nf6" = true ]; then
		ready=true
	fi
	weak_device=false
	[ "$(weak_device_detected)" = true ] && weak_device=true

	zone_json=$(json_null_or_string "$zone")
	limit_json=$(json_null_or_string "$limit_val")

	printf '{"wan_zone":%s,"wan_zone_candidates":%s,"wan_log":%s,"wan_log_limit":%s,"nf_log_ipv4":%s,"nf_log_ipv6":%s,"ready":%s,"weak_device":%s,"blockers":%s,"warnings":%s}' \
		"$zone_json" "$candidates" "$wan_log" "$limit_json" "$nf4" "$nf6" "$ready" "$weak_device" "$blockers" "$warnings"
}

reload_firewall() {
	if [ -x /etc/init.d/firewall ]; then
		/etc/init.d/firewall reload >/dev/null 2>&1
		return $?
	fi
	return 1
}

# Best-effort UCI rollback when firewall reload fails after commit.
restore_wan_zone_log() {
	zone="$1"
	previous="$2"
	[ -n "$zone" ] || return 1
	# Refuse to publish unrelated staged firewall deltas.
	if firewall_changes_pending; then
		logger -t fwlive "WAN log rollback skipped: firewall changes pending" 2>/dev/null || true
		return 1
	fi
	# Record this write before touching UCI. If generation tracking is
	# unavailable, do not commit an untracked rollback over another caller.
	wan_log_generation_bump >/dev/null || {
		logger -t fwlive "WAN log rollback skipped: commit generation unavailable" 2>/dev/null || true
		return 1
	}
	# Capture the committed value before staging our rollback. If another
	# writer stages a firewall delta after this point, the post-stage guard
	# below must be able to undo only our rollback staging without reverting
	# the other writer's change.
	committed=$(wan_zone_log_value "$zone")
	# Fail closed if set/delete never staged. Swallowed rc plus an empty
	# changes list would make `uci commit` succeed as a no-op.
	if [ -z "$previous" ]; then
		if ! uci -q delete "firewall.${zone}.log" 2>/dev/null; then
			return 1
		fi
	else
		if ! uci -q set "firewall.${zone}.log=${previous}" 2>/dev/null; then
			return 1
		fi
	fi
	_staged=$(uci -q changes firewall 2>/dev/null || true)
	_foreign=$(wan_log_foreign_staged_lines "$zone" "$_staged")
	if [ -n "$_foreign" ]; then
		if [ -z "$committed" ]; then
			uci delete "firewall.${zone}.log" 2>/dev/null || true
		else
			uci set "firewall.${zone}.log=${committed}" 2>/dev/null || true
		fi
		logger -t fwlive "WAN log rollback skipped after stage: firewall changes staged by another writer" 2>/dev/null || true
		return 1
	fi
	if ! uci commit firewall 2>/dev/null; then
		# Drop our staged rollback delta so a later toggle is not stuck
		# on firewall_changes_pending from this package's own orphaned
		# write. Mirror commit_wan_log_change: revert only when the
		# remaining staging is entirely our log option.
		_staged=$(uci -q changes firewall 2>/dev/null || true)
		_total=$(printf '%s\n' "$_staged" | grep -c . 2>/dev/null || true)
		_ours=$(wan_log_count_our_staged_lines "$zone" "$_staged")
		if [ "${_total:-0}" -gt 0 ] && [ "${_total:-0}" -eq "${_ours:-0}" ]; then
			uci -q revert firewall 2>/dev/null || true
		fi
		return 1
	fi
}

# Stage + commit the WAN log bit. Caller MUST hold the logging lock; this
# closes the read->compute->set->commit window so a concurrent toggle cannot
# commit between our read and our write (no lost update / no stale overwrite).
#
# TOCTOU hardening: UCI staging is global per config file, so a
# non-cooperating writer (another admin's `uci set`, the LuCI firewall page)
# can stage a delta AFTER the toggle's early firewall_changes_pending check.
# Staging and committing therefore live INSIDE this function, gated by:
#   1. a pending re-check BEFORE our own delta exists in staging (foreign-only);
#   2. a post-stage re-check AFTER our set/delete: if anything besides our
#      log option is staged, undo our staging (restore the pre-stage committed
#      value) and abort without commit — foreign staging stays intact.
# The reload-failure rollback has its own pre/post-stage guard for the same
# reason; it must not bypass this invariant merely because it is compensating
# for a failed reload.
# Residual window: a writer that stages between the post-stage check and
# `uci commit` can still ride along; post-commit verification detects a
# mismatched log bit and reports firewall_commit_raced (no blind-revert).
# Same-option races (another writer also staging firewall.<wan>.log) are
# not distinguishable in the changes list. Pre-stage races report
# firewall_changes_pending: the LuCI view already maps it to the accurate
# "another change is staged" notice.
#
# target: value to stage; EMPTY means delete the option (bit fully cleared).
# Prints the failure JSON and returns 1 on abort or failure.
verify_wan_log_commit() {
	zone="$1"
	expected="$2"
	readback="$(uci -q get "firewall.${zone}.log" 2>/dev/null || true)"
	if [ -n "$expected" ]; then
		[ "$readback" = "$expected" ] && return 0
		return 1
	fi
	[ -z "$readback" ] && return 0
	return 1
}

commit_wan_log_change() {
	zone="$1"
	zone_json="$2"
	target="$3"
	WAN_LOG_COMMIT_GENERATION='unavailable'

	# Last-moment guard: runs before OUR delta is staged, so a
	# non-empty changes list here can only be a foreign writer's race.
	if firewall_changes_pending; then
		logger -t fwlive "WAN log toggle aborted at commit gate: firewall changes staged by another writer" 2>/dev/null || true
		wan_log_error_json "$zone_json" firewall_changes_pending
		return 1
	fi

	# Advance the shared volatile revision before the UCI write. A later
	# reload-failure rollback may restore only if this exact revision is still
	# current. Failing closed here avoids a commit that other in-flight callers
	# cannot detect. A failed UCI operation can leave a harmless revision gap.
	_generation=$(wan_log_generation_bump) || {
		wan_log_tracking_failed_json "$zone_json"
		return 1
	}
	WAN_LOG_COMMIT_GENERATION="$_generation"

	# Staging is empty here — capture the committed value so a post-stage
	# foreign race can undo our delta without `uci revert firewall`.
	previous=$(wan_zone_log_value "$zone")

	if [ -n "$target" ]; then
		if ! uci set "firewall.${zone}.log=${target}"; then
			wan_log_error_json "$zone_json" uci_set_failed
			return 1
		fi
	else
		if ! uci delete "firewall.${zone}.log"; then
			wan_log_error_json "$zone_json" uci_delete_failed
			return 1
		fi
	fi

	# Post-stage guard: anything besides our log option is foreign.
	# Undo our staging only (set previous / delete to match committed); leave
	# foreign deltas untouched and abort without commit.
	_staged=$(uci -q changes firewall 2>/dev/null || true)
	_foreign=$(wan_log_foreign_staged_lines "$zone" "$_staged")
	if [ -n "$_foreign" ]; then
		if [ -z "$previous" ]; then
			uci delete "firewall.${zone}.log" 2>/dev/null || true
		else
			uci set "firewall.${zone}.log=${previous}" 2>/dev/null || true
		fi
		logger -t fwlive "WAN log toggle aborted after stage: firewall changes staged by another writer" 2>/dev/null || true
		wan_log_error_json "$zone_json" firewall_changes_pending
		return 1
	fi

	if ! uci commit firewall; then
		# Drop our staged log delta so a later toggle is not stuck on
		# firewall_changes_pending from this package's own orphaned write —
		# but ONLY when nothing foreign is staged: `uci revert firewall` is
		# config-wide (uci has no option-level revert), and reverting would
		# clobber a concurrent writer's uncommitted delta. With foreign
		# staging present, leave it and warn.
		_staged=$(uci -q changes firewall 2>/dev/null || true)
		_total=$(printf '%s\n' "$_staged" | grep -c . 2>/dev/null || true)
		_ours=$(wan_log_count_our_staged_lines "$zone" "$_staged")
		if [ "${_total:-0}" -gt 0 ] && [ "${_total:-0}" -eq "${_ours:-0}" ]; then
			uci -q revert firewall 2>/dev/null || true
		else
			logger -t fwlive "WAN log commit failed with foreign changes staged — not reverting (uci_commit_failed)" 2>/dev/null || true
		fi
		wan_log_error_json "$zone_json" uci_commit_failed
		return 1
	fi

	# Post-commit verification: confirm the committed config really
	# carries what we wrote (empty target = option must now be gone/empty).
	# A mismatch means another writer overtook the commit: warn loudly but do
	# NOT blind-revert (that would destroy unrelated committed data). Return 2
	# so the caller still reloads (live fw4 must track committed UCI) and then
	# reports firewall_commit_raced instead of ok:true. Do not print JSON here:
	# reload may still fail. Return 1 is reserved for pre-commit aborts that
	# already printed an error body.
	if ! verify_wan_log_commit "$zone" "$target"; then
		logger -t fwlive "WAN log post-commit verify FAILED: wrote '${target:-<deleted>}', read back differs" 2>/dev/null || true
		return 2
	fi
	return 0
}

# Caller MUST have released the logging lock. rc from commit_wan_log_change:
# 0 — our target is committed; reload and report success.
# 1 — abort JSON already printed; no commit, skip reload.
# 2 — commit succeeded but verify raced; still reload, then report
#     firewall_commit_raced (or firewall_reload_failed). Do not use
#     reload_and_report_wan_log: a reload failure must not restore
#     `previous` over a foreign committed value.
report_wan_log_after_commit() {
	_rc="$1"
	zone_json="$2"
	_drop_baseline=0
	# The optional eighth argument opts in only when its value is exactly 1.
	# Argument count alone must never authorize deleting recovery state.
	if [ "${8:-0}" = 1 ]; then
		_drop_baseline=1
	fi
	if [ "$_rc" -eq 1 ]; then
		return 0
	fi
	if [ "$_rc" -eq 2 ]; then
		if ! reload_firewall; then
			logger -t fwlive "Firewall reload failed after raced WAN log commit" 2>/dev/null || true
			wan_log_error_json "$zone_json" firewall_reload_failed
			return 0
		fi
		if [ "$_drop_baseline" -eq 1 ]; then
			drop_wan_log_baseline_after_disable "$zone" "$WAN_LOG_COMMIT_GENERATION"
		fi
		wan_log_error_json "$zone_json" firewall_commit_raced
		return 0
	fi
	# Forward only the five documented operation fields plus an explicit flag;
	# unrelated trailing caller arguments must not shift into the flag position.
	reload_and_report_wan_log "$3" "$4" "$5" "$6" "$7" \
		"$zone_json" "$WAN_LOG_COMMIT_GENERATION" "$_drop_baseline"
}

# Firewall reload + best-effort UCI rollback on reload failure. The reload
# itself runs WITHOUT the logging lock (it can take seconds and a held lock
# makes concurrent toggles poll across WAN_LOG_LOCK_WAIT_SEC one-second
# intervals, plus command and scheduling overhead).
#
# The ROLLBACK re-acquires the lock and checks the generation captured at
# commit time. Value equality alone misses an off->on ABA while reload runs.
# All fwlive writers advance the same generation under the lock before UCI
# changes, so rollback proceeds only when no later writer has intervened.
# The lock is held only for the few uci commands of the restore (short
# critical section), never across the reload. If reacquisition or generation
# verification fails, skip rollback and report the reload failure.
reload_and_report_wan_log() {
	zone="$1"
	previous="$2"
	committed="$3"
	fail_msg="$4"
	success_msg="$5"
	zone_json="$6"
	committed_generation="$7"
	_drop_baseline=0
	if [ "${8:-0}" = 1 ]; then
		_drop_baseline=1
	fi

	if ! reload_firewall; then
		# Re-acquire the logging lock so the rollback decision is atomic
		# against concurrent toggles and check for an intervening ABA.
		if acquire_wan_log_lock; then
			current_generation=$(wan_log_generation_read 2>/dev/null || true)
			now="$(wan_zone_log_value "$zone")"
			if [ -n "$committed_generation" ] \
				&& [ "$committed_generation" != unavailable ] \
				&& [ "$current_generation" = "$committed_generation" ] \
				&& [ "$now" = "$committed" ]; then
				# No later fwlive commit attempt advanced the generation, and
				# UCI still carries this caller's committed value.
				if restore_wan_zone_log "$zone" "$previous"; then
					logger -t fwlive "$fail_msg" 2>/dev/null || true
				else
					logger -t fwlive "Firewall reload failed; WAN log rollback skipped (pending changes or restore failed)" 2>/dev/null || true
				fi
			else
				# A later writer may have left the same value (ABA), or the
				# revision may be unavailable. Do not clobber that intent.
				logger -t fwlive "Firewall reload failed; WAN log changed concurrently or revision unavailable — rollback skipped" 2>/dev/null || true
			fi
			release_wan_log_lock
		else
			# Cannot re-acquire the lock: skip the rollback, report the
			# reload failure. The next toggle self-corrects the state.
			logger -t fwlive "Firewall reload failed; rollback lock unavailable — skipped" 2>/dev/null || true
		fi
		wan_log_error_json "$zone_json" firewall_reload_failed
		return 0
	fi
	if [ "$_drop_baseline" -eq 1 ]; then
		drop_wan_log_baseline_after_disable "$zone" "$committed_generation"
	fi
	logger -t fwlive "$success_msg" 2>/dev/null || true
	printf '{"ok":true,"changed":true,"wan_zone":%s}' "$zone_json"
	return 0
}

# After a successful disable/reload, discard the uninstall marker unless a
# later fwlive toggle has taken ownership again. Pending external UCI edits
# are preserved by retiring the stale marker too; a valid `uci show` confirms
# the config is readable before unlinking it.
drop_wan_log_baseline_after_disable() {
	drop_zone="$1"
	drop_generation="$2"
	_drop_path="$(wan_log_baseline_path)"
	[ -f "$_drop_path" ] && [ ! -L "$_drop_path" ] || return 0
	if ! acquire_wan_log_lock; then
		return 0
	fi
	if ! uci -q show "firewall.${drop_zone}" >/dev/null 2>&1; then
		release_wan_log_lock
		return 0
	fi
	_drop_current_generation=$(wan_log_generation_read 2>/dev/null) || {
		release_wan_log_lock
		return 0
	}
	if [ -z "$drop_generation" ] || [ "$drop_generation" = unavailable ] \
		|| [ "$_drop_current_generation" != "$drop_generation" ]; then
		release_wan_log_lock
		return 0
	fi
	rm -f "$_drop_path" 2>/dev/null || true
	release_wan_log_lock
}

# $1=enable checks nf_log before the lock. Success leaves the lock held
# and zone / zone_json set. Failure prints JSON and returns non-zero.
wan_log_toggle_preamble() {
	find_wan_zone_section_state
	zone=$WAN_ZONE_FOUND
	if [ -z "$zone" ]; then
		no_wan_zone_error_json
		return 1
	fi
	zone_json=$(json_null_or_string "$zone")
	if [ "${1-}" = enable ]; then
		NF_LOG_STATE_COMPUTED=0
		compute_nf_log_state
		if [ "$NF_LOG_IPV4_READY" != true ] || [ "$NF_LOG_IPV6_READY" != true ]; then
			wan_log_error_json "$zone_json" nf_log_missing
			return 1
		fi
	fi
	# Locked critical section: read->compute->stage->commit for firewall.<zone>.log.
	# The log bit is re-read AFTER acquiring the lock so the target is computed
	# from the latest committed value; a concurrent toggle cannot interleave.
	# Staging + commit live inside commit_wan_log_change behind its last-moment
	# firewall_changes_pending re-check: a foreign writer racing between
	# the pending check below and the commit aborts the toggle instead of having
	# its half-finished delta published with our log bit.
	if ! acquire_wan_log_lock; then
		wan_log_error_json "$zone_json" lock_failed
		return 1
	fi
	if firewall_changes_pending; then
		release_wan_log_lock
		wan_log_error_json "$zone_json" firewall_changes_pending
		return 1
	fi
}

enable_wan_logging() {
	wan_log_toggle_preamble enable || return 0

	current=$(wan_zone_log_value "$zone")
	if wan_filter_log_enabled "$current"; then
		# Already-on with a lost baseline: reconstruct the value before this
		# package's owned filter-log bit was enabled. Preserve other log-mask
		# bits so uninstall cannot erase unrelated logging settings. The helper
		# skips an existing baseline. Failure stays best-effort and must not
		# become baseline_snapshot_failed.
		baseline=$(wan_filter_log_clear_value "$current")
		maybe_snapshot_wan_log_baseline "$zone" "$baseline" || true
		if ! wan_log_generation_bump >/dev/null; then
			release_wan_log_lock
			wan_log_tracking_failed_json "$zone_json"
			return 0
		fi
		release_wan_log_lock
		printf '{"ok":true,"changed":false,"wan_zone":%s}' "$zone_json"
		return 0
	fi

	if ! maybe_snapshot_wan_log_baseline "$zone"; then
		release_wan_log_lock
		wan_log_error_json "$zone_json" baseline_snapshot_failed
		return 0
	fi

	target=$(wan_filter_log_target_value "$current")
	_commit_rc=0
	commit_wan_log_change "$zone" "$zone_json" "$target" || _commit_rc=$?
	release_wan_log_lock
	report_wan_log_after_commit "$_commit_rc" "$zone_json" \
		"$zone" "$current" "$target" \
		'Firewall reload failed after enable; reverted UCI WAN log' \
		'WAN zone logging enabled'
	return 0
}

disable_wan_logging() {
	wan_log_toggle_preamble || return 0

	current=$(wan_zone_log_value "$zone")
	if [ -z "$current" ] || ! wan_filter_log_enabled "$current"; then
		_disable_generation=$(wan_log_generation_bump) || {
			release_wan_log_lock
			wan_log_tracking_failed_json "$zone_json"
			return 0
		}
		_baseline_path="$(wan_log_baseline_path)"
		if [ -f "$_baseline_path" ] && [ ! -L "$_baseline_path" ] \
			&& firewall_changes_pending; then
			release_wan_log_lock
			wan_log_error_json "$zone_json" firewall_changes_pending
			return 0
		fi
		release_wan_log_lock
		if [ -f "$_baseline_path" ] && [ ! -L "$_baseline_path" ]; then
			if ! reload_firewall; then
				logger -t fwlive "Firewall reload failed after already-disabled request" 2>/dev/null || true
				wan_log_error_json "$zone_json" firewall_reload_failed
				return 0
			fi
			drop_wan_log_baseline_after_disable "$zone" "$_disable_generation"
		fi
		printf '{"ok":true,"changed":false,"wan_zone":%s}' "$zone_json"
		return 0
	fi

	# Enable-only baseline: do not snapshot here. A pre-existing/foreign
	# log bit is an operator request to turn logging off; uninstall must
	# not restore that bit.

	target=$(wan_filter_log_clear_value "$current")
	_commit_rc=0
	commit_wan_log_change "$zone" "$zone_json" "$target" || _commit_rc=$?
	release_wan_log_lock
	report_wan_log_after_commit "$_commit_rc" "$zone_json" \
		"$zone" "$current" "$target" \
		'Firewall reload failed after disable; reverted UCI WAN log' \
		'WAN zone logging disabled' 1
	return 0
}

run_logging_selftest() {
	if wan_filter_log_enabled ''; then
		echo 'wan_filter_log_enabled empty: expected false' >&2
		return 1
	fi
	if ! wan_filter_log_enabled '1'; then
		echo 'wan_filter_log_enabled 1: expected true' >&2
		return 1
	fi
	if ! wan_filter_log_enabled '3'; then
		echo 'wan_filter_log_enabled 3: expected true' >&2
		return 1
	fi
	if wan_filter_log_enabled '2'; then
		echo 'wan_filter_log_enabled 2: expected false' >&2
		return 1
	fi
	for leading_value in 011 010 08 0; do
		if ! wan_filter_log_decimal "$leading_value" >/dev/null; then
			echo "wan_filter_log_decimal $leading_value: expected decimal digits" >&2
			return 1
		fi
	done
	if wan_filter_log_enabled '08' || wan_filter_log_enabled '010'; then
		echo 'leading-zero even values: expected false' >&2
		return 1
	fi
	if ! wan_filter_log_enabled '011'; then
		echo 'leading-zero odd value: expected true' >&2
		return 1
	fi

	got=$(wan_filter_log_target_value '')
	if [ "$got" != '1' ]; then
		echo "wan_filter_log_target_value empty: expected 1 got $got" >&2
		return 1
	fi

	got=$(wan_filter_log_target_value '2')
	if [ "$got" != '3' ]; then
		echo "wan_filter_log_target_value 2: expected 3 got $got" >&2
		return 1
	fi

	got=$(wan_filter_log_target_value '1')
	if [ "$got" != '1' ]; then
		echo "wan_filter_log_target_value 1: expected 1 got $got" >&2
		return 1
	fi
	got=$(wan_filter_log_target_value '08')
	if [ "$got" != '9' ]; then
		echo "wan_filter_log_target_value 08: expected 9 got $got" >&2
		return 1
	fi
	got=$(wan_filter_log_target_value '011')
	if [ "$got" != '11' ]; then
		echo "wan_filter_log_target_value 011: expected 11 got $got" >&2
		return 1
	fi

	# Disable clears bit 0 only: log=3 -> 2; log=1 -> delete (empty).
	got=$(wan_filter_log_clear_value '3')
	if [ "$got" != '2' ]; then
		echo "wan_filter_log_clear_value 3: expected 2 got $got" >&2
		return 1
	fi

	got=$(wan_filter_log_clear_value '1')
	if [ -n "$got" ]; then
		echo "wan_filter_log_clear_value 1: expected empty got $got" >&2
		return 1
	fi

	got=$(wan_filter_log_clear_value '2')
	if [ "$got" != '2' ]; then
		echo "wan_filter_log_clear_value 2: expected 2 got $got" >&2
		return 1
	fi

	got=$(wan_filter_log_clear_value '010')
	if [ "$got" != '10' ]; then
		echo "wan_filter_log_clear_value 010: expected 10 got $got" >&2
		return 1
	fi
	got=$(wan_filter_log_clear_value '0')
	if [ -n "$got" ]; then
		echo "wan_filter_log_clear_value 0: expected empty got $got" >&2
		return 1
	fi

	# Oversized/malformed digit runs reject before arithmetic.
	# Do not assert a host-specific wrap integer.
	if wan_filter_log_decimal '12345678901234567890' >/dev/null; then
		echo 'wan_filter_log_decimal 20-digit: expected reject' >&2
		return 1
	fi
	if wan_filter_log_decimal '12a3' >/dev/null; then
		echo 'wan_filter_log_decimal malformed: expected reject' >&2
		return 1
	fi
	got=$(wan_filter_log_target_value '12345678901234567890')
	if [ "$got" != '1' ]; then
		echo "enable oversized log: expected 1 got $got" >&2
		return 1
	fi
	got=$(wan_filter_log_clear_value '12345678901234567890')
	if [ -n "$got" ]; then
		echo "disable oversized log: expected empty got $got" >&2
		return 1
	fi

	# Enable/disable parity around multi-bit values.
	got=$(wan_filter_log_target_value '2')
	if [ "$got" != '3' ]; then
		echo "enable from 2: expected 3 got $got" >&2
		return 1
	fi
	got=$(wan_filter_log_clear_value '3')
	if [ "$got" != '2' ]; then
		echo "disable from 3: expected 2 got $got" >&2
		return 1
	fi

	return 0
}
