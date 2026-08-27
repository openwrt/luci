'use strict';
'require dom';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require rpc';
'require form';
'require tools.widgets as widgets';

const getStatus = rpc.declare({
	object: 'luci.shunt',
	method: 'status'
});

const getPackages = rpc.declare({
	object: 'rpc-sys',
	method: 'packagelist',
	params: ['all'],
	expect: { packages: {} }
});

function handleAction(ev) {
	if (ev === 'restart') {
		const map = document.querySelector('.cbi-map');

		return dom.callClassMethod(map, 'save')
			.then(function () {
				return Promise.all([
					uci.changes(),
					fs.exec('/etc/init.d/shunt', ['running'])
				]);
			})
			.then(function (res) {
				const pending = res[0] && Object.keys(res[0]).length;
				const running = res[1] && res[1].code === 0;

				if (pending && running) {
					L.bind(ui.changes.apply, ui.changes)();
					return null;
				}

				if (pending) {
					return uci.apply().then(function () {
						if (ui.changes.setIndicator) {
							ui.changes.setIndicator(0);
						}
						return fs.exec_direct('/etc/init.d/shunt', [ev]);
					});
				}
				return fs.exec_direct('/etc/init.d/shunt', [ev]);
			})
			.catch(function (e) {
				ui.addNotification(null,
					E('p', {}, [_('Apply failed: %s').format(e)]), 'error');
			});
	}
	return fs.exec_direct('/etc/init.d/shunt', [ev]);
}

function fmtMark(mark) {
	if (mark == null) {
		return '-';
	}
	return '0x%08x'.format(mark);
}

function fmtCount(n) {
	if (n == null) {
		return '?';
	}
	return '%d'.format(n);
}

function card(label, value, sub, cls) {
	return E('div', { 'class': 'shunt-card' }, [
		E('div', { 'class': 'shunt-label' }, label),
		E('div', { 'class': 'shunt-value ' + (cls || '') }, value),
		sub ? E('div', { 'class': 'shunt-sub' }, sub) : ''
	]);
}

function dot(state) {
	return E('span', { 'class': 'shunt-dot shunt-dot-' + state });
}

function renderState(st) {
	if (!st || st.running == null) {
		return E('div', { 'class': 'shunt-state' }, [
			dot('off'), E('span', {}, _('no answer from the backend'))
		]);
	}

	if (st.running && st.applied) {
		return E('div', { 'class': 'shunt-state' }, [
			dot('ok'), E('span', {}, _('running, policy applied'))
		]);
	}

	if (st.running && !st.applied) {
		return E('div', { 'class': 'shunt-state' }, [
			dot('warn'), E('span', {}, _('running, but no ruleset in the kernel'))
		]);
	}

	if (!st.running && st.applied) {
		return E('div', { 'class': 'shunt-state' }, [
			dot('warn'), E('span', {}, _('ruleset present, service not running'))
		]);
	}

	return E('div', { 'class': 'shunt-state' }, [
		dot('off'), E('span', {}, _('stopped'))
	]);
}

// The observer's verdict identifiers are module contract - translated for
// display only, with the raw key kept beside each label.
const DROP_LABEL = {
	'nomatch': _('Domain is in no policy'),
	'qtype': _('Not an address query'),
	'noaddr': _('Answer carried no usable address'),

	'dns:E_RCODE': _('Error reply, e.g. NXDOMAIN'),
	'dns:E_NOTRESP': _('Not a response'),
	'dns:E_TRUNC': _('Truncated response'),
	'dns:E_QDCOUNT': _('Not exactly one question'),
	'dns:E_SHORT': _('Message ends mid-structure'),
	'dns:E_MSGLEN': _('Message too long'),
	'dns:E_QPTR': _('Compression pointer in the question'),
	'dns:E_LABEL': _('Reserved label type'),
	'dns:E_NAMELEN': _('Name too long'),
	'dns:E_CHARSET': _('Name has a byte outside a-z 0-9 - _'),
	'dns:E_RDLEN': _('Record length does not fit the type'),
	'dns:E_ANSMAX': _('Too many answers'),

	'frame:E_SHORT': _('Frame ends mid-structure'),
	'frame:E_ETHER': _('Neither IPv4 nor IPv6'),
	'frame:E_VLAN': _('Too many stacked VLAN tags'),
	'frame:E_IPLEN': _('Inconsistent IP header length'),
	'frame:E_FRAG': _('IP fragment'),
	'frame:E_EXTHDR': _('Extension header chain too long'),
	'frame:E_PROTO': _('Not UDP'),
	'frame:E_UDPLEN': _('Inconsistent UDP length')
};

function dropLabel(key) {
	return DROP_LABEL[key] || key;
}

function renderSnoop(svc) {
	if (!svc || !svc.snoop) {
		return '';
	}

	const drops = svc.snoop.drops || {};
	const matched = svc.snoop.matched || 0;
	const keys = Object.keys(drops).sort(function (a, b) {
		return drops[b] - drops[a] || a.localeCompare(b);
	});

	let total = 0;

	keys.forEach(function (k) {
		total += drops[k];
	});

	const rows = keys.map(function (k) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, [
				dropLabel(k),
				E('span', { 'class': 'shunt-key' }, k)
			]),
			E('td', { 'class': 'td right' }, ['%d'.format(drops[k])])
		]);
	});

	return E('div', { 'class': 'shunt-block' }, [
		E('div', { 'class': 'shunt-label' },
			[_('DNS responses observed on %s since the service started')
				.format((svc.snoop.devices || []).join(', ') || '-')]),
		E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' },
					E('strong', {}, _('Answers used for a policy'))),
				E('td', { 'class': 'td right' },
					E('strong', { 'class': 'shunt-hit' }, '%d'.format(matched)))
			])
		].concat(rows)),
		E('div', { 'class': 'shunt-sub' }, _('%d of %d observed responses were not used. That is normal: the observer sees every answer on the network, and only the ones for a domain you routed are of any interest.')
			.format(total, total + matched))
	]);
}

function renderPolicies(st) {
	if (!st || !st.policies || !st.policies.length) {
		return E('div', { 'class': 'shunt-sub' }, _('No policy is active.'));
	}

	const rows = [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Policy')),
			E('th', { 'class': 'th' }, _('Interface')),
			E('th', { 'class': 'th' }, _('Mark')),
			E('th', { 'class': 'th' }, _('Table')),
			E('th', { 'class': 'th' }, _('Rules')),
			E('th', { 'class': 'th' }, _('Routes')),
			E('th', { 'class': 'th' }, _('Fallback'))
		])
	];

	st.policies.forEach(function (p) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [p.name]),
			E('td', { 'class': 'td' }, [p.interface || '-']),
			E('td', { 'class': 'td' }, [fmtMark(p.mark)]),
			E('td', { 'class': 'td' }, [fmtCount(p.rt_table)]),
			E('td', { 'class': 'td' }, [fmtCount(p.rules)]),
			E('td', { 'class': 'td' }, [fmtCount(p.routes)]),
			E('td', { 'class': 'td' }, [p.fallback || 'main'])
		]));
	});

	return E('table', { 'class': 'table' }, rows);
}

function renderIssues(st) {
	if (!st || !st.issues || !st.issues.length) {
		return '';
	}

	const items = st.issues.map(function (i) {
		const where = i.entry ? '%s: %s'.format(i.policy, i.entry) : i.policy;
		return E('li', {}, ['%s - %s'.format(where, i.reason)]);
	});

	return E('div', { 'class': 'shunt-block' }, [
		E('div', { 'class': 'shunt-label' }, _('Rejected settings')),
		E('ul', { 'class': 'shunt-issues' }, items),
		E('div', { 'class': 'shunt-sub' }, _('These entries were skipped. Everything else was applied - a rejected entry never takes the service down.'))
	]);
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(getStatus(), {}),
			uci.load('shunt').catch(() => 0),
			L.resolveDefault(getPackages(true), {})
		]);
	},

	render: function (result) {
		const pkgs = result[2] || {};

		if (!uci.sections('shunt').length) {
			ui.addNotification(null, E('p', _('No shunt config found!')), 'error');
			return;
		}

		let m, s, o;

		m = new form.Map('shunt', 'shunt',
			_('Policy based routing by mac, source, destination and domain. For further information please check the %s.')
				.format(`<a style="color:#37c;font-weight:bold;" href="https://github.com/openwrt/packages/blob/master/net/shunt/README.md" target="_blank" rel="noreferrer noopener" >${_('online documentation')}</a>`));
		const style = E('style', { 'type': 'text/css' },
			'#shunt-status {' +
			'--shunt-card-bg: rgba(128,128,128,.07);' +
			'--shunt-card-border: rgba(128,128,128,.28);' +
			'--shunt-muted: GrayText;' +
			'--shunt-ok: #1f8a5f;' +
			'--shunt-warn: #b8860b;' +
			'--shunt-off: #808080;' +
			'}' +
			'@media (prefers-color-scheme: dark) {' +
			'#shunt-status {' +
			'--shunt-ok: #63c79b;' +
			'--shunt-warn: #e0b458;' +
			'}}' +
			'#shunt-status .shunt-grid { display: grid; gap: .75em; ' +
			'grid-template-columns: repeat(auto-fit, minmax(min(12em, 100%), 1fr)); ' +
			'margin-bottom: .75em; }' +
			'#shunt-status .shunt-card { background: var(--shunt-card-bg); ' +
			'border: 1px solid var(--shunt-card-border); border-radius: 8px; ' +
			'padding: .7em .9em; min-width: 0; overflow-wrap: break-word; }' +
			'#shunt-status .shunt-block { margin-bottom: .75em; }' +
			'#shunt-status .shunt-label { font-size: .85em; ' +
			'color: var(--shunt-muted); margin-bottom: .3em; }' +
			'#shunt-status .shunt-sub { font-size: .8em; ' +
			'color: var(--shunt-muted); margin-top: .3em; }' +
			'#shunt-status .shunt-value { font-size: 1.5em; line-height: 1.3; ' +
			'font-variant-numeric: tabular-nums; }' +
			'#shunt-status .shunt-state { display: flex; align-items: center; gap: .5em; }' +
			'#shunt-status .shunt-dot { width: .6em; height: .6em; border-radius: 50%; ' +
			'flex: 0 0 auto; background: var(--shunt-muted); }' +
			'#shunt-status .shunt-dot-ok { background: var(--shunt-ok); }' +
			'#shunt-status .shunt-dot-warn { background: var(--shunt-warn); }' +
			'#shunt-status .shunt-dot-off { background: var(--shunt-off); }' +
			'#shunt-status .shunt-issues { margin: 0; padding-left: 1.2em; }' +
			'#shunt-status .shunt-key { color: var(--shunt-muted); ' +
			'font-family: monospace; font-size: .8em; margin-left: .6em; }' +
			'#shunt-status .shunt-hit { color: var(--shunt-ok); }');

		const setNodes = (id, nodes) => {
			const el = document.getElementById(id);
			if (el) {
				dom.content(el, nodes);
			}
		};

		// Shown once, not on every poll tick. rp_filter is a box-wide security
		// setting shunt does not change; a strict value silently drops its
		// traffic, so the UI names it where the log would otherwise be the
		// only place. Points at the docs rather than offering a button,
		// because the change belongs to the administrator.
		let rpWarned = false;

		const update = (st) => {
			const svc = st ? st.service : null;
			// Devices the kernel would drop marked traffic on, on the status
			// root. Empty when all is loose, when each policy device is loose
			// itself, or when rp_filter_manage has set them - the daemon reads
			// the live value, so an enabled switch simply yields an empty list.
			const blocked = (st && st.rp_filter_blocked) || [];

			if (blocked.length && !rpWarned) {
				rpWarned = true;
				ui.addNotification(
					_('Reverse path filtering is strict'),
					E('p', {}, [
						_('Strict rp_filter will drop shunt\'s marked traffic on %s. Set rp_filter to 2 on the policy interface, enable rp_filter_manage to have shunt do it, or loosen it box-wide; see the README.').format(
							blocked.join(', '))
					]),
					'warning');
			}

			setNodes('shunt-state', renderState(st));
			setNodes('shunt-version', E('span', {}, ['%s / %s'.format(
				pkgs['luci-app-shunt'] || _('n/a'), pkgs['shunt'] || _('n/a'))]));
			setNodes('shunt-learned', E('span', {}, [
				svc ? fmtCount(svc.dedupe) : '-']));
			setNodes('shunt-poll', E('span', {}, [svc?.poll
				? (svc.poll.resolv
					? _('%d name(s) every %ds').format(svc.poll.names, svc.poll.interval)
					: _('unavailable - ucode-mod-resolv missing'))
				: '-']));
			setNodes('shunt-policies', renderPolicies(st));
			setNodes('shunt-snoop', renderSnoop(svc));
			setNodes('shunt-issues', renderIssues(st));
		};

		// TypedSection: `config global` is anonymous, so there is no section
		// named 'global' to bind to.
		o = m.section(form.TypedSection, 'global');
		o.anonymous = true;
		o.addremove = false;
		o.render = L.bind(function () {
			return E('div', { 'id': 'shunt-status' }, [
				style,
				E('div', { 'class': 'shunt-grid' }, [
					card(_('Service'), E('span', { 'id': 'shunt-state' }, '-'),
						E('span', {}, [
							_('Version'), ': ',
							E('span', { 'id': 'shunt-version' }, '-')
						])),
					card(_('Learned addresses'),
						E('span', { 'id': 'shunt-learned' }, '-'),
						_('across all policies')),
					card(_('Poll'), E('span', { 'id': 'shunt-poll' }, '-'),
						_('wildcards are covered by the observer only'))
				]),
				E('div', { 'id': 'shunt-policies' }, ''),
				E('div', { 'id': 'shunt-snoop' }, ''),
				E('div', { 'id': 'shunt-issues' }, '')
			]);
		}, this);

		poll.add(function () {
			return L.resolveDefault(getStatus(), null).then(update);
		}, 2);

		// The status subtree only exists once m.render() has resolved and
		// View.__init__ has attached the nodes; a direct call here would find
		// no ids and leave the cards on '-' until the first poll tick.
		requestAnimationFrame(function () {
			update(result[0]);
		});

		s = m.section(form.TypedSection, 'global', _('Settings'));
		s.anonymous = true;
		s.addremove = false;
		s.tab('general', _('General Settings'));
		s.tab('snoop', _('DNS Observer Settings'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enabled'),
			_('Enable the shunt service.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'debug', _('Debug Logging'),
			_('Log every observed DNS answer and every set write. Useful for a bug report, noisy in normal operation - on a router running adblock roughly half of all answers are error replies, and each one gets a line.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'rp_filter_manage', _('Manage rp_filter'),
			_('Set rp_filter to 2 on shunt\'s own policy interfaces, at start and when one comes up.'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'poll_interval', _('Poll Interval'),
			_('Seconds between poll cycles.'));
		o.datatype = 'and(uinteger,min(30))';
		o.placeholder = '300';

		o = s.taboption('general', form.Value, 'entry_ttl', _('Entry Lifetime'),
			_('Seconds a learned address stays in its Set. Keep this well above the poll interval.'));
		o.datatype = 'and(uinteger,min(60))';
		o.placeholder = '1200';
		o.validate = function (section_id, value) {
			const iv = this.map.lookupOption('poll_interval', section_id);
			const interval = (iv && iv[0]) ? (iv[0].formvalue(section_id) || 300) : 300;

			if (value && +value < 2 * +interval) {
				return _('Should be at least twice the poll interval (%d), otherwise entries expire between cycles.').format(2 * interval);
			}

			return true;
		};

		o = s.taboption('snoop', form.Flag, 'snoop', _('Passive DNS Observer'),
			_('Read DNS answers as they pass the LAN device, whichever resolver produced them. Required for wildcard domains, which cannot be resolved ahead of time.'));
		o.rmempty = false;

		o = s.taboption('snoop', widgets.DeviceSelect, 'snoop_device',
			_('Observed Devices'),
			_('The LAN device the DNS answers cross on their way to the clients, normally br-lan. One entry per network segment, see the README.'));
		o.default = 'br-lan';
		o.multiple = true;
		o.noaliases = true;

		s = m.section(form.TypedSection, 'global');
		s.anonymous = true;
		s.addremove = false;
		s.render = L.bind(function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('stop');
					})
				}, [_('Stop')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('restart');
					})
				}, [_('Save & Restart')])
			]);
		});

		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
