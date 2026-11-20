'use strict';
'require rpc';
'require form';
'require network';

var callFileList = rpc.declare({
	object: 'file',
	method: 'list',
	params: [ 'path' ],
	expect: { entries: [] },
	filter: function(list, params) {
		var rv = [];
		for (var i = 0; i < list.length; i++)
			if (list[i].name.match(/^ttyUSB/) || list[i].name.match(/^cdc-wdm/))
				rv.push(params.path + list[i].name);
		return rv.sort();
	}
});

network.registerPatternVirtual(/^ncm-.+$/);
network.registerErrorCode('CONFIGURE_FAILED', _('Failed to configure modem'));
network.registerErrorCode('CONNECT_FAILED',  _('Failed to connect'));
network.registerErrorCode('DISCONNECT_FAILED', _('Failed to disconnect'));
network.registerErrorCode('FINALIZE_FAILED',  _('Finalizing failed'));
network.registerErrorCode('GETINFO_FAILED',  _('Failed to get modem information'));
network.registerErrorCode('INITIALIZE_FAILED', _('Failed to initialize modem'));
network.registerErrorCode('NO_DEVICE',     _('No control device specified'));
network.registerErrorCode('NO_IFACE',     _('The interface could not be found'));
network.registerErrorCode('PIN_FAILED',    _('Unable to verify PIN'));
network.registerErrorCode('SETMODE_FAILED',  _('Failed to set operating mode'));
network.registerErrorCode('UNSUPPORTED_MODEM', _('Unsupported modem'));

return network.registerProtocol('ncm', {
	getI18n: function() {
		return _('NCM');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'wan';
	},

	getPackageName: function() {
		return 'comgt-ncm';
	},

	isFloating: function() {
		return true;
	},

	isVirtual: function() {
		return true;
	},

	getDevices: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.Value, '_modem_device', _('Modem device'));
		o.ucioption = 'device';
		o.rmempty = false;
		o.load = function(section_id) {
			return callFileList('/dev/').then(L.bind(function(devices) {
				for (var i = 0; i < devices.length; i++)
					this.value(devices[i]);
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		o = s.taboption('general', form.Value, 'mode', _('Network Mode'));
		o.value('', _('Modem default'));
		o.value('preferlte', _('Prefer LTE'));
		o.value('preferumts', _('Prefer UMTS'));
		o.value('lte', 'LTE');
		o.value('umts', 'UMTS/GPRS');
		o.value('gsm', _('GPRS only'));
		o.value('auto', _('auto'));

		o = s.taboption('general', form.ListValue, 'pdptype', _('IP Protocol'));
		o.default = 'IP';
		o.value('IP', _('IPv4'));
		o.value('IPV4V6', _('IPv4+IPv6'));
		o.value('IPV6', _('IPv6'));

		o = s.taboption('general', form.Value, 'apn', _('APN'));
		o.validate = function(section_id, value) {
			if (value == null || value == '')
				return true;

			if (!/^[a-zA-Z0-9\-.]*[a-zA-Z0-9]$/.test(value))
					return _('Invalid APN provided');

			return true;
		};

		o = s.taboption('general', form.Value, 'pincode', _('PIN'));
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';

		s.taboption('general', form.Value, 'username', _('PAP/CHAP username'));

		o = s.taboption('general', form.Value, 'password', _('PAP/CHAP password'));
		o.password = true;

		if (L.hasSystemFeature('ipv6')) {
			o = s.taboption('advanced', form.ListValue, 'ppp_ipv6', _('Obtain IPv6 address'));
			o.ucioption = 'ipv6';
			o.value('auto', _('Automatic'));
			o.value('0', _('Disabled'));
			o.value('1', _('Manual'));
			o.default = 'auto';
		}

		o = s.taboption('advanced', form.Value, 'delay', _('Modem init timeout'), _('Amount of seconds to wait for the modem to become ready'));
		o.placeholder = '0';
		o.datatype  = 'min(0)';
	}
});
