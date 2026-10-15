#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com>
#
# Layer 1 adaptive poll cap. Sourced by rpcd/fwlive.
# Always on unless test/triage override (no UCI / no product config):
#   FWLIVE_ADAPTIVE=0|false|off|no (case-insensitive words)
#   or sentinel ${FWLIVE_ADAPTIVE_OFF_FILE:-<state-dir>/fwlive-adaptive-off}
#   (default under /var/run next to state — not world-writable /tmp).
#
# State: ${FWLIVE_ADAPTIVE_STATE_FILE:-/var/run/fwlive-state.json}
# Lock: sibling ${FWLIVE_ADAPTIVE_LOCK_FILE:-$STATE.lock} — never the JSON
# inode (atomic mv replaces that inode; locking it would not serialize writers).
# Lock covers only short update — never held across ubus/filter work.
# Hot-path budget: ≤1 flock exec and ≤1 find exec per record
# (directory safety checked once before the lock is opened; the state write
# relies on that check).
# Release flock by closing the fd when the subshell exits (no flock -u).
# /proc/uptime + state I/O use shell builtins/redirects (no sed/cat/jsonfilter
# on the adaptive path). Fail-open on missing flock, a busy lock, or corrupt
# state. Fail-closed when the state directory check fails, or when the lock
# file cannot be created, opened, or is not a regular writable file (skip the
# write; do not record unlocked). Lock-busy ⇒ unlocked last-writer-wins is
# acceptable (state stays one valid JSON line; ordering is not guaranteed).
# Failed ubus log.read must NOT call record() — a ~0 ms failure is not "cold"
# health and must not clear an existing hot/shed cap.
# Outside the measured duration interval: plan (pre), record/merge (post).
# messages_received is supplied by the filter-side jsonfilter enumeration;
# failed reads still use 0 without scanning the response in ash.

FWLIVE_ADAPTIVE_STATE_FILE="${FWLIVE_ADAPTIVE_STATE_FILE:-/var/run/fwlive-state.json}"
# Optional overrides; when unset, lock/off paths are siblings of the current state.
# Do not bake STATE into LOCK/OFF at source time — tests may relocate STATE after source.

# Bucket thresholds (processing duration, ms).
FWLIVE_ADAPTIVE_COLD_MS=100
FWLIVE_ADAPTIVE_COOL_MS=200
FWLIVE_ADAPTIVE_WARM_MS=800
FWLIVE_ADAPTIVE_HOT_EXIT_MS=500
FWLIVE_ADAPTIVE_COOL_CAP=250
FWLIVE_ADAPTIVE_HOT_FLOOR=250
FWLIVE_ADAPTIVE_WARM_MIN=50
FWLIVE_ADAPTIVE_COOLDOWN_WARM_CS=300
FWLIVE_ADAPTIVE_COOLDOWN_HOT_CS=600
FWLIVE_ADAPTIVE_COOLDOWN_PROBE_CS=300

fwlive_adaptive_lock_path() {
	if [ -n "${FWLIVE_ADAPTIVE_LOCK_FILE:-}" ]; then
		printf '%s\n' "$FWLIVE_ADAPTIVE_LOCK_FILE"
	else
		printf '%s\n' "${FWLIVE_ADAPTIVE_STATE_FILE}.lock"
	fi
}

fwlive_adaptive_off_path() {
	if [ -n "${FWLIVE_ADAPTIVE_OFF_FILE:-}" ]; then
		printf '%s\n' "$FWLIVE_ADAPTIVE_OFF_FILE"
	else
		_dir=${FWLIVE_ADAPTIVE_STATE_FILE%/*}
		[ "$_dir" = "$FWLIVE_ADAPTIVE_STATE_FILE" ] && _dir=/var/run
		printf '%s\n' "$_dir/fwlive-adaptive-off"
	fi
}

fwlive_adaptive_enabled() {
	case "${FWLIVE_ADAPTIVE:-1}" in
		0|[fF][aA][lL][sS][eE]|[oO][fF][fF]|[nN][oO]) return 1 ;;
	esac
	[ -e "$(fwlive_adaptive_off_path)" ] && return 1
	return 0
}

fwlive_adaptive_atoi() {
	# Decimal int from digit string — avoids $((08)) octal errors under ash.
	_s=$1
	_n=0
	case "$_s" in ''|*[!0-9]*) printf '0\n'; return 0 ;; esac
	while [ -n "$_s" ]; do
		_d=${_s%"${_s#?}"}
		_s=${_s#?}
		_n=$((_n * 10 + _d))
	done
	printf '%s\n' "$_n"
}

fwlive_adaptive_clock_cs() {
	# /proc/uptime centiseconds — BusyBox date lacks %N. Builtin read only.
	_up=
	read -r _up _ </proc/uptime 2>/dev/null || {
		printf '%s\n' 0
		return 0
	}
	_sec=${_up%.*}
	_frac=${_up#*.}
	[ "$_frac" = "$_up" ] && _frac=0
	# At most two decimal digits (centiseconds), no cut(1).
	case "$_frac" in
		'') _frac=0 ;;
		?) _frac="${_frac}0" ;;
		??) ;;
		*)
			_a=${_frac%${_frac#?}}
			_r=${_frac#?}
			_b=${_r%${_r#?}}
			_frac="${_a}${_b}"
			;;
	esac
	_sec=$(fwlive_adaptive_atoi "$_sec")
	_frac=$(fwlive_adaptive_atoi "$_frac")
	printf '%s\n' $((_sec * 100 + _frac))
}

fwlive_adaptive_state_dir_ok() {
	_path=$FWLIVE_ADAPTIVE_STATE_FILE
	_dir=${_path%/*}
	[ -n "$_dir" ] || return 1
	[ "$_dir" = "$_path" ] && return 1
	[ -L "$_dir" ] && return 1
	[ -d "$_dir" ] || return 1
	# shellcheck disable=SC3067
	[ -O "$_dir" ] || return 1
	# Same group/other-write refuse as wan_log_lock_dir_safe: the
	# PID-predictable ${STATE}.tmp.$$ + mv is a symlink-write if the
	# dir is world-writable.
	_writable=$(find "$_dir" -prune \( -perm -020 -o -perm -002 \) -print 2>/dev/null) || return 1
	[ -z "$_writable" ]
}

# Extract a decimal integer field from a one-line JSON object (builtin only).
# Prints default ($2) when missing/corrupt.
fwlive_adaptive_json_int() {
	_blob=$1
	_key=$2
	_def=$3
	case "$_blob" in
		*"\"$_key\""*) ;;
		*) printf '%s\n' "$_def"; return 0 ;;
	esac
	_rest=${_blob#*"\"$_key\""}
	_rest=${_rest#*:}
	while case "$_rest" in ' '*) true;; *) false;; esac; do
		_rest=${_rest# }
	done
	_num=
	while :; do
		case "$_rest" in
			'') break ;;
		esac
		_c=${_rest%"${_rest#?}"}
		case "$_c" in
			[0-9]) _num="${_num}${_c}"; _rest=${_rest#?} ;;
			*) break ;;
		esac
	done
	case "$_num" in
		''|*[!0-9]*) printf '%s\n' "$_def" ;;
		*) printf '%s\n' "$_num" ;;
	esac
}

# Extract a lowercase alpha string field.
fwlive_adaptive_json_str() {
	_blob=$1
	_key=$2
	_def=$3
	case "$_blob" in
		*"\"$_key\""*) ;;
		*) printf '%s\n' "$_def"; return 0 ;;
	esac
	_rest=${_blob#*"\"$_key\""}
	_rest=${_rest#*:}
	while case "$_rest" in ' '*) true;; *) false;; esac; do
		_rest=${_rest# }
	done
	case "$_rest" in
		\"*) _rest=${_rest#\"}; _val=${_rest%%\"*} ;;
		*) printf '%s\n' "$_def"; return 0 ;;
	esac
	case "$_val" in
		*[!a-z]*|'') printf '%s\n' "$_def" ;;
		*) printf '%s\n' "$_val" ;;
	esac
}

# Print: duration_ms limit bucket warm_halved shed completed_cs
fwlive_adaptive_read_state() {
	_d=0
	_l="${POLL_LINES_MAX:-2000}"
	_b=cold
	_w=0
	_s=0
	_c=0
	_raw=
	if [ -f "$FWLIVE_ADAPTIVE_STATE_FILE" ]; then
		IFS= read -r _raw <"$FWLIVE_ADAPTIVE_STATE_FILE" || _raw=
	fi
	if [ -n "$_raw" ]; then
		_d=$(fwlive_adaptive_json_int "$_raw" duration_ms 0)
		_l=$(fwlive_adaptive_json_int "$_raw" limit "${POLL_LINES_MAX:-2000}")
		_b=$(fwlive_adaptive_json_str "$_raw" bucket cold)
		_w=$(fwlive_adaptive_json_int "$_raw" warm_halved 0)
		_s=$(fwlive_adaptive_json_int "$_raw" shed 0)
		_c=$(fwlive_adaptive_json_int "$_raw" completed_cs 0)
		case "$_w" in 0|1) ;; *) _w=0 ;; esac
		case "$_s" in 0|1) ;; *) _s=0 ;; esac
	fi
	printf '%s %s %s %s %s %s\n' "$_d" "$_l" "$_b" "$_w" "$_s" "$_c"
}

fwlive_adaptive_write_state() {
	_d=$1
	_l=$2
	_b=$3
	_w=$4
	_s=$5
	_c=$6
	# Refuse to follow a symlinked state path (same discipline as logging.lock).
	[ -L "$FWLIVE_ADAPTIVE_STATE_FILE" ] && return 0
	_tmp="${FWLIVE_ADAPTIVE_STATE_FILE}.tmp.$$"
	(
		umask 077
		printf '{"duration_ms":%s,"limit":%s,"bucket":"%s","warm_halved":%s,"shed":%s,"completed_cs":%s}\n' \
			"$_d" "$_l" "$_b" "$_w" "$_s" "$_c" >"$_tmp" 2>/dev/null
	) || {
		rm -f "$_tmp"
		return 0
	}
	mv -f "$_tmp" "$FWLIVE_ADAPTIVE_STATE_FILE" 2>/dev/null || rm -f "$_tmp"
	return 0
}

# One non-blocking flock on the persistent sibling lock file.
# Fail-open only when flock is missing or the lock is busy (unlocked
# last-writer-wins: valid one-line JSON; ordering is not guaranteed).
# Fail-closed — skip the body — when the state directory is unsafe, or the
# lock cannot be created, opened, or is not a regular writable file.
# Release by exiting the subshell (closes fd 9) — no flock -u.
# Probe fd 9 first so a set -eu caller does not abort.
fwlive_adaptive_with_lock() {
	fwlive_adaptive_state_dir_ok || return 0
	if ! command -v flock >/dev/null 2>&1; then
		"$@"
		return $?
	fi
	_lock=$(fwlive_adaptive_lock_path)
	if [ -L "$_lock" ]; then
		return 0
	fi
	# Create lock at 0600 (world-readable fd can take LOCK_EX).
	if [ ! -e "$_lock" ]; then
		if ! ( umask 077; : >"$_lock" ) 2>/dev/null; then
			return 0
		fi
	fi
	# Only a regular file: a writable FIFO would block the fd-9 open below.
	if [ ! -f "$_lock" ] || [ ! -w "$_lock" ]; then
		return 0
	fi
	# Probe in a subshell first: a failed fd-9 redirection aborts a POSIX
	# non-interactive shell (set -eu) before any fallback can run.
	if ! ( exec 9>>"$_lock" ) 2>/dev/null; then
		return 0
	fi
	(
		if flock -n 9; then
			"$@"
			exit $?
		fi
		"$@"
	) 9>>"$_lock"
	return $?
}

fwlive_adaptive_bucket_for_ms() {
	_ms=$1
	case "$_ms" in ''|*[!0-9]*) _ms=0 ;; esac
	if [ "$_ms" -lt "$FWLIVE_ADAPTIVE_COLD_MS" ]; then
		printf '%s\n' cold
	elif [ "$_ms" -lt "$FWLIVE_ADAPTIVE_COOL_MS" ]; then
		printf '%s\n' cool
	elif [ "$_ms" -le "$FWLIVE_ADAPTIVE_WARM_MS" ]; then
		printf '%s\n' warm
	else
		printf '%s\n' hot
	fi
}

# Clamp $_limit into [1, min($1, $2)].
fwlive_adaptive_clamp() {
	[ "$_limit" -gt "$1" ] && _limit=$1
	[ "$_limit" -gt "$2" ] && _limit=$2
	[ "$_limit" -lt 1 ] && _limit=1
	return 0
}

# Double $_limit. A base below 1 becomes $1; the result is capped at $1.
fwlive_adaptive_double() {
	[ "$_limit" -lt 1 ] && _limit=$1
	_limit=$((_limit * 2))
	[ "$_limit" -gt "$1" ] && _limit=$1
	return 0
}

# Args: requested_limit duration_ms prev_limit prev_bucket prev_warm
#       prev_completed_cs planning
# Prints next limit. A full-sized cold sample may retain one upward probe
# above the number of lines served; planning then holds that retained probe.
fwlive_adaptive_compute_limit() {
	_req=$1
	_ms=$2
	_prev_l=$3
	_prev_b=$4
	_prev_w=$5
	_prev_c=$6
	_planning=${7:-0}
	_max="${POLL_LINES_MAX:-2000}"
	_now=$(fwlive_adaptive_clock_cs)
	_bucket=$(fwlive_adaptive_bucket_for_ms "$_ms")
	_limit=$_max
	_cd=0
	_probe=0

	case "$_prev_b" in
		hot) _cd=$FWLIVE_ADAPTIVE_COOLDOWN_HOT_CS ;;
		warm) _cd=$FWLIVE_ADAPTIVE_COOLDOWN_WARM_CS ;;
	esac
	_elapsed=$((_now - _prev_c))

	if [ "$_cd" -gt 0 ] && [ "$_prev_c" -gt 0 ] && \
		[ "$_elapsed" -lt "$_cd" ]; then
		if [ "$_ms" -gt "$FWLIVE_ADAPTIVE_HOT_EXIT_MS" ] || \
			[ "$_bucket" = hot ]; then
			_limit=$_prev_l
			fwlive_adaptive_clamp "$_req" "$_max"
			printf '%s\n' "$_limit"
			return 0
		fi
	fi

	# Once a hot/warm cooldown expires, deliberately test a larger request.
	# Planning raises the next request. Recording raises the retained limit
	# only when that probe completed below the hot-exit threshold. A still-hot
	# probe falls through to the hot floor below.
	if [ "$_cd" -gt 0 ] && [ "$_prev_c" -gt 0 ] && \
		[ "$_elapsed" -ge "$_cd" ]; then
		_healthy=0
		if [ "$_ms" -le "$FWLIVE_ADAPTIVE_HOT_EXIT_MS" ] && \
			[ "$_bucket" != hot ]; then
			_healthy=1
		fi
		if [ "$_planning" = 1 ] || [ "$_healthy" = 1 ]; then
			_limit=$_prev_l
			fwlive_adaptive_double "$_max"
			fwlive_adaptive_clamp "$_req" "$_max"
			printf '%s\n' "$_limit"
			return 0
		fi
	fi

	case "$_bucket" in
		cold)
			_base=$_prev_l
			[ "$_base" -lt 1 ] && _base=$_max
			if [ "$_planning" = 1 ]; then
				# Keep a cold probe at the limit that was actually retained.
				_limit=$_base
			elif [ "$_req" -ge "$_base" ]; then
				# A full-sized cold sample earns one doubling, not a jump
				# from the 250-line floor straight to the maximum.
				_limit=$_base
				fwlive_adaptive_double "$_max"
				[ "$_prev_l" -ge 1 ] && _probe=1
			else
				# A short cold sample does not prove the larger request is safe.
				_limit=$_base
			fi
			;;
		cool)
			# A healthy cooldown probe may retain its raised limit for the
			# short probe window. Ordinary cool samples still use the fixed
			# 250-line cap.
			if [ "$_prev_l" -gt "$FWLIVE_ADAPTIVE_COOL_CAP" ] && \
				[ "$_prev_c" -gt 0 ] && \
				[ "$_elapsed" -lt "$FWLIVE_ADAPTIVE_COOLDOWN_PROBE_CS" ]; then
				_limit=$_prev_l
			else
				_limit=$FWLIVE_ADAPTIVE_COOL_CAP
			fi
			;;
		warm)
			if [ "$_prev_w" = 1 ] && [ "$_prev_b" = warm ]; then
				_limit=$_prev_l
			else
				_base=$_prev_l
				[ "$_base" -lt 1 ] && _base=$_max
				_limit=$((_base / 2))
				[ "$_limit" -lt "$FWLIVE_ADAPTIVE_WARM_MIN" ] && \
					_limit=$FWLIVE_ADAPTIVE_WARM_MIN
			fi
			;;
		hot) _limit=$FWLIVE_ADAPTIVE_HOT_FLOOR ;;
	esac

	if [ "$_probe" = 1 ]; then
		fwlive_adaptive_clamp "$_max" "$_max"
	else
		fwlive_adaptive_clamp "$_req" "$_max"
	fi
	printf '%s\n' "$_limit"
}

# Apply cap using *previous* poll duration. Prints: lines shed_flag bucket
# Unlocked read (stale OK) — flock reserved for record().
fwlive_adaptive_plan() {
	_req=$1
	_max="${POLL_LINES_MAX:-2000}"
	if ! fwlive_adaptive_enabled; then
		_l=$_req
		[ "$_l" -gt "$_max" ] && _l=$_max
		printf '%s 0 off\n' "$_l"
		return 0
	fi
	# shellcheck disable=SC2046
	set -- $(fwlive_adaptive_read_state)
	_d=$1
	_prev_l=$2
	_b=$3
	_prev_w=$4
	_s=$5
	_prev_c=$6
	_l=$(fwlive_adaptive_compute_limit "$_req" "$_d" "$_prev_l" "$_b" "$_prev_w" "$_prev_c" 1)
	_nb=$(fwlive_adaptive_bucket_for_ms "$_d")
	_shed=0
	[ "$_nb" = hot ] && _shed=1
	[ "$_s" = 1 ] && [ "$_b" = hot ] && _shed=1
	printf '%s %s %s\n' "$_l" "$_shed" "$_nb"
}

fwlive_adaptive__record_body() {
	_ms=$1
	_served=$2
	# shellcheck disable=SC2046
	set -- $(fwlive_adaptive_read_state)
	_prev_l=$2
	_prev_b=$3
	_prev_w=$4
	_prev_c=$6
	_bucket=$(fwlive_adaptive_bucket_for_ms "$_ms")
	_now=$(fwlive_adaptive_clock_cs)
	_limit=$(fwlive_adaptive_compute_limit "$_served" "$_ms" "$_prev_l" "$_prev_b" "$_prev_w" "$_prev_c")
	_warm=0
	_shed=0
	case "$_bucket" in
		warm) _warm=1 ;;
		hot) _shed=1 ;;
	esac
	fwlive_adaptive_write_state "$_ms" "$_limit" "$_bucket" "$_warm" "$_shed" "$_now"
}

fwlive_adaptive_record() {
	_ms=$1
	_served=$2
	fwlive_adaptive_enabled || return 0
	fwlive_adaptive_with_lock fwlive_adaptive__record_body "$_ms" "$_served"
}

fwlive_adaptive_is_hot() {
	fwlive_adaptive_enabled || return 1
	# shellcheck disable=SC2046
	set -- $(fwlive_adaptive_read_state)
	[ "$5" = 1 ] && return 0
	[ "$3" = hot ] && return 0
	return 1
}

# Merge adaptive siblings into a JSON object ending with }. A successful
# filter already carries the exact messages_received count; do not append a
# duplicate key in that case.
# Args: json_body shed_flag limit truncated messages_received success_flag
fwlive_adaptive_merge_reply() {
	_body=$1
	_shed=$2
	_limit=$3
	_trunc=$4
	_msgs=$5
	_success=${6:-0}
	_adapt=1
	fwlive_adaptive_enabled || _adapt=0
	case "$_body" in
		'{}') _sep= ;;
		'{"log":[]'*|*'],"messages_received":'*)
			case "$_body" in
				*\}) _sep=, ;;
				*) printf '%s' "$_body"; return 0 ;;
			esac
			;;
		*) printf '%s' "$_body"; return 0 ;;
	esac
	_base=${_body%\}}
	_tail="\"adaptive\":$_adapt"
	case "$_body" in
		*',"messages_received":'*) ;;
		*) _tail="${_tail},\"messages_received\":$_msgs" ;;
	esac
	if [ "$_adapt" = 1 ]; then
		if [ "$_success" = 1 ]; then
			_tail="${_tail},\"effective_limit\":$_limit"
		fi
		_tail="${_tail},\"truncated\":$_trunc"
		if [ "$_shed" = 1 ]; then
			_tail="${_tail},\"shed\":{\"level\":\"hot\",\"limit\":$_limit}"
		fi
	fi
	printf '%s%s%s}' "$_base" "$_sep" "$_tail"
}
