#!/bin/sh

#!/bin/sh
# status.sh — read-only bridge between sing-box's Clash API and LuCI.
#
# Modes:
#   status.sh [api_addr] status         Summary JSON for the dashboard.
#   status.sh [api_addr] servers        Per-server latency array.
#   status.sh [api_addr] connections [N]  Top-N busiest flows.
#   status.sh [api_addr] test <name>    Single server latency probe.
#
# All output is single-line JSON. Latency probes use the real VLESS chain via
# /proxies/<tag>/delay; if the daemon is down or unreachable the fields
# degrade gracefully (status="offline", latency=0) instead of erroring.
# Depends: wget, pgrep, ps, ip, jq (optional, used for URL-encoding and
# connection extraction).

CLASH_API="${1:-127.0.0.1:9090}"
MODE="${2:-status}"
TARGET="${3:-}"

# http_get URL [timeout]
#
# Fetch a single payload from the Clash API. The /traffic and /connections
# endpoints are streaming (server never closes the connection), which makes
# BusyBox wget hang forever. We work around this by forking wget to a temp
# file and killing it the moment we have any data (or after timeout).
http_get() {
	local url="$1"
	local max_wait="${2:-3}"
	local tmp="/tmp/sb-http.$$"

	wget -q -O "$tmp" -T "$max_wait" "$url" >/dev/null 2>&1 &
	local wpid=$!

	local i=0
	while [ "$i" -lt "$max_wait" ]; do
		kill -0 "$wpid" 2>/dev/null || break       # wget exited normally
		[ -s "$tmp" ] && { kill -9 "$wpid" 2>/dev/null; break; }
		sleep 1
		i=$((i + 1))
	done
	kill -9 "$wpid" 2>/dev/null
	wait "$wpid" 2>/dev/null

	cat "$tmp" 2>/dev/null
	rm -f "$tmp"
}

urlencode() {
	if [ -x /usr/bin/jq ]; then
		printf '%s' "$1" | jq -sRr @uri 2>/dev/null
	else
		# POSIX fallback — jq is a hard dependency, this only runs if removed.
		printf '%s' "$1" | awk '
			function ord(ch, k) {
				for (k = 0; k < 256; k++) if (sprintf("%c", k) == ch) return k
				return 63
			}
			{
				for (i = 1; i <= length($0); i++) {
					c = substr($0, i, 1)
					if (c ~ /[A-Za-z0-9._~-]/) printf "%s", c
					else printf "%%%02X", ord(c)
				}
			}'
	fi
}

is_running() {
	local pid
	pid=$(pgrep -f "sing-box run" 2>/dev/null | head -1)
	if [ -n "$pid" ]; then
		echo "true"
	else
		echo "false"
	fi
}

get_pid() {
	pgrep -f "sing-box run" 2>/dev/null | head -1
}

get_uptime() {
	local pid
	pid=$(get_pid)
	[ -z "$pid" ] && echo "0" && return
	# BusyBox ps has no -o etimes; fall back to /proc/$pid/stat start time.
	local start_ticks clk_hz now_ticks
	if [ -r "/proc/$pid/stat" ]; then
		# Field 22 of /proc/<pid>/stat is the process start time in clock ticks.
		start_ticks=$(awk '{print $22}' "/proc/$pid/stat" 2>/dev/null)
		clk_hz=$(getconf CLK_TCK 2>/dev/null || echo 100)
		now_ticks=$(awk '{print $1}' /proc/uptime 2>/dev/null | awk '{print int($1 * '"$clk_hz"')}')
		[ -n "$start_ticks" ] && [ -n "$now_ticks" ] && echo $(( (now_ticks - start_ticks) / clk_hz )) && return
	fi
	# Last resort: ps with etimes (GNU ps); empty if unsupported.
	local uptime_sec
	uptime_sec=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
	echo "${uptime_sec:-0}"
}

get_tun() {
	if ip link show sing-tun >/dev/null 2>&1; then
		echo "true"
	else
		echo "false"
	fi
}

get_active_server() {
	local result now
	result=$(http_get "http://$CLASH_API/proxies/auto")
	[ -z "$result" ] && { echo "unknown"; return; }
	# Clash returns "now": "name" — tolerate optional whitespace around the colon.
	now=$(echo "$result" | grep -oE '"now"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"now"//;s/^[[:space:]]*:[[:space:]]*//;s/^"//;s/"$//')
	echo "${now:-unknown}"
}

get_traffic() {
	local result
	result=$(http_get "http://$CLASH_API/traffic")
	if [ -z "$result" ]; then
		echo '{"up":0,"down":0}'
	else
		echo "$result"
	fi
}

get_conn_count() {
	local result
	result=$(http_get "http://$CLASH_API/connections")
	if [ -z "$result" ]; then
		echo "0"
	else
		echo "$result" | grep -o '"chains"' | wc -l
	fi
}

# Print the top N connections (default 25) as a compact JSON array.
# Fields: host, src, dest, network, chains, down, up.
# Sorted by total bytes (down+up) descending so the busiest flows land on top.
get_connections() {
	local max="${1:-25}"
	local result
	result=$(http_get "http://$CLASH_API/connections")
	if [ -z "$result" ]; then
		echo '[]'
		return
	fi

	if [ -x /usr/bin/jq ]; then
		echo "$result" | jq -c --argjson n "$max" '
			[.connections[]
			| {
				host:     (.metadata.host // .metadata.destinationIP // "?"),
				dest:     ((.metadata.destinationIP // "?") + ":" + (.metadata.destinationPort // "?")),
				src:      ((.metadata.sourceIP // "?") + ":" + (.metadata.sourcePort // "?")),
				network:  (.network // "?"),
				chains:   (.chains // []),
				down:     (.download // 0),
				up:       (.upload // 0),
				total:    ((.download // 0) + (.upload // 0))
			}]
			| sort_by(-.total)
			| .[0:$n]
		' 2>/dev/null
	else
		# No jq — emit minimal shape so the front-end still renders something.
		echo '[]'
	fi
}

get_servers_status() {
	. /lib/functions.sh
	config_load singbox

	local first=1
	printf '['
	config_foreach print_srv server
	printf ']'
}

print_srv() {
	local name="$1"
	local enabled tag server port
	config_get_bool enabled "$name" enabled 1
	config_get tag "$name" name
	config_get server "$name" server
	config_get port "$name" port

	[ "$enabled" = "1" ] || return

	[ "$first" = "1" ] && first=0 || printf ','

	local latency=0
	local status="offline"

	local delay
	delay=$(http_get "http://$CLASH_API/proxies/$(urlencode "$tag")/delay?url=http://www.gstatic.com/generate_204&timeout=5000" | grep -o '"delay":[0-9]*' | cut -d: -f2)

	if [ -n "$delay" ]; then
		latency="$delay"
		status="online"
	fi

	printf '{"name":"%s","server":"%s","port":"%s","status":"%s","latency":%s}' \
		"$tag" "$server" "$port" "$status" "$latency"
}

test_server() {
	local target="$1"
	[ -z "$target" ] && echo '{"status":"offline","latency":0,"error":"no server name"}' && return

	local delay
	delay=$(http_get "http://$CLASH_API/proxies/$(urlencode "$target")/delay?url=http://www.gstatic.com/generate_204&timeout=5000" | grep -o '"delay":[0-9]*' | cut -d: -f2)

	if [ -n "$delay" ]; then
		printf '{"name":"%s","status":"online","latency":%s}' "$target" "$delay"
	else
		printf '{"name":"%s","status":"offline","latency":0}' "$target"
	fi
}

case "$MODE" in
	status)
		running=$(is_running)
		pid=$(get_pid)
		uptime=$(get_uptime)
		tun=$(get_tun)
		active=$(get_active_server)
		traffic=$(get_traffic)
		connections=$(get_conn_count)

		printf '{"running":%s,"pid":"%s","uptime":%s,"tun":%s,"active_server":"%s","traffic":%s,"connections":%s}' \
			"$running" "$pid" "$uptime" "$tun" "$active" "$traffic" "$connections"
		;;
	servers)
		get_servers_status
		;;
	connections)
		get_connections "$TARGET"
		;;
	test)
		test_server "$TARGET"
		;;
	*)
		echo '{"error":"unknown mode"}'
		;;
esac
