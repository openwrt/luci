#!/usr/bin/env ucode
'use strict';

import { lsdir, popen, stat } from 'fs';
import { log } from 'math';

function run_json(cmd) {
	let proc = popen(cmd, 'r');

	if (!proc)
		return null;

	let out = proc.read('all');

	proc.close();

	if (!out)
		return null;

	try {
		return json(trim(out));
	} catch (e) {
		return null;
	}
}

function shellquote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
}

function mw_to_dbm(mw) {
	if (mw == null || mw <= 0)
		return null;

	return 10 * log(mw) / log(10);
}

function parse_ethtool_json(eth_data, iface) {
	/* ethtool --json -m outputs a JSON array with one element */
	let data = null;

	if (type(eth_data) == 'array' && length(eth_data) > 0)
		data = eth_data[0];
	else if (type(eth_data) == 'object')
		data = eth_data;
	else
		return null;

	/* must have an identifier to be a valid transceiver */
	let identifier = data.identifier_description || null;

	if (!identifier)
		return null;

	/* connector */
	let connector = data.connector_description || null;

	/* wavelength */
	let wavelength = data.laser_wavelength != null ?
		+data.laser_wavelength : null;

	/* vendor OUI -- ethtool JSON always [byte0, byte1, byte2] */
	let vendor_oui = type(data.vendor_oui) == 'array' ?
		sprintf('%02x:%02x:%02x',
			data.vendor_oui[0],
			data.vendor_oui[1],
			data.vendor_oui[2]) : null;

	/* transceiver types -- ethtool may output a single string */
	let transceiver_types = [];

	if (data.transceiver_type)
		push(transceiver_types, data.transceiver_type);

	/* detect multi-channel (QSFP/CMIS) by array bias current */
	let bias = data.laser_tx_bias_current;
	let is_multi_ch = type(bias) == 'array';
	let ch_count = is_multi_ch ? min(length(bias), 4) : 1;

	let diag = {};

	diag.temperature_c = data.module_temperature_measurement != null ?
		+data.module_temperature_measurement : null;
	diag.voltage_v = data.module_voltage_measurement != null ?
		+data.module_voltage_measurement : null;

	if (is_multi_ch) {
		for (let ch = 0; ch < ch_count; ch++) {
			let ci = ch + 1;

			/* bias current per channel */
			diag[`bias_current_ma_ch${ci}`] =
				bias[ch] != null ? +bias[ch] : null;

			/* TX power per channel */
			let tx_arr = data.transmit_avg_optical_power;
			let tx_mw = (type(tx_arr) == 'array' &&
				tx_arr[ch] != null) ? +tx_arr[ch] : null;

			diag[`tx_power_mw_ch${ci}`] = tx_mw;
			diag[`tx_power_dbm_ch${ci}`] = mw_to_dbm(tx_mw);

			/* RX power per channel -- QSFP: rx_power.values array */
			let rx_obj = data.rx_power;
			let rx_arr = (type(rx_obj) == 'object' &&
				type(rx_obj.values) == 'array') ?
				rx_obj.values : null;

			let rx_mw = (rx_arr != null && rx_arr[ch] != null) ?
				+rx_arr[ch] : null;

			diag[`rx_power_mw_ch${ci}`] = rx_mw;
			diag[`rx_power_dbm_ch${ci}`] = mw_to_dbm(rx_mw);
		}

		/* plain keys from channel 1 for table view */
		diag.bias_current_ma = diag.bias_current_ma_ch1;
		diag.tx_power_mw     = diag.tx_power_mw_ch1;
		diag.tx_power_dbm    = diag.tx_power_dbm_ch1;
		diag.rx_power_mw     = diag.rx_power_mw_ch1;
		diag.rx_power_dbm    = diag.rx_power_dbm_ch1;
	} else {
		/* SFP: single-channel values */
		diag.bias_current_ma = bias != null ? +bias : null;

		let tx_val = data.transmit_avg_optical_power;

		diag.tx_power_mw  = tx_val != null ? +tx_val : null;
		diag.tx_power_dbm = mw_to_dbm(tx_val != null ? +tx_val : null);

		/* SFP: rx_power is { value, type } */
		let rx_obj = data.rx_power;
		let rx_val = (type(rx_obj) == 'object') ? rx_obj.value : null;

		diag.rx_power_mw  = rx_val != null ? +rx_val : null;
		diag.rx_power_dbm = mw_to_dbm(rx_val != null ? +rx_val : null);
	}

	/*
	 * Alarm / warning flags.
	 * Ethtool JSON keys are display-names lowercased with underscores.
	 * We map them to the short keys the frontend expects.
	 * For QSFP, channel-level flags are arrays -- check if any channel is true.
	 */
	const alarm_map = {
		'laser_bias_current_high_alarm':  'tx_bias_high',
		'laser_output_power_high_alarm': 'tx_power_high',
		'laser_tx_power_high_alarm':     'tx_power_high',
		'laser_bias_current_low_alarm':   'tx_bias_low',
		'laser_output_power_low_alarm':  'tx_power_low',
		'laser_tx_power_low_alarm':      'tx_power_low',
		'module_temperature_high_alarm':  'temp_high',
		'module_temperature_low_alarm':   'temp_low',
		'module_voltage_high_alarm':      'voltage_high',
		'module_voltage_low_alarm':       'voltage_low',
		'laser_rx_power_high_alarm':      'rx_power_high',
		'laser_rx_power_low_alarm':       'rx_power_low',
	};

	const warning_map = {
		'laser_bias_current_high_warning':  'tx_bias_high',
		'laser_output_power_high_warning': 'tx_power_high',
		'laser_tx_power_high_warning':     'tx_power_high',
		'laser_bias_current_low_warning':   'tx_bias_low',
		'laser_output_power_low_warning':  'tx_power_low',
		'laser_tx_power_low_warning':      'tx_power_low',
		'module_temperature_high_warning':  'temp_high',
		'module_temperature_low_warning':   'temp_low',
		'module_voltage_high_warning':      'voltage_high',
		'module_voltage_low_warning':       'voltage_low',
		'laser_rx_power_high_warning':      'rx_power_high',
		'laser_rx_power_low_warning':       'rx_power_low',
	};

	function map_flags(src, map) {
		let out = {};

		for (let json_key, out_key in map) {
			let val = src[json_key];

			if (val == null)
				continue;

			/* arrays: any channel set -> true (QSFP channel-level) */
			if (type(val) == 'array') {
				let has = false;

				for (let v in val) {
					if (v) {
						has = true;
						break;
					}
				}

				out[out_key] = has;
			} else {
				out[out_key] = !!val;
			}
		}

		return out;
	}

	let alarms   = map_flags(data, alarm_map);
	let warnings = map_flags(data, warning_map);

	/*
	 * Thresholds.
	 * Ethtool JSON nests thresholds as sub-objects:
	 * { module_temperature: { high_alarm_threshold: ... }, ... }
	 */
	function get_thr(obj, key) {
		if (type(obj) != 'object')
			return null;

		return obj[key] != null ? +obj[key] : null;
	}

	let thresholds = {};
	const thr_map = {
		'module_temperature': { h: 'temp_high_c',       l: 'temp_low_c'       },
		'module_voltage':     { h: 'voltage_high_v',     l: 'voltage_low_v'    },
		'laser_bias_current': { h: 'tx_bias_high_ma',    l: 'tx_bias_low_ma'   },
		'laser_output_power': { h: 'tx_power_high_mw',   l: 'tx_power_low_mw'  },
		'laser_rx_power':     { h: 'rx_power_high_mw',   l: 'rx_power_low_mw'  },
	};

	for (let src_key, out_keys in thr_map) {
		let obj = data[src_key];

		if (type(obj) == 'object') {
			thresholds[out_keys.h] = get_thr(obj, 'high_alarm_threshold');
			thresholds[out_keys.l] = get_thr(obj, 'low_alarm_threshold');
		}
	}

	return {
		iface, present: true,
		identifier, connector, wavelength,
		vendor_name:  data.vendor_name || null,
		vendor_oui,
		vendor_pn:    data.vendor_pn  || null,
		vendor_rev:   data.vendor_rev || null,
		vendor_sn:    data.vendor_sn  || null,
		date_code:    data.date_code  || null,
		transceiver_type: transceiver_types,
		diagnostics:  diag,
		alarms, warnings, thresholds,
	};
}

function rpc_list() {
	let result = [];
	let names  = lsdir('/sys/class/net/');

	if (!names)
		return { result };

	for (let name in names) {
		/* skip virtual interfaces: only physical NICs
		 * have a /sys/class/net/<name>/device symlink */
		if (!stat('/sys/class/net/' + name + '/device'))
			continue;

		let out = run_json(
			'/usr/sbin/ethtool --json -m ' +
			shellquote(name) +
			' 2>/dev/null');

		if (out) {
			try {
				let parsed = parse_ethtool_json(out, name);
				if (parsed)
					push(result, parsed);
			} catch (e) {}
		}
	}

	return { result };
}

const methods = {
	list: { call: () => rpc_list() },
};

return { 'luci.sfp-info': methods };
