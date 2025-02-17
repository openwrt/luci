'use strict';
'require fs';
'require form';
'require network';
'require modemmanager_helper as helper';

network.registerPatternVirtual(/^mobiledata-.+$/);
network.registerErrorCode('MM_CONNECT_FAILED', _('Connection attempt failed.'));
network.registerErrorCode('MM_CONNECT_IN_PROGRESS', _('Modem connection in progress. Please wait. This process will timeout after 2 minutes.'));
network.registerErrorCode('DEVICE_NOT_MANAGED', _('Device not managed by ModemManager.'));
network.registerErrorCode('INVALID_BEARER_LIST', _('Invalid bearer list. Possibly too many bearers created.  This protocol supports one and only one bearer.'));
network.registerErrorCode('UNKNOWN_METHOD', _('Unknown and unsupported connection method.'));
network.registerErrorCode('DISCONNECT_FAILED', _('Disconnection attempt failed.'));
network.registerErrorCode('MM_INVALID_ALLOWED_MODES_LIST', _('Unable to set allowed mode list.'));
network.registerErrorCode('MM_NO_PREFERRED_MODE_CONFIGURED', _('No preferred mode configuration found.'));
network.registerErrorCode('MM_NO_ALLOWED_MODE_CONFIGURED', _('No allowed mode configuration found.'));
network.registerErrorCode('MM_FAILED_SETTING_PREFERRED_MODE', _('Unable to set preferred mode.'));

return network.registerProtocol('modemmanager', {
	getI18n: function() {
		return _('ModemManager');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'modemmanager-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'modemmanager';
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
		var dev = this.getL3Device() || this.getDevice(), o;

		o = s.taboption('general', form.ListValue, '_modem_device', _('Modem device'));
		o.ucioption = 'device';
		o.rmempty = false;
		o.load = function(section_id) {
			return helper.getModems().then(L.bind(function(devices) {
				for (var i = 0; i < devices.length; i++) {
					var generic = devices[i].modem.generic;
					this.value(generic.device,
						'%s - %s'.format(generic.manufacturer, generic.model));
				}
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

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

		o = s.taboption('general', form.DynamicList, 'allowedauth', _('Authentication Type'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('mschap', 'MSCHAP');
		o.value('mschapv2', 'MSCHAPv2');
		o.value('eap', 'EAP');
		o.value('', _('None'));
		o.default = 'none';

		o = s.taboption('general', form.ListValue, 'allowedmode', _('Allowed network technology'),
			_('Setting the allowed network technology.'));
		o.value('2g');
		o.value('3g');
		o.value('3g|2g');
		o.value('4g');
		o.value('4g|2g');
		o.value('4g|3g');
		o.value('4g|3g|2g');
		o.value('5g');
		o.value('5g|2g');
		o.value('5g|3g');
		o.value('5g|3g|2g');
		o.value('5g|4g');
		o.value('5g|4g|2g');
		o.value('5g|4g|3g');
		o.value('5g|4g|3g|2g');
		o.value('',_('any'));
		o.default = '';

		o = s.taboption('general', form.ListValue, 'preferredmode', _('Preferred network technology'),
			_('Setting the preferred network technology.'));
		o.value('2g');
		o.value('3g');
		o.value('4g');
		o.value('5g');
		o.value('none', _('None'));
		o.depends('allowedmode','3g|2g');
		o.depends('allowedmode','4g|2g');
		o.depends('allowedmode','4g|3g');
		o.depends('allowedmode','4g|3g|2g');
		o.depends('allowedmode','5g|2g');
		o.depends('allowedmode','5g|3g');
		o.depends('allowedmode','5g|3g|2g');
		o.depends('allowedmode','5g|4g');
		o.depends('allowedmode','5g|4g|2g');
		o.depends('allowedmode','5g|4g|3g');
		o.depends('allowedmode','5g|4g|3g|2g');

		o = s.taboption('general', form.Value, 'username', _('PAP/CHAP username'));
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'both');

		o = s.taboption('general', form.Value, 'password', _('PAP/CHAP password'));
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'both');
		o.password = true;

		o = s.taboption('general', form.ListValue, 'iptype', _('IP Type'));
		o.value('ipv4v6', _('IPv4/IPv6 (both - defaults to IPv4)'))
		o.value('ipv4', _('IPv4 only'));
		o.value('ipv6', _('IPv6 only'));
		o.default = 'ipv4v6';

		o = s.taboption('advanced', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = dev ? (dev.getMTU() || '1500') : '1500';
		o.datatype    = 'max(9200)';

		o = s.taboption('general', form.Value, 'signalrate', _('Signal Refresh Rate'), _("In seconds"));
		o.datatype = 'uinteger';

		s.taboption('general', form.Value, 'metric', _('Gateway metric'));

		s.taboption('advanced', form.Flag, 'debugmode', _('Enable Debugmode'));

		o = s.taboption('advanced', form.ListValue, 'loglevel', _('Log output level'));
		o.value('ERR', _('Error'))
		o.value('WARN', _('Warning'));
		o.value('INFO', _('Info'));
		o.value('DEBUG', _('Debug'));
		o.default = 'ERR';

		o = s.taboption('general', form.ListValue, 'init_epsbearer', _('Initial EPS Bearer'),
		_('none: Do not set an initial EPS bearer (default behaviour)') + '<br/>' +
		_('default: Use the configuration options above (APN, IP Type, ...).') + '<br/>' +
		_('custom: Use different options when establishing a connection (these options are prefixed with %s).').format('<code>init_</code>'));
		o.value('', _('none'));
		o.value('default', 'default');
		o.value('custom', 'custom');
		o.default = '';

		o = s.taboption('general', form.Value, 'init_apn', _('Initial EPS Bearer APN'));
		o.depends('init_epsbearer', 'custom');
		o.default = '';

		o = s.taboption('general', form.ListValue, 'init_allowedauth', _('Initial EPS Bearer Authentication Type'));
		o.depends('init_epsbearer', 'custom');
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('mschap', 'MSCHAP');
		o.value('mschapv2', 'MSCHAPv2');
		o.value('eap', 'EAP');
		o.value('', _('None'));
		o.default = '';

		o = s.taboption('general', form.Value, 'init_username', _('Initial EPS Bearer Username'));
		o.depends('init_allowedauth', 'pap');
		o.depends('init_allowedauth', 'chap');
		o.depends('init_allowedauth', 'mschap');
		o.depends('init_allowedauth', 'mschapv2');
		o.depends('init_allowedauth', 'eap');
		o.default = '';

		o = s.taboption('general', form.Value, 'init_password', _('Initial EPS Bearer Password'));
		o.depends('init_allowedauth', 'pap');
		o.depends('init_allowedauth', 'chap');
		o.depends('init_allowedauth', 'mschap');
		o.depends('init_allowedauth', 'mschapv2');
		o.depends('init_allowedauth', 'eap');
		o.default = '';
		o.password = true;

		o = s.taboption('general', form.ListValue, 'init_iptype', _('Initial EPS Bearer IP Type'));
		o.depends('init_epsbearer', 'custom');
		o.value('ipv4v6', _('IPv4/IPv6 (both - defaults to IPv4)'))
		o.value('ipv4', _('IPv4 only'));
		o.value('ipv6', _('IPv6 only'));
		o.default = 'ipv4v6';
	}
});
