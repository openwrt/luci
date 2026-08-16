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
wg_handshake_test() {
	id=$1; server=$2; port=$3
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
	priv=$(uci -q get "wificalling-gateway.$id.private_key") || return 1
	pub=$(uci -q get "wificalling-gateway.$id.public_key") || return 1
	local_addr=$(uci -q get "wificalling-gateway.$id.local_address") || return 1
	psk=$(uci -q get "wificalling-gateway.$id.pre_shared_key") || true
	mtu=$(uci -q get "wificalling-gateway.$id.mtu") || true
	lport=$((19000 + (${id#cfg} % 1000))) 2>/dev/null || lport=19099
	cfg="/tmp/wg-health-$id.json"
	{
		printf '{"log":{"level":"warn"},"inbounds":[{"type":"http","tag":"probe","listen":"127.0.0.1","listen_port":%s}],' "$lport"
		printf '"endpoints":[{"type":"wireguard","tag":"wg","address":[%s],"private_key":%s,"peers":[{"address":%s,"port":%s,"public_key":%s,"allowed_ips":["0.0.0.0/0"]' \
			"\"$local_addr\"" "\"$priv\"" "\"$server\"" "$port" "\"$pub\""
		[ -n "$psk" ] && printf ',"pre_shared_key":"%s"' "$psk"
		printf '}],"mtu":%s}],"outbounds":[{"type":"direct","tag":"direct"}],"route":{"final":"wg"}}' "${mtu:-1420}"
	} > "$cfg"
	"$sing_box" run -c "$cfg" > /tmp/wg-health-$id.log 2>&1 &
	pid=$!
	sleep 2
	# busybox wget honours http_proxy; the probe listens on 127.0.0.1.
	ip=$(http_proxy="http://127.0.0.1:$lport" wget -qO- -T 6 'http://ip-api.com/json/?fields=query' 2>/dev/null | sed -n 's/.*"query":"\([0-9.]*\)".*/\1/p' || true)
	kill "$pid" 2>/dev/null || true
	wait "$pid" 2>/dev/null || true
	rm -f "$cfg" /tmp/wg-health-$id.log
	if [ -n "$ip" ]; then
		printf '%s\nok\n%s\n' "$(date +%s)" "$ip" > "$cache"
		printf '%s' "$ip"
		return 0
	fi
	printf '%s\nfailed\n' "$(date +%s)" > "$cache"
	return 1
}

{
	printf '{"generated_at":%s,"nodes":[' "$(date +%s)"
	first=1
	while IFS='|' read -r id label protocol server port; do
		[ -n "$id" ] || continue
		state=no_icmp_reply; ping_json=null; measurement=icmp
		# WireGuard nodes are validated by a real handshake, not ICMP.
		if [ "$protocol" = wireguard ]; then
			measurement=wg_handshake
			if exit_ip=$(wg_handshake_test "$id" "$server" "$port"); then
				state=handshake_ok; ping_json="\"$exit_ip\""
			else
				state=handshake_failed; ping_json=null
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
		printf '{"id":"%s","state":"%s","measurement":"%s","ping_ms":%s}' \
			"$(json_escape "$id")" "$state" "$measurement" "$ping_json"
	done < "$nodes"
	printf ']}\n'
} > "$tmp"
chmod 644 "$tmp"
mv "$tmp" "$output"
trap - EXIT HUP INT TERM
