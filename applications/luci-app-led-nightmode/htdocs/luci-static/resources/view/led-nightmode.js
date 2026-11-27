'use strict';
'require form';
'require led-nightmode.zone-coordinates as zoneCoordinates';
'require poll';
'require rpc';
'require ui';
'require uci';
'require view';

/* global zoneCoordinates */

const callStatus = rpc.declare({
	object: 'luci.led-nightmode',
	method: 'status'
});

const callDrivers = rpc.declare({
	object: 'luci.led-nightmode',
	method: 'drivers'
});

const callLeds = rpc.declare({
	object: 'luci.led-nightmode',
	method: 'leds'
});

const callSetManual = rpc.declare({
	object: 'luci.led-nightmode',
	method: 'set_manual',
	params: [ 'phase' ]
});

const callProbe = rpc.declare({
	object: 'luci.led-nightmode',
	method: 'probe',
	params: [ 'driver', 'device', 'instance' ]
});

const callTest = rpc.declare({
	object: 'luci.led-nightmode',
	method: 'test',
	params: [ 'driver', 'device', 'instance' ]
});

function phaseLabel(phase) {
	switch (phase) {
	case 'day':
		return _('Day');
	case 'night':
		return _('Night');
	default:
		return _('Unknown');
	}
}

function modeLabel(mode) {
	switch (mode) {
	case 'manual':
		return _('Manual');
	case 'fixed':
		return _('Daily schedule');
	case 'sun':
		return _('Sunrise and sunset');
	default:
		return _('Unknown');
	}
}

function statusSummaryLabel(status) {
	if (!status.enabled)
		return _('Night mode is off');
	if (!status.running || !status.schedule_valid)
		return _('Night mode needs attention');
	return status.effective_phase === 'night'
		? _('Night mode is active — indicators are off')
		: _('Indicators are working normally');
}

function scheduleSummaryLabel(status) {
	return _('Current schedule: %s').format(modeLabel(status.mode));
}

function setStatusText(root, name, value) {
	const node = root.querySelector('[data-status="%s"]'.format(name));
	if (node)
		node.textContent = value;
}

function updateStatus(root, status) {
	status = status || {};
	setStatusText(root, 'summary', statusSummaryLabel(status));
	setStatusText(root, 'schedule-summary', scheduleSummaryLabel(status));
	setStatusText(root, 'effective', phaseLabel(status.effective_phase));
	setStatusText(root, 'desired', phaseLabel(status.desired_phase));
	setStatusText(root, 'mode', modeLabel(status.mode));
	setStatusText(root, 'service', status.running ? _('Running') : _('Stopped'));
	setStatusText(root, 'enabled', status.enabled ? _('Enabled') : _('Disabled'));

	const warning = root.querySelector('[data-status="warning"]');
	if (warning) {
		warning.hidden = Boolean(status.enabled && status.running && status.schedule_valid);
		warning.textContent = !status.enabled
			? _('Night mode is disabled. Saving a schedule will not change any LEDs until you enable the service.')
			: (!status.schedule_valid
				? _('The saved schedule is incomplete or invalid. Check the settings below.')
				: _('The service is enabled but is not running.'));
	}
}

function groupSection(section, group) {
	const render = section.render.bind(section);
	section.render = function() {
		return Promise.resolve(render()).then(function(node) {
			if (node && node.setAttribute)
				node.setAttribute('data-led-nightmode-group', group);
			return node;
		});
	};
	return section;
}

function extractAdvancedOptions(mapNode, optionNames, title, description) {
	const fields = E('div', { 'class': 'cbi-section-node' });
	optionNames.forEach(function(name) {
		const field = mapNode.querySelector('.cbi-value[data-name="%s"]'.format(name));
		if (field)
			fields.appendChild(field);
	});

	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, title),
		E('div', { 'class': 'cbi-section-descr' }, description),
		fields
	]);
}

function arrangeMapTabs(mapNode) {
	const settingsPane = E('div', {
		'data-tab': 'settings',
		'data-tab-title': _('Settings')
	});
	const advancedPane = E('div', {
		'data-tab': 'advanced',
		'data-tab-title': _('Advanced')
	});

	advancedPane.appendChild(extractAdvancedOptions(mapNode,
		[ '_brightness_mode', 'night_brightness' ],
		_('Night appearance'),
		_('The safe default turns supported indicators completely off. Custom brightness is intended for calibrated hardware.')));
	advancedPane.appendChild(extractAdvancedOptions(mapNode,
		[ 'latitude', 'longitude', 'twilight' ],
		_('Sun schedule details'),
		_('These values are used only when the sunset-to-sunrise schedule is selected.')));

	Array.prototype.slice.call(mapNode.childNodes).forEach(function(node) {
		if (!node.getAttribute)
			return;
		const group = node.getAttribute('data-led-nightmode-group');
		if (group === 'settings')
			settingsPane.appendChild(node);
		else if (group === 'advanced')
			advancedPane.appendChild(node);
	});

	const tabs = E('div', { 'class': 'cbi-map-tabbed' }, [ settingsPane, advancedPane ]);
	mapNode.appendChild(tabs);
	ui.tabs.initTabGroup(tabs.childNodes);
	return mapNode;
}

function validateTime(sectionId, value) {
	return /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value || '')
		? true
		: _('Enter time as HH:MM, for example 23:00.');
}

function coordinateValidator(minimum, maximum) {
	return function(sectionId, value) {
		if (!/^-?[0-9]+(?:\.[0-9]+)?$/.test(value || ''))
			return _('Enter a decimal coordinate, for example 41.7151.');

		const number = Number(value);
		return (number >= minimum && number <= maximum)
			? true
			: _('Value must be between %d and %d.').format(minimum, maximum);
	};
}

function brightnessModelLabel(model) {
	return model === 'binary'
		? _('Binary — off or on')
		: (model === 'unverified-multilevel'
			? _('Multiple values reported — physical dimming unverified')
			: _('Unknown'));
}

function renderBrightnessCapabilities(leds) {
	const rows = (leds || []).map(function(led) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'data-title': _('LED') }, led.name || _('Unknown')),
			E('td', { 'class': 'td left', 'data-title': _('Reported range') },
				'0–%s'.format(led.max_brightness || '?')),
			E('td', { 'class': 'td left', 'data-title': _('Brightness behaviour') },
				brightnessModelLabel(led.brightness_model))
		]);
	});

	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, _('Detected LED brightness capabilities')),
		E('p', {}, _('These are driver-reported ranges, not proof that intermediate values physically dim an LED. Custom values are clamped separately for every LED.')),
		rows.length ? E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left' }, _('LED')),
				E('th', { 'class': 'th left' }, _('Reported range')),
				E('th', { 'class': 'th left' }, _('Brightness behaviour'))
			])
		].concat(rows)) : E('div', { 'class': 'alert-message warning' },
			_('LED capabilities could not be read. Keeping brightness at 0 is the safe choice.'))
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callStatus(), {}),
			L.resolveDefault(callDrivers(), { drivers: [] }),
			L.resolveDefault(callLeds(), { leds: [] })
		]);
	},

	render: function(data) {
		const initialStatus = data[0] || {};
		const installedDrivers = Array.isArray(data[1] && data[1].drivers)
			? data[1].drivers
			: [];
		const discoveredLeds = Array.isArray(data[2] && data[2].leds)
			? data[2].leds
			: [];
		const timezoneCoordinates = zoneCoordinates.lookup(initialStatus.router_zonename);
		let m, s, o;

		m = new form.Map('led-nightmode', _('LED Night Mode'),
			_('Turn router indicators off at night and restore their exact previous state during the day.'));

		const statusNode = E('div', { 'class': 'cbi-section' }, [
			E('div', {
				'class': 'alert-message warning',
				'data-status': 'warning',
				'hidden': true
			}),
			E('div', { 'class': 'alert-message info' }, [
				E('strong', { 'data-status': 'summary' }, statusSummaryLabel(initialStatus)),
				E('div', { 'style': 'margin-top:.35em' }, [
					E('span', { 'data-status': 'schedule-summary' }, scheduleSummaryLabel(initialStatus))
				])
			]),
			E('p', {}, _('Router LEDs are controlled automatically. Optional external indicators are configured under Advanced.')),
			E('details', {}, [
				E('summary', { 'style': 'cursor:pointer;font-weight:600' }, _('Manual override')),
				E('p', {}, _('These actions are saved and applied immediately. They switch the schedule to Manual without applying other unsaved form edits.')),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'type': 'button',
						'click': (event) => this.handleManualPhase(statusNode, 'day', event)
					}, _('Turn indicators on now')),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'type': 'button',
						'click': (event) => this.handleManualPhase(statusNode, 'night', event)
					}, _('Turn indicators off now'))
				])
			])
		]);
		updateStatus(statusNode, initialStatus);

		s = m.section(form.NamedSection, '_status');
		s.render = function() {
			return statusNode;
		};
		groupSection(s, 'settings');

		s = m.section(form.NamedSection, 'main', 'core', _('Night mode'));
		s.addremove = false;
		groupSection(s, 'settings');
		const mainSection = s;

		o = s.option(form.Flag, 'enabled', _('Enable automatic LED night mode'),
			_('A fresh installation stays disabled until you turn this on.'));
		o.rmempty = false;

		s = m.section(form.NamedSection, 'schedule', 'schedule', _('When should indicators turn off?'));
		s.addremove = false;
		groupSection(s, 'settings');

		const modeOption = s.option(form.ListValue, 'mode', _('Schedule'));
		modeOption.value('sun', _('Sunset to sunrise — recommended'));
		modeOption.value('fixed', _('Daily schedule'));
		modeOption.value('manual', _('Manual'));
		modeOption.default = 'manual';
		modeOption.rmempty = false;

		o = s.option(form.ListValue, 'phase', _('Manual LED state'));
		o.ucioption = 'phase';
		o.ucisection = 'main';
		o.value('day', _('Day — restore normal indicators'));
		o.value('night', _('Night — apply night brightness'));
		o.depends('mode', 'manual');
		o.rmempty = false;
		this.scheduleMap = m;
		this.modeOption = modeOption;
		this.manualPhaseOption = o;

		const nightStartOption = s.option(form.Value, 'night_start', _('Night starts'));
		nightStartOption.placeholder = '23:00';
		nightStartOption.default = '23:00';
		nightStartOption.validate = validateTime;
		nightStartOption.depends('mode', 'fixed');
		nightStartOption.rmempty = false;

		o = s.option(form.Value, 'day_start', _('Day starts'));
		o.placeholder = '07:00';
		o.default = '07:00';
		o.depends('mode', 'fixed');
		o.rmempty = false;
		o.validate = function(sectionId, value) {
			const valid = validateTime(sectionId, value);
			if (valid !== true)
				return valid;
			return value !== nightStartOption.formvalue(sectionId)
				? true
				: _('Day and night start times must be different.');
		};

		o = s.option(form.DummyValue, '_location_hint', _('Approximate location'));
		o.depends('mode', 'sun');
		o.cfgvalue = function() {
			return timezoneCoordinates
				? _('%s, estimated from the router timezone. This is usually accurate enough; exact coordinates are available under Advanced.').format(initialStatus.router_zonename)
				: _('No location hint is available for the router timezone. Use this device location or enter exact coordinates under Advanced.');
		};

		const scheduleSection = s;

		const brightnessModeOption = mainSection.option(form.ListValue, '_brightness_mode', _('Night profile'));
		brightnessModeOption.value('off', _('Off completely — recommended'));
		brightnessModeOption.value('custom', _('Custom raw brightness'));
		brightnessModeOption.cfgvalue = function() {
			return Number(uci.get('led-nightmode', 'main', 'night_brightness') || 0) > 0
				? 'custom'
				: 'off';
		};
		brightnessModeOption.write = function() {};
		brightnessModeOption.remove = function() {};
		brightnessModeOption.rmempty = false;

		const brightnessTargetOption = mainSection.option(form.Value, 'night_brightness', _('Custom raw brightness target'),
			_('A non-zero sysfs value is applied only to LEDs reporting a maximum above 1. It is clamped to each LED’s individual maximum and may still behave as fully on.'));
		brightnessTargetOption.default = '1';
		brightnessTargetOption.datatype = 'uinteger';
		brightnessTargetOption.depends('_brightness_mode', 'custom');
		brightnessTargetOption.rmempty = false;
		brightnessTargetOption.validate = function(sectionId, value) {
			return Number(value) > 0
				? true
				: _('Enter a value greater than 0, or choose “Off completely”.');
		};
		brightnessModeOption.onchange = function(event, sectionId, value) {
			if (value !== 'custom' || Number(brightnessTargetOption.formvalue(sectionId)) > 0)
				return;
			const targetElement = brightnessTargetOption.getUIElement(sectionId);
			if (targetElement)
				targetElement.setValue('1');
		};

		const latitudeOption = scheduleSection.option(form.Value, 'latitude', _('Exact latitude'),
			_('Signed decimal degrees from −90 to 90.'));
		latitudeOption.placeholder = '41.7151';
		latitudeOption.depends('mode', 'sun');
		latitudeOption.retain = true;
		latitudeOption.rmempty = true;
		latitudeOption.forcewrite = true;
		latitudeOption.validate = coordinateValidator(-90, 90);
		latitudeOption.cfgvalue = function() {
			const saved = uci.get('led-nightmode', 'schedule', 'latitude');
			return saved || (timezoneCoordinates ? String(timezoneCoordinates[0]) : '');
		};

		const longitudeOption = scheduleSection.option(form.Value, 'longitude', _('Exact longitude'),
			_('Signed decimal degrees from −180 to 180.'));
		longitudeOption.placeholder = '44.8271';
		longitudeOption.depends('mode', 'sun');
		longitudeOption.retain = true;
		longitudeOption.rmempty = true;
		longitudeOption.forcewrite = true;
		longitudeOption.validate = coordinateValidator(-180, 180);
		longitudeOption.cfgvalue = function() {
			const saved = uci.get('led-nightmode', 'schedule', 'longitude');
			return saved || (timezoneCoordinates ? String(timezoneCoordinates[1]) : '');
		};

		o = scheduleSection.option(form.ListValue, 'twilight', _('Sun boundary'),
			_('Civil twilight usually gives a more natural indoor night-mode transition than the exact horizon crossing.'));
		o.value('daylight', _('Sunrise and sunset'));
		o.value('civil', _('Civil twilight'));
		o.value('nautical', _('Nautical twilight'));
		o.value('astronomical', _('Astronomical twilight'));
		o.default = 'daylight';
		o.rmempty = false;

		modeOption.validate = function(sectionId, value) {
			if (value !== 'sun')
				return true;
			return latitudeOption.formvalue('schedule') && longitudeOption.formvalue('schedule')
				? true
				: _('Sunset-to-sunrise scheduling needs a location. Use this device location or enter exact coordinates under Advanced.');
		};

		o = scheduleSection.option(form.Button, '_browser_location', _('Location'),
			_('Use this browser for a more precise location. Coordinates stay in the form until you save them to this router.'));
		o.depends('mode', 'sun');
		o.inputtitle = _('Use this device location');
		o.inputstyle = 'apply';
		o.onclick = function(event) {
			const button = event.currentTarget;
			if (!window.isSecureContext || !navigator.geolocation) {
				ui.addNotification(null, E('p', {}, _('Browser location requires an HTTPS LuCI session and browser permission. You can keep the approximate timezone location or enter exact coordinates under Advanced.')), 'warning');
				return;
			}

			button.disabled = true;
			return new Promise(function(resolve) {
				navigator.geolocation.getCurrentPosition(function(position) {
					const latitudeElement = latitudeOption.getUIElement('schedule');
					const longitudeElement = longitudeOption.getUIElement('schedule');
					if (latitudeElement)
						latitudeElement.setValue(position.coords.latitude.toFixed(4));
					if (longitudeElement)
						longitudeElement.setValue(position.coords.longitude.toFixed(4));
					ui.addNotification(null, E('p', {}, _('Precise coordinates were added to the form. Use Save & Apply to store them on the router.')), 'info');
					resolve();
				}, function(error) {
					const message = error && error.code === 1
						? _('Location permission was denied. You can keep the approximate timezone location or enter exact coordinates under Advanced.')
						: _('The browser could not determine this device’s location. You can keep the approximate timezone location or enter exact coordinates under Advanced.');
					ui.addNotification(null, E('p', {}, message), 'warning');
					resolve();
				}, {
					enableHighAccuracy: false,
					timeout: 10000,
					maximumAge: 300000
				});
			}).then(function() {
				button.disabled = false;
			});
		};

		s = m.section(form.TypedSection, 'provider', _('External indicators'),
			_('Optional drivers control indicators that do not appear in Linux LED sysfs, such as an LTE light managed by a modem. Nothing is auto-detected or scanned.'));
		s.anonymous = false;
		s.addremove = true;
		groupSection(s, 'advanced');
		s.sectiontitle = function(sectionId) {
			return _('External indicator: %s').format(sectionId);
		};

		const providerEnabledOption = s.option(form.Flag, 'enabled', _('Enable this indicator'));
		providerEnabledOption.rmempty = false;

		const driverOption = s.option(form.Value, 'driver', _('Driver'));
		installedDrivers.forEach(function(driver) {
			driverOption.value(driver, driver);
		});
		driverOption.placeholder = installedDrivers.length ? installedDrivers[0] : _('No provider driver installed');
		driverOption.validate = function(sectionId, value) {
			if (providerEnabledOption.formvalue(sectionId) === '1' && !value)
				return _('Select an installed provider driver.');
			return !value || /^[A-Za-z0-9_-]+$/.test(value)
				? true
				: _('Driver names may contain only letters, numbers, underscores, and hyphens.');
		};

		const deviceOption = s.option(form.Value, 'device', _('Device or endpoint'));
		deviceOption.validate = function(sectionId, value) {
			return providerEnabledOption.formvalue(sectionId) !== '1' || value
				? true
				: _('Enter the explicit device or endpoint required by this driver.');
		};

		o = s.option(form.Button, '_probe', _('Connection test'),
			_('Runs the selected driver’s read-only capability check. It does not change the indicator.'));
		o.inputtitle = _('Test connection');
		o.inputstyle = 'apply';
		o.onclick = function(event, sectionId) {
			const button = event.currentTarget;
			const driver = driverOption.formvalue(sectionId);
			const device = deviceOption.formvalue(sectionId);
			if (!driver || !device) {
				ui.addNotification(null, E('p', {}, _('Select a driver and enter its device before testing.')), 'warning');
				return;
			}

			button.disabled = true;
			return L.resolveDefault(callProbe(driver, device, sectionId), {
				success: false,
				message: _('The connection test failed.')
			}).then(function(result) {
				ui.addNotification(null, E('p', {}, result.success
					? _('Connection succeeded. This driver supports the configured endpoint.')
					: (result.message || _('The connection test failed.'))), result.success ? 'info' : 'error');
				button.disabled = false;
			});
		};

		o = s.option(form.Button, '_test', _('Indicator test'),
			_('Temporarily changes the external indicator for three seconds, then restores its exact starting state. Watch the physical indicator while the test runs.'));
		o.inputtitle = _('Test indicator');
		o.inputstyle = 'action';
		o.onclick = function(event, sectionId) {
			const button = event.currentTarget;
			const originalTitle = button.textContent;
			const driver = driverOption.formvalue(sectionId);
			const device = deviceOption.formvalue(sectionId);
			if (!driver || !device) {
				ui.addNotification(null, E('p', {}, _('Select a driver and enter its device before testing.')), 'warning');
				return;
			}

			button.disabled = true;
			button.textContent = _('Testing… watch the indicator');
			return L.resolveDefault(callTest(driver, device, sectionId), {
				success: false,
				message: _('The indicator test failed. Its driver may need manual recovery if restoration also failed.')
			}).then(function(result) {
				ui.addNotification(null, E('p', {}, result.success
					? _('The command round trip succeeded and the original state was restored. If you saw no change, this endpoint may not drive the expected physical indicator.')
					: (result.message || _('The indicator test failed.'))), result.success ? 'info' : 'error');
				button.textContent = originalTitle;
				button.disabled = false;
			});
		};

		const diagnosticsNode = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Technical status')),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', 'width': '40%' }, _('LED state now')),
					E('td', { 'class': 'td left', 'data-status': 'effective' }, phaseLabel(initialStatus.effective_phase))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('Schedule wants')),
					E('td', { 'class': 'td left', 'data-status': 'desired' }, phaseLabel(initialStatus.desired_phase))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('Schedule mode')),
					E('td', { 'class': 'td left', 'data-status': 'mode' }, modeLabel(initialStatus.mode))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, _('Service')),
					E('td', { 'class': 'td left' }, [
						E('span', { 'data-status': 'enabled' }),
						' · ',
						E('span', { 'data-status': 'service' })
					])
				])
			])
		]);
		updateStatus(diagnosticsNode, initialStatus);
		this.diagnosticsNode = diagnosticsNode;

		s = m.section(form.NamedSection, '_diagnostics');
		s.render = function() {
			return diagnosticsNode;
		};
		groupSection(s, 'advanced');

		const brightnessNode = renderBrightnessCapabilities(discoveredLeds);
		s = m.section(form.NamedSection, '_brightness_capabilities');
		s.render = function() {
			return brightnessNode;
		};
		groupSection(s, 'advanced');

		poll.add(function() {
			return L.resolveDefault(callStatus(), {}).then(function(status) {
				updateStatus(statusNode, status);
				updateStatus(diagnosticsNode, status);
			});
		}, 5);

		const renderContents = m.renderContents.bind(m);
		m.renderContents = function() {
			return renderContents().then(arrangeMapTabs);
		};

		return m.render();
	},

	handleManualPhase: function(statusNode, phase, event) {
		const button = event.currentTarget;
		const modeElement = this.modeOption && this.modeOption.getUIElement('schedule');
		const phaseElement = this.manualPhaseOption && this.manualPhaseOption.getUIElement('schedule');
		const scheduleMap = this.scheduleMap;
		const diagnosticsNode = this.diagnosticsNode;
		button.disabled = true;
		return L.resolveDefault(callSetManual(phase), {
			success: false,
			message: _('Could not change the LED state.')
		}).then(function(result) {
			if (!result.success) {
				ui.addNotification(null, E('p', {}, result.message || _('Could not change the LED state.')), 'error');
				button.disabled = false;
				return;
			}

			if (modeElement)
				modeElement.setValue('manual');
			if (phaseElement)
				phaseElement.setValue(phase);
			if (scheduleMap)
				scheduleMap.checkDepends();
			ui.addNotification(null, E('p', {}, _('Manual mode and the requested LED state were saved and applied. Other unsaved form edits were not applied.')), 'info');
			return L.resolveDefault(callStatus(), {}).then(function(status) {
				updateStatus(statusNode, status);
				if (diagnosticsNode)
					updateStatus(diagnosticsNode, status);
				button.disabled = false;
			});
		});
	}
});
