#!/bin/sh
set -eu
action=${1:-start}; clients=${2:-/var/run/wificalling-gateway/clients}
table='inet wificalling_gateway'
bypass_helper="${0%/*}/passwall-bypass.sh"
[ "$action" = stop ] && { "$bypass_helper" clear "$clients"; nft delete table $table 2>/dev/null || true; ip rule del fwmark 0x66 table 166 2>/dev/null || true; ip route flush table 166 2>/dev/null || true; exit 0; }

ips=$(awk -F '|' 'NF>=2 { printf "%s%s", (n++?", ":""), $2 }' "$clients")
[ -n "$ips" ] || exit 0
nft delete table $table 2>/dev/null || true
nft -f - <<EOF
table $table {
 set clients4 { type ipv4_addr; elements = { $ips } }
 chain prerouting {
  type filter hook prerouting priority mangle; policy accept;
  ip saddr != @clients4 return
  ip daddr { 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4 } return
  meta l4proto tcp counter meta mark set 0x66 tproxy to :11441 accept
  meta l4proto udp counter meta mark set 0x66 tproxy to :11442 accept
 }
}
EOF
ip rule add fwmark 0x66 table 166 2>/dev/null || true
ip route replace local 0.0.0.0/0 dev lo table 166
"$bypass_helper" ensure "$clients"
