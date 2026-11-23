'use strict';
'require view';
'require rpc';
'require ui';
'require uci';
'require fs';

var callReboot = rpc.declare({
	object: 'system',
	method: 'reboot',
	expect: { result: 0 }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.changes(),
			L.resolveDefault(fs.stat('/sbin/poweroff'), null),
			L.resolveDefault(fs.stat('/sys/class/rtc/rtc0/wakealarm'), null),
			L.resolveDefault(fs.read('/sys/class/rtc/rtc0/wakealarm'), '')
		]);
	},

	render: function(data) {
		var changes = data[0],
			poweroffSupported = data[1] != null,
			wakealarmSupported = data[2] != null,
			wakealarm = (data[3] || '').trim();

		var body = E([
			E('h2', _('Reboot')),
			E('p', {}, _('Reboots the operating system of your device'))
		]);

		for (var config in (changes || {})) {
			body.appendChild(E('p', { 'class': 'alert-message warning' },
				_('Warning: There are unsaved changes that will get lost on reboot!')));
			break;
		}

		body.appendChild(E('hr'));
		body.appendChild(E('button', {
			'class': 'cbi-button cbi-button-action important',
			'click': ui.createHandlerFn(this, 'handleReboot')
		}, _('Perform reboot')));

		if (poweroffSupported) {
			body.appendChild(E('hr'));
			body.appendChild(E('h3', _('Power Off')));
			body.appendChild(E('p', {}, _('Shuts down the operating system and powers off the device')));
			body.appendChild(E('button', {
				'class': 'cbi-button cbi-button-negative important',
				'click': ui.createHandlerFn(this, 'handlePowerOff')
			}, _('Perform power off...')));
		}

		if (poweroffSupported && wakealarmSupported) {
			var tomorrow = new Date(Date.now() + 86400000);
			tomorrow.setHours(7, 0, 0, 0);
			var pad = function(n) { return String(n).padStart(2, '0'); };
			var defaultVal =
				tomorrow.getFullYear() + '-' +
				pad(tomorrow.getMonth() + 1) + '-' +
				pad(tomorrow.getDate()) + 'T' +
				pad(tomorrow.getHours()) + ':' +
				pad(tomorrow.getMinutes());

			var wakeInput = E('input', {
				'type': 'datetime-local',
				'class': 'cbi-input-text',
				'value': defaultVal
			});

			body.appendChild(E('hr'));
			body.appendChild(E('h3', _('Scheduled RTC Wake-Up')));
			body.appendChild(E('p', {},
				_('Schedules an automatic hardware wake-up before powering off the device')));

			if (wakealarm) {
				var armedDate = new Date(Number(wakealarm) * 1000);
				body.appendChild(E('p', { 'class': 'alert-message info' },
					_('Currently armed wake-up time: %s').format(armedDate.toLocaleString())));
			}

			body.appendChild(E('div', {}, [
				E('label', { 'style': 'margin-right: 0.5em;' }, _('Wake-up time:')),
				wakeInput,
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-negative important',
					'click': L.bind(this.handleScheduleWakeup, this, wakeInput)
				}, _('Power off and wake at scheduled time...'))
			]));
		}

		return body;
	},

	callPowerOff: function() {
		return fs.exec('/sbin/poweroff').then(function() {
			L.ui.showModal(_('Shutting down...'), [
				E('p', { 'class': 'spinning' },
					_('The system is shutting down now. Do not disconnect power until shutdown completes.'))
			]);
		}).catch(function(e) {
			L.ui.addNotification(null, E('p', e.message));
		});
	},

	callPowerOffAt: function(epoch) {
		return fs.write('/sys/class/rtc/rtc0/wakealarm', '0\n')
			.then(function() {
				return fs.write('/sys/class/rtc/rtc0/wakealarm', String(epoch) + '\n');
			})
			.then(L.bind(this.callPowerOff, this))
			.catch(function(e) {
				L.ui.addNotification(null, E('p', e.message));
			});
	},

	handlePowerOff: function(ev) {
		L.ui.showModal(_('Power Off Device'), [
			E('p', _('WARNING: Power off might result in a reboot on a device which does not support power off.')),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': L.ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'click': L.bind(this.callPowerOff, this)
				}, _('Proceed'))
			])
		]);
	},

	handleScheduleWakeup: function(wakeInput, ev) {
		var ms = Date.parse(wakeInput.value);
		if (Number.isNaN(ms) || ms <= Date.now()) {
			L.ui.addNotification(null, E('p', _('Please select a valid future date and time.')));
			return;
		}

		var epoch = Math.floor(ms / 1000);
		L.ui.showModal(_('Power Off and Schedule Wake-Up'), [
			E('p', _('The device will power off now and automatically wake up at %s.')
				.format(new Date(ms).toLocaleString())),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': L.ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'click': L.bind(this.callPowerOffAt, this, epoch)
				}, _('Proceed'))
			])
		]);
	},

	handleReboot: function(ev) {
		return callReboot().then(function(res) {
			if (res != 0) {
				L.ui.addNotification(null, E('p', _('The reboot command failed with code %d').format(res)));
				L.raise('Error', 'Reboot failed');
			}

			L.ui.showModal(_('Rebooting…'), [
				E('p', { 'class': 'spinning' }, _('Waiting for device...'))
			]);

			window.setTimeout(function() {
				L.ui.showModal(_('Rebooting…'), [
					E('p', { 'class': 'spinning alert-message warning' },
						_('Device unreachable! Still waiting for device...'))
				]);
			}, 150000);

			L.ui.awaitReconnect();
		})
		.catch(function(e) { L.ui.addNotification(null, E('p', e.message)) });
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
