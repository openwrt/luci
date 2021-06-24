/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('APC UPS'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var rv = [];

		/*
		 * Types and instances supported by APC UPS
		 * e.g. ups_types -> [ 'timeleft', 'charge', 'percent', 'voltage' ]
		 * e.g. ups_inst['voltage'] -> [ 'input', 'battery' ]
		 */

		var ups_types = graph.dataTypes(host, plugin, plugin_instance),
		    ups_inst = {};

		for (var i = 0; i < ups_types.length; i++)
			ups_inst[ups_types[i]] = graph.dataInstances(host, plugin, plugin_instance, ups_types[i]);

		/* Check if hash table or array is empty or nil-filled */
		function empty(t) {
			for (var k in t)
				if (t[k] != null)
					return false;

			return true;
		}

		/* Append graph definition but only types/instances which are */
		/* supported and available to the plugin and UPS. */

		function add_supported(t, defs) {
			var def_inst = defs['data']['instances'];

			if (L.isObject(def_inst)) {
				for (var k in def_inst) {
					if (ups_types.filter(function(t) { return t == k }).length) {
						for (var i = def_inst[k].length - 1; i >= 0; i--)
							if (!ups_inst[k].filter(function(n) { return n == def_inst[k][i] }).length)
								def_inst[k].splice(i, 1);

						if (def_inst[k].length == 0)
							def_inst[k] = null; /* can't assign v: immutable */
					}
					else {
						def_inst[k] = null;  /* can't assign v: immutable */
					}
				}

				if (empty(def_inst))
					return;
			}

			t.push(defs);
		}


		/* Graph definitions for APC UPS measurements MUST use only 'instances': */
		/* e.g. instances = { voltage = {  "input", "output" } } */

		var voltagesdc = {
			title: "%H: Voltages on APC UPS - Battery",
			vlabel: "Volts DC",
			alt_autoscale: true,
			number_format: "%5.1lfV",
			data: {
				instances: {
					voltage: [ "battery" ]
				},
				options: {
					voltage: { title: "Battery voltage", noarea: true }
				}
			}
		};
		add_supported(rv, voltagesdc);

		var voltagesac = {
			title: "%H: Voltages on APC UPS - AC",
			vlabel: "Volts AC",
			alt_autoscale: true,
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
		add_supported(rv, voltagesac);

		var percentload = {
			title: "%H: Load on APC UPS ",
			vlabel: "Percent",
			y_min: "0",
			y_max: "100",
			number_format: "%5.1lf%%",
			data: {
				instances: {
					percent: [ "load" ]
				},
				options: {
					percent_load: { color: "00ff00", title: "Load level"  }
				}
			}
		};
		add_supported(rv, percentload);

		var charge_percent = {
			title: "%H: Battery charge on APC UPS ",
			vlabel: "Percent",
			y_min: "0",
			y_max: "100",
			number_format: "%5.1lf%%",
			data: {
				instances: {
					charge: [ "" ]
				},
				options: {
					charge: { color: "00ff0b", title: "Charge level"  }
				}
			}
		};
		add_supported(rv, charge_percent);

		var temperature = {
			title: "%H: Battery temperature on APC UPS ",
			vlabel: "\u00b0C",
			number_format: "%5.1lf\u00b0C",
			data: {
				instances: {
					temperature: [ "" ]
				},
				options: {
					temperature: { color: "ffb000", title: "Battery temperature" } }
			}
		};
		add_supported(rv, temperature);

		var timeleft = {
			title: "%H: Time left on APC UPS ",
			vlabel: "Minutes",
			number_format: "%.1lfm",
			data: {
				instances: {
					timeleft: [ "" ]
				},
				options: {
					timeleft: { color: "0000ff", title: "Time left" }
				}
			}
		};
		add_supported(rv, timeleft);

		var frequency = {
			title: "%H: Incoming line frequency on APC UPS ",
			vlabel: "Hz",
			number_format: "%5.0lfhz",
			data: {
				instances: {
					frequency: [ "input" ]
				},
				options: {
					frequency_input: { color: "000fff", title: "Line frequency" }
				}
			}
		};
		add_supported(rv, frequency);

		return rv;
	}
});
