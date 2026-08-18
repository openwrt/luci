#!/usr/bin/env ucode
// Photonicat 2 — rpcd ucode backend for LuCI
// Provides system status and hardware control via ubus RPC.

'use strict';

import { readfile, writefile, glob, access, popen } from 'fs';
import { cursor } from 'uci';

function find_hwmon(name) {
	let dirs = glob('/sys/class/hwmon/hwmon*');
	for (let dir in dirs) {
		let n = trim(readfile(dir + '/name') || '');
		if (n == name)
			return dir;
	}
	return null;
}

function find_cooling_device(type) {
	let dirs = glob('/sys/class/thermal/cooling_device*');
	for (let dir in dirs) {
		let t = trim(readfile(dir + '/type') || '');
		if (t == type)
			return dir;
	}
	return null;
}

function read_int(path) {
	let val = readfile(path);
	return val ? +trim(val) : null;
}

const methods = {
	get_status: {
		call: function() {
			let result = {};

			// ── Thermal zones ──
			let zones = [];
			let tz_dirs = glob('/sys/class/thermal/thermal_zone*');
			for (let dir in tz_dirs) {
				let temp = read_int(dir + '/temp');
				let type = trim(readfile(dir + '/type') || '');
				if (temp != null)
					push(zones, { type: type, temp: temp / 1000.0 });
			}
			result.thermal_zones = zones;

			// ── Board temperature (MCU hwmon) ──
			let hwmon_temp = find_hwmon('pcat_pm_hwmon_temp_mb');
			if (hwmon_temp) {
				let t = read_int(hwmon_temp + '/temp1_input');
				if (t != null)
					result.board_temp = t / 1000.0;
			}

			// ── Fan RPM ──
			let hwmon_fan = find_hwmon('pcat_pm_hwmon_speed_fan');
			if (hwmon_fan)
				result.fan_rpm = read_int(hwmon_fan + '/fan1_input');

			// ── Fan cooling device ──
			let cooling = find_cooling_device('pcat-pm-fan');
			if (cooling) {
				result.fan_level = read_int(cooling + '/cur_state');
				result.fan_max_level = read_int(cooling + '/max_state');
			}

			// ── Battery ──
			let bat = '/sys/class/power_supply/battery';
			if (access(bat)) {
				result.battery = {
					status:   trim(readfile(bat + '/status') || ''),
					voltage:  (read_int(bat + '/voltage_now') || 0) / 1000000.0,
					current:  (read_int(bat + '/current_now') || 0) / 1000000.0,
					capacity: read_int(bat + '/capacity')
				};
			}

			// ── Charger ──
			let chg = '/sys/class/power_supply/charger';
			if (access(chg)) {
				result.charger = {
					online: read_int(chg + '/online')
				};
			}

			// ── CPU policies ──
			let cpu = {};
			let policies = glob('/sys/devices/system/cpu/cpufreq/policy*');
			for (let dir in policies) {
				let parts = split(dir, '/');
				let name = parts[length(parts) - 1];
				cpu[name] = {
					governor:  trim(readfile(dir + '/scaling_governor') || ''),
					governors: split(trim(readfile(dir + '/scaling_available_governors') || ''), ' '),
					cur_freq:  (read_int(dir + '/scaling_cur_freq') || 0) / 1000.0,
					max_freq:  (read_int(dir + '/scaling_max_freq') || 0) / 1000.0,
					min_freq:  (read_int(dir + '/scaling_min_freq') || 0) / 1000.0
				};
			}
			result.cpu = cpu;

			// ── Fan config from UCI ──
			let uci = cursor();
			uci.load('photonicat');
			result.fan_config = {
				mode:         uci.get('photonicat', 'fan', 'mode') || 'auto',
				manual_level: +(uci.get('photonicat', 'fan', 'manual_level') || '3'),
				min_temp:     +(uci.get('photonicat', 'fan', 'min_temp') || '45'),
				max_temp:     +(uci.get('photonicat', 'fan', 'max_temp') || '85'),
				hysteresis:   +(uci.get('photonicat', 'fan', 'hysteresis') || '3')
			};
			uci.unload();

			return result;
		}
	},

	set_fan_mode: {
		args: { mode: '' },
		call: function(req) {
			let mode = req.args.mode;
			if (mode != 'auto' && mode != 'manual' && mode != 'off')
				return { error: 'Invalid mode: must be auto, manual, or off' };

			let uci = cursor();
			uci.load('photonicat');
			uci.set('photonicat', 'fan', 'mode', mode);
			uci.commit('photonicat');
			uci.unload();
			return { success: true };
		}
	},

	set_fan_level: {
		args: { level: 0 },
		call: function(req) {
			let level = +req.args.level;
			if (level < 0 || level > 9)
				return { error: 'Invalid level: must be 0-9' };

			let uci = cursor();
			uci.load('photonicat');
			uci.set('photonicat', 'fan', 'manual_level', '' + level);
			uci.commit('photonicat');
			uci.unload();
			return { success: true };
		}
	},

	set_fan_curve: {
		args: { min_temp: 0, max_temp: 0, hysteresis: 0 },
		call: function(req) {
			let min_t = +req.args.min_temp;
			let max_t = +req.args.max_temp;
			let hyst  = +req.args.hysteresis;

			if (min_t < 20 || min_t > 80)
				return { error: 'min_temp must be 20-80' };
			if (max_t < 50 || max_t > 110)
				return { error: 'max_temp must be 50-110' };
			if (max_t <= min_t)
				return { error: 'max_temp must be greater than min_temp' };
			if (hyst < 1 || hyst > 15)
				return { error: 'hysteresis must be 1-15' };

			let uci = cursor();
			uci.load('photonicat');
			uci.set('photonicat', 'fan', 'min_temp', '' + min_t);
			uci.set('photonicat', 'fan', 'max_temp', '' + max_t);
			uci.set('photonicat', 'fan', 'hysteresis', '' + hyst);
			uci.commit('photonicat');
			uci.unload();
			return { success: true };
		}
	},

	set_cpu_governor: {
		args: { governor: '' },
		call: function(req) {
			let governor = req.args.governor;
			let valid = ['powersave', 'performance', 'schedutil'];
			if (index(valid, governor) < 0)
				return { error: 'Invalid governor: must be powersave, performance, or schedutil' };

			// Apply immediately to all CPU frequency policies
			let policies = glob('/sys/devices/system/cpu/cpufreq/policy*');
			for (let dir in policies)
				writefile(dir + '/scaling_governor', governor + '\n');

			// Persist in UCI for boot
			let uci = cursor();
			uci.load('photonicat');
			uci.set('photonicat', 'cpu', 'governor', governor);
			uci.commit('photonicat');
			uci.unload();

			return { success: true };
		}
	},

	get_display_config: {
		call: function() {
			let uci = cursor();
			uci.load('photonicat');

			let result = {
				backlight:  +(uci.get('photonicat', 'display', 'backlight') || '1'),
				refresh:    +(uci.get('photonicat', 'display', 'refresh') || '5'),
				theme:      uci.get('photonicat', 'display', 'theme') || 'dark',
				font_scale: +(uci.get('photonicat', 'display', 'font_scale') || '1.0'),
				pages:      uci.get('photonicat', 'display', 'pages') || ['clock','battery','network','wifi','thermal','system']
			};

			// Custom parameters
			let params = [];
			for (let i = 0; i < 10; i++) {
				let sect = 'display_param_' + i;
				let label = uci.get('photonicat', sect, 'label');
				if (!label) break;
				push(params, {
					label:  label,
					source: uci.get('photonicat', sect, 'source') || '',
					unit:   uci.get('photonicat', sect, 'unit') || '',
					divide: +(uci.get('photonicat', sect, 'divide') || '0')
				});
			}
			result.custom_params = params;

			uci.unload();
			return result;
		}
	},

	set_display_config: {
		args: { backlight: 0, refresh: 0, theme: '', font_scale: 0.0, pages: [] },
		call: function(req) {
			let a = req.args;

			let valid_themes = ['dark', 'light', 'green', 'cyan', 'amber'];
			if (a.theme && index(valid_themes, a.theme) < 0)
				return { error: 'Invalid theme' };

			let valid_pages = ['dashboard', 'clock', 'battery', 'network', 'wifi', 'thermal', 'system', 'custom'];

			let uci = cursor();
			uci.load('photonicat');

			// Ensure display section exists
			if (!uci.get('photonicat', 'display')) {
				uci.set('photonicat', 'display', 'display');
			}

			if (a.backlight != null)
				uci.set('photonicat', 'display', 'backlight', '' + (a.backlight ? 1 : 0));

			if (a.refresh != null && a.refresh >= 1 && a.refresh <= 60)
				uci.set('photonicat', 'display', 'refresh', '' + a.refresh);

			if (a.theme)
				uci.set('photonicat', 'display', 'theme', a.theme);

			if (a.font_scale != null && +a.font_scale >= 1.0 && +a.font_scale <= 2.0)
				uci.set('photonicat', 'display', 'font_scale', sprintf('%.1f', +a.font_scale));

			if (a.pages && length(a.pages) > 0) {
				// Validate pages
				let filtered = [];
				for (let p in a.pages) {
					if (index(valid_pages, p) >= 0)
						push(filtered, p);
				}
				if (length(filtered) > 0)
					uci.set('photonicat', 'display', 'pages', filtered);
			}

			uci.commit('photonicat');
			uci.unload();

			// Signal display daemon to reload config
			let ph = popen('killall -HUP pcat2-display 2>/dev/null');
			if (ph) ph.close();

			return { success: true };
		}
	}
};

return { 'luci.photonicat': methods };
