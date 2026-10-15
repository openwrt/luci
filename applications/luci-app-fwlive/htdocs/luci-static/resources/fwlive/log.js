'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
'require baseclass';

/**
 * Shared CLASSIFY_SPEC.
 * Full-spec and regex drift are verified by the generator test suite.
 * LuCI-only helpers live in the @fwlive-codegen:luci-preserve region.
 */
const CLASSIFY_SPEC = {
	glueKeys: [
		'IN',
		'OUT',
		'SRC',
		'DST',
		'PROTO',
		'SPT',
		'DPT',
		'LEN',
		'MAC',
		'TYPE',
		'CODE',
		'TTL',
		'TOS',
		'PREC',
		'DF'
	],
	/* Classify trim (not JS String#trim): ASCII space/tab/LF/CR + NBSP (U+00A0). */
	trimWhitespace: [' ', '\t', '\n', '\r', '\u00a0'],
	nonFirewallPrefixes: [
		'dnsmasq',
		'procd',
		'ubusd',
		'netifd',
		'odhcpd',
		'logd',
		'dropbear',
		'uhttpd',
		'hostapd',
		'wpad'
	],
	nonFirewallPrefixHyphenContinuation: true,
	firewallHints: ['fw4', 'nft', 'iptables', 'kernel', 'firewall'],
	actionWords: ['ACCEPT', 'ALLOW', 'PASS', 'DROP', 'REJECT', 'DENY', 'BLOCK'],
	rules: [
		{
			or: [
				{ and: [{ kv: ['SRC'] }, { kv: ['DST'] }] },
				{
					and: [
						{ kvAny: ['IN', 'OUT'] },
						{ kvAny: ['SRC', 'DST', 'PROTO', 'SPT', 'DPT'] }
					]
				},
				{ and: [{ action: 'known' }, { kvAny: ['IN', 'OUT', 'PROTO', 'SRC', 'DST'] }] }
			]
		},
		{ and: [{ hint: true }, { action: 'known' }] },
		{ and: [{ hint: true }, { kvAny: ['IN', 'OUT', 'SRC', 'DST', 'PROTO'] }] }
	]
};

/* Validate the trusted module configuration once, before constructing regexes. */
validateClassifySpec(CLASSIFY_SPEC);

/* Compile only the finite KV vocabulary from the validated static rules. */
const KV_HAS_PATTERNS = Object.create(null);

function compileKvHasPatterns(node) {
	const keys = Object.keys(node);
	const operator = keys[0];
	if (operator === 'and' || operator === 'or') {
		for (let i = 0; i < node[operator].length; i++) compileKvHasPatterns(node[operator][i]);
		return;
	}
	if (operator !== 'kv' && operator !== 'kvAny') return;

	const names = node[operator];
	for (let i = 0; i < names.length; i++) {
		const name = names[i];
		if (!Object.prototype.hasOwnProperty.call(KV_HAS_PATTERNS, name)) {
			KV_HAS_PATTERNS[name] = new RegExp('(^|[^A-Za-z0-9_])' + name + '=');
		}
	}
}

for (let i = 0; i < CLASSIFY_SPEC.rules.length; i++) {
	compileKvHasPatterns(CLASSIFY_SPEC.rules[i]);
}

function validateClassifySpec(spec) {
	const validateNode = function (node) {
		if (!node || typeof node !== 'object' || Array.isArray(node))
			throw new Error('CLASSIFY_SPEC node must be an object');
		const keys = Object.keys(node);
		if (keys.length !== 1)
			throw new Error(
				'CLASSIFY_SPEC node must have exactly one key: ' + JSON.stringify(node)
			);
		const key = keys[0];
		if (key === 'and' || key === 'or') {
			const children = node[key];
			if (!Array.isArray(children))
				throw new Error('CLASSIFY_SPEC ' + key + ' node must be an array');
			if (children.length === 0)
				throw new Error('CLASSIFY_SPEC ' + key + ' node must be a non-empty array');
			for (let i = 0; i < children.length; i++) validateNode(children[i]);
			return;
		}
		if (key === 'kv' || key === 'kvAny') {
			const values = node[key];
			let valid = Array.isArray(values) && values.length > 0;
			for (let i = 0; valid && i < values.length; i++) {
				if (typeof values[i] !== 'string' || values[i].trim().length === 0) valid = false;
			}
			if (!valid)
				throw new Error(
					'CLASSIFY_SPEC ' +
						key +
						' predicate must be a non-empty array of non-empty strings'
				);
			for (let i = 0; i < values.length; i++) {
				if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(values[i]))
					throw new Error(
						'CLASSIFY_SPEC ' + key + ' predicate contains an invalid KV name'
					);
			}
			return;
		}
		if (key === 'action') {
			if (node.action !== 'known')
				throw new Error('CLASSIFY_SPEC action predicate must be "known"');
			return;
		}
		if (key === 'hint') {
			if (node.hint !== true) throw new Error('CLASSIFY_SPEC hint predicate must be true');
			return;
		}
		throw new Error('unrecognised CLASSIFY_SPEC predicate node: ' + JSON.stringify(node));
	};

	if (!Array.isArray(spec.rules) || spec.rules.length === 0)
		throw new Error('CLASSIFY_SPEC rules must be a non-empty array');
	for (let i = 0; i < spec.rules.length; i++) validateNode(spec.rules[i]);
}

function wordPattern(words) {
	const alt = words.join('|');
	return new RegExp('(^|[^A-Za-z0-9_])(' + alt + ')([^A-Za-z0-9_]|$)', 'i');
}

function classifyTrim(s) {
	const ws = CLASSIFY_SPEC.trimWhitespace;
	let start = 0;
	let end = s.length;
	while (start < end && ws.indexOf(s.charAt(start)) >= 0) start++;
	while (end > start && ws.indexOf(s.charAt(end - 1)) >= 0) end--;
	return s.slice(start, end);
}

/* ---- spec-derived classification regexes ---- */
const DENY_CLASS_WORDS = CLASSIFY_SPEC.actionWords.slice(3);
const NON_FIREWALL_PREFIX = new RegExp(
	'^(' +
		CLASSIFY_SPEC.nonFirewallPrefixes.join('|') +
		')(' +
		(CLASSIFY_SPEC.nonFirewallPrefixHyphenContinuation ? '[^A-Za-z0-9_-]' : '[^A-Za-z0-9_]') +
		'|$)',
	'i'
);
const FIREWALL_HINT = wordPattern(CLASSIFY_SPEC.firewallHints);
const ACTION_RE = wordPattern(CLASSIFY_SPEC.actionWords);
const DENY_ACTION = wordPattern(DENY_CLASS_WORDS);
const DENY_ACTION_UNDERSCORE = new RegExp(
	'(?:^|[^A-Za-z0-9])(?:' + DENY_CLASS_WORDS.join('|') + ')(?:[^A-Za-z0-9]|$)',
	'i'
);
const NETFILTER_KV_GLUE = new RegExp(
	'([^\\s])(?=(' + CLASSIFY_SPEC.glueKeys.join('|') + ')=)',
	'g'
);

return baseclass.extend({
	CLASSIFY_SPEC: CLASSIFY_SPEC,
	validateClassifySpec: validateClassifySpec,

	TCP_FLAG_TAIL:
		/\b((?:SYN|ACK|FIN|RST|PSH|URG|ECE|CWR)(?:\s+(?:SYN|ACK|FIN|RST|PSH|URG|ECE|CWR))*)(?:\s+[A-Z][A-Z0-9_]*=[^\s]+)*\s*$/i,
	NETFILTER_KV_GLUE: NETFILTER_KV_GLUE,

	kvHas: function (msg, key) {
		if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(KV_HAS_PATTERNS, key)) {
			return KV_HAS_PATTERNS[key].test(msg);
		}

		/* Preserve direct, non-spec calls without retaining arbitrary keys. */
		return new RegExp('(^|[^A-Za-z0-9_])' + key + '=').test(msg);
	},

	NON_FIREWALL_PREFIX: NON_FIREWALL_PREFIX,
	FIREWALL_HINT: FIREWALL_HINT,
	ACTION_RE: ACTION_RE,
	DENY_ACTION: DENY_ACTION,
	DENY_ACTION_UNDERSCORE: DENY_ACTION_UNDERSCORE,
	MAX_DATE_SECONDS: 8640000000000,

	normalizeNetfilterMessage: function (message) {
		if (typeof message !== 'string') message = '';
		return message.replace(this.NETFILTER_KV_GLUE, '$1 ');
	},

	parseKeyValueLog: function (message) {
		const out = {};
		const re = /\b([A-Z]+)=([^\s]+)/g;
		const normalized = this.normalizeNetfilterMessage(message);
		let match;

		while ((match = re.exec(normalized)) !== null) out[match[1]] = match[2];

		return out;
	},

	detectAction: function (message) {
		const m = message.match(this.ACTION_RE);
		return m ? m[2].toUpperCase() : 'UNKNOWN';
	},

	evaluateClassifySpec: function (message, actionRaw) {
		const msg = this.normalizeNetfilterMessage(message || '');
		const action = actionRaw === undefined ? this.detectAction(msg) : actionRaw;
		const self = this;
		const has = function (key) {
			return self.kvHas(msg, key);
		};
		const hasAny = function (keys) {
			for (let i = 0; i < keys.length; i++) {
				if (has(keys[i])) return true;
			}
			return false;
		};

		const pred = {
			kv: function (c) {
				for (let i = 0; i < c.kv.length; i++) {
					if (!has(c.kv[i])) return false;
				}
				return true;
			},
			kvAny: function (c) {
				return hasAny(c.kvAny);
			},
			action: function (c) {
				return c.action === 'known' ? action !== 'UNKNOWN' : true;
			},
			hint: function () {
				return self.FIREWALL_HINT.test(msg);
			}
		};

		const evalNode = function (node) {
			const keys = Object.keys(node);
			const key = keys[0];
			if (key === 'and') {
				for (let i = 0; i < node.and.length; i++) {
					if (!evalNode(node.and[i])) return false;
				}
				return true;
			}
			if (key === 'or') {
				for (let i = 0; i < node.or.length; i++) {
					if (evalNode(node.or[i])) return true;
				}
				return false;
			}
			return pred[key](node);
		};

		for (let i = 0; i < this.CLASSIFY_SPEC.rules.length; i++) {
			if (evalNode(this.CLASSIFY_SPEC.rules[i])) return true;
		}
		return false;
	},

	normalizeAction: function (raw) {
		const a = (raw || '').toUpperCase();
		const words = this.CLASSIFY_SPEC.actionWords;
		const pass = words.slice(0, 3); /* ACCEPT|ALLOW|PASS */
		const denyClass = words.slice(3); /* DROP|REJECT|DENY|BLOCK — positional */
		if (pass.indexOf(a) >= 0) return 'pass';
		if (a === words[3]) /* DROP */ return 'drop';
		if (a === words[4]) /* REJECT */ return 'reject';
		if (denyClass.indexOf(a) >= 0) /* DENY|BLOCK */ return 'block';
		return 'unknown';
	},

	parseRuleHint: function (message) {
		let msg = this.normalizeNetfilterMessage(message || '').trim();
		msg = msg.replace(/^\[\s*[\d.]+\]\s*/, '');

		if (/^fw4:\s*/i.test(msg)) return 'fw4';

		const beforeKv = msg.match(/^([A-Za-z0-9_.-]+)(?::|\s+)(?=IN=|OUT=|SRC=|DST=|PROTO=)/);
		if (beforeKv) return beforeKv[1];

		const colon = msg.match(/^([A-Za-z0-9_.-]+):/);
		if (colon) {
			const tag = colon[1].toLowerCase();
			if (tag !== 'kernel' && tag !== 'iptables') return colon[1];
		}

		return '';
	},

	formatRuleLabel: function (hint) {
		if (!hint) return '';

		if (hint === 'fw4') return 'Firewall4';

		return hint.replace(/-/g, ' ');
	},

	inferActionRaw: function (message, kv, actionRaw) {
		if (actionRaw && actionRaw !== 'UNKNOWN') return actionRaw;

		const msg = this.normalizeNetfilterMessage(message || '');
		const withoutKv = msg.replace(/\b[A-Z]+=[^\s]*/g, ' ');
		if (this.DENY_ACTION.test(withoutKv) || this.DENY_ACTION_UNDERSCORE.test(withoutKv))
			return 'UNKNOWN';

		if (/^kernel:/i.test(msg.trim())) return 'UNKNOWN';

		const hasTuple = !!(kv.IN || kv.OUT) && !!(kv.SRC || kv.DST || kv.PROTO);
		if (hasTuple) return 'PASS';

		return 'UNKNOWN';
	},

	parseFlags: function (message, kv) {
		if (kv.TCPFLAGS) return kv.TCPFLAGS;
		if (kv.FLAGS) return kv.FLAGS;

		const m = message.match(this.TCP_FLAG_TAIL);
		if (!m) return '';

		return m[1].trim().toUpperCase().replace(/\s+/g, ',');
	},

	parseLength: function (kv) {
		const len = kv.LEN || kv.LENGTH || '';
		if (!len) return null;

		const n = parseInt(len, 10);
		return isFinite(n) ? n : null;
	},

	timestampUnix: function (entry) {
		if (!entry || entry.time == null || entry.time === '') return null;

		if (typeof entry.time === 'string' && /^\d{4}-\d{2}-\d{2}[T ]/.test(entry.time)) {
			const ms = new Date(entry.time).getTime();
			if (isFinite(ms)) {
				const unix = Math.floor(ms / 1000);
				return Math.abs(unix) <= this.MAX_DATE_SECONDS ? unix : null;
			}
		}

		const n = Number(entry.time);
		if (!isFinite(n)) return null;

		const unix = Math.abs(n) > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
		return Math.abs(unix) <= this.MAX_DATE_SECONDS ? unix : null;
	},

	formatTimestampDisplay: function (entry) {
		const unix = this.timestampUnix(entry);
		if (unix == null) return '';

		return new Date(unix * 1000).toISOString();
	},

	/* @fwlive-codegen:luci-preserve-begin */
	formatTimestampLocal: function (unix) {
		if (unix == null || !isFinite(unix)) return '';

		const d = new Date(unix * 1000);
		const pad = function (n) {
			return (n < 10 ? '0' : '') + n;
		};

		return '%d-%s-%s %s:%s:%s'.format(
			d.getFullYear(),
			pad(d.getMonth() + 1),
			pad(d.getDate()),
			pad(d.getHours()),
			pad(d.getMinutes()),
			pad(d.getSeconds())
		);
	},

	formatTimestampCompact: function (unix) {
		if (unix == null || !isFinite(unix)) return '';

		const d = new Date(unix * 1000);
		const pad = function (n) {
			return (n < 10 ? '0' : '') + n;
		};

		return '%s:%s:%s'.format(pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds()));
	},

	formatCell: function (value) {
		if (value == null || value === '') return '';

		return String(value);
	},

	formatActionLabel: function (action) {
		const a = (action || '').toLowerCase();
		if (!a || a === 'unknown') return '—';
		return a;
	},

	formatMessageDisplay: function (message, layout) {
		let m = this.normalizeNetfilterMessage(message || '');
		m = m.replace(/^\[\s*[\d.]+\]\s*/, '');
		m = m.replace(/\bMAC=[^\s]+/g, '');
		m = m.replace(/\s+/g, ' ').trim();

		if (layout === 'oneline') return m;

		if (m.length > 240) return m.substring(0, 237) + '…';

		return m;
	},

	filterFieldLabel: function (field) {
		const labels = {
			'q': _('Search'),
			'action': _('Action'),
			'interface': _('Interface'),
			'proto': _('Proto'),
			'src': _('Source'),
			'dst': _('Destination'),
			'sport': _('Source port'),
			'dport': _('Destination port')
		};

		return labels[field] || field;
	},
	/* @fwlive-codegen:luci-preserve-end */

	isFirewallEvent: function (entry) {
		const msg = classifyTrim(this.normalizeNetfilterMessage((entry && entry.msg) || ''));
		if (!msg) return false;

		if (this.NON_FIREWALL_PREFIX.test(msg)) return false;

		return this.evaluateClassifySpec(msg);
	},

	makeEntryId: function (
		entry,
		tsUnix,
		action,
		src,
		dst,
		sport,
		dport,
		proto,
		ifaceIn,
		ifaceOut
	) {
		if (entry && entry.id != null && entry.id !== '') return 'log:' + entry.id;

		return [
			tsUnix,
			action,
			src,
			dst,
			sport,
			dport,
			proto,
			ifaceIn,
			ifaceOut,
			entry.msg || ''
		].join('|');
	},

	extractAddrs: function (kv) {
		return {
			src: kv.SRC || '',
			dst: kv.DST || '',
			sport: kv.SPT || '',
			dport: kv.DPT || ''
		};
	},

	extractIfaces: function (kv) {
		const ifaceIn = kv.IN || '';
		const ifaceOut = kv.OUT || '';
		return {
			ifaceIn: ifaceIn,
			ifaceOut: ifaceOut,
			iface: ifaceIn || ifaceOut || '',
			dir: ifaceIn && ifaceOut ? 'forward' : ifaceIn ? 'in' : ifaceOut ? 'out' : 'unknown'
		};
	},

	normalizeEntry: function (entry) {
		const message = this.normalizeNetfilterMessage(entry.msg || '');
		const kv = this.parseKeyValueLog(message);
		const tsUnix = this.timestampUnix(entry);
		const tsDisplay = this.formatTimestampDisplay(entry);
		const proto = (kv.PROTO || '').toUpperCase();
		const actionRaw = this.inferActionRaw(message, kv, this.detectAction(message));
		const action = this.normalizeAction(actionRaw);
		const addrs = this.extractAddrs(kv);
		const ifs = this.extractIfaces(kv);
		const flags = this.parseFlags(message, kv);
		const length = this.parseLength(kv);
		const ruleHint = this.parseRuleHint(message);
		const ruleLabel = this.formatRuleLabel(ruleHint);

		return {
			id: this.makeEntryId(
				entry,
				tsUnix,
				action,
				addrs.src,
				addrs.dst,
				addrs.sport,
				addrs.dport,
				proto,
				ifs.ifaceIn,
				ifs.ifaceOut
			),
			log_id: entry && entry.id != null ? Number(entry.id) : null,
			timestamp: tsUnix,
			timestamp_display: tsDisplay,
			rule_hint: ruleHint,
			rule_label: ruleLabel,
			action: action,
			action_raw: actionRaw,
			interface: ifs.iface,
			interface_in: ifs.ifaceIn,
			interface_out: ifs.ifaceOut,
			direction: ifs.dir,
			proto: proto,
			src: addrs.src,
			sport: addrs.sport,
			dst: addrs.dst,
			dport: addrs.dport,
			flags: flags,
			length: length,
			message: entry.msg || ''
		};
	},

	parseFilterValue: function (val) {
		const s = (val || '').trim();
		if (!s) return { negate: false, value: '' };

		if (s.charAt(0) === '!') return { negate: true, value: s.slice(1).trim() };

		return { negate: false, value: s };
	},

	toggleFilterNegation: function (val) {
		const p = this.parseFilterValue(val);
		if (!p.value) return val;

		return p.negate ? p.value : '!' + p.value;
	},

	formatFilterChipLabel: function (field, val) {
		const p = this.parseFilterValue(val);
		if (!p.value) return '';

		return _('%s: %s').format(field, val);
	},

	matchesTextField: function (haystack, spec) {
		const p = this.parseFilterValue(spec);
		if (!p.value) return true;

		const hit = (haystack || '').toLowerCase().indexOf(p.value.toLowerCase()) !== -1;
		return p.negate ? !hit : hit;
	},

	matchesExactField: function (haystack, spec) {
		const p = this.parseFilterValue(spec);
		if (!p.value) return true;

		const want = p.value.toUpperCase();
		const got = (haystack || '').toUpperCase();
		const hit = got === want;
		return p.negate ? !hit : hit;
	},

	matchesQueryField: function (row, spec) {
		const p = this.parseFilterValue(spec);
		if (!p.value) return true;

		const keys = Object.keys(row);
		const parts = [];
		for (let i = 0; i < keys.length; i++) parts.push(row[keys[i]]);
		const blob = parts.join(' ').toLowerCase();
		const hit = blob.indexOf(p.value.toLowerCase()) !== -1;
		return p.negate ? !hit : hit;
	},

	matchesActionField: function (row, spec) {
		const p = this.parseFilterValue(spec);
		if (!p.value) return true;

		const want = p.value.toLowerCase();
		const hit =
			row.action === want || (row.action_raw || '').toUpperCase() === p.value.toUpperCase();
		return p.negate ? !hit : hit;
	},

	matchesInterfaceField: function (row, spec) {
		const p = this.parseFilterValue(spec);
		if (!p.value) return true;

		const iface = p.value;
		const hit =
			row.interface === iface || row.interface_in === iface || row.interface_out === iface;
		return p.negate ? !hit : hit;
	},

	/* Fields matchesFilter compares by substring ("contains"); the rest match exactly. */
	isSubstringFilterField: function (key) {
		return key === 'q' || key === 'src' || key === 'dst';
	},

	matchesFilter: function (row, filters) {
		if (filters.q && !this.matchesQueryField(row, filters.q)) return false;
		if (filters.action && !this.matchesActionField(row, filters.action)) return false;
		if (filters.interface && !this.matchesInterfaceField(row, filters.interface)) return false;
		if (filters.proto && !this.matchesExactField(row.proto, filters.proto)) return false;
		if (filters.src && !this.matchesTextField(row.src, filters.src)) return false;
		if (filters.dst && !this.matchesTextField(row.dst, filters.dst)) return false;
		if (filters.sport && !this.matchesExactField(row.sport, filters.sport)) return false;
		if (filters.dport && !this.matchesExactField(row.dport, filters.dport)) return false;
		return true;
	},

	actionRowClass: function (action) {
		const a = (action || '').toLowerCase();
		if (a === 'drop' || a === 'reject' || a === 'block') return 'fwlive-action fwlive-deny';
		if (a === 'pass') return 'fwlive-action fwlive-pass';
		return 'fwlive-action fwlive-unknown';
	}
});
