'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require ui';
'require telldus-mqtt.common as common';
'require telldus-mqtt.logic as logic';

// Status page: service, TellStick, telldusd, broker, last radio message.

function yesNo(value, yes, no) {
	return value ? yes : no;
}

function brokerHint(result) {
	var parts = [ _('To run an MQTT broker on this router, install mosquitto and luci-app-mosquitto.') ];
	if (result.mosquitto.luci)
		parts = [ _('Set up the MQTT broker of this router:') + ' ',
			E('a', { 'href': L.url('admin/services/mosquitto') }, _('Mosquitto')) ];
	return E('p', { 'class': 'cbi-section-descr' }, parts);
}

return view.extend({
	load: function() {
		return Promise.all([
			common.getStatus(),
			L.resolveDefault(uci.load(common.CONFIG), null)
		]);
	},

	renderStatus: function(result) {
		var st = result.status || {};
		var now = result.now;
		var svc = result.service;
		var live = !!(svc.running && result.status && st.running !== false);
		var unknown = _('Not known');
		var rows = [];

		var service;
		if (result.error)
			service = unknown;
		else if (!svc.installed)
			service = _('Not installed');
		else
			service = yesNo(svc.running, _('Running'), _('Not running'));
		if (st.version)
			service += ' (' + _('version %s').format(st.version) + ')';
		rows.push([ _('Service'), service ]);

		if (live && st.started)
			rows.push([ _('Running for'), logic.formatAge(logic.age(now, st.started)) ]);

		var gw = st.gateway || {};
		var stick = result.status ? yesNo(gw.found, _('Found'), _('Not found')) : unknown;
		if (gw.found && (gw.type || gw.serial))
			stick += ': ' + [ gw.type, gw.serial ? _('serial %s').format(gw.serial) : '' ].filter(Boolean).join(', ');
		rows.push([ _('TellStick'), stick ]);

		rows.push([ _('telldusd (Telldus service)'),
			result.status ? yesNo(st.service && st.service.connected, _('Connected'), _('Not connected')) : unknown ]);

		var b = st.broker || {};
		var where = b.host ? ' (%s:%s)'.format(b.host, b.port) : '';
		rows.push([ _('MQTT broker'),
			result.status ? yesNo(b.connected, _('Connected'), _('Not connected')) + where : unknown ]);

		var rf;
		if (!result.status)
			rf = unknown;
		else if (!st.last_rf)
			rf = _('None since the service started');
		else
			rf = _('%s ago').format(logic.formatAge(logic.age(now, st.last_rf)));
		rows.push([ _('Last radio message'), rf ]);

		var table = E('table', { 'class': 'table' }, rows.map(function(r) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, r[0]),
				E('td', { 'class': 'td left' }, [ r[1] ])	// text, not HTML
			]);
		}));

		var notes = [];
		var hint = common.statusHint(result);
		if (hint)
			notes.push(hint);
		else if (!live)
			notes.push(E('div', { 'class': 'alert-message warning' }, [
				E('p', _('The service stopped or is starting. The values are from the last time it ran.')) ]));
		if (common.main().enabled == '0')
			notes.push(E('div', { 'class': 'alert-message warning' }, [
				E('p', _('The service is off. Turn it on in Settings.')) ]));
		if (result.status && !b.connected)
			notes.push(brokerHint(result));

		return E('div', {}, notes.concat([ table ]));
	},

	render: function(data) {
		var result = data[0];
		var box = E('div', {}, this.renderStatus(result));

		poll.add(L.bind(function() {
			return common.getStatus().then(L.bind(function(r) {
				dom.content(box, this.renderStatus(r));
			}, this));
		}, this), common.POLL_SECONDS);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', _('Telldus MQTT')),
			E('div', { 'class': 'cbi-map-descr' },
				_('telldus-mqtt connects a TellStick (433 MHz) to an MQTT broker. Home Assistant finds the named sensors and switches.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Status')),
				box,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, function() {
							return common.restart();
						})
					}, _('Restart service'))
				])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
