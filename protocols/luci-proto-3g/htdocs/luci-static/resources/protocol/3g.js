'use strict';
'require rpc';
'require uci';
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
			if (list[i].name.match(/^tty[A-Z]/) || list[i].name.match(/^cdc-wdm/) || list[i].name.match(/^[0-9]+$/))
				rv.push(params.path + list[i].name);
		return rv.sort();
	}
});

network.registerPatternVirtual(/^3g-.+$/);

function write_keepalive(section_id, value) {
	var f_opt = this.map.lookupOption('_keepalive_failure', section_id),
	    i_opt = this.map.lookupOption('_keepalive_interval', section_id),
	    f = parseInt(f_opt?.[0]?.formvalue(section_id), 10),
	    i = parseInt(i_opt?.[0]?.formvalue(section_id), 10);

	if (isNaN(i))
		i = 1;

	if (isNaN(f))
		f = (i == 1) ? null : 5;

	if (f !== null)
		uci.set('network', section_id, 'keepalive', '%d %d'.format(f, i));
	else
		uci.unset('network', section_id, 'keepalive');
}

return network.registerProtocol('3g', {
	getI18n: function() {
		return _('UMTS/GPRS/EV-DO');
	},

	getIfname: function() {
		return this._ubus('l3_device') || '3g-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'comgt';
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
				return callFileList('/dev/tts/');
			}, this)).then(L.bind(function(devices) {
				for (var i = 0; i < devices.length; i++)
					this.value(devices[i]);
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		o = s.taboption('general', form.Value, 'service', _('Service Type'));
		o.value('', _('-- Please choose --'));
		o.value('umts', 'UMTS/GPRS');
		o.value('umts_only', _('UMTS only'));
		o.value('gprs_only', _('GPRS only'));
		o.value('evdo', 'CDMA/EV-DO');

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

		o = s.taboption('general', form.Value, 'dialnumber', _('Dial number'));
		o.placeholder = '*99***1#';

		if (L.hasSystemFeature('ipv6')) {
			o = s.taboption('advanced', form.ListValue, 'ppp_ipv6', _('Obtain IPv6 address'));
			o.ucioption = 'ipv6';
			o.value('auto', _('Automatic'));
			o.value('0', _('Disabled'));
			o.value('1', _('Manual'));
			o.default = 'auto';
		}

		o = s.taboption('advanced', form.Value, 'delay', _('Modem init timeout'), _('Maximum amount of seconds to wait for the modem to become ready'));
		o.placeholder = '10';
		o.datatype    = 'min(1)';

		o = s.taboption('advanced', form.Value, '_keepalive_failure', _('LCP echo failure threshold'), _('Presume peer to be dead after given amount of LCP echo failures, use 0 to ignore failures'));
		o.placeholder = '5';
		o.datatype    = 'uinteger';
		o.write       = write_keepalive;
		o.remove      = write_keepalive;
		o.cfgvalue = function(section_id) {
			var v = uci.get('network', section_id, 'keepalive');
			if (typeof(v) == 'string' && v != '') {
				var m = v.match(/^(\d+)[ ,]\d+$/);
				return m ? m[1] : v;
			}
		};

		o = s.taboption('advanced', form.Value, '_keepalive_interval', _('LCP echo interval'), _('Send LCP echo requests at the given interval in seconds, only effective in conjunction with failure threshold'));
		o.placeholder = '1';
		o.datatype    = 'and(uinteger,min(1))';
		o.write       = write_keepalive;
		o.remove      = write_keepalive;
		o.cfgvalue = function(section_id) {
			var v = uci.get('network', section_id, 'keepalive');
			if (typeof(v) == 'string' && v != '') {
				var m = v.match(/^\d+[ ,](\d+)$/);
				return m ? m[1] : v;
			}
		};

		o = s.taboption('advanced', form.Value, 'demand', _('Inactivity timeout'), _('Close inactive connection after the given amount of seconds, use 0 to persist connection'));
		o.placeholder = '0';
		o.datatype    = 'uinteger';
	}
});
