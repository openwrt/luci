'use strict';
'require view';
'require dom';
'require ui';
'require uci';
'require rpc';

const getSets = rpc.declare({
	object: 'luci.shunt',
	method: 'sets',
	params: ['policy']
});

function setKind(name) {
	return name.substring(0, 1);
}

function setPolicy(name) {
	return name.substring(name.substring(0, 1) === 'm' ? 2 : 3);
}

function fmtExpiry(sec) {
	if (sec == null) {
		return '-';
	}
	if (sec >= 3600) {
		return _('%dh %dm').format(Math.floor(sec / 3600),
			Math.floor((sec % 3600) / 60));
	}
	if (sec >= 60) {
		return _('%dm %ds').format(Math.floor(sec / 60), sec % 60);
	}
	return _('%ds').format(sec);
}

function fmtNum(n) {
	if (n == null) {
		return '-';
	}
	return '%d'.format(n);
}

function renderCards(sets, kinds, title, empty_hint) {
	const byPolicy = {};

	Object.keys(sets).forEach(function (name) {
		if (kinds.indexOf(setKind(name)) < 0) {
			return;
		}

		const policy = setPolicy(name);

		if (!byPolicy[policy]) {
			byPolicy[policy] = [];
		}

		sets[name].forEach(function (e) {
			byPolicy[policy].push(e);
		});
	});

	const policies = Object.keys(byPolicy).filter(function (p) {
		return byPolicy[p].length > 0;
	}).sort();

	if (!policies.length) {
		return empty_hint
			? E('div', { 'class': 'shunt-block' }, [
				E('div', { 'class': 'shunt-label' }, title),
				E('div', { 'class': 'shunt-sub' }, empty_hint)
			])
			: '';
	}

	const cards = policies.map(function (policy) {
		return E('div', { 'class': 'shunt-card' }, [
			E('div', { 'class': 'shunt-card-title' }, [policy]),
			E('div', { 'class': 'shunt-addrs' },
				byPolicy[policy].sort(function (a, b) {
					return String(a.addr).localeCompare(String(b.addr));
				}).map(function (e) {
					return E('div', {}, [
						e.addr,
						e.packets ? E('span', { 'class': 'shunt-hits' },
							_('%d pkt matched').format(e.packets)) : ''
					]);
				}))
		]);
	});

	return E('div', { 'class': 'shunt-block' }, [
		E('div', { 'class': 'shunt-label' }, title),
		E('div', { 'class': 'shunt-grid' }, cards)
	]);
}

function renderLearned(sets) {
	const rows = [];

	Object.keys(sets).forEach(function (name) {
		if (setKind(name) !== 'd') {
			return;
		}

		const policy = setPolicy(name);

		sets[name].forEach(function (e) {
			rows.push({
				policy: policy,
				addr: e.addr,
				expires: e.expires,
				packets: e.packets,
				bytes: e.bytes
			});
		});
	});

	rows.sort(function (a, b) {
		return a.policy.localeCompare(b.policy)
			|| (b.packets || 0) - (a.packets || 0)
			|| String(a.addr).localeCompare(String(b.addr));
	});

	if (!rows.length) {
		return E('div', { 'class': 'shunt-block' }, [
			E('div', { 'class': 'shunt-label' }, _('Learned addresses')),
			E('div', { 'class': 'shunt-sub' }, _('Nothing learned yet. The service fills these from its poll cycle and from observed DNS answers.'))
		]);
	}

	const tbl = E('table', { 'class': 'table shunt-table' }, [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Policy')),
			E('th', { 'class': 'th' }, _('Address')),
			E('th', { 'class': 'th' }, _('Expires')),
			E('th', { 'class': 'th' }, _('Packets routed')),
			E('th', { 'class': 'th' }, _('Bytes routed'))
		])
	]);

	cbi_update_table(tbl, rows.map(function (r) {
		return [
			r.policy,
			r.addr,
			fmtExpiry(r.expires),
			fmtNum(r.packets),
			fmtNum(r.bytes)
		];
	}));

	return E('div', { 'class': 'shunt-block' }, [
		E('div', { 'class': 'shunt-label' },
			_('Learned addresses (%d)').format(rows.length)),
		tbl
	]);
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('shunt').catch(() => 0),
			L.resolveDefault(getSets(''), {})
		]);
	},

	render: function (result) {
		const self = this;

		const render_sets = function (data) {
			const sets = (data && data.sets) || {};
			const target = document.getElementById('shunt-sets');

			if (!target) {
				return;
			}

			dom.content(target, [
				renderCards(sets, ['c', 'm'], _('Client Selectors'),
					_('No client is selected, so every client is covered.')),
				renderCards(sets, ['s'], _('Static Destinations'), null),
				renderLearned(sets)
			]);
		};

		const reload = function () {
			const sel = document.getElementById('shunt-policy');

			return L.resolveDefault(getSets(sel ? sel.value : ''), {})
				.then(render_sets);
		};

		const options = [E('option', { 'value': '' }, _('all policies'))]
			.concat(uci.sections('shunt', 'policy').map(function (p) {
				return E('option', { 'value': p['.name'] }, [p['.name']]);
			}));

		const style = E('style', { 'type': 'text/css' },
			'#shunt-sets {' +
			'--shunt-card-bg: rgba(128,128,128,.07);' +
			'--shunt-card-border: rgba(128,128,128,.28);' +
			'--shunt-muted: GrayText;' +
			'}' +
			'#shunt-sets .shunt-block { margin-bottom: 1.2em; }' +
			'#shunt-sets .shunt-label { font-size: .85em; ' +
			'color: var(--shunt-muted); margin-bottom: .4em; }' +
			'#shunt-sets .shunt-sub { font-size: .85em; color: var(--shunt-muted); }' +
			'#shunt-sets .shunt-grid { display: grid; gap: .75em; ' +
			'grid-template-columns: repeat(auto-fit, minmax(min(16em, 100%), 1fr)); }' +
			'#shunt-sets .shunt-card { background: var(--shunt-card-bg); ' +
			'border: 1px solid var(--shunt-card-border); border-radius: 8px; ' +
			'padding: .7em .9em; min-width: 0; }' +
			'#shunt-sets .shunt-card-title { font-weight: bold; margin-bottom: .3em; }' +
			'#shunt-sets .shunt-addrs { font-family: monospace; font-size: .9em; ' +
			'overflow-wrap: anywhere; }' +
			'#shunt-sets .shunt-hits { color: var(--shunt-muted); ' +
			'font-size: .85em; margin-left: .6em; }' +
			'#shunt-sets .shunt-table { table-layout: fixed; width: 100%; }' +
			'#shunt-sets .shunt-table th:nth-child(1),' +
			'#shunt-sets .shunt-table td:nth-child(1) { width: 15%; }' +
			'#shunt-sets .shunt-table th:nth-child(2),' +
			'#shunt-sets .shunt-table td:nth-child(2) { width: 37%; ' +
			'overflow-wrap: anywhere; }' +
			'#shunt-sets .shunt-table th:nth-child(3),' +
			'#shunt-sets .shunt-table td:nth-child(3) { width: 16%; }' +
			'#shunt-sets .shunt-table th:nth-child(4),' +
			'#shunt-sets .shunt-table td:nth-child(4) { width: 16%; }' +
			'#shunt-sets .shunt-table th:nth-child(5),' +
			'#shunt-sets .shunt-table td:nth-child(5) { width: 16%; }');

		const page = E('div', { 'class': 'cbi-map' }, [
			style,
			E('h2', {}, _('Set Reporting')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' },
					_('What the nftables Sets currently hold. Counters are reset whenever an entry is refreshed, so they show recent activity, not a lifetime total.'))
			]),
			E('div', { 'id': 'shunt-sets' }, ''),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('select', {
					'id': 'shunt-policy',
					'class': 'cbi-input-select',
					'style': 'float:none;margin-right:.4em;width:auto;',
					'change': ui.createHandlerFn(self, reload)
				}, options),
				E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'style': 'float:none',
					'click': ui.createHandlerFn(self, reload)
				}, [_('Refresh')])
			])
		]);

		requestAnimationFrame(function () {
			render_sets(result[1]);
		});

		return page;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
