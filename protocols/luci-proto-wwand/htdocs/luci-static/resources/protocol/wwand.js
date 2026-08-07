'use strict';
'require rpc';
'require dom';
'require ui';
'require uci';
'require form';
'require network';
'require wwand.bands as bands';
'require wwand.modemopts as modemopts';
'require wwand.simlist as simlist';

/* Network-native model: radio/SIM/hardware options live on a `config wwand_modem`
   section in /etc/config/network, referenced from the interface via `option
   modem`; the interface itself carries only the connection (apn/auth/pdp/mux).
   The helpers below let the proto form (which binds to the interface section)
   transparently store the modem options in the wwand_modem section, creating it
   + `option modem` on first save, and reading a legacy inline value when no
   wwand_modem exists yet — so saving ALWAYS converts an old config to new-style. */
function modemSid(ifaceSid) {
	var ref = uci.get('network', ifaceSid, 'modem');
	if (ref && uci.get('network', ref) != null)
		return ref;
	return null;
}

function ensureModemSid(ifaceSid) {
	var sid = modemSid(ifaceSid);
	if (sid)
		return sid;
	var base = 'wwmodem_' + ifaceSid, name = base, i = 0;
	while (uci.get('network', name) != null)
		name = base + (++i);
	uci.add('network', 'wwand_modem', name);
	uci.set('network', ifaceSid, 'modem', name);
	return name;
}

/* Redirect a form option's storage to the interface's wwand_modem section.
   Reads new-style (wwand_modem) or, until one exists, legacy inline; writes
   new-style and clears any legacy inline copy. */
function bindModem(o) {
	o.cfgvalue = function(sid) {
		var opt = this.ucioption || this.option;
		var msid = modemSid(sid);
		return uci.get('network', msid || sid, opt);
	};
	o.write = function(sid, val) {
		var opt = this.ucioption || this.option;
		var msid = ensureModemSid(sid);
		uci.set('network', msid, opt, val);
		/* `device` on the interface is the daemon-managed L3 device handle (the
		   mux child / netdev the daemon writes back), NOT a legacy inline modem
		   netdev — never clear it here. Other modem options still migrate. */
		if (msid != sid && opt != 'device')
			uci.unset('network', sid, opt);
	};
	o.remove = function(sid) {
		var opt = this.ucioption || this.option;
		var msid = modemSid(sid);
		if (msid)
			uci.unset('network', msid, opt);
		if (opt != 'device')
			uci.unset('network', sid, opt);
	};
	return o;
}

/* Talk to the wwand daemon directly over ubus (it exposes the 'wwand'
   object). Read-only queries only; interface configuration is written to
   /etc/config/network via the normal uci path. */
var callStatus = rpc.declare({
	object: 'wwand',
	method: 'status',
	expect: { modems: {} }
});

var callSignal = rpc.declare({
	object: 'wwand',
	method: 'modem_signal',
	params: [ 'modem' ],
	expect: { }
});

var callCells = rpc.declare({
	object: 'wwand',
	method: 'modem_cells',
	params: [ 'modem' ],
	expect: { }
});

/* Fallback enumeration of control devices, like the stock qmi/ncm handlers */
var callFileList = rpc.declare({
	object: 'file',
	method: 'list',
	params: [ 'path' ],
	expect: { entries: [] },
	filter: function(list, params) {
		var rv = [];
		for (var i = 0; i < list.length; i++)
			if (list[i].name.match(/^cdc-wdm/))
				rv.push(params.path + list[i].name);
		return rv.sort();
	}
});

/* All *named* GPIO lines (from the DT gpio-line-names), for the reset/power
   GPIO picker. Skips the export/unexport control files and the raw
   gpiochipN/gpioNNN entries. */
var callGpioList = rpc.declare({
	object: 'file',
	method: 'list',
	params: [ 'path' ],
	expect: { entries: [] },
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

/* Manual hardware repower/reset of the modem via the board profile (reset GPIO
   pulse or USB power-cycle). Same path the recovery ladder uses. */
var callRepower = rpc.declare({
	object: 'wwand',
	method: 'modem_repower',
	params: [ 'modem' ],
	expect: {}
});

/* manual PIN release past the low-retry safety block */
var callPinVerify = rpc.declare({
	object: 'wwand',
	method: 'modem_sim_pin_verify',
	params: [ 'modem', 'pin' ],
	expect: {}
});

/* Band/frequency helpers live in the shared wwand.bands module (single
   source of truth across the proto handler and the status page). */
var lteEarfcn = function(earfcn) { return bands.lteEarfcn(earfcn); };
var nrArfcn = function(arfcn) { return bands.nrArfcn(arfcn); };

/* Find the wwand modem that owns a given l3 interface device: the modem's
   netdev (wwan0) is a prefix of the interface device (wwan0m1). */
function pickModem(modems, netdev) {
	var names = Object.keys(modems || {});
	if (!names.length)
		return null;
	if (netdev) {
		for (var i = 0; i < names.length; i++) {
			var nd = modems[names[i]].netdev;
			if (nd && (netdev == nd || netdev.indexOf(nd) == 0))
				return names[i];
		}
	}
	for (var j = 0; j < names.length; j++)
		if (modems[names[j]].state == 'READY')
			return names[j];
	return names[0];
}

function tbl(rows) {
	return E('table', { 'class': 'table' }, rows.map(function(r) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, r[0]),
			E('td', { 'class': 'td left' }, r[1])
		]);
	}));
}

/* Compact modem/registration/signal summary for the general tab. */
function renderStatus(netdev) {
	return L.resolveDefault(callStatus(), {}).then(function(modems) {
		var name = pickModem(modems, netdev);
		if (!name)
			return E('em', {}, _('wwand daemon not running or no modem present'));

		var modem = modems[name];
		return Promise.all([
			L.resolveDefault(callSignal(name), {}),
			L.resolveDefault(callCells(name), {})
		]).then(function(res) {
			var sig = res[0] || {}, cells = (res[1] || {}).cells || {};
			var reg = modem.registration || {};
			var rows = [];

			rows.push([ _('Modem'), '%s%s'.format(modem.model || '?',
				modem.imei ? ' / IMEI %s'.format(modem.imei) : '') ]);
			rows.push([ _('State'), modem.state || '?' ]);

			/* surface a modem we are waiting on (after boot / a modem reboot the
			   control device may take a while to (re)appear) so the admin sees it */
			if (modem.control_note)
				rows.push([ _('Note'), E('span', { 'style': 'color:#b8860b' }, modem.control_note) ]);

			var plmn = reg.plmn;
			if (plmn)
				rows.push([ _('Operator'), '%s (%s/%s)%s'.format(
					(plmn.description || '').trim(), plmn.mcc, plmn.mnc,
					reg.roaming ? ' — ' + _('roaming') : '') ]);
			rows.push([ _('Registration'),
				(reg.registration == 1) ? _('registered') : _('searching') ]);

			var lte = sig.lte;
			if (lte && lte.rsrp != null && lte.rsrp > -32768)
				rows.push([ _('LTE signal'), 'RSRP %d dBm · RSRQ %d dB · SNR %s dB · RSSI %d dBm'.format(
					lte.rsrp, lte.rsrq, (lte.snr/10).toFixed(1), lte.rssi) ]);
			var nr = sig.nr5g;
			if (nr && nr.rsrp != null && nr.rsrp > -32768)
				rows.push([ _('5G signal'), 'RSRP %d dBm · SNR %s dB'.format(
					nr.rsrp, (nr.snr/10).toFixed(1)) ]);

			var lc = cells.lte_intra;
			if (lc) {
				var ef = lteEarfcn(lc.earfcn);
				rows.push([ _('Serving cell'), 'LTE %s%s · EARFCN %d · PCI %d · TAC %d'.format(
					ef ? ef.band : '?', ef ? ' (%s MHz)'.format(ef.mhz.toFixed(1)) : '',
					lc.earfcn, lc.serving_cell_id, lc.tac) ]);
			}

			var out = [ tbl(rows) ];

			/* PIN-safety manual release: with <=1 verify attempt left the daemon
			   refuses to auto-enter the PIN (avoids a PUK lock); offer the admin an
			   explicit "enter now" that accepts the last-attempt risk. */
			var sb = modem.sim_block;
			if (sb && (sb.reason == 'pin_retries_low' || sb.reason == 'retries_exhausted')) {
				var exhausted = (sb.reason == 'retries_exhausted');
				var pinIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
					'style': 'width:7em', 'placeholder': _('PIN'), 'disabled': exhausted ? '' : null });
				var btn = E('button', { 'class': 'btn cbi-button cbi-button-negative',
					'disabled': exhausted ? '' : null,
					'click': ui.createHandlerFn(null, function() {
						return callPinVerify(name, (pinIn.value || '').trim()).then(function() {
							ui.addNotification(null, E('p', {}, _('PIN entry attempted — watch the modem state above.')), 'info');
						});
					}) }, _('Enter PIN now'));

				out.push(E('div', { 'style': 'margin-top:8px;padding:8px;border:1px solid #d9534f;border-radius:4px' }, [
					E('strong', { 'style': 'color:#d9534f' }, exhausted
						? _('SIM PIN blocked — 0 attempts left, PUK required.')
						: _('SIM PIN entry paused — %d attempt(s) left.').format(sb.retries != null ? sb.retries : 1)),
					E('p', { 'style': 'margin:6px 0' }, exhausted
						? _('Auto-entry is disabled to avoid a PUK lock. Unblock the SIM with its PUK (e.g. with another device), then reinsert.')
						: _('wwand does not auto-enter the PIN, to avoid burning the last attempt. Enter it manually to release — this uses one of the remaining attempts, so make sure it is correct.')),
					exhausted ? '' : E('div', {}, [ pinIn, ' ', btn ])
				]));
			}

			return E('div', {}, out);
		});
	}).catch(function() { return E('em', {}, _('status unavailable')); });
}

/* A small "add to lock" button. onAdd(kind, value, section_id, btn) writes the
   value into the lock_4g list / lock_5g field. Returns '' when no handler is
   wired (e.g. the read-only status tab), so the same renderer serves both. */
function lockBtn(onAdd, section_id, kind, value, label) {
	if (!onAdd || value == null)
		return '';
	return E('button', {
		'class': 'btn cbi-button cbi-button-add',
		'style': 'margin-left:8px;padding:1px 8px',
		'title': _('Add %s to the cell lock').format(value),
		'click': function(ev) {
			ev.preventDefault();
			onAdd(kind, value, section_id, ev.currentTarget);
		}
	}, label || _('+ Lock'));
}

/* Detailed cell environment for the cell-lock tab: current serving + 5G cell
   and the neighbour list with signal, so the user can see which
   EARFCN:PCI / 5G cell to lock to. When onAdd is given, each candidate gets a
   button that appends its lock value to the corresponding form field. */
function renderCellScan(netdev, onAdd, section_id) {
	return L.resolveDefault(callStatus(), {}).then(function(modems) {
		var name = pickModem(modems, netdev);
		if (!name)
			return E('em', {}, _('no modem'));

		return Promise.all([
			L.resolveDefault(callSignal(name), {}),
			L.resolveDefault(callCells(name), {})
		]).then(function(res) {
			var sig = res[0] || {}, cells = (res[1] || {}).cells || {};
			var out = [];
			var lc = cells.lte_intra;
			var fmt = function(x, unit) { return (x == null) ? '—' : x + (unit || ''); };
			var mhz = function(f) { return (f == null) ? '—' : f.mhz.toFixed(1) + ' MHz'; };

			if (lc) {
				var ef = lteEarfcn(lc.earfcn);
				var srv = null;
				(lc.cells || []).forEach(function(c) { if (c.pci == lc.serving_cell_id) srv = c; });
				var srvLock = '%d:%d'.format(lc.earfcn, lc.serving_cell_id);

				out.push(E('p', {}, E('strong', {}, _('LTE serving cell'))));
				out.push(tbl([
					[ _('Technology'), 'LTE' ],
					[ _('Band'), ef ? ef.band : '—' ],
					[ _('Frequency'), mhz(ef) ],
					[ _('Bandwidth'), fmt(lc.bandwidth != null ? (lc.bandwidth/1000 + ' MHz') : null) ],
					[ _('EARFCN'), '' + lc.earfcn ],
					[ _('PCI'), E('span', {}, [
						'%d  →  '.format(lc.serving_cell_id), E('code', {}, srvLock),
						lockBtn(onAdd, section_id, '4g', srvLock, _('Lock this cell')) ]) ],
					[ _('Signal'), 'RSRP %s · RSRQ %s · SNR %s · RSSI %s'.format(
						srv ? (srv.rsrp/10).toFixed(1) + ' dBm' : (sig.lte ? sig.lte.rsrp + ' dBm' : '—'),
						srv ? (srv.rsrq/10).toFixed(1) + ' dB' : (sig.lte ? sig.lte.rsrq + ' dB' : '—'),
						sig.lte ? (sig.lte.snr/10).toFixed(1) + ' dB' : '—',
						sig.lte ? sig.lte.rssi + ' dBm' : '—') ]
				]));

				var neigh = (lc.cells || []).filter(function(c) { return c.pci != lc.serving_cell_id; });
				if (neigh.length) {
					out.push(E('p', {}, E('strong', {}, _('LTE neighbour cells (lock candidates)'))));
					out.push(E('table', { 'class': 'table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th' }, 'PCI'),
							E('th', { 'class': 'th' }, 'RSRP'),
							E('th', { 'class': 'th' }, 'RSRQ'),
							E('th', { 'class': 'th' }, _('lock value')),
							E('th', { 'class': 'th', 'style': 'width:1%' }, '')
						])
					].concat(neigh.map(function(c) {
						var v = '%d:%d'.format(lc.earfcn, c.pci);
						return E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td' }, '' + c.pci),
							E('td', { 'class': 'td' }, '%s dBm'.format((c.rsrp/10).toFixed(1))),
							E('td', { 'class': 'td' }, '%s dB'.format((c.rsrq/10).toFixed(1))),
							E('td', { 'class': 'td' }, E('code', {}, v)),
							E('td', { 'class': 'td' }, lockBtn(onAdd, section_id, '4g', v))
						]);
					}))));
				}
			}

			var nc = cells.nr5g_cell;
			if (nc) {
				var nf = nrArfcn(cells.nr5g_arfcn);
				/* lock_5g format: pci:arfcn:scs:band. QMI gives pci + arfcn;
				   band is inferred from the ARFCN, scs defaults to 1 (30 kHz,
				   the usual FR1 spacing) — the user should verify both. */
				var nrBand = (nf && nf.band) ? nf.band.replace(/^n/, '') : null;
				var nrLock = (cells.nr5g_arfcn != null && nrBand != null)
					? '%d:%d:1:%s'.format(nc.pci, cells.nr5g_arfcn, nrBand) : null;

				out.push(E('p', {}, E('strong', {}, _('5G NR cell'))));
				out.push(tbl([
					[ _('Technology'), '5G NR' ],
					[ _('Band'), nf && nf.band ? nf.band : '—' ],
					[ _('Frequency'), mhz(nf) ],
					[ _('Bandwidth'), fmt(nc.bandwidth != null ? (nc.bandwidth/1000 + ' MHz') : null) ],
					[ _('ARFCN'), '' + (cells.nr5g_arfcn || '?') ],
					[ _('PCI'), E('span', {}, [
						'' + nc.pci,
						nrLock ? E('span', {}, [ '   →  ', E('code', {}, nrLock),
							lockBtn(onAdd, section_id, '5g', nrLock, _('Lock this 5G cell')) ]) : '' ]) ],
					[ _('Signal'), 'RSRP %s dBm · RSRQ %s dB · SNR %s dB'.format(
						(nc.rsrp/10).toFixed(1), (nc.rsrq/10).toFixed(1), (nc.snr/10).toFixed(1)) ]
				]));
				if (onAdd && nrLock)
					out.push(E('p', { 'style': 'color:#666;font-size:90%' },
						_('5G SA lock is only supported in standalone mode; the scs value defaults to 1 (30 kHz) and the band is inferred — verify both before applying.')));
			}

			if (!out.length)
				out.push(E('em', {}, _('no cell information (modem not registered yet)')));

			return E('div', {}, out);
		});
	}).catch(function() { return E('em', {}, _('cell scan unavailable')); });
}

/* A self-refreshing DummyValue driven by one of the render functions above.
   The 5s poll is registered once per element id to avoid stacking pollers
   across form re-renders. */
var _polled = {};
function liveField(s, tab, name, title, renderFn, onAdd) {
	var o = s.taboption(tab, form.DummyValue, name, title);
	o.load = function(section_id) {
		var elId = 'wwand-%s-%s'.format(name, section_id);
		var node = E('div', { 'id': elId }, E('em', {}, _('loading…')));
		var nd = o._netdev;
		var refresh = function() {
			return renderFn(nd, onAdd, section_id).then(function(content) {
				var cur = document.getElementById(elId);
				if (cur) dom.content(cur, content);
			});
		};
		refresh();
		if (!_polled[elId]) {
			_polled[elId] = true;
			L.Poll.add(refresh, 5);
		}
		return node;
	};
	return o;
}

network.registerPatternVirtual(/^qmi-.+$/);
network.registerErrorCode('NO_DAEMON',      _('wwand daemon is not running'));
network.registerErrorCode('CONNECT_FAILED', _('Connection attempt failed'));
network.registerErrorCode('PIN_FAILED',     _('SIM PIN error'));
network.registerErrorCode('NO_CONTEXT',     _('Context not found'));
network.registerErrorCode('NO_IFACE',       _('The interface could not be found'));
network.registerErrorCode('WAITING_MODEM',  _('Waiting for modem'));

/* One protocol descriptor, registered under both the current name `wwand`
   and the historical `qmi` alias — see the tail of this file. */
var wwandProtocol = {
	getI18n: function() {
		return _('Cellular / 5G (wwand)');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'qmi-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'wwand';
	},

	isFloating: function() {
		return true;
	},

	isVirtual: function() {
		return true;
	},

	getDevices: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {
		var o, dev = this.getL3Device() || this.getDevice();
		var netdev = dev ? dev.getName() : null;

		/* Our tabs alongside the OpenWrt defaults (General/Firewall/DHCP). The
		   modem-owned tabs (Modem & SIM / Radio & Cell / Resilience) edit the
		   referenced wwand_modem inline (WireGuard-style); the same option set is
		   available standalone on Network → Modems (shared via wwand.modemopts). */
		s.tab('connection', _('Connection'), _('APN and data-bearer settings for this connection.'));
		s.tab('modem', _('Modem & SIM'), _('The modem hardware and its SIM.'));
		s.tab('radio', _('Radio & Cell'), _('Radio technology, manual operator selection and cell lock.'));
		s.tab('resilience', _('Resilience'), _('Recovery, watchdogs and telemetry cadence.'));

		/* ---- General: live status + the modem this connection uses ---- */
		o = liveField(s, 'general', '_status', _('Modem status'), renderStatus);
		o._netdev = netdev;

		o = s.taboption('general', form.Value, '_modem_device', _('Modem'),
			_('The modem this connection runs on — its network device (e.g. wwan0) or /dev/cdc-wdmX. Several connections can share one modem via different mux channels; its hardware / SIM / radio settings are on the tabs below (or manage them on Network → Modems).'));
		o.ucioption = 'device';
		o.rmempty = false;
		bindModem(o);
		o.load = function(section_id) {
			return Promise.all([
				L.resolveDefault(callStatus(), {}),
				L.resolveDefault(callFileList('/dev/'), [])
			]).then(L.bind(function(res) {
				var modems = res[0] || {}, ctrls = res[1] || [];
				Object.keys(modems).forEach(L.bind(function(n) {
					var m = modems[n];
					if (m.netdev)
						this.value(m.netdev, '%s (%s%s)'.format(m.netdev,
							m.model || '?', m.imei ? ' / ' + m.imei : ''));
				}, this));
				ctrls.forEach(L.bind(function(d) { this.value(d); }, this));
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		/* L3 device (interface-owned) — the resolved network device this
		   connection uses: the QMAP mux child (wwan0m1) or the plain netdev
		   (wwan0 / NCM). The daemon writes the resolved name back here on
		   registration; leaving it empty keeps that auto-fill, setting it overrides
		   (the user has the final say). This is the name to reference in a VRF
		   `list ports` or a firewall `option device`. Stored as `device` on the
		   interface section (NOT the modem's netdev, which is the Modem field). */
		o = s.taboption('general', form.Value, '_l3_device', _('L3 device'),
			_('Network device for this connection: the mux child (e.g. wwan0m1) or the plain netdev (wwan0 / NCM). Leave empty — the daemon fills in the resolved name; set it to override. Reference this name in a VRF port or firewall device.'));
		o.ucioption = 'device';
		o.rmempty = true;
		o.placeholder = 'wwan0m1';

		/* ---- Connection (interface-owned) ---- */
		o = s.taboption('connection', form.Value, 'apn', _('APN'),
			_('Leave empty for the default APN (or the SIM override / network default), or "#N" to use modem profile N as-is.'));

		o = s.taboption('connection', form.ListValue, 'pdp_type', _('PDP type'),
			_('IP version(s) to request for the bearer and the LTE attach. IPv4+IPv6 is recommended — some subscriptions reject an IPv4-only attach (EMM cause 33).'));
		o.default = 'ipv4v6';
		o.value('ipv4v6', _('IPv4 + IPv6'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		/* read a legacy `pdptype` (old proto js), write the canonical pdp_type */
		o.cfgvalue = function(sid) {
			return uci.get('network', sid, 'pdp_type') || uci.get('network', sid, 'pdptype');
		};
		o.write = function(sid, val) {
			uci.set('network', sid, 'pdp_type', val);
			uci.unset('network', sid, 'pdptype');
		};
		o.remove = function(sid) {
			uci.unset('network', sid, 'pdp_type');
			uci.unset('network', sid, 'pdptype');
		};

		o = s.taboption('connection', form.ListValue, 'auth', _('Authentication type'),
			_('PAP/CHAP authentication for the APN. Most operators need none.'));
		o.default = 'none';
		o.value('none', _('None'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('both', 'PAP/CHAP');

		o = s.taboption('connection', form.Value, 'username', _('PAP/CHAP username'),
			_('Only if the APN requires authentication.'));
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'both');

		o = s.taboption('connection', form.Value, 'password', _('PAP/CHAP password'));
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'both');
		o.password = true;

		/* Mux channel: this connection's QMAP channel on the modem. 0 = the plain
		   netdev; N > 0 = wwan0mN. Several interfaces on one modem each pick one. */
		o = s.taboption('connection', form.Value, 'mux_id', _('Mux channel'),
			_('QMAP multiplex channel for this connection (0 = no mux). Use different channels for multiple contexts on one modem.'));
		o.placeholder = '0';
		o.datatype = 'range(0,15)';

		o = s.taboption('connection', form.Value, 'profile', _('Attach profile index'),
			_('3GPP profile (CID) used for the LTE attach and default bearer (default derived from mux id / 1).'));
		o.placeholder = '1';
		o.datatype = 'uinteger';

		o = s.taboption('connection', form.Value, 'mtu', _('Override MTU'),
			_('Force a fixed MTU on the WAN link instead of the modem/network value.'));
		o.placeholder = dev ? (dev.getMTU() || 1500) : 1500;
		o.datatype = 'max(9200)';

		o = s.taboption('connection', form.Flag, 'use_pushed_mtu', _('Use modem-pushed MTU'),
			_('Apply the MTU the network advertises for the bearer (default on).'));
		o.default = '1';

		o = s.taboption('connection', form.Flag, 'use_pushed_prefix', _('Use network-pushed IPv4 prefix'),
			_('Off (default): the IPv4 address is configured as /32 point-to-point.'));
		o.default = '0';

		o = s.taboption('connection', form.Value, 'settings_poll', _('Settings poll interval'),
			_('Seconds between re-checks of network-pushed IP/DNS/MTU settings (0 = off).'));
		o.placeholder = '300';
		o.datatype = 'uinteger';

		o = s.taboption('connection', form.Flag, 'defaultroute', _('Use default gateway'),
			_('If unchecked, no default route is configured.'));
		o.default = o.enabled;

		o = s.taboption('connection', form.Value, 'metric', _('Use gateway metric'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.depends('defaultroute', '1');

		o = s.taboption('connection', form.Flag, 'peerdns', _('Use DNS servers advertised by peer'));
		o.default = o.enabled;

		/* ---- Modem & SIM · Radio & Cell · Resilience (shared, edit the modem) ---- */
		modemopts.addModemSim(s, 'modem', bindModem);

		modemopts.addRadio(s, 'radio', bindModem);

		/* cell lock + the live cell-environment scanner (its buttons push into the
		   lock widgets); scanner above the lock inputs in the same tab. */
		var locks = {};
		var addToLock = function(kind, value, section_id, btn) {
			var opt = (kind == '5g') ? locks.lock5g : locks.lock4g;
			var el = opt && opt.getUIElement(section_id);
			if (!el) return;

			if (kind == '5g') {
				el.setValue(value);
			} else {
				var vals = el.getValue() || [];
				if (!Array.isArray(vals))
					vals = (vals != null && vals !== '') ? [ vals ] : [];
				if (vals.indexOf(value) < 0) {
					vals.push(value);
					el.setValue(vals);
				}
			}

			if (btn) {
				var prev = btn.textContent;
				btn.textContent = '✓';
				btn.disabled = true;
				window.setTimeout(function() {
					btn.textContent = prev;
					btn.disabled = false;
				}, 1200);
			}
		};

		o = liveField(s, 'radio', '_cellscan', _('Current cells'), renderCellScan, addToLock);
		o._netdev = netdev;

		locks = modemopts.addCellLock(s, 'radio', bindModem);

		modemopts.addResilience(s, 'resilience', bindModem);

		/* Per-ICCID SIM overrides (PIN/APN) can't be embedded as a section list in
		   the interface config modal (it is not a full form.Map), so they live on
		   the dedicated Network → Modems page (the shared wwand.simlist section);
		   a note points there. */
		o = s.taboption('modem', form.DummyValue, '_sims_hint', _('SIM overrides'));
		o.rawhtml = true;
		o.default = _('Per-card PIN/APN overrides (matched by ICCID) are managed on <a href="%s">Network → Modems</a>.').format(L.url('admin/network/wwand-modems'));
	}
};

/* `wwand` is the current proto name; the historical `qmi` alias is registered by
   the sibling protocol/qmi.js, which shares this exact descriptor (exposed below
   as WwandProto.descriptor). Each file registers its OWN protocol name and
   returns that registration — a LuCI protocol module must return a valid
   constructor for the name it is loaded as, so qmi.js cannot just return this
   class. New interfaces and every save use `proto wwand`. */
var WwandProto = network.registerProtocol('wwand', wwandProtocol);
WwandProto.descriptor = wwandProtocol;
return WwandProto;
