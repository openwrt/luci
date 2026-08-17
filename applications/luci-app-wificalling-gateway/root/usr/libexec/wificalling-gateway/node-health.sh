#!/bin/sh
set -eu

nodes=${1:?node list required}
output=${2:-/var/run/wificalling-gateway/node-status.json}
tmp="${output}.tmp.$$"
trap 'rm -f "$tmp"' EXIT HUP INT TERM

sing_box=${WFC_SING_BOX:-/usr/bin/sing-box}

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# Real WireGuard handshake validation: run a temporary sing-box endpoint
# for the node and ask an echo service through it.  ICMP reachability says
# nothing about the WG tunnel, and a dead UDP path is exactly what the
# gateway must not route Wi-Fi Calling over.  The result is cached for 60 s
# (the monitor loop runs every 5 s and a handshake test takes seconds).
# Prints the verified exit IP on success.
# The reserved field is forwarded too: WARP-style endpoints need it and
# would otherwise fail every handshake.  Cache line 3 carries the failure
# reason (config_missing / timeout / unreachable) so the status export can
# tell a bad node apart from a dead server.
# A mkdir lock serializes the actual tests: the monitor loop can tick a
# fresh instance before this one finished (a handshake takes up to ~8 s,
# the loop ticks every 5 s), and two instances racing on the same probe
# port would hand each other the wrong exit IP.
wg_handshake_test() {
	local id=$1 server=$2 port=$3 cache cache_ts age lock lock_pid priv pub local_addr psk mtu reserved lport cfg pid ip reason probe_url
	cache="/tmp/wg-health-$id"
	if [ -f "$cache" ]; then
		cache_ts=$(sed -n '1p' "$cache" 2>/dev/null || echo 0)
		age=$(($(date +%s) - ${cache_ts:-0}))
		if [ "$age" -lt 60 ] 2>/dev/null; then
			[ "$(sed -n '2p' "$cache")" = ok ] || return 1
			sed -n '3p' "$cache"
			return 0
		fi
	fi
	lock=/tmp/wg-health.lock
	if ! mkdir "$lock" 2>/dev/null; then
		# A tick killed mid-test (SIGHUP/reboot) can leave the lock
		# behind.  If its holder is still alive, use the cache as-is
		# (even stale) instead of racing on the probe port; otherwise
		# take the lock over.
		lock_pid=$(cat "$lock/pid" 2>/dev/null || echo 0)
		if [ "${lock_pid:-0}" -gt 0 ] && kill -0 "$lock_pid" 2>/dev/null; then
			if [ -f "$cache" ] && [ "$(sed -n '2p' "$cache")" = ok ]; then
				sed -n '3p' "$cache"
				return 0
			fi
			return 1
		fi
		rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null || true
		mkdir "$lock" 2>/dev/null || return 1
	fi
	echo $$ > "$lock/pid"
	priv=$(uci -q get "wificalling-gateway.$id.private_key") || true
	pub=$(uci -q get "wificalling-gateway.$id.public_key") || true
	local_addr=$(uci -q get "wificalling-gateway.$id.local_address") || true
	if [ -z "$priv" ] || [ -z "$pub" ] || [ -z "$local_addr" ]; then
		printf '%s\nfailed\nconfig_missing\n' "$(date +%s)" > "$cache"
		rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null || true
		return 1
	fi
	psk=$(uci -q get "wificalling-gateway.$id.pre_shared_key") || true
	mtu=$(uci -q get "wificalling-gateway.$id.mtu") || true
	reserved=$(uci -q get "wificalling-gateway.$id.reserved") || true
	lport=$((19000 + (0x$(printf '%s' "$id" | md5sum | cut -c1-4) % 1000))) 2>/dev/null || lport=19099
	cfg="/tmp/wg-health-$id.json"
	# The probe config carries the WG private key and PSK: create it mode
	# 0600.  The probe itself runs in a subshell that owns its EXIT trap,
	# so the config/log cleanup stays local and the caller's trap is
	# untouched (this function is shared with node-test.sh, which has its
	# own cleanup).
	( umask 077; {
		printf '{"log":{"level":"warn"},"inbounds":[{"type":"http","tag":"probe","listen":"127.0.0.1","listen_port":%s}],' "$lport"
		printf '"endpoints":[{"type":"wireguard","tag":"wg","address":[%s],"private_key":%s,"peers":[{"address":%s,"port":%s,"public_key":%s,"allowed_ips":["0.0.0.0/0"]' \
			"\"$local_addr\"" "\"$priv\"" "\"$server\"" "$port" "\"$pub\""
		[ -n "$psk" ] && printf ',"pre_shared_key":"%s"' "$psk"
		[ -n "$reserved" ] && printf ',"reserved":[%s]' "$(printf '%s' "$reserved" | tr -d ' ')"
		printf '}],"mtu":%s}],"outbounds":[{"type":"direct","tag":"direct"}],"route":{"final":"wg"}}' "${mtu:-1420}"
	} > "$cfg"; )
	# Verify the tunnel with an echo service through the probe.  The URL is
	# UCI-configurable (main.probe_url) and HTTPS by default.  curl is a
	# hard dependency of the package and drives the probe via -x through
	# the http inbound; wget (http_proxy) is the fallback for stripped
	# images where /usr/bin/wget is busybox.
	# The whole probe runs in a subshell that owns its EXIT trap, so the
	# config/log cleanup stays local and the caller's trap is untouched
	# (this function is shared with node-test.sh).  The verdict is
	# produced inside the subshell too: the log is needed for the
	# timeout/unreachable distinction and is gone by the time the trap
	# fires.
	result=$( (
		trap 'rm -f "$cfg" /tmp/wg-health-$id.log' EXIT HUP INT TERM
		"$sing_box" run -c "$cfg" > /tmp/wg-health-$id.log 2>&1 &
		pid=$!
		sleep 2
		probe_url=$(uci -q get wificalling-gateway.main.probe_url) || true
		[ -n "$probe_url" ] || probe_url='https://ip-api.com/json/?fields=query'
		body=
		if command -v curl >/dev/null 2>&1; then
			body=$(curl -s --max-time 6 -x "http://127.0.0.1:$lport" "$probe_url" 2>/dev/null || true)
		else
			body=$(http_proxy="http://127.0.0.1:$lport" wget -qO- -T 6 "$probe_url" 2>/dev/null || true)
		fi
		kill "$pid" 2>/dev/null || true
		wait "$pid" 2>/dev/null || true
		if ip=$(printf '%s' "$body" | sed -n 's/.*"query":"\([0-9.]*\)".*/\1/p'); [ -n "$ip" ]; then
			printf 'OK %s' "$ip"
		elif grep -q 'handshake did not complete' /tmp/wg-health-$id.log 2>/dev/null; then
			printf 'FAIL timeout'
		else
			printf 'FAIL unreachable'
		fi
	) )
	case "$result" in
		OK*) ip=${result#OK } ;;
		FAIL*) reason=${result#FAIL } ;;
	esac
	if [ -n "${ip:-}" ]; then
		printf '%s\nok\n%s\n' "$(date +%s)" "$ip" > "$cache"
		rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null || true
		printf '%s' "$ip"
		return 0
	fi
	printf '%s\nfailed\n%s\n' "$(date +%s)" "${reason:-unreachable}" > "$cache"
	rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null || true
	return 1
}

{
	printf '{"generated_at":%s,"nodes":[' "$(date +%s)"
	first=1
	while IFS='|' read -r id label protocol server port; do
		[ -n "$id" ] || continue
		state=no_icmp_reply; ping_json=null; measurement=icmp; reason_json=null
		# WireGuard nodes are validated by a real handshake, not ICMP.
		if [ "$protocol" = wireguard ]; then
			measurement=wg_handshake
			if exit_ip=$(wg_handshake_test "$id" "$server" "$port"); then
				state=handshake_ok; ping_json="\"$exit_ip\""
			else
				state=handshake_failed; ping_json=null
				reason_json="\"$(sed -n '3p' "/tmp/wg-health-$id" 2>/dev/null || echo unreachable)\""
			fi
		else
			ping_output=$(ping -c 1 -W 1 "$server" 2>/dev/null || true)
			latency=$(printf '%s\n' "$ping_output" | sed -n 's/.*time[=<]\{0,1\}\([0-9][0-9.]*\)[[:space:]]*ms.*/\1/p' | head -n 1)
			if [ -n "$latency" ]; then
				state=reachable; ping_json=$latency
			else
				case "$protocol" in
					anytls|vless|vmess|trojan)
						if command -v tcping >/dev/null 2>&1; then
							measurement=tcp
							tcp_output=$(tcping -c 1 -t 1 -p "$port" "$server" 2>/dev/null || true)
							latency=$(printf '%s\n' "$tcp_output" | sed -n 's/.*time=\([0-9][0-9.]*\)[[:space:]]*ms.*/\1/p' | head -n 1)
							if [ -n "$latency" ]; then state=tcp_reachable; ping_json=$latency; else state=unreachable; fi
						fi
						;;
				esac
			fi
		fi
		[ "$first" -eq 1 ] || printf ','
		first=0
		printf '{"id":"%s","state":"%s","measurement":"%s","ping_ms":%s,"reason":%s}' \
			"$(json_escape "$id")" "$state" "$measurement" "$ping_json" "${reason_json:-null}"
	done < "$nodes"
	printf ']}\n'
} > "$tmp"
chmod 644 "$tmp"
mv "$tmp" "$output"
trap - EXIT HUP INT TERM
