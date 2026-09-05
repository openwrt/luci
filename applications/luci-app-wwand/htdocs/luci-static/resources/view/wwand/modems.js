'use strict';
'require view';
'require form';
'require ui';
'require uci';
'require wwand.modemopts as modemopts';
'require wwand.simlist as simlist';
'require wwand.rpc as wrpc';
'require wwand.format as fmt';

/* Network → Modems: interfaces-style overview. One row per configured
   wwand_modem with live status columns (state, SIM, registration, signal) and
   per-row actions: Config (the modal uci editor, shared wwand.modemopts) and
   Tools (jumps to the Modem Tools page for that modem). Detected-but-
   unconfigured control devices (ubus modem_probe `present` without
   `managed_by`) are listed below with a one-click Configure. The per-ICCID/IMSI
   wwand_sim override list (shared wwand.simlist) closes the page. */

/* ubus declarations live in the shared wwand.rpc module */
var callStatus = wrpc.status;
var callProbe = wrpc.probe;
var callSignal = wrpc.signal;
var callContexts = wrpc.contexts;

/* compact registration/SIM mappings live in the shared wwand.format module */
var fmtReg = fmt.fmtRegistration;
var fmtSim = fmt.fmtSim;

function fmtSignal(sig) {
	var parts = [];

	if (sig && sig.lte && fmt.hasSignal(sig.lte.rsrp))
		parts.push('LTE %d dBm'.format(sig.lte.rsrp));

	if (sig && sig.nr5g && fmt.hasSignal(sig.nr5g.rsrp))
		parts.push('NR %d dBm'.format(sig.nr5g.rsrp));

	return parts.length ? parts.join(' / ') : '-';
}

function fmtState(mi) {
	if (!mi)
		return _('not running');

	return mi.state + (mi.control_note ? ' (' + mi.control_note + ')' : '');
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('network'),
			L.resolveDefault(callStatus(), {}),
			L.resolveDefault(callProbe(), {}),
			L.resolveDefault(callContexts(), {}),
		]).then(function(r) {
			var status = r[1] || {};
			var names = Object.keys(status);

			return Promise.all(names.map(function(n) {
				return L.resolveDefault(callSignal(n), {});
			})).then(function(sigs) {
				var signals = {};
				names.forEach(function(n, i) { signals[n] = sigs[i] || {}; });
				return { status: status, probe: r[2] || {}, contexts: r[3] || {}, signals: signals };
			});
		});
	},

	render: function(data) {
		var status = data.status || {};
		var signals = data.signals || {};
		var contexts = data.contexts || {};

		/* per-modem connection counts from the context map (keyed by interface;
		   each entry carries .modem and .state). */
		var conns = {};
		Object.keys(contexts).forEach(function(cn) {
			var c = contexts[cn] || {}, mn = c.modem;
			if (!mn) return;
			conns[mn] = conns[mn] || { up: 0, total: 0 };
			conns[mn].total++;
			if (c.state == 'CONNECTED') conns[mn].up++;
		});

		var m = new form.Map('network', _('Mobile Modems'),
			_('Cellular modems managed by wwand. Each modem is referenced from an interface (Network → Interfaces, protocol "Cellular / 5G") by its name; several interfaces can share one modem through different mux channels. "Config" edits the modem, "Tools" opens band/operator/SIM/eSIM/SMS tools for it.'));

		var s = m.section(form.GridSection, 'wwand_modem', _('Modems'),
			_('Add a modem here, then point an interface at it with the "Modem" field on the interface page.'));
		s.addremove = true;
		s.anonymous = false;
		s.addbtntitle = _('Add modem');
		s.nodescriptions = false;
		s.modaltitle = function(section_id) { return _('Modem') + ' ' + section_id; };

		s.tab('modem', _('Modem & SIM'), _('Which modem, and its SIM.'));
		s.tab('radio', _('Radio & Cell'), _('Radio technology, manual operator selection and cell lock.'));
		s.tab('resilience', _('Resilience'), _('Recovery, watchdogs and telemetry cadence.'));

		/* on this page the edited section IS the wwand_modem — direct storage */
		var direct = function(o) { return o; };

		s.taboption('modem', form.Value, 'device', _('Modem device'),
			_('Network device name (e.g. wwan0), a mux parent, or a control node (/dev/cdc-wdm0). Leave empty and set only the USB path to bind purely by topology.'));

		modemopts.addModemSim(s, 'modem', direct);
		modemopts.addRadio(s, 'radio', direct);
		modemopts.addCellLock(s, 'radio', direct);
		modemopts.addResilience(s, 'resilience', direct);

		/* the whole config form lives in the Config modal — keep the table to
		   the live status columns added below */
		s.children.forEach(function(o) { o.modalonly = true; });

		var col = function(name, title, fn) {
			var o = s.option(form.DummyValue, name, title);
			o.modalonly = false;
			o.write = function() {};
			o.remove = function() {};
			o.cfgvalue = function(section_id) { return fn(section_id); };
			return o;
		};

		col('_dev', _('Device'), function(sid) {
			var mi = status[sid];
			var dev = (mi && mi.netdev) || uci.get('network', sid, 'device') || '?';
			return dev + ((mi && mi.model) ? ' (' + mi.model + ')' : '');
		});
		col('_backend', _('Backend'), function(sid) {
			var mi = status[sid];
			return (mi && mi.protocol) ? mi.protocol.toUpperCase() : '—';
		});
		col('_conns', _('Connections'), function(sid) {
			var c = conns[sid];
			if (!c || !c.total) return '—';
			return (c.up == c.total) ? '%d'.format(c.up) : '%d / %d'.format(c.up, c.total);
		});
		col('_state', _('State'), function(sid) { return fmtState(status[sid]); });
		col('_sim', _('SIM'), function(sid) { return fmtSim(status[sid]); });
		col('_reg', _('Registration'), function(sid) { return fmtReg(status[sid]); });
		col('_sig', _('Signal'), function(sid) { return fmtSignal(signals[sid]); });

		/* the currently-used dial params + PIN for a modem, reconstructed from
		   UCI (the effective config is resolved only at dial time and is not on
		   the status bus): PIN from the wwand_modem default, APN/auth/credentials
		   from the first interface that points at this modem. Feeds the one-click
		   "Save SIM" (per-ICCID override) button below. */
		var simParamsFrom = function(sid) {
			var out = {};
			var pin = uci.get('network', sid, 'pincode');
			if (pin) out.pincode = pin;
			var iface = null;
			uci.sections('network', 'interface', function(s) {
				if (!iface && s.modem == sid &&
				    (s.proto == 'wwand' || s.proto == 'qmi' || s.proto == 'mbim' || s.proto == 'ncm'))
					iface = s;
			});
			if (iface)
				[ 'apn', 'auth', 'username', 'password' ].forEach(function(k) {
					if (iface[k] != null && iface[k] !== '') out[k] = iface[k];
				});
			return out;
		};

		/* row actions: Config (the native modal editor) + Status/Tools jumps */
		s.renderRowActions = function(section_id) {
			var td = form.GridSection.prototype.renderRowActions.call(this, section_id, _('Config'));
			var box = td.firstElementChild || td;

			/* This cell used to hold up to nine buttons — Config, Status, Tools,
			   Unlock SIM, Save SIM, Reattach, Reboot, Repower and the trailing
			   Delete — and LuCI's actions column does not wrap, so on a modem
			   that offered them all the row ran off the right edge of the table
			   (field report with a screenshot, RUTM11). Everything from Tools on
			   now lives in one dropdown (below), which leaves four. The wrapping
			   flex row stays as the backstop for a narrow column: the buttons
			   keep their theme styling and stay right-aligned, they just fold
			   onto a second line rather than overflowing. */
			box.style.display = 'flex';
			box.style.flexWrap = 'wrap';
			box.style.justifyContent = 'flex-end';
			box.style.gap = '.25em';

			var jump = function(label, title, url) {
				return E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'title': title,
					'click': function(ev) {
						ev.preventDefault();
						window.location = url + '?modem=' + encodeURIComponent(section_id);
					},
				}, label);
			};

			/* Reboot: GPIO-first then backend soft reset (ubus modem_reset).
			   Confirm first — it drops this modem's connection(s) briefly. */
			var reboot = E('button', {
				'class': 'btn cbi-button cbi-button-negative',
				'title': _('Reset/reboot this modem (GPIO reset if available, otherwise a backend soft reset). Its connections drop briefly and recover on their own.'),
				'click': ui.createHandlerFn(this, function(ev) {
					ev.preventDefault();
					if (!confirm(_('Reset modem "%s" now? Its connection(s) will drop briefly and recover automatically.').format(section_id)))
						return;
					return wrpc.modemReset(section_id).then(function(res) {
						if (res && (res.ok || res.resetting))
							ui.addNotification(null, E('p', {}, [ _('Modem reset triggered (%s).').format(res.action || '?') ]), 'info');
						else
							ui.addNotification(null, E('p', {}, [ _('Reset unavailable: %s.').format((res && res.error) || _('no reset control')) ]), 'warning');
					});
				}),
			}, _('Reboot'));

			/* Repower: the HARDWARE rung — reset-GPIO pulse or board power-cycle
			   (ubus modem_repower). Recovers a hung or vanished modem where the
			   soft reset can't reach it. Multi-modem boxes need a per-modem
			   reset_gpio; the daemon surfaces that error here. */
			var repower = E('button', {
				'class': 'btn cbi-button cbi-button-negative',
				'title': _('Hardware repower: pulse the reset GPIO (or power-cycle the modem) — recovers a hung or vanished modem. Needs a reset_gpio on multi-modem boxes.'),
				'click': ui.createHandlerFn(this, function(ev) {
					ev.preventDefault();
					if (!confirm(_('Hard-repower modem "%s" now? This cuts and restores the modem\'s power/reset line.').format(section_id)))
						return;
					return wrpc.modemRepower(section_id).then(function(res) {
						if (res && res.ok)
							ui.addNotification(null, E('p', {}, [ _('Modem repowered (%s).').format(res.action || '?') ]), 'info');
						else
							ui.addNotification(null, E('p', {}, [ _('Repower unavailable: %s.').format((res && res.error) || _('no power/reset control')) ]), 'warning');
					});
				}),
			}, _('Repower'));

			/* Reattach: force a network deregister + re-register (QMI opmode
			   bounce, else AT+COPS) so automatic selection re-scans — for a
			   modem stuck on a previously-selected PLMN. Lighter than Reboot:
			   no modem reset, the PDP context re-establishes on its own. */
			var reattach = E('button', {
				'class': 'btn cbi-button cbi-button-neutral',
				'title': _('Force a network re-registration (deregister + re-attach) so automatic selection re-scans. Use when the modem stays on a network you manually selected earlier. The connection blips and recovers on its own; not a modem reset.'),
				'click': ui.createHandlerFn(this, function(ev) {
					ev.preventDefault();
					if (!confirm(_('Re-attach modem "%s" to the network now? It briefly deregisters and re-registers; the connection recovers automatically.').format(section_id)))
						return;
					return wrpc.modemReattach(section_id).then(function(res) {
						if (res && res.ok)
							ui.addNotification(null, E('p', {}, [ _('Network re-attach triggered (%s).').format(res.via || '?') ]), 'info');
						else
							ui.addNotification(null, E('p', {}, [ _('Re-attach unavailable: %s.').format((res && res.error) || '?') ]), 'warning');
					});
				}),
			}, _('Reattach'));

			/* Save SIM: capture this card's live ICCID + the modem's current
			   PIN/APN/auth into a per-ICCID wwand_sim override (the list below),
			   so a swapped-in card keeps its own PIN/APN. Only when a card with a
			   readable ICCID is present, and refused if one already exists. */
			var mi = status[section_id] || {};
			var liveIccid = mi.iccid ? ('' + mi.iccid).replace(/[^0-9]+$/, '') : '';
			var saveSim = liveIccid ? E('button', {
				'class': 'btn cbi-button cbi-button-neutral',
				'title': _('Create a per-ICCID SIM override for the inserted card (ICCID %s), pre-filled with the modem\'s current PIN and the interface APN/auth. Edit it in the SIMs list below, then Save & Apply.').format(liveIccid),
				'click': ui.createHandlerFn(this, function(ev) {
					ev.preventDefault();
					var dup = null;
					uci.sections('network', 'wwand_sim', function(sc) {
						var ic = ('' + (sc.iccid || '')).replace(/[^0-9]+$/, '');
						if (ic && ic == liveIccid) dup = sc['.name'];
					});
					if (dup) {
						ui.addNotification(null, E('p', {}, [ _('A SIM override for ICCID %s already exists (section %s) — edit it in the SIMs list below.').format(liveIccid, dup) ]), 'warning');
						return;
					}
					var p = simParamsFrom(section_id);
					ui.addNotification(null, E('p', {}, [ _('Created SIM override for ICCID %s — review it in the SIMs list below, then Save & Apply.').format(liveIccid) ]), 'info');
					/* stage in the save callback — see the Configure button:
					   parse() would strip options of a not-yet-rendered row */
					return m.save(function() {
						var nsid = uci.add('network', 'wwand_sim');
						uci.set('network', nsid, 'iccid', liveIccid);
						Object.keys(p).forEach(function(k) { uci.set('network', nsid, k, p[k]); });
					}, true);
				}),
			}, _('Save SIM')) : null;

			/* Unlock SIM: shown only while the daemon reports a SIM block.
			   PUK-class blocks (puk_required / retries_exhausted) get a PUK +
			   new-PIN dialog (ubus modem_sim_puk — a wrong PUK consumes one of
			   ~10 attempts, 0 left destroys the SIM, hence the loud warning);
			   PIN-class blocks get the manual PIN release (modem_sim_pin_verify,
			   entering past the low-retry safety guard). */
			var unlockSim = mi.sim_block ? E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'title': _('Unlock the blocked SIM (%s)').format(mi.sim_block.reason || '?'),
				'click': ui.createHandlerFn(this, function(ev) {
					ev.preventDefault();
					var reason = mi.sim_block.reason || '';
					var isPuk = (reason == 'puk_required' || reason == 'retries_exhausted');

					var fields = isPuk ? [
						E('p', { 'class': 'alert-message warning' },
							[ _('This SIM is PUK-locked (%s). A WRONG PUK consumes one of ~10 attempts — after the last one the SIM is permanently destroyed. The PUK is printed on the SIM carrier or available from the provider.').format(reason) ]),
						E('p', {}, [ _('PUK (8 digits)'), E('br'), E('input', { 'id': 'wwand-puk', 'type': 'text', 'maxlength': 8, 'class': 'cbi-input-text' }) ]),
						E('p', {}, [ _('New PIN (4-8 digits)'), E('br'), E('input', { 'id': 'wwand-newpin', 'type': 'text', 'maxlength': 8, 'class': 'cbi-input-text' }) ]),
					] : [
						E('p', {}, [ _('The daemon refuses to auto-enter the PIN (%s) to protect the last attempts. Enter the PIN to release it manually.').format(reason) ]),
						E('p', {}, [ _('PIN'), E('br'), E('input', { 'id': 'wwand-pin', 'type': 'text', 'maxlength': 8, 'class': 'cbi-input-text' }) ]),
					];

					ui.showModal(isPuk ? _('Enter PUK — SIM %s').format(mi.iccid || section_id)
					                   : _('Release PIN — SIM %s').format(mi.iccid || section_id),
						fields.concat([ E('div', { 'class': 'right' }, [
							E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
							' ',
							E('button', { 'class': 'btn cbi-button cbi-button-negative',
								'click': ui.createHandlerFn(this, function() {
									var done = function(res, okText) {
										ui.hideModal();
										if (res && res.ok)
											ui.addNotification(null, E('p', {}, [ okText ]), 'info');
										else
											ui.addNotification(null, E('p', {},
												[ _('Unlock failed: %s').format((res && (res.error + (res.detail ? ' (' + JSON.stringify(res.detail) + ')' : ''))) || '?') ]), 'error');
									};
									if (isPuk) {
										var puk = (document.getElementById('wwand-puk').value || '').trim();
										var npin = (document.getElementById('wwand-newpin').value || '').trim();
										if (!/^[0-9]{8}$/.test(puk)) { ui.addNotification(null, E('p', {}, _('The PUK must be exactly 8 digits.')), 'error'); return; }
										if (!/^[0-9]{4,8}$/.test(npin)) { ui.addNotification(null, E('p', {}, _('The new PIN must be 4-8 digits.')), 'error'); return; }
										return wrpc.simPuk(section_id, puk, npin).then(function(res) {
											done(res, _('SIM unblocked, new PIN set. Update the configured PIN in the modem settings!'));
										});
									}
									var pin = (document.getElementById('wwand-pin').value || '').trim();
									return wrpc.pinVerify(section_id, pin).then(function(res) {
										done(res, _('PIN release requested — the modem restarts its bring-up.'));
									});
								}),
							}, isPuk ? _('Unblock SIM') : _('Enter PIN')),
						]) ]));
				}),
			}, _('Unlock SIM')) : null;

			/* Everything from Tools on goes into ONE dropdown, so the row shows
			   Config, Status, the menu and Delete instead of up to nine buttons
			   competing for a column that does not wrap. Config and Status stay
			   outside because they are the two anyone reaches for daily; the
			   rest are occasional, and three of them ask for confirmation
			   anyway.

			   The buttons themselves are unchanged and simply never inserted
			   into the page — picking an entry clicks the corresponding one, so
			   every confirm, spinner and notification keeps working exactly as
			   it did when it had its own button. */
			var menu = {}, acts = {};
			var add = function(key, label, el) {
				if (!el) return;
				menu[key] = label;
				acts[key] = el;
			};

			add('tools', _('Tools'),
				jump(_('Tools'), _('Band, operator, SIM, eSIM and SMS tools for this modem'),
					L.url('admin/network/wwand-tools')));
			add('unlock', _('Unlock SIM'), unlockSim);
			add('savesim', _('Save SIM'), saveSim);
			add('reattach', _('Reattach'), reattach);
			add('reboot', _('Reboot'), reboot);
			add('repower', _('Repower'), repower);

			var dd = new ui.Dropdown(null, menu, {
				optional: true,
				/* explicit order: the default sorts alphabetically, which would
				   put Repower and Reboot above Tools */
				sort: Object.keys(menu),
				select_placeholder: _('Actions'),
				display_items: 1,
				dropdown_items: -1,
			});

			var ddNode = dd.render();
			var acting = false;

			ddNode.addEventListener('cbi-dropdown-change', function(ev) {
				if (acting)
					return;

				/* detail.value is the selected ITEM ({text, value, element}),
				   not the key. Note dd.getValue() is no use here: the base
				   accessor only reads `select`/`input` nodes and a rendered
				   dropdown is a div, so it always answers null. */
				var sel = ev.detail && ev.detail.value;
				var el = (sel && sel.value) ? acts[sel.value] : null;

				/* This is a menu, not a stored setting, so put it back to the
				   placeholder — otherwise the entry just used stays displayed
				   and cannot be picked a second time. setValues() is LuCI
				   internal (it is what clearChoices(true) uses); it re-selects
				   the placeholder item, and re-fires this event, hence the
				   guard. */
				acting = true;
				dd.setValues(dd.node, {});
				acting = false;

				if (el)
					el.click();
			});

			var extra = [
				jump(_('Status'), _('Live status page (signal, cells, connection) for this modem'),
					L.url('admin/status/wwand')),
				ddNode,
			];

			/* between Config and the trailing Delete button when present */
			extra.forEach(function(b) {
				if (box.lastElementChild)
					box.insertBefore(b, box.lastElementChild);
				else
					box.appendChild(b);
			});

			return td;
		};

		/* Deleting a modem is not like deleting a row in a list: every interface
		   that names it stops having a modem, and the connection those carry
		   goes with it on the next Save & Apply. The button sits next to
		   Config, one position away from where the mouse already is, and LuCI
		   removes without asking — so ask, and say what is attached. Overriding
		   handleRemove rather than the button covers every path that removes a
		   section, not just this one click. */
		s.handleRemove = function(section_id /*, ev */) {
			var used = [];

			uci.sections('network', 'interface', function(sc) {
				if (sc.proto == 'wwand' && sc.modem == section_id)
					used.push(sc['.name']);
			});

			var msg = used.length
				? _('Delete modem "%s"? It is still used by: %s. Those interfaces lose their modem and their connection when you Save & Apply.')
					.format(section_id, used.join(', '))
				: _('Delete modem "%s"?').format(section_id);

			if (!confirm(msg))
				return Promise.resolve();

			return form.GridSection.prototype.handleRemove.apply(this, arguments);
		};

		/* per-ICCID/IMSI SIM overrides (PIN/APN), shared wwand.simlist */
		simlist.addSimList(m, {});

		/* detected control devices without a wwand_modem section — offer a
		   one-click Configure that stages a prefilled section (saved with the
		   page's Save & Apply; wwand adopts the modem on config reload) */
		var present = (data.probe && data.probe.present) || [];
		var loose = present.filter(function(p) { return !p.managed_by; });

		var detected = '';

		if (loose.length) {
			var nextName = function() {
				var i = 0;
				while (uci.get('network', 'wwmodem' + i))
					i++;
				return 'wwmodem' + i;
			};

			detected = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Detected modems (unconfigured)')),
				E('p', {}, _('Control devices present on the system without a modem configuration. Configure stages a prefilled modem section — press Save & Apply afterwards, then attach an interface to it (or let autosetup handle it on an unconfigured system).')),
				E('table', { 'class': 'table' },
					[ E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Type')),
						E('th', { 'class': 'th' }, _('Device')),
						E('th', { 'class': 'th' }, _('Path')),
						E('th', { 'class': 'th' }, _('Serial')),
						E('th', { 'class': 'th' }, ''),
					]) ].concat(loose.map(function(p) {
						var dev = p.device || p.netdev || '?';
						var path = p.path || p.usb_path;
						return E('tr', { 'class': 'tr' }, [
							/* arrays: device, path and serial come from the probe,
							   i.e. from sysfs and the modem's USB descriptors */
							E('td', { 'class': 'td' }, [ (p.protocol || p.kind || '?').toUpperCase() ]),
							E('td', { 'class': 'td' }, [ dev ]),
							E('td', { 'class': 'td' }, [ path || '-' ]),
							E('td', { 'class': 'td' }, [ p.serial || '-' ]),
							E('td', { 'class': 'td' },
								E('button', { 'class': 'btn cbi-button cbi-button-apply',
									'click': function(ev) {
										/* Persist immediately. Staging the new
										   section via m.save() lets the page's next
										   parse() strip its options — parse() drops
										   staged options of sections without a
										   rendered row (isActive is a DOM check) — so
										   the path/device binding is lost on the
										   subsequent Save & Apply. add/set + save() +
										   apply() writes it straight to config,
										   bypassing the Map parse cycle. */
										var btn = ev.target;
										btn.disabled = true;
										btn.textContent = _('configuring…');
										var name = nextName();
										uci.add('network', 'wwand_modem', name);
										/* bind by stable sysfs path (survives
										   USB enumeration order); device name
										   only as last resort */
										if (path)
											uci.set('network', name, 'path', path);
										else
											uci.set('network', name, 'device', dev);
										return uci.save().then(function() {
											return uci.apply();
										}).then(function() {
											location.reload();
										}).catch(function(e) {
											btn.disabled = false;
											btn.textContent = _('Configure');
											ui.addNotification(null, E('p', {},
												[ _('Could not configure modem: %s').format(e) ]));
										});
									} }, _('Configure'))),
						]);
					}))),
			]);
		}

		/* interfaces still on a stock cellular proto (qmi/mbim/ncm) with no
		   `option modem` — wwand does not manage these until they are migrated.
		   Offer an in-place migration (proto -> wwand + a linked wwand_modem),
		   reusing the daemon's tested migrate engine over ubus. */
		var legacy = [];
		uci.sections('network', 'interface', function(s) {
			if ((s.proto == 'qmi' || s.proto == 'mbim' || s.proto == 'ncm' ||
			     s.proto == 'modemmanager') && !s.modem)
				legacy.push(s);
		});

		var migration = '';

		if (legacy.length) {
			var checked = {};
			var migRows = legacy.map(function(s) {
				var name = s['.name'];
				checked[name] = true;
				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' },
						E('input', { 'type': 'checkbox', 'checked': 'checked',
							'change': function(ev) { checked[name] = ev.target.checked; } })),
					/* arrays: an APN or device name reaches uci from a config
					   import or a provisioning tool, not only from this page */
					E('td', { 'class': 'td' }, [ name ]),
					E('td', { 'class': 'td' }, [ (s.proto || '?').toUpperCase() ]),
					E('td', { 'class': 'td' }, [ s.device || '-' ]),
					E('td', { 'class': 'td' }, [ s.apn || '-' ]),
				]);
			});

			var migBtn = E('button', { 'class': 'btn cbi-button cbi-button-apply',
				'click': ui.createHandlerFn(this, function() {
					var sel = legacy.map(function(s) { return s['.name']; })
						.filter(function(n) { return checked[n]; });

					if (!sel.length)
						return ui.addNotification(null, E('p', {}, _('No interface selected.')), 'warning');

					if (!confirm(_('Migrate %d interface(s) to proto wwand? Each is converted in place — its name, firewall zone and IP settings are kept — and wwand takes over managing it.').format(sel.length)))
						return;

					return wrpc.migrate(true, sel).then(function(res) {
						if (res && (res.ok || res.applied != null)) {
							ui.addNotification(null, E('p', {}, [ _('Migrated %d interface(s); reloading…').format(sel.length) ]), 'info');
							window.setTimeout(function() { location.reload(); }, 1500);
						}
						else {
							ui.addNotification(null, E('p', {}, [ _('Migration failed: %s').format((res && res.error) || _('unknown')) ]), 'error');
						}
					});
				}) }, _('Migrate selected'));

			migration = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Migratable interfaces')),
				E('p', {}, _('Interfaces still using a stock cellular protocol (qmi / mbim / ncm / modemmanager) that wwand does not manage yet. Select the ones to migrate and press "Migrate selected": each is converted in place to proto wwand (its name, firewall zone and IP settings are kept) and a wwand modem section is created and linked. When migrating a ModemManager interface, stop and remove the ModemManager service afterwards — it would otherwise keep claiming the modem\'s control port.')),
				E('table', { 'class': 'table' },
					[ E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, ''),
						E('th', { 'class': 'th' }, _('Interface')),
						E('th', { 'class': 'th' }, _('Protocol')),
						E('th', { 'class': 'th' }, _('Device')),
						E('th', { 'class': 'th' }, _('APN')),
					]) ].concat(migRows)),
				migBtn,
			]);
		}

		return m.render().then(function(mapNode) {
			return E('div', {}, [ mapNode, migration, detected ]);
		});
	},
});
