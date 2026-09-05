'use strict';
'require baseclass';
'require dom';
'require ui';
'require wwand.rpc as wrpc';
'require wwand.format as fmt';

/* SIM & eSIM management panel, extracted from view/wwand/settings.js: SIM
   slots (primary/switch), SIM PIN lock, and — on an eUICC — the eSIM profile
   list, profile download with live SGP.22 progress, and the pending operator
   notifications. render(ctx, data) returns the node array the settings page
   appends; ctx carries the pieces the page owns:
     ctx.simSlotUci(slot)          — persist the primary SIM slot to uci
     ctx.notifyEsimApply(modem, r) — surface how a profile switch applies
   data: { modem, info, slots, esim } as assembled by the settings view. */

var callSwitchSlot = wrpc.switchSlot;
var callPinLock = wrpc.pinLock;
var callEsim = wrpc.esim;

// lpac emits terse ES10/ES9+ step tokens on its progress lines; map them to the
// download stages a human recognises (order = the SGP.22 download sequence).
var DL_STEPS = [
	[ 'es10b_get_euicc_challenge_and_info', _('eUICC challenge') ],
	[ 'es9p_initiate_authentication',       _('Contacting SM-DP+') ],
	[ 'es10b_authenticate_server',          _('Verifying server') ],
	[ 'es9p_authenticate_client',           _('Authenticating') ],
	[ 'es10b_prepare_download',             _('Preparing download') ],
	[ 'es9p_get_bound_profile_package',     _('Fetching profile') ],
	[ 'es10b_load_bound_profile_package',   _('Installing profile') ],
];

// parse the live bridge log (progress:/result:/data: lines) into a status
function parseActivity(log) {
	var seen = {}, order = [], cancelled = false, msg = null, code = null, m;
	(log || '').split('\n').forEach(function(l) {
		l = l.trim();
		if ((m = l.match(/^progress:\s*(\S+)/))) {
			if (/cancel_session/.test(m[1])) cancelled = true;
			else if (!seen[m[1]]) { seen[m[1]] = true; order.push(m[1]); }
		} else if ((m = l.match(/^result:\s*code=(-?\d+)\s*(.*)$/))) {
			code = parseInt(m[1], 10);
			if (m[2] && m[2].trim() && m[2].trim() != 'success') msg = m[2].trim();
		} else if ((m = l.match(/^data:\s*(.+)$/))) {
			var d = m[1].trim();
			if (d.length && d[0] != '{') msg = d;   // human message, not the chip JSON blob
		}
	});
	return { seen: seen, order: order, cancelled: cancelled, msg: msg, code: code };
}

/* the shared .wwe-* CSS now lives in wwand.format (injected once by the hosting
   view); this panel and wwand.netsel just use the classes. */

return baseclass.extend({
	/* The modem's own eUICC profile read (QMI UIM), for a card whose ES10 lpac
	   cannot use. Rendered lazily into its own container: it is a second round
	   trip and only interesting once the lpac path has already failed. */
	renderNativeProfiles: function(data) {
		var box = E('div', {}, [ E('em', {}, [ _('Asking the modem directly…') ]) ]);

		/* the eUICC is not necessarily the ACTIVE slot — ask about the slot
		   that actually holds it, or neither path can reach the card */
		var slot = 1;
		(data.slots || []).forEach(function(sl) { if (sl.is_euicc) slot = sl.physical; });

		L.resolveDefault(wrpc.euiccProfiles(data.modem, slot), {}).then(function(r) {
			if (!r || r.ok === false || !(r.profiles || []).length) {
				var why = (r && r.detail && r.detail.error) || '';

				dom.content(box, E('p', {}, [ E('em', {}, [
					why == 'no_native_euicc'
						? _('This modem has no native eUICC interface either, so the card cannot be enumerated from the router at all.')
						: _('The modem returned no profiles for this slot.') ]) ]));
				return;
			}

			dom.content(box, [
				E('p', {}, [ _('Read from the modem directly (slot %d), bypassing ES10:').format(slot) ]),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, [ _('Profile') ]),
						E('th', { 'class': 'th' }, [ _('State') ]),
						E('th', { 'class': 'th' }, [ 'ICCID' ]),
						E('th', { 'class': 'th' }, [ _('Class') ]),
					]),
				].concat((r.profiles || []).map(function(p) {
					return E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, [ p.name || p.nickname || p.spn || _('(unnamed)') ]),
						E('td', { 'class': 'td' }, [ p.active ? _('active') : (p.state || '') ]),
						E('td', { 'class': 'td' }, [ p.iccid || '' ]),
						E('td', { 'class': 'td' }, [
							(p.class || '') + (p.policy && p.policy.delete_not_allowed
								? ' · ' + _('delete not allowed') : '') ]),
					]);
				}))),
			]);
		});

		return box;
	},

	render: function(ctx, data) {
		var self = this;
		var esimOk = data.esim && data.esim.ok !== false && data.esim.profiles;
		var out = [ E('h3', {}, _('SIM')) ];

		var slotRows = (data.slots || []).map(function(sl) {
			/* shared row renderer (wwand.format); the persist-to-uci button is
			   this panel's extra */
			var primaryBtn = E('button', { 'class': 'btn cbi-button', 'style': 'margin-left:8px',
				'click': ui.createHandlerFn(self, function() {
					return ctx.simSlotUci(sl.physical).then(function() {
						ui.addNotification(null, E('p', [ _('Primary SIM set to slot %d (persisted).').format(sl.physical) ]), 'info');
					});
				}) }, _('Set as primary'));
			return fmt.simSlotRow(sl, function(physical) {
				return callSwitchSlot(data.modem, physical);
			}, [ primaryBtn ]);
		});

		out.push(E('div', { 'class': 'cbi-section' },
			slotRows.length ? slotRows : [ E('em', {}, _('No slot information available.')) ]));

		/* --- SIM PIN lock: enable / disable the PIN query, with the current PIN --- */
		var minfo = data.info || {};
		/* a busy or departed card is now a KNOWN state rather than falling
		   through to "unknown" — the daemon learns it from the UIM indications,
		   and it also explains why the PIN state cannot be read right now */
		var pinState = (minfo.state == 'SIM_BLOCKED') ? _('blocked — PUK required')
			: minfo.sim_busy ? _('card busy — cannot be read right now')
			: (minfo.pin1 && minfo.pin1.enabled === false) ? _('disabled (SIM boots without PIN)')
			: (minfo.pin1 && minfo.pin1.enabled === true) ? _('enabled')
			: minfo.sim_note ? minfo.sim_note
			: _('unknown');
		var pinIn = E('input', { 'type': 'password', 'class': 'cbi-input-password',
			'style': 'width:12em', 'placeholder': _('current PIN') });
		var pinAct = function(enable) {
			var pin = (pinIn.value || '').trim();
			if (!pin) {
				ui.addNotification(null, E('p', _('Enter the current SIM PIN first.')), 'warning');
				return;
			}
			return callPinLock(data.modem, pin, enable).then(function(r) {
				if (r && r.ok === false)
					ui.addNotification(null, E('p', [ _('PIN change failed: %s').format(r.error || '?') ]), 'error');
				else
					ui.addNotification(null, E('p', enable ? _('SIM PIN query enabled.') : _('SIM PIN query disabled.')), 'info');
			});
		};

		out.push(E('h4', {}, _('SIM PIN')));
		out.push(E('div', { 'class': 'cbi-section' }, [
			/* array child: pinState can now carry daemon text (sim_note), and a
			   bare string goes in through innerHTML (luci.js:1394-96) */
			E('p', {}, [ _('PIN query: '), E('strong', {}, [ pinState ]) ]),
			E('div', { 'style': 'margin-bottom:4px' }, [
				pinIn, ' ',
				E('button', { 'class': 'btn cbi-button cbi-button-apply', 'style': 'margin-left:8px',
					'click': ui.createHandlerFn(self, function() { return pinAct(true); }) }, _('Enable PIN')),
				E('button', { 'class': 'btn cbi-button cbi-button-remove', 'style': 'margin-left:4px',
					'click': ui.createHandlerFn(self, function() { return pinAct(false); }) }, _('Disable PIN'))
			]),
			E('p', { 'style': 'color:#666;font-size:90%' },
				_('Enabling or disabling the PIN query needs the current PIN. Disabling lets the SIM boot without a PIN.'))
		]));

		/* per-SIM overrides (config wwand_sim) are edited on the Network →
		   Modems overview page (shared wwand.simlist) — single source, no
		   duplicate list here. */
		out.push(E('h4', {}, _('SIM overrides')));
		out.push(E('p', {}, [
			_('Per-card PIN/APN overrides (matched by ICCID or IMSI) are managed on '),
			E('a', { 'href': L.url('admin/network/wwand') }, _('Network → Modems')),
			'.'
		]));

		if (!esimOk) {
			if (data.esim && data.esim.error == 'esim_not_installed')
				out.push(E('p', {}, E('em', {}, _('eSIM management: package wwand-esim is not installed.'))));
			else if (data.esim && data.esim.detail && data.esim.detail.error == 'es10_refused') {
				out.push(E('h4', {}, _('eSIM')));
				out.push(E('div', { 'class': 'wwe-banner run' },
					[ _('eUICC detected, but the card refuses local eSIM management (ES10 rejected, SW %s).')
						.format(data.esim.detail.sw || '6985') ]));
				out.push(E('p', {}, _('This is the normal behaviour of M2M eUICCs (SGP.02) and of vendor-locked cards: profiles are managed over-the-air by the SIM provider (SM-SR), so downloading or switching profiles from this router is not possible. Use the provider’s portal to manage the card — the router only needs to keep the active profile registered and online.')));

				/* The one path left when the CARD refuses local management: ask
				   the MODEM instead. lpac talks ES10 to the card over an APDU
				   channel, which an SGP.02 eUICC declines by design; the modem's
				   own interface does not go through ES10 at all. Not every
				   firmware implements it — the answer says which case this is
				   rather than leaving an empty panel. */
				out.push(this.renderNativeProfiles(data));
			}
			return out;
		}

		var profRows = (data.esim.profiles || []).map(function(p) {
			var acts = [];
			if (p.state != 'enabled')
				acts.push(E('button', { 'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(self, function() {
						if (!confirm(_('Enable profile %s? The connection will re-establish.').format(p.iccid)))
							return;
						return callEsim(data.modem, 'enable', 0, p.iccid, '', '').then(function(res) { ctx.notifyEsimApply(data.modem, res) });
					}) }, _('Enable')));
			else
				acts.push(E('button', { 'class': 'btn cbi-button',
					'click': ui.createHandlerFn(self, function() {
						if (!confirm(_('Disable the active profile %s?').format(p.iccid)))
							return;
						return callEsim(data.modem, 'disable', 0, p.iccid, '', '').then(function(res) { ctx.notifyEsimApply(data.modem, res) });
					}) }, _('Disable')));
			acts.push(E('button', { 'class': 'btn cbi-button cbi-button-remove', 'style': 'margin-left:4px',
				'click': ui.createHandlerFn(self, function() {
					if (!confirm(_('Permanently DELETE profile %s from the eUICC?').format(p.iccid)))
						return;
					return callEsim(data.modem, 'delete', 0, p.iccid, '', '').then(function() { window.location.reload() });
				}) }, _('Delete')));
			return E('tr', { 'class': 'tr' }, [
				/* arrays, not bare strings: the provider/name/nickname of a
				   profile is free text the CARRIER put on the eUICC when it was
				   downloaded, and dom.append() routes a bare string through
				   innerHTML (luci.js:1394-96) */
				E('td', { 'class': 'td' }, [ p.iccid ]),
				E('td', { 'class': 'td' }, [ p.provider || p.name || p.nickname || '' ]),
				E('td', { 'class': 'td' }, [ p.state ]),
				E('td', { 'class': 'td' }, acts),
			]);
		});

		out.push(E('h4', {}, _('eSIM profiles')));
		out.push(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, 'ICCID'),
				E('th', { 'class': 'th' }, _('Provider')),
				E('th', { 'class': 'th' }, _('State')),
				E('th', { 'class': 'th' }, ''),
			]),
		].concat(profRows.length ? profRows : [
			E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td', 'colspan': 4 }, E('em', {}, _('no profiles'))) ]) ])));

		// shared activity panel: live progress for downloads / notifications
		var panel = E('div', { 'class': 'wwe-panel', 'style': 'display:none' });

		var mkBanner = function(kind, icon, text) {
			return E('div', { 'class': 'wwe-banner ' + kind }, [
				(kind == 'run') ? E('span', { 'class': 'wwe-spin' }) : E('span', {}, icon),
				/* array: callers pass lpac/daemon-derived text here */
				E('span', {}, [ text ]),
			]);
		};

		var renderPanel = function(st, mode) {
			panel.style.display = '';
			var a = parseActivity(st.log);
			var running = (st.state == 'running');
			var kids = [];

			if (mode == 'download') {
				var doneN = 0;
				var lastSeen = a.order.length ? a.order[a.order.length - 1] : null;
				var items = DL_STEPS.map(function(s) {
					var isDone = !!a.seen[s[0]];
					if (isDone) doneN++;
					var isCur = running && !a.cancelled && a.code === null && s[0] == lastSeen;
					var cls = isDone ? (isCur ? 'wwe-step cur' : 'wwe-step done') : 'wwe-step';
					return E('li', { 'class': cls }, [
						E('span', { 'class': 'ic' }, isDone ? (isCur ? '⟳' : '✓') : '○'),
						E('span', {}, s[1]),
					]);
				});
				// install acknowledgement to the operator (auto_notify) — its
				// state comes from the daemon phase, not an lpac progress token
				var ackDone = (st.notified === true);
				var ackCur = running && st.phase == 'notify';
				items.push(E('li', { 'class': ackDone ? 'wwe-step done' : (ackCur ? 'wwe-step cur' : 'wwe-step') }, [
					E('span', { 'class': 'ic' }, ackDone ? '✓' : (ackCur ? '⟳' : '○')),
					E('span', {}, _('Confirm install to operator')),
				]));

				var pct = Math.round(doneN / DL_STEPS.length * 100);
				var barcls = 'wwe-bar' + (a.code === 0 ? ' ok'
					: (!running && (a.code !== null || a.cancelled)) ? ' err' : '');
				kids.push(E('ul', { 'class': 'wwe-steps' }, items));
				kids.push(E('div', { 'class': barcls }, E('span', { 'style': 'width:' + pct + '%' })));
			}

			if (running)
				kids.push(mkBanner('run', '', mode == 'download' ? _('Downloading profile…') : _('Contacting operator…')));
			else if (a.code === 0 && !a.cancelled)
				kids.push(mkBanner('ok', '✓', mode != 'download' ? _('Done.')
					: (st.notified === false
						? _('Profile downloaded (install not yet confirmed to the operator).')
						: _('Profile downloaded and confirmed — the eUICC will re-initialise.'))));
			else
				kids.push(mkBanner('err', '✕', a.msg || _('The operation failed.')));

			if (st.log)
				kids.push(E('details', { 'class': 'wwe-det' }, [
					E('summary', {}, _('Show raw lpac log')),
					/* array: this is the raw lpac log, verbatim */
					E('pre', { 'class': 'wwe-log' }, [ st.log ]),
				]));

			dom.content(panel, kids);
		};

		/* A profile download runs for minutes over rpcd, so a single reply that
		   is missing or a promise that rejects (rpcd restarted, request timed
		   out) is normal enough to plan for. Without that, one such reply left
		   the panel spinning forever with nothing said -- the operation may well
		   have finished on the modem, and the page would never show it. Retry a
		   few times, then say so and stop. */
		var pollMisses = 0;
		var pollStatus = function(mode) {
			callEsim(data.modem, 'download_status', 0, '', '', '').then(function(st) {
				if (!st || st.state == null) {
					if (++pollMisses < 5)
						return window.setTimeout(function() { pollStatus(mode) }, 1200);
					return dom.content(panel, mkBanner('err', '',
						_('Lost contact with the download — reload to see its result.')));
				}

				pollMisses = 0;
				renderPanel(st, mode);
				if (st.state == 'running')
					window.setTimeout(function() { pollStatus(mode) }, 1200);
				else if (mode == 'download' && parseActivity(st.log).code === 0)
					window.setTimeout(function() { window.location.reload() }, 3000);
			}).catch(function(e) {
				if (++pollMisses < 5)
					return window.setTimeout(function() { pollStatus(mode) }, 1200);
				dom.content(panel, mkBanner('err', '',
					_('Lost contact with the download: %s').format(e && e.message || e)));
			});
		};

		var startBusy = function(text) {
			panel.style.display = '';
			dom.content(panel, mkBanner('run', '', text));
		};

		var dlHint = (data.esim.backend == 'at')
			? _('The modem downloads over its own network attach — no router data path or APN needed.')
			: _('lpac downloads on the router over your uplink and relays the eUICC APDUs through wwand — no dedicated modem APN needed.');

		out.push(E('h4', {}, _('Download profile')));
		out.push(E('p', {}, E('em', {}, dlHint)));

		var codeIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
			'style': 'width:min(440px,72%);margin-right:6px',
			'placeholder': 'LPA:1$rsp.example.com$MATCHING-ID' });
		var confIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
			'style': 'width:min(240px,42%);margin-right:6px',
			'placeholder': _('confirmation code (optional)') });
		var ackChk = E('input', { 'type': 'checkbox', 'checked': 'checked', 'style': 'margin:0 5px 0 0' });

		out.push(E('div', { 'class': 'cbi-section' }, [
			E('div', { 'style': 'margin-bottom:8px' }, [ codeIn, confIn,
				E('button', { 'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(self, function() {
						if (!(codeIn.value || '').trim()) {
							ui.addNotification(null, E('p', _('Enter an activation code first.')), 'warning');
							return;
						}
						startBusy(_('Starting download…'));
						return callEsim(data.modem, 'download', 0, '', codeIn.value, confIn.value, ackChk.checked).then(function(res) {
							if (res && res.ok === false)
								dom.content(panel, mkBanner('err', '✕', _('Could not start: ') + (res.error || '?')));
							else
								pollStatus('download');
						});
					}) }, _('Download')),
			]),
			E('label', { 'style': 'display:inline-flex;align-items:center;font-weight:normal;color:var(--fg-color-2,#666)' }, [
				ackChk, _('Confirm the install to the operator automatically (recommended; uncheck only for testing)'),
			]),
			panel,
		]));

		// pending eUICC notifications: confirm the download/enable/disable to
		// the operator's SM-DP+ (ES9+). Can be done any time the router has
		// internet — lpac delivers the queued notifications.
		out.push(E('h4', {}, _('Provider confirmations (notifications)')));
		out.push(E('p', {}, E('em', {}, _('After a download or profile change the eUICC queues notifications that confirm the operation to the operator. Send them once the router has internet.'))));
		out.push(E('div', { 'class': 'cbi-section' }, [
			E('button', { 'class': 'btn cbi-button',
				'click': ui.createHandlerFn(self, function() {
					startBusy(_('Listing pending notifications…'));
					return callEsim(data.modem, 'notifications', 0, '', '', '').then(function(r) {
						panel.style.display = '';
						dom.content(panel, [
							mkBanner((r && r.ok) ? 'ok' : 'err', (r && r.ok) ? '✓' : '✕',
								(r && r.log && r.log.trim()) ? _('Pending notifications:') : _('No pending notifications.')),
							(r && r.log && r.log.trim())
								/* array: raw lpac output, same as the log above */
								? E('pre', { 'class': 'wwe-log' }, [ r.log ]) : '',
						]);
					});
				}) }, _('List pending')),
			' ',
			E('button', { 'class': 'btn cbi-button cbi-button-apply',
				'click': ui.createHandlerFn(self, function() {
					if (!confirm(_('Send all pending notifications to the operator now?')))
						return;
					startBusy(_('Sending confirmations…'));
					return callEsim(data.modem, 'notify', 0, '', '', '').then(function(res) {
						if (res && res.ok === false)
							dom.content(panel, mkBanner('err', '✕', _('Failed: ') + (res.error || '?')));
						else
							pollStatus('notify');
					});
				}) }, _('Send confirmations')),
		]));

		return out;
	}
});
