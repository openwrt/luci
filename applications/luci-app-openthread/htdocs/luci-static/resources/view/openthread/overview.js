'use strict';
'require view';
'require dom';
'require poll';
'require rpc';
'require ui';
'require openthread/errors as otbrErrors';

var callStateSummary = rpc.declare({
	object: 'luci.openthread',
	method: 'state_summary'
});

var callNeighborsSummary = rpc.declare({
	object: 'luci.openthread',
	method: 'neighbors_summary'
});

var callScan = rpc.declare({
	object: 'luci.openthread',
	method: 'scan'
});

var callAttach = rpc.declare({
	object: 'luci.openthread',
	method: 'attach',
	params: [ 'panid', 'channel', 'networkkey' ]
});

var callLeave = rpc.declare({
	object: 'luci.openthread',
	method: 'leave'
});

var callJoinerRemove = rpc.declare({
	object: 'luci.openthread',
	method: 'joiner_remove',
	params: [ 'eui64' ]
});

var callSettingsGet = rpc.declare({
	object: 'luci.openthread',
	method: 'settings_get'
});

var callSecretGet = rpc.declare({
	object: 'luci.openthread',
	method: 'secret_get',
	params: [ 'name' ]
});

var callSettingsApply = rpc.declare({
	object: 'luci.openthread',
	method: 'settings_apply',
	params: [ 'networkname', 'channel', 'panid', 'extpanid',
	         'mode', 'networkkey', 'pskc', 'macfilter', 'macfilter_confirmed' ]
});

var callMacfilterClear = rpc.declare({
	object: 'luci.openthread',
	method: 'macfilter_clear',
	params: [ 'confirmed' ]
});

var callMacfilterAdd = rpc.declare({
	object: 'luci.openthread',
	method: 'macfilter_add',
	params: [ 'addr', 'state' ]
});

var callMacfilterRemove = rpc.declare({
	object: 'luci.openthread',
	method: 'macfilter_remove',
	params: [ 'addr', 'state' ]
});

var callCommissionerStart = rpc.declare({
	object: 'luci.openthread',
	method: 'commissioner_start'
});

var callJoinerAdd = rpc.declare({
	object: 'luci.openthread',
	method: 'joiner_add',
	params: [ 'pskd', 'eui64' ]
});

var callRadioRestart = rpc.declare({
	object: 'luci.openthread',
	method: 'radio_restart'
});

var callThreadStart = rpc.declare({
	object: 'luci.openthread',
	method: 'thread_start'
});

var callThreadStop = rpc.declare({
	object: 'luci.openthread',
	method: 'thread_stop'
});

function pctIcon(pct) {
	var base = L.resource('icons');
	if (pct <= 0)  return base + '/signal-000-000.svg';
	if (pct < 25)  return base + '/signal-000-025.svg';
	if (pct < 50)  return base + '/signal-025-050.svg';
	if (pct < 75)  return base + '/signal-050-075.svg';
	return base + '/signal-075-100.svg';
}

// The same badge the wireless pages use, fed from what a Thread link
// reports: the received signal in dBm where available (neighbor entries),
// the 0-3 link quality indicator otherwise (the parent entry carries no
// RSSI). The percent mapping matches wireless.js render_signal_badge().
function rssiBadge(avg, last, title) {
	return E('div', { 'class': 'ifacebadge', 'title': title, 'data-signal': avg }, [
		E('img', { 'src': pctIcon(Math.min((avg + 110) / 70 * 100, 100)) }),
		E('span', {}, [ ' ', '%d/%d dBm'.format(avg, last) ])
	]);
}

function lqiBadge(lqi, title) {
	var pct = [0, 30, 60, 100][Number(lqi)] ?? 100;
	return E('div', { 'class': 'ifacebadge', 'title': title, 'data-signal': pct }, [
		E('img', { 'src': pctIcon(pct) }),
		E('span', {}, [ ' ', 'LQI %d'.format(Number(lqi)) ])
	]);
}

function noSignalBadge(title, disabled) {
	return E('div', { 'class': 'ifacebadge', 'title': title }, [
		E('img', { 'src': L.resource('icons/signal-%s.svg').format(disabled ? 'none' : '000-000') }),
		E('span', {}, [ ' ', disabled
			? E('em', {}, E('small', {}, [ _('disabled') ]))
			: '--- dBm' ])
	]);
}

// The ubus reply carries numbers as space-padded strings ("     -77").
function num(v) {
	var n = parseInt(String(v ?? '').trim(), 10);
	return isNaN(n) ? null : n;
}

function strongestNeighbor(neigh) {
	var best = null;
	(neigh.neighbor || []).forEach(function(bss) {
		var avg = num(bss.AvgRssi);
		if (avg != null && (best == null || avg > best.avg))
			best = { avg: avg, last: num(bss.LastRssi) ?? avg, lqi: bss.LinkQualityIn };
	});
	return best;
}

// The daemon reports roles lowercase; present them as proper names.
function roleName(state) {
	switch (state) {
	case 'disabled': return _('Disabled');
	case 'detached': return _('Detached');
	case 'child':    return _('Child');
	case 'router':   return _('Router');
	case 'leader':   return _('Leader');
	default:         return state || '?';
	}
}

function transRole(bss) {
	var role = (bss.Role == 'C') ? _('Child')
		: (bss.Role == 'R') ? _('Router')
		: (bss.Role || '?');
	// A neighbor without the rx-on-when-idle flag is a sleepy end device.
	if (bss.Mode != null && bss.Mode.indexOf('r') < 0)
		return E('span', {}, [ role, ' ', E('small', {}, _('(sleepy)')) ]);
	return role;
}

// A failure below the method itself (no session, missing ACL, rpcd down)
// resolves to a plain ubus status number rather than a reply object; a
// caller checking only .error would take that for success.
function replyError(r) {
	if (typeof r == 'number')
		return r || 255;
	if (r == null || typeof r != 'object')
		return 255;
	return r.error || 0;
}

function notifyReply(r) {
	var err = replyError(r);
	if (err)
		otbrErrors.notify({ error: err });
	return err;
}

// A filter edit the backend refused: it reports what stopped it rather
// than half-applying an edit whose meaning depends on the mode.
var filterRefusals = {
	empties_allowlist: _('Nothing was changed: an active allowlist with no entries blocks every device. Clear it from the network settings, where the affected list is shown, or change the filter mode first.'),
	leftovers: _('Nothing was changed: the MAC filter list still holds entries from an earlier list, which this mode would give the opposite meaning. Review the MAC filter in the network settings.'),
	unreadable: _('Nothing was changed: the current MAC filter state could not be read.'),
	mode_unchanged: _('The filter list was edited, but the filter mode could not be changed.'),
	unconfirmed_mode: _('Nothing was changed: the request would also switch the filter mode on, which changes what every other device may do. Change the mode from the network settings, where the effect is spelled out.')
};

function notifyFilterReply(r) {
	// A refusal is not a failure: report what stopped it, not an error.
	if (r && r.unchanged) {
		ui.addNotification(null, E('p',
			filterRefusals[r.reason] || filterRefusals.unreadable), 'warning');
		return 0;
	}
	var err = replyError(r);
	// Already means the device is on the list already.
	if (err && err != 24)
		otbrErrors.notify({ error: err });
	if (r && r.reason == 'mode_unchanged')
		ui.addNotification(null, E('p', filterRefusals.mode_unchanged), 'warning');
	return (err == 24) ? 0 : err;
}

function actionButton(label, cls, onclick, title) {
	return E('button', {
		'class': cls,
		'title': title || label,
		'click': ui.createHandlerFn({}, onclick)
	}, label);
}

// Scan and join run as modals on this page, mirroring the wireless
// overview. A Thread active scan is a single multi-second operation
// (deferred at the rpcd layer), so the modal shows a spinner until the
// first results land, then rescans every few seconds while it stays
// open; entries that stop answering are dimmed rather than dropped.
function scanTableRows(entries, configured) {
	var rows = [E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th col-2 middle center' }, _('Signal')),
		E('th', { 'class': 'th col-4 middle left' }, _('Network Name')),
		E('th', { 'class': 'th col-2 middle center hide-xs' }, _('Channel')),
		E('th', { 'class': 'th col-2 middle left hide-xs' }, _('PAN Id')),
		E('th', { 'class': 'th cbi-section-actions right' }, ' ')
	])];

	entries.forEach(function(e) {
		var net = e.net;
		var rssi = num(net.Rssi);
		var dim = e.stale ? 'opacity:0.5' : '';
		rows.push(E('tr', { 'class': 'tr', 'style': dim }, [
			E('td', { 'class': 'td col-2 middle center' },
				(rssi != null)
					? E('div', { 'class': 'ifacebadge', 'title': _('Signal: %d dBm / Quality: %s').format(rssi, net.Lqi) }, [
						E('img', { 'src': pctIcon(Math.min((rssi + 110) / 70 * 100, 100)) }),
						E('span', {}, [ ' ', '%d dBm'.format(rssi) ])
					])
					: E('em', {}, _('unknown'))),
			E('td', { 'class': 'td col-4 middle left' }, net.NetworkName ? [ net.NetworkName ] : E('em', {}, _('hidden'))),
			E('td', { 'class': 'td col-2 middle center hide-xs' }, String(net.Channel ?? '?')),
			E('td', { 'class': 'td col-2 middle left hide-xs' }, String(net.PanId ?? '?')),
			E('td', { 'class': 'td middle cbi-section-actions' },
				E('button', {
					'class': 'cbi-button cbi-button-action important',
					'click': ui.createHandlerFn({}, function() { return handleJoin(net, configured); })
				}, _('Join Network')))
		]));
	});

	if (rows.length == 1)
		rows.push(E('tr', { 'class': 'tr placeholder' },
			E('td', { 'class': 'td', 'colspan': 5 },
				E('em', {}, _('No networks found')))));

	return rows;
}

var scanState = null;

function scanKey(net) {
	return net.ExtendedPanId || (String(net.PanId) + '/' + String(net.Channel));
}

function runScanTick(state, table) {
	// One active scan takes several seconds; never start a second one
	// while the previous is in flight, or the daemon reports Busy.
	if (state.busy || state.done)
		return;
	state.busy = true;
	return callScan().then(function(r) {
		state.busy = false;
		if (state.done)
			return;
		var nets = (r && r.scan_list) || [];
		for (var k in state.cache)
			state.cache[k].stale = true;
		nets.forEach(function(net) {
			state.cache[scanKey(net)] = { net: net, stale: false };
		});
		var list = Object.values(state.cache).sort(function(a, b) {
			return (num(b.net.Rssi) ?? -999) - (num(a.net.Rssi) ?? -999);
		});
		if (list.length)
			dom.content(table, scanTableRows(list, state.configured));
	}).catch(function() {
		state.busy = false;
	});
}

function stopScan() {
	if (scanState) {
		scanState.done = true;
		if (scanState.pollFn)
			poll.remove(scanState.pollFn);
		scanState = null;
	}
}

function handleScan(st) {
	var table = E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr placeholder' },
			E('td', { 'class': 'td' },
				E('em', { 'class': 'spinning' }, _('Starting Thread scan...'))))
	]);

	var state = { cache: {}, busy: false, done: false, configured: !!(st && st.configured) };
	scanState = state;

	var md = ui.showModal(_('Join Network: Thread Scan'), [
		table,
		E('div', { 'class': 'right' },
			E('button', {
				'class': 'btn',
				'click': function(ev) {
					var m = dom.parent(ev.target, 'div[aria-modal="true"]');
					if (m) m.style.maxWidth = '';
					stopScan();
					ui.hideModal();
				}
			}, _('Dismiss')))
	]);
	md.style.maxWidth = '90%';

	// Scan continuously while the modal is open, like the wireless scan;
	// results accumulate and networks that stop answering dim out.
	state.pollFn = function() { return runScanTick(state, table); };
	poll.add(state.pollFn, 5);
	runScanTick(state, table);
}

function handleJoin(net, configured) {
	stopScan();
	var keyInput = E('input', {
		'type': 'password',
		'class': 'cbi-input-text',
		'placeholder': _('32 hex characters'),
		'style': 'width:100%'
	});

	function attach() {
		var key = keyInput.value;
		if (!/^[0-9a-f]{32}$/i.test(key)) {
			ui.addNotification(null, E('p', _('Network key length must be 32 hex characters')), 'danger');
			return;
		}
		return callAttach(String(net.PanId), Number(net.Channel), key).then(function(r) {
			if (notifyReply(r))
				return;
			ui.hideModal();
			location.reload();
		});
	}

	ui.showModal(_('Joining Network: %q').replace(/%q/, '"%h"'.format(net.NetworkName || net.PanId)), [
		configured
			? E('p', { 'class': 'alert-message warning' },
				_('One agent manages exactly one Thread network: joining this network replaces the currently configured one.'))
			: E([]),
		E('p', {}, _('Enter the network key to ensure you join the right network.')),
		E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Network Key')),
			E('div', { 'class': 'cbi-value-field' }, keyInput)
		]),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-positive important',
				'click': ui.createHandlerFn({}, attach)
			}, _('Attach'))
		])
	], 'cbi-modal');
	keyInput.focus();
}

function cbiValue(title, node, hint) {
	var children = [
		E('label', { 'class': 'cbi-value-title' }, title),
		E('div', { 'class': 'cbi-value-field' }, node)
	];
	if (hint)
		children.push(E('div', { 'class': 'cbi-value-description' }, hint));
	return E('div', { 'class': 'cbi-value' }, children);
}

// The network settings form, ported from the former settings page into a
// modal like the wireless per-network edit. Enable/Disable and Leave are
// not repeated here: the network row carries them.
function handleSettings() {
	return callSettingsGet().then(function(s) {
		otbrErrors.notify(s);
		if (s && s.error)
			return;
		s = s || {};
		var disabled = (s.state == 'disabled');

		var nameInput       = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': s.networkname || '' });
		var channelInput    = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': String(s.channel ?? '') });
		var panidInput      = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': String(s.panid ?? '') });
		var extpanidInput   = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': s.extpanid || '' });
		var modeInput       = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': s.mode || '' });
		if (!disabled) modeInput.disabled = true;
		// The settings do not carry the secrets; the field stays empty and
		// means "unchanged" unless it is revealed or typed into.
		var networkkeyInput = E('input', {
			'type': 'password',
			'class': 'cbi-input-text',
			'placeholder': _('unchanged')
		});
		var pskcInput = E('input', {
			'type': 'password',
			'class': 'cbi-input-text',
			'placeholder': _('unchanged')
		});

		function revealButton(name, input) {
			return actionButton(_('Reveal'), 'cbi-button cbi-button-neutral',
				function() {
					return callSecretGet(name).then(function(r) {
						if (notifyReply(r))
							return;
						input.value = r.value || '';
						input.type = 'text';
					});
				}, _('Read this value from the border router'));
		}

		// The placeholder keeps the select from naming a mode nobody knows:
		// with the state unreadable it would otherwise fall back to reading
		// 'Disable' as a statement of fact.
		var macSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': '', 'disabled': true, 'hidden': true }, _('Unknown')),
			E('option', { 'value': 'disable' },   _('Disable')),
			E('option', { 'value': 'allowlist' }, _('Allowlist')),
			E('option', { 'value': 'denylist' },  _('Denylist'))
		]);
		macSelect.value = s.macfilterstate || '';
		var macModeNote = E('em', { 'style': 'display:none' },
			_('The filter mode could not be read.'));
		var macAddInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': _('16 hex characters') });
		var macListBox = E('div', {});
		var macClearButton = E('button', {
			'class': 'cbi-button cbi-button-remove',
			'click': ui.createHandlerFn({}, function() {
				if (!macReadable())
					return;
				// Match macfilter_clear's own refusal condition: an active
				// allowlist with entries. An empty one blocks everything
				// already, so there is no hazard to confirm.
				var asked = (s.macfilterstate == 'allowlist' && (s.addrlist || []).length > 0);
				if (asked &&
				    !confirm(_('The MAC filter is an active allowlist. Clearing it leaves no device admitted, which blocks every device until the filter mode is changed. Clear it anyway?')))
					return;
				// Claim approval only for a hazard the operator was actually
				// shown, so the backend still refuses one that appeared since.
				return callMacfilterClear(asked).then(function(r) {
					notifyFilterReply(r);
					return refreshMacList();
				});
			})
		}, _('Clear'));
		var macAddButton = E('button', {
			'class': 'cbi-button cbi-button-add',
			'click': ui.createHandlerFn({}, function() {
				if (!macReadable())
					return;
				if (!/^[0-9a-f]{16}$/i.test(macAddInput.value)) {
					ui.addNotification(null, E('p', _('Address length must be 16 hex characters')), 'danger');
					return;
				}
				return callMacfilterAdd(macAddInput.value, '').then(function(r) {
					if (!notifyFilterReply(r) && !(r && r.unchanged))
						macAddInput.value = '';
					return refreshMacList();
				});
			})
		}, _('Add'));

		function macState() { return macSelect.value; }

		var applyButton = E('button', {
			'class': 'cbi-button cbi-button-positive important',
			'click': ui.createHandlerFn({}, doApply)
		}, _('Save & Apply'));

		function rebuildMacList(addrs) {
			if (addrs == null) {
				dom.content(macListBox, E('em', {},
					_('The filter list could not be read.')));
				return;
			}
			var rows = addrs.map(function(addr) {
				return E('div', {}, [
					E('code', {}, addr),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-remove',
						'click': ui.createHandlerFn({}, function() {
							if (!macReadable())
								return;
							// The list edit stands on its own here; the
							// mode is applied by Save & Apply, which
							// shows what it would reinterpret.
							return callMacfilterRemove(addr, '').then(function(r) {
								notifyFilterReply(r);
								return refreshMacList();
							});
						})
					}, _('Remove'))
				]);
			});
			dom.content(macListBox, rows);
		}

		function refreshMacList() {
			return callSettingsGet().then(function(r) {
				// Keep both halves of the snapshot in step: doApply() sizes
				// the mode-switch warning from the list, and macReadable()
				// gates on the mode as well. Leaving either at its load-time
				// value lets the guard trust state the router has since
				// stopped reporting.
				s.addrlist = (r || {}).addrlist;
				s.macfilterstate = (r || {}).macfilterstate;
				rebuildMacList(s.addrlist);
				applyMacReadability();
				// ui.createHandlerFn re-enables the button that started this
				// once the handler's promise settles, which happens after the
				// line above. Re-apply the verdict behind it so a control the
				// state no longer supports does not come back live.
				window.setTimeout(applyMacReadability, 0);
			});
		}

		// An unreadable filter state is not a disabled one. settings_apply
		// refuses a mode change when either half of its snapshot -- the mode
		// or the list -- is unknown, so mirror that rule here, where the modal
		// has already said why on screen, rather than let the operator answer
		// a prompt about state nobody can see.
		//
		// Only the controls that act on the filter are gated. The rest of the
		// form -- name, channel, PAN IDs, device mode, the secrets -- does not
		// depend on it, so Save & Apply stays live and doApply() sends an empty
		// mode when the mode is not being changed.
		function macReadable() { return s.addrlist != null && s.macfilterstate != null; }
		// No change can be claimed against an unknown baseline: with the mode
		// unreadable this stays false, so doApply() sends an empty mode and
		// the warning machinery stays quiet.
		function macModeChanged() { return s.macfilterstate != null && macState() != s.macfilterstate; }

		function applyMacVisibility() {
			// Keep the rows while the list is unreadable: they hold the
			// "could not be read" box, which is the one on-screen explanation
			// after the revert below -- a title on a disabled select does not
			// reliably surface as a tooltip.
			macRows.style.display =
				(macSelect.value == 'disable' && s.addrlist != null) ? 'none' : '';
		}

		// Re-run from refreshMacList(), but the movement is one-way in
		// practice: a refresh can take readability away, yet once these
		// controls are disabled nothing re-reads the state, so reopening
		// the modal is the way back.
		function applyMacReadability() {
			var readable = macReadable();
			var hint = readable ? ''
				: _('The MAC filter state could not be read, so it cannot be changed.');
			// The select must not keep asserting a mode. With the mode half
			// unreadable it shows the Unknown placeholder and the note below
			// says why; with only the list gone, a pick made while everything
			// was still readable is reverted, since doApply() would send it
			// and have settings_apply refuse the whole form as 'unreadable'
			// -- with no way back, the select being disabled. It would also
			// size the mode-switch warning from a list that reads as empty
			// because it could not be read.
			if (s.macfilterstate == null)
				macSelect.value = '';
			else if (!readable && macModeChanged())
				macSelect.value = s.macfilterstate;
			applyMacVisibility();
			macModeNote.style.display = (s.macfilterstate == null) ? '' : 'none';
			// The per-address Remove buttons are rebuilt with the list, so
			// collect them fresh: with the list readable but the mode not,
			// the rows are on screen and every Remove would come back
			// 'unreadable' from the same snapshot rule.
			var removes = macListBox.querySelectorAll('button');
			[macSelect, macClearButton, macAddButton].concat(Array.from(removes))
				.forEach(function(el) {
					el.disabled = !readable;
					el.title = hint;
				});
		}
		macSelect.addEventListener('change', applyMacVisibility);
		rebuildMacList(s.addrlist);

		var macRows = E('div', {}, [
			cbiValue(_('Existing Address'), [
				macListBox,
				macClearButton
			], _('This will clear all existing macfilter addresses.')),
			cbiValue(_('Add Address'), [
				macAddInput,
				' ',
				macAddButton
			])
		]);

		function doApply() {
			var ch = parseInt(channelInput.value, 10);
			if (isNaN(ch) || ch < 11 || ch > 26) {
				ui.addNotification(null, E('p', _('Channel must be a number between 11 and 26')), 'danger'); return;
			}
			if (isNaN(Number(panidInput.value))) {
				ui.addNotification(null, E('p', _('PAN ID must be a number')), 'danger'); return;
			}
			if (!/^[0-9a-f]{16}$/i.test(extpanidInput.value)) {
				ui.addNotification(null, E('p', _('Extended PAN ID must be 16 hex characters')), 'danger'); return;
			}
			if (!/^[rsdn]+$/.test(modeInput.value)) {
				ui.addNotification(null, E('p', _('Mode must consist of "r", "s", "d", "n"')), 'danger'); return;
			}
			// Empty means unchanged, so only a value that was entered is checked.
			if (networkkeyInput.value && !/^[0-9a-f]{32}$/i.test(networkkeyInput.value)) {
				ui.addNotification(null, E('p', _('Network key length must be 32 hex characters')), 'danger'); return;
			}
			if (pskcInput.value && !/^[0-9a-f]{32}$/i.test(pskcInput.value)) {
				ui.addNotification(null, E('p', _('Network password length must be 32 hex characters')), 'danger'); return;
			}
			// The filter mode is the one field whose meaning depends on the
			// list beside it: name what the change would do before it is
			// applied, since the operator can see the list here.
			var entries = (s.addrlist || []).length;
			var warn = macModeChanged()
				? (entries > 0
					? _('The MAC filter list holds %d entries written for the previous mode. Switching the mode changes what they mean: %s. Continue?')
						.format(entries, macState() == 'allowlist'
							? _('they become the only admitted devices and every other device is blocked')
							: macState() == 'denylist'
								? _('they become blocked devices')
								: _('the filter stops applying and none of them is filtered any more'))
					: (macState() == 'allowlist'
						? _('An allowlist with no entries admits no device, so every device is blocked until entries are added. Continue?')
						: null))
				: null;
			if (warn && !confirm(warn))
				return;
			return callSettingsApply(
				nameInput.value, ch, panidInput.value, extpanidInput.value,
				// An empty filter mode means "leave it as it is". Sending the
				// current one instead would take the unreadable-list path in
				// settings_apply even when the mode is not being changed, and
				// refuse the whole form over a list nothing here touches.
				modeInput.value, networkkeyInput.value, pskcInput.value,
				macModeChanged() ? macState() : '',
				warn != null
			).then(function(r) {
				if (r && r.unchanged) {
					notifyFilterReply(r);
					return;
				}
				if (notifyReply(r))
					return;
				ui.hideModal();
				location.reload();
			});
		}

		ui.showModal(_('Thread Network: %s (%s)').format(s.networkname || '?', s.interfacename || '?'), [
			E('h4', {}, _('Network Configuration')),
			cbiValue(_('Thread Name'), nameInput),
			cbiValue(_('Channel'), channelInput),
			cbiValue(_('PAN ID'), panidInput),
			cbiValue(_('Extended PAN ID'), extpanidInput),
			cbiValue(_('Mode'), modeInput, disabled
				? _('Set the thread device mode value, must consist of "r", "s", "d", "n".')
				: _('Cannot change mode while the Thread network is started.')),
			E('h4', {}, _('Thread Security')),
			cbiValue(_('Network Key'), [ networkkeyInput, ' ', revealButton('networkkey', networkkeyInput) ],
				_('Left empty the key stays as it is.')),
			cbiValue(_('Network Password'), [ pskcInput, ' ', revealButton('pskc', pskcInput) ],
				_('The commissioner credential (PSKc). Left empty it stays as it is.')),
			E('h4', {}, _('MAC-Filter')),
			cbiValue(_('Protocol'), [ macSelect, ' ', macModeNote ]),
			macRows,
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss')),
				' ',
				applyButton
			])
		], 'cbi-modal');
		applyMacVisibility();
		applyMacReadability();
	});
}

// Commissioner-based joining, ported from the former add-joiner page.
function handleCommission(st) {
	// Petitioning is idempotent: re-opening the dialog while a joiner
	// window is active is a no-op success.
	callCommissionerStart().then(function(r) { otbrErrors.notify(r); });

	var pskdInput  = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'J01NME' });
	var eui64Input = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '2157d22254527111' });

	function submit() {
		if (!/^[0-9A-HJ-NPR-Y]{6,32}$/.test(pskdInput.value)) {
			ui.addNotification(null, E('p', _('The Joiner Credential must be 6 to 32 uppercase alphanumeric characters (0-9 and A-Y, excluding I, O, Q and Z)')), 'danger');
			return;
		}
		if (!/^[0-9a-f]{16}$/i.test(eui64Input.value) && eui64Input.value != '*') {
			ui.addNotification(null, E('p', _('eui64 length must be 16 hex characters or "*"')), 'danger');
			return;
		}
		return callJoinerAdd(pskdInput.value, eui64Input.value).then(function(r) {
			if (notifyReply(r))
				return;
			ui.hideModal();
		});
	}

	ui.showModal(_('Add Joiner in Network: %s').format(st.networkname || '?'), [
		cbiValue(_('New Joiner Credential'), pskdInput,
			_('The Joiner Credential is a device-specific string of all uppercase alphanumeric characters (0-9 and A-Y, excluding I, O, Q and Z), with a length between 6 and 32 characters.')),
		cbiValue(_('Restrict to a Specific Joiner'), eui64Input,
			_('Use the device\'s factory-assigned IEEE EUI-64 to restrict commissioning to a specific Joiner. Use "*" to allow any joiner.')),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-positive important',
				'click': ui.createHandlerFn({}, submit)
			}, _('Add'))
		])
	], 'cbi-modal');
	pskdInput.focus();
}

function handleRemove(st) {
	ui.showModal(_('Delete Thread network'), [
		E('p', {}, _('This deletes the network "%h" from this border router: the operational dataset and all Thread configuration are erased and devices on the mesh lose their network. This cannot be undone.').format(st.networkname || '?')),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-negative important',
				'click': ui.createHandlerFn({}, function() {
					return callLeave().then(function(r) {
						if (notifyReply(r))
							return;
						ui.hideModal();
						location.reload();
					});
				})
			}, _('Delete'))
		])
	]);
}

// The table mirrors the wireless overview: one device row for the radio
// with the radio-wide actions, then one row for the network on it. There
// is exactly one network per agent (a single 'otbr' ubus object bound to
// one radio), so Create is only offered while nothing is configured.
function renderRadioRow(st) {
	var stat = E('div', {}, [
		E('big', {}, E('strong', {}, _('Generic MAC 802.15.4 Thread'))),
		E('div')
	]);
	// The 2 s poll re-renders through here, so the unreachable case has to
	// be visible in the row itself; a load-time notification would not
	// survive a daemon that dies while the page is open.
	if (st.error)
		dom.append(stat.lastElementChild,
			E('em', {}, _('otbr-agent is not reachable (%s)').format(otbrErrors.translate(st.error) || st.error)));
	else
		// 802.15.4 channel k (11-26) sits at 2405 + 5 * (k - 11) MHz; the
		// 2.4 GHz O-QPSK PHY has a single 250 kbit/s rate.
		L.itemlist(stat.lastElementChild, [
			_('Channel'), (st.channel != null)
				? '%d (%.3f GHz)'.format(st.channel, (2405 + 5 * (st.channel - 11)) / 1000)
				: '?',
			_('Bitrate'), (st.channel != null) ? '250 kbit/s' : null
		], ' | ');

	// Restart stays available while the agent is unreachable: bouncing the
	// interface is exactly how to recover a wedged agent.
	var buttons = [
		actionButton(_('Restart'), 'cbi-button cbi-button-neutral',
			function() {
				return callRadioRestart().then(notifyReply);
			}, _('Restart the Thread interface'))
	];
	if (!st.error) {
		buttons.push(actionButton(_('Scan'), 'cbi-button cbi-button-action important',
			function() { handleScan(st); }, _('Find and join a Thread network')));
		if (!st.configured)
			buttons.push(actionButton(_('Create'), 'cbi-button cbi-button-add',
				handleSettings, _('Create a new Thread network')));
	}

	return E('tr', { 'class': 'tr cbi-section-table-row' }, [
		E('td', { 'class': 'td cbi-value-field' },
			E('div', { 'class': 'center' },
				E('span', { 'class': 'ifacebadge' }, [
					E('img', { 'src': L.resource('icons/wifi%s.svg').format(st.error ? '_disabled' : '') }),
					' ',
					st.interfacename || '?'
				]))),
		E('td', { 'class': 'td cbi-value-field' }, stat),
		E('td', { 'class': 'td middle cbi-section-actions' }, E('div', {}, buttons))
	]);
}

function renderNetworkRow(st, neigh) {
	var disabled = (st.state == 'disabled');
	var attached = (st.state == 'leader' || st.state == 'router' || st.state == 'child');

	// Mirror the wireless network row: a signal badge in dBm. The device
	// itself has no single link, so the strongest neighbor stands in; a
	// child that only knows its parent falls back to the LQI badge.
	var badge;
	if (disabled) {
		badge = noSignalBadge(_('Thread is disabled'), true);
	} else {
		var best = strongestNeighbor(neigh || {});
		if (best)
			badge = rssiBadge(best.avg, best.last,
				_('Strongest neighbor: average / last RSSI'));
		else if (st.state == 'child' && (neigh?.neighbor || [])[0]?.LinkQualityIn != null)
			badge = lqiBadge(neigh.neighbor[0].LinkQualityIn, _('Link quality to the parent router'));
		else
			badge = noSignalBadge(attached ? _('No mesh neighbors') : _('Not attached'), false);
	}

	// itemlist() emits a separator whenever further items remain, even if
	// they are all null-skipped; append the disabled note conditionally so
	// an active network's line does not end in a dangling separator.
	var items = [
		_('Network'), st.networkname || '?',
		_('Role'), disabled ? null : roleName(st.state),
		_('PAN ID'), (st.panid != null) ? String(st.panid) : null
	];
	if (disabled)
		items.push('', E('em', {}, _('Thread is disabled')));
	var statDiv = L.itemlist(E('div'), items, [ ' | ', E('br') ]);

	var buttons = [
		disabled
			? actionButton(_('Enable'), 'cbi-button cbi-button-neutral',
				function() {
					return callThreadStart().then(function(r) {
						if (!notifyReply(r))
							location.reload();
					});
				}, _('Enable this network'))
			: actionButton(_('Disable'), 'cbi-button cbi-button-neutral',
				function() {
					return callThreadStop().then(function(r) {
						if (!notifyReply(r))
							location.reload();
					});
				}, _('Disable this network')),
		actionButton(_('Edit'), 'cbi-button cbi-button-action important',
			handleSettings, _('Edit this network')),
		actionButton(_('Remove'), 'cbi-button cbi-button-negative remove',
			function() { handleRemove(st); },
			_('Delete this network'))
	];

	return E('tr', { 'class': 'tr cbi-section-table-row' }, [
		E('td', { 'class': 'td cbi-value-field' },
			E('div', { 'class': 'center' }, badge)),
		E('td', { 'class': 'td cbi-value-field' }, statDiv),
		E('td', { 'class': 'td middle cbi-section-actions' }, E('div', {}, buttons))
	]);
}

function renderTableRows(st, neigh) {
	var rows = [ renderRadioRow(st) ];
	if (!st.error) {
		if (st.configured)
			rows.push(renderNetworkRow(st, neigh));
		else
			rows.push(E('tr', { 'class': 'tr cbi-section-table-row placeholder' },
				E('td', { 'class': 'td', 'colspan': 3 },
					E('em', {}, _('No Thread network is configured yet. Create a new network or scan for one to join.')))));
	}
	return rows;
}

// Merged from the former Thread View page: the partition's leader data.
// The same network badge the neighbour rows carry, so the leader line
// reads as belonging to a network rather than floating on its own.
function networkBadge(st, disabled) {
	return E('span', { 'class': 'ifacebadge' }, [
		E('img', { 'src': L.resource('icons/wifi%s.svg').format(disabled ? '_disabled' : '') }),
		E('span', {}, [ ' ', st.networkname || '?', ' ',
			E('small', {}, [ '(%s)'.format(st.interfacename || '?') ]) ])
	]);
}

function renderLeaderTable(st) {
	var ld = st.leaderdata;
	var rows = [E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th nowrap' }, _('Network')),
		E('th', { 'class': 'th center' }, _('Leader Router Id')),
		E('th', { 'class': 'th center' }, _('Partition Id')),
		E('th', { 'class': 'th center' }, _('Weighting')),
		E('th', { 'class': 'th center' }, _('Data Version')),
		E('th', { 'class': 'th center' }, _('Stable Data Version'))
	])];
	// data-title drives the column labels the themes show on narrow
	// screens, and the classes mirror the header cell by cell.
	if (ld)
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td nowrap', 'data-title': _('Network') }, networkBadge(st, false)),
			E('td', { 'class': 'td center', 'data-title': _('Leader Router Id') }, String(ld.LeaderRouterId ?? '')),
			E('td', { 'class': 'td center', 'data-title': _('Partition Id') }, String(ld.PartitionId ?? '')),
			E('td', { 'class': 'td center', 'data-title': _('Weighting') }, String(ld.Weighting ?? '')),
			E('td', { 'class': 'td center', 'data-title': _('Data Version') }, String(ld.DataVersion ?? '')),
			E('td', { 'class': 'td center', 'data-title': _('Stable Data Version') }, String(ld.StableDataVersion ?? ''))
		]));
	else
		rows.push(E('tr', { 'class': 'tr placeholder' },
			E('td', { 'class': 'td', 'colspan': 6 },
				E('em', {}, _('No information available')))));
	return E('table', { 'class': 'table' }, rows);
}

// Thread has no way to evict a node: there is no protocol operation to
// remove a device from a network, and its credentials cannot be revoked
// individually. The closest available action is the MAC filter, which
// makes this border router ignore the node's frames until it times out.
function filterModal(title, intro, warning, buttonLabel, buttonClass, action) {
	ui.showModal(title, [
		E('p', {}, intro),
		E('p', { 'class': 'alert-message warning' }, warning),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
			' ',
			E('button', {
				'class': buttonClass + ' important',
				'click': ui.createHandlerFn({}, function() {
					return action().then(function(r) {
						notifyFilterReply(r);
						ui.hideModal();
					});
				})
			}, buttonLabel)
		])
	]);
}

// Thread cannot evict a device, so every direction of the MAC filter
// deserves the same caveats before it fires.
var blockWarning = function() {
	return [
		_('This is not an eviction: Thread has no operation to remove a device from a network. The device keeps the network credentials, drops out of this router only once its link times out (usually a few minutes), and can rejoin through another router in the mesh. The block is also lost when the border router restarts.'),
		E('br'), E('br'),
		_('To remove a device for good, change the network key from the network settings, which requires commissioning every other device again.')
	];
};

function handleBlock(bss, neigh) {
	var name = bss.Hostname || bss.ExtAddress || '?';
	filterModal(_('Block device'),
		[ _('Stop accepting traffic from'), ' ', E('strong', {}, [ name ]), ' ',
			_('on this border router.') ],
		blockWarning(),
		_('Block'), 'cbi-button cbi-button-negative',
		function() {
			// Passing the mode along switches the filter on when this is
			// the only entry; the daemon reports an existing entry as
			// Already and leaves the mode alone next to leftovers.
			return callMacfilterAdd(bss.ExtAddress, 'denylist');
		});
}

function handleAllowlistBlock(bss) {
	var name = bss.Hostname || bss.ExtAddress || '?';
	filterModal(_('Block device'),
		[ _('Stop accepting traffic from'), ' ', E('strong', {}, [ name ]), ' ',
			_('on this border router by removing it from the allowlist.') ],
		blockWarning(),
		_('Block'), 'cbi-button cbi-button-negative',
		function() {
			return callMacfilterRemove(bss.ExtAddress, 'allowlist');
		});
}

function handleAllow(bss) {
	var name = bss.Hostname || bss.ExtAddress || '?';
	filterModal(_('Allow device'),
		[ _('Accept traffic from'), ' ', E('strong', {}, [ name ]), ' ',
			_('on this border router by adding it to the allowlist.') ],
		[ _('This does not commission the device: joining the network still requires its credentials. The filter list is kept in memory and does not survive a border router restart.') ],
		_('Allow'), 'cbi-button cbi-button-positive',
		function() {
			return callMacfilterAdd(bss.ExtAddress, 'allowlist');
		});
}

function neighborAction(bss, neigh) {
	if (!bss.ExtAddress)
		return '';

	// Without a mode reading, or without knowing whether this device is on
	// the list, there is no safe action to offer: adding to or removing
	// from the shared list means opposite things per mode.
	if (!neigh.macfilter || bss.Filtered == null)
		return E('button', {
			'class': 'cbi-button cbi-button-remove',
			'disabled': 'disabled',
			'title': _('The MAC filter state could not be read.')
		}, _('Block'));

	// In allowlist mode the filter list holds the admitted devices, so
	// removal is the block and there is nothing to unblock.
	if (neigh.macfilter == 'allowlist') {
		if (bss.Filtered)
			return actionButton(_('Block'), 'cbi-button cbi-button-remove',
				function() { handleAllowlistBlock(bss); },
				_('Remove this device from the allowlist and stop accepting its traffic'));
		return actionButton(_('Allow'), 'cbi-button cbi-button-neutral',
			function() { handleAllow(bss); },
			_('Add this device to the allowlist'));
	}

	if (bss.Filtered && neigh.macfilter == 'denylist')
		return actionButton(_('Unblock'), 'cbi-button cbi-button-neutral',
			function() {
				return callMacfilterRemove(bss.ExtAddress, 'denylist')
					.then(notifyFilterReply);
			}, _('Accept traffic from this device again'));

	// With the filter disabled the list is inert; the block modal enables
	// the denylist as it adds the sole entry, and stands down next to
	// leftovers from an earlier list rather than weaponising them.
	return actionButton(_('Block'), 'cbi-button cbi-button-remove',
		function() { handleBlock(bss, neigh); },
		_('Stop accepting traffic from this device'));
}

// Styled after the wireless page's Associated Stations list: one row per
// mesh peer with a network badge and a dBm signal badge. When this device
// is a child the single row is its parent, which reports link quality
// instead of RSSI.
function renderNeighborTable(neigh, st) {
	var rows = [E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th nowrap' }, _('Network')),
		E('th', { 'class': 'th' }, _('Role')),
		E('th', { 'class': 'th' }, _('Host')),
		E('th', { 'class': 'th hide-xs' }, _('Extended MAC')),
		E('th', { 'class': 'th', 'title': _('Routing Locator: the mesh-internal short address encoding router and child id') }, _('RLOC16')),
		E('th', { 'class': 'th' }, _('Signal (avg / last)')),
		E('th', { 'class': 'th', 'title': _('Time since this device was last heard from') }, _('Age')),
		E('th', { 'class': 'th cbi-section-actions' }, ' ')
	])];

	(neigh.neighbor || []).forEach(function(bss) {
		var avg = num(bss.AvgRssi);
		var badge = (avg != null)
			? rssiBadge(avg, num(bss.LastRssi) ?? avg, _('Average / last received signal'))
			: (bss.LinkQualityIn != null)
				? lqiBadge(bss.LinkQualityIn, _('Link quality'))
				: noSignalBadge(_('No signal information'), false);
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td nowrap', 'data-title': _('Network') }, networkBadge(st, false)),
			E('td', { 'class': 'td', 'data-title': _('Role') }, transRole(bss)),
			E('td', { 'class': 'td', 'data-title': _('Host') }, [ bss.Hostname || '?' ]),
			E('td', { 'class': 'td hide-xs', 'data-title': _('Extended MAC') }, [ bss.ExtAddress || '?' ]),
			E('td', { 'class': 'td', 'data-title': _('RLOC16') }, [ bss.Rloc16 || '?' ]),
			E('td', { 'class': 'td', 'data-title': _('Signal (avg / last)') }, badge),
			E('td', { 'class': 'td', 'data-title': _('Age') },
				(num(bss.Age) != null) ? '%ds'.format(num(bss.Age)) : '-'),
			E('td', { 'class': 'td middle cbi-section-actions' }, neighborAction(bss, neigh))
		]));
	});

	// Devices admitted through commissioner-based joining appear here while
	// their join is pending (merged from the former Thread View page).
	for (var i = 0; i < (neigh.joinernum || 0); i++) {
		var j = (neigh.joinerlist || [])[i] || {};
		var eui64 = j.isAny ? '*' : (j.eui64 || '');
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td nowrap', 'data-title': _('Network') }, networkBadge(st, true)),
			E('td', { 'class': 'td', 'data-title': _('Role') },
				E('span', {}, [ _('Joiner'), ' ', E('small', {}, _('(pending)')) ])),
			E('td', { 'class': 'td', 'data-title': _('Host') }, '-'),
			E('td', { 'class': 'td hide-xs', 'data-title': _('Extended MAC') }, [ eui64 || '?' ]),
			E('td', { 'class': 'td', 'data-title': _('RLOC16') }, '-'),
			E('td', { 'class': 'td', 'data-title': _('Signal (avg / last)') }, '-'),
			E('td', { 'class': 'td', 'data-title': _('Age') }, '-'),
			E('td', { 'class': 'td middle cbi-section-actions' },
				E('button', {
					'class': 'cbi-button cbi-button-remove',
					'click': ui.createHandlerFn({}, (function(e64) {
						return function() {
							return callJoinerRemove(e64).then(function(r) {
								otbrErrors.notify(r);
							});
						};
					})(eui64))
				}, _('Remove')))
		]));
	}

	if (rows.length == 1)
		rows.push(E('tr', { 'class': 'tr placeholder' },
			E('td', { 'class': 'td', 'colspan': 8 },
				E('em', {}, _('No information available')))));

	return E('table', { 'class': 'table assoclist', 'id': 'neighbors' }, rows);
}

return view.extend({
	load: function() {
		return Promise.all([
			callStateSummary(),
			callNeighborsSummary()
		]);
	},

	render: function(data) {
		var st = data[0] || {};
		var neigh = data[1] || {};

		// A read that failed at the ubus layer carries an error instead of
		// state; surface it rather than rendering an empty overview.
		otbrErrors.notify(st);

		var tbody = E('tbody', { 'class': 'tbody cbi-section-tbody' }, renderTableRows(st, neigh));
		var neighborsBox = E('div', { 'id': 'thread-neighbors' }, renderNeighborTable(neigh, st));
		var leaderBox = E('div', { 'id': 'thread-leader' }, renderLeaderTable(st));

		// h3 section titles inside cbi-sections, matching the wireless page's
		// heading hierarchy.
		var view = E([], [
			E('div', { 'class': 'cbi-section cbi-tblsection' }, [
				E('h3', {}, _('Thread Overview')),
				E('table', { 'class': 'table cbi-section-table' }, tbody)
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Leader')),
				leaderBox
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Neighbors')),
				neighborsBox,
				E('div', { 'class': 'right' },
					actionButton(_('Commission device\u2026'), 'cbi-button cbi-button-add',
						function() { return handleCommission(st); },
						_('Admit a new device into this Thread network (commissioner-based joining)')))
			])
		]);

		poll.add(L.bind(function() {
			return Promise.all([callStateSummary(), callNeighborsSummary()]).then(function(d) {
				dom.content(tbody, renderTableRows(d[0] || {}, d[1] || {}));
				dom.content(neighborsBox, renderNeighborTable(d[1] || {}, d[0] || {}));
				dom.content(leaderBox, renderLeaderTable(d[0] || {}));
			});
		}, this), 2);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});
