'use strict';
'require dom';
'require rpc';
'require poll';
'require view';

const callGetBuiltinEthernetPorts = rpc.declare({
	object: 'luci',
	method: 'getBuiltinEthernetPorts',
	expect: { result: [] }
});

const callEthtoolStatus = rpc.declare({
	object: 'luci',
	method: 'getEthtoolStatus',
	params: [ 'devices', 'temperature' ],
	expect: { result: {} }
});

function formatSpeed(mbit) {
	return (mbit >= 1000) ? '%s\u202fGbit/s'.format(mbit / 1000) : '%d\u202fMbit/s'.format(mbit);
}

/* "10000baseT/Full" -> "10G", ascending */
function formatModes(modes) {
	if (!Array.isArray(modes))
		return '-';

	const speeds = [ ...new Set(modes.map((m) => parseInt(m)).filter((n) => n > 0)) ].sort((a, b) => a - b);

	return speeds.length ? speeds.map((n) => (n >= 1000) ? '%sG'.format(n / 1000) : '%dM'.format(n)).join(', ') : _('None');
}

function formatDirection(rx, tx) {
	return (rx && tx) ? _('RX and TX') : rx ? _('RX only') : tx ? _('TX only') : _('Off');
}

function formatPause(pause, link) {
	if (!pause)
		return '-';

	/* without pause autonegotiation the configured RX/TX values apply as they are */
	if (!pause.autonegotiate)
		return '%s (%s)'.format(formatDirection(pause.rx, pause.tx), _('forced'));

	return (link['link-detected'] && pause.negotiated) ? formatDirection(pause.negotiated.rx, pause.negotiated.tx) : '-';
}

function formatEEEStatus(eee) {
	return { active: _('Active'), inactive: _('Inactive'), disabled: _('Disabled') }[eee.status] ?? eee.status ?? '-';
}

function renderGroup(title, rows) {
	return [
		E('div', { 'style': 'grid-column:1/-1;font-weight:bold;margin-top:.5em' }, [ title ]),
		...rows.flatMap(([ label, value ]) => [
			E('div', { 'style': 'opacity:.7' }, [ label ]),
			E('div', {}, [ value ])
		])
	];
}

function renderPort(name, st) {
	/* without ethtool JSON output (needs ethtool-full) nothing is known about the port */
	const known = !!st?.link;
	const link = st?.link ?? {};
	const up = !!link['link-detected'];
	const eee = st?.eee;
	const groups = [];

	groups.push(...renderGroup(_('Link'), [
		[ _('Speed'), !known ? '-' : up ? '%s, %s'.format(formatSpeed(link.speed), link.duplex) : _('No link') ],
		[ _('Port type'), link.port ?? '-' ],
		[ _('Auto negotiation'), (link['auto-negotiation'] == null) ? '-' : link['auto-negotiation'] ? _('On') : _('Off') ],
		[ _('Supported'), formatModes(link['supported-link-modes']) ],
		[ _('Link partner'), up ? formatModes(link['link-partner-advertised-link-modes']) : '-' ],
		[ _('Temperature'), (st?.temperature != null) ? '%.1f\u202f°C'.format(st.temperature) : '-' ]
	]));

	groups.push(...renderGroup(_('Flow control'), [
		[ _('Advertised'), link['advertised-pause-frame-use'] ?? '-' ],
		[ _('Link partner'), up ? (link['link-partner-advertised-pause-frame-use'] ?? '-') : '-' ],
		[ _('Result'), formatPause(st?.pause, link) ]
	]));

	groups.push(...renderGroup(_('Energy Efficient Ethernet'), eee ? [
		[ _('Advertised'), formatModes(eee['advertised-eee-link-modes']) ],
		[ _('Link partner'), up ? formatModes(eee['link-partner-advertised-eee-link-modes']) : '-' ],
		[ _('Status'), formatEEEStatus(eee) ]
	] : [
		[ _('Status'), known ? _('Not supported') : '-' ]
	]));

	/* themes size .ifacebox for the small badges on the overview (OpenWrt 2020: max-width 150px) */
	return E('div', { 'class': 'ifacebox', 'style': 'margin:0;max-width:none;align-items:stretch;text-align:left' }, [
		E('div', { 'class': 'ifacebox-head', 'style': 'display:flex;align-items:center;gap:.5em;padding:.25em .5em' }, [
			E('img', { 'src': L.resource('icons/port_%s.svg').format(up ? 'up' : 'down'), 'style': 'width:28px' }),
			E('strong', {}, [ name ]),
			E('span', { 'style': 'margin-left:auto' }, [ !known ? '-' : up ? formatSpeed(link.speed) : _('no link') ])
		]),
		E('div', { 'class': 'ifacebox-body', 'style': 'display:grid;grid-template-columns:auto 1fr;gap:.15em .75em;padding:0 .5em .5em;font-size:90%;text-align:left;white-space:normal' }, groups)
	]);
}

return view.extend({
	load() {
		return L.resolveDefault(callGetBuiltinEthernetPorts(), []).then((ports) => {
			const names = ports.map((p) => p.device).sort(L.naturalCompare);

			return L.resolveDefault(callEthtoolStatus(names, true), {}).then((status) => [ names, status ]);
		});
	},

	renderPorts(names, status) {
		if (!names.length)
			return E('em', {}, [ _('No Ethernet ports found') ]);

		return names.map((name) => renderPort(name, status[name]));
	},

	render([ names, status ]) {
		const grid = E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fill, minmax(18em, 1fr));gap:1em' },
			this.renderPorts(names, status));

		poll.add(() => L.resolveDefault(callEthtoolStatus(names, true), {}).then((st) => dom.content(grid, this.renderPorts(names, st))), 5);

		return E([], [
			E('h2', {}, [ _('Ports') ]),
			E('div', { 'class': 'cbi-map-descr' }, [ _('This page displays the link and hardware status of the built-in Ethernet ports.') ]),
			grid
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
