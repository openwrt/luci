'use strict';
'require view';
'require dom';
'require uci';
'require ui';
'require telldus-mqtt.common as common';
'require telldus-mqtt.logic as logic';

// Sensors page: the sensors heard (status file) and the sensor sections
// of UCI. A name publishes a sensor. Field changes go to the local UCI
// data at once; Save & Apply sends them to the router.

// Sort: named sensors first (by name), then the others by id. This order
// does not change when new values come in.
function sortRows(rows) {
	return rows.sort(function(a, b) {
		if ((a.name == '') != (b.name == ''))
			return (a.name == '') ? 1 : -1;
		if (a.name != b.name)
			return (a.name < b.name) ? -1 : 1;
		return (a.id < b.id) ? -1 : (a.id > b.id) ? 1 : 0;
	});
}

return view.extend(Object.assign(common.deviceView('sensor'), {
	load: function() {
		return Promise.all([
			common.getStatus(),
			uci.load(common.CONFIG)
		]);
	},

	handleReplace: function(key, ev) {
		var oldRow = this.findRow(key);
		if (!oldRow)
			return;
		var now = this.result.now;
		var candidates = logic.replaceCandidates(oldRow, this.merge().rows);

		if (!candidates.length) {
			ui.showModal(_('Replace sensor'), [
				E('p', {}, [ _('No new sensor without a name is heard. Put the battery in the new sensor, wait until it shows in the list, then try again.') ]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, [ _('Close') ])
				])
			]);
			return;
		}

		var select = E('select', { 'class': 'cbi-input-select' }, candidates.map(function(r) {
			var text = r.id + ': ' + (logic.formatValues(r.values) || '-') +
				' (' + _('%s ago').format(logic.formatAge(logic.age(now, r.lastSeen))) + ')';
			return E('option', { 'value': r.key }, [ text ]);
		}));

		ui.showModal(_('Replace sensor'), [
			E('p', {}, [ _('Use this when a sensor has a new id, for example after a battery change. The new sensor gets the name and topic of "%s".').format(oldRow.name) ]),
			E('p', {}, [ _('Old sensor: %s').format(oldRow.id) ]),
			E('p', {}, [ _('MQTT topic:'), ' ', oldRow.effectiveTopic ]),
			E('p', {}, [ _('New sensor (newest first):'), E('br'), select ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-positive',
					'click': L.bind(function() {
						var newRow = this.findRow(select.value);
						var fresh = this.findRow(key);
						if (newRow && fresh)
							common.applyOps(logic.planReplace(fresh, newRow));
						ui.hideModal();
						this.draw();
					}, this)
				}, [ _('Replace') ])
			])
		]);
	},

	renderTable: function(rows) {
		var now = this.result.now;
		var dups = logic.duplicateTopics(rows);
		var table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Name') ]),
				E('th', { 'class': 'th' }, [ _('MQTT topic') ]),
				E('th', { 'class': 'th' }, [ _('Sensor id') ]),
				E('th', { 'class': 'th' }, [ _('Values') ]),
				E('th', { 'class': 'th' }, [ _('Last heard') ]),
				E('th', { 'class': 'th cbi-section-actions' }, [ '' ])
			])
		]);

		if (!rows.length)
			table.appendChild(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '6' }, [
					E('em', {}, [ _('No sensors heard yet. Sensors send every few minutes.') ]) ])
			]));

		for (var i = 0; i < rows.length; i++) {
			var r = rows[i];

			var seen;
			if (!r.heard)
				seen = _('Not heard since the service started');
			else
				seen = _('%s ago').format(logic.formatAge(logic.age(now, r.lastSeen))) +
					(r.online ? '' : ', ' + _('offline'));
			var seenCell = [ seen ];
			if (r.duplicate)
				seenCell.push(E('br'), E('em', {}, [ _('Not used: another section has this sensor') ]));

			var actions = [];
			if (r.sid && r.name != '')
				actions.push(E('button', {
					'class': 'cbi-button cbi-button-action',
					'title': _('Give this name to a new sensor, for example after a battery change'),
					'click': ui.createHandlerFn(this, 'handleReplace', r.key)
				}, [ _('Replace') ]));
			if (r.sid && r.name != '')
				actions.push(' ', this.removeNameButton(r));

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Name') }, [ this.nameInput(r) ]),
				E('td', { 'class': 'td', 'data-title': _('MQTT topic') }, this.topicCell(r, dups)),
				E('td', { 'class': 'td', 'data-title': _('Sensor id') }, [ r.id ]),
				E('td', { 'class': 'td', 'data-title': _('Values') }, [ logic.formatValues(r.values) || '-' ]),
				E('td', { 'class': 'td', 'data-title': _('Last heard') }, seenCell),
				E('td', { 'class': 'td cbi-section-actions' }, actions)
			]));
		}
		return table;
	},

	draw: function() {
		var merged = this.merge();
		var parts = [];
		var hint = common.statusHint(this.result);
		if (hint)
			parts.push(hint);
		parts.push(common.gatewayNote(this.result, merged.otherGateways,
			_('%d sensors for other TellSticks are not shown and not changed.').format(merged.otherGateways)));
		parts.push(this.renderTable(sortRows(merged.rows)));
		dom.content(this.box, parts);
	},

	render: function(data) {
		this.result = data[0];
		this.box = E('div', {});
		this.draw();
		this.startPoll();

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('Sensors') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('The sensors that the service heard since it started, and the named sensors. Type a name to publish a sensor to MQTT and Home Assistant. Sensors without a name are not published. Click Save & Apply when you are done.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				this.topicHint(),
				this.box
			])
		]);
	}
}));
