#!/bin/sh
set -eu

# Auto-manage DHCP static leases (MAC -> IP bindings) for independent device
# policies.  The nftables policy rules match a fixed client IPv4, so the
# device must keep that address; hand-made leases silently break when the
# device's MAC changes (iOS rotates its private Wi-Fi address) or when the
# policy is edited.  This script recreates the binding from the live lease
# table on every service start and drops bindings whose policy disappeared.
# Only hosts created by this plugin (section name prefix "wfc_") are touched;
# user-managed hosts are left alone.
#
# Usage: dhcp-sync.sh <clients>   (clients: label|ip|node per line)

clients=${1:?clients file required}
# The dnsmasq lease file location is a UCI option; fall back to the
# default path when unset.
leasefile=$(uci -q get dhcp.@dnsmasq[0].leasefile 2>/dev/null || true)
[ -n "$leasefile" ] || leasefile=/tmp/dhcp.leases
[ -f "$leasefile" ] || exit 0
# WFC_DNSMASQ overrides the dnsmasq init script (used by the test suite).
dnsmasq_init=${WFC_DNSMASQ:-/etc/init.d/dnsmasq}

valid_ip() {
	case "$1" in
		''|*[!0-9.]*|*..*|.*|*.) return 1;;
	esac
	return 0
}

# 1) Map policy IP -> device label (sanitized) from the clients file.
want=
while IFS='|' read -r label ip node; do
	valid_ip "$ip" || continue
	# dhcp-host names are interpolated into the dnsmasq config; anything
	# outside a hostname's alphabet (spaces, quotes, commas, semicolons,
	# '.', '#', control characters, a >63-char label) makes dnsmasq reject
	# the whole host line and abort its config parse, taking LAN-wide
	# DNS/DHCP down.  Allowlist the safe subset and cap the length; an
	# empty result is harmless (dnsmasq.init omits an empty name field).
	label=$(printf '%s' "$label" | tr -cd 'A-Za-z0-9_-' | cut -c1-63)
	want="$want $ip"
	eval "want_label_$(printf '%s' "$ip" | tr '.' '_')=\$label"
done < "$clients"

# 2) Map currently-leased IP -> MAC from the live lease table.  dnsmasq
#    lease lines are: expiry MAC IP hostname clientid.
ip2mac=
while read -r expiry mac ip hostname rest; do
	valid_ip "$ip" || continue
	case "$mac" in ''|*[!0-9A-Fa-f:]*|*..*) continue;; esac
	ip2mac="$ip2mac $ip=$mac"
done < "$leasefile"

# 3) Sync the wfc_ hosts.  A host is created/updated only when the policy IP
#    is actually in use by some device right now (that MAC is the one to pin);
#    an idle policy IP keeps any existing binding and logs a hint instead.
changed=0
for host in $(uci show dhcp 2>/dev/null | sed -n 's/^dhcp\.\(wfc_[^=]*\)=host$/\1/p'); do
	host_ip=$(uci get "dhcp.$host.ip" 2>/dev/null || true)
	if valid_ip "$host_ip" && [ -n "$host_ip" ]; then
		ip_ok=0
		for w in $want; do [ "$w" = "$host_ip" ] && ip_ok=1; done
		[ "$ip_ok" -eq 1 ] && continue
	fi
	# Policy for this binding is gone: drop it.
	uci -q delete "dhcp.$host"; changed=1
done

for ip in $want; do
	mac=
	for entry in $ip2mac; do
		case "$entry" in "$ip="*) mac=${entry#*=};; esac
	done
	[ -n "$mac" ] || { logger -t wificalling-gateway "dhcp-sync: no live lease for policy IP $ip; binding stays as-is (reconnect the device to rebind)"; continue; }
	sec=wfc_$(printf '%s' "$ip" | tr '.' '_')
	old_mac=$(uci get "dhcp.$sec.mac" 2>/dev/null || true)
	if [ "$old_mac" = "$mac" ] && [ "$(uci get "dhcp.$sec.ip" 2>/dev/null || true)" = "$ip" ]; then
		continue
	fi
	label=
	eval "label=\$want_label_$(printf '%s' "$ip" | tr '.' '_')"
	uci -q set "dhcp.$sec=host"
	uci -q set "dhcp.$sec.name=$label"
	uci -q set "dhcp.$sec.ip=$ip"
	uci -q set "dhcp.$sec.mac=$mac"
	if [ -n "$old_mac" ] && [ "$old_mac" != "$mac" ]; then
		logger -t wificalling-gateway "dhcp-sync: device $label ($ip) MAC changed $old_mac -> $mac, binding updated"
	fi
	changed=1
done

if [ "$changed" -eq 1 ]; then
	uci commit dhcp
	# A rejected dhcp-host line aborts dnsmasq's config parse (LAN-wide
	# DNS/DHCP outage); surface a restart failure instead of hiding it.
	if ! "$dnsmasq_init" restart; then
		logger -t wificalling-gateway "dhcp-sync: dnsmasq restart failed after lease update; check the dhcp-host configuration"
	fi
fi
