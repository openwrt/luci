'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';

var callGetStatus = rpc.declare({
	object: 'luci.jrd',
	method: 'getStatus'
});

function unknown() {
	return E('em', [ _('unknown') ]);
}

function value(v) {
	return (v === null || v === undefined || v === '') ? unknown() : String(v);
}

function connectionState(v) {
	switch (+v) {
	case 0: return _('Disconnected');
	case 1: return _('Connecting');
	case 2: return _('Connected');
	case 3: return _('Disconnecting');
	default: return value(v);
	}
}

function networkType(v) {
	var types = {
		0: _('No service'),
		1: 'GPRS',
		2: 'EDGE',
		3: 'HSPA',
		4: 'HSUPA',
		5: 'UMTS',
		6: 'HSPA+',
		7: 'DC-HSPA+',
		8: 'LTE',
		9: 'LTE+',
		10: 'CDMA',
		11: 'GSM',
		12: 'EVDO',
		13: 'LTE FDD',
		14: 'LTE TDD'
	};

	return types[+v] || value(v);
}

function simState(v) {
	var states = {
		0: _('No SIM'),
		1: _('Detected'),
		2: _('PIN required'),
		3: _('PUK required'),
		4: _('SIM locked'),
		5: _('PUK attempts exhausted'),
		6: _('Invalid'),
		7: _('Ready'),
		11: _('Initializing')
	};

	return states[+v] || value(v);
}

function formatDuration(v) {
	var s = +v;

	if (!isFinite(s) || s < 0)
		return unknown();

	var d = Math.floor(s / 86400);
	var h = Math.floor((s % 86400) / 3600);
	var m = Math.floor((s % 3600) / 60);
	var sec = Math.floor(s % 60);
	var out = [];

	if (d)
		out.push('%dd'.format(d));
	if (d || h)
		out.push('%dh'.format(h));
	if (d || h || m)
		out.push('%dm'.format(m));
	out.push('%ds'.format(sec));

	return out.join(' ');
}

function formatBytes(v) {
	return isFinite(+v) ? '%1024mB'.format(+v) : unknown();
}

function signalValue(v, unit) {
	return (v === null || v === undefined || v === '') ? unknown() : '%s %s'.format(v, unit);
}

function renderInterface(info) {
	if (!info.reachable) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', [ _('Interface "%s"').format(info.name) ]),
			ui.itemlist(E([]), [
				_('Device'), value(info.device),
				_('Profile'), value(info.profile),
				_('Ethernet LED interface'), value(info.ethernet_interface),
				_('Control endpoint'), (info.modem_ip && info.port) ? '%s:%d'.format(info.modem_ip, info.port) : unknown(),
				_('Modem control'), E('span', { 'class': 'label warning' }, [ info.profile_error ? value(info.profile_error) : _('Unreachable') ])
			])
		]);
	}

	var c = info.connection || {};
	var n = info.network || {};
	var s = info.system || {};
	var sim = info.sim || {};
	var conn = (c.ConnectionStatus !== undefined) ? c.ConnectionStatus : s.ConnectionStatus;

	return E('div', { 'class': 'cbi-section' }, [
		E('h3', [ _('Interface "%s"').format(info.name) ]),

		E('h4', [ _('Connection') ]),
		ui.itemlist(E([]), [
			_('Device'), value(info.device),
			_('Profile'), value(info.profile),
			_('Ethernet LED interface'), value(info.ethernet_interface),
			_('Control endpoint'), (info.modem_ip && info.port) ? '%s:%d'.format(info.modem_ip, info.port) : unknown(),
			_('State'), connectionState(conn),
			_('Mobile IPv4 address'), value(c.IPv4Adrress),
			_('Mobile IPv6 address'), value(c.IPv6Adrress),
			_('Connection time'), formatDuration(c.ConnectionTime),
			_('Data received'), formatBytes(c.DlBytes),
			_('Data transmitted'), formatBytes(c.UlBytes)
		]),

		E('h4', [ _('Mobile network') ]),
		ui.itemlist(E([]), [
			_('Operator'), value(n.NetworkName || s.NetworkName),
			_('Service provider'), value(n.SpnName),
			_('Network type'), networkType(n.NetworkType !== undefined ? n.NetworkType : s.NetworkType),
			_('PLMN'), value(n.PLMN),
			_('MCC / MNC'), (n.mcc || n.mnc) ? '%s / %s'.format(n.mcc || '-', n.mnc || '-') : unknown(),
			_('Cell ID'), value(n.CellId),
			_('eNodeB ID'), value(n.eNBID),
			_('CGI'), value(n.CGI),
			_('RSRP'), signalValue(n.RSRP, 'dBm'),
			_('RSRQ'), signalValue(n.RSRQ, 'dB'),
			_('RSSI'), signalValue(n.RSSI, 'dBm'),
			_('SINR'), signalValue(n.SINR, 'dB')
		]),

		E('h4', [ _('SIM') ]),
		ui.itemlist(E([]), [
			_('SIM state'), simState(sim.SIMState),
			_('PIN state'), value(sim.PinState),
			_('PIN attempts remaining'), value(sim.PinRemainingTimes),
			_('PUK attempts remaining'), value(sim.PukRemainingTimes)
		])
	]);
}

function renderStatus(data) {
	var interfaces = data && Array.isArray(data.interfaces) ? data.interfaces : [];
	var nodes = [ E('h2', [ _('Cellular Status') ]) ];

	if (!interfaces.length) {
		nodes.push(E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
			E('em', [ _('No JRD cellular interfaces are configured.') ])
		]));
	}
	else {
		interfaces.forEach(function(info) {
			nodes.push(renderInterface(info));
		});
	}

	return E([], nodes);
}

return view.extend({
	render: function() {
		poll.add(function() {
			return callGetStatus().then(function(data) {
				dom.content(document.querySelector('#jrd-status'), renderStatus(data));
			});
		}, 5);

		return E('div', { 'id': 'jrd-status' }, [
			E('h2', [ _('Cellular Status') ]),
			E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
				E('em', [ _('Loading data…') ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
