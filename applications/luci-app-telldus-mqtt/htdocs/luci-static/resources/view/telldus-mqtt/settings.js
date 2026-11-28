'use strict';
'require view';
'require form';
'require uci';
'require telldus-mqtt.common as common';

// Settings page: the main section of /etc/config/telldus-mqtt.
// Empty fields are removed: the generator then uses its default.

return view.extend({
	load: function() {
		return Promise.all([
			common.getStatus(),
			uci.load(common.CONFIG)
		]);
	},

	render: function(data) {
		var result = data[0];
		var m, s, o;

		// The package installs the main section. Make it if it is missing.
		if (!uci.get(common.CONFIG, 'main'))
			uci.add(common.CONFIG, 'main', 'main');

		m = new form.Map(common.CONFIG, _('Telldus MQTT settings'),
			_('The service restarts with the new settings after Save & Apply.'));

		s = m.section(form.NamedSection, 'main', 'main');
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'), _('Start the service.'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Value, 'host', _('Broker address'),
			_('Host name or IP address of the MQTT broker. Default: 127.0.0.1 (this router).'));
		o.datatype = 'host';
		o.placeholder = '127.0.0.1';
		o.rmempty = true;

		o = s.option(form.Value, 'port', _('Broker port'), _('Default: 1883.'));
		o.datatype = 'port';
		o.placeholder = '1883';
		o.rmempty = true;

		o = s.option(form.Value, 'user', _('User name'), _('Empty if the broker needs no login.'));
		o.rmempty = true;

		o = s.option(form.Value, 'pass', _('Password'));
		o.password = true;
		o.rmempty = true;

		o = s.option(form.Value, 'topic_prefix', _('Topic prefix'),
			_('The start of the MQTT topics. With the prefix "home", a sensor with the name "Garage" gets the topic "home/Garage". A device with a typed topic keeps its topic. Default: home.'));
		o.placeholder = 'home';
		o.rmempty = true;
		o.validate = function(section_id, value) {
			if (/[+#]/.test(value || ''))
				return _('Do not use + or #.');
			return true;
		};

		o = s.option(form.Value, 'offline_seconds', _('Offline time (seconds)'),
			_('A sensor is offline when it sends nothing for this time. 0 = never offline. Default: 600.'));
		o.datatype = 'uinteger';
		o.placeholder = '600';
		o.rmempty = true;

		o = s.option(form.Flag, 'manage_switches', _('Manage switches'),
			_('On: the switches on the Switches page are the devices of telldusd (/etc/tellstick.conf). Devices that are only in tellstick.conf are removed. Usually the package turns this on when it copies the devices of tellstick.conf.'));
		o.rmempty = false;
		o.default = '0';

		// The broker itself is not set up here
		var hint = [ _('To run an MQTT broker on this router, install mosquitto and luci-app-mosquitto.') ];
		if (result.mosquitto && result.mosquitto.luci)
			hint = [ _('Set up the MQTT broker of this router:') + ' ',
				E('a', { 'href': L.url('admin/services/mosquitto') }, _('Mosquitto')) ];

		return m.render().then(function(node) {
			return E('div', {}, [ node, E('p', { 'class': 'cbi-section-descr' }, hint) ]);
		});
	}
});
