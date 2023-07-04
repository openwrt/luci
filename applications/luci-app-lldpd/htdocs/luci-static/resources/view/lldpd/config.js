/*
 * Copyright (c) 2020 Tano Systems LLC. All Rights Reserved.
 * Author: Anton Kikin <a.kikin@tano-systems.com>
 */

'use strict';
'require rpc';
'require form';
'require lldpd';
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
			uci.load('lldpd')
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

		// Service enable/disable
		o = s.taboption(tab, form.Flag, 'enabled', _('Enable service'));
		o.optional = false;
		o.rmempty = false;

		o.cfgvalue = function() {
			return serviceEnabled ? this.enabled : this.disabled;
		};

		o.write = function(section_id, value) {
			uci.set('mstpd', section_id, 'enabled', value);

			if (value == '1') {
				// Enable and start
				return callInitAction('lldpd', 'enable').then(function() {
					return callInitAction('lldpd', 'start');
				});
			}
			else {
				// Stop and disable
				return callInitAction('lldpd', 'stop').then(function() {
					return callInitAction('lldpd', 'disable');
				});
			}
		};

		// System description
		o = s.taboption(tab, form.Value, 'lldp_description',
			_('System description'),
			_('Override system description with the provided description.'));

		o.placeholder = 'System description';

		// System hostname
		o = s.taboption(tab, form.Value, 'lldp_hostname',
			_('System hostname'),
			_('Override system hostname with the provided value.'));

		o.placeholder = 'System hostname';

		// Host location
		o = s.taboption(tab, form.Value, 'lldp_location',
			_('Host location'),
			_('Override the location of the host announced by lldp.'));

		o.placeholder = 'address country EU';

		// Platform
		o = s.taboption(tab, form.Value, 'lldp_platform',
			_('System platform description'),
			_('Override the platform description with the provided value. ' +
			  'The default description is the kernel name (Linux).'));

		o.placeholder = 'System platform description';

		// Management addresses of this system
		o = s.taboption(tab, form.Value, 'lldp_mgmt_ip',
			_('Management addresses of this system'),
			_('Specify the management addresses of this system. ' +
			  'If not specified, the first IPv4 and the first ' +
			  'IPv6 are used. If an exact IP address is provided, it is used ' +
			  'as a management address without any check. If you want to ' +
			  'blacklist IPv6 addresses, you can use <code>!*:*</code>. ' +
			  'See more details about available patterns ' +
			  '<a href=\"https://vincentbernat.github.io/lldpd/usage.html\">here</a>.'));

		o.placeholder = 'Management addresses';

		// LLDP tx interval
		o = s.taboption(tab, form.Value, 'lldp_tx_interval',
			_('Transmit delay'),
			_('The transmit delay is the delay between two ' +
			  'transmissions of LLDP PDU. The default value ' +
			  'is 30 seconds.'));

		o.datatype = 'uinteger';
		o.default = 30;
		o.placeholder = 30;
		o.rmempty = false;

		o.validate = function(section_id, value) {
			if (value != parseInt(value))
				return _('Must be a number');
			else if (value <= 0)
				return _('Transmit delay must be greater than 0');
			return true;
		};

		// LLDP tx hold
		o = s.taboption(tab, form.Value, 'lldp_tx_hold',
			_('Transmit hold value'),
			_('This value is used to compute the TTL of transmitted ' +
			  'packets which is the product of this value and of the ' +
			  'transmit delay. The default value is 4 and therefore ' +
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
			_('Enable receive-only mode'),
			_('With this option, LLDPd will not send any frames. ' +
			  'It will only listen to neighbors.'));

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

		// Interfaces to listen on
		o = s.taboption(tab, widgets.DeviceSelect, 'interface',
			_('Network interfaces'),
			_('Specify which interface to listen and send LLDPDU to. ' +
			  'If no interfaces is specified, LLDPd will use all available physical interfaces.'));

		o.nobridges = true;
		o.rmempty   = true;
		o.multiple  = true;
		o.nocreate  = true;
		o.noaliases = true;
		o.networks  = null;

		// ChassisID interfaces
		o = s.taboption(tab, widgets.DeviceSelect, 'cid_interface',
			_('Network interfaces for chassis ID computing'),
			_('Specify which interfaces to use for computing chassis ID. ' +
			  'If no interfaces is specified, all interfaces are considered. ' +
			  'LLDPd will take the first MAC address from all the considered ' +
			  'interfaces to compute the chassis ID.'));

		o.nobridges = false;
		o.rmempty   = true;
		o.multiple  = true;
		o.nocreate  = true;
		o.noaliases = true;
		o.networks  = null;
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
		// **Note**: lldpd is compiled in OpenWrt without SNMP support by default. Setting this action will then cause the lldpd daemon to stop starting and thus lldpd will stop working. To fix this, the value must then be deleted and lldpd restarted.
		// o = s.taboption(tab, form.Value, 'agentxsocket',
		// 	_('SNMP agentX socket path'),
		// 	_('If the path to the socket is set, then LLDPd will enable an ' +
		// 	  'SNMP subagent using AgentX protocol. This allows you to get ' +
		// 	  'information about local system and remote systems through SNMP.'));

		// o.rmempty = true;
		// o.placeholder = '/var/run/agentx.sock';
		// o.default = '';

		// LLDP class
		o = s.taboption(tab, form.ListValue, 'lldp_class',
			_('LLDP-MED device class'));

		o.value('1', _('Generic Endpoint (Class I)'));
		o.value('2', _('Media Endpoint (Class II)'));
		o.value('3', _('Communication Device Endpoints (Class III)'));
		o.value('4', _('Network Connectivity Device (Class IV)'));

		o.default = '4';

		// LLDP-MED inventory TLV transmission (-i)
		o = s.taboption(tab, form.Flag, 'lldpmed_no_inventory',
			_('Disable LLDP-MED inventory TLV transmission'),
			_('LLDPd will still receive (and publish using SNMP if enabled) ' +
			  'those LLDP-MED TLV but will not send them. Use this option ' +
			  'if you don\'t want to transmit sensible information like serial numbers.'));

		o.default = '0';

		// Disable advertising of kernel release, version and machine. (-k)
		o = s.taboption(tab, form.Flag, 'lldp_no_version',
			_('Disable advertising of kernel release, version and machine'),
			_('Kernel name (ie: Linux) will still be shared, and Inventory ' +
			  'software version will be set to \'Unknown\'.'));

		o.default = '0';

		// Filter neighbors (-H)
		o = s.taboption(tab, lldpd.cbiFilterSelect, 'filter',
			_('Specify the behaviour when detecting multiple neighbors'),
			_('The default filter is 15. For more details see \"FILTERING NEIGHBORS\" section ' +
			  '<a href=\"https://vincentbernat.github.io/lldpd/usage.html\">here</a>.'));

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
			_('The destination MAC address used to send LLDPDU'),
			_('The destination MAC address used to send LLDPDU allows an agent ' +
			  'to control the propagation of LLDPDUs. By default, the ' +
			  '<code>01:80:c2:00:00:0e</code> MAC address is used and limit the propagation ' +
			  'of the LLDPDU to the nearest bridge.'));

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
			_('Force to send LLDP packets'),
			_('Force to send LLDP packets even when there is no LLDP peer ' +
			  'detected but there is a peer speaking another protocol detected. ' +
			  'By default, LLDP packets are sent when there is a peer speaking ' +
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
			_('LLDPd is a implementation of IEEE 802.1ab ' +
			  '(<abbr title=\"Link Layer Discovery Protocol\">LLDP</abbr>).') +
			_('On this page you may configure LLDPd parameters.'));

		s = m.section(form.TypedSection, 'lldpd');
		s.addremove = false;
		s.anonymous = true;

		this.populateOptions(s, data);

		return m.render();
	},
});
