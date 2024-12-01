'use strict';
'require form';
'require view';
'require uci';
'require fs';
'require network';
'require tools.widgets as widgets'; 

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('basicstation')
		]);
	},

	render: function(data) {
		let m, s, o;

		/* General Settings */
		m = new form.Map('basicstation', _('General Settings'));
		
		/* Station Identity */
		s = m.section(form.NamedSection, 'station', 'station',
			_('Station Identity'));

		o = s.option(widgets.DeviceSelect, 'idGenIf',
			_('Interface for station ID generation'),
			_('Station ID is derived from the MAC address of the chosen interface'));
		o.filter = function(section_id, value) {
			var dev = this.devices.filter(function(dev) { return dev.getName() == value })[0];
			return (dev && dev.getMAC() != null && dev.getMAC() != '00:00:00:00:00:00');
		}
		o.nobridges = true;
		o.novirtual = true;
		o.noaliases = true;
		o.default = 'eth0';

		o.write = function(sid, value) {
			var path = "/sys/class/net/" + value + "/address";
			uci.set('basicstation', sid, 'idGenIf', value);
			uci.set('basicstation', sid, 'routerid', path);
		}

		o = s.option(form.Value, 'stationid', _('Station ID'),
			_('Click save and apply to generate station ID'));
		o.readonly = true;

		/* Authentication */
		s = m.section(form.NamedSection, 'auth', 'auth', 
			_('Authentication'));

		o = s.option(form.ListValue, 'cred', _('Credentials'), 
			_('Credentials for LNS (TC) or CUPS (CUPS)'));
		o.value('tc', _('TC'));
		o.value('cups', _('CUPS'));
		o.default = 'tc';

		o = s.option(form.ListValue, 'mode', _('Authentication mode'), 
			_('Authentication mode for server connection'));
		o.value('no', _('No Authentication'));
		o.value('server', _('TLS Server Authentication'));
		o.value('serverAndClient', _('TLS Server and Client Authentication'));
		o.value('serverAndClientToken', _('TLS Server Authentication and Client Token'));
		o.default = 'no';

		o = s.option(form.Value, 'addr', _('Server address'));
		o.optional = false;
		o.rmempty = false;
		o.placeholder = 'eu1.cloud.thethings.network';

		o = s.option(form.Value, 'port', _('Port'));
		o.optional = false;
		o.rmempty = false;
		o.datatype = 'uinteger';
		o.placeholder = '8887';

		o = s.option(form.Value, 'token', _('Authorization token'));
		o.optional = false;
		o.rmempty = false;
		o.depends({ mode: 'serverAndClientToken' });

		o = s.option(form.Value, 'key', _('Private station key'));
		o.optional = false;
		o.rmempty = false;
		o.depends({ mode: 'serverAndClient' });

		o = s.option(form.FileUpload, 'crt', _('Private station certificate'));
		o.optional = false;
		o.rmempty = false;
		o.depends({ mode: "serverAndClient" });

		o = s.option(form.FileUpload, 'trust', _('CA certificate'));
		o.optional = false;
		o.rmempty = false;
		o.depends({ mode: "no", "!reverse": true });
		
		/* Radio Configuration */
		s = m.section(form.NamedSection, 'sx130x', 'sx130x',
			_('Radio Configuration'));

		o = s.option(form.ListValue, 'comif', _('Communication interface'), 
			_('Currently only USB devices are supported'));
		o.value('usb', 'USB');
		o.default = 'usb';

		o = s.option(form.Value, 'devpath', _('Device path'),
			_('Device path of the LoRaWAN concentrator card'));
		o.optional = false;
		o.rmempty = false;
		o.placeholder = '/dev/ttyACM0';

		o = s.option(form.Flag, 'pps', _('PPS'),
			_('PPS (pulse per second) provided by GPS device or other source'));
		o.default = false

		o = s.option(form.Flag, 'public', _('Public network'),
			_('Public or private LoRaWAN network'));
		o.default = true;

		o = s.option(form.ListValue, 'clksrc', _('Clock source'),
			_('Radio to provide clock to Basicstation'));
		o.value('0', 'Radio 0');
		o.value('1', 'Radio 1');
		o.default = '0';

		var options = uci.sections('basicstation', 'rfconf');

		o = s.option(form.ListValue, 'radio0', _('Radio 0'),
			_('RF configuration for Radio 0'));
		for (var i = 0; i < options.length; i++) {
			var value = options[i]['.name'];
			o.value(value);
		}
		o.default = 'rfconf0';

		o = s.option(form.ListValue, 'radio1', _('Radio 1'),
			_('RF configuration for Radio 1'));
		for (var i = 0; i < options.length; i++) {
			var value = options[i]['.name'];
			o.value(value);
		}
		o.default = 'rfconf1';
		
		/* Logging */
		s = m.section(form.NamedSection, 'station','station', 
			_('Logging'));

		o = s.option(form.ListValue, 'logLevel', _('Level'), 
			_('Level to which messages are to be logged'));
		o.value('XDEBUG', 'xdebug');
		o.value('DEBUG', 'debug');
		o.value('VERBOSE', 'verbose');
		o.value('INFO', 'info');
		o.value('NOTICE', 'notice');
		o.value('WARNING', 'warning');
		o.value('ERROR', 'error');
		o.value('CRITICAL', 'critical');
		o.default = 'DEBUG';

		o = s.option(form.Value, 'logSize', _('Size'), 
			_('Maximum size of log file in MB'));
		o.value('1');
		o.value('2');
		o.value('3');
		o.value('4');
		o.default = '1';
		o.datatype = 'range(1,10)';

		o = s.option(form.Value, 'logRotate', _('Rotate'), 
			_('Number of old log files to be kept'));
		o.value('1');
		o.value('2');
		o.value('3');
		o.value('4');
		o.default = '1';
		o.datatype = 'range(1, 10)';
		
		return m.render();
	},
});
