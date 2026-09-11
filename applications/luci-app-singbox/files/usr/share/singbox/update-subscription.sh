#!/bin/sh
# update-subscription.sh — import VLESS servers from a subscription URL.
#
# Accepts either raw or base64-encoded content containing `vless://` lines.
# Each link is parsed and added as an anonymous `config server` section in
# /etc/config/singbox. Already-known server names (taken from the vless
# fragment or synthesised from the host) are skipped to keep imports
# idempotent across re-runs.
#
# Usage:
#   update-subscription.sh <url>     # one-shot import from a URL
#   update-subscription.sh           # read URL from UCI: subscription.url
#
# Stdout: a single JSON line {success, imported, servers|error}.

URL="${1:-}"

. /lib/functions.sh

if [ -z "$URL" ]; then
	config_load singbox
	config_get URL subscription url
	config_get_bool SUB_ENABLED subscription enabled 0
	if [ "$SUB_ENABLED" != "1" ] || [ -z "$URL" ]; then
		echo '{"success":false,"error":"No subscription URL configured"}'
		exit 1
	fi
else
	# Persist the URL so it shows up in Settings → Subscription URL next
	# time and so a subsequent no-arg run (e.g. by a future cron auto-update)
	# knows where to fetch from. The subscription section is anonymous —
	# address it by type-index rather than by name.
	config_load singbox
	uci -q set "singbox.@subscription[0].url=$URL"
	uci -q commit singbox
fi

CONTENT=$(wget -qO- "$URL" 2>/dev/null)
if [ -z "$CONTENT" ]; then
	echo '{"success":false,"error":"Failed to fetch subscription"}'
	exit 1
fi

# Auto-detect base64-encoded payloads (most providers ship base64).
DECODED=$(echo "$CONTENT" | base64 -d 2>/dev/null)
if echo "$DECODED" | grep -q "vless://"; then
	VLESS_LINKS="$DECODED"
elif echo "$CONTENT" | grep -q "vless://"; then
	VLESS_LINKS="$CONTENT"
else
	echo '{"success":false,"error":"No VLESS links found in subscription"}'
	exit 1
fi

IMPORTED=0
SERVER_NAMES=""

config_load singbox

existing_names() {
	local name="$1"
	local tag
	config_get tag "$name" name
	EXISTING_TAGS="$EXISTING_TAGS $tag"
}
EXISTING_TAGS=""
config_foreach existing_names server

# Walk links line by line — IFS must be a real newline, not the two chars \n.
NL="
"
IFS="$NL"
for LINK in $VLESS_LINKS; do
	LINK=$(echo "$LINK" | tr -d '\r')

	case "$LINK" in
		vless://*) ;;
		*) continue ;;
	esac

	PAYLOAD="${LINK#vless://}"
	UUID="${PAYLOAD%%@*}"
	REST="${PAYLOAD#*@}"
	HOSTPORT="${REST%%\?*}"
	QUERY_PARAMS="${REST#*\?}"
	FRAGMENT="${QUERY_PARAMS##*#}"
	QUERY_PARAMS="${QUERY_PARAMS%%#*}"

	SERVER="${HOSTPORT%%:*}"
	PORT="${HOSTPORT##*:}"

	if [ "$SERVER" = "$HOSTPORT" ]; then
		PORT="443"
	fi

	SNI=$(echo "$QUERY_PARAMS"   | tr '&' '\n' | grep '^sni='  | cut -d= -f2)
	PUB_KEY=$(echo "$QUERY_PARAMS" | tr '&' '\n' | grep '^pbk='  | cut -d= -f2)
	SHORT_ID=$(echo "$QUERY_PARAMS" | tr '&' '\n' | grep '^sid='  | cut -d= -f2)
	FLOW=$(echo "$QUERY_PARAMS"   | tr '&' '\n' | grep '^flow=' | cut -d= -f2)
	FP=$(echo "$QUERY_PARAMS"    | tr '&' '\n' | grep '^fp='   | cut -d= -f2)

	[ -z "$SNI" ]  && SNI="$SERVER"
	[ -z "$FP" ]   && FP="chrome"
	[ -z "$PORT" ] && PORT="443"

	SERVER_NAME="$FRAGMENT"
	[ -z "$SERVER_NAME" ] && SERVER_NAME="server-$(echo "$SERVER" | tr '.' '-')"

	echo "$EXISTING_TAGS" | grep -qw "$SERVER_NAME" && continue

	NEW_SECTION=$(uci -q add singbox server)
	[ -z "$NEW_SECTION" ] && continue

	uci set "singbox.$NEW_SECTION.name=$SERVER_NAME"
	uci set "singbox.$NEW_SECTION.enabled=1"
	uci set "singbox.$NEW_SECTION.type=vless"
	uci set "singbox.$NEW_SECTION.server=$SERVER"
	uci set "singbox.$NEW_SECTION.port=$PORT"
	uci set "singbox.$NEW_SECTION.uuid=$UUID"
	[ -n "$FLOW" ]     && uci set "singbox.$NEW_SECTION.flow=$FLOW"
	uci set "singbox.$NEW_SECTION.sni=$SNI"
	uci set "singbox.$NEW_SECTION.utls_fingerprint=$FP"
	[ -n "$PUB_KEY" ]  && uci set "singbox.$NEW_SECTION.reality_public_key=$PUB_KEY"
	[ -n "$SHORT_ID" ] && uci set "singbox.$NEW_SECTION.reality_short_id=$SHORT_ID"

	IMPORTED=$((IMPORTED + 1))
	SERVER_NAMES="$SERVER_NAMES $SERVER_NAME"
done
unset IFS

uci commit singbox

if [ "$IMPORTED" -gt 0 ]; then
	echo "{\"success\":true,\"imported\":$IMPORTED,\"servers\":\"${SERVER_NAMES# }\"}"
else
	echo '{"success":true,"imported":0,"message":"No new servers to import"}'
fi
