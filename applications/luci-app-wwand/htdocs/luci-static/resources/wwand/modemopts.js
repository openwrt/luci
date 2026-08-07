'use strict';
'require baseclass';
'require form';
'require rpc';
'require ui';

/* Shared wwand_modem option/tab definitions, used by BOTH surfaces:
   - the interface proto handler (protocol/wwand.js), inline WireGuard-style,
     where `bind(o)` redirects storage to the referenced wwand_modem section;
   - the dedicated Modems editor page (view/wwand/modems.js), where the edited
     section IS the wwand_modem, so `bind` is a pass-through.
   Options are grouped into the agreed tabs: Modem & SIM · Radio & Cell ·
   Resilience. The interface-owned Connection tab stays in the proto handler. */

var callGpioList = rpc.declare({
	object: 'file', method: 'list', params: [ 'path' ], expect: { entries: [] },
	filter: function(list) {
		var rv = [];
		for (var i = 0; i < list.length; i++) {
			var n = list[i].name;
			if (n && n != 'export' && n != 'unexport' && !/^gpio(chip)?[0-9]+$/.test(n))
				rv.push(n);
		}
		return rv.sort();
	}
});

var callStatus = rpc.declare({ object: 'wwand', method: 'status', expect: { '': {} } });
var callRepower = rpc.declare({ object: 'wwand', method: 'modem_repower', params: [ 'modem' ], expect: {} });
var callSlots = rpc.declare({ object: 'wwand', method: 'modem_sim_slots', params: [ 'modem' ], expect: {} });
var callProbe = rpc.declare({ object: 'wwand', method: 'modem_probe', expect: {} });

return baseclass.extend({
	/* Modem & SIM — hardware identity + SIM. The primary "device" itself is set
	   elsewhere (the modem dropdown on the interface; the section name / a device
	   field on the Modems page); this adds the rest. */
	addModemSim: function(s, tab, bind) {
		var o;

		o = s.taboption(tab, form.Value, 'serial', _('Bind by USB serial'),
			_('Pin this modem by its USB iSerial — a stable identity that follows the modem across renumbering and port changes (read before the modem is opened). Pick a detected modem below, or leave empty.'));
		o.ucioption = 'serial';
		bind(o);
		o.load = function(section_id) {
			var self = this;
			return L.resolveDefault(callProbe(), {}).then(function(res) {
				var seen = {};
				((res && res.present) || []).forEach(function(p) {
					if (!p.serial || seen[p.serial]) return;
					seen[p.serial] = true;
					self.value(p.serial, p.serial + (p.model ? ' — ' + p.model : '')
						+ (p.usb_path ? ' (' + p.usb_path + ')' : ''));
				});
				return self.super('load', [section_id]);
			});
		};

		o = s.taboption(tab, form.Value, 'imei', _('Bind by IMEI'),
			_('Pin this modem by its IMEI — globally unique and verified after the modem opens. A configured IMEI that does not match blocks bring-up, so the wrong physical modem never gets this SIM/APN. Pick a detected modem below, or leave empty.'));
		o.ucioption = 'imei';
		o.datatype = 'and(uinteger,minlength(14),maxlength(16))';
		bind(o);
		o.load = function(section_id) {
			var self = this;
			return L.resolveDefault(callProbe(), {}).then(function(res) {
				var seen = {};
				((res && res.managed) || []).forEach(function(m) {
					if (!m.imei || seen[m.imei]) return;
					seen[m.imei] = true;
					self.value(m.imei, m.imei + (m.model ? ' — ' + m.model : ''));
				});
				return self.super('load', [section_id]);
			});
		};

		o = s.taboption(tab, form.Value, 'path', _('USB path binding'),
			_('Optional stable USB topology anchor (like a wifi-device <code>path</code>, e.g. 1-1.2) — survives renumbering on multi-modem setups. Prefer <em>Bind by USB serial/IMEI</em> above; empty = bind by the modem device.'));
		o.ucioption = 'path';
		bind(o);

		o = s.taboption(tab, form.Value, 'reset_gpio', _('Modem reset GPIO'),
			_('Named GPIO on the modem RESET line. When set, recovery pulses it (invert, wait 30 s, restore) instead of cycling USB power.'));
		o.ucioption = 'reset_gpio';
		bind(o);
		o.load = function(section_id) {
			var self = this;
			return Promise.all([
				L.resolveDefault(callGpioList('/sys/class/gpio/'), []),
				L.resolveDefault(callStatus(), {})
			]).then(function(res) {
				(res[0] || []).forEach(function(n) { self.value(n, n); });
				var brg = (res[1] || {}).board && res[1].board.reset_gpio;
				if (brg)
					self.description = _('Named GPIO on the modem RESET line (invert, wait 30 s, restore instead of a USB power-cycle). This board already provides a default reset GPIO "%s" — set this only to override it.').format(brg);
				return self.super('load', [section_id]);
			});
		};

		o = s.taboption(tab, form.Button, '_repower', _('Reset modem now'),
			_('Power-cycle (or, with a reset GPIO, reset) the modem. Recovers a modem that hung or dropped off USB.'));
		o.inputtitle = _('Repower modem');
		o.inputstyle = 'remove';
		o.modelabel = false;
		o.onclick = function() {
			return callRepower('').then(function(res) {
				if (res && res.ok)
					ui.addNotification(null, E('p', {}, _('Modem repower triggered (%s).').format(res.action)), 'info');
				else
					ui.addNotification(null, E('p', {}, _('Repower unavailable: %s.').format((res && res.error) || _('no board power/reset control'))), 'warning');
			});
		};

		o = s.taboption(tab, form.Value, 'tty', _('AT control TTY'),
			_('Override the auto-detected AT serial port (e.g. /dev/ttyUSB2).'));
		bind(o);

		o = s.taboption(tab, form.Flag, 'at2_external', _('Release secondary AT port'),
			_('Reserve the modem\'s second AT port for external tools (gpsd, own scripts): wwand never opens it and runs telemetry over the control channel instead. The modem status shows which port was released.'));
		o.default = '0';
		bind(o);
		o.load = function(section_id) {
			var self = this;
			return L.resolveDefault(callStatus(), {}).then(function(res) {
				var mods = (res || {}).modems || {};
				for (var k in mods)
					if (mods[k].at2_released)
						self.description = _('Reserved for external tools: wwand leaves <code>%s</code> untouched and polls telemetry over the control channel.').format(mods[k].at2_released);
				return self.super('load', [section_id]);
			});
		};

		o = s.taboption(tab, form.ListValue, 'mux', _('Data multiplexing'),
			_('Kernel datapath backend for QMAP multiplexing. Leave on auto unless a modem misbehaves.'));
		o.default = 'auto';
		o.value('auto', _('Automatic'));
		o.value('rmnet', 'rmnet');
		o.value('qmimux', 'qmimux');
		bind(o);

		o = s.taboption(tab, form.Value, 'dl_datagram_max_size', _('Aggregation DL datagram size'),
			_('Max downlink QMAP aggregation datagram in bytes (0 = board/model default).'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		bind(o);

		o = s.taboption(tab, form.DynamicList, 'at_init', _('Extra AT init commands'),
			_('Vendor AT commands sent once after the modem is detected, before registration.'));
		o.placeholder = 'ATE0';
		bind(o);

		o = s.taboption(tab, form.Value, 'sim_slot', _('SIM slot'),
			_('Physical SIM slot to activate on multi-slot / eSIM modems (0 = leave as-is). The list shows the slots the modem reports.'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		bind(o);
		o.value('0', _('0 — leave as-is'));
		/* enrich the dropdown with the modem's actual slots (card / ICCID / eUICC).
		   Best-effort: talks to live modems; on any failure the plain field stays. */
		o.load = function(section_id) {
			var self = this;
			return L.resolveDefault(callStatus(), {}).then(function(modems) {
				return Promise.all(Object.keys(modems || {}).map(function(n) {
					return L.resolveDefault(callSlots(n), {});
				})).then(function(results) {
					var seen = {};
					results.forEach(function(r) {
						((r && r.slots) || []).forEach(function(sl) {
							if (sl.slot == null || seen[sl.slot]) return;
							seen[sl.slot] = true;
							var lbl = _('Slot %d').format(sl.slot);
							if (sl.iccid)
								lbl += ' — ' + sl.iccid + (sl.is_euicc ? ' (eUICC)' : '');
							else
								lbl += ' — ' + _('empty');
							self.value(String(sl.slot), lbl);
						});
					});
					return self.super('load', [section_id]);
				});
			});
		};

		o = s.taboption(tab, form.Value, 'pincode', _('SIM PIN'),
			_('Default SIM PIN for this modem, entered on each start. Empty = unlocked SIM. Per-card overrides live in the SIMs list.'));
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';
		bind(o);
	},

	/* Radio (RAT + manual PLMN). Cell lock lives in addCellLock (same tab). */
	addRadio: function(s, tab, bind) {
		var o;

		o = s.taboption(tab, form.ListValue, 'modes', _('Radio technology'),
			_('Restrict the modem to certain radio access technologies.'));
		o.value('', _('Modem default'));
		o.value('all', _('All'));
		o.value('lte', 'LTE');
		o.value('nr5g', '5G NR');
		o.value('lte,nr5g', 'LTE + 5G NR');
		o.value('umts', 'UMTS');
		o.value('gsm', 'GSM');
		o.value('td-scdma', 'TD-SCDMA');
		o.value('cdma', 'CDMA');
		bind(o);

		o = s.taboption(tab, form.Value, 'mcc', _('MCC'),
			_('Mobile Country Code for manual network selection.'));
		o.datatype = 'uinteger';
		bind(o);

		o = s.taboption(tab, form.Value, 'mnc', _('MNC'),
			_('Mobile Network Code (requires MCC).'));
		o.datatype = 'uinteger';
		bind(o);
	},

	/* Cell lock fields (kept separate so the caller can slot the live cell-scan
	   widget between the radio options and the lock inputs). Returns the two
	   lock options so a scan widget can push values into them. */
	addCellLock: function(s, tab, bind) {
		var lock4g = s.taboption(tab, form.DynamicList, 'lock_4g', _('LTE cell lock'),
			_('Lock to LTE cells, one "earfcn:pci" per entry (several = a cell list).'));
		lock4g.placeholder = '1300:246';
		bind(lock4g);

		var lock5g = s.taboption(tab, form.Value, 'lock_5g', _('5G NR SA cell lock'),
			_('Lock to a 5G SA cell: "pci:arfcn:scs:band".'));
		lock5g.placeholder = '242:431070:15:1';
		bind(lock5g);

		var persist = s.taboption(tab, form.Flag, 'lock_persist', _('Persist lock in modem'),
			_('Store the cell lock in modem non-volatile memory.'));
		persist.default = '0';
		bind(persist);

		return { lock4g: lock4g, lock5g: lock5g };
	},

	/* Resilience / recovery / telemetry cadence. */
	addResilience: function(s, tab, bind) {
		var o;

		o = s.taboption(tab, form.Value, 'delay', _('Modem init delay'),
			_('Seconds to wait before initializing the modem.'));
		o.placeholder = '0';
		o.datatype = 'min(0)';
		bind(o);

		o = s.taboption(tab, form.Value, 'failreboot', _('Reboot after N failures'),
			_('Reboot the router after this many failed connection attempts. 0 = never reboot — the hardware recovery rungs (op-mode cycle, modem reset, GPIO/repower) still run and the ladder then keeps retrying.'));
		o.placeholder = '100';
		o.datatype = 'uinteger';
		bind(o);

		o = s.taboption(tab, form.Value, 'proto_error_limit', _('Reboot after N protocol errors'),
			_('Reboot after this many consecutive control-protocol errors. Gated by the failure-reboot setting above — with reboot disabled it never fires.'));
		o.placeholder = '25';
		o.datatype = 'uinteger';
		bind(o);

		o = s.taboption(tab, form.Value, 'repower_time', _('Repower / reset duration'),
			_('Seconds the modem is held de-powered during a recovery power-cycle (or held in reset, when a reset GPIO is used). Default 30 s.'));
		o.placeholder = '30';
		o.datatype = 'min(1)';
		bind(o);

		o = s.taboption(tab, form.Value, 'zero_rx_timeout', _('Zero-RX timeout'),
			_('Restart the connection after this many seconds without received packets (0 = off).'));
		o.placeholder = '21600';
		o.datatype = 'uinteger';
		bind(o);

		o = s.taboption(tab, form.Value, 'stats_interval', _('Telemetry interval'),
			_('Seconds between throughput/signal telemetry samples while connected.'));
		o.placeholder = '60';
		o.datatype = 'uinteger';
		bind(o);

		o = s.taboption(tab, form.Flag, 'location', _('Enable GPS/location'),
			_('Start the modem GNSS engine and expose position over ubus.'));
		o.default = '0';
		bind(o);

		o = s.taboption(tab, form.Flag, 'auto_correct_config', _('Auto-correct modem config'),
			_('Let wwand reprogram mismatched modem-side settings (attach profile, etc.) when it detects them.'));
		o.default = '0';
		bind(o);
	}
});
