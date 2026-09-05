'use strict';
'require baseclass';
'require uci';
'require form';
'require ui';
'require wwand.rpc as wrpc';
'require wwand.modemsid as modemsid';

/* Shared wwand_modem option/tab definitions, used by BOTH surfaces:
   - the interface proto handler (protocol/wwand.js), inline WireGuard-style,
     where `bind(o)` redirects storage to the referenced wwand_modem section;
   - the dedicated Modems editor page (view/wwand/modems.js), where the edited
     section IS the wwand_modem, so `bind` is a pass-through.
   Options are grouped into the agreed tabs: Modem & SIM · Radio & Cell ·
   Resilience. The interface-owned Connection tab stays in the proto handler. */

/* ubus declarations live in the shared wwand.rpc module; this module wants the
   RAW status object (board/modems), hence statusRaw. */
var callGpioList = wrpc.gpioList;
var callStatus = wrpc.statusRaw;
var callModemReset = wrpc.modemReset;
var callSlots = wrpc.slots;
var callProbe = wrpc.probe;

/* This module is shared by two surfaces, and `section_id` does not mean the same
   thing on both: on Network → Modems it IS the wwand_modem name, while on
   Network → Interfaces → Modem & SIM it is the *interface* section, whose modem
   is whatever `option modem` points at. Every lookup into a status reply goes
   through here, because those replies are keyed by modem name — indexing one
   with a raw section_id simply misses on the interface page, and misses
   quietly: the code reads as if that modem has nothing to report. */
function modemOf(section_id) {
	return modemsid.modemSid(section_id) || section_id;
}

/* Add a Combobox choice ONCE. These option objects are shared across every
   wwand_modem section of the GridSection, so LuCI calls load() (and thus our
   self.value()) once PER section — a plain self.value() then appends the same
   probe-derived choice several times, which showed up as duplicate entries in
   the Bind-by-serial/IMEI/path and reset-GPIO dropdowns on a multi-modem box.
   Guarding against the option's existing keylist makes it idempotent. */
function uniqVal(o, k, label) {
	if (!o.keylist) o.keylist = [];
	if (o.keylist.indexOf(k) >= 0) return;
	o.value(k, label);
}

/* Label for one entry of the daemon's datapath catalog (status globals.datapaths:
   { name, kind: mode|builtin|plugin, proto: [...] | null, description }).

   Only the two protocol-independent modes get a translated name — everything
   else is called what `option mux` must literally say, since a datapath name is
   also the module name of its add-on package. The protocol tag stays on the
   label even though the list is filtered per row: it is what explains WHY a
   given modem is offered these three and not those five. */
function dpLabel(e) {
	var names = { auto: _('Automatic'), raw_ip: _('No multiplexing (plain raw IP)') };
	var tags = [];

	if (e.kind == 'plugin')
		tags.push(_('add-on'));

	if (e.proto && e.proto.length)
		tags.push(e.proto.map(function(p) { return p.toUpperCase(); }).join('/'));

	return (names[e.name] || e.name) + (tags.length ? ' — ' + tags.join(', ') : '');
}

return baseclass.extend({
	/* Modem & SIM — hardware identity + SIM. The primary "device" itself is set
	   elsewhere (the modem dropdown on the interface; the section name / a device
	   field on the Modems page); this adds the rest. */
	addModemSim: function(s, tab, bind) {
		var o;

	/* NOTE (hardware-identity fields serial/imei/path): these render as
		   create-enabled Comboboxes, and LuCI's ui.Combobox materializes a
		   stored value that is absent from the (probe-derived) choice list —
		   THAT invariant is what keeps Save from deleting an existing binding
		   when no live probe data is available. Keep them create-enabled
		   (adding .value() choices does that) and keep the load() fallthrough
		   to super('load'). */
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
					uniqVal(self, p.serial, p.serial + (p.model ? ' — ' + p.model : '')
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
				/* managed carries the live-opened IMEI; present[] carries the
				   pre-open IMEI too — offer both so a configured-but-waiting
				   modem still shows a pickable identity */
				((res && res.managed) || []).concat((res && res.present) || [])
					.forEach(function(m) {
						if (!m.imei || seen[m.imei]) return;
						seen[m.imei] = true;
						uniqVal(self, m.imei, m.imei + (m.model ? ' — ' + m.model : ''));
					});
				return self.super('load', [section_id]);
			});
		};

		o = s.taboption(tab, form.Value, 'path', _('Device path binding'),
			_('Stable device topology anchor (like a wifi-device <code>path</code>) — the modem\'s sysfs path relative to /sys/devices, so it survives USB renumbering and is PCIe/MHI-ready. Pick a detected modem below or type a path; empty = bind by the modem device. Prefer <em>Bind by USB serial/IMEI</em> when available.'));
		o.ucioption = 'path';
		bind(o);
		o.load = function(section_id) {
			var self = this;
			return L.resolveDefault(callProbe(), {}).then(function(res) {
				var seen = {};
				((res && res.present) || []).forEach(function(p) {
					if (!p.path || seen[p.path]) return;
					seen[p.path] = true;
					uniqVal(self, p.path, p.path + (p.model ? ' — ' + p.model : '')
						+ (p.usb_path ? ' (' + p.usb_path + ')' : ''));
				});
				return self.super('load', [section_id]);
			});
		};

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
				(res[0] || []).forEach(function(n) { uniqVal(self, n, n); });
				var brg = (res[1] || {}).board && res[1].board.reset_gpio;
				if (brg)
					self.description = _('Named GPIO on the modem RESET line (invert, wait 30 s, restore instead of a USB power-cycle). This board already provides a default reset GPIO "%s" — set this only to override it.').format(brg);
				return self.super('load', [section_id]);
			});
		};

		o = s.taboption(tab, form.Button, '_reset', _('Reset modem now'),
			_('Reset this modem: a dedicated reset GPIO is pulsed when available, otherwise the control protocol performs a soft reset (QMI/MBIM offline+reset, AT+CFUN=1,1). Recovers a modem that hung or dropped off USB.'));
		o.inputtitle = _('Reset modem');
		o.inputstyle = 'remove';
		o.modelabel = false;
		o.onclick = function(ev, section_id) {
			var modem = modemOf(section_id);
			return callModemReset(modem).then(function(res) {
				if (res && (res.ok || res.resetting))
					ui.addNotification(null, E('p', {}, [ _('Modem reset triggered (%s).').format(res.action || '?') ]), 'info');
				else
					ui.addNotification(null, E('p', {}, [ _('Reset unavailable: %s.').format((res && res.error) || _('no reset control')) ]), 'warning');
			});
		};

		o = s.taboption(tab, form.Value, 'tty', _('AT control TTY'),
			_('Override the auto-detected AT serial port (e.g. /dev/ttyUSB2).'));
		bind(o);

		/* The remedy the daemon names in its own error message when it cannot
		   classify a control device. Leave it on "detect" unless wwand has told
		   you it could not tell — a pin that contradicts a driver wwand DOES
		   recognise is honoured, but hardware recovery then stays disarmed for
		   that modem, because an AT port answers on QMI and MBIM modems too and
		   so proves nothing about the pin. */
		o = s.taboption(tab, form.ListValue, 'protocol', _('Control protocol'),
			_('Which protocol wwand uses to drive this modem. Leave on "detect" — this exists for a control device whose driver wwand cannot classify, and it will say so in the log. Pinning a protocol that contradicts a driver wwand does recognise disables hardware recovery for this modem, because an answering AT port would then prove nothing.'));
		o.value('', _('detect (recommended)'));
		o.value('qmi', 'QMI');
		o.value('mbim', 'MBIM');
		o.value('ncm', _('NCM (AT + ethernet data port)'));
		o.value('ppp', 'PPP');
		o.optional = true;
		bind(o);

		/* The INITIAL-ATTACH bearer. The attach happens before any data session
		   and some networks want their own APN for it, while the data
		   connection uses another. Unset = the same as the interface, which is
		   what every deployment did before this existed. */
		o = s.taboption(tab, form.Value, 'init_apn', _('Attach APN'),
			_('APN for the initial network attach, when the network wants a different one from the data connection (an IMS or admin bearer). Leave empty to attach with the interface\'s own APN, which is the normal case.'));
		o.placeholder = _('same as the interface');
		o.optional = true;
		bind(o);

		o = s.taboption(tab, form.ListValue, 'init_auth', _('Attach authentication'),
			_('Authentication for the attach bearer. Only used together with an attach APN.'));
		o.value('', _('modem default'));
		o.value('none', _('none'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('both', _('PAP or CHAP'));
		o.optional = true;
		o.depends('init_apn', /.+/);
		bind(o);

		o = s.taboption(tab, form.Value, 'init_user', _('Attach username'),
			_('Username for the attach bearer. Ignored without an attach APN — it would otherwise apply to whatever APN the modem\'s attach profile already held.'));
		o.optional = true;
		o.depends('init_apn', /.+/);
		bind(o);

		o = s.taboption(tab, form.Value, 'init_pass', _('Attach password'),
			_('Password for the attach bearer.'));
		o.password = true;
		o.optional = true;
		o.depends('init_apn', /.+/);
		bind(o);

		/* A headless box has no UI to render a SETUP MENU, so advertising a
		   phone's terminal profile invites an operator campaign to send one and
		   then wait for an answer that never comes. */
		o = s.taboption(tab, form.ListValue, 'cat_mode', _('SIM toolkit'),
			_('How SIM Application Toolkit is routed. A router has no screen to display operator menus or texts on, so a modem advertising a phone-like profile can leave the card waiting for a response nothing here will send. "disabled" stops routing toolkit to a control point. Unset leaves the modem exactly as the vendor configured it.'));
		o.value('', _('modem default (do not change)'));
		o.value('disabled', _('disabled'));
		o.value('gobi', 'Gobi');
		o.value('android', 'Android');
		o.value('decoded', _('decoded'));
		o.value('decoded_pullonly', _('decoded, pull-only'));
		o.value('custom_raw', _('custom (raw)'));
		o.value('custom_decoded', _('custom (decoded)'));
		o.optional = true;
		bind(o);

		o = s.taboption(tab, form.ListValue, 'fcc_auth', _('FCC unlock'),
			_('RF unlock for laptop-SKU modems that boot radio-locked (Lenovo/Dell/HP variants of Quectel EM1xx, Foxconn SDX55/SDX62). Default "auto" tries the known QMI unlock messages when the modem stays in low-power after going online; MBIM modems need the explicit "quectel" method. "off" disables the unlock entirely.'));
		o.value('', _('auto (QMI only)'));
		o.value('off', _('off'));
		o.value('dms', _('QMI DMS (Quectel EM1xx)'));
		o.value('foxconn', _('QMI Foxconn (SDX55, DW5821e)'));
		o.value('quectel', _('MBIM Quectel radio state'));
		o.optional = true;
		bind(o);

		o = s.taboption(tab, form.Flag, 'at2_external', _('Release secondary AT port'),
			_('Reserve the modem\'s second AT port for external tools (gpsd, own scripts): wwand never opens it and runs telemetry over the control channel instead. The modem status shows which port was released.'));
		o.default = '0';
		bind(o);
		/* Which port a modem released is a PER-ROW fact, and `description` is a
		   per-column field — writing it from load() made the last modem in the
		   status reply speak for every row, including modems that released
		   nothing. Remember it per section and show it beside that row's own
		   widget instead. */
		o.load = function(section_id) {
			var self = this;
			return L.resolveDefault(callStatus(), {}).then(function(res) {
				var m = ((res || {}).modems || {})[modemOf(section_id)];
				self.at2Port = self.at2Port || {};
				self.at2Port[section_id] = (m && m.at2_released) || null;
				return self.super('load', [section_id]);
			});
		};
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var node = this.super('renderWidget', [ section_id, option_index, cfgvalue ]);
			var port = (this.at2Port || {})[section_id];

			if (!port)
				return node;

			/* The hint text goes in as a one-element ARRAY, not a bare string:
			   dom.append() assigns a bare string via innerHTML (luci.js:1394-96)
			   and only an array element becomes a createTextNode (:1382-83). The
			   port comes from the daemon, so the escaped path is the right one.
			   Wrapping the widget is safe — getUIElement() finds it by DOM id
			   through map.findElement (form.js:1897-1901), not by what this
			   returns. */
			return E('div', {}, [ node, E('div', {
				'style': 'font-size:90%;margin-top:4px',
			}, [ _('wwand leaves %s untouched and polls telemetry over the control channel.')
				.format(port) ]) ]);
		};

		/* Not a ListValue: `option mux` also takes the name of an add-on datapath
		   package (wwand.datapath_<name>), so the field must accept a value that
		   is not in the list — a fixed dropdown made those unreachable from LuCI
		   although the daemon supports them. The list is filled from what the
		   daemon reports as selectable ON THIS BOX (modes + built-ins + installed
		   plugins, each carrying the control protocols it serves), so an
		   installed rmnet_nss shows up as a normal choice and a list hardcoded
		   here cannot go stale behind the daemon. */
		o = s.taboption(tab, form.Value, 'mux', _('Data multiplexing'),
			_('Kernel datapath that carries this modem\'s data sessions. Leave on automatic unless a modem misbehaves — under automatic an installed vendor datapath that recognises this hardware is used on its own. Naming one pins it. Only datapaths this modem\'s control protocol can use are offered.'));
		o.default = 'auto';
		/* seed: the field must offer something even if the daemon is not
		   answering (stopped, no modem yet) — the load() below adds the rest */
		o.value('auto', _('Automatic'));
		o.validate = function(section_id, value) {
			/* a hyphen is accepted although a datapath name carries none: it is
			   how 'raw-ip' gets written, and the daemon canonicalises it */
			if (value == null || value === '' || /^[a-z][a-z0-9_-]*$/.test(value))
				return true;
			return _('A datapath name: lowercase letters, digits, underscore and hyphen.');
		};
		o.load = function(section_id) {
			var self = this;
			return L.resolveDefault(callStatus(), {}).then(function(reply) {
				var list = ((reply || {}).globals || {}).datapaths || [];

				/* name -> the protocols it serves, and section -> this modem's
				   control protocol; renderWidget below needs both to decide what
				   a given ROW may be offered. */
				self.dpServes = self.dpServes || {};
				self.dpProto = self.dpProto || {};
				var mine = ((reply || {}).modems || {})[modemOf(section_id)];
				self.dpProto[section_id] = mine ? mine.protocol : null;

				list.forEach(function(e) {
					/* tolerate the pre-1.6 shape (a plain array of names) */
					if (typeof e == 'string') e = { name: e };
					if (!e || !e.name) return;
					self.dpServes[e.name] = e.proto || null;
					uniqVal(self, e.name, dpLabel(e));
				});
				return self.super('load', [section_id]);
			});
		};
		/* Filter the choices PER ROW. A LuCI option object is shared by every
		   section of a GridSection, so o.value() is per column and the plain
		   list would be the union across a QMI and an MBIM modem — offering each
		   of them datapaths the daemon now refuses outright. The rendering hook
		   is the one place that knows which section it is drawing, so the
		   keylist is narrowed there and restored afterwards. */
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var allKeys = this.keylist || [], allVals = this.vallist || [];
			var proto = (this.dpProto || {})[section_id];
			var serves = this.dpServes || {};
			var keys = [], vals = [];

			for (var i = 0; i < allKeys.length; i++) {
				var p = serves[allKeys[i]];

				/* unknown protocol (modem not running, or a daemon that does not
				   report it) shows everything — narrowing on a guess would hide
				   the very option someone came to set. A mode (proto null) fits
				   every modem, and the value already configured is always kept
				   so an existing config is never silently dropped from its own
				   dropdown. */
				if (!proto || !p || p.indexOf(proto) >= 0 || allKeys[i] === cfgvalue) {
					keys.push(allKeys[i]);
					vals.push(allVals[i]);
				}
			}

			this.keylist = keys;
			this.vallist = vals;

			try {
				return this.super('renderWidget', [ section_id, option_index, cfgvalue ]);
			}
			finally {
				this.keylist = allKeys;
				this.vallist = allVals;
			}
		};
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
			/* THIS modem's slots, not every modem's. The section id is the modem
			   name, so there is no need to sweep the status reply — and sweeping
			   it was wrong twice over: the choices land on the shared column, so
			   one modem was offered another's slot numbers AND its ICCIDs, and
			   picking one saved a sim_slot that modem does not have. Slot number
			   is `physical` (what format.js/esim.js and modem_sim_switch_slot
			   use), not `slot`. */
			return L.resolveDefault(callStatus(), {}).then(function(reply) {
				var modem = modemOf(section_id);

				if (!((reply && reply.modems) || {})[modem])
					return self.super('load', [section_id]);

				return L.resolveDefault(callSlots(modem), {}).then(function(r) {
					var seen = {};
					self.slotsOf = self.slotsOf || {};
					self.slotsOf[section_id] = { '0': true };
					((r && r.slots) || []).forEach(function(sl) {
						if (sl.physical == null || seen[sl.physical]) return;
						seen[sl.physical] = true;
						self.slotsOf[section_id][String(sl.physical)] = true;
						var lbl = _('Slot %d').format(sl.physical);
						if (sl.iccid)
							lbl += ' — ' + sl.iccid + (sl.is_euicc ? ' (eUICC)' : '');
						else
							lbl += ' — ' + _('empty');
						uniqVal(self, String(sl.physical), lbl);
					});
					return self.super('load', [section_id]);
				});
			});
		};
		/* ...and offer each row only its own modem's slots: the choices above
		   land on the shared column, so without this every modem still sees
		   every other modem's slot numbers and ICCIDs. Unknown modem (not
		   running, or the status call failed) shows the full list rather than
		   an empty one, and the configured value is always kept. */
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var allKeys = this.keylist || [], allVals = this.vallist || [];
			var mine = (this.slotsOf || {})[section_id];
			var keys = [], vals = [];

			if (!mine)
				return this.super('renderWidget', [ section_id, option_index, cfgvalue ]);

			for (var i = 0; i < allKeys.length; i++)
				if (mine[allKeys[i]] || allKeys[i] === cfgvalue) {
					keys.push(allKeys[i]);
					vals.push(allVals[i]);
				}

			this.keylist = keys;
			this.vallist = vals;

			try {
				return this.super('renderWidget', [ section_id, option_index, cfgvalue ]);
			}
			finally {
				this.keylist = allKeys;
				this.vallist = allVals;
			}
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

		/* preferred-PLMN list restored before every radio-on (managed on the
		   modem status/tools page; a per-SIM list wins over this one) */
		o = s.taboption(tab, form.ListValue, 'plmn_list', _('Preferred-PLMN list'),
			_('Optional: a saved PLMN list (config wwand_plmnlist) the daemon restores before every radio-on. Edit lists on the modem status page.'));
		o.rmempty = true;
		o.value('', _('(none)'));
		uci.sections('network', 'wwand_plmnlist').forEach(function(sec) {
			o.value(sec['.name'], sec['.name'] + ' (' + ((sec.type == 'user') ? 'user' : (sec.type == 'fplmn') ? 'FPLMN' : 'NAS') + ')');
		});
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

		/* Off by default on purpose: a parked radio is not reachable, which is
		   the opposite of what most routers want. */
		o = s.taboption(tab, form.Flag, 'lowpower', _('Park the radio when idle'),
			_('Put the modem\'s radio into low power once no interface on this modem is up — for battery and solar installs, where an idle modem still spends a couple of watts holding a registration nobody uses. Only on an administrative down, never on a brief connection loss. A parked modem is NOT reachable from the network until the interface is brought up again.'));
		o.default = '0';
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
