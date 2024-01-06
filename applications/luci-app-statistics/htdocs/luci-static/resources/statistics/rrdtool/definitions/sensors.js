/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Sensors'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var rv = [];
		var types = graph.dataTypes(host, plugin, plugin_instance);

		if (types.indexOf('temperature') > -1) {
			rv.push({
				per_instance: true,
				title: "%H: %pi - %di",
				vlabel: "\xb0C",
				number_format: "%4.1lf\xb0C",
				data: {
					types: [ "temperature" ],
					options: {
						temperature__value: {
							color: "ff0000",
							title: "Temperature"
						}
					}
				}
			});
		}
		if (types.indexOf('humidity') > -1) {
			rv.push({
				per_instance: true,
				title: "%H: %pi - %di",
				vlabel: "%RH",
				number_format: "%4.1lf %%RH",
				data: {
					types: [ "humidity" ],
					options: {
						humidity__value: {
							color: "0000ff",
							title: "Humidity"
						}
					}
				}
			});
		}
		if (types.indexOf('voltage') > -1) {
			rv.push({
				per_instance: true,
				title: "%H: %pi - %di",
				vlabel: "V",
				number_format: "%4.1lf V",
				data: {
					types: [ "voltage" ],
					options: {
						voltage__value: {
							color: "0000ff",
							title: "Voltage"
						}
					}
				}
			});
		}
		if (types.indexOf('current') > -1) {
			rv.push({
				per_instance: true,
				title: "%H: %pi - %di",
				vlabel: "A",
				number_format: "%4.1lf A",
				data: {
					types: [ "current" ],
					options: {
						current__value: {
							color: "00ff00",
							title: "Current"
						}
					}
				}
			});
		}
		if (types.indexOf('power') > -1) {
			rv.push({
				per_instance: true,
				title: "%H: %pi - %di",
				vlabel: "W",
				number_format: "%4.1lf W",
				data: {
					types: [ "power" ],
					options: {
						power__value: {
							color: "ff0000",
							title: "Power"
						}
					}
				}
			});
		}
		if (types.indexOf('fanspeed') > -1) {
			rv.push({
				per_instance: true,
				title: "%H: %pi - %di",
				vlabel: "rpm",
				number_format: "%4lf rpm",
				data: {
					types: [ "fanspeed" ],
					options: {
						fanspeed__value: {
							color: "0000ff",
							title: "Fan speed"
						}
					}
				}
			});
		}

		return rv;
	}
});
