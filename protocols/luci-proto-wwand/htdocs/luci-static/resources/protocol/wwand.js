'use strict';
'require dom';
'require ui';
'require uci';
'require form';
'require network';
'require wwand.bands as bands';
'require wwand.modemopts as modemopts';
'require wwand.rpc as wrpc';
'require wwand.format as fmt';
'require wwand.modemsid as modemsid';

/* Network-native model: radio/SIM/hardware options live on a `config wwand_modem`
   section in /etc/config/network, referenced from the interface via `option
   modem`; the interface itself carries only the connection (apn/auth/pdp/mux).
   The shared wwand.modemsid helpers let the proto form (which binds to the
   interface section) transparently store the modem options in the wwand_modem
   section, creating it + `option modem` on first save, and reading a legacy
   inline value when no wwand_modem exists yet — so saving ALWAYS converts an
   old config to new-style. */
var modemSid = modemsid.modemSid;
var bindModem = modemsid.bindModem;

/* Talk to the wwand daemon directly over ubus (it exposes the 'wwand'
   object; declarations live in the shared wwand.rpc module). Read-only
   queries plus the manual PIN release; interface configuration is written to
   /etc/config/network via the normal uci path. */
var callStatus = wrpc.status;
var callSignal = wrpc.signal;
var callCells = wrpc.cells;

/* manual PIN release past the low-retry safety block */
var callPinVerify = wrpc.pinVerify;

/* Band/frequency helpers live in the shared wwand.bands module (single
   source of truth across the proto handler and the status page). */



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

/* shared two-column table renderer (wwand.format); this handler uses the
   33% label column it always had */
function tbl(rows) {
	return fmt.tbl(rows, 33);
}

/* Compact modem/registration/signal summary for the general tab. */
function renderStatus(netdev, onAdd, section_id) {
	return L.resolveDefault(callStatus(), {}).then(function(modems) {
		/* the interface's `option modem` reference is authoritative — the
		   netdev-prefix heuristic below can pick the WRONG modem after a
		   reboot swaps kernel netdev names (another modem may now own
		   'wwan0' while this connection's mux child is still 'wwan0m1');
		   the heuristic remains only for legacy inline configs */
		var name = (section_id && modems) ? modemSid(section_id) : null;

		if (!name || !modems[name])
			name = pickModem(modems, netdev);
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
				rows.push([ _('Note'), E('span', { 'style': 'color:#b8860b' },
					/* array: the note is daemon text, and a bare string would go
					   in through innerHTML (luci.js:1394-96) */
					[ modem.control_note ]) ]);

			/* the card's own last word — a session it closed and why, an
			   internal recovery, an activation that failed. Same escaping rule:
			   daemon text goes in as an array child, never as a bare string. */
			if (modem.sim_busy)
				rows.push([ _('SIM card'), E('span', { 'style': 'color:#c00;font-weight:bold' },
					[ _('busy — reads failing') ]) ]);
			else if (modem.sim_note)
				rows.push([ _('SIM card'), E('span', { 'style': 'color:#c00' },
					[ modem.sim_note ]) ]);

			/* only when the modem is holding the RADIO back — the daemon already
			   excluded environmental limits from `mitigated`, so a modem that is
			   merely cold does not raise an alarm in a connection dialog */
			if (modem.thermal && modem.thermal.mitigated)
				rows.push([ _('Thermal'), E('span', { 'style': 'color:#c00;font-weight:bold' },
					[ _('throttling, level %d').format(modem.thermal.level || 0) ]) ]);

			var opLine = fmt.fmtOperator(reg);
			if (opLine)
				rows.push([ _('Operator'), opLine ]);
			rows.push([ _('Registration'), fmt.regShort(reg) ]);

			/* SIM identity, when the card is readable (ICCID pre-PIN; IMSI/MSISDN
			   after unlock) — same trio as the Status page */
			if (modem.iccid)  rows.push([ _('ICCID'), modem.iccid ]);
			if (modem.imsi)   rows.push([ _('IMSI'), modem.imsi ]);
			if (modem.msisdn) rows.push([ _('MSISDN'), modem.msisdn ]);

			var lte = sig.lte;
			if (lte && fmt.hasSignal(lte.rsrp))
				rows.push([ _('LTE signal'), 'RSRP %d dBm · RSRQ %d dB · SNR %s dB · RSSI %d dBm'.format(
					lte.rsrp, lte.rsrq, (lte.snr/10).toFixed(1), lte.rssi) ]);
			var nr = sig.nr5g;
			if (nr && fmt.hasSignal(nr.rsrp))
				rows.push([ _('5G signal'), 'RSRP %d dBm · SNR %s dB'.format(
					nr.rsrp, (nr.snr/10).toFixed(1)) ]);

			var lc = cells.lte_intra;
			if (lc) {
				var ef = bands.lteEarfcn(lc.earfcn);
				rows.push([ _('Serving cell'), 'LTE %s%s · EARFCN %d · PCI %d · TAC %d'.format(
					ef ? ef.band : '?', ef ? ' (%s)'.format(fmt.mhz(ef.mhz)) : '',
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
					E('strong', { 'style': 'color:#d9534f' }, [ exhausted
						? _('SIM PIN blocked — 0 attempts left, PUK required.')
						: _('SIM PIN entry paused — %d attempt(s) left.').format(sb.retries != null ? sb.retries : 1) ]),
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
		/* the interface's `option modem` reference is authoritative (same fix
		   as renderStatus): the netdev-prefix heuristic can pick the WRONG
		   modem after a reboot swaps kernel netdev names — and a cell lock
		   applied to the wrong modem is much worse than a wrong status page */
		var name = (section_id && modems) ? modemSid(section_id) : null;
		if (!name || !modems[name])
			name = pickModem(modems, netdev);
		if (!name)
			return E('em', {}, _('no modem'));

		return Promise.all([
			L.resolveDefault(callSignal(name), {}),
			L.resolveDefault(callCells(name), {})
		]).then(function(res) {
			var sig = res[0] || {}, cells = (res[1] || {}).cells || {};
			var out = [];
			var lc = cells.lte_intra;
			var val = function(x) { return (x == null) ? '—' : x; };
			var mhz = function(f) { return val(f && fmt.mhz(f.mhz)); };

			if (lc) {
				var ef = bands.lteEarfcn(lc.earfcn);
				var srv = null;
				(lc.cells || []).forEach(function(c) { if (c.pci == lc.serving_cell_id) srv = c; });
				var srvLock = '%d:%d'.format(lc.earfcn, lc.serving_cell_id);

				out.push(E('p', {}, E('strong', {}, _('LTE serving cell'))));
				out.push(tbl([
					[ _('Technology'), 'LTE' ],
					[ _('Band'), ef ? ef.band : '—' ],
					[ _('Frequency'), mhz(ef) ],
					[ _('Bandwidth'), val(fmt.mhz(lc.bandwidth != null ? lc.bandwidth/1000 : null)) ],
					[ _('EARFCN'), '' + lc.earfcn ],
					[ _('PCI'), E('span', {}, [
						'%d  →  '.format(lc.serving_cell_id), E('code', {}, srvLock),
						lockBtn(onAdd, section_id, '4g', srvLock, _('Lock this cell')) ]) ],
					[ _('Signal'), 'RSRP %s · RSRQ %s · SNR %s · RSSI %s'.format(
						srv ? fmt.dBm(srv.rsrp) : (sig.lte ? sig.lte.rsrp + ' dBm' : '—'),
						srv ? fmt.dB(srv.rsrq) : (sig.lte ? sig.lte.rsrq + ' dB' : '—'),
						sig.lte ? fmt.dB(sig.lte.snr) : '—',
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
							E('td', { 'class': 'td' }, [ '' + c.pci ]),
							E('td', { 'class': 'td' }, fmt.dBm(c.rsrp)),
							E('td', { 'class': 'td' }, fmt.dB(c.rsrq)),
							E('td', { 'class': 'td' }, E('code', {}, v)),
							E('td', { 'class': 'td' }, lockBtn(onAdd, section_id, '4g', v))
						]);
					}))));
				}
			}

			var nc = cells.nr5g_cell;
			if (nc) {
				var nf = bands.nrArfcn(cells.nr5g_arfcn);
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
					[ _('Bandwidth'), val(fmt.mhz(nc.bandwidth != null ? nc.bandwidth/1000 : null)) ],
					[ _('ARFCN'), '' + (cells.nr5g_arfcn || '?') ],
					[ _('PCI'), E('span', {}, [
						'' + nc.pci,
						nrLock ? E('span', {}, [ '   →  ', E('code', {}, nrLock),
							lockBtn(onAdd, section_id, '5g', nrLock, _('Lock this 5G cell')) ]) : '' ]) ],
					[ _('Signal'), 'RSRP %s · RSRQ %s · SNR %s'.format(
						fmt.dBm(nc.rsrp), fmt.dB(nc.rsrq), fmt.dB(nc.snr)) ]
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
			/* the modal was closed → element gone: stop polling (and free the
			   guard so a later re-open re-registers) instead of leaking a 5s
			   poller that keeps issuing ubus calls for the page's lifetime */
			if (!document.getElementById(elId)) {
				L.Poll.remove(refresh);
				delete _polled[elId];
				return Promise.resolve();
			}
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

		/* the modem REFERENCE (`option modem 'wwmodem0'` on the interface) —
		   not a device name: netdev/cdc-wdm names follow USB enumeration
		   order and can swap on reboot. The hardware binding (path/device/
		   serial) lives in the referenced wwand_modem section. */
		o = s.taboption('general', form.ListValue, 'modem', _('Modem'),
			_('The configured modem this connection runs on (its wwand_modem section, e.g. wwmodem0). Several connections can share one modem via different mux channels; the hardware binding and SIM/radio settings live on the tabs below or on Network → Modems.'));
		o.rmempty = false;
		o.load = function(section_id) {
			return L.resolveDefault(callStatus(), {}).then(L.bind(function(modems) {
				var opt = this, listed = 0;
				uci.sections('network', 'wwand_modem').forEach(function(ms) {
					var n = ms['.name'];
					var m = (modems || {})[n];
					var extra = m ? [ m.model, m.netdev ].filter(Boolean).join(' · ')
					              : (ms.path || ms.device || '');
					opt.value(n, extra ? '%s (%s)'.format(n, extra) : n);
					listed++;
				});
				if (!listed)
					opt.value('', _('(no modem configured — add one on Network → Modems)'));
				return form.ListValue.prototype.load.apply(this, [section_id]);
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
			_('Stable L3 device name for this connection (wwand0…wwand100). Leave empty — the daemon assigns the next free wwandN, renames the kernel netdev (or creates the mux child) accordingly and writes the name back here; set a value to pin it. Reference this name in a VRF port or firewall device match.'));
		o.ucioption = 'device';
		o.rmempty = true;
		o.placeholder = 'wwand0';

		/* ---- Connection (interface-owned) ---- */
		o = s.taboption('connection', form.Value, 'apn', _('APN'),
			_('Leave empty for the default APN (or the SIM override / network default), or "#N" to use modem profile N as-is.'));

		o = s.taboption('connection', form.ListValue, 'pdp_type', _('PDP type'),
			_('IP version(s) to request for the bearer and the LTE attach. IPv4+IPv6 is recommended — some subscriptions reject an IPv4-only attach (EMM cause 33).'));
		o.default = 'ipv4v6';
		o.value('ipv4v6', _('IPv4 + IPv6'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		/* Read a legacy `pdptype` (old proto js), write the canonical pdp_type —
		   and fold the case. The stock qmi/mbim protos and the tools people
		   migrate from write IPV4V6 / IPV4, and this list only carries the
		   lowercase spellings: an uppercase value matched no choice, so the
		   widget fell back to the default and saving REWROTE the user's setting
		   without anyone asking. Field-found on a migrated config (2026-09-01).
		   The daemon folds the same way, so both sides agree on what is stored. */
		o.cfgvalue = function(sid) {
			var v = uci.get('network', sid, 'pdp_type') || uci.get('network', sid, 'pdptype');
			return (typeof v == 'string') ? v.toLowerCase() : v;
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

		o = s.taboption('connection', form.Value, 'password', _('PAP/CHAP password'),
			_('Password for the APN authentication.'));
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

		o = s.taboption('connection', form.Flag, 'hard_reconnect_on_ip_change', _('Hard reconnect on IP change'),
			_('On a reconnect that changes the IP, do a link down/up instead of an in-place renew, so dependent tunnels (gre/xfrm/IPsec) re-follow the new address. Costs this WAN a brief blip + IPv6-PD/VRF rebuild. WireGuard does not need it. Default off.'));

		o = s.taboption('connection', form.Flag, 'defaultroute', _('Use default gateway'),
			_('If unchecked, no default route is configured.'));
		o.default = o.enabled;

		o = s.taboption('connection', form.Value, 'metric', _('Use gateway metric'),
			_('Routing metric for this interface\'s default route — higher values lose against lower ones when several WANs are up.'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.depends('defaultroute', '1');

		o = s.taboption('connection', form.Flag, 'peerdns', _('Use DNS servers advertised by peer'),
			_('Use the DNS servers the network hands out with the data session. Disable only if you run your own resolvers — without any DNS, hostname-based services (e.g. eSIM downloads) fail.'));
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
		o.default = _('Per-card PIN/APN overrides (matched by ICCID or IMSI) are managed on <a href="%s">Network → Modems</a>.').format(L.url('admin/network/wwand'));
	}
};

/* `wwand` is the only proto this handler registers. The historical `qmi` alias
   was dropped (see the Makefile): proto qmi stays with luci-proto-qmi/uqmi, and
   interfaces are moved to proto wwand via the migration list in the modem page. */
return network.registerProtocol('wwand', wwandProtocol);
