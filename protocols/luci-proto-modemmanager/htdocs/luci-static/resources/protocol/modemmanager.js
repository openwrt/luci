'use strict';
'require fs';
'require form';
'require network';

function getModemList() {
	return fs.exec_direct('/usr/bin/mmcli', [ '-L' ]).then(function(res) {
		var lines = (res || '').split(/\n/),
		    tasks = [];

		for (var i = 0; i < lines.length; i++) {
			var m = lines[i].match(/\/Modem\/(\d+)/);
			if (m)
				tasks.push(fs.exec_direct('/usr/bin/mmcli', [ '-m', m[1] ]));
		}

		return Promise.all(tasks).then(function(res) {
			var modems = [];

			for (var i = 0; i < res.length; i++) {
				var man = res[i].match(/manufacturer: ([^\n]+)/),
				    mod = res[i].match(/model: ([^\n]+)/),
				    dev = res[i].match(/device: ([^\n]+)/);

				if (dev) {
					modems.push({
						device:       dev[1].trim(),
						manufacturer: (man ? man[1].trim() : '') || '?',
						model:        (mod ? mod[1].trim() : '') || dev[1].trim()
					});
				}
			}

			return modems;
		});
	});
}

network.registerPatternVirtual(/^mobiledata-.+$/);
network.registerErrorCode('MM_CONNECT_FAILED', _('Connection attempt failed.'));
network.registerErrorCode('MM_DISCONNECT_IN_PROGRESS', _('Modem disconnection in progress. Please wait.'));
network.registerErrorCode('MM_CONNECT_IN_PROGRESS', _('Modem connection in progress. Please wait. This process will timeout after 2 minutes.'));
network.registerErrorCode('MM_TEARDOWN_IN_PROGRESS', _('Modem bearer teardown in progress.'));
network.registerErrorCode('MM_MODEM_DISABLED', _('Modem is disabled.'));
network.registerErrorCode('DEVICE_NOT_MANAGED', _('Device not managed by ModemManager.'));
network.registerErrorCode('INVALID_BEARER_LIST', _('Invalid bearer list. Possibly too many bearers created.  This protocol supports one and only one bearer.'));
network.registerErrorCode('UNKNOWN_METHOD', _('Unknown and unsupported connection method.'));
network.registerErrorCode('DISCONNECT_FAILED', _('Disconnection attempt failed.'));

return network.registerProtocol('modemmanager', {
	getI18n: function() {
		return _('ModemManager');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'modemmanager-%s'.format(this.sid);
	},

	getOpkgPackage: function() {
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
			return getModemList().then(L.bind(function(devices) {
				for (var i = 0; i < devices.length; i++)
					this.value(devices[i].device,
						'%s - %s'.format(devices[i].manufacturer, devices[i].model));
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		s.taboption('general', form.Value, 'apn', _('APN'));
		s.taboption('general', form.Value, 'pincode', _('PIN'));

		o = s.taboption('general', form.ListValue, 'auth', _('Authentication Type'));
		o.value('both', _('PAP/CHAP (both)'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('none', _('None'));
		o.default = 'none';

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
	}
});
