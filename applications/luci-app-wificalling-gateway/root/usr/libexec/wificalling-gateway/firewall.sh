#!/bin/sh
set -eu
action=${1:-start}; clients=${2:-/var/run/wificalling-gateway/clients}
table='inet wificalling_gateway'
bypass_helper="${0%/*}/passwall-bypass.sh"
# Policy devices must never bypass the IPv4-first tunnel via native IPv6:
# their IPv6 is either pushed into the tunnel (v6 tproxy, available when the
# compiled config carries the wfc-tcp6/wfc-udp6 inbounds, i.e. every device
# policy binds the same node) or dropped outright.  It is never left on the
# WAN - a node without IPv6 egress discards the traffic inside the tunnel.
v6_teardown() {
	ip -6 rule del fwmark 0x66 table 166 2>/dev/null || true
	ip -6 route flush table 166 2>/dev/null || true
}
# Resolve a client IP to a MAC (static DHCP lease first, then the neighbour
# table): IPv6 addresses are dynamic (SLAAC privacy extensions), so the
# device can only be matched by MAC at the firewall.
mac_for_ip() {
	_fwc_mac=$(awk -v target="$1" '$3 == target { print $2; exit }' /tmp/dhcp.leases 2>/dev/null || true)
	case "$_fwc_mac" in
		??:??:??:??:??:??) printf '%s' "$_fwc_mac"; return 0 ;;
	esac
	_fwc_mac=$(ip neigh show "$1" dev br-lan 2>/dev/null | awk '$2 == "lladdr" { print $3; exit }')
	case "$_fwc_mac" in
		??:??:??:??:??:??) printf '%s' "$_fwc_mac" ;;
	esac
}
[ "$action" = stop ] && { "$bypass_helper" clear "$clients" || true; v6_teardown; nft delete table $table 2>/dev/null || true; ip rule del fwmark 0x66 table 166 2>/dev/null || true; ip route flush table 166 2>/dev/null || true; exit 0; }

macs=$(for ip in $(awk -F '|' 'NF>=2 { print $2 }' "$clients" | sort -u); do mac_for_ip "$ip" || true; done | sort -u)
ips=$(awk -F '|' 'NF>=2 { printf "%s%s", (n++?", ":""), $2 }' "$clients")
[ -n "$ips" ] || {
	# Fail-open on an empty client set: a start with no clients must withdraw
	# the rule/route/table installed for a previously present device, so
	# deleting the last device never leaves a stale static route behind.
	"$bypass_helper" clear "$clients" || true
	v6_teardown
	nft delete table $table 2>/dev/null || true
	ip rule del fwmark 0x66 table 166 2>/dev/null || true
	ip route flush table 166 2>/dev/null || true
	exit 0
}
# Link-local (NDP/RS) and ULA stay local (fc00::/7 covers the ULA range, so
# no per-LAN prefix element is needed); everything else from a policy device
# enters the v6 tunnel.
nft delete table $table 2>/dev/null || true
nft -f - <<EOF
table $table {
 set clients4 { type ipv4_addr; elements = { $ips } }
 set clients6 { type ipv6_addr; flags interval; elements = { fe80::/10, fc00::/7 } }
 set macs { type ether_addr; elements = { $(printf '%s' "$macs" | sed 's/,/, /g') } }
 chain prerouting {
  type filter hook prerouting priority mangle; policy accept;
  meta nfproto ipv6 return
  ip saddr != @clients4 return
  ip daddr { 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4 } return
  meta l4proto tcp counter meta mark set 0x66 tproxy ip to :11441 accept
  meta l4proto udp counter meta mark set 0x66 tproxy ip to :11442 accept
 }
 chain prerouting6 {
  type filter hook prerouting priority mangle; policy accept;
  meta nfproto ipv4 return
  ether saddr @macs meta l4proto tcp ip6 daddr != @clients6 counter meta mark set 0x66 tproxy ip6 to :11443 accept
  ether saddr @macs meta l4proto udp ip6 daddr != @clients6 counter meta mark set 0x66 tproxy ip6 to :11444 accept
 }
}
EOF
ip rule add fwmark 0x66 table 166 2>/dev/null || true
ip route replace local 0.0.0.0/0 dev lo table 166
ip -6 rule add fwmark 0x66 table 166 2>/dev/null || true
ip -6 route replace local ::/0 dev lo table 166
"$bypass_helper" ensure "$clients"
