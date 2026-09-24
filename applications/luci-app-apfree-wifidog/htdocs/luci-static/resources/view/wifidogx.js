'use strict';
'require view';
'require ui';
'require form';
'require rpc';
'require uci';
'require tools.widgets as widgets';

var CBIWifidogxGroupSelect = form.ListValue.extend({
	__name__: 'CBI.WifidogxGroupSelect',

	group_type: '1',

	load: function(section_id) {
		this.sappList = [];
		var sections = uci.sections('wifidogx', 'group');

		for (var i = 0; i < sections.length; i++) {
			if (sections[i]['g_type'] == this.group_type)
				this.sappList.push(sections[i]['.name']);
		}

		return this.super('load', section_id);
	},

	setGroupType: function(group_type) {
		if (group_type == 'mac') {
			this.group_type = '2';
		} else if (group_type == 'wildcard') {
			this.group_type = '3';
		}
	},

	filter: function(section_id, value) {
		return true;
	},

	renderWidget: function(section_id, option_index, cfgvalue) {
		var values = L.toArray((cfgvalue != null) ? cfgvalue : this.default),
		    choices = {},
		    checked = {},
		    i, name;

		for (i = 0; i < values.length; i++)
			checked[values[i]] = true;

		values = [];

		if (!this.multiple && (this.rmempty || this.optional))
			choices[''] = E('em', _('unspecified'));

		for (i = 0; i < this.sappList.length; i++) {
			name = this.sappList[i];

			if (checked[name])
				values.push(name);

			choices[name] =  E('span', { 'class': 'ifacebadge' }, name);
		}

		var widget = new ui.Dropdown(this.multiple ? values : values[0], choices, {
			id: this.cbid(section_id),
			sort: true,
			multiple: this.multiple,
			optional: this.optional || this.rmempty,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			select_placeholder: E('em', _('unspecified')),
			display_items: this.display_size || this.size || 3,
			dropdown_items: this.dropdown_size || this.size || 5,
			validate: L.bind(this.validate, this, section_id),
			create: !this.nocreate,
			create_markup: '' +
				'<li data-value="{{value}}">' +
					'<span class="ifacebadge" style="background:repeating-linear-gradient(45deg,rgba(204,204,204,0.5),rgba(204,204,204,0.5) 5px,rgba(255,255,255,0.5) 5px,rgba(255,255,255,0.5) 10px)">' +
						'{{value}}: <em>('+_('create')+')</em>' +
					'</span>' +
				'</li>'
		});

		return widget.render();
	}
});

var callGetLocation = rpc.declare({
	object: 'luci.wifidogx',
	method: 'get_location',
	params: [],
	expect: { result: {} }
});

var callGetWanMac = rpc.declare({
	object: 'luci.wifidogx',
	method: 'get_wan_mac',
	params: [],
	expect: { result: {} }
});

function generateDeviceId(macAddress) {
	var macPart = macAddress.replace(/-/g, '');
	var randomPart = '';
	for (var i = 0; i < 7; i++) {
		randomPart += Math.floor(Math.random() * 10);
	}
	return 'AW' + randomPart + macPart;
}

function generateLocationId() {
	var adminCode = '110101';
	var serviceType = '100';
	var sequenceNum = '';
	for (var i = 0; i < 5; i++) {
		sequenceNum += Math.floor(Math.random() * 10);
	}
	return adminCode + serviceType + sequenceNum;
}

return view.extend({
	render: function () {
		var m, s, o, ss;

		m = new form.Map('wifidogx', _('ApFree-WiFiDog'));
		m.description = _('apfree-wifidog offers a stable and secure captive portal solution. For more details, see the %s.')
			.format('<a href="https://github.com/liudf0716/apfree-wifidog" target="_blank" rel="noreferrer noopener">' + _('GitHub project page') + '</a>');


		s = m.section(form.NamedSection, 'common', _('Configuration'));
		s.addremove = false;
		s.anonymous = true;

		s.tab('basic', _('Basic Settings'));
		s.tab('longconn', _('Long Connection Settings'));
		s.tab('auth', _('Auth Server Settings'));
		s.tab('gateway', _('Gateway Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('rule', _('Rule Settings'));
		s.tab('location', _('Authentication Location Settings'));

		// basic settings
		o = s.taboption('basic', form.Flag, 'enabled', _('Enable'), _('Enable apfree-wifidog service.'));
		o.rmempty = false;

		o = s.taboption('basic', form.ListValue, 'auth_server_mode', _('Auth Server Mode'),
			_('The mode of the authentication server.'));
		o.value('cloud', _('Cloud Auth'));
		o.value('local', _('Local Auth'));
		o.value('bypass', _('Bypass Auth'));
		o.default = 'cloud';
		o.optional = false;

		// Dropdown listing the currently defined authentication servers
		o = s.taboption('basic', form.ListValue, 'selected_auth_server', _('Authentication Server'),
			_('Select the authentication server to use for cloud authentication.'));
		o.rmempty = false;
		o.optional = false;
		o.depends('auth_server_mode', 'cloud');
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('wifidogx', 'auth');
			if (sections.length == 0) {
				this.value('', _('Please create an authentication server first'));
			} else {
				sections.forEach(L.bind(function (section) {
					var name = section['.name'];
					var hostname = section.auth_server_hostname || _('Unknown');
					this.value(name, '%s (%s)'.format(name, hostname));
				}, this));
			}

			return this.super('load', [section_id]);
		};

		o = s.taboption('basic', form.ListValue, 'selected_long_conn', _('Long Connection Profile'),
			_('Select which long connection configuration to use. This option is always available regardless of authentication mode.'));
		o.rmempty = true;
		o.optional = true;
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('wifidogx', 'longconn');
			if (sections.length == 0) {
				this.value('', _('Please create a long connection profile first'));
			} else {
				sections.forEach(L.bind(function (section) {
					var name = section['.name'];
					var mode = section.long_conn_mode || _('Unknown');
					this.value(name, '%s (%s)'.format(name, mode));
				}, this));
			}

			return this.super('load', [section_id]);
		};

		o = s.taboption('basic', widgets.NetworkSelect, 'external_interface', _('External Interface'),
			_('The external interface of the device, if bypass mode, do not choose.'));
		o.rmempty = true;
		o.nocreate = true;
		o.loopback = false;
		o.default = 'wan';

		o = s.taboption('basic', form.Value, 'device_id', _('Device ID'), _('The ID of the device.'));
		o.rmempty = false;
		o.datatype = 'string';
		o.optional = false;

		o = s.taboption('basic', form.Value, 'local_portal', _('Local Portal'),
			_('The local portal url.'));
		o.rmempty = false;
		o.datatype = 'string';
		o.optional = true;
		o.placeholder = 'http://www.example.com';
		o.depends('auth_server_mode', 'local');

		o = s.taboption('basic', form.Flag, 'disable_portal_auth', _('Disable Portal Authentication'),
			_('When enabled, users can access the internet without portal authentication. Firewall redirect rules will not be created. Use this mode for pure traffic statistics without captive portal.'));
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('basic', form.ListValue, 'log_level', _('Log Level'),
			_('The log level of the apfree-wifidog.'));
		o.value(7, _('Debug'));
		o.value(6, _('Info'));
		o.value(5, _('Notice'));
		o.value(4, _('Warning'));
		o.value(3, _('Error'));
		o.value(2, _('Critical'));
		o.value(1, _('Alert'));
		o.value(0, _('Emergency'));
		o.default = 0;
		o.optional = false;

		// gateway settings
		o = s.taboption('gateway', form.SectionValue, '_gateway', form.GridSection, 'gateway');
		ss = o.subsection;
		ss.addremove = true;
		ss.nodescriptions = true;

		o = ss.option(form.Flag, 'gateway_auth_enabled', _('Auth Enabled'),
			_('Enable the authentication of the gateway.'));
		o.rmempty = false;
		o.default = '1';

		o = ss.option(widgets.DeviceSelect, 'gateway_name', _('Gateway Name'));
		o.rmempty = false;
		o.nocreate = true;
		o.allowany = true;
		o.default = 'lan';

		o = ss.option(form.Value, 'gateway_channel', _('Gateway Channel'),
			_('The channel of the gateway.'));
		o.datatype = 'string';
		o.rmempty = false;
		o.optional = false;

		o = ss.option(form.Value, 'gateway_id', _('Gateway ID'),
			_('The ID of the gateway.'));
		o.datatype = 'string';
		o.rmempty = false;
		o.optional = true;

		o = ss.option(form.Value, 'gateway_subnetv4', _('Gateway Subnetv4'),
			_('The ipv4 subnet of the gateway.'));
		o.datatype = 'cidr4';
		o.rmempty = false;
		o.optional = false;
		o.placeholder = '192.168.80.0/24';

		// advanced settings
		o = s.taboption('advanced', form.Value, 'check_interval', _('Check Interval'),
			_('The interval of the check(s).'));
		o.datatype = 'uinteger';
		o.rmempty = false;
		o.optional = false;
		o.default = 60;

		o = s.taboption('advanced', form.Value, 'client_timeout', _('Client Timeout'),
			_('The timeout of the client.'));
		o.datatype = 'uinteger';
		o.rmempty = false;
		o.optional = false;
		o.default = 5;

		o = s.taboption('advanced', form.Flag, 'wired_passed', _('Wired Passed'),
			_('Wired users do not need to authenticate to access the internet.'));
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'apple_cna', _('Apple CNA'),
			_('Enable Apple Captive Network Assistant.'));
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('advanced', form.Flag, 'js_filter', _('JS Filter'),
			_('Enable JS redirect.'));
		o.rmempty = false;
		o.default = '1';

		o = s.taboption('advanced', form.Flag, 'enable_anti_nat', _('Enable Anti NAT'),
			_('Enable Anti NAT devices.'));
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('advanced', form.Value, 'privileged_ops_secret', _('Privileged Ops Secret'),
			_('Local secret required for AWAS cloud platform to dynamically authorize remote OTA, reboot and system changes.'));
		o.password = true;
		o.rmempty = false;
		o.optional = false;

		o = s.taboption('advanced', form.Value, 'ttl_value', _('TTL Value'),
			_('The TTL value of the gateway support.'));
		o.datatype = 'string';
		o.rmempty = false;
		o.default = '64,128';
		o.depends('enable_anti_nat', '1');

		o = s.taboption('advanced', form.Value, 'anti_nat_permit_macs', _('Anti NAT Permit MAC'),
			_('The MAC address of the Anti NAT permit.'));
		o.datatype = 'macaddr';
		o.rmempty = true;
		o.depends('enable_anti_nat', '1');

		// Auth Server Settings
		o = s.taboption('auth', form.SectionValue, '_auth', form.GridSection, 'auth');
		ss = o.subsection;
		ss.addremove = true;
		ss.nodescriptions = true;

		ss.handleAdd = function (ev, name) {
			var self = this, i, longconnSections, authSections;
			if (name) {
				longconnSections = uci.sections('wifidogx', 'longconn');
				for (i = 0; i < longconnSections.length; i++) {
					if (longconnSections[i]['.name'] === name) {
						ui.addNotification(null, E('p', _('The name "%s" already exists in Long Connection profiles. Please choose a different name.').format(name)), 'error');
						return Promise.resolve();
					}
				}
				authSections = uci.sections('wifidogx', 'auth');
				for (i = 0; i < authSections.length; i++) {
					if (authSections[i]['.name'] === name) {
						ui.addNotification(null, E('p', _('The name "%s" already exists in Auth Server profiles. Please choose a different name.').format(name)), 'error');
						return Promise.resolve();
					}
				}
			}
			return this.super('handleAdd', [ev, name]);
		};

		ss.handleRename = function (section_id, ev) {
			var self = this;
			var oldName = section_id;
			var nameEl = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'auth-rename-input',
				'value': oldName,
				'style': 'width: 100%;'
			});
			ui.showModal(_('Rename Authentication Server'), [
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'cbi-section-descr' }, _('Enter a new unique name for this authentication server profile.')),
					E('div', { 'class': 'cbi-section-table' }, [
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td' }, _('Name')),
							E('div', { 'class': 'td' }, [nameEl])
						])
					])
				]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': function () { ui.hideModal(); } }, _('Cancel')),
					E('button', { 'class': 'btn cbi-button cbi-button-positive', 'click': function () {
						var newName = nameEl.value.trim(), i, longconnSections, authSections;
						if (!newName) {
							ui.addNotification(null, E('p', _('Please enter a name.')), 'error');
							return;
						}
						if (newName === oldName) {
							ui.hideModal();
							return;
						}
						longconnSections = uci.sections('wifidogx', 'longconn');
						for (i = 0; i < longconnSections.length; i++) {
							if (longconnSections[i]['.name'] === newName) {
								ui.addNotification(null, E('p', _('The name "%s" already exists in Long Connection profiles. Please choose a different name.').format(newName)), 'error');
								return;
							}
						}
						authSections = uci.sections('wifidogx', 'auth');
						for (i = 0; i < authSections.length; i++) {
							if (authSections[i]['.name'] === newName && authSections[i]['.name'] !== oldName) {
								ui.addNotification(null, E('p', _('The name "%s" already exists in Auth Server profiles. Please choose a different name.').format(newName)), 'error');
								return;
							}
						}
						ui.hideModal();
						uci.rename('wifidogx', section_id, newName);
						self.map.save(null, true);
					}}, _('Rename'))
				])
			]);
		};

		o = ss.option(form.Value, 'auth_server_hostname', _('Auth Server Hostname'),
			_('The domain or IP address of the authentication server.'));
		o.rmempty = false;
		o.datatype = 'or(host,ip4addr)';
		o.optional = false;


		o = ss.option(form.Value, 'auth_server_port', _('Auth Server Port'),
			_('The port of the authentication server.'));
		o.rmempty = false;
		o.datatype = 'port';
		o.optional = false;
		o.default = '443';


		o = ss.option(form.Value, 'auth_server_path', _('Auth Server URI path'),
			_('The URI path of the authentication server.'));
		o.rmempty = false;
		o.datatype = 'string';
		o.optional = false;
		o.default = '/wifidog/';

		// Authentication Location Settings
		// Add auto-fill button
		o = s.taboption('location', form.Button, '_auto_fill', _('Auto Fill All Fields'),
			_('Automatically fill AP MAC address, Device ID, Location ID, Longitude, and Latitude'));
		o.inputtitle = _('Auto Fill All Fields');
		o.inputstyle = 'apply';
		o.onclick = function () {
			showAutoFillModal();

			var results = {
				macAddress: null,
				deviceId: null,
				locationId: null,
				longitude: null,
				latitude: null
			};

			var promises = [
				getMacAddressPromise(results),
				getLocationPromise(results)
			];

			Promise.all(promises).then(function () {
				fillFormFields(results);
			});
		};

		// Helper function to show the auto-fill modal
		function showAutoFillModal() {
			ui.showModal(_('Auto Fill'), [
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'cbi-section-descr' }, _('Getting device information and location data, please wait...')),
					E('div', { 'id': 'auto-fill-progress' }, [
						E('ul', { 'style': 'margin: 10px 0;' }, [
							E('li', { 'id': 'mac-status' }, _('Getting WAN MAC address...')),
							E('li', { 'id': 'device-id-status' }, _('Generating Device ID...')),
							E('li', { 'id': 'location-id-status' }, _('Generating Location ID...')),
							E('li', { 'id': 'location-status' }, _('Getting location coordinates...'))
						])
					])
				])
			]);
		}

		// Helper function to get MAC address
		function getMacAddressPromise(results) {
			return callGetWanMac().then(function (response) {
				if (response && response.status === 'success') {
					var macAddr = response.mac.toUpperCase().replace(/:/g, '-');
					results.macAddress = macAddr;
					document.getElementById('mac-status').innerHTML = _('✓ WAN MAC address obtained: ') + macAddr + ' (interface: ' + response.interface + ')';

					results.deviceId = generateDeviceId(macAddr);
					document.getElementById('device-id-status').innerHTML = _('✓ Device ID generated: ') + results.deviceId;

					results.locationId = generateLocationId();
					document.getElementById('location-id-status').innerHTML = _('✓ Location ID generated: ') + results.locationId;
				} else {
					var errorMsg = (response && response.message) ? response.message : _('Unknown error');
					document.getElementById('mac-status').innerHTML = _('✗ Failed to get WAN MAC address: ') + errorMsg;
					document.getElementById('device-id-status').innerHTML = _('✗ Cannot generate Device ID without MAC address');
				}
			}).catch(function (error) {
				document.getElementById('mac-status').innerHTML = _('✗ Error getting WAN MAC address: ') + error.message;
				document.getElementById('device-id-status').innerHTML = _('✗ Cannot generate Device ID due to MAC error');
			});
		}

		// Helper function to get location
		function getLocationPromise(results) {
			return callGetLocation().then(function (response) {
				if (response && response.status === 'success') {
					var lat = parseFloat(response.lat).toFixed(6);
					var lon = parseFloat(response.lon).toFixed(6);

					formatAndSetCoordinates(results, lat, lon);
					document.getElementById('location-status').innerHTML = _('✓ Location obtained: ') + results.latitude + ', ' + results.longitude;
				} else {
					var errorMsg = (response && response.message) ? response.message : _('Location services unavailable');
					document.getElementById('location-status').innerHTML = _('✗ Failed to get location: ') + errorMsg;
				}
			}).catch(function (error) {
				document.getElementById('location-status').innerHTML = _('✗ Error getting location: ') + error.message;
			});
		}

		// Helper function to format coordinates
		function formatAndSetCoordinates(results, lat, lon) {
			// Pad coordinates to required format
			if (lat >= 0) {
				lat = lat.padStart(10, '0');
			} else {
				lat = '-' + Math.abs(lat).toFixed(6).padStart(9, '0');
			}

			if (lon >= 0) {
				lon = lon.padStart(10, '0');
			} else {
				lon = '-' + Math.abs(lon).toFixed(6).padStart(9, '0');
			}

			results.longitude = lon;
			results.latitude = lat;
		}

		// Helper function to fill form fields
		function fillFormFields(results) {
			var successCount = 0;
			var totalFields = 0;
			var messages = [];

			var fieldMappings = [
				{ key: 'macAddress', selectors: ['input[data-name="ap_mac_address"]', 'input[name*="ap_mac_address"]', 'input[id*="ap_mac_address"]', '#cbid\\.wifidogx\\.default\\.ap_mac_address'], label: _('MAC Address: ') },
				{ key: 'deviceId', selectors: ['input[data-name="ap_device_id"]', 'input[name*="ap_device_id"]', 'input[id*="ap_device_id"]', '#cbid\\.wifidogx\\.default\\.ap_device_id'], label: _('Device ID: ') },
				{ key: 'locationId', selectors: ['input[data-name="location_id"]', 'input[name*="location_id"]', 'input[id*="location_id"]', '#cbid\\.wifidogx\\.default\\.location_id'], label: _('Location ID: ') },
				{ key: 'longitude', selectors: ['input[data-name="ap_longitude"]', 'input[name*="ap_longitude"]', 'input[id*="ap_longitude"]', '#cbid\\.wifidogx\\.default\\.ap_longitude'], label: _('Longitude: ') },
				{ key: 'latitude', selectors: ['input[data-name="ap_latitude"]', 'input[name*="ap_latitude"]', 'input[id*="ap_latitude"]', '#cbid\\.wifidogx\\.default\\.ap_latitude'], label: _('Latitude: ') }
			];

			fieldMappings.forEach(function (mapping) {
				if (results[mapping.key]) {
					var field = null;
					for (var i = 0; i < mapping.selectors.length; i++) {
						field = document.querySelector(mapping.selectors[i]);
						if (field) break;
					}

					if (field) {
						field.value = results[mapping.key];
						field.dispatchEvent(new Event('input', { bubbles: true }));
						field.dispatchEvent(new Event('change', { bubbles: true }));
						successCount++;
						messages.push(mapping.label + results[mapping.key]);
					}
					totalFields++;
				}
			});

			showAutoFillResult(successCount, totalFields, messages);
		}

		// Helper function to show auto-fill results
		function showAutoFillResult(successCount, totalFields, messages) {
			ui.hideModal();

			if (successCount === totalFields && totalFields > 0) {
				ui.addNotification(null, E('p', _('Auto fill completed successfully! All fields have been filled.') + '<br>' + messages.join('<br>')), 'info');
			} else if (successCount > 0) {
				ui.addNotification(null, E('p', _('Auto fill partially completed.') + ' ' + successCount + '/' + totalFields + ' ' + _('fields filled successfully.') + '<br>' + messages.join('<br>')), 'warning');
			} else {
				ui.addNotification(null, E('p', _('Auto fill failed. No fields could be filled. Please check your network connection and try again.')), 'error');
			}
		}

		// Location ID field
		o = s.taboption('location', form.Value, 'location_id', _('Location ID'), _('The unique identifier of the internet service location.'));
		o.rmempty = false;
		o.datatype = 'string';
		o.optional = false;
		o.placeholder = '11010110012345';
		o.validate = function (section_id, value) {
			if (!value || value === '')
				return _('Location ID is required');

			// Check total length
			if (value.length !== 14) {
				return _('Location ID must be exactly 14 digits long');
			}

			// Check if all characters are digits
			if (!/^\d{14}$/.test(value)) {
				return _('Location ID must contain only digits (0-9)');
			}

			// Validate administrative division code (first 6 digits)
			var adminCode = value.substring(0, 6);
			if (!/^\d{6}$/.test(adminCode)) {
				return _('First 6 digits must be valid administrative division code (GB/T 2260)');
			}

			// Validate service type code (7-9 digits)
			var serviceType = value.substring(6, 9);
			var firstDigit = serviceType.charAt(0);
			if (serviceType !== '100' && firstDigit !== '2' && firstDigit !== '3') {
				return _('Service type code (7-9 digits) must be "100" for commercial internet service locations, "2XX" for non-commercial locations, or "3XX" for WiFi wireless collection terminals');
			}

			// Validate sequence number (10-14 digits)
			var sequenceNum = value.substring(9);
			if (!/^\d{5}$/.test(sequenceNum)) {
				return _('Last 5 digits must be sequence number (00000-99999)');
			}

			return true;
		};

		o = s.taboption('location', form.Value, 'ap_device_id', _('AP Device ID'),
			_('The unique identifier of the AP device. Must be 21 characters: 9-character vendor code + 12-character MAC address (uppercase).'));
		o.rmempty = true;
		o.optional = true;
		o.validate = function (section_id, value) {
			if (!value || value === '')
				return true; // Optional field, empty is allowed

			// Check total length
			if (value.length !== 21) {
				return _('AP Device ID must be exactly 21 characters long');
			}

			// Check if all characters are alphanumeric (letters and digits)
			if (!/^[A-Z0-9]+$/.test(value)) {
				return _('AP Device ID must contain only uppercase letters and digits');
			}

			// Extract MAC address part (last 12 characters)
			var macPart = value.substring(9);

			// Validate MAC address format (12 hexadecimal characters)
			if (!/^[A-F0-9]{12}$/.test(macPart)) {
				return _('Last 12 characters must be a valid MAC address in uppercase hexadecimal format (e.g., 00E04C3B7D2F)');
			}

			return true;
		};
		o.placeholder = 'AW123456700E04C3B7D2F';

		o = s.taboption('location', form.Value, 'ap_mac_address', _('AP MAC Address'),
			_('The MAC address of the AP device. Must be 17 characters in format XX-XX-XX-XX-XX-XX (uppercase, separated by hyphens).'));
		o.rmempty = true;
		o.optional = true;
		o.placeholder = '00-E0-4C-3B-7D-2F';
		o.validate = function (section_id, value) {
			if (!value || value === '')
				return true; // Optional field, empty is allowed

			// Check total length
			if (value.length !== 17) {
				return _('MAC address must be exactly 17 characters long');
			}

			// Check format: XX-XX-XX-XX-XX-XX where X is uppercase hex digit
			if (!/^[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}-[A-F0-9]{2}$/.test(value)) {
				return _('MAC address must be in format XX-XX-XX-XX-XX-XX (uppercase hexadecimal separated by hyphens)');
			}

			// Get the AP Device ID to check consistency
			var deviceId = uci.get('wifidogx', section_id, 'ap_device_id');
			if (deviceId && deviceId.length === 21) {
				var deviceMacPart = deviceId.substring(9);
				var normalizedMac = value.replace(/-/g, '');

				if (normalizedMac !== deviceMacPart) {
					return _('MAC address should match the MAC address part (last 12 characters) in AP Device ID');
				}
			}

			return true;
		};

		o = s.taboption('location', form.Value, 'ap_longitude', _('Mobile AP Longitude'),
			_('The longitude coordinate using format: ±XXX.XXXXXX (3 integer digits + 6 decimal digits). Positive for East, negative for West.'));
		o.rmempty = true;
		o.optional = true;
		o.placeholder = '123.230000';
		o.validate = function (section_id, value) {
			if (!value || value === '')
				return true; // Optional field, empty is allowed

			// Allow more flexible input, then validate and suggest correct format
			var numValue = parseFloat(value);
			if (isNaN(numValue)) {
				return _('Longitude must be a valid number');
			}

			if (numValue < -180 || numValue > 180) {
				return _('Longitude must be between -180.000000 and 180.000000');
			}

			// Check if the input matches the strict format requirement
			if (!/^[+-]?\d{3}\.\d{6}$/.test(value)) {
				// Format the number to the required format and suggest it
				var formatted = numValue.toFixed(6);
				if (formatted.indexOf('.') > 0) {
					var parts = formatted.split('.');
					var intPart = parts[0];
					var decPart = parts[1];

					// Pad integer part to 3 digits
					if (intPart.startsWith('-')) {
						intPart = '-' + intPart.substring(1).padStart(3, '0');
					} else {
						intPart = intPart.padStart(3, '0');
					}

					formatted = intPart + '.' + decPart;
				}
				return _('Longitude must be in format ±XXX.XXXXXX (3 integer digits + 6 decimal digits, e.g., 123.230000 or -133.000000). Suggested format: ') + formatted;
			}

			return true;
		};

		o = s.taboption('location', form.Value, 'ap_latitude', _('Mobile AP Latitude'),
			_('The latitude coordinate using format: ±XXX.XXXXXX (3 integer digits + 6 decimal digits). Positive for North, negative for South.'));
		o.rmempty = true;
		o.optional = true;
		o.placeholder = '39.900000';
		o.validate = function (section_id, value) {
			if (!value || value === '')
				return true; // Optional field, empty is allowed

			// Allow more flexible input, then validate and suggest correct format
			var numValue = parseFloat(value);
			if (isNaN(numValue)) {
				return _('Latitude must be a valid number');
			}

			if (numValue < -90 || numValue > 90) {
				return _('Latitude must be between -90.000000 and 90.000000');
			}

			// Check if the input matches the strict format requirement
			if (!/^[+-]?\d{3}\.\d{6}$/.test(value)) {
				// Format the number to the required format and suggest it
				var formatted = numValue.toFixed(6);
				if (formatted.indexOf('.') > 0) {
					var parts = formatted.split('.');
					var intPart = parts[0];
					var decPart = parts[1];

					// Pad integer part to 3 digits
					if (intPart.startsWith('-')) {
						intPart = '-' + intPart.substring(1).padStart(3, '0');
					} else {
						intPart = intPart.padStart(3, '0');
					}

					formatted = intPart + '.' + decPart;
				}
				return _('Latitude must be in format ±XXX.XXXXXX (3 integer digits + 6 decimal digits, e.g., 39.900000 or -33.000000). Suggested format: ') + formatted;
			}

			return true;
		};

		// Long Connection Settings
		o = s.taboption('longconn', form.SectionValue, '_longconn', form.GridSection, 'longconn',
			_('Persistent Connection Profiles'),
			_('Create one or more long connection profiles for cloud authentication and OpenClaw intelligent control channels.'));
		ss = o.subsection;
		ss.addremove = true;
		ss.nodescriptions = true;

		ss.handleAdd = function (ev, name) {
			var self = this, i, authSections, longconnSections;
			if (name) {
				authSections = uci.sections('wifidogx', 'auth');
				for (i = 0; i < authSections.length; i++) {
					if (authSections[i]['.name'] === name) {
						ui.addNotification(null, E('p', _('The name "%s" already exists in Auth Server profiles. Please choose a different name.').format(name)), 'error');
						return Promise.resolve();
					}
				}
				longconnSections = uci.sections('wifidogx', 'longconn');
				for (i = 0; i < longconnSections.length; i++) {
					if (longconnSections[i]['.name'] === name) {
						ui.addNotification(null, E('p', _('The name "%s" already exists in Long Connection profiles. Please choose a different name.').format(name)), 'error');
						return Promise.resolve();
					}
				}
			}
			return this.super('handleAdd', [ev, name]);
		};

		ss.handleRename = function (section_id, ev) {
			var self = this;
			var oldName = section_id;
			var nameEl = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'longconn-rename-input',
				'value': oldName,
				'style': 'width: 100%;'
			});
			ui.showModal(_('Rename Long Connection Profile'), [
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'cbi-section-descr' }, _('Enter a new unique name for this long connection profile.')),
					E('div', { 'class': 'cbi-section-table' }, [
						E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td' }, _('Name')),
							E('div', { 'class': 'td' }, [nameEl])
						])
					])
				]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': function () { ui.hideModal(); } }, _('Cancel')),
					E('button', { 'class': 'btn cbi-button cbi-button-positive', 'click': function () {
						var newName = nameEl.value.trim(), i, authSections, longconnSections;
						if (!newName) {
							ui.addNotification(null, E('p', _('Please enter a name.')), 'error');
							return;
						}
						if (newName === oldName) {
							ui.hideModal();
							return;
						}
						authSections = uci.sections('wifidogx', 'auth');
						for (i = 0; i < authSections.length; i++) {
							if (authSections[i]['.name'] === newName) {
								ui.addNotification(null, E('p', _('The name "%s" already exists in Auth Server profiles. Please choose a different name.').format(newName)), 'error');
								return;
							}
						}
						longconnSections = uci.sections('wifidogx', 'longconn');
						for (i = 0; i < longconnSections.length; i++) {
							if (longconnSections[i]['.name'] === newName && longconnSections[i]['.name'] !== oldName) {
								ui.addNotification(null, E('p', _('The name "%s" already exists in Long Connection profiles. Please choose a different name.').format(newName)), 'error');
								return;
							}
						}
						ui.hideModal();
						uci.rename('wifidogx', section_id, newName);
						self.map.save(null, true);
					}}, _('Rename'))
				])
			]);
		};

		o = ss.option(form.ListValue, 'long_conn_mode', _('Connection Mode'),
			_('The type of persistent connection to the remote management server.'));
		o.value('ws', _('WebSocket (ws://)'));
		o.value('wss', _('WebSocket Secure (wss://)'));
		o.value('mqtt', _('MQTT'));
		o.value('mqtts', _('MQTT Secure'));
		o.default = 'ws';
		o.rmempty = false;

		o = ss.option(form.Value, 'ws_server_hostname', _('WebSocket Hostname'),
			_('The hostname or IP address of the WebSocket server.'));
		o.datatype = 'or(host,ip4addr)';
		o.rmempty = true;
		o.depends('long_conn_mode', 'ws');
		o.depends('long_conn_mode', 'wss');
		o.placeholder = 'ws.example.com';
		o.modalonly = true;

		o = ss.option(form.Value, 'ws_server_port', _('WebSocket Port'),
			_('The port of the WebSocket server.'));
		o.datatype = 'port';
		o.rmempty = true;
		o.default = '443';
		o.depends('long_conn_mode', 'ws');
		o.depends('long_conn_mode', 'wss');
		o.modalonly = true;

		o = ss.option(form.Value, 'ws_server_path', _('WebSocket Path'),
			_('The URI path for the WebSocket connection.'));
		o.datatype = 'string';
		o.rmempty = true;
		o.default = '/ws/wifidogx';
		o.depends('long_conn_mode', 'ws');
		o.depends('long_conn_mode', 'wss');
		o.modalonly = true;

		o = ss.option(form.Value, 'mqtt_server_hostname', _('MQTT Hostname'),
			_('The hostname or IP address of the MQTT broker.'));
		o.datatype = 'or(host,ip4addr)';
		o.rmempty = true;
		o.depends('long_conn_mode', 'mqtt');
		o.depends('long_conn_mode', 'mqtts');
		o.placeholder = 'mqtt.example.com';
		o.modalonly = true;

		o = ss.option(form.Value, 'mqtt_server_port', _('MQTT Port'),
			_('The port of the MQTT broker.'));
		o.datatype = 'port';
		o.rmempty = true;
		o.default = '1883';
		o.depends('long_conn_mode', 'mqtt');
		o.depends('long_conn_mode', 'mqtts');
		o.modalonly = true;

		o = ss.option(form.Value, 'mqtt_username', _('MQTT Username'),
			_('The username for MQTT authentication.'));
		o.datatype = 'string';
		o.rmempty = true;
		o.optional = true;
		o.depends('long_conn_mode', 'mqtt');
		o.depends('long_conn_mode', 'mqtts');
		o.modalonly = true;

		o = ss.option(form.Value, 'mqtt_password', _('MQTT Password'),
			_('The password for MQTT authentication.'));
		o.datatype = 'string';
		o.rmempty = true;
		o.optional = true;
		o.password = true;
		o.depends('long_conn_mode', 'mqtt');
		o.depends('long_conn_mode', 'mqtts');
		o.modalonly = true;

		// rule settings
		o = s.taboption('rule', form.DynamicList, 'trusted_wildcard_domains', _('Trusted Wildcard Domains'),
			_('Requires aw-bpf DNS XDP (dns_ringbuf_portal). Patterns like .example.com; resolved IPs are added to the captive portal firewall (inet wifidogx), not inet awbpf.'));
		o.rmempty = true;
		o.optional = true;
		o.datatype = 'string';
		o.placeholder = '.example.com';

		o = s.taboption('rule', form.DynamicList, 'trusted_domains', _('Trusted Domains'),
			_('The trusted domains of the gateway'));
		o.rmempty = true;
		o.optional = true;
		o.datatype = 'hostname';
		o.placeholder = 'www.example.com';

		o = s.taboption('rule', form.DynamicList, 'trusted_macs', _('Trusted MACs'),
			_('The trusted MAC addresses of the gateway.'));
		o.rmempty = true;
		o.optional = true;
		o.datatype = 'macaddr';
		o.placeholder = 'A0:B1:C2:D3:44:55';

		o = s.taboption('rule', CBIWifidogxGroupSelect, 'app_white_list', _('App White List'),
			_('The app white list of the gateway.'));
		o.rmempty = true;
		o.multiple = true;
		o.nocreate = true;

		o = s.taboption('rule', CBIWifidogxGroupSelect, 'mac_white_list', _('MAC White List'),
			_('The MAC white list of the gateway.'));
		o.rmempty = true;
		o.multiple = true;
		o.nocreate = true;
		o.setGroupType('mac');

		o = s.taboption('rule', CBIWifidogxGroupSelect, 'wildcard_white_list', _('Wildcard White List'),
			_('The wildcard domain white list of the gateway.'));
		o.rmempty = true;
		o.multiple = true;
		o.nocreate = true;
		o.setGroupType('wildcard');

		s = m.section(form.GridSection, 'group', _('Group Define'));
		s.addremove = true;
		s.anonymous = false;
		s.nodescriptions = true;

		s.handleRemove = function (section_id, ev) {
			// according section_id to check whether it is used by app_white_list, wildcard_white_list or mac_white_list
			var gtype = uci.get('wifidogx', section_id, 'g_type');
			var group = (gtype === '1') ? 'app_white_list' : (gtype === '3') ? 'wildcard_white_list' : 'mac_white_list';
			var groupList = uci.get('wifidogx', 'common', group);
			if (groupList) {
				for (var i = 0; i < groupList.length; i++) {
					if (groupList[i] === section_id) {
						ui.addNotification(null, E('p', [
							_('The group is used by '), E('strong', group), _(' please remove it from '), E('strong', group), _(' first.')
						]), 'warning');
						return false;
					}
				}
			}

			return this.super('handleRemove', [section_id, ev]);
		};

		o = s.option(form.ListValue, 'g_type', _('Group Type'), _('The type of the group.'));
		o.value('1', _('Domain Group'));
		o.value('2', _('MAC Group'));
		o.value('3', _('Wildcard Domain Group'));
		o.default = '1';

		o = s.option(form.DynamicList, 'domain_name', _('Domain Name'), _('The domain name of the group.'));
		o.depends('g_type', '1');
		o.datatype = 'hostname';
		o.rmempty = false;
		o.optional = false;
		o.placeholder = 'www.example.com';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'mac_address', _('MAC Address'), _('The MAC address of the group.'));
		o.depends('g_type', '2');
		o.datatype = 'macaddr';
		o.rmempty = false;
		o.optional = false;
		o.placeholder = 'A0:B1:C2:D3:44:55';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'wildcard_domain', _('Wildcard Domain'), _('The wildcard domain of the group.'));
		o.depends('g_type', '3');
		o.datatype = 'string';
		o.rmempty = false;
		o.optional = false;
		o.placeholder = '.example.com';
		o.modalonly = true;

		o = s.option(form.Value, 'g_desc', _('Group Description'), _('The description of the group.'));
		o.datatype = 'string';
		o.optional = true;

		return m.render();
	}
});
