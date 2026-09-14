#!/bin/sh
set -eu

action=${1:-ensure}
clients=${2:-/var/run/wificalling-gateway/clients}
comment=WFC_GATEWAY_BYPASS

clear_chain() {
	chain=$1
	nft -a list chain inet passwall "$chain" 2>/dev/null |
		awk -v marker="$comment" '$0 ~ marker { print $NF }' |
		while read -r handle; do
			case "$handle" in ''|*[!0-9]*) continue;; esac
			nft delete rule inet passwall "$chain" handle "$handle" 2>/dev/null || true
		done
}

nft list table inet passwall >/dev/null 2>&1 || exit 0

if [ "$action" = clear ]; then
	clear_chain PSW_MANGLE
	clear_chain PSW_NAT
	exit 0
fi

[ -f "$clients" ] || exit 0
ips=$(awk -F '|' 'NF>=2 { printf "%s%s", (n++?", ":""), $2 }' "$clients")
[ -n "$ips" ] || { "$0" clear "$clients"; exit 0; }

for chain in PSW_MANGLE PSW_NAT; do
	if ! nft list chain inet passwall "$chain" 2>/dev/null | grep -q "$comment"; then
		nft insert rule inet passwall "$chain" ip saddr { $ips } counter return comment "$comment"
	fi
done
