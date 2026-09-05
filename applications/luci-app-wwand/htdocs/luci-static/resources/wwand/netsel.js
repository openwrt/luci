'use strict';
'require baseclass';
'require dom';
'require ui';
'require wwand.rpc as wrpc';
'require wwand.format as fmt';

/* Network selection (operator scan + manual/automatic), extracted from
   view/wwand/settings.js. Protocol-neutral: modem_scan /
   modem_set_network_selection run over QMI NAS, the MBIM passthrough, or
   AT+COPS on NCM. The scan is slow (up to ~90 s), so it runs as a daemon-side
   job that is polled — with a blocking-call fallback for old daemons.
   render(ctx, data) returns the section node; ctx carries the pieces the
   settings page owns:
     ctx.notifyDeferred(modem) — "apply needs a modem restart" notification
   data: { modem, settings } as assembled by the settings view. */

var callSetSelection = wrpc.setNetsel;
var callScan = wrpc.scan;
var callScanStart = wrpc.scanStart;
var callScanStatus = wrpc.scanStatus;

return baseclass.extend({
	render: function(ctx, data) {
		var self = this;
		var s = data.settings || {};
		var mode = (s.selection_mode == 'manual') ? 'manual' : 'auto';
		var reg = s.registered_plmn || {};

		var infoRows = [
			E('div', { 'style': 'margin-bottom:3px' }, [
				E('strong', {}, [ _('Current mode') + ': ' ]),
				(mode == 'manual') ? _('manual') : _('automatic') ]),
		];
		if (reg && (reg.mcc != null || reg.name))
			infoRows.push(E('div', {}, [ E('strong', {}, [ _('Registered operator') + ': ' ]),
				(reg.name || _('unknown')) + ' (' + (reg.mcc != null ? reg.mcc : '?') +
				'/' + fmt.fmtMnc(reg.mnc) + ')' ]));

		var results = E('div', { 'style': 'margin-top:10px' });

		var setSelection = function(smode, mcc, mnc, label) {
			return callSetSelection(data.modem, smode, (mcc != null ? +mcc : 0), (mnc != null ? +mnc : 0))
				.then(function(res) {
					if (res && res.ok === false)
						ui.addNotification(null, E('p', [ _('Failed: ') + (res.error || '?') ]), 'error');
					else if (res && res.unchanged)
						ui.addNotification(null, E('p',
							_('No change — the modem already runs this selection.')), 'info');
					else if (res && res.deferred)
						ctx.notifyDeferred(data.modem);
					else {
						ui.addNotification(null, E('p', label), 'info');
						window.setTimeout(function() { window.location.reload(); }, 800);
					}
				});
		};

		var STATUS_LABEL = {
			current:   _('current'),
			forbidden: _('forbidden'),
			available: _('available'),
		};

		var renderOps = function(ops) {
			if (!ops || !ops.length) {
				dom.content(results, E('em', {}, _('No operators found.')));
				return;
			}
			/* a scan may list the same PLMN once per supported RAT (2G/3G/4G/5G) —
			   collapse to one row per operator, keeping the strongest status and
			   UNIONing the radio access technologies the scan reported for it */
			var rank = { current: 3, available: 2, forbidden: 1 };
			var RAT_ORDER = { 'NR5G': 0, 'LTE': 1, 'TD-SCDMA': 2, 'UMTS': 3, 'GSM': 4, 'EVDO': 5, 'CDMA': 6 };
			var byPlmn = {}, order = [];
			ops.forEach(function(op) {
				var key = op.mcc + '/' + op.mnc;
				var prev = byPlmn[key];
				if (!prev) {
					op._rats = {};
					(op.rats || []).forEach(function(r) { op._rats[r] = true; });
					byPlmn[key] = op; order.push(key);
				} else {
					(op.rats || []).forEach(function(r) { prev._rats[r] = true; });
					if (op.roaming) prev.roaming = true;
					if ((rank[op.status] || 0) > (rank[prev.status] || 0)) {
						op._rats = prev._rats; op.roaming = prev.roaming || op.roaming;
						byPlmn[key] = op;
					}
				}
			});
			ops = order.map(function(k) { return byPlmn[k]; });
			var rows = ops.map(function(op) {
				var forbidden = (op.status == 'forbidden');
				var current = (op.status == 'current');
				var rats = Object.keys(op._rats || {}).sort(function(a, b) {
					return (RAT_ORDER[a] == null ? 9 : RAT_ORDER[a]) - (RAT_ORDER[b] == null ? 9 : RAT_ORDER[b]);
				});
				var act;
				if (forbidden)
					act = E('span', { 'style': 'color:#999' }, '—');
				else
					act = E('button', { 'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(self, function() {
							if (!confirm(_('Register manually to %s (%s/%s)? The connection may briefly drop.')
									.format(op.name || '?', op.mcc, fmt.fmtMnc(op.mnc))))
								return;
							return setSelection('manual', op.mcc, op.mnc,
								_('Manual network selection applied.'));
						}) }, current ? _('Reselect') : _('Select'));
				return E('tr', { 'class': 'tr',
					'style': forbidden ? 'opacity:.5' : (current ? 'font-weight:600' : '') }, [
					/* array, not a bare string: this name arrives OVER THE AIR in
					   the scan result, and dom.append() would put a bare string
					   through innerHTML (luci.js:1394-96) */
					E('td', { 'class': 'td' }, [ op.name || _('(unnamed)') ]),
					E('td', { 'class': 'td' }, [ op.mcc + '/' + fmt.fmtMnc(op.mnc) ]),
					E('td', { 'class': 'td' }, [ rats.length ? rats.join(', ') : '—' ]),
					E('td', { 'class': 'td' }, [
						STATUS_LABEL[op.status] || op.status || '',
						op.roaming ? E('span', { 'style': 'color:#da3;margin-left:4px', 'title': _('roaming') }, '✈') : '',
					]),
					E('td', { 'class': 'td', 'style': 'width:1%' }, act),
				]);
			});
			dom.content(results, E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Operator')),
					E('th', { 'class': 'th' }, _('PLMN')),
					E('th', { 'class': 'th' }, _('RAT')),
					E('th', { 'class': 'th' }, _('Status')),
					E('th', { 'class': 'th' }, ''),
				]),
			].concat(rows)));
		};

		/* A real operator scan regularly takes MINUTES (AT+COPS=? — and QMI NAS
		   scans on busy bands too), far beyond the XHR/uhttpd/rpcd timeout
		   chain. So: start the scan as a daemon-side job and poll its status
		   every few seconds — every request stays fast. Falls back to the old
		   blocking call when the daemon predates modem_scan_start. */
		var scanBtn;

		var scanFail = function(msg) {
			scanBtn.disabled = false;
			dom.content(results, E('div', { 'class': 'wwe-banner err' },
				[ E('span', {}, '✕'), E('span', {}, [ _('Scan failed: ') + msg ]) ]));
		};

		var scanSpinner = function(secs) {
			dom.content(results, E('div', { 'class': 'wwe-banner run',
				'style': 'display:flex;align-items:center;gap:9px' }, [
				E('span', { 'class': 'wwe-spin' }),
				E('span', {}, [ _('Scanning for operators — this can take several minutes…')
					+ (secs ? ' (' + secs + 's)' : '') ]),
			]));
		};

		var pollScan = function(started) {
			window.setTimeout(function() {
				callScanStatus(data.modem).then(function(st) {
					if (st && st.running) {
						scanSpinner(st.started ? Math.max(0, Math.round(Date.now() / 1000 - st.started)) : null);
						return pollScan(started);
					}
					if (!st || st.ok === false || st.error || st.idle)
						return scanFail((st && (st.error || (st.idle ? _('scan vanished (daemon restarted?)') : '?'))) || '?');
					scanBtn.disabled = false;
					renderOps(st.operators || []);
				}).catch(function(e) {
					/* one failed poll is not a failed scan (rpcd hiccup) — retry */
					pollScan(started);
				});
			}, 3000);
		};

		var legacyScan = function() {
			/* pre-async daemon: single blocking call with a bumped XHR timeout */
			var saved = L.env.rpctimeout;
			L.env.rpctimeout = 120;
			var restore = function() { L.env.rpctimeout = saved; scanBtn.disabled = false; };
			return callScan(data.modem).then(function(r) {
				restore();
				if (r && r.ok === false)
					return scanFail(r.error || '?');
				renderOps((r || {}).operators || []);
			}).catch(function(e) {
				restore();
				scanFail((e && e.message) || e);
			});
		};

		scanBtn = E('button', { 'class': 'btn cbi-button',
			'click': ui.createHandlerFn(self, function() {
				scanBtn.disabled = true;
				scanSpinner(null);
				return callScanStart(data.modem).then(function(r) {
					if (r && r.ok === false)
						return scanFail(r.error || '?');
					pollScan(r && r.started);
				}).catch(function(e) {
					return legacyScan();
				});
			}) }, _('Scan for operators'));

		var autoBtn = E('button', { 'class': 'btn cbi-button', 'style': 'margin-left:6px',
			'click': ui.createHandlerFn(self, function() {
				return setSelection('auto', 0, 0, _('Automatic network selection enabled.'));
			}) }, _('Set automatic'));

		return E('div', {}, [
			E('h3', {}, _('Network selection')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', {}, infoRows),
				E('p', { 'style': 'margin:8px 0' }, E('em', {},
					_('Automatic lets the modem choose the best operator. A manual scan lists the visible operators so you can force one (e.g. to prefer a partner network while roaming).'))),
				E('div', {}, [ scanBtn, autoBtn ]),
				results,
			]),
		]);
	}
});
