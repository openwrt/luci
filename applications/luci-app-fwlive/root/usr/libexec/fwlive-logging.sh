#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# WAN zone logging helpers for ubus fwlive (logging_status / enable / disable).

NF_LOG_IPV4='/proc/sys/net/netfilter/nf_log/2'
NF_LOG_IPV6='/proc/sys/net/netfilter/nf_log/10'

# Serialize the WAN logging read->compute->set->commit window across
# concurrent ubus write-ACL callers (#151): each toggle re-reads the current
# firewall.<zone>.log bit, computes a target, then uci set + uci commit. Two
# concurrent callers could otherwise interleave and last-commit-wins.
#
# BusyBox flock constraint: it has NO -w timeout. A stuck lock holder blocks
# any waiter until the holder exits or the device reboots. The critical
# section MUST stay SHORT (a few uci commands). Do NOT hold the lock across
# the /etc/init.d/firewall reload (can take seconds); the lock is released
# before reload, and reload-failure rollback is a best-effort UCI write
# outside the lock.
# Overridable for tests/containers (default is root-only /etc/fwlive).
WAN_LOG_LOCK_FILE="${FWLIVE_WAN_LOG_LOCK_FILE:-/etc/fwlive/logging.lock}"
WAN_LOG_BASELINE_FILE="${FWLIVE_WAN_LOG_BASELINE_FILE:-/etc/fwlive/wan-log-baseline}"

# RFC 8259 string escape. Lives here so prerm can source this file
# standalone (#222). rpcd sources us and must not redefine this.
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

# Production lock dir must be owned by euid with no group/other write (#204).
# Avoid GNU/BusyBox `stat -c` — stock OpenWrt omits FEATURE_STAT_FORMAT (#232).
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

# Acquire the exclusive logging lock on fd 9. Blocks until free; fails closed
# (return 1) only if the lock file cannot be opened or flock is unavailable.
# Create/tighten the lock to 0600 so unprivileged UIDs cannot take LOCK_EX on
# a world-readable fd (issue #167 / flock(2) allows exclusive locks on O_RDONLY).
acquire_wan_log_lock() {
	# Fail closed on symlinks: chmod/chown/exec O_TRUNC follow the target as root
	# (#204). Default lock lives under /etc/fwlive (root-only), not world-writable
	# /var/lock. Re-check after create/tighten (TOCTOU).
	lock_dir="$(dirname "$WAN_LOG_LOCK_FILE")"
	[ -L "$lock_dir" ] && return 1
	[ -L "$WAN_LOG_LOCK_FILE" ] && return 1
	( umask 077; mkdir -p "$lock_dir" ) 2>/dev/null || return 1
	[ -L "$lock_dir" ] && return 1
	if [ -z "${FWLIVE_WAN_LOG_LOCK_FILE:-}" ]; then
		wan_log_lock_dir_safe "$lock_dir" || return 1
	fi
	( umask 077; : >> "$WAN_LOG_LOCK_FILE" ) 2>/dev/null || return 1
	[ -L "$WAN_LOG_LOCK_FILE" ] && return 1
	chmod 0600 "$WAN_LOG_LOCK_FILE" 2>/dev/null || true
	chown 0:0 "$WAN_LOG_LOCK_FILE" 2>/dev/null || true
	[ -L "$WAN_LOG_LOCK_FILE" ] && return 1
	# Probe in a subshell first: a failed `exec` redirection aborts a POSIX
	# non-interactive shell outright, so `|| return 1` on the real exec would
	# never run — and `2>/dev/null` on the same exec would permanently
	# silence this process's stderr on the success path (#244).
	( exec 9>>"$WAN_LOG_LOCK_FILE" ) 2>/dev/null || return 1
	exec 9>>"$WAN_LOG_LOCK_FILE"
	flock 9 2>/dev/null || {
		exec 9>&-
		return 1
	}
}

# Release the logging lock (explicit unlock, then close fd 9).
release_wan_log_lock() {
	flock -u 9 2>/dev/null || true
	exec 9>&-
}

find_wan_zone_section() {
	# Match anonymous (@zone[N]) and named (e.g. wan) sections whose name option
	# is 'wan'. Prefer the first section whose type is zone (issue #168); skip
	# non-zone sections that happen to share name='wan'.
	_zones=$(uci -q show firewall 2>/dev/null \
		| sed -n "s/^firewall\.\([^.]*\)\.name='wan'$/\1/p")
	for zone in $_zones; do
		[ -n "$zone" ] || continue
		[ "$(uci -q get "firewall.${zone}" 2>/dev/null)" = "zone" ] || continue
		printf '%s' "$zone"
		return 0
	done
	return 0
}

firewall_changes_pending() {
	pending="$(uci -q changes firewall 2>/dev/null)"
	[ -n "$pending" ]
}

wan_zone_log_value() {
	zone="$1"
	[ -n "$zone" ] || return 1
	uci -q get "firewall.${zone}.log" 2>/dev/null
}

# True when two firewall section ids refer to the same WAN zone (issue #239).
wan_firewall_zone_same() {
	_a="$1"
	_b="$2"
	[ -n "$_a" ] && [ -n "$_b" ] || return 1
	[ "$_a" = "$_b" ] && return 0
	_na=$(uci -q get "firewall.${_a}.name" 2>/dev/null) || return 1
	_nb=$(uci -q get "firewall.${_b}.name" 2>/dev/null) || return 1
	_ta=$(uci -q get "firewall.${_a}" 2>/dev/null) || return 1
	_tb=$(uci -q get "firewall.${_b}" 2>/dev/null) || return 1
	[ "$_na" = "wan" ] && [ "$_nb" = "wan" ] && [ "$_ta" = "zone" ] && [ "$_tb" = "zone" ]
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

# Zone ids that may appear in `uci changes` for firewall.<id>.log (issue #239).
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
maybe_snapshot_wan_log_baseline() {
	zone="$1"
	path="$(wan_log_baseline_path)"
	[ -n "$zone" ] || return 1
	[ -f "$path" ] && return 0
	mkdir -p "$(dirname "$path")" 2>/dev/null || return 1
	current=$(wan_zone_log_value "$zone")
	printf '%s' "$current" >"$path" 2>/dev/null || return 1
	return 0
}

# Restore WAN zone log from the install-time baseline (package prerm).
# No-op when baseline is missing. Returns 1 on failure; baseline file is
# kept until restore commits successfully.
#
# Hold the logging lock across the current-value read, equality cleanup,
# commit, and baseline unlink — otherwise a concurrent enable can snapshot
# the old baseline (or race the unlink) and lose the only restore value.
restore_wan_log_baseline() {
	path="$(wan_log_baseline_path)"
	[ -f "$path" ] || return 0
	baseline=$(cat "$path" 2>/dev/null)
	zone=$(find_wan_zone_section)
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
		rm -f "$path"
		release_wan_log_lock
		return 0
	fi
	zone_json=$(json_null_or_string "$zone")
	if firewall_changes_pending; then
		release_wan_log_lock
		logger -t fwlive "WAN log baseline restore skipped: firewall changes pending" 2>/dev/null || true
		return 1
	fi
	if ! commit_wan_log_change "$zone" "$zone_json" "$baseline"; then
		release_wan_log_lock
		logger -t fwlive "WAN log baseline restore: commit gate failed" 2>/dev/null || true
		return 1
	fi
	rm -f "$path"
	release_wan_log_lock
	reload_firewall || logger -t fwlive "WAN log baseline restored; firewall reload failed" 2>/dev/null || true
	return 0
}

wan_filter_log_enabled() {
	log_val="$1"
	[ -n "$log_val" ] || return 1
	case "$log_val" in
		*[!0-9]*) return 1 ;;
	esac
	[ $((log_val & 1)) -ne 0 ]
}

wan_filter_log_target_value() {
	current="$1"
	if wan_filter_log_enabled "$current"; then
		printf '%s' "$current"
		return 0
	fi
	case "$current" in
		''|*[!0-9]*)
			printf '1'
			;;
		*)
			printf '%d' $((current | 1))
			;;
	esac
}

# Clear filter-log bit 0 only. Prints remaining value, or empty when the option
# should be deleted (no bits left / non-numeric / already empty).
wan_filter_log_clear_value() {
	current="$1"
	case "$current" in
		''|*[!0-9]*)
			printf ''
			return 0
			;;
	esac
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
	val=$(cat "$path" 2>/dev/null)
	[ -n "$val" ] && [ "$val" != 'none' ]
}

check_nf_log_ipv4() {
	read_nf_log_backend "$NF_LOG_IPV4"
}

check_nf_log_ipv6() {
	read_nf_log_backend "$NF_LOG_IPV6"
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

collect_logging_blockers() {
	zone="$1"
	LOGGING_BLOCKERS=''

	[ -n "$zone" ] || logging_blockers_append 'no_wan_zone'
	check_nf_log_ipv4 || logging_blockers_append 'nf_log_ipv4_missing'
	check_nf_log_ipv6 || logging_blockers_append 'nf_log_ipv6_missing'
	# rpcd/fwlive run_with_timeout fail-closes to 127 without timeout (#229): surface as blocker.
	command -v timeout >/dev/null 2>&1 || logging_blockers_append 'timeout_missing'

	[ -n "$LOGGING_BLOCKERS" ] || return 0
	return 1
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
	zone=$(find_wan_zone_section)
	log_val=$(wan_zone_log_value "$zone")
	limit_val=$( [ -n "$zone" ] && uci -q get "firewall.${zone}.log_limit" 2>/dev/null )
	wan_log=false
	if wan_filter_log_enabled "$log_val"; then
		wan_log=true
	fi

	nf4=false
	check_nf_log_ipv4 && nf4=true
	nf6=false
	check_nf_log_ipv6 && nf6=true

	collect_logging_blockers "$zone"
	blockers="[${LOGGING_BLOCKERS:-}]"

	ready=false
	if [ -n "$zone" ] && [ "$wan_log" = true ] && [ "$nf4" = true ] && [ "$nf6" = true ]; then
		ready=true
	fi

	zone_json=$(json_null_or_string "$zone")
	limit_json=$(json_null_or_string "$limit_val")

	printf '{"wan_zone":%s,"wan_log":%s,"wan_log_limit":%s,"nf_log_ipv4":%s,"nf_log_ipv6":%s,"ready":%s,"blockers":%s}' \
		"$zone_json" "$wan_log" "$limit_json" "$nf4" "$nf6" "$ready" "$blockers"
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
	# Refuse to publish unrelated staged firewall deltas (issue #168).
	if firewall_changes_pending; then
		logger -t fwlive "WAN log rollback skipped: firewall changes pending" 2>/dev/null || true
		return 1
	fi
	if [ -z "$previous" ]; then
		uci -q delete "firewall.${zone}.log" 2>/dev/null || true
	else
		uci -q set "firewall.${zone}.log=${previous}" 2>/dev/null || true
	fi
	uci commit firewall 2>/dev/null || true
}

# Stage + commit the WAN log bit. Caller MUST hold the logging lock; this
# closes the read->compute->set->commit window so a concurrent toggle cannot
# commit between our read and our write (no lost update / no stale overwrite).
#
# TOCTOU hardening (#191): UCI staging is global per config file, so a
# non-cooperating writer (another admin's `uci set`, the LuCI firewall page)
# can stage a delta AFTER the toggle's early firewall_changes_pending check.
# Staging and committing therefore live INSIDE this function — the only path
# to `uci commit firewall` in the toggle flow, so callers cannot bypass it —
# gated by:
#   1. a pending re-check BEFORE our own delta exists in staging (foreign-only);
#   2. a post-stage re-check AFTER our set/delete: if anything besides our
#      log option is staged, undo our staging (restore the pre-stage committed
#      value) and abort without commit — foreign staging stays intact.
# Residual window: a writer that stages between the post-stage check and
# `uci commit` can still ride along; post-commit verification detects a
# mismatched log bit. Same-option races (another writer also staging
# firewall.<wan>.log) are not distinguishable in the changes list.
# The caller-reported error is firewall_changes_pending: the LuCI view already
# maps it to the accurate "another change is staged" notice.
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

	# Last-moment guard (#191): runs before OUR delta is staged, so a
	# non-empty changes list here can only be a foreign writer's race.
	if firewall_changes_pending; then
		logger -t fwlive "WAN log toggle aborted at commit gate: firewall changes staged by another writer" 2>/dev/null || true
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"firewall_changes_pending"}' "$zone_json"
		return 1
	fi

	# Staging is empty here — capture the committed value so a post-stage
	# foreign race can undo our delta without `uci revert firewall`.
	previous=$(wan_zone_log_value "$zone")

	if [ -n "$target" ]; then
		if ! uci set "firewall.${zone}.log=${target}"; then
			printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"uci_set_failed"}' "$zone_json"
			return 1
		fi
	else
		if ! uci delete "firewall.${zone}.log"; then
			printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"uci_delete_failed"}' "$zone_json"
			return 1
		fi
	fi

	# Post-stage guard (#191): anything besides our log option is foreign.
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
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"firewall_changes_pending"}' "$zone_json"
		return 1
	fi

	if ! uci commit firewall; then
		# Drop our staged log delta so a later toggle is not stuck on
		# firewall_changes_pending from this package's own orphaned write —
		# but ONLY when nothing foreign is staged: `uci revert firewall` is
		# config-wide (uci has no option-level revert), and reverting would
		# clobber a concurrent writer's uncommitted delta (CodeRabbit/luna
		# fold, #191). With foreign staging present, leave it and warn.
		_staged=$(uci -q changes firewall 2>/dev/null || true)
		_total=$(printf '%s\n' "$_staged" | grep -c . 2>/dev/null || true)
		_ours=$(wan_log_count_our_staged_lines "$zone" "$_staged")
		if [ "${_total:-0}" -gt 0 ] && [ "${_total:-0}" -eq "${_ours:-0}" ]; then
			uci -q revert firewall 2>/dev/null || true
		else
			logger -t fwlive "WAN log commit failed with foreign changes staged — not reverting (uci_commit_failed)" 2>/dev/null || true
		fi
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"uci_commit_failed"}' "$zone_json"
		return 1
	fi

	# Post-commit verification (#191): confirm the committed config really
	# carries what we wrote (empty target = option must now be gone/empty).
	# A mismatch means another writer overtook the commit: warn loudly but do
	# NOT blind-revert (that would destroy unrelated committed data); the
	# reload-failure rollback path still guards the ordinary failure case.
	if ! verify_wan_log_commit "$zone" "$target"; then
		logger -t fwlive "WAN log post-commit verify FAILED: wrote '${target:-<deleted>}', read back differs" 2>/dev/null || true
	fi
	return 0
}

# Firewall reload + best-effort UCI rollback on reload failure. The reload
# itself runs WITHOUT the logging lock (it can take seconds and a held lock
# would block a concurrent toggle until the holder exits — BusyBox flock has
# no -w timeout).
#
# The ROLLBACK re-acquires the lock (luna fold 2026-08-10): read->compare->
# restore is only atomic when no other writer can commit between the read and
# the restore. All writers hold the same flock, so re-acquiring it makes the
# decision-and-restore a serialized unit. The lock is held only for the few
# uci commands of the restore (short critical section), never across the
# reload. If the lock cannot be re-acquired, skip the rollback (report the
# reload failure; the next toggle self-corrects).
reload_and_report_wan_log() {
	zone="$1"
	previous="$2"
	committed="$3"
	fail_msg="$4"
	success_msg="$5"
	zone_json="$6"

	if ! reload_firewall; then
		# Re-acquire the logging lock so the rollback decision is atomic
		# against concurrent toggles (no check-then-restore race).
		if acquire_wan_log_lock; then
			now="$(wan_zone_log_value "$zone")"
			if [ "$now" = "$committed" ]; then
				# Current value is still what THIS caller committed — restore
				# the pre-commit value. (If a concurrent toggle committed the
				# same value, the toggle is idempotent: the state intent is
				# identical, so restoring previous is the correct rollback.)
				if restore_wan_zone_log "$zone" "$previous"; then
					logger -t fwlive "$fail_msg" 2>/dev/null || true
				else
					logger -t fwlive "Firewall reload failed; WAN log rollback skipped (pending changes or restore failed)" 2>/dev/null || true
				fi
			else
				# A concurrent toggle changed the value after our commit; do
				# not clobber it. Log the divergence and leave the newer value.
				logger -t fwlive "Firewall reload failed; WAN log changed concurrently — rollback skipped" 2>/dev/null || true
			fi
			release_wan_log_lock
		else
			# Cannot re-acquire the lock: skip the rollback, report the
			# reload failure. The next toggle self-corrects the state.
			logger -t fwlive "Firewall reload failed; rollback lock unavailable — skipped" 2>/dev/null || true
		fi
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"firewall_reload_failed"}' "$zone_json"
		return 0
	fi
	logger -t fwlive "$success_msg" 2>/dev/null || true
	printf '{"ok":true,"changed":true,"wan_zone":%s}' "$zone_json"
	return 0
}

enable_wan_logging() {
	zone=$(find_wan_zone_section)
	if [ -z "$zone" ]; then
		printf '{"ok":false,"changed":false,"wan_zone":null,"error":"no_wan_zone"}'
		return 0
	fi

	zone_json=$(json_null_or_string "$zone")

	if ! check_nf_log_ipv4 || ! check_nf_log_ipv6; then
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"nf_log_missing"}' "$zone_json"
		return 0
	fi

	# Locked critical section: read->compute->stage->commit for firewall.<zone>.log.
	# The log bit is re-read AFTER acquiring the lock so the target is computed
	# from the latest committed value; a concurrent toggle cannot interleave.
	# Staging + commit live inside commit_wan_log_change behind its last-moment
	# firewall_changes_pending re-check (#191): a foreign writer racing between
	# the early check above and the commit aborts the toggle instead of having
	# its half-finished delta published with our log bit.
	if ! acquire_wan_log_lock; then
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"lock_failed"}' "$zone_json"
		return 0
	fi

	if firewall_changes_pending; then
		release_wan_log_lock
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"firewall_changes_pending"}' "$zone_json"
		return 0
	fi

	current=$(wan_zone_log_value "$zone")
	if wan_filter_log_enabled "$current"; then
		release_wan_log_lock
		printf '{"ok":true,"changed":false,"wan_zone":%s}' "$zone_json"
		return 0
	fi

	if ! maybe_snapshot_wan_log_baseline "$zone"; then
		release_wan_log_lock
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"baseline_snapshot_failed"}' "$zone_json"
		return 0
	fi

	target=$(wan_filter_log_target_value "$current")
	if ! commit_wan_log_change "$zone" "$zone_json" "$target"; then
		release_wan_log_lock
		return 0
	fi
	release_wan_log_lock

	reload_and_report_wan_log "$zone" "$current" "$target" \
		'Firewall reload failed after enable; reverted UCI WAN log' \
		'WAN zone logging enabled' \
		"$zone_json"
	return 0
}

disable_wan_logging() {
	zone=$(find_wan_zone_section)
	if [ -z "$zone" ]; then
		printf '{"ok":false,"changed":false,"wan_zone":null,"error":"no_wan_zone"}'
		return 0
	fi

	zone_json=$(json_null_or_string "$zone")

	# Locked critical section: read->compute->stage->commit for firewall.<zone>.log.
	# The log bit is re-read AFTER acquiring the lock so the target is computed
	# from the latest committed value; a concurrent toggle cannot interleave.
	# Staging + commit live inside commit_wan_log_change behind its last-moment
	# firewall_changes_pending re-check (#191): a foreign writer racing between
	# the early check above and the commit aborts the toggle instead of having
	# its half-finished delta published with our log bit.
	if ! acquire_wan_log_lock; then
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"lock_failed"}' "$zone_json"
		return 0
	fi

	if firewall_changes_pending; then
		release_wan_log_lock
		printf '{"ok":false,"changed":false,"wan_zone":%s,"error":"firewall_changes_pending"}' "$zone_json"
		return 0
	fi

	current=$(wan_zone_log_value "$zone")
	if [ -z "$current" ] || ! wan_filter_log_enabled "$current"; then
		release_wan_log_lock
		printf '{"ok":true,"changed":false,"wan_zone":%s}' "$zone_json"
		return 0
	fi

	target=$(wan_filter_log_clear_value "$current")
	if ! commit_wan_log_change "$zone" "$zone_json" "$target"; then
		release_wan_log_lock
		return 0
	fi
	release_wan_log_lock

	reload_and_report_wan_log "$zone" "$current" "$target" \
		'Firewall reload failed after disable; reverted UCI WAN log' \
		'WAN zone logging disabled' \
		"$zone_json"
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
