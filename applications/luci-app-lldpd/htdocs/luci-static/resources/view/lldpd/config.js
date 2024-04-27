/*
 * Copyright (c) 2020 Tano Systems LLC. All Rights Reserved.
 * Author: Anton Kikin <a.kikin@tano-systems.com>
 * Copyright (c) 2023-2024. All Rights Reserved.
 * Paul Donald <newtwen+github@gmail.com>
 */

'use strict';
'require rpc';
'require form';
'require lldpd';
'require network';
'require uci';
'require tools.widgets as widgets';

var callInitList = rpc.declare({
	object: 'luci',
	method: 'getInitList',
	params: [ 'name' ],
	expect: { '': {} },
	filter: function(res) {
		for (var k in res)
			return +res[k].enabled;
		return null;
	}
});

var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

var usage = _('See syntax <a %s>here</a>.').format('href=https://lldpd.github.io/usage.html target="_blank"');

const validateioentries = function(section_id, value) {
	if (value) {
		const emsg = _('Cannot have both interface %s and its exclusion %s');
		const a = value.split(' ');
		const noex = a.filter(el=> !el.startsWith('!'));
		const ex = a.filter(el=> el.startsWith('!') && !el.startsWith('!!'));
		for (var i of noex) {
			for (var e of ex) {
				if ('!'+i == e){
					return emsg.format(i, e);
				}
			}
		}
	}
	return true;
};

return L.view.extend({
	__init__: function() {
		this.super('__init__', arguments);

		// Inject CSS
		var head = document.getElementsByTagName('head')[0];
		var css = E('link', { 'href':
			L.resource('lldpd/lldpd.css')
				+ '?v=#PKG_VERSION', 'rel': 'stylesheet' });

		head.appendChild(css);
	},

	load: function() {
		return Promise.all([
			callInitList('lldpd'),
			lldpd.init(),
			uci.load('lldpd'),
			network.getDevices()
		]);
	},

	// -----------------------------------------------------------------------------------------
	//
	//   Basic Options
	//
	// -----------------------------------------------------------------------------------------

	/** @private */
	populateBasicOptions: function(s, tab, data) {
		var o;
		var serviceEnabled = data[0];
		var net_devices = data[3];

		// Service enable/disable
		o = s.taboption(tab, form.Flag, 'enabled', _('Enable service'));
		o.optional = false;
		o.rmempty = false;

		o.cfgvalue = function() {
			return serviceEnabled ? this.enabled : this.disabled;
		};

		o.write = function(section_id, value) {
			uci.set('lldpd', section_id, 'enabled', value);

			if (value == '1') {
				// Enable and start
				callInitAction('lldpd', 'enable').then(function() {
					return callInitAction('lldpd', 'start');
				});
			}
			else {
				// Stop and disable
				callInitAction('lldpd', 'stop').then(function() {
					return callInitAction('lldpd', 'disable');
				});
			}
		};

		// System description
		o = s.taboption(tab, form.Value, 'lldp_description',
			_('System description'),
			_('Override %s.').format('<code>system description</code>'));

		o.placeholder = 'System description';

		// System hostname
		o = s.taboption(tab, form.Value, 'lldp_hostname',
			_('System hostname'),
			_('Override %s.').format('<code>system hostname</code>'));

		o.placeholder = 'System hostname';

		/* This function returns the value for a specified key. Used to fill 
		various location fields derived from an lldpd location config string */
		function getLocationValueFromConfString(_key) {
			var inStr = this ? this.section.formvalue('config', 'lldp_location'):
				uci.get('lldpd', 'config', 'lldp_location');
			inStr = inStr ? inStr: '';

			const words = inStr.trim().split(/\s+/);
			/* This function does not assume an order to the key:value parameters.
			Only that the value comes after its key, so optional keys can be in any order. */
			const ix = words.indexOf(_key);

			if (ix !== -1) {
				let value = words.slice(ix + 1).join(' ');

				if (value.startsWith('"')) {
					const quoteStart = value.indexOf('"');
					const quoteEnd = value.indexOf('"', quoteStart + 1);
					return value.substring(quoteStart + 1, quoteEnd);
				}
				return _key == 'altitude' ? words[ix + 1] + ' ' + words[ix + 2] : words[ix + 1];
			} else {
				return ''; // Element not found
			}
		};

		function write_lldp_location() {
			var _input = this ? this.section.formvalue('config', '_lldp_location_type'):
				'1';

			if(_input){
				if (_input == '1') {
					/* location coordinate latitude
					48.85667N longitude 2.2014E altitude 117.47 m datum WGS84 */
					var lat = this.section.formvalue('config', '_coordinate_lat'),
					    lon = this.section.formvalue('config', '_coordinate_lon'),
					    alt = this.section.formvalue('config', '_coordinate_alt'),
					    dat = this.section.formvalue('config', '_coordinate_dat');
					if(lat && lon && dat) {
						uci.set('lldpd', 'config', 'lldp_location',
							'coordinate latitude ' + lat +
								' longitude ' + lon +
								' altitude ' + (alt ? alt:'0 m') +
								' datum ' + dat );
					}
				}
				else if (_input == '2') {
					/* location address country US
						street "Commercial Road" city "Roseville" */
					var cc = this.section.formvalue('config', '_civic_cc'),
					    city = this.section.formvalue('config', '_civic_city'),
					    str = this.section.formvalue('config', '_civic_str'),
					    bldg = this.section.formvalue('config', '_civic_bldg'),
					    nmbr = this.section.formvalue('config', '_civic_nmbr'),
					    zip = this.section.formvalue('config', '_civic_zip');

					uci.set('lldpd', 'config', 'lldp_location',
						'address country ' + cc.toUpperCase()
						+ (city ? ' city "' + city + '"': '')
						+ (str ? ' street "' + str + '"': '')
						+ (bldg ? ' building "' + bldg + '"': '')
						+ (nmbr ? ' number "' + nmbr + '"': '')
						+ (zip ? ' zip "' + zip + '"': ''));
				}
				else if (_input == '3') {
					/* location elin 12345 */
					var elin = this.section.formvalue('config', '_elin');
					if(elin)
						uci.set('lldpd', 'config', 'lldp_location', 'elin ' + elin);
				}
			}
		};

		// Host location
		o = s.taboption(tab, form.ListValue, '_lldp_location_type',
			_('Host location type'),
			_('Override the announced location of the host.'));
		o.value('1', _('Coordinate based'));
		o.value('2', _('Civic address'));
		o.value('3', _('ELIN'));
		o.rmempty = true;
		o.write = write_lldp_location;
		o.load = function(section_id, value) {
			const loc = uci.get(this.config, section_id, 'lldp_location');
			if (!loc) return '1';
			if (loc.toLowerCase().includes('coordinate')) {
				return '1';
			}
			else if (loc.toLowerCase().includes('address country')) {
				return '2';
			}
			else if (loc.toLowerCase().includes('elin')) {
				return '3';
			}
		};

		o = s.taboption(tab, form.Value, 'lldp_location',
			_('Raw location config'),
			_('Raw config string sent to lldpd, starting: [coordinate|address|elin]'));
		o.placeholder = 'address country EU';
		o.rmempty = true;
		o.write = function(section_id, value) {
			if (value) {
				const words = value.trim().split(/\s+/),
				      regex = /^coordinate|^address|^elin/;
				var start;
				words.forEach(w=>{
					if (w.match(regex)) start = w;
				});
				// Retain string tail from one of the regex keywords
				return this.super('write', [ section_id,
					value.substring(value.indexOf(start)) ]);
			}
		};
		o.validate = function(section_id, value) {
			if (value) {
				const words = value.trim().split(/\s+/),
				      regex = /^coordinate|^address|^elin/;
				var _eval = _("Must contain: 'coordinate ...', 'address ...' or 'elin ...'");
				words.forEach(w=>{
					if (w.match(regex)) _eval = true;
				});
				return _eval;
			}
			return true;
		};

		// Coordinate based
		o = s.taboption(tab, form.Value, '_coordinate_lat',
			_('Latitude'), '0 .. 90.000[N|S]');
		o.depends({ '_lldp_location_type' : '1'});
		o.datatype = "maxlength(20)";
		o.validate = function(section_id, value) {
			if (!value) return true;
			var valid = _('valid syntax: 0 .. 90.000[N|S]');
			valid = (parseFloat(value) >= 0 && parseFloat(value) <= 90) ?
				/^-?\d+(?:\.\d+)?[NnSs]$/.test(value) ? true : valid : valid;
			return valid;
		}
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('latitude');
		}
		o.write = write_lldp_location;

		o = s.taboption(tab, form.Value, '_coordinate_lon',
			_('Longitude'), '0 .. 180.000[E|W]');
		o.depends({ '_lldp_location_type' : '1'});
		o.datatype = "maxlength(20)";
		o.validate = function(section_id, value) {
			if (!value) return true;
			var valid = _('valid syntax: 0 .. 180.000[E|W]');
			valid = (parseFloat(value) >= 0 && parseFloat(value) <= 180) ?
				/^-?\d+(?:\.\d+)?[WwEe]$/.test(value) ? true : valid : valid;
			return valid;
		}
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('longitude');
		}
		o.write = write_lldp_location;

		const min_alt = -100000.00,
		      max_alt = 42849672.95;
		o = s.taboption(tab, form.Value, '_coordinate_alt',
			_('Altitude'), '%f .. %f [m|f]'.format(min_alt, max_alt));
		o.depends({ '_lldp_location_type' : '1'});
		o.datatype = 'maxlength(20)';
		o.validate = function(section_id, value) {
			if (!value) return true;
			var valid = _('valid syntax: %f .. %f [mf]').format(min_alt, max_alt);
			valid = (parseFloat(value) >= min_alt && parseFloat(value) <=  max_alt) ?
				/^-?\d+(?:\.\d+)?\ [mf]$/.test(value) ? true : valid : valid;
			return valid;
		}
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('altitude');
		}
		o.write = write_lldp_location;

		o = s.taboption(tab, form.ListValue, '_coordinate_dat',
			_('Datum'));
		o.depends({ '_lldp_location_type' : '1'});
		o.value('WGS84');
		o.value('NAD83');
		o.value('NAD83/MLLW');
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('datum');
		}
		o.write = write_lldp_location;

		// Civic address based
		/* ISO 3166-2 CC list officially assigned + exceptional:
		https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements */
		o = s.taboption(tab, form.Value, '_civic_cc',
			_('Country'), '%s'.format('<a href=%s>ISO 3166-2 CC</a>').format('https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements'));
		o.depends({ '_lldp_location_type' : '2'});
		o.default = 'EU';
		o.placeholder = 'EU';
		o.validate = function(section_id, value) {
			if(!value) return true;
			var valid = _('Two character CC required');
			valid = (value.length == 2) ?
				/^[A-Z]{2}$/i.test(value) ? true : valid : valid;
			return valid;
		}
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('country').toUpperCase();
		}
		o.write = write_lldp_location;

		o = s.taboption(tab, form.Value, '_civic_city',
			_('City'));
		o.depends({ '_lldp_location_type' : '2'});
		o.datatype = "maxlength(100)";
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('city');
		}
		o.placeholder = _('Gotham');
		o.write = write_lldp_location;

		o = s.taboption(tab, form.Value, '_civic_str',
			_('Street'));
		o.depends({ '_lldp_location_type' : '2'});
		o.datatype = "maxlength(100)";
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('street');
		}
		o.placeholder = _('Main Street');
		o.write = write_lldp_location;

		o = s.taboption(tab, form.Value, '_civic_bldg',
			_('Building'));
		o.depends({ '_lldp_location_type' : '2'});
		o.datatype = "maxlength(250)";
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('building');
		}
		o.placeholder = _('Empire State Bldg');
		o.write = write_lldp_location;
		
		o = s.taboption(tab, form.Value, '_civic_nmbr',
			_('Number'));
		o.depends({ '_lldp_location_type' : '2'});
		o.datatype = "maxlength(25)";
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('number');
		}
		o.placeholder = _('1A');
		o.write = write_lldp_location;

		o = s.taboption(tab, form.Value, '_civic_zip',
			_('Post-code'));
		o.depends({ '_lldp_location_type' : '2'});
		o.datatype = "maxlength(25)";
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('zip');
		}
		o.placeholder = '12345';
		o.write = write_lldp_location;

		// ELIN based
		o = s.taboption(tab, form.Value, '_elin',
			_('ELIN Address'));
		o.depends({ '_lldp_location_type' : '3'});
		o.datatype = 'and(uinteger,maxlength(25))';
		o.load = function(section_id, value) {
			return getLocationValueFromConfString('elin');
		}
		o.placeholder = '1911';
		o.write = write_lldp_location;

		// Platform
		o = s.taboption(tab, form.Value, 'lldp_platform',
			_('System platform description'),
			_('Override %s.').format('<code>system platform</code>') + '<br />' + 
			_('The default description is the kernel name (Linux).'));

		o.placeholder = 'System platform description';

		o = s.taboption(tab, form.Flag, 'lldp_capability_advertisements', _('System capability advertisements'));
		o.default = '1'; //lldpd internal default
		o.rmempty = false;

		// Capabilities override
		o = s.taboption(tab, form.MultiValue, 'lldp_syscapabilities',
			_('System capabilities'),
			_('Override %s.').format('<code>system capabilities</code>') + '<br />' + 
			_('The default is derived from kernel information.'));
		o.depends({lldp_capability_advertisements: '1'});
		o.value('bridge');
		o.value('docsis');
		o.value('other');
		o.value('repeater');
		o.value('router');
		o.value('station');
		o.value('telephone');
		o.value('wlan');
		o.cfgvalue = function(section_id) {
			return String(this.super('load', [section_id]) || this.default).split(',');
		};
		o.write = function(section_id, value) {
			return this.super('write', [ section_id, L.toArray(value).join(',') ]);
		};

		o = s.taboption(tab, form.Flag, 'lldp_mgmt_addr_advertisements', _('System management IO advertisements'));
		o.default = '1'; //lldpd internal default
		o.rmempty = false;

		// Management addresses of this system
		// This value: lldpd.init handles as a single value, and needs a CSV for lldpd.conf: 'configure system ip management pattern'
		o = s.taboption(tab, lldpd.CBIMultiIOSelect, 'lldp_mgmt_ip',
			_('System management IO'),
			_('Defaults to the first IPv4 and IPv6. ' +
			  'If an exact IP address is provided, it is used ' +
			  'as a management address without any check. To ' +
			  'blacklist IPv6 addresses, use <code>!*:*</code>.') + '<br />' +
			  usage);
		o.placeholder = 'Addresses and interfaces';
		o.depends({lldp_mgmt_addr_advertisements: '1'});
		o.cfgvalue = function(section_id) {
			const opt = uci.get(this.config, section_id, this.option);
			return opt ? opt.split(',') : '';
		};
		net_devices.forEach(nd => {
			o.value(nd.getName());
			o.value('!'+nd.getName());
			nd.getIPAddrs().forEach(addr => o.value(addr.split('/')[0], E([], [addr.split('/')[0], ' (', E('strong', {}, nd.getName()), ')'])));
			nd.getIP6Addrs().forEach(addr => o.value(addr.split('/')[0], E([], [addr.split('/')[0], ' (', E('strong', {}, nd.getName()), ')'])));
		});
		o.value('!*:*');
		o.validate = validateioentries;
		o.write = function(section_id, value, sep) {
			return this.super('write', [ section_id, value.join(',') ]);
		}

		// LLDP tx interval
		o = s.taboption(tab, form.Value, 'lldp_tx_interval',
			_('Transmit delay'),
			_('The delay between ' +
			  'transmissions of LLDP PDU. The default value ' +
			  'is 30 seconds.') + '<br />' +
			_('Suffix %s for millisecond values.').format('<code>ms</code>'));
		o.default = 30;
		o.placeholder = 30;
		o.rmempty = false;

		o.validate = function(section_id, value) {
			const pattern = /^(\d+)(?:ms)?$/;
			if (!value.match(pattern) || parseInt(value) <= 0)
				return _('Must be a greater than zero number optionally suffixed with "ms"');
			return true;
		};

		// LLDP tx hold
		o = s.taboption(tab, form.Value, 'lldp_tx_hold',
			_('Transmit hold value'),
			_('Determines the transmitted ' +
			  'packet TTL (== this value * transmit delay). ' +
			  'The default value is 4 &therefore; ' +
			  'the default TTL is 120 seconds.'));

		o.datatype = 'uinteger';
		o.default = 4;
		o.placeholder = 4;
		o.rmempty = false;

		o.validate = function(section_id, value) {
			if (value != parseInt(value))
				return _('Must be a number');
			else if (value <= 0)
				return _('Transmit hold value must be greater than 0');
			return true;
		};

		// Received-only mode (-r)
		o = s.taboption(tab, form.Flag, 'readonly_mode',
			_('Receive-only mode'),
			_("LLDPd won't send any frames; " +
			  'only listen to neighbors.'));

		o.rmempty = false;
		o.optional = false;
		o.default = '0';
	},

	// -----------------------------------------------------------------------------------------
	//
	//   Network Interfaces
	//
	// -----------------------------------------------------------------------------------------

	/** @private */
	populateIfacesOptions: function(s, tab, data) {
		var o;
		var net_devices = data[3];

		// Interfaces to listen on
		// This value: lldpd.init handles as a list value, and produces a CSV for lldpd.conf: 'configure system interface pattern'
		o = s.taboption(tab, lldpd.CBIMultiIOSelect, 'interface',
			_('Network IO'),
			_('Specify which interface (not) to listen upon and send LLDPDU from. ' +
			  'Absent any value, LLDPd uses all available physical interfaces.'));

		o.value('*');
		net_devices.forEach(nd => {
			o.value(nd.getName());
			o.value('!'+nd.getName());
			o.value('!!'+nd.getName());
		});
		o.value('!*:*');
		o.validate = validateioentries;

		// ChassisID interfaces
		// This value: lldpd.init handles as a list value, and produces a CSV for the -C param
		o = s.taboption(tab, lldpd.CBIMultiIOSelect, 'cid_interface',
			_('Network IO for chassis ID'),
			_('Specify which interfaces (not) to use for computing chassis ID. ' +
			  'Absent any value, all interfaces are considered. ' +
			  'LLDPd takes the first MAC address from all the considered ' +
			  'interfaces to compute the chassis ID.'));

		o.value('*');
		o.value('!*');
		net_devices.forEach(nd => {
			o.value(nd.getName());
			o.value('!'+nd.getName());
			o.value('!!'+nd.getName());
		});
		o.value('!*:*');
		o.validate = validateioentries;

	},

	// -----------------------------------------------------------------------------------------
	//
	//   Advanced Options
	//
	// -----------------------------------------------------------------------------------------

	/** @private */
	populateAdvancedOptions: function(s, tab, data) {
		var o;

		// SNMP agentX socket
		/* **Note**: The init file tests for SNMP support, so agentxsocket is at worst inert. */
		o = s.taboption(tab, form.Value, 'agentxsocket',
			_('SNMP agentX socket path'),
			_('When set, LLDPd enables an ' +
			  'SNMP subagent using AgentX protocol. This enables ' +
			  'information about other systems through SNMP.'));

		o.rmempty = true;
		o.placeholder = '/var/run/agentx.sock';
		o.default = '';

		// LLDP-MED class
		o = s.taboption(tab, form.ListValue, 'lldp_class',
			_('LLDP-MED device class'));

		o.value('1', _('Generic Endpoint (Class I)'));
		o.value('2', _('Media Endpoint (Class II)'));
		o.value('3', _('Communication Device Endpoints (Class III)'));
		o.value('4', _('Network Connectivity Device (Class IV)'));

		o.default = '4';

		// LLDP-MED policy
		o = s.taboption(tab, form.Value, 'lldp_policy',
			_('LLDP-MED policy'));
		o.depends({lldp_class: '2'});
		o.depends({lldp_class: '3'});

		o.rmempty = true;
		o.placeholder = 'application streaming-video';
		o.value('application voice');
		o.value('application voice unknown');
		o.value('application voice-signaling');
		o.value('application voice-signaling unknown');
		o.value('application guest-voice');
		o.value('application guest-voice unknown');
		o.value('application guest-voice-signaling');
		o.value('application guest-voice-signaling unknown');
		o.value('application softphone-voice');
		o.value('application softphone-voice unknown');
		o.value('application video-conferencing');
		o.value('application video-conferencing unknown');
		o.value('application streaming-video');
		o.value('application streaming-video unknown');
		o.value('application video-signaling');
		o.value('application video-signaling unknown');

		o.validate = function(section_id, value) {
			if (value && !value.startsWith('application '))
				return _('Must start: application ...');
			return true;
		};

		// LLDP-MED fast-start
		o = s.taboption(tab, form.Flag, 'lldpmed_fast_start',
			_('LLDP-MED fast-start'));

		// LLDP-MED fast-start
		o = s.taboption(tab, form.Value, 'lldpmed_fast_start_tx_interval',
			_('LLDP-MED fast-start tx-interval'));
		o.depends({lldpmed_fast_start: '1'});
		o.datatype = 'uinteger';
		o.placeholder = '10';
		o.rmempty = true;

		// LLDP-MED inventory TLV transmission (-i)
		o = s.taboption(tab, form.Flag, 'lldpmed_no_inventory',
			_('Disable LLDP-MED inventory TLV transmission'),
			_('LLDPd will still receive (and publish using SNMP if enabled) ' +
			  'those LLDP-MED TLV but will not send them. Use this option ' +
			  'if you do not want to transmit sensitive information like serial numbers.'));

		o.default = '0';

		// Disable advertising of kernel release, version and machine. (-k)
		o = s.taboption(tab, form.Flag, 'lldp_no_version',
			_('Disable advertising of kernel release, version and machine'),
			_('Kernel name (ie: Linux) will still be shared, and Inventory ' +
			  'software version will be set to %s.').format('<code>Unknown</code>'));

		o.default = '0';

		// Filter neighbors (-H)
		o = s.taboption(tab, lldpd.cbiFilterSelect, 'filter',
			_('Specify the behaviour when detecting multiple neighbors'),
			_('The default filter is 15. Refer to &quot;FILTERING NEIGHBORS&quot;.') + '<br />' +
			usage);

		o.default = 15;

		// Force port ID subtype
		o = s.taboption(tab, form.ListValue, 'lldp_portidsubtype',
			_('Force port ID subtype'),
			_('With this option, you can force the port identifier ' +
			  'to be the interface name or the MAC address.'));

		o.value('macaddress', _('Interface MAC address'));
		o.value('ifname', _('Interface name'));

		o.default = 'macaddress';

		// The destination MAC address used to send LLDPDU
		o = s.taboption(tab, form.ListValue, 'lldp_agenttype',
			_('LLDPDU destination MAC'),
			_('Allows an agent ' +
			  'to control the propagation of LLDPDUs. By default, the ' +
			  'MAC address %s is used and limits the propagation ' +
			  'of the LLDPDU to the nearest bridge.').format('<code>01:80:c2:00:00:0e</code>'));

		o.value('nearest-bridge',          '01:80:c2:00:00:0e (nearest-bridge)');
		o.value('nearest-nontpmr-bridge',  '01:80:c2:00:00:03 (nearest-nontpmr-bridge)');
		o.value('nearest-customer-bridge', '01:80:c2:00:00:00 (nearest-customer-bridge)');

		o.default = 'nearest-bridge';
	},

	// -----------------------------------------------------------------------------------------
	//
	//   Protocols Support
	//
	// -----------------------------------------------------------------------------------------

	/** @private */
	populateProtocolsOptions: function(s, tab, data) {
		var o;

		o = s.taboption(tab, form.SectionValue, '_protocols', form.TypedSection, 'lldpd');
		var ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = false;

		//
		// LLDPD
		// Link Layer Discovery Protocol
		//
		ss.tab('lldp', _('LLDP'));
		o = ss.taboption('lldp', form.Flag, 'enable_lldp',
			_('Enable LLDP'));

		o.default = '1';
		o.rmempty = true;

		o = ss.taboption('lldp', form.Flag, 'force_lldp',
			_('Force sending LLDP packets'),
			_('Even when there is no LLDP peer ' +
			  'detected but there is a peer speaking another protocol detected.') + '<br />' +
			_('By default, LLDP packets are sent when there is a peer speaking ' +
			  'LLDP detected or when there is no peer at all.'));

		o.default = '0';
		o.rmempty = true;
		o.depends('enable_lldp', '1');

		//
		// CDP
		// Cisco Discovery Protocol
		//
		ss.tab('cdp', _('CDP'));
		o = ss.taboption('cdp', form.Flag, 'enable_cdp',
			_('Enable CDP'),
			_('Enable the support of CDP protocol to deal with Cisco routers ' +
			  'that do not speak LLDP'));

		o.default = '1';
		o.rmempty = false;

		o = ss.taboption('cdp', form.ListValue, 'cdp_version',
			_('CDP version'));

		o.value('cdpv1v2', _('CDPv1 and CDPv2'));
		o.value('cdpv2',   _('Only CDPv2'));
		o.depends('enable_cdp', '1');

		o.default = 'cdpv1v2';

		o = ss.taboption('cdp', form.Flag, 'force_cdp',
			_('Send CDP packets even if no CDP peer detected'));

		o.default = '0';
		o.rmempty = true;
		o.depends('enable_cdp', '1');

		o = ss.taboption('cdp', form.Flag, 'force_cdpv2',
			_('Force sending CDPv2 packets'));

		o.default = '0';
		o.rmempty = true;
		o.depends({
			force_cdp:   '1',
			enable_cdp:  '1',
			cdp_version: 'cdpv1v2'
		});

		//
		// FDP
		// Foundry Discovery Protocol
		//
		ss.tab('fdp', _('FDP'));
		o = ss.taboption('fdp', form.Flag, 'enable_fdp',
			_('Enable FDP'),
			_('Enable the support of FDP protocol to deal with Foundry routers ' +
			  'that do not speak LLDP'));

		o.default = '1';
		o.rmempty = false;

		o = ss.taboption('fdp', form.Flag, 'force_fdp',
			_('Send FDP packets even if no FDP peer detected'));

		o.default = '0';
		o.rmempty = true;
		o.depends('enable_fdp', '1');

		//
		// EDP
		// Extreme Discovery Protocol
		//
		ss.tab('edp', _('EDP'));
		o = ss.taboption('edp', form.Flag, 'enable_edp',
			_('Enable EDP'),
			_('Enable the support of EDP protocol to deal with Extreme routers ' +
			  'and switches that do not speak LLDP.'));

		o.default = '1';
		o.rmempty = false;

		o = ss.taboption('edp', form.Flag, 'force_edp',
			_('Send EDP packets even if no EDP peer detected'));

		o.default = '0';
		o.rmempty = true;
		o.depends('enable_edp', '1');

		//
		// SONMP
		// SynOptics Network Management Protocol
		//
		// a.k.a.
		// Nortel Topology Discovery Protocol (NTDP)
		// Nortel Discovery Protocol (NDP)
		// Bay Network Management Protocol (BNMP)
		// Bay Discovery Protocol (BDP)
		//
		ss.tab('sonmp', _('SONMP (NTDP, NDP, BNMP, BDP)'));
		o = ss.taboption('sonmp', form.Flag, 'enable_sonmp',
			_('Enable SONMP'),
			_('Enable the support of SONMP protocol to deal with Nortel ' +
			  'routers and switches that do not speak LLDP.'));

		o.default = '1';
		o.rmempty = false;

		o = ss.taboption('sonmp', form.Flag, 'force_sonmp',
			_('Send SONMP packets even if no SONMP peer detected'));

		o.default = '0';
		o.rmempty = true;
		o.depends('enable_sonmp', '1');
	},

	/** @private */
	populateOptions: function(s, data) {
		var o;

		s.tab('basic', _('Basic Settings'));
		this.populateBasicOptions(s, 'basic', data);

		s.tab('ifaces', _('Network Interfaces'));
		this.populateIfacesOptions(s, 'ifaces', data);

		s.tab('advanced', _('Advanced Settings'));
		this.populateAdvancedOptions(s, 'advanced', data);

		s.tab('protocols', _('Protocols Support'));
		this.populateProtocolsOptions(s, 'protocols', data);
	},

	render: function(data) {
		var m, s;

		m = new form.Map('lldpd', _('LLDPd Settings'),
			_('LLDPd is an implementation of IEEE 802.1ab') + ' ' +
			  '(<abbr title="Link Layer Discovery Protocol">LLDP</abbr>).' + ' ' +
			_('On this page you may configure LLDPd parameters.'));

		s = m.section(form.TypedSection, 'lldpd');
		s.addremove = false;
		s.anonymous = true;

		this.populateOptions(s, data);

		return m.render();
	},
});
