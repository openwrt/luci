'use strict';
'require view';
'require poll';
'require fs';
'require ui';
'require dom';

var expr_translations = {
	'meta.iifname': _('Ingress device name', 'nft meta iifname'),
	'meta.oifname': _('Egress device name', 'nft meta oifname'),
	'meta.iif': _('Ingress device id', 'nft meta iif'),
	'meta.oif': _('Egress device id', 'nft meta oif'),

	'meta.l4proto': _('IP protocol', 'nft meta l4proto'),
	'meta.l4proto.tcp': 'TCP',
	'meta.l4proto.udp': 'UDP',
	'meta.l4proto.icmp': 'ICMP',
	'meta.l4proto.icmpv6': 'ICMPv6',
	'meta.l4proto.ipv6-icmp': 'ICMPv6',

	'meta.nfproto': _('Address family', 'nft meta nfproto'),
	'meta.nfproto.ipv4': 'IPv4',
	'meta.nfproto.ipv6': 'IPv6',

	'meta.mark': _('Packet mark', 'nft meta mark'),

	'meta.time': _('Packet receive time', 'nft meta time'),
	'meta.hour': _('Current time', 'nft meta hour'),
	'meta.day': _('Current weekday', 'nft meta day'),

	'ct.state': _('Conntrack state', 'nft ct state'),

	'ct.status': _('Conntrack status', 'nft ct status'),
	'ct.status.dnat': 'DNAT',

	'ip.protocol': _('IP protocol', 'nft ip protocol'),
	'ip.protocol.tcp': 'TCP',
	'ip.protocol.udp': 'UDP',
	'ip.protocol.icmp': 'ICMP',
	'ip.protocol.icmpv6': 'ICMPv6',
	'ip.protocol.ipv6-icmp': 'ICMPv6',

	'ip.saddr': _('Source IP', 'nft ip saddr'),
	'ip.daddr': _('Destination IP', 'nft ip daddr'),
	'ip.sport': _('Source port', 'nft ip sport'),
	'ip.dport': _('Destination port', 'nft ip dport'),
	'ip6.saddr': _('Source IPv6', 'nft ip6 saddr'),
	'ip6.daddr': _('Destination IPv6', 'nft ip6 daddr'),
	'icmp.code': _('ICMP code', 'nft icmp code'),
	'icmp.type': _('ICMP type', 'nft icmp type'),
	'icmpv6.code': _('ICMPv6 code', 'nft icmpv6 code'),
	'icmpv6.type': _('ICMPv6 type', 'nft icmpv6 type'),
	'tcp.sport': _('TCP source port', 'nft tcp sport'),
	'tcp.dport': _('TCP destination port', 'nft tcp dport'),
	'udp.sport': _('UDP source port', 'nft udp sport'),
	'udp.dport': _('UDP destination port', 'nft udp dport'),
	'tcp.flags': _('TCP flags', 'nft tcp flags'),
	'th.sport': _('Transport header source port', 'nft th sport'),
	'th.dport': _('Transport header destination port', 'nft th dport'),

	'natflag.random': _('Randomize source port mapping', 'nft nat flag random'),
	'natflag.fully-random': _('Full port randomization', 'nft nat flag fully-random'),
	'natflag.persistent': _('Use same source and destination for each connection', 'nft nat flag persistent'),

	'rt.mtu': _('Effective route MTU', 'nft rt mtu'),

	'tcpoption.maxseg.size': _('TCP MSS', 'nft tcp option maxseg size'),

	'unit.packets': _('packets', 'nft unit'),
	'unit.mbytes': _('MiB', 'nft unit'),
	'unit.kbytes': _('KiB', 'nft unit'),
	'unit.week': _('week', 'nft unit'),
	'unit.day': _('day', 'nft unit'),
	'unit.hour': _('hour', 'nft unit'),
	'unit.minute': _('minute', 'nft unit'),

	'payload.ll': _('Link layer header bits %d-%d', 'nft @ll,off,len'),
	'payload.nh': _('Network header bits %d-%d', 'nft @nh,off,len'),
	'payload.th': _('Transport header bits %d-%d', 'nft @th,off,len')
};

var op_translations = {
	'==': _('<var>%s</var> is <strong>%s</strong>', 'nft relational "==" operator expression'),
	'!=': _('<var>%s</var> not <strong>%s</strong>', 'nft relational "!=" operator expression'),
	'>=': _('<var>%s</var> greater than or equal to <strong>%s</strong>', 'nft relational ">=" operator expression'),
	'<=': _('<var>%s</var> lower than or equal to <strong>%s</strong>', 'nft relational "<=" operator expression'),
	'>': _('<var>%s</var> greater than <strong>%s</strong>', 'nft relational ">" operator expression'),
	'<': _('<var>%s</var> lower than <strong>%s</strong>', 'nft relational "<" operator expression'),
	'in': _('<var>%s</var> is one of <strong>%s</strong>', 'nft relational "in" operator expression'),
	'in_set': _('<var>%s</var> in set <strong>%s</strong>', 'nft set match expression'),
	'not_in_set': _('<var>%s</var> not in set <strong>%s</strong>', 'nft not in set match expression'),
};

var action_translations = {
	'accept': _('Accept packet', 'nft accept action'),
	'notrack': _('Do not track', 'nft notrack action'),
	'drop': _('Drop packet', 'nft drop action'),
	'jump': _('Continue in <strong><a href="#%q.%q">%h</a></strong>', 'nft jump action'),
	'log': _('Log event "<strong>%h</strong>…"', 'nft log action'),

	'reject.tcp reset': _('Reject packet with <strong>TCP reset</strong>', 'nft reject with tcp reset'),
	'reject.icmp': _('Reject IPv4 packet with <strong>ICMP type %h</strong>', 'nft reject with icmp type'),
	'reject.icmpv6': _('Reject packet with <strong>ICMPv6 type %h</strong>', 'nft reject with icmpv6 type'),
	'reject.icmpx': _('Reject packet with <strong>ICMP type %h</strong>', 'nft reject with icmpx type'),

	'snat.ip.addr': _('Rewrite source to <strong>%h</strong>', 'nft snat ip to addr'),
	'snat.ip.addr.port': _('Rewrite source to <strong>%h</strong>, port <strong>%h</strong>', 'nft snat ip to addr:port'),

	'snat.ip6.addr': _('Rewrite source to <strong>%h</strong>', 'nft snat ip6 to addr'),
	'snat.ip6.addr.port': _('Rewrite source to <strong>%h</strong>, port <strong>%h</strong>', 'nft snat ip6 to addr:port'),

	'dnat.ip.addr': _('Rewrite destination to <strong>%h</strong>', 'nft dnat ip to addr'),
	'dnat.ip.addr.port': _('Rewrite destination to <strong>%h</strong>, port <strong>%h</strong>', 'nft dnat ip to addr:port'),

	'dnat.ip6.addr': _('Rewrite destination to <strong>%h</strong>', 'nft dnat ip6 to addr'),
	'dnat.ip6.addr.port': _('Rewrite destination to <strong>%h</strong>, port <strong>%h</strong>', 'nft dnat ip6 to addr:port'),

	'redirect': _('Redirect to local system', 'nft redirect'),
	'redirect.port': _('Redirect to local port <strong>%h</strong>', 'nft redirect to port'),

	'masquerade': _('Rewrite to egress device address'),

	'mangle': _('Set header field <var>%s</var> to <strong>%s</strong>', 'nft mangle'),

	'limit': _('At most <strong>%h</strong> per <strong>%h</strong>, burst of <strong>%h</strong>'),
	'limit.burst': _('At most <strong>%h</strong> per <strong>%h</strong>, burst of <strong>%h</strong>'),
	'limit.inv': _('At least <strong>%h</strong> per <strong>%h</strong>, burst of <strong>%h</strong>'),
	'limit.inv.burst': _('At least <strong>%h</strong> per <strong>%h</strong>, burst of <strong>%h</strong>'),

	'return': _('Continue in calling chain'),

	'flow': _('Utilize flow table <strong>%h</strong>')
};

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/usr/sbin/nft', [ '--terse', '--json', 'list', 'ruleset' ], 'json'), {}),
			L.resolveDefault(fs.exec_direct('/usr/sbin/iptables-save'), ''),
			L.resolveDefault(fs.exec_direct('/usr/sbin/ip6tables-save'), '')
		]);
	},

	isActionExpression: function(expr) {
		for (var k in expr) {
			if (expr.hasOwnProperty(k)) {
				switch (k) {
				case 'accept':
				case 'notrack':
				case 'reject':
				case 'drop':
				case 'jump':
				case 'snat':
				case 'dnat':
				case 'redirect':
				case 'mangle':
				case 'masquerade':
				case 'return':
				case 'flow':
				case 'log':
					return true;
				}
			}
		}

		return false;
	},

	exprToKey: function(expr) {
		var kind, spec;

		if (!Array.isArray(expr) && typeof(expr) == 'object') {
			for (var k in expr) {
				if (expr.hasOwnProperty(k)) {
					kind = k;
					spec = expr[k];
					break;
				}
			}
		}

		switch (kind || '-') {
		case 'meta':
		case 'ct':
		case 'rt':
			return '%h.%h'.format(kind, spec.key);

		case 'tcp option':
			return 'tcpoption.%h.%h'.format(spec.name, spec.field);

		case 'reject':
			return 'reject.%h'.format(spec.type);
		}

		return null;
	},

	exprToString: function(expr, hint) {
		var kind, spec;

		if (typeof(expr) != 'object') {
			var s;

			if (hint)
				s = expr_translations['%s.%h'.format(hint, expr)];

			return s || '%h'.format(expr);
		}

		if (Array.isArray(expr)) {
			kind = 'list';
			spec = expr;
		}
		else {
			for (var k in expr) {
				if (expr.hasOwnProperty(k)) {
					kind = k;
					spec = expr[k];
				}
			}
		}

		if (!kind)
			return '';

		switch (kind) {
		case 'prefix':
			return '%h/%d'.format(spec.addr, spec.len);

		case 'set':
		case 'list':
			var items = [],
			    lis = [];

			for (var i = 0; i < spec.length; i++) {
				items.push('<span class="nft-set-item">%s</span>'.format(this.exprToString(spec[i])));
				lis.push('<span class="ifacebadge">%s</span>'.format(this.exprToString(spec[i])));
			}

			var tpl;

			if (kind == 'set')
				tpl = '<div class="nft-set cbi-tooltip-container">{ <span class="nft-set-items">%s</span> }<div class="cbi-tooltip">%s</div></div>';
			else
				tpl = '<div class="nft-list cbi-tooltip-container"><span class="nft-list-items">%s</span><div class="cbi-tooltip">%s</div></div>';

			return tpl.format(items.join(', '), lis.join('<br />'));

		case 'concat':
			var items = [];

			for (var i = 0; i < spec.length; i++)
				items.push(this.exprToString(spec[i]));

			return items.join('+');

		case 'range':
			return '%s-%s'.format(this.exprToString(spec[0], hint), this.exprToString(spec[1], hint));

		case 'payload':
			if (spec.protocol && spec.field) {
				var k = '%h.%h'.format(spec.protocol, spec.field);
				return expr_translations[k] || '<em>%s</em>'.format(k);
			}
			else if (spec.base && spec.offset != null && spec.len != null) {
				var k = 'payload.%h'.format(spec.base);
				return (expr_translations[k] || '<em>@%s,%%d,%%d</em>'.format(spec.base)).format(spec.offset + 1, spec.offset + spec.len + 1);
			}

			return 'payload: %s'.format(kind, JSON.stringify(spec));

		case '&':
		case '|':
		case '^':
			return '%s %h %s'.format(
				this.exprToString(spec[0], hint),
				kind,
				Array.isArray(spec[1]) ? '(%h)'.format(spec[1].join('|')) : this.exprToString(spec[1], hint));

		default:
			var k = this.exprToKey(expr);

			if (k)
				return expr_translations[k] || '<em>%s</em>'.format(k);

			return '%s: %s'.format(kind, JSON.stringify(spec));
		}
	},

	renderMatchExpr: function(spec) {
		switch (spec.op) {
		case '==':
		case '!=':
			if ((typeof(spec.right) == 'object' && spec.right.set) ||
			    (typeof(spec.right) == 'string' && spec.right.charAt(0) == '@'))
				spec.op = (spec.op == '==') ? 'in_set' : 'not_in_set';

			break;

		case 'in':
			if (typeof(spec.right) != 'object')
				spec.op = '==';

			break;
		}

		return E('span', { 'class': 'ifacebadge' },
			(op_translations[spec.op] || '<var>%%s</var> %h <strong>%%s</strong>'.format(spec.op)).format(
				this.exprToString(spec.left),
				this.exprToString(spec.right, this.exprToKey(spec.left))
			)
		);
	},

	renderNatFlags: function(spec) {
		var f = [];

		if (spec && Array.isArray(spec.flags)) {
			for (var i = 0; i < spec.flags.length; i++)
				f.push(expr_translations['natflag.%h'.format(spec.flags[i])] || spec.flags[i]);
		}

		return f.length ? E('small', { 'class': 'cbi-tooltip-container' }, [
			' (',
			N_(f.length, '1 flag', '%d flags', 'nft amount of flags').format(f.length),
			')',
			E('span', { 'class': 'cbi-tooltip' }, f.join('<br />'))
		]) : E([]);
	},

	renderRateUnit: function(value, unit) {
		if (!unit)
			unit = 'packets';

		return '%d\xa0%s'.format(
			value,
			expr_translations['unit.%h'.format(unit)] || unit
		);
	},

	renderExpr: function(expr, table) {
		var kind, spec;

		for (var k in expr) {
			if (expr.hasOwnProperty(k)) {
				kind = k;
				spec = expr[k];
			}
		}

		if (!kind)
			return E([]);

		switch (kind) {
		case 'match':
			return this.renderMatchExpr(spec);

		case 'reject':
			var k = 'reject.%s'.format(spec.type);

			return E('span', {
				'class': 'ifacebadge'
			}, (action_translations[k] || k).format(this.exprToString(spec.expr)));

		case 'accept':
		case 'notrack':
		case 'drop':
			return E('span', {
				'class': 'ifacebadge'
			}, action_translations[kind] || '<em>%h</em>'.format(kind));

		case 'jump':
			return E('span', {
				'class': 'ifacebadge'
			}, action_translations.jump.format(table, spec.target, spec.target));

		case 'return':
			return E('span', {
				'class': 'ifacebadge'
			}, action_translations.return);

		case 'snat':
		case 'dnat':
			var k = '%h.%h'.format(kind, spec.family),
			    a = [];

			if (spec.addr) {
				k += '.addr';
				a.push(this.exprToString(spec.addr));
			}

			if (spec.port) {
				k += '.port';
				a.push(this.exprToString(spec.port));
			}

			return E('span', { 'class': 'ifacebadge' }, [
				E('span', ''.format.apply(action_translations[k] || k, a)),
				this.renderNatFlags(spec)
			]);

		case 'redirect':
			var k = 'redirect',
			    a = [];

			if (spec && spec.port) {
				k += '.port';
				a.push(this.exprToString(spec.port));
			}

			return E('span', { 'class': 'ifacebadge' }, [
				E('span', ''.format.apply(action_translations[k] || k, a)),
				this.renderNatFlags(spec)
			]);

		case 'masquerade':
			return E('span', { 'class': 'ifacebadge' }, [
				E('span', action_translations.masquerade),
				this.renderNatFlags(spec)
			]);

		case 'mangle':
			return E('span', { 'class': 'ifacebadge' },
				action_translations.mangle.format(
					this.exprToString(spec.key),
					this.exprToString(spec.value)
				));

		case 'limit':
			var k = 'limit';
			var a = [
				this.renderRateUnit(spec.rate, spec.rate_unit),
				expr_translations['unit.%h'.format(spec.per)] || spec.per
			];

			if (spec.inv)
				k += '.inv';

			if (spec.burst) {
				k += '.burst';
				a.push(this.renderRateUnit(spec.burst, spec.burst_unit));
			}

			return E('span', { 'class': 'ifacebadge', 'cbi-tooltip': JSON.stringify(spec) },
				''.format.apply(action_translations[k] || k, a));

		case 'flow':
			return E('span', {
				'class': 'ifacebadge'
			}, action_translations.flow.format(spec.flowtable.replace(/^@/, '')));

		case 'log':
			return E('span', {
				'class': 'ifacebadge'
			}, action_translations.log.format(spec.prefix));

		default:
			return E('span', {
				'class': 'ifacebadge',
				'data-tooltip': JSON.stringify(spec)
			}, [ '{ ', E('strong', {}, [ kind ]), ' }' ]);
		}
	},

	renderCounter: function(data) {
		return E('span', { 'class': 'ifacebadge cbi-tooltip-container nft-counter' }, [
			E('var', [ '%.1024mB'.format(data.bytes) ]),
			E('div', { 'class': 'cbi-tooltip' }, [
				_('Traffic matched by rule: %.1000mPackets, %.1024mBytes', 'nft counter').format(data.packets, data.bytes)
			])
		]);
	},

	renderComment: function(comment) {
		return E('span', { 'class': 'ifacebadge cbi-tooltip-container nft-comment' }, [
			E('var', [ '#' ]),
			E('div', { 'class': 'cbi-tooltip' }, [
				_('Rule comment: %s', 'nft comment').format(comment.replace(/^!fw4: /, ''))
			])
		]);
	},

	renderRule: function(data, spec) {
		var empty = true;

		var row = E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'style': 'width:60%' }),
			E('td', { 'class': 'td', 'style': 'width:40%' })
		]);

		if (Array.isArray(spec.expr)) {
			for (var i = 0; i < spec.expr.length; i++) {
				// nftables JSON format bug, `flow` targets are currently not properly serialized
				if (typeof(spec.expr[i]) == 'string' && spec.expr[i].match(/^flow add (@\S+)$/))
					spec.expr[i] = { flow: { op: "add", flowtable: RegExp.$1 } };

				var res = this.renderExpr(spec.expr[i], spec.table);

				if (typeof(spec.expr[i]) == 'object' && spec.expr[i].counter) {
					row.childNodes[0].insertBefore(
						this.renderCounter(spec.expr[i].counter),
						row.childNodes[0].firstChild);
				}
				else if (this.isActionExpression(spec.expr[i])) {
					dom.append(row.childNodes[1], [ res ]);
				}
				else {
					dom.append(row.childNodes[0], [ res ]);
					empty = false;
				}
			}
		}

		if (spec.comment) {
			row.childNodes[0].insertBefore(
				this.renderComment(spec.comment),
				row.childNodes[0].firstChild);
		}

		if (empty)
			dom.append(row.childNodes[0], E('span', { 'class': 'ifacebadge' }, '<em>%h</em>'.format(_('Any packet', 'nft match any traffic'))));

		return row;
	},

	renderChain: function(data, spec) {
		var title, policy, hook;

		switch (spec.type) {
		case 'filter':
			title = _('Traffic filter chain "%h"').format(spec.name);
			break;

		case 'route':
			title = _('Route action chain "%h"').format(spec.name);
			break;

		case 'nat':
			title = _('NAT action chain "%h"').format(spec.name);
			break;

		default:
			title = _('Rule container chain "%h"').format(spec.name);
			break;
		}

		switch (spec.policy) {
		case 'drop':
			policy = _('Drop unmatched packets', 'Chain policy: drop');
			break;

		default:
			policy = _('Continue processing unmatched packets', 'Chain policy: accept');
			break;
		}

		switch (spec.hook) {
		case 'ingress':
			hook = _('Capture packets directly after the NIC received them', 'Chain hook: ingress');
			break;

		case 'prerouting':
			hook = _('Capture incoming packets before any routing decision', 'Chain hook: prerouting');
			break;

		case 'input':
			hook = _('Capture incoming packets routed to the local system', 'Chain hook: input');
			break;

		case 'forward':
			hook = _('Capture incoming packets addressed to other hosts', 'Chain hook: forward');
			break;

		case 'output':
			hook = _('Capture outgoing packets originating from the local system', 'Chain hook: output');
			break;

		case 'postrouting':
			hook = _('Capture outgoing packets after any routing decision', 'Chain hook: postrouting');
			break;

		default:
			hook = _('Chain hook "%h"', 'Yet unknown nftables chain hook').format(spec.hook);
			break;
		}

		var node = E('div', { 'class': 'nft-chain' }, [
			E('h4', {
				'id': '%h.%h'.format(spec.table, spec.name)
			}, [ title ])
		]);

		if (spec.hook) {
			node.appendChild(E('div', { 'class': 'nft-chain-hook' }, [
				E('ul', {}, [
					E('li', {}, _('Hook: <strong>%h</strong> (%h), Priority: <strong>%d</strong>', 'Chain hook description').format(spec.hook, hook, spec.prio)),
					E('li', {}, _('Policy: <strong>%h</strong> (%h)', 'Chain hook policy').format(spec.policy, policy))
				])
			]));
		}

		node.appendChild(E('table', { 'class': 'nft-rules table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th', 'style': 'width:60%' }, [ _('Rule matches') ]),
				E('th', { 'class': 'th', 'style': 'width:40%' }, [ _('Rule actions') ])
			])
		]));

		for (var i = 0; i < data.length; i++)
			if (typeof(data[i].rule) == 'object' && data[i].rule.table == spec.table && data[i].rule.chain == spec.name && data[i].rule.family == spec.family)
				node.lastElementChild.appendChild(this.renderRule(data, data[i].rule));

		if (node.lastElementChild.childNodes.length == 1)
			node.lastElementChild.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td center', 'colspan': 3 }, [
					E('em', [ _('No rules in this chain', 'nft chain is empty') ])
				])
			]));

		return node;
	},

	renderTable: function(data, spec) {
		var title;

		switch (spec.family) {
		case 'ip':
			title = _('IPv4 traffic table "%h"').format(spec.name);
			break;

		case 'ip6':
			title = _('IPv6 traffic table "%h"').format(spec.name);
			break;

		case 'inet':
			title = _('IPv4/IPv6 traffic table "%h"').format(spec.name);
			break;

		case 'arp':
			title = _('ARP traffic table "%h"').format(spec.name);
			break;

		case 'bridge':
			title = _('Bridge traffic table "%h"').format(spec.name);
			break;

		case 'netdev':
			title = _('Network device table "%h"').format(spec.name);
			break;

		default:
			title = _('"%h" table "%h"', 'Yet unknown nftables table family ("family" table "name")').format(spec.family, spec.name);
			break;
		}

		var node = E([], [
			E('style', { 'type': 'text/css' }, [
				'.nft-rules .ifacebadge { margin: .125em }',
				'.nft-rules tr > td { padding: .25em !important }',
				'.nft-set, .nft-list { display: inline-block; vertical-align: middle }',
				'.nft-set-items, .nft-list-items { display: inline-block; vertical-align: middle; max-width: 200px; overflow: hidden; text-overflow: ellipsis }',
				'.ifacebadge.cbi-tooltip-container { cursor: help }',
				'.ifacebadge.cbi-tooltip-container .cbi-tooltip { padding: .5em }'
			]),
			E('div', { 'class': 'nft-table' }, [
				E('h3', [ title ]),
				E('div', { 'class': 'nft-chains' })
			])
		]);

		for (var i = 0; i < data.length; i++)
			if (typeof(data[i].chain) == 'object' && data[i].chain.table == spec.name && data[i].chain.family == spec.family)
				node.lastElementChild.lastElementChild.appendChild(this.renderChain(data, data[i].chain));

		return node;
	},

	checkLegacyRules: function(ipt4save, ipt6save) {
		if (ipt4save.match(/\n-A /) || ipt6save.match(/\n-A /)) {
			ui.addNotification(_('Legacy rules detected'), [
				E('p', _('There are legacy iptables rules present on the system. Mixing iptables and nftables rules is discouraged and may lead to incomplete traffic filtering.')),
				E('button', {
					'class': 'btn cbi-button',
					'click': function() { location.href = 'nftables/iptables' }
				}, _('Open iptables rules overview…'))
			], 'warning');
		}
	},

	render: function(data) {
		var view = E('div'),
		    nft = data[0],
		    ipt = data[1],
		    ipt6 = data[2];

		this.checkLegacyRules(ipt, ipt6);

		if (!Array.isArray(nft.nftables))
			return E('em', _('No nftables ruleset loaded.'));

		for (var i = 0; i < nft.nftables.length; i++)
			if (nft.nftables[i].hasOwnProperty('table'))
				view.appendChild(this.renderTable(nft.nftables, nft.nftables[i].table));

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
