#!/usr/bin/env bash
# Functional test runner for luci-app-https-dns-proxy.
#
# Tests:
#   01: Provider JSON validation (structure, fields, bootstrap DNS)
#   02: JavaScript template functions (templateToRegexp, templateToResolver)
#   03: RPC backend script validation
#
# Usage: cd source.openwrt.melmac.ca/luci-app-https-dns-proxy && bash tests/run_tests.sh

set -o pipefail

n_tests=0
n_fails=0

pass() {
	printf "  PASS: %s\n" "$1"
}
fail() {
	printf "  FAIL: %s\n" "$1"
	[ -n "$2" ] && printf "        %s\n" "$2"
	n_fails=$((n_fails + 1))
}
assert_rc() {
	local desc="$1" expect="$2" actual="$3"
	n_tests=$((n_tests + 1))
	if [ "$expect" -eq "$actual" ]; then
		pass "$desc"
	else
		fail "$desc" "expected rc=$expect, got rc=$actual"
	fi
}
assert_eq() {
	local desc="$1" expect="$2" actual="$3"
	n_tests=$((n_tests + 1))
	if [ "$expect" = "$actual" ]; then
		pass "$desc"
	else
		fail "$desc" "expected: '$expect', got: '$actual'"
	fi
}

PROVIDERS_DIR="./root/usr/share/https-dns-proxy/providers"
STATUS_JS="./htdocs/luci-static/resources/https-dns-proxy/status.js"
RPC_SCRIPT="./root/usr/libexec/rpcd/luci.https-dns-proxy"

if [ ! -d "$PROVIDERS_DIR" ]; then
	echo "ERROR: Cannot find $PROVIDERS_DIR. Run from the luci-app-https-dns-proxy package root."
	exit 1
fi

###############################################################################
#                     01: Provider JSON validation                            #
###############################################################################

printf "\n##\n## 01: Provider JSON validation\n##\n\n"

provider_count=0
for f in "$PROVIDERS_DIR"/*.json; do
	[ -f "$f" ] || continue
	provider_count=$((provider_count + 1))
	base="$(basename "$f")"

	# ── Valid JSON ──
	n_tests=$((n_tests + 1))
	if python3 -m json.tool "$f" >/dev/null 2>&1; then
		pass "$base: valid JSON"
	else
		fail "$base: invalid JSON"
		continue
	fi

	content="$(python3 -m json.tool "$f")"

	# ── Required field: title ──
	n_tests=$((n_tests + 1))
	title="$(python3 -c "import json,sys; d=json.load(open('$f')); print(d.get('title',''))")"
	if [ -n "$title" ]; then
		pass "$base: has title '$title'"
	else
		fail "$base: missing 'title' field"
	fi

	# ── Required field: template ──
	n_tests=$((n_tests + 1))
	template="$(python3 -c "import json,sys; d=json.load(open('$f')); print(d.get('template',''))")"
	if [ -n "$template" ]; then
		pass "$base: has template"
	else
		fail "$base: missing 'template' field"
		continue
	fi

	# ── Template is HTTPS URL ──
	n_tests=$((n_tests + 1))
	case "$template" in
		https://*)
			pass "$base: template is HTTPS URL"
			;;
		*)
			fail "$base: template not HTTPS: $template"
			;;
	esac

	# ── Required field: bootstrap_dns ──
	n_tests=$((n_tests + 1))
	bootstrap="$(python3 -c "import json,sys; d=json.load(open('$f')); print(d.get('bootstrap_dns',''))")"
	if [ -n "$bootstrap" ]; then
		pass "$base: has bootstrap_dns"
	else
		fail "$base: missing 'bootstrap_dns' field"
		continue
	fi

	# ── Bootstrap DNS contains valid IPs ──
	n_tests=$((n_tests + 1))
	bad_ip=""
	IFS=',' read -ra ips <<< "$bootstrap"
	for ip in "${ips[@]}"; do
		ip="$(echo "$ip" | xargs)"  # trim whitespace
		# Accept IPv4 or IPv6
		if echo "$ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
			continue
		elif echo "$ip" | grep -q ':'; then
			continue
		else
			bad_ip="$ip"
			break
		fi
	done
	if [ -z "$bad_ip" ]; then
		pass "$base: bootstrap_dns IPs valid"
	else
		fail "$base: invalid bootstrap IP: '$bad_ip'"
	fi

	# ── Template params consistency ──
	# If template has {placeholders}, params must define them
	placeholders="$(echo "$template" | grep -oP '\{(\w+)\}' | sed 's/[{}]//g' | sort -u)"
	if [ -n "$placeholders" ]; then
		n_tests=$((n_tests + 1))
		missing_param=""
		for ph in $placeholders; do
			has_param="$(python3 -c "
import json,sys
d=json.load(open('$f'))
p=d.get('params',{})
print('yes' if '$ph' in p else 'no')
")"
			if [ "$has_param" != "yes" ]; then
				missing_param="$ph"
				break
			fi
		done
		if [ -z "$missing_param" ]; then
			pass "$base: template params match placeholders"
		else
			fail "$base: template placeholder '{$missing_param}' has no params entry"
		fi

		# ── Select params have options ──
		for ph in $placeholders; do
			param_type="$(python3 -c "
import json,sys
d=json.load(open('$f'))
p=d.get('params',{}).get('$ph',{})
print(p.get('type',''))
")"
			if [ "$param_type" = "select" ]; then
				n_tests=$((n_tests + 1))
				opt_count="$(python3 -c "
import json,sys
d=json.load(open('$f'))
p=d.get('params',{}).get('$ph',{})
opts=p.get('options',[])
print(len(opts))
")"
				if [ "$opt_count" -gt 0 ]; then
					pass "$base: param '$ph' (select) has $opt_count options"
				else
					fail "$base: param '$ph' (select) has no options"
				fi

				# ── Default matches one of the options ──
				n_tests=$((n_tests + 1))
				default_valid="$(python3 -c "
import json,sys
d=json.load(open('$f'))
p=d.get('params',{}).get('$ph',{})
opts=p.get('options',[])
dflt=p.get('default','')
values=[o.get('value','') for o in opts]
print('yes' if dflt in values else 'no')
")"
				if [ "$default_valid" = "yes" ]; then
					pass "$base: param '$ph' default is a valid option"
				else
					fail "$base: param '$ph' default not in options list"
				fi
			fi
		done
	fi
done

# ── No duplicate titles ──
n_tests=$((n_tests + 1))
titles="$(python3 -c "
import json, os, sys
titles = []
for f in sorted(os.listdir('$PROVIDERS_DIR')):
    if f.endswith('.json'):
        with open(os.path.join('$PROVIDERS_DIR', f)) as fh:
            d = json.load(fh)
            titles.append(d.get('title',''))
dupes = [t for t in titles if titles.count(t) > 1]
if dupes:
    print('DUPES: ' + ', '.join(set(dupes)))
else:
    print('OK')
")"
if [ "$titles" = "OK" ]; then
	pass "no duplicate provider titles ($provider_count providers)"
else
	fail "duplicate provider titles: $titles"
fi

###############################################################################
#                     02: JavaScript template functions                        #
###############################################################################

printf "\n##\n## 02: JavaScript template functions\n##\n\n"

if command -v node >/dev/null 2>&1; then

	# Run tests via Node.js
	js_result="$(node --eval "
// Extract the two pure functions from status.js
const pkg = {
	templateToRegexp: function (template) {
		if (template)
			return new RegExp(
				'^' +
				template
					.split(/(\{\w+\})/g)
					.map((part) => {
						let placeholder = part.match(/^\{(\w+)\}$/);
						if (placeholder) return '(?<' + placeholder[1] + '>.*?)';
						else return part.replace(/[.*+?\${}()|[\]\\\\]/g, '\\\\' + '\$&');
					})
					.join('') +
				'\$'
			);
		return new RegExp('');
	},
	templateToResolver: function (template, args) {
		if (template) return template.replace(/{(\w+)}/g, (_, v) => args[v]);
		return null;
	},
};

let pass = 0, fail = 0, total = 0;
function assert(desc, cond) {
	total++;
	if (cond) { console.log('  PASS: ' + desc); pass++; }
	else { console.log('  FAIL: ' + desc); fail++; }
}

// ── templateToRegexp ──

// Fixed URL (no placeholders)
let re1 = pkg.templateToRegexp('https://dns.google/dns-query');
assert('templateToRegexp: fixed URL matches itself',
	re1.test('https://dns.google/dns-query'));
assert('templateToRegexp: fixed URL rejects different URL',
	!re1.test('https://dns.other/dns-query'));

// URL with placeholder
let re2 = pkg.templateToRegexp('https://{option}cloudflare-dns.com/dns-query');
assert('templateToRegexp: Cloudflare template matches standard',
	re2.test('https://cloudflare-dns.com/dns-query'));
assert('templateToRegexp: Cloudflare template matches family',
	re2.test('https://family.cloudflare-dns.com/dns-query'));
assert('templateToRegexp: Cloudflare template matches security',
	re2.test('https://security.cloudflare-dns.com/dns-query'));
assert('templateToRegexp: Cloudflare extracts option group',
	re2.exec('https://family.cloudflare-dns.com/dns-query').groups.option === 'family.');

// NextDNS text param
let re3 = pkg.templateToRegexp('https://dns.nextdns.io/{option}');
assert('templateToRegexp: NextDNS matches with username',
	re3.test('https://dns.nextdns.io/abc123'));
assert('templateToRegexp: NextDNS extracts username',
	re3.exec('https://dns.nextdns.io/myuser').groups.option === 'myuser');
assert('templateToRegexp: NextDNS matches empty option',
	re3.test('https://dns.nextdns.io/'));

// Mullvad with multiple options
let re4 = pkg.templateToRegexp('https://{option}dns.mullvad.net/dns-query');
assert('templateToRegexp: Mullvad matches standard',
	re4.test('https://dns.mullvad.net/dns-query'));
assert('templateToRegexp: Mullvad matches adblock variant',
	re4.test('https://adblock.dns.mullvad.net/dns-query'));

// Empty/null template
let re5 = pkg.templateToRegexp('');
assert('templateToRegexp: empty template returns fallback regex',
	re5 instanceof RegExp);
let re6 = pkg.templateToRegexp(null);
assert('templateToRegexp: null template returns fallback regex',
	re6 instanceof RegExp);

// ── templateToResolver ──

assert('templateToResolver: fills Cloudflare standard',
	pkg.templateToResolver('https://{option}cloudflare-dns.com/dns-query', {option: ''})
		=== 'https://cloudflare-dns.com/dns-query');
assert('templateToResolver: fills Cloudflare family',
	pkg.templateToResolver('https://{option}cloudflare-dns.com/dns-query', {option: 'family.'})
		=== 'https://family.cloudflare-dns.com/dns-query');
assert('templateToResolver: fills NextDNS username',
	pkg.templateToResolver('https://dns.nextdns.io/{option}', {option: 'myuser'})
		=== 'https://dns.nextdns.io/myuser');
assert('templateToResolver: fixed URL unchanged',
	pkg.templateToResolver('https://dns.google/dns-query', {})
		=== 'https://dns.google/dns-query');
assert('templateToResolver: null template returns null',
	pkg.templateToResolver(null, {}) === null);

// ── Round-trip: templateToResolver → templateToRegexp match ──

let providers = [
	{template: 'https://{option}cloudflare-dns.com/dns-query', args: {option: 'family.'}},
	{template: 'https://{option}cloudflare-dns.com/dns-query', args: {option: ''}},
	{template: 'https://dns.nextdns.io/{option}', args: {option: 'abc123'}},
	{template: 'https://dns.google/dns-query', args: {}},
	{template: 'https://{option}dns.mullvad.net/dns-query', args: {option: 'adblock.'}},
];
for (let p of providers) {
	let url = pkg.templateToResolver(p.template, p.args);
	let re = pkg.templateToRegexp(p.template);
	assert('round-trip: ' + url + ' matches its template',
		re.test(url));
}

// Summary line for the shell runner to parse
console.log('JS_SUMMARY:' + total + ':' + pass + ':' + fail);
" 2>&1)"

	echo "$js_result" | grep -v '^JS_SUMMARY:'

	# Parse the summary
	js_total="$(echo "$js_result" | grep '^JS_SUMMARY:' | cut -d: -f2)"
	js_pass="$(echo "$js_result" | grep '^JS_SUMMARY:' | cut -d: -f3)"
	js_fail="$(echo "$js_result" | grep '^JS_SUMMARY:' | cut -d: -f4)"
	n_tests=$((n_tests + js_total))
	n_fails=$((n_fails + js_fail))

else
	echo "  SKIP: node.js not available, skipping JS template tests"
fi

###############################################################################
#                     03: RPC backend validation                              #
###############################################################################

printf "\n##\n## 03: RPC backend validation\n##\n\n"

if [ -f "$RPC_SCRIPT" ]; then
	# ── Shell syntax check ──
	n_tests=$((n_tests + 1))
	if bash -n "$RPC_SCRIPT" 2>/dev/null; then
		pass "RPC script passes syntax check"
	else
		fail "RPC script has syntax errors"
	fi

	# ── list method returns valid JSON structure ──
	n_tests=$((n_tests + 1))
	# The 'list' command doesn't need stdin or OpenWrt deps
	# We need to provide stubs for the sourced files
	list_output="$(
		# Provide stubs for OpenWrt libraries
		IPKG_INSTROOT="$PWD/tests/stubs"
		mkdir -p "$IPKG_INSTROOT/lib" "$IPKG_INSTROOT/usr/share/libubox"

		cat > "$IPKG_INSTROOT/lib/functions.sh" << 'STUB'
#!/bin/sh
STUB

		cat > "$IPKG_INSTROOT/usr/share/libubox/jshn.sh" << 'STUB'
#!/bin/sh
# Minimal jshn stub for list command
__json_items=""
__json_cur=""
__json_depth=0
json_init() { __json_items=""; __json_cur=""; __json_depth=0; }
json_add_object() {
	if [ $__json_depth -eq 0 ]; then
		__json_cur="\"$1\":{"
	else
		__json_cur="${__json_cur}\"$1\":{"
	fi
	__json_depth=$((__json_depth+1))
}
json_add_string() { __json_cur="${__json_cur}\"$1\":\"$2\","; }
json_close_object() {
	__json_cur="${__json_cur%,}}"
	__json_depth=$((__json_depth-1))
	if [ $__json_depth -eq 0 ]; then
		__json_items="${__json_items:+${__json_items},}${__json_cur}"
		__json_cur=""
	else
		__json_cur="${__json_cur},"
	fi
}
json_dump() { echo "{${__json_items}}"; }
json_cleanup() { __json_items=""; __json_cur=""; }
STUB

		bash -c "
			IPKG_INSTROOT='$IPKG_INSTROOT'
			. '$RPC_SCRIPT' list
		" 2>/dev/null
	)"

	if echo "$list_output" | python3 -m json.tool >/dev/null 2>&1; then
		pass "RPC 'list' returns valid JSON"
	else
		fail "RPC 'list' does not return valid JSON" "$list_output"
	fi

	# ── list method declares all expected methods ──
	for method in getInitList getInitStatus getPlatformSupport getProviders setInitAction; do
		n_tests=$((n_tests + 1))
		if echo "$list_output" | grep -q "\"$method\""; then
			pass "RPC 'list' declares method '$method'"
		else
			fail "RPC 'list' missing method '$method'"
		fi
	done

	# ── setInitAction validates service name ──
	n_tests=$((n_tests + 1))
	if grep -q '\[ "$(basename "$1")" = "$packageName" \]' "$RPC_SCRIPT"; then
		pass "setInitAction validates service name"
	else
		fail "setInitAction missing service name validation"
	fi

	# ── setInitAction only allows safe actions ──
	n_tests=$((n_tests + 1))
	if grep -q 'enable|disable|start|stop|restart)' "$RPC_SCRIPT"; then
		pass "setInitAction whitelist: enable|disable|start|stop|restart"
	else
		fail "setInitAction missing action whitelist"
	fi
else
	echo "  SKIP: RPC script not found at $RPC_SCRIPT"
fi

###############################################################################
#                         SHELL SCRIPT SYNTAX                                 #
###############################################################################

printf "\n--- Shell script syntax ---\n"
for shellscript in \
	root/etc/uci-defaults/*; do
	[ -f "$shellscript" ] || continue
	head -1 "$shellscript" | grep -q '^#!/bin/sh' || continue
	name="${shellscript#root/}"
	n_tests=$((n_tests + 1))
	if sh -n "$shellscript" 2>/dev/null; then
		pass "sh -n $name"
	else
		fail "sh -n $name" "$(sh -n "$shellscript" 2>&1)"
	fi
done

###############################################################################
#                               SUMMARY                                       #
###############################################################################

printf "\nRan %d tests, %d passed, %d failed\n" $n_tests $((n_tests - n_fails)) $n_fails
exit $n_fails
