'use strict';
'require view';
'require poll';
'require fs';
'require ui';

var table_names = [ 'Filter', 'NAT', 'Mangle', 'Raw' ];

return view.extend({
	load: function() {
		return L.resolveDefault(fs.stat('/usr/sbin/ip6tables'));
	},

	createTableSection: function(is_ipv6, table) {
		var idiv = document.querySelector('div[data-tab="%s"]'.format(is_ipv6 ? 'ip6tables' : 'iptables')),
		    tdiv = idiv.querySelector('[data-table="%s-%s"]'.format(is_ipv6 ? 'ipv6' : 'ipv4', table)),
		    title = '%s: %s'.format(_('Table'), table);

		if (!tdiv) {
			tdiv = E('div', { 'data-table': '%s-%s'.format(is_ipv6 ? 'ipv6' : 'ipv4', table) }, [
				E('h3', {}, title),
				E('div')
			]);

			if (idiv.firstElementChild.nodeName.toLowerCase() === 'p')
				idiv.removeChild(idiv.firstElementChild);

			var added = false, thisIdx = table_names.indexOf(table);

			idiv.querySelectorAll('[data-table]').forEach(function(child) {
				var childIdx = table_names.indexOf(child.getAttribute('data-table').split(/-/)[1]);

				if (added === false && childIdx > thisIdx) {
					idiv.insertBefore(tdiv, child);
					added = true;
				}
			});

			if (added === false)
				idiv.appendChild(tdiv);
		}

		return tdiv.lastElementChild;
	},

	createChainSection: function(is_ipv6, table, chain, policy, packets, bytes, references) {
		var tdiv = this.createTableSection(is_ipv6, table),
		    cdiv = tdiv.querySelector('[data-chain="%s"]'.format(chain)),
		    title;

		if (policy)
			title = '%s <em>%s</em> <span>(%s: <em>%s</em>, %d %s, %.2mB %s)</span>'
				.format(_('Chain'), chain, _('Policy'), policy, packets, _('Packets'), bytes, _('Traffic'));
		else
			title = '%s <em>%s</em> <span class="references">(%d %s)</span>'
				.format(_('Chain'), chain, references, _('References'));

		if (!cdiv) {
			cdiv = E('div', { 'data-chain': chain }, [
				E('h4', { 'id': 'rule_%s-%s_%s'.format(is_ipv6 ? 'ipv6' : 'ipv4', table.toLowerCase(), chain) }, title),
				E('div', { 'class': 'table' }, [
					E('div', { 'class': 'tr table-titles' }, [
						E('div', { 'class': 'th center' }, _('Pkts.')),
						E('div', { 'class': 'th center' }, _('Traffic')),
						E('div', { 'class': 'th' }, _('Target')),
						E('div', { 'class': 'th' }, _('Prot.')),
						E('div', { 'class': 'th' }, _('In')),
						E('div', { 'class': 'th' }, _('Out')),
						E('div', { 'class': 'th' }, _('Source')),
						E('div', { 'class': 'th' }, _('Destination')),
						E('div', { 'class': 'th' }, _('Options')),
						E('div', { 'class': 'th' }, _('Comment'))
					])
				])
			]);

			tdiv.appendChild(cdiv);
		}
		else {
			cdiv.firstElementChild.innerHTML = title;
		}

		return cdiv.lastElementChild;
	},

	updateChainSection: function(chaintable, rows) {
		if (!chaintable)
			return;

		cbi_update_table(chaintable, rows, _('No rules in this chain.'));

		if (rows.length === 0 &&
		    document.querySelector('[data-hide-empty="true"]'))
			chaintable.parentNode.style.display = 'none';
		else
			chaintable.parentNode.style.display = '';

		chaintable.parentNode.setAttribute('data-empty', rows.length === 0);
	},

	parseIptablesDump: function(is_ipv6, table, s) {
		var current_chain = null;
		var current_rules = [];
		var seen_chains = {};
		var chain_refs = {};
		var re = /([^\n]*)\n/g;
		var m, m2;

		while ((m = re.exec(s)) != null) {
			if (m[1].match(/^Chain (.+) \(policy (\w+) (\d+) packets, (\d+) bytes\)$/)) {
				var chain = RegExp.$1,
				    policy = RegExp.$2,
				    packets = +RegExp.$3,
				    bytes = +RegExp.$4;

				this.updateChainSection(current_chain, current_rules);

				seen_chains[chain] = true;
				current_chain = this.createChainSection(is_ipv6, table, chain, policy, packets, bytes);
				current_rules = [];
			}
			else if (m[1].match(/^Chain (.+) \((\d+) references\)$/)) {
				var chain = RegExp.$1,
				    references = +RegExp.$2;

				this.updateChainSection(current_chain, current_rules);

				seen_chains[chain] = true;
				current_chain = this.createChainSection(is_ipv6, table, chain, null, null, null, references);
				current_rules = [];
			}
			else if (m[1].match(/^num /)) {
				continue;
			}
			else if ((m2 = m[1].match(/^(\d+) +(\d+) +(\d+) +(.*?) +(\S+) +(\S*) +(\S+) +(\S+) +(!?[a-f0-9:.]+(?:\/[a-f0-9:.]+)?) +(!?[a-f0-9:.]+(?:\/[a-f0-9:.]+)?) +(.+)$/)) !== null) {
				var num = +m2[1],
				    pkts = +m2[2],
				    bytes = +m2[3],
				    target = m2[4],
				    proto = m2[5],
				    indev = m2[7],
				    outdev = m2[8],
				    srcnet = m2[9],
				    dstnet = m2[10],
				    options = m2[11] || '-',
				    comment = '-';

				options = options.trim().replace(/(?:^| )\/\* (.+) \*\//,
					function(m1, m2) {
						comment = m2.replace(/^!fw3(: |$)/, '').trim() || '-';
						return '';
					}) || '-';

				current_rules.push([
					'%.2m'.format(pkts).nobr(),
					'%.2mB'.format(bytes).nobr(),
					target ? '<span class="target">%s</span>'.format(target) : '-',
					proto,
					(indev !== '*') ? '<span class="ifacebadge">%s</span>'.format(indev) : '*',
					(outdev !== '*') ? '<span class="ifacebadge">%s</span>'.format(outdev) : '*',
					srcnet,
					dstnet,
					options,
					[ comment ]
				]);

				if (target) {
					chain_refs[target] = chain_refs[target] || [];
					chain_refs[target].push([ current_chain, num ]);
				}
			}
		}

		this.updateChainSection(current_chain, current_rules);

		document.querySelectorAll('[data-table="%s-%s"] [data-chain]'.format(is_ipv6 ? 'ipv6' : 'ipv4', table)).forEach(L.bind(function(cdiv) {
			if (!seen_chains[cdiv.getAttribute('data-chain')]) {
				cdiv.parentNode.removeChild(cdiv);
				return;
			}

			cdiv.querySelectorAll('.target').forEach(L.bind(function(tspan) {
				if (seen_chains[tspan.textContent]) {
					tspan.classList.add('jump');
					tspan.addEventListener('click', this.handleJumpTarget);
				}
			}, this));

			cdiv.querySelectorAll('.references').forEach(L.bind(function(rspan) {
				var refs = chain_refs[cdiv.getAttribute('data-chain')];
				if (refs && refs.length) {
					rspan.classList.add('cbi-tooltip-container');
					rspan.appendChild(E('small', { 'class': 'cbi-tooltip ifacebadge', 'style': 'top:1em; left:auto' }, [ E('ul') ]));

					refs.forEach(L.bind(function(ref) {
						var chain = ref[0].parentNode.getAttribute('data-chain'),
						    num = ref[1];

						rspan.lastElementChild.lastElementChild.appendChild(E('li', {}, [
							_('Chain'), ' ',
							E('span', {
								'class': 'jump',
								'data-num': num,
								'click': this.handleJumpTarget
							}, chain),
							', %s #%d'.format(_('Rule'), num)
						]));
					}, this));
				}
			}, this));
		}, this));
	},

	pollFirewallLists: function(has_ip6tables) {
		var cmds = [ '/usr/sbin/iptables' ];

		if (has_ip6tables)
			cmds.push('/usr/sbin/ip6tables');

		poll.add(L.bind(function() {
			var tasks = [];

			for (var i = 0; i < cmds.length; i++) {
				for (var j = 0; j < table_names.length; j++) {
					tasks.push(L.resolveDefault(
						fs.exec_direct(cmds[i], [ '--line-numbers', '-w', '-nvxL', '-t', table_names[j].toLowerCase() ])
							.then(this.parseIptablesDump.bind(this, i > 0, table_names[j]))));
				}
			}

			return Promise.all(tasks);
		}, this));
	},

	handleJumpTarget: function(ev) {
		var link = ev.target,
		    table = findParent(link, '[data-table]').getAttribute('data-table'),
		    chain = link.textContent,
		    num = +link.getAttribute('data-num'),
		    elem = document.getElementById('rule_%s_%s'.format(table.toLowerCase(), chain));

		if (elem) {
			(document.documentElement || document.body.parentNode || document.body).scrollTop = elem.offsetTop - 40;
			elem.classList.remove('flash');
			void elem.offsetWidth;
			elem.classList.add('flash');

			if (num) {
				var rule = elem.nextElementSibling.childNodes[num];
				if (rule) {
					rule.classList.remove('flash');
					void rule.offsetWidth;
					rule.classList.add('flash');
				}
			}
		}
	},

	handleHideEmpty: function(ev) {
		var btn = ev.currentTarget,
		    hide = (btn.getAttribute('data-hide-empty') === 'false');

		btn.setAttribute('data-hide-empty', hide);
		btn.firstChild.data = hide ? _('Show empty chains') : _('Hide empty chains');
		btn.blur();

		document.querySelectorAll('[data-chain][data-empty="true"]')
			.forEach(function(chaintable) {
				chaintable.style.display = hide ? 'none' : '';
			});
	},

	handleCounterReset: function(has_ip6tables, ev) {
		return Promise.all([
			fs.exec('/usr/sbin/iptables', [ '-Z' ])
				.catch(function(err) { ui.addNotification(null, E('p', {}, _('Unable to reset iptables counters: %s').format(err.message))) }),
			has_ip6tables ? fs.exec('/usr/sbin/ip6tables', [ '-Z' ])
				.catch(function(err) { ui.addNotification(null, E('p', {}, _('Unable to reset ip6tables counters: %s').format(err.message))) }) : null
		]);
	},

	handleRestart: function(ev) {
		return fs.exec_direct('/etc/init.d/firewall', [ 'restart' ])
				.catch(function(err) { ui.addNotification(null, E('p', {}, _('Unable to restart firewall: %s').format(err.message))) });
	},

	render: function(has_ip6tables) {
		var view = E([], [
			E('style', { 'type': 'text/css' }, [
				'.cbi-tooltip-container, span.jump { border-bottom:1px dotted #00f;cursor:pointer }',
				'ul { list-style:none }',
				'.references { position:relative }',
				'.references .cbi-tooltip { left:0!important;top:1.5em!important }',
				'h4>span { font-size:90% }'
			]),

			E('h2', {}, [ _('Firewall Status') ]),
			E('div', { 'class': 'right', 'style': 'margin-bottom:-1.5em' }, [
				E('button', {
					'class': 'cbi-button',
					'data-hide-empty': false,
					'click': ui.createHandlerFn(this, 'handleHideEmpty')
				}, [ _('Hide empty chains') ]),
				' ',
				E('button', {
					'class': 'cbi-button',
					'click': ui.createHandlerFn(this, 'handleCounterReset', has_ip6tables)
				}, [ _('Reset Counters') ]),
				' ',
				E('button', {
					'class': 'cbi-button',
					'click': ui.createHandlerFn(this, 'handleRestart')
				}, [ _('Restart Firewall') ])
			]),
			E('div', {}, [
				E('div', { 'data-tab': 'iptables', 'data-tab-title': has_ip6tables ? _('IPv4 Firewall') : null }, [
					E('p', {}, E('em', { 'class': 'spinning' }, [ _('Collecting data...') ]))
				]),
				has_ip6tables ? E('div', { 'data-tab': 'ip6tables', 'data-tab-title': _('IPv6 Firewall') }, [
					E('p', {}, E('em', { 'class': 'spinning' }, [ _('Collecting data...') ]))
				]) : E([])
			])
		]);

		if (has_ip6tables)
			ui.tabs.initTabGroup(view.lastElementChild.childNodes);

		this.pollFirewallLists(has_ip6tables);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
