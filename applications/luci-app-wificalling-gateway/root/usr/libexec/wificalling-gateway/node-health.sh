#!/bin/sh
set -eu

nodes=${1:?node list required}
output=${2:-/var/run/wificalling-gateway/node-status.json}
tmp="${output}.tmp.$$"
trap 'rm -f "$tmp"' EXIT HUP INT TERM

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

{
	printf '{"generated_at":%s,"note":"ICMP ping only; this is not a proxy protocol handshake.","nodes":[' "$(date +%s)"
	first=1
	while IFS='|' read -r id label protocol server port; do
		[ -n "$id" ] || continue
		ping_output=$(ping -c 1 -W 1 "$server" 2>/dev/null || true)
		latency=$(printf '%s\n' "$ping_output" | sed -n 's/.*time[=<]\{0,1\}\([0-9][0-9.]*\)[[:space:]]*ms.*/\1/p' | head -n 1)
		state=no_icmp_reply; ping_json=null; measurement=icmp
		if [ -n "$latency" ]; then
			state=reachable; ping_json=$latency
		else
			case "$protocol" in
				anytls|vless|vmess)
					if command -v tcping >/dev/null 2>&1; then
						measurement=tcp
						tcp_output=$(tcping -c 1 -t 1 -p "$port" "$server" 2>/dev/null || true)
						latency=$(printf '%s\n' "$tcp_output" | sed -n 's/.*time=\([0-9][0-9.]*\)[[:space:]]*ms.*/\1/p' | head -n 1)
						if [ -n "$latency" ]; then state=tcp_reachable; ping_json=$latency; else state=unreachable; fi
					fi
					;;
			esac
		fi
		[ "$first" -eq 1 ] || printf ','
		first=0
		printf '{"id":"%s","label":"%s","protocol":"%s","server":"%s","port":%s,"state":"%s","measurement":"%s","ping_ms":%s}' \
			"$(json_escape "$id")" "$(json_escape "$label")" "$(json_escape "$protocol")" \
			"$(json_escape "$server")" "$port" "$state" "$measurement" "$ping_json"
	done < "$nodes"
	printf ']}\n'
} > "$tmp"
chmod 644 "$tmp"
mv "$tmp" "$output"
trap - EXIT HUP INT TERM
