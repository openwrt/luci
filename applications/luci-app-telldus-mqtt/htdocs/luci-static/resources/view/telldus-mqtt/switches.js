'use strict';
'require view';
'require dom';
'require uci';
'require ui';
'require telldus-mqtt.common as common';
'require telldus-mqtt.logic as logic';

// Switches page: the switches of telldusd (status file) and the switch
// sections of UCI, and the capture of remote control buttons. A switch
// made from a captured button is a UCI switch section with RF options;
// with manage_switches = 1 it becomes a device in /etc/tellstick.conf.

// The capture shows new events fast
var CAPTURE_POLL_SECONDS = 2;

function sortRows(rows) {
	return rows.sort(function(a, b) {
		var x = parseInt(a.id, 10), y = parseInt(b.id, 10);
		if (!isNaN(x) && !isNaN(y) && x != y)
			return x - y;
		return (a.key < b.key) ? -1 : (a.key > b.key) ? 1 : 0;
	});
}

function manageSwitches() {
	return common.main().manage_switches == '1';
}

return view.extend(Object.assign(common.deviceView('switch'), {
	load: function() {
		return Promise.all([
			common.getStatus(),
			uci.load(common.CONFIG)
		]);
	},

	handleDelete: function(key, ev) {
		var row = this.findRow(key);
		if (!row || !row.sid)
			return;
		ui.showModal(_('Remove switch'), [
			E('p', {}, [ _('Remove switch %s "%s"?').format(row.id, row.name || '-') ]),
			E('p', {}, [ row.rf.protocol
				? _('It is also removed from telldusd (tellstick.conf) after Save & Apply.')
				: _('It is not published any more after Save & Apply.') ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-negative',
					'click': L.bind(function() {
						common.applyOps([ { op: 'remove', sid: row.sid } ]);
						ui.hideModal();
						this.draw();
					}, this)
				}, [ _('Remove') ])
			])
		]);
	},

	handleSwitch: function(id, on, ev) {
		return common.setSwitch(id, on);
	},

	// On and Off buttons: switch the device now. No Save & Apply.
	switchButtons: function(row) {
		var id = logic.switchId(row);
		if (id == null)
			return [];
		return [ E('br'),
			E('button', {
				'class': 'cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, 'handleSwitch', id, true)
			}, [ _('On') ]),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, 'handleSwitch', id, false)
			}, [ _('Off') ]) ];
	},

	renderTable: function(rows) {
		var dups = logic.duplicateTopics(rows);
		var table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Name') ]),
				E('th', { 'class': 'th' }, [ _('MQTT topic') ]),
				E('th', { 'class': 'th' }, [ _('Id') ]),
				E('th', { 'class': 'th' }, [ _('Radio code') ]),
				E('th', { 'class': 'th' }, [ _('State') ]),
				E('th', { 'class': 'th cbi-section-actions' }, [ '' ])
			])
		]);

		if (!rows.length)
			table.appendChild(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '6' }, [
					E('em', {}, [ _('No switches yet. Capture a button of a remote control below to make one.') ]) ])
			]));

		for (var i = 0; i < rows.length; i++) {
			var r = rows[i];

			var state = [ (r.values && r.values.state) ? String(r.values.state) : '-' ].concat(this.switchButtons(r));
			if (!r.heard)
				state.push(E('br'), E('em', {}, [ r.rf.protocol
					? _('Not in telldusd yet: Save & Apply')
					: _('Not in telldusd') ]));
			if (r.duplicate)
				state.push(E('br'), E('em', {}, [ _('Not used: another section has this switch') ]));

			var actions = [];
			if (r.sid && r.name != '')
				actions.push(this.removeNameButton(r), ' ');
			if (r.sid)
				actions.push(E('button', {
					'class': 'cbi-button cbi-button-remove',
					'click': ui.createHandlerFn(this, 'handleDelete', r.key)
				}, [ _('Remove') ]));

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Name') }, [ this.nameInput(r) ]),
				E('td', { 'class': 'td', 'data-title': _('MQTT topic') }, this.topicCell(r, dups)),
				E('td', { 'class': 'td', 'data-title': _('Id') }, [ r.id ]),
				E('td', { 'class': 'td', 'data-title': _('Radio code') }, [ logic.formatRf(r.rf) || '-' ]),
				E('td', { 'class': 'td', 'data-title': _('State') }, state),
				E('td', { 'class': 'td cbi-section-actions' }, actions)
			]));
		}
		return table;
	},

	// ---- Capture of remote control buttons ----

	handleCaptureStart: function(ev) {
		this.capture = logic.captureStart(common.events(this.result));
		this.drawCapture();
	},

	handleCaptureStop: function(ev) {
		this.capture = null;
		this.drawCapture();
	},

	handleCreate: function(index, ev) {
		var event = this.captured[index];
		if (!event)
			return;
		var mapped = logic.eventToSwitch(event);
		var prefix = this.prefix();
		var topic = E('span', {}, [ '-' ]);
		var name = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'placeholder': _('For example: Lamp living room'),
			'input': function(ev) {
				var n = ev.target.value.trim();
				topic.textContent = (n != '') ? logic.deriveTopic(prefix, n) : '-';
			}
		});
		var id = logic.nextSwitchId(common.sections(), common.devices(this.result));

		var body = [
			E('p', {}, [ _('Radio code: %s').format(logic.formatRf(mapped.options)) ]),
			E('p', {}, [ _('Switch id: %s').format(id) ])
		];
		if (!mapped.known)
			body.push(E('div', { 'class': 'alert-message warning' }, [
				E('p', {}, [ _('This type of remote control is not known to this page. The options are copied from the radio message. They can need a change in /etc/config/telldus-mqtt.') ]) ]));
		body.push(E('p', {}, [ _('The TellStick sends the same code as the remote control. A receiver that reacts to this button also reacts to the new switch.') ]));
		if (!manageSwitches())
			body.push(E('div', { 'class': 'alert-message warning' }, [
				E('p', {}, [ _('"Manage switches" is off in Settings: the switch is saved, but telldusd does not get it.') ]) ]));
		body.push(E('p', {}, [ _('Name:'), E('br'), name ]));
		body.push(E('p', {}, [ _('MQTT topic:'), ' ', topic ]));
		body.push(E('div', { 'class': 'right' }, [
			E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, [ _('Cancel') ]),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-positive',
				'click': L.bind(function() {
					if (name.value.trim() == '') {
						name.classList.add('cbi-input-invalid');
						name.focus();
						return;
					}
					common.applyOps(logic.planCreateSwitch(event, name.value, common.sections(),
						common.devices(this.result), common.serial(this.result)));
					ui.hideModal();
					this.draw();
				}, this)
			}, [ _('Create switch') ])
		]));

		ui.showModal(_('Create switch'), body);
		name.focus();
	},

	renderCapture: function() {
		if (!this.capture)
			return [
				E('p', { 'class': 'cbi-section-descr' }, [
					_('Make a switch from a button of a remote control: click Start, then press the button on the remote control.') ]),
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, 'handleCaptureStart')
				}, [ _('Start') ])
			];

		var now = this.result.now;
		var list = logic.capturedEvents(common.events(this.result), this.capture);
		this.captured = list;
		var sections = common.sections();

		var table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Heard') ]),
				E('th', { 'class': 'th' }, [ _('Radio message') ]),
				E('th', { 'class': 'th' }, [ _('Switch') ]),
				E('th', { 'class': 'th cbi-section-actions' }, [ '' ])
			])
		]);

		if (!list.length)
			table.appendChild(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '4' }, [
					E('em', {}, [ _('Press a button on the remote control now.') ]) ])
			]));

		for (var i = 0; i < list.length; i++) {
			var ev = list[i];
			var mapped = logic.eventToSwitch(ev);
			var found = logic.findSwitch(sections, mapped.options);
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Heard') }, [
					_('%s ago').format(logic.formatAge(logic.age(now, ev.time))) ]),
				E('td', { 'class': 'td', 'data-title': _('Radio message') }, [ logic.formatEvent(ev) ]),
				E('td', { 'class': 'td', 'data-title': _('Switch') }, [
					found ? _('Switch %s "%s" has this code').format(found.id, found.name || '-') : '-' ]),
				E('td', { 'class': 'td cbi-section-actions' }, [
					E('button', {
						'class': 'cbi-button cbi-button-add',
						'click': ui.createHandlerFn(this, 'handleCreate', i)
					}, [ _('Create switch') ])
				])
			]));
		}

		return [
			E('p', { 'class': 'cbi-section-descr' }, [
				_('Press a button on the remote control. The radio messages heard after Start show here, newest first.') ]),
			table,
			E('button', {
				'class': 'cbi-button',
				'click': ui.createHandlerFn(this, 'handleCaptureStop')
			}, [ _('Stop') ])
		];
	},

	drawCapture: function() {
		dom.content(this.captureBox, this.renderCapture());
	},

	// The poll calls this when the user types in the table
	drawLive: function() {
		this.drawCapture();
	},

	draw: function() {
		var merged = this.merge();
		var parts = [];
		var hint = common.statusHint(this.result);
		if (hint)
			parts.push(hint);
		if (!manageSwitches())
			parts.push(E('div', { 'class': 'alert-message notice' }, [ E('p', {}, [
				_('"Manage switches" is off in Settings. This page names the switches of telldusd, but it does not change tellstick.conf.') ]) ]));
		parts.push(common.gatewayNote(this.result, merged.otherGateways,
			_('%d switches for other TellSticks are not shown and not changed.').format(merged.otherGateways)));
		parts.push(this.renderTable(sortRows(merged.rows)));
		dom.content(this.box, parts);
		this.drawCapture();
	},

	render: function(data) {
		this.result = data[0];
		this.capture = null;
		this.captured = [];
		this.box = E('div', {});
		this.captureBox = E('div', {});
		this.draw();
		this.startPoll(CAPTURE_POLL_SECONDS);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('Switches') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('The switches of telldusd. Type a name to publish a switch to MQTT and Home Assistant. Switches without a name are not published. Click Save & Apply when you are done.')
			]),
			E('div', { 'class': 'cbi-section' }, [
				this.topicHint(),
				this.box
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Capture a remote control button') ]),
				this.captureBox
			])
		]);
	}
}));
