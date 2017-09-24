-- Copyright 2015 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.statistics.rrdtool.definitions.apcups",package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	local voltagesdc = {
		title = "%H: Voltages on APC UPS - Battery",
		vlabel = "Volts DC",
    alt_autoscale = true,
		number_format = "%5.1lfV",
		data = {
			instances = {
				voltage = { "battery" }
			},

			options = { 
				voltage = { title = "Battery voltage", noarea=true }
			}
		}
	}
	
	local voltages = {
		title = "%H: Voltages on APC UPS - AC",
		vlabel = "Volts AC",
		alt_autoscale = true,
		number_format = "%5.1lfV",
		data = {
			instances = {
				voltage = {  "input", "output" }
			},

			options = {
				voltage_output  = { color = "00e000", title = "Output voltage", noarea=true, overlay=true },
				voltage_input   = { color = "ffb000", title = "Input voltage", noarea=true, overlay=true }
			}
		}
	}

	local percentload = {
		title = "%H: Load on APC UPS ",
		vlabel = "Percent",
		y_min = "0",
		y_max = "100",
		number_format = "%5.1lf%%",
		data = {
			sources = {
				percent_load = { "value" }
			},
			instances = {
				percent = "load"
			},
			options = {
				percent_load = { color = "00ff00", title = "Load level"  }
			}
		}
	}

	local charge_percent = {
		title = "%H: Battery charge on APC UPS ",
		vlabel = "Percent",
		y_min = "0",
		y_max = "100",
		number_format = "%5.1lf%%",
		data = {
			types = { "charge" },
			options = {
				charge = { color = "00ff0b", title = "Charge level"  }
			}
		}
	}

	local temperature = {
		title = "%H: Battery temperature on APC UPS ",
		vlabel = "\176C",
		number_format = "%5.1lf\176C",
		data = {
			types = { "temperature" },
			options = {
				temperature = { color = "ffb000", title = "Battery temperature" } }
		}
	}

	local timeleft = {
		title = "%H: Time left on APC UPS ",
		vlabel = "Minutes",
		number_format = "%.1lfm",
		data = {
			sources = {
				timeleft = { "value" }
			},
			options = {
				timeleft = { color = "0000ff", title = "Time left" }
			}
		}
	}

	local frequency = {
		title = "%H: Incoming line frequency on APC UPS ",
		vlabel = "Hz",
		number_format = "%5.0lfhz",
		data = {
			sources = {
				frequency_input = { "value" }
			},
			instances = {
				frequency = "frequency"
			},
			options = {
				frequency_frequency = { color = "000fff", title = "Line frequency" }
			}
		}
	}

	return { voltages, voltagesdc, percentload, charge_percent, temperature, timeleft, frequency }
end
