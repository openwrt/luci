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

function loadPortStatus(portNames) {
	return L.resolveDefault(callEthtoolStatus(portNames, true), {});
}

function formatSpeed(mbit) {
	if (mbit >= 1000)
		return '%s\u202fGbit/s'.format(mbit / 1000);

	return '%d\u202fMbit/s'.format(mbit);
}

/* "10000baseT/Full" -> "10G", ascending */
function formatLinkModes(modes) {
	if (!Array.isArray(modes))
		return '-';

	const speeds = [];

	for (const mode of modes) {
		const mbit = parseInt(mode);

		if (mbit > 0 && !speeds.includes(mbit))
			speeds.push(mbit);
	}

	if (!speeds.length)
		return _('None');

	speeds.sort((a, b) => a - b);

	return speeds.map((mbit) => (mbit >= 1000) ? '%sG'.format(mbit / 1000) : '%dM'.format(mbit)).join(', ');
}

function formatOnOff(value) {
	if (value == null)
		return '-';

	return value ? _('On') : _('Off');
}

function formatPauseDirection(rx, tx) {
	if (rx && tx)
		return _('RX and TX');

	if (rx)
		return _('RX only');

	if (tx)
		return _('TX only');

	return _('Off');
}

function formatPauseResult(pause, linkUp) {
	if (!pause)
		return '-';

	/* without pause autonegotiation the configured RX/TX values apply as they are */
	if (!pause.autonegotiate)
		return '%s (%s)'.format(formatPauseDirection(pause.rx, pause.tx), _('forced'));

	if (!linkUp || !pause.negotiated)
		return '-';

	return formatPauseDirection(pause.negotiated.rx, pause.negotiated.tx);
}

function formatEEEStatus(status) {
	switch (status) {
	case 'active':   return _('Active');
	case 'inactive': return _('Inactive');
	case 'disabled': return _('Disabled');
	default:         return status ?? '-';
	}
}

function formatTemperature(celsius) {
	if (celsius == null)
		return '-';

	return '%.1f\u202f°C'.format(celsius);
}

/* a titled table of label/value rows, in the markup the status overview
 * uses, so every theme styles it like its other status tables */
function renderGroup(title, rows) {
	return [
		E('h4', {}, [ title ]),
		E('table', { 'class': 'table' }, rows.map(([ label, value ]) =>
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '40%' }, [ label ]),
				E('td', { 'class': 'td left' }, [ value ])
			])))
	];
}

function renderLinkGroup(port) {
	const link = port.link;
	let speed = '-';

	if (port.hasStatus)
		speed = port.linkUp ? '%s, %s'.format(formatSpeed(link.speed), link.duplex) : _('No link');

	return renderGroup(_('Link'), [
		[ _('Speed'), speed ],
		[ _('Port type'), link.port ?? '-' ],
		[ _('Auto negotiation'), formatOnOff(link['auto-negotiation']) ],
		[ _('Supported'), formatLinkModes(link['supported-link-modes']) ],
		[ _('Link partner'), port.linkUp ? formatLinkModes(link['link-partner-advertised-link-modes']) : '-' ],
		[ _('Temperature'), formatTemperature(port.temperature) ]
	]);
}

function renderFlowControlGroup(port) {
	const link = port.link;

	return renderGroup(_('Flow control'), [
		[ _('Advertised'), link['advertised-pause-frame-use'] ?? '-' ],
		[ _('Link partner'), port.linkUp ? (link['link-partner-advertised-pause-frame-use'] ?? '-') : '-' ],
		[ _('Result'), formatPauseResult(port.pause, port.linkUp) ]
	]);
}

function renderEEEGroup(port) {
	const eee = port.eee;

	if (!eee)
		return renderGroup(_('Energy Efficient Ethernet'), [
			[ _('Status'), port.hasStatus ? _('Not supported') : '-' ]
		]);

	return renderGroup(_('Energy Efficient Ethernet'), [
		[ _('Advertised'), formatLinkModes(eee['advertised-eee-link-modes']) ],
		[ _('Link partner'), port.linkUp ? formatLinkModes(eee['link-partner-advertised-eee-link-modes']) : '-' ],
		[ _('Status'), formatEEEStatus(eee.status) ]
	]);
}

function renderPortHeader(port) {
	let summary = '-';

	if (port.hasStatus)
		summary = port.linkUp ? formatSpeed(port.link.speed) : _('No link');

	return E('h3', {}, [ '%s: %s'.format(port.name, summary) ]);
}

function renderPort(name, status) {
	const port = {
		name: name,
		/* without ethtool JSON output (needs ethtool-full) nothing is known about the port */
		hasStatus: !!status?.link,
		link: status?.link ?? {},
		linkUp: !!status?.link?.['link-detected'],
		pause: status?.pause,
		eee: status?.eee,
		temperature: status?.temperature
	};

	return E('div', { 'class': 'cbi-section' }, [
		renderPortHeader(port),
		...renderLinkGroup(port),
		...renderFlowControlGroup(port),
		...renderEEEGroup(port)
	]);
}

function renderPorts(portNames, statusByName) {
	if (!portNames.length)
		return E('em', {}, [ _('No Ethernet ports found') ]);

	return portNames.map((name) => renderPort(name, statusByName[name]));
}

return view.extend({
	load() {
		return L.resolveDefault(callGetBuiltinEthernetPorts(), []).then((ports) => {
			const portNames = ports.map((port) => port.device).sort(L.naturalCompare);

			return loadPortStatus(portNames).then((statusByName) => [ portNames, statusByName ]);
		});
	},

	render([ portNames, statusByName ]) {
		const grid = E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fill, minmax(22em, 1fr));gap:1em;align-items:start' },
			renderPorts(portNames, statusByName));

		poll.add(() => loadPortStatus(portNames).then((statusByName) => {
			dom.content(grid, renderPorts(portNames, statusByName));
		}), 5);

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
