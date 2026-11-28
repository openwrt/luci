'use strict';
'require baseclass';
'require rpc';
'require uci';
'require ui';
'require poll';
'require telldus-mqtt.logic as logic';

// Code used by all telldus-mqtt views: the rpc calls, UCI changes and
// some page parts.

var CONFIG = 'telldus-mqtt';
var SERVICE = 'telldus-mqtt';
var STATUS_FILE = '/var/run/telldus-mqtt.json';
var POLL_SECONDS = 5;

// The rpcd plugin root/usr/share/rpcd/ucode/luci.telldus-mqtt
var callGetStatus = rpc.declare({
	object: 'luci.telldus-mqtt',
	method: 'getStatus',
	expect: { '': {} }
});

var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

var callSetSwitch = rpc.declare({
	object: 'luci.telldus-mqtt',
	method: 'setSwitch',
	params: [ 'id', 'on' ],
	expect: { '': {} }
});

// Switch a device on or off now (tdtool). The page shows the new state
// when telldus-mqtt has it in the status file. Notification on failure.
function setSwitch(id, on) {
	return callSetSwitch(id, !!on).then(function(r) {
		return (r && r.ok) ? null : ((r && r.error) || _('Unknown error'));
	}, function(err) {
		return String((err && err.message) || err);
	}).then(function(error) {
		if (error != null)
			ui.addNotification(null, E('p', {}, [ _('Cannot switch %d: %s').format(id, error) ]), 'danger');
	});
}

// The result of getStatus. If the call fails: { error: true, ... }.
function getStatus() {
	return L.resolveDefault(callGetStatus(), null).then(function(r) {
		if (!r || typeof r.now != 'number')
			return { error: true, now: null, status: null, status_error: null, service: {}, mosquitto: {} };
		r.service = r.service || {};
		r.mosquitto = r.mosquitto || {};
		return r;
	});
}

function serial(result) {
	var s = result && result.status;
	return (s && s.gateway && typeof s.gateway.serial == 'string') ? s.gateway.serial : '';
}

function devices(result) {
	var s = result && result.status;
	return (s && Array.isArray(s.devices)) ? s.devices : [];
}

function events(result) {
	var s = result && result.status;
	return (s && Array.isArray(s.events)) ? s.events : [];
}

function restart() {
	return L.resolveDefault(callInitAction(SERVICE, 'restart'), false).then(function(ok) {
		if (ok)
			ui.addNotification(null, E('p', {}, [ _('The service restarts now.') ]), 'info');
		else
			ui.addNotification(null, E('p', {}, [ _('Cannot restart the service. Is telldus-mqtt installed?') ]), 'danger');
	});
}

// Apply operations of logic.plan*() to the local UCI data. Save & Apply
// sends them to the router.
function applyOps(ops) {
	for (var i = 0; i < ops.length; i++) {
		var op = ops[i];
		if (op.op == 'add') {
			var sid = uci.add(CONFIG, 'device');
			for (var k in op.values)
				uci.set(CONFIG, sid, k, op.values[k]);
		}
		else if (op.op == 'set') {
			uci.set(CONFIG, op.sid, op.option, op.value);
		}
		else if (op.op == 'unset') {
			uci.unset(CONFIG, op.sid, op.option);
		}
		else if (op.op == 'remove') {
			uci.remove(CONFIG, op.sid);
		}
	}
}

function sections() {
	return uci.sections(CONFIG, 'device');
}

function main() {
	return uci.get(CONFIG, 'main') || {};
}

// A hint when the status is not complete, or null
function statusHint(result) {
	var text = null;
	if (result.error)
		text = _('Cannot get the status from the router. Restart rpcd (or the router) after you install the page.');
	else if (result.status_error == 'missing')
		text = _('There is no status file %s. Start the service. The service must write the status file (option --status).').format(STATUS_FILE);
	else if (result.status_error == 'invalid')
		text = _('The status file %s is not valid.').format(STATUS_FILE);
	else if (!result.service.running)
		text = _('The service is not running. The data is from the last time it ran.');
	if (!text)
		return null;
	return E('div', { 'class': 'alert-message warning' }, [ E('p', {}, [ text ]) ]);
}

// A note about the TellStick (gateway) that the page uses.
// otherText: the text for otherCount > 0, e.g. "3 sensors for other ..."
function gatewayNote(result, otherCount, otherText) {
	var s = serial(result);
	var parts = [];
	if (otherCount > 0) {
		if (s == '')
			parts.push(_('The TellStick serial is not known yet. Only devices for all TellSticks are shown.'));
		else
			parts.push(_('Shown: the devices of TellStick %s and the devices for all TellSticks.').format(s));
		parts.push(otherText);
	}
	if (!parts.length)
		return '';
	return E('p', { 'class': 'cbi-section-descr' }, [ parts.join(' ') ]);
}

// True if the user types in the container or a dialog is open: then the
// poll must not draw the table again.
function modalOpen() {
	return document.body.classList.contains('modal-overlay-active');
}

function busy(container) {
	if (modalOpen())
		return true;
	var a = document.activeElement;
	return !!(a && container && container.contains(a) &&
		(a.tagName == 'INPUT' || a.tagName == 'SELECT' || a.tagName == 'TEXTAREA'));
}

// Functions for the views of sensors and switches (type 'sensor' or
// 'switch'). The view sets this.result (getStatus) and this.box (the
// element that draw() fills), and has draw().
// Field changes go to the local UCI data at once. The page footer
// (Save, Save & Apply, Reset) works on these UCI changes.
function deviceView(type) {
	return {
		merge: function() {
			return logic.mergeDevices(type, devices(this.result), sections(),
				serial(this.result), logic.topicPrefix(main()));
		},

		// Rows are found again by key at each change: the UCI data can be
		// different from the time the table was drawn.
		findRow: function(key) {
			var rows = this.merge().rows;
			for (var i = 0; i < rows.length; i++)
				if (rows[i].key == key)
					return rows[i];
			return null;
		},

		// Draw again after a change, if the user does not type in another field
		redrawSoon: function() {
			window.setTimeout(L.bind(function() {
				if (!busy(this.box))
					this.draw();
			}, this), 0);
		},

		handleName: function(key, ev) {
			var row = this.findRow(key);
			if (!row)
				return;
			var section = row.sid ? uci.get(CONFIG, row.sid) : null;
			applyOps(logic.planName(row, ev.target.value, section, sections(), serial(this.result)));
			this.redrawSoon();
		},

		// As an empty name field: the device is not published any more
		handleRemoveName: function(key, ev) {
			var row = this.findRow(key);
			if (!row || !row.sid)
				return;
			applyOps(logic.planName(row, '', uci.get(CONFIG, row.sid), sections(), serial(this.result)));
			this.draw();
		},

		removeNameButton: function(row) {
			return E('button', {
				'class': 'cbi-button cbi-button-remove',
				'title': _('Do not publish this device any more'),
				'click': ui.createHandlerFn(this, 'handleRemoveName', row.key)
			}, [ _('Remove name') ]);
		},

		handleTopic: function(key, ev) {
			var row = this.findRow(key);
			if (!row)
				return;
			if (!logic.validTopic(ev.target.value)) {
				ev.target.classList.add('cbi-input-invalid');
				ui.addNotification(null, E('p', {}, [ _('A topic must not have + or #.') ]), 'warning');
				return;
			}
			ev.target.classList.remove('cbi-input-invalid');
			applyOps(logic.planTopic(row, ev.target.value));
			this.redrawSoon();
		},

		prefix: function() {
			return logic.topicPrefix(main());
		},

		// While the user types a name, the empty topic field shows the topic
		// that the name gives. The section is made when the name field loses
		// the focus ('change'), before the topic field gets it.
		nameInput: function(row) {
			return E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'value': row.name,
				'placeholder': _('Not published'),
				'change': L.bind(this.handleName, this, row.key),
				'input': L.bind(function(ev) {
					var tr = ev.target.closest('tr');
					var t = tr ? tr.querySelector('input[data-topic]') : null;
					var name = ev.target.value.trim();
					if (!t)
						return;
					t.disabled = (name == '');
					t.placeholder = (name != '') ? logic.deriveTopic(this.prefix(), name) : _('Type a name first');
				}, this)
			});
		},

		// The topic field. Empty: the topic is from the name (placeholder).
		topicCell: function(row, dups) {
			var named = (row.name != '' && row.sid);
			var cell = [ E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'data-topic': '1',
				'value': row.topic,
				'placeholder': named ? row.derivedTopic : _('Type a name first'),
				'disabled': named ? null : '',
				'change': L.bind(this.handleTopic, this, row.key)
			}) ];
			if (row.effectiveTopic != '' && dups[row.effectiveTopic])
				cell.push(E('br'), E('em', {}, [ _('Same topic as another device') ]));
			return cell;
		},

		// The prefix of new topics, and where to change it
		topicHint: function() {
			var p = this.prefix();
			return E('p', { 'class': 'cbi-section-descr' }, [
				(p != '')
					? _('An empty MQTT topic field gives the topic %s/<name>. Change the prefix on the Settings tab.').format(p)
					: _('An empty MQTT topic field gives the topic <name>. Change the prefix on the Settings tab.'),
				' ',
				_('A typed topic stays when you change the name or the prefix.')
			]);
		},

		startPoll: function(seconds) {
			poll.add(L.bind(function() {
				return getStatus().then(L.bind(function(r) {
					this.result = r;
					if (!busy(this.box))
						this.draw();
					else if (this.drawLive && !modalOpen())
						this.drawLive();	// Parts without fields
				}, this));
			}, this), seconds || POLL_SECONDS);
		},

		handleSave: function(ev) {
			var a = document.activeElement;
			if (a && a.blur)
				a.blur();	// The 'change' event of a field puts its value in UCI
			return uci.save().then(L.bind(function() {
				this.draw();	// New sections have their real names now
			}, this));
		},

		handleSaveApply: function(ev, mode) {
			return this.handleSave(ev).then(function() {
				ui.changes.apply(mode == '0');
			});
		},

		// Changes not saved are only in the page: load the page again
		handleReset: function(ev) {
			window.location.reload();
		}
	};
}

return baseclass.extend({
	CONFIG: CONFIG,
	SERVICE: SERVICE,
	STATUS_FILE: STATUS_FILE,
	POLL_SECONDS: POLL_SECONDS,
	getStatus: getStatus,
	serial: serial,
	devices: devices,
	events: events,
	restart: restart,
	setSwitch: setSwitch,
	applyOps: applyOps,
	sections: sections,
	main: main,
	statusHint: statusHint,
	gatewayNote: gatewayNote,
	busy: busy,
	deviceView: deviceView
});
