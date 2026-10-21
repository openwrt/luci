#!/bin/sh
# generate-config.sh — render /etc/sing-box/config.json from UCI.
#
# Reads /etc/config/singbox, emits a sing-box JSON document to a temp file,
# validates it with `sing-box check`, and only then atomically installs it
# to $SINGBOX_CONFIG. Exits non-zero on any failure so callers (init script,
# Apply button, rpc layer) can react.
#
# Usage:    generate-config.sh
# Stdout:   "OK: config generated and validated"  (or an error line)
# Exit:     0 success, 1 generation/validation failure
# Depends:  /lib/functions.sh (UCI helpers), /usr/bin/sing-box (optional).

SINGBOX_CONFIG="/etc/sing-box/config.json"
SINGBOX_DIR="$(dirname "$SINGBOX_CONFIG")"
GEOSITE_BASE="https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set"

. /lib/functions.sh

# JSON-escape a string for safe interpolation into a "…" JSON value.
# Backslash first (otherwise the escape char is duplicated), then quote.
# sing-box check rejects malformed JSON, so without this a single stray
# " in a server tag or SNI would silently break config generation.
json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

config_load singbox

config_get_bool ENABLED general enabled 1
config_get LOG_LEVEL general log_level "info"
config_get LOG_OUTPUT general log_output "/tmp/sing-box.log"
config_get STACK general stack "gvisor"
config_get TUN_ADDR general tun_address "172.19.0.1/30"
config_get TUN_MTU general tun_mtu "1400"
config_get_bool AUTO_ROUTE general auto_route 1
config_get_bool STRICT_ROUTE general strict_route 1
config_get_bool CLASH_API general clash_api 1
config_get CLASH_PORT general clash_api_port "9090"
config_get FINAL_OUTBOUND general final_outbound "direct"

config_get_bool URLTEST_ENABLED urltest enabled 1
config_get URLTEST_INTERVAL urltest interval "3m"
config_get URLTEST_TOLERANCE urltest tolerance "50"
config_get URLTEST_URL urltest test_url "http://www.gstatic.com/generate_204"

config_get DNS_DIRECT dns direct_server "auto"
config_get DNS_TUNNEL dns tunnel_server "8.8.8.8"
config_get DNS_STRATEGY dns strategy "prefer_ipv4"

auto_route="false"
strict_route="false"
[ "$AUTO_ROUTE" = "1" ] && auto_route="true"
[ "$STRICT_ROUTE" = "1" ] && strict_route="true"

build_log() {
	# sing-box writes to stdout/stderr when "output" is omitted; procd's
	# stdout/stderr capture in the init script relays it to syslog (logd
	# ring buffer). This is the OpenWrt-idiomatic path — logd handles
	# rotation itself, no SIGHUP games, no risk of crash-looping sing-box
	# by signalling a "reload" while TUN is held by the dying process.
	printf '{"level":"%s","timestamp":true}' "$(json_escape "$LOG_LEVEL")"
}

get_direct_dns() {
	if [ "$DNS_DIRECT" = "auto" ]; then
		cat /tmp/resolv.conf.d/resolv.conf.auto 2>/dev/null | grep nameserver | head -1 | awk '{print $2}'
	else
		echo "$DNS_DIRECT"
	fi
}

build_dns() {
	local direct_dns
	direct_dns=$(get_direct_dns)
	[ -z "$direct_dns" ] && direct_dns="1.1.1.1"

	local tunnel_dns="$DNS_TUNNEL"
	[ -z "$tunnel_dns" ] && tunnel_dns="8.8.8.8"

	printf '{"servers":['
	printf '{"type":"udp","tag":"dns-direct","server":"%s"}' "$(json_escape "$direct_dns")"
	printf ',{"type":"tcp","tag":"dns-tunnel","server":"%s","detour":"auto"}' "$(json_escape "$tunnel_dns")"
	printf '],'

	printf '"rules":['

	local dns_rules=""

	config_foreach collect_dns_rules rule
	if [ -n "$dns_rules" ]; then
		printf '{"rule_set":[%s],"server":"dns-tunnel"}' "$dns_rules"
	fi

	printf '],'

	printf '"final":"dns-direct","strategy":"%s"' "$(json_escape "$DNS_STRATEGY")"
	printf '}'
}

collect_dns_rules() {
	local name="$1"
	local enabled type match outbound
	config_get_bool enabled "$name" enabled 1
	config_get type "$name" type
	config_get match "$name" match
	config_get outbound "$name" outbound

	[ "$enabled" = "1" ] || return
	[ "$type" = "geosite" ] || return
	[ "$outbound" = "auto" ] || return

	local esc_match
	esc_match=$(json_escape "$match")
	if [ -z "$dns_rules" ]; then
		dns_rules="\"$esc_match\""
	else
		dns_rules="$dns_rules,\"$esc_match\""
	fi
}

build_inbounds() {
	printf '{"type":"tun","tag":"tun-in","interface_name":"sing-tun","address":["%s"],"mtu":%s,"auto_route":%s,"strict_route":%s,"stack":"%s"}' \
		"$(json_escape "$TUN_ADDR")" "$TUN_MTU" "$auto_route" "$strict_route" "$(json_escape "$STACK")"
}

build_outbounds() {
	local server_count=0

	config_foreach count_enabled_server server

	if [ "$server_count" -eq 0 ]; then
		# No enabled servers — fall back to direct-only so the router stays
		# reachable. The "block" outbound is intentionally omitted: modern
		# sing-box uses the route-rule action "reject" instead, and a stale
		# block tag here would trigger "operation not permitted" warnings.
		printf '{"type":"direct","tag":"direct"}'
		return
	fi

	first_outbound=1
	config_foreach build_vless_outbound server

	if [ "$URLTEST_ENABLED" = "1" ] && [ "$server_count" -ge 2 ]; then
		printf ','
		printf '{"type":"urltest","tag":"auto","outbounds":['
		local first_urltest=1
		config_foreach add_to_urltest server
		printf '],"url":"%s","interval":"%s","tolerance":%s}' \
			"$(json_escape "$URLTEST_URL")" "$(json_escape "$URLTEST_INTERVAL")" "$URLTEST_TOLERANCE"
	fi

	printf ',{"type":"direct","tag":"direct"}'
}

count_enabled_server() {
	local name="$1"
	local enabled
	config_get_bool enabled "$name" enabled 1
	[ "$enabled" = "1" ] && server_count=$((server_count + 1))
}

add_to_urltest() {
	local name="$1"
	local enabled tag
	config_get_bool enabled "$name" enabled 1
	config_get tag "$name" name
	[ "$enabled" = "1" ] || return
	[ -z "$tag" ] && return
	[ "$first_urltest" = "1" ] && first_urltest=0 || printf ','
	printf '"%s"' "$(json_escape "$tag")"
}

build_vless_outbound() {
	local name="$1"
	local enabled srv_type server port uuid flow sni fp pub_key short_id
	config_get_bool enabled "$name" enabled 1
	config_get srv_type "$name" type
	config_get server "$name" server
	config_get port "$name" port
	config_get uuid "$name" uuid
	config_get flow "$name" flow
	config_get sni "$name" sni
	config_get fp "$name" utls_fingerprint
	config_get pub_key "$name" reality_public_key
	config_get short_id "$name" reality_short_id
	config_get tag "$name" name

	[ "$enabled" = "1" ] || return
	[ "$srv_type" = "vless" ] || return
	[ -z "$server" ] && return

	[ "$first_outbound" = "1" ] && first_outbound=0 || printf ','

	printf '{"type":"vless","tag":"%s","server":"%s","server_port":%s,"uuid":"%s"' \
		"$(json_escape "$tag")" "$(json_escape "$server")" "$port" "$(json_escape "$uuid")"

	[ -n "$flow" ] && printf ',"flow":"%s"' "$(json_escape "$flow")"

	printf ',"tls":{"enabled":true,"server_name":"%s"' "$(json_escape "$sni")"
	printf ',"utls":{"enabled":true,"fingerprint":"%s"}' "$(json_escape "$fp")"
	printf ',"reality":{"enabled":true,"public_key":"%s","short_id":"%s"}}' "$(json_escape "$pub_key")" "$(json_escape "$short_id")"
	printf '}'
}

build_rule_sets() {
	local sets=""
	config_foreach collect_geosite_rules rule

	if [ -n "$sets" ]; then
		printf '%s' "$sets"
	fi
}

collect_geosite_rules() {
	local name="$1"
	local enabled type match
	config_get_bool enabled "$name" enabled 1
	config_get type "$name" type
	config_get match "$name" match

	[ "$enabled" = "1" ] || return
	[ "$type" = "geosite" ] || return
	[ -z "$match" ] && return

	local esc_match esc_url
	esc_match=$(json_escape "$match")
	esc_url=$(json_escape "$GEOSITE_BASE/$match.srs")
	if [ -z "$sets" ]; then
		sets="{\"type\":\"remote\",\"tag\":\"$esc_match\",\"format\":\"binary\",\"url\":\"$esc_url\",\"download_detour\":\"direct\"}"
	else
		sets="$sets,{\"type\":\"remote\",\"tag\":\"$esc_match\",\"format\":\"binary\",\"url\":\"$esc_url\",\"download_detour\":\"direct\"}"
	fi
}

build_route_rules() {
	printf '{"action":"sniff"},'
	printf '{"protocol":"dns","action":"hijack-dns"},'

	local block_tags=""
	local proxy_tags=""
	local direct_tags=""
	local ip_cidr_rules=""
	local domain_auto=""
	local domain_direct=""
	local domain_block=""

	config_foreach collect_route_rules rule

	if [ -n "$block_tags" ]; then
		# Modern sing-box (1.10+) prefers the route-rule action "reject" over
		# routing to a `block` outbound. The latter prints
		# "operation not permitted" warnings on each match because the kernel
		# refuses to drop already-established sockets the way sing-box asks.
		printf '{"rule_set":[%s],"action":"reject"},' "$block_tags"
	fi

	if [ -n "$ip_cidr_rules" ]; then
		printf '{"ip_cidr":[%s],"outbound":"auto"},' "$ip_cidr_rules"
	fi

	if [ -n "$domain_block" ]; then
		printf '{"domain":[%s],"action":"reject"},' "$domain_block"
	fi

	if [ -n "$domain_direct" ]; then
		printf '{"domain":[%s],"outbound":"direct"},' "$domain_direct"
	fi

	if [ -n "$direct_tags" ]; then
		printf '{"rule_set":[%s],"outbound":"direct"},' "$direct_tags"
	fi

	if [ -n "$proxy_tags" ]; then
		printf '{"rule_set":[%s],"outbound":"auto"},' "$proxy_tags"
	fi

	if [ -n "$domain_auto" ]; then
		printf '{"domain":[%s],"outbound":"auto"},' "$domain_auto"
	fi

	printf '{"ip_is_private":true,"outbound":"direct"}'
}

collect_route_rules() {
	local name="$1"
	local enabled type match outbound
	config_get_bool enabled "$name" enabled 1
	config_get type "$name" type
	config_get match "$name" match
	config_get outbound "$name" outbound

	[ "$enabled" = "1" ] || return
	[ -z "$match" ] && return

	if [ "$type" = "geosite" ]; then
		local esc_match
		esc_match=$(json_escape "$match")
		if [ "$outbound" = "block" ]; then
			if [ -z "$block_tags" ]; then
				block_tags="\"$esc_match\""
			else
				block_tags="$block_tags,\"$esc_match\""
			fi
		elif [ "$outbound" = "direct" ]; then
			if [ -z "$direct_tags" ]; then
				direct_tags="\"$esc_match\""
			else
				direct_tags="$direct_tags,\"$esc_match\""
			fi
		else
			if [ -z "$proxy_tags" ]; then
				proxy_tags="\"$esc_match\""
			else
				proxy_tags="$proxy_tags,\"$esc_match\""
			fi
		fi
	elif [ "$type" = "domain" ]; then
		local entry quoted
		for entry in $match; do
			quoted="\"$(json_escape "$entry")\""
			case "$outbound" in
				block)
					if [ -z "$domain_block" ]; then domain_block="$quoted"
					else domain_block="$domain_block,$quoted"; fi
					;;
				direct)
					if [ -z "$domain_direct" ]; then domain_direct="$quoted"
					else domain_direct="$domain_direct,$quoted"; fi
					;;
				*)
					if [ -z "$domain_auto" ]; then domain_auto="$quoted"
					else domain_auto="$domain_auto,$quoted"; fi
					;;
			esac
		done
	elif [ "$type" = "ip_cidr" ]; then
		local cidr
		for cidr in $match; do
			if [ -z "$ip_cidr_rules" ]; then
				ip_cidr_rules="\"$(json_escape "$cidr")\""
			else
				ip_cidr_rules="$ip_cidr_rules,\"$(json_escape "$cidr")\""
			fi
		done
	fi
}

build_route() {
	# final_outbound=block is special: there is no "block" outbound anymore
	# (we use the modern "reject" route action), so install a catch-all
	# reject rule at the end instead of pointing final at a missing tag.
	local final_tag="$FINAL_OUTBOUND"
	local emit_final_reject=0
	if [ "$FINAL_OUTBOUND" = "block" ]; then
		final_tag="direct"
		emit_final_reject=1
	fi

	printf '{"rules":['
	build_route_rules
	[ "$emit_final_reject" = "1" ] && printf '{"action":"reject"}'
	printf '],'

	local sets
	sets=$(build_rule_sets)
	if [ -n "$sets" ]; then
		printf '"rule_set":[%s],' "$sets"
	fi

	printf '"final":"%s","auto_detect_interface":true' "$(json_escape "$final_tag")"
	printf ',"default_domain_resolver":{"server":"dns-direct","strategy":"%s"}' "$(json_escape "$DNS_STRATEGY")"
	printf '}'
}

build_experimental() {
	if [ "$CLASH_API" = "1" ]; then
		printf '{"clash_api":{"external_controller":"127.0.0.1:%s"}}' "$(json_escape "$CLASH_PORT")"
	else
		printf '{}'
	fi
}

generate() {
	if [ "$ENABLED" != "1" ]; then
		echo '{"disabled":true}'
		return 1
	fi

	local direct_dns
	direct_dns=$(get_direct_dns)

	printf '{'
	printf '"log":'
	build_log
	printf ',"dns":'
	build_dns
	printf ',"inbounds":['
	build_inbounds
	printf ']'
	printf ',"outbounds":['
	first_outbound=1
	build_outbounds
	printf ']'
	printf ',"route":'
	build_route
	printf ',"experimental":'
	build_experimental
	printf '}'
	printf '\n'
}

OUTPUT=$(generate 2>&1)

if [ $? -ne 0 ]; then
	echo "ERROR: Failed to generate config" >&2
	echo "$OUTPUT" >&2
	exit 1
fi

echo "$OUTPUT" > /tmp/singbox-config-preview.json

if [ -x /usr/bin/sing-box ]; then
	if ! /usr/bin/sing-box check -c /tmp/singbox-config-preview.json 2>/dev/null; then
		echo "ERROR: sing-box check failed" >&2
		/usr/bin/sing-box check -c /tmp/singbox-config-preview.json 2>&1 >&2
		exit 1
	fi
fi

mkdir -p "$SINGBOX_DIR"
cp /tmp/singbox-config-preview.json "$SINGBOX_CONFIG"
echo "OK: config generated and validated"
