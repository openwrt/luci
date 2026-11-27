#!/bin/sh
# tail-log.sh — print sing-box-related syslog entries from logd's ring buffer.
#
# Why this exists: sing-box logs to stderr (procd captures it to syslog
# via /dev/log). logd's ring buffer is the canonical source — it handles
# rotation itself, no SIGHUP games, no risk of crashing sing-box by
# signalling "reload" while it holds TUN.
#
# Usage:   tail-log.sh [lines] [level] [search]
#   lines   number of trailing lines to keep (default 200)
#   level   case-insensitive substring filter (info/warn/error/debug/fatal)
#   search  case-insensitive substring to match

LINES="${1:-200}"
LEVEL="${2:-}"
SEARCH="${3:-}"

# logread returns the entire system ring buffer; filter to sing-box lines.
# We match on "sing-box" because procd prefixes syslog entries with the
# daemon name:  "daemon.err sing-box[PID]: ..."
OUT=$(logread 2>/dev/null | grep -F 'sing-box')
[ -z "$OUT" ] && exit 0

# Keep the last N entries.
OUT=$(printf '%s\n' "$OUT" | tail -n "$LINES")

# Level filter — sing-box uses uppercase tokens (INFO/WARN/ERROR/DEBUG/FATAL).
if [ -n "$LEVEL" ] && [ "$LEVEL" != "all" ]; then
	OUT=$(printf '%s\n' "$OUT" | grep -i "$LEVEL")
fi

# Substring search.
if [ -n "$SEARCH" ]; then
	OUT=$(printf '%s\n' "$OUT" | grep -i "$SEARCH")
fi

printf '%s\n' "$OUT"
