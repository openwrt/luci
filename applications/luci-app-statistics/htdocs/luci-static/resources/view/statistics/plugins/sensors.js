'use strict';
'require baseclass';
'require fs';
'require form';

var sensorTypes = [
	/^[0-9]+(?:\.[0-9]+)?v$/,									'voltage',
	/^(?:ain|in|vccp|vdd|vid|vin|volt|voltbatt|vrm)[0-9]*$/,	'voltage',
	/^(?:cpu_temp|remote_temp|temp)[0-9]*$/,					'temperature',
	/^(?:fan)[0-9]*$/,											'fanspeed',
	/^(?:humidity)[0-9]*$/,										'humidity',
	/^(?:curr)[0-9]*$/,											'current',
	/^(?:power)[0-9]*$/,										'power'
];

return baseclass.extend({
	title: _('Sensors Plugin Configuration'),
	description: _('The sensors plugin uses the Linux Sensors framework to gather environmental statistics.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Sensor', _('Sensor list'));
		o.rmempty = true;
		o.size = 18;
		o.depends('enable', '1');
		o.load = function(section_id) {
			return fs.exec_direct('/usr/sbin/sensors', ['-j'], 'json').then(L.bind(function(output) {
				for (var bus in output) {
					for (var sensor in output[bus]) {
						if (!L.isObject(output[bus][sensor]))
							continue;

						for (var j = 0; j < sensorTypes.length; j += 2) {
							if (sensor.match(sensorTypes[j])) {
								this.value('%s/%s-%s'.format(bus, sensorTypes[j + 1], sensor));
								break;
							}
						}
					}
				}

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var sensors = L.toArray(section.Sensor),
		    invert = section.IgnoreSelected == '1';

		if (invert && sensors.length)
			return N_(sensors.length, 'Monitoring all but one sensor', 'Monitoring all but %d sensors').format(sensors.length);
		else if (sensors.length)
			return N_(sensors.length, 'Monitoring one sensor', 'Monitoring %d sensors').format(sensors.length);
		else
			return _('Monitoring all sensors');
	}
});
