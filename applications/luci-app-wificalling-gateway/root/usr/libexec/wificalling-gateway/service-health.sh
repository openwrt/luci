#!/bin/sh
# Service health snapshot for the LuCI status page: monitor/sing-box
# process state, generated-config validity and staleness (the admin edited
# UCI but the gateway was not restarted, so sing-box still runs the old
# config), nftables rule count, device count and a node health summary.
# Every check is defensive: a missing file or binary reports the state
# instead of failing the whole report.
#
# Usage: service-health.sh [output] [node-status]

set -eu

output=${1:-/var/run/wificalling-gateway/service-health.json}
node_status=${2:-/var/run/wificalling-gateway/node-status.json}
rundir=${WFC_RUNDIR:-/var/run/wificalling-gateway}
uci_config=${WFC_UCI_CONFIG:-/etc/config/wificalling-gateway}
tmp="${output}.tmp.$$"
trap 'rm -f "$tmp"' EXIT HUP INT TERM

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

now=$(date +%s)

# File age in seconds (busybox-safe; -1 when unknown).
file_age() {
	local f="$1"
	if [ -f "$f" ] && date -r "$f" +%s >/dev/null 2>&1; then
		echo $((now - $(date -r "$f" +%s)))
	else
		echo -1
	fi
}

monitor_pid=$(pgrep -f 'monitor-loop.sh' 2>/dev/null | head -n 1 || true)
monitor_running=0; [ -n "$monitor_pid" ] && monitor_running=1
# Match the gateway's own instance only: the temporary handshake-probe
# sing-box (node-health.sh) would otherwise light this up while the real
# one is dead, suppressing the alert this section exists for.
sb_pid=$(pgrep -f "sing-box run -c $rundir/sing-box.json" 2>/dev/null | head -n 1 || true)
sb_running=0; [ -n "$sb_pid" ] && sb_running=1

sb_config=0; sb_config_valid=0; sb_config_age=-1; sb_config_stale=0
if [ -f "$rundir/sing-box.json" ]; then
	sb_config=1
	sb_config_age=$(file_age "$rundir/sing-box.json")
	# True only when the UCI config changed AFTER the running proxy config
	# was generated - i.e. the admin edited nodes/devices but the gateway
	# was not restarted, so sing-box still runs the old config.  A large
	# config age by itself is normal: it is only regenerated on restart.
	if [ -f "$uci_config" ] \
		&& [ "$uci_config" -nt "$rundir/sing-box.json" ]; then
		sb_config_stale=1
	fi
	if command -v sing-box >/dev/null 2>&1; then
		if sing-box check -c "$rundir/sing-box.json" >/dev/null 2>&1; then
			sb_config_valid=1
		fi
	fi
fi

norm_fresh=0; norm_age=-1
if [ -f "$rundir/normalized.conf" ]; then
	norm_age=$(file_age "$rundir/normalized.conf")
	[ "$norm_age" -ge 0 ] && [ "$norm_age" -le 120 ] && norm_fresh=1
fi

nft_rules=0
if command -v nft >/dev/null 2>&1; then
	nft_rules=$(nft list ruleset 2>/dev/null | grep -c -E 'tproxy|redirect' || true)
fi

devices=$(grep -c '^device|' "$rundir/normalized.conf" 2>/dev/null || true)
[ -n "$devices" ] || devices=0

nodes_total=0; nodes_ok=0; nodes_down=0; nodes_unknown=0
if [ -f "$node_status" ]; then
	nodes_total=$(grep -o '"id":"' "$node_status" | wc -l)
	nodes_ok=$(grep -o '"state":"\(reachable\|tcp_reachable\|handshake_ok\)"' "$node_status" | wc -l)
	nodes_down=$(grep -o '"state":"\(unreachable\|handshake_failed\)"' "$node_status" | wc -l)
	nodes_unknown=$((nodes_total - nodes_ok - nodes_down))
	[ "$nodes_unknown" -lt 0 ] && nodes_unknown=0
fi

{
	printf '{"generated_at":%s,' "$now"
	printf '"monitor_running":%s,"singbox_running":%s,' "$monitor_running" "$sb_running"
	printf '"config_present":%s,"config_valid":%s,"config_age":%s,"config_stale":%s,' \
		"$sb_config" "$sb_config_valid" "$sb_config_age" "$sb_config_stale"
	printf '"norm_fresh":%s,"norm_age":%s,"nft_rules":%s,"devices":%s,' \
		"$norm_fresh" "$norm_age" "$nft_rules" "$devices"
	printf '"nodes":{"total":%s,"ok":%s,"down":%s,"unknown":%s}}\n' \
		"$nodes_total" "$nodes_ok" "$nodes_down" "$nodes_unknown"
} > "$tmp"
chmod 644 "$tmp"
mv "$tmp" "$output"
trap - EXIT HUP INT TERM
