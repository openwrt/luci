#!/bin/sh
# node-test.sh — manual connection test for one proxy node (the LuCI
# "nodeTest" row button).
#
# WireGuard nodes run the same handshake probe the monitor loop uses (the
# function is extracted from node-health.sh, so there is exactly one
# implementation), bypassing the 60 s result cache so the user gets a fresh
# answer on demand.  Every other protocol gets a TCP reachability probe of
# the node's server:port (tcping when installed, busybox nc otherwise).
# Prints one JSON object; always exits 0 so rpcd forwards the reply
# untouched.

set -eu

id=${1:?node id required}

server=$(uci -q get "wificalling-gateway.$id.server") || true
port=$(uci -q get "wificalling-gateway.$id.port") || true
if [ -z "$server" ] || [ -z "$port" ]; then
	printf '{"state":"failed","reason":"config_missing"}\n'
	exit 0
fi

proto=$(uci -q get "wificalling-gateway.$id.protocol") || true
if [ "$proto" = wireguard ]; then
	health=${WFC_HEALTH:-/usr/libexec/wificalling-gateway/node-health.sh}
	[ -f "$health" ] || {
		printf '{"state":"failed","reason":"no_health_script"}\n'
		exit 0
	}

	# Extract the handshake function from the monitor script so the
	# manual test and the monitor loop share one implementation.
	func=$(mktemp /tmp/wg-test-func.XXXXXX)
	trap 'rm -f "$func"' EXIT HUP INT TERM
	awk '/^wg_handshake_test\(\)/,/^}/' "$health" > "$func"
	sing_box=${WFC_SING_BOX:-/usr/bin/sing-box}
	. "$func"

	# The monitor loop may be mid-test right now; wait for its lock so
	# this run is authoritative (a handshake takes up to ~8 s, give it 20 s).
	n=0
	while [ -d /tmp/wg-health.lock ]; do
		n=$((n + 1))
		[ "$n" -ge 40 ] && {
			printf '{"state":"failed","reason":"busy"}\n'
			exit 0
		}
		sleep 1
	done

	# Bypass the 60 s cache: the cached result is exactly what the user
	# is asking to re-check.
	rm -f "/tmp/wg-health-$id"

	if exit_ip=$(wg_handshake_test "$id" "$server" "$port"); then
		printf '{"state":"handshake_ok","exit_ip":"%s"}\n' "$exit_ip"
	else
		reason=$(sed -n '3p' "/tmp/wg-health-$id" 2>/dev/null || echo unreachable)
		printf '{"state":"handshake_failed","reason":"%s"}\n' "$reason"
	fi
	exit 0
fi

# Non-WireGuard protocols: TCP reachability of the node server.
if command -v tcping >/dev/null 2>&1; then
	ms=$(tcping -c 1 -t 2 -p "$port" "$server" 2>/dev/null |
		sed -n 's/.*time=\([0-9][0-9.]*\)[[:space:]]*ms.*/\1/p' | head -n 1)
	if [ -n "$ms" ]; then
		printf '{"state":"tcp_reachable","ping_ms":"%s"}\n' "$ms"
	else
		printf '{"state":"unreachable","reason":"tcp_failed"}\n'
	fi
elif command -v nc >/dev/null 2>&1; then
	if nc -w 3 "$server" "$port" >/dev/null 2>&1; then
		printf '{"state":"tcp_reachable","ping_ms":null}\n'
	else
		printf '{"state":"unreachable","reason":"tcp_failed"}\n'
	fi
else
	printf '{"state":"failed","reason":"no_tcp_probe"}\n'
fi
exit 0
