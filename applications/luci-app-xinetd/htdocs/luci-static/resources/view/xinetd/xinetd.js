'use strict';
'require uci';
'require ui';
'require form';
'require view';
'require fs';
'require tools.widgets as widgets';

function validateEmpty(section, value) {
	if (value) {
		return true;
	}
	else {
		return _('Expecting: non-empty value');
	}
}

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('xinetd', _('Xinetd Settings'), _('Here you can configure Xinetd services'));

		s = m.section(form.GridSection, 'service');
		s.modaltitle = _('Service definitions to be used by Xinetd');
		s.tabbed = true;
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add new service entry');

		// The following dummy values are used to show the table overview without the hint texts
		o = s.option(form.DummyValue, 'name', _('Servicename'));
		o.modalonly = false;

		o = s.option(form.DummyValue, 'protocol', _('Protocol'));
		o.modalonly = false;

		o = s.option(form.DummyValue, 'port', _('Port'));
		o.modalonly = false;

		o = s.option(form.DummyValue, 'type', _('Type'));
		o.modalonly = false;

		o = s.option(form.DummyValue, 'server', _('Server'));
		o.modalonly = false;

		o = s.option(form.DummyValue, 'flags', _('IPv6'));
		o.cfgvalue = function(section) {
			return (uci.get('xinetd', section, 'flags') == "IPv6") ? _("yes") : _("no");
		};
		o.modalonly = false;

		o = s.option(form.DummyValue, 'redirect', _('Redirect'));
		o.modalonly = false;

		o = s.option(form.DummyValue, 'disable', _('Enabled'));
		o.cfgvalue = function(section) {
			return (uci.get('xinetd', section, 'disable') == "no") ? _("yes") : _("no");
		};
		o.modalonly = false;

		s.tab('basic', _('Basic Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('access', _('Access Control'));

		// Now here follow the "real" values to be set in the modal (with the hint texts)

		// Basic settings
		o = s.taboption('basic', form.Value, 'name', _('Servicename'), _('Name for the service, if INTERNAL from /etc/services'));
		o.datatype = 'string';
		o.rmempty = false;
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (/^[A-Za-z0-9-_]*$/.test(value) == true)
				return true;
			return _('Invalid character');
		};

		o = s.taboption('basic', form.Flag, 'disable', _('Enabled'), _('Enable or Disable this service'));
		o.enabled  = 'no';
		o.disabled = 'yes';
		o.default  = o.enabled;
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('basic', form.Flag, 'flags', _('IPv6'), _('Listen on IPv6 additional'));
		o.enabled  = 'IPv6';
		o.disabled = 'IPv4';
		o.default  = o.disabled;
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('basic', form.ListValue, 'type', _('Type'), _('Type of service'));
		o.default = 'UNLISTED';
		o.value('INTERNAL', _('INTERNAL'));
		o.value('UNLISTED', _('UNLISTED'));
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('basic', form.Value, 'id', _('Identification'), _('Required if a services can use tcp and udp.'));
		o.datatype = 'string';
		o.value('time-stream');
		o.value('time-dgram');
		o.value('daytime-stream');
		o.value('daytime-dgram');
		o.depends('type', 'INTERNAL');
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (value.length == 0 || /^[A-Za-z0-9_-]+$/.test(value) == true)
				return true;
			return _('Invalid character');
		};

		o = s.taboption('basic', form.Value, 'port', _('Port'), _('The port used for this service, valid range: 0 - 65535'));
		o.datatype = 'port';
		o.depends('type', 'UNLISTED');
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('basic', form.ListValue, 'protocol', _('Protocol'), _('The protocol to be used for this service'));
		o.default = 'tcp';
		o.value('tcp', _('TCP'));
		o.value('udp', _('UDP'));
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('basic', form.ListValue, 'socket_type', _('Socket type'), _('The type of the socket used for this service'));
		o.default = 'stream';
		o.value('stream', _('stream-based service'));
		o.value('dgram', _('datagram-based service'));
		o.value('raw', _('direct access to IP service'));
		o.value('seqpacket', _('sequential datagram transmission service'));
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('basic', form.Value, 'redirect', _('Redirect'), _('Redirect incoming TCP requests to this IP address:port.'));
		o.datatype = 'ipaddrport(1)';
		o.modalonly = true;

		o = s.taboption('basic', form.Value, 'server', _('Server'), _('Complete path to the executable server file'));
		o.datatype = 'string';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('type', 'UNLISTED');
		o.validate = validateEmpty;
		o.write = function(section, value) {
			return fs.stat(value).then(function(res) {
				if (res.type == "file") {
					uci.set('xinetd', section, 'server', value);
					return;
				} else {
					ui.addNotification(null, E('p', _('Service "%s": Invalid server file "%s"').format(section, value)), 'danger');
				}
			}).catch(function(err) {
				ui.addNotification(null, E('p', _('Service "%s": No access to server file "%s" (%s)').format(section, value, err.message)), 'danger');
				return;
			});
		};

		o = s.taboption('basic', form.Value, 'server_args', _('Server arguments'), _('Additional arguments passed to the server. There is no validation of this input.'));
		o.datatype = 'string';
		o.modalonly = true;
		o.depends('type', 'UNLISTED');

		// Advanced settings
		o = s.taboption('advanced', widgets.UserSelect, 'user', _('User (UID)'), _('User ID for the server process for this service'));
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'wait', _('Threading behaviour'), _('Selection of the threading for this service'));
		o.default = 'no';
		o.value('yes', _('Single-Threaded Service'));
		o.value('no', _('Multi-Threaded Service'));
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.MultiValue, 'log_on_success', _('Log on success'), _('Informations that should be logged for this service in case of successful connection'));
		o.value('PID', _('Server PID'));
		o.value('HOST', _('Remote host address '));
		o.value('USERID', _('User ID of the remote user'));
		o.value('EXIT', _('Server exited along with the exit status'));
		o.value('DURATION', _('Duration of a service session'));
		o.value('TRAFFIC', _('Total bytes in and out for a redirected service'));
		o.modalonly = true;

		o = s.taboption('advanced', form.MultiValue, 'log_on_failure', _('Log on failure'), _('Informations that should be logged for this service in case of a failed connection'));
		o.value('HOST', _('Remote host address '));
		o.value('USERID', _('User ID of the remote user'));
		o.value('ATTEMPT', _('Failed attempts'));
		o.modalonly = true;

		// Access Control
		o = s.taboption('access', form.DynamicList, 'only_from', _('Allowed hosts'), _('List of allowed hosts to access this service'));
		o.datatype = 'or(ipaddr,ip6addr)';
		o.cast = 'string';
		o.modalonly = true;

		o = s.taboption('access', form.DynamicList, 'no_access', _('Forbidden hosts'), _('List of forbidden hosts to access this service'));
		o.datatype = 'or(ipaddr,ip6addr)';
		o.cast = 'string';
		o.modalonly = true;

		o = s.taboption('access', form.Value, 'instances', _('Number of instances'), _('Number of simultaneously running servers for this service. Argument is any number or the keyword \'UNLIMITED\''));
		o.datatype = 'or("UNLIMITED", uinteger)';
		o.value('UNLIMITED', 'UNLIMITED');
		o.modalonly = true;

		o = s.taboption('access', form.Value, 'cps', _('Connection limit'), _('Takes two arguments: [Number of connections per second] [Number of seconds to reenable service]'));
		o.datatype = 'string';
		o.placeholder = '50 10';
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (value.length == 0 || /^([0-9]+\s+[0-9]+$)/.test(value) == true)
				return true;
			return _('Expected \'[Number] [Number]\'');
		};

		o = s.taboption('access', form.DynamicList, 'access_times', _('Access times'), _('Time intervals within service is available (Format hh:mm-hh:mm)'));
		o.datatype = 'string';
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (value.length == 0 || /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value) == true)
				return true;
			return _('Expected \'hh:mm-hh:mm\'');
		};

		return m.render();
	}
});
