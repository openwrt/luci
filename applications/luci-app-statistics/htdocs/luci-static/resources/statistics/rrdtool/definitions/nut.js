/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('UPS'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var voltages_ac = {
			title: "%H: AC voltages on UPS \"%pi\"",
			vlabel: "V",
			number_format: "%5.1lfV",
			data: {
				instances: {
					voltage: [ "input", "output" ]
				},
				options: {
					voltage_output : { color: "00e000", title: "Output voltage", noarea: true, overlay: true },
					voltage_input  : { color: "ffb000", title: "Input voltage", noarea: true, overlay: true }
				}
			}
		};

		var voltages_dc = {
			title: "%H: Battery voltage on UPS \"%pi\"",
			vlabel: "V",
			number_format: "%5.1lfV",
			data: {
				instances: {
					voltage: [ "battery" ]
				},
				options: {
					voltage: { color: "0000ff", title: "Battery voltage", noarea: true, overlay: true }
				}
			}
		};

		var currents = {
			title: "%H: Current on UPS \"%pi\"",
			vlabel: "A",
			number_format: "%5.3lfA",
			data: {
				instances: {
					current: [ "battery", "output" ]
				},
				options: {
					current_output : { color: "00e000", title: "Output current", noarea: true, overlay: true },
					current_battery: { color: "0000ff", title: "Battery current", noarea: true, overlay: true }
				}
			}
		};

		var percentage = {
			title: "%H: Battery charge/load on UPS \"%pi\"",
			vlabel: "Percent",
			y_min: "0",
			y_max: "100",
			number_format: "%5.1lf%%",
			data: {
				instances: {
					percent: [ "charge", "load" ]
				},
				options: {
					percent_charge: { color: "00ff00", title: "Charge level", noarea: true, overlay: true },
					percent_load: { color: "ff0000", title: "Load", noarea: true, overlay: true }
				}
			}
		};

		/* Note: This is in ISO8859-1 for rrdtool. Welcome to the 20th century. */
		var temperature = {
			title: "%H: Battery temperature on UPS \"%pi\"",
			vlabel: "\u00b0C",
			number_format: "%5.1lf\u00b0C",
			data: {
				instances: {
					temperature: "battery"
				},
				options: {
					temperature_battery: { color: "ffb000", title: "Battery temperature", noarea: true }
				}
			}
		};

		var timeleft = {
			title: "%H: Time left on UPS \"%pi\"",
			vlabel: "Minutes",
			number_format: "%.1lfm",
			data: {
				instances: {
					timeleft: [ "battery" ]
				},
				options: {
					timeleft_battery: { color: "0000ff", title: "Time left", transform_rpn: "60,/", noarea: true }
				}
			}
		};

		var power = {
			title: "%H: Power on UPS \"%pi\"",
			vlabel: "Power",
			number_format: "%5.1lf%%",
			data: {
				instances: {
					power: [ "ups" ]
				},
				options: {
					power_ups: { color: "00ff00", title: "Power level"  }
				}
			}
		};

		var frequencies = {
			title: "%H: Frequencies on UPS \"%pi\"",
			vlabel: "Hz",
			number_format: "%5.1lfHz",
			data: {
				instances: {
					frequency: [ "input", "output" ]
				},
				options: {
					frequency_output : { color: "00e000", title: "Output frequency", noarea: true, overlay: true },
					frequency_input  : { color: "ffb000", title: "Input frequency", noarea: true, overlay: true }
				}
			}
		};

		return [ voltages_ac, voltages_dc, currents, percentage, temperature, timeleft, power, frequencies ];
	}
});
