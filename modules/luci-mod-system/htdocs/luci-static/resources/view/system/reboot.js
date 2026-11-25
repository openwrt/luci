'use strict';
'require view';
'require form';
'require rpc';
'require ui';
'require uci';
'require fs';
'require network';

var callReboot = rpc.declare({
	object: 'system',
	method: 'reboot',
	expect: { result: 0 }
});

var callGetWakealarm = rpc.declare({
	object: 'luci',
	method: 'getWakealarm',
	expect: { wakealarm: 0 }
});

var callSetWakealarm = rpc.declare({
	object: 'luci',
	method: 'setWakealarm',
	params: [ 'epoch' ]
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.changes(),
			L.resolveDefault(fs.lstat('/sbin/poweroff'), null),
			L.resolveDefault(fs.lstat('/sys/class/rtc/rtc0/wakealarm'), null),
			L.resolveDefault(callGetWakealarm(), 0),
			L.resolveDefault(uci.load('network'), null),
			L.resolveDefault(network.getDevices(), {})
		]);
	},

	render: function(data) {
		var changes = data[0],
			poweroffSupported = data[1] != null,
			wakealarmSupported = data[2] != null,
			wakeEpoch = Number(data[3] || 0),
			devices = Object.values(data[5] || {}),
			armedDate = null,
			wolSupported = false,
			wolEnabled = false,
			wakeMac = null;

		if (Number.isSafeInteger(wakeEpoch) && wakeEpoch > Math.floor(Date.now() / 1000) && wakeEpoch <= 0x7fffffff) {
			var parsed = new Date(wakeEpoch * 1000);
			if (Number.isFinite(parsed.getTime()))
				armedDate = parsed;
		}

		uci.sections('network', 'device', function(dev) {
			if (L.toArray(dev.wol).indexOf('g') !== -1)
				wolEnabled = true;
		});

		for (var i = 0; i < devices.length; i++) {
			var dev = devices[i];
			var name = dev.getName();
			if (!name || name === 'lo' || dev.isBridge())
				continue;

			var mac = dev.getMAC();
			if (mac && mac !== '00:00:00:00:00:00' && !wakeMac)
				wakeMac = mac;

			var wolInfo = dev.getWOL ? dev.getWOL() : null;
			if (wolInfo) {
				if (wolInfo.supported.indexOf('g') !== -1)
					wolSupported = true;
				if (wolInfo.selected.indexOf('g') !== -1)
					wolEnabled = true;
			}
		}

		if (wolEnabled)
			wolSupported = true;

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

		var finishWithoutForm = L.bind(function() {
			this.map = null;
			this.handleSaveApply = null;
			this.handleSave = null;
			this.handleReset = null;
			return body;
		}, this);

		if (!poweroffSupported)
			return finishWithoutForm();

		body.appendChild(E('hr'));
		body.appendChild(E('h2', _('Power Off')));
		body.appendChild(E('p', {}, _('Shuts down the operating system and powers off the device.')));

		if (armedDate) {
			body.appendChild(E('p', { 'class': 'alert-message notice' },
				_('An RTC wake-up alarm is currently scheduled for %s.').format(armedDate.toLocaleString())));
		}

		if (wolSupported && wolEnabled) {
<<<<<<< Updated upstream
			body.appendChild(E('p', { 'class': 'alert-message notice' }, [
				_('Wake-on-LAN (Magic Packet) is enabled. To power the device back on remotely, send a magic packet to %s (e.g. ').format(wakeMac || _('its MAC address')),
				E('code', {}, 'wakeonlan ' + (wakeMac || '<MAC>')),
				_(' or '),
				E('code', {}, 'etherwake ' + (wakeMac || '<MAC>')),
				_(').')
			]));
		}

		if (wolSupported && !wolEnabled) {
			body.appendChild(E('p', { 'class': 'alert-message warning' }, [
				_('Wake-on-LAN is supported by this device but currently disabled. To wake the device remotely after power-off, enable Magic Packet (\'g\') under '),
				E('a', { 'href': L.url('admin', 'network', 'network') }, _('Network → Interfaces → Devices')),
				_(' before shutting down, then power it back on by sending a magic packet (e.g. '),
				E('code', {}, 'wakeonlan ' + (wakeMac || '<MAC>')),
				_(' or '),
				E('code', {}, 'etherwake ' + (wakeMac || '<MAC>')),
				_(').')
			]));
=======
			var macLabel = wakeMac || _('its MAC address'),
			    wolCmd = E('code', {}, 'wakeonlan ' + (wakeMac || '<MAC>')).outerHTML,
			    ewCmd = E('code', {}, 'etherwake ' + (wakeMac || '<MAC>')).outerHTML;

			body.appendChild(E('p', { 'class': 'alert-message notice' },
				_('Wake-on-LAN (Magic Packet) is enabled. To power the device back on remotely, send a magic packet to %s (e.g. %s or %s).')
					.format(macLabel, wolCmd, ewCmd)));
		}

		if (wolSupported && !wolEnabled) {
			var devLink = E('a', { 'href': L.url('admin', 'network', 'network') }, _('Network → Interfaces → Devices')).outerHTML,
			    wolCmd = E('code', {}, 'wakeonlan ' + (wakeMac || '<MAC>')).outerHTML,
			    ewCmd = E('code', {}, 'etherwake ' + (wakeMac || '<MAC>')).outerHTML;

			body.appendChild(E('p', { 'class': 'alert-message warning' },
				_('Wake-on-LAN is supported by this device but currently disabled. To wake the device remotely after power-off, enable Magic Packet (\'g\') under %s before shutting down, then power it back on by sending a magic packet (e.g. %s or %s).')
					.format(devLink, wolCmd, ewCmd)));
>>>>>>> Stashed changes
		}

		body.appendChild(E('hr'));

		var wakeCheckbox = null,
		    wakeInput = null;

		if (wakealarmSupported) {
			var formatDateTimeLocal = function(d) {
				return '%04d-%02d-%02dT%02d:%02d'.format(
					d.getFullYear(),
					d.getMonth() + 1,
					d.getDate(),
					d.getHours(),
					d.getMinutes()
				);
			};

			var minDate = new Date(Date.now() + 60000);
			wakeCheckbox = E('input', {
				'type': 'checkbox',
				'id': 'rtc-wakeup-enable',
				'checked': armedDate ? '' : null
			});
			wakeCheckbox.addEventListener('change', function() {
				wakeInput.disabled = !wakeCheckbox.checked;
				wakeInput.required = wakeCheckbox.checked;
				if (wakeCheckbox.checked) {
					if (!wakeInput.value) {
						var now = new Date(Date.now() + 60000);
						wakeInput.min = formatDateTimeLocal(now);
						wakeInput.value = formatDateTimeLocal(now);
					}
					wakeInput.focus();
				}
			});

			wakeInput = E('input', {
				'type': 'datetime-local',
				'class': 'cbi-input-text',
				'min': formatDateTimeLocal(minDate),
				'value': armedDate ? formatDateTimeLocal(armedDate) : '',
				'disabled': armedDate ? null : '',
				'required': armedDate ? '' : null
			});

			body.appendChild(E('p', {}, [
				wakeCheckbox,
				' ',
				E('label', { 'for': 'rtc-wakeup-enable' }, _('After power off, wake up again at')),
				' ',
				wakeInput
			]));
		}

		body.appendChild(E('p', {}, [
			E('button', {
				'class': 'cbi-button cbi-button-negative important',
				'click': L.bind(this.handlePowerOff, this, wakeCheckbox, wakeInput)
			}, _('Perform power off...'))
		]));

		if (!wakealarmSupported)
			return finishWithoutForm();

		body.appendChild(E('hr'));
		var m = new form.Map('power_schedule', _('Recurring Power Schedule'),
			_('Automatically powers off the device on selected weekdays and programs the hardware RTC to wake it up. Managed entries are written to Scheduled Tasks (/etc/crontabs/root).'));

		var s = m.section(form.GridSection, 'schedule');
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		var validateTime = function(section_id, value) {
			if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
				return _('Expecting valid 24-hour time (HH:MM)');
			return true;
		};

		var o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.editable = true;

		o = s.option(form.MultiValue, 'days', _('Weekdays'));
		o.value('mon', _('Monday'));
		o.value('tue', _('Tuesday'));
		o.value('wed', _('Wednesday'));
		o.value('thu', _('Thursday'));
		o.value('fri', _('Friday'));
		o.value('sat', _('Saturday'));
		o.value('sun', _('Sunday'));
		o.rmempty = false;

		o = s.option(form.Value, 'poweroff_time', _('Power off time'));
		o.placeholder = '23:00';
		o.validate = validateTime;
		o.rmempty = false;

		o = s.option(form.Value, 'wakeup_time', _('Wake-up time'));
		o.placeholder = '06:30';
		o.validate = validateTime;
		o.rmempty = false;

		this.map = m;

		return m.render().then(function(mapEl) {
			body.appendChild(mapEl);
			return body;
		});
	},

	awaitPowerOff: function(wakeDate) {
		var deadline = Date.now() + 60000;
		var consecutiveFailures = 0;

		var showPoweredOff = function() {
			var msg = wakeDate
				? _('The device has powered off and is scheduled to wake up at %s. This web interface is now offline.').format(wakeDate.toLocaleString())
				: _('The device has powered off. This web interface is now offline until the device is powered back on.');

			L.ui.showModal(_('Powered off'), [
				E('p', msg)
			]);
		};

		var check = function() {
			if (Date.now() >= deadline) {
				L.ui.showModal(_('Power off initiated'), [
					E('p', _('The shutdown command was sent, but the device is still reachable or did not power off completely.'))
				]);
				return;
			}

			var controller = new AbortController();
			var timer = window.setTimeout(function() { controller.abort(); }, 2000);

			fetch(window.location.pathname, {
				method: 'HEAD',
				cache: 'no-store',
				credentials: 'same-origin',
				signal: controller.signal
			}).then(function(res) {
				window.clearTimeout(timer);
				if (res.status >= 500)
					throw new Error('HTTP ' + res.status);

				consecutiveFailures = 0;
				window.setTimeout(check, 1500);
			}).catch(function() {
				window.clearTimeout(timer);
				consecutiveFailures++;

				if (consecutiveFailures >= 3)
					showPoweredOff();
				else
					window.setTimeout(check, 1500);
			});
		};

		window.setTimeout(check, 1500);
	},

	callPowerOff: function(wakeDate) {
		var scheduledDate = (wakeDate instanceof Date) ? wakeDate : null;

		return fs.exec('/sbin/poweroff').then(L.bind(function(res) {
			if (res && res.code !== 0)
				throw new Error(_('Power off command failed with exit code %d.').format(res.code));

			L.ui.showModal(_('Powering off…'), [
				E('p', { 'class': 'spinning' }, _('Shutting down the operating system…'))
			]);

			this.awaitPowerOff(scheduledDate);
		}, this));
	},

	callPowerOffAt: function(epoch) {
		var wakeDate = new Date(epoch * 1000);

		return L.resolveDefault(callGetWakealarm(), { wakealarm: 0 }).then(L.bind(function(prev) {
			var prevEpoch = Number((prev && prev.wakealarm) || 0);
			var rollbackEpoch = (Number.isSafeInteger(prevEpoch) && prevEpoch > Math.floor(Date.now() / 1000)) ? prevEpoch : 0;

			return callSetWakealarm(epoch).then(L.bind(function(res) {
				if (!res || res.result !== 0)
					throw new Error((res && res.error) ? res.error : _('Failed to set RTC wake-up alarm.'));

				return this.callPowerOff(wakeDate).catch(function(err) {
					return L.resolveDefault(callSetWakealarm(rollbackEpoch), null).then(function() {
						throw err;
					});
				});
			}, this));
		}, this)).catch(function(e) {
			L.ui.addNotification(null, E('p', e.message));
		});
	},

	handlePowerOff: function(wakeCheckbox, wakeInput, ev) {
		var wakeEpoch = null,
		    wakeDate = null;

		if (wakeCheckbox && wakeCheckbox.checked) {
			var minDate = new Date(Date.now() + 60000);
			wakeInput.min = '%04d-%02d-%02dT%02d:%02d'.format(
				minDate.getFullYear(),
				minDate.getMonth() + 1,
				minDate.getDate(),
				minDate.getHours(),
				minDate.getMinutes()
			);

			if (!wakeInput.reportValidity())
				return;

			var ms = Date.parse(wakeInput.value);
			wakeEpoch = Math.floor(ms / 1000);
			if (!Number.isFinite(ms) || wakeEpoch <= Math.floor(Date.now() / 1000) || wakeEpoch > 0x7fffffff) {
				L.ui.addNotification(null, E('p', _('Please select a valid future wake-up date and time.')));
				return;
			}

			wakeDate = new Date(wakeEpoch * 1000);
		}

		var modalText = wakeDate
			? _('The device will shut down and is scheduled to wake up again at %s.').format(wakeDate.toLocaleString())
			: _('The device will shut down. On hardware without power-off support, the device may reboot or remain powered in a halted state.');

		L.ui.showModal(_('Power Off Device'), [
			E('p', modalText),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': L.ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'click': L.bind(function() {
						if (wakeEpoch !== null) {
							this.callPowerOffAt(wakeEpoch);
						} else {
							this.callPowerOff(null).catch(function(e) {
								L.ui.addNotification(null, E('p', e.message));
							});
						}
					}, this)
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

	handleSaveApply: function(ev, mode) {
		return this.map ? this.map.save(null, true).then(function() {
			ui.changes.apply(mode == '0');
		}) : null;
	},

	handleSave: function(ev) {
		return this.map ? this.map.save() : null;
	},

	handleReset: function(ev) {
		return this.map ? this.map.reset() : null;
	},

	addFooter: function() {
		return this.map ? this.super('addFooter', arguments) : E([]);
	}
});
