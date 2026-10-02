/*
 * calllog.js - Call log viewer for HH4xModem
 * Copyright (C) 2026 HH4xModem
 * Licensed under the Apache License, Version 2.0.
 */

'use strict';
'require rpc';
'require view';
'require ui';

// Load custom stylesheet once
if (!document.querySelector('link[href*="hh4xmodem.css"]')) {
	document.querySelector('head').appendChild(E('link', {
		'rel': 'stylesheet',
		'type': 'text/css',
		'href': L.resource('view/hh4xmodem/hh4xmodem.css') + '?_=' + Date.now()
	}));
}

const callCallLogData = rpc.declare({
	object: 'hh4xmodem',
	method: 'get_calllog_data'
});

const callClearCallLog = rpc.declare({
	object: 'hh4xmodem',
	method: 'clear_call_log',
	reject: true
});

// ---- Helpers ----

function formatDate(dateStr) {
	if (!dateStr) return '--';
	// Format: "2026-06-06 05:44:17" -> relative or short
	return dateStr;
}

function formatDuration(seconds) {
	if (seconds == null || seconds == 0) return '--';
	if (seconds < 60) return seconds + 's';
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	if (m < 60) return m + 'm ' + s + 's';
	const h = Math.floor(m / 60);
	const mn = m % 60;
	return h + 'h ' + mn + 'm ' + s + 's';
}

function callTypeLabel(type) {
	// CallLogType: 0=incoming, 1=outgoing, 2=missed, 3=?
	switch (type) {
		case 0: return { text: _('Incoming'), cls: 'call-incoming' };
		case 1: return { text: _('Outgoing'), cls: 'call-outgoing' };
		case 2: return { text: _('Missed'), cls: 'call-missed' };
		default: return { text: _('Unknown'), cls: '' };
	}
}

function createCard(title, content) {
	return E('div', { 'class': 'cbi-section hh4x-card' }, [
		E('div', { 'class': 'hh4x-card-header' }, [
			E('h3', { 'class': 'hh4x-card-title' }, [title])
		]),
		E('div', { 'class': 'hh4x-card-body' }, content)
	]);
}

function createInfoRow(label, value) {
	return E('div', { 'class': 'hh4x-info-row' }, [
		E('span', { 'class': 'hh4x-info-label' }, [label]),
		E('span', { 'class': 'hh4x-info-value' }, [value != null ? String(value) : '--'])
	]);
}

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function () {
		return callCallLogData({ list_type: 0, page: 1 });
	},

	render: function (data) {
		let countInfo = data.GetCallLogCountInfo || {};
		let listData = data.GetCallLogList || {};
		let callLog = listData.CallLogList || [];

		let body = E('div', { 'class': 'hh4x-page' }, [
			E('div', { 'class': 'hh4x-page-header' }, [
				E('h2', { 'class': 'hh4x-page-title' }, [_('Call Log')]),
				E('p', { 'class': 'hh4x-page-desc' }, [
					_('View incoming, outgoing, and missed call history from the modem.')
				]),
				E('button', {
					'class': 'cbi-button cbi-button-negative',
					'style': 'margin-top:8px;',
					'click': function (e) {
						e.preventDefault();
						if (!confirm(_('Clear all call log entries? This cannot be undone.'))) return;
						var btn = e.target;
						btn.disabled = true;
						btn.textContent = _('Clearing...');
						callClearCallLog().then(function (r) {
							if (r && r.error == null) {
								btn.textContent = _('✓ Cleared');
								setTimeout(function () { window.location.reload(); }, 2000);
							} else {
								ui.addNotification(null, E('p', [_('Clear failed: ') + (r?.error || _('Unknown error'))]), 'error');
								btn.disabled = false;
								btn.textContent = _('Clear All');
							}
						}).catch(function (err) {
							ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
							btn.disabled = false;
							btn.textContent = _('Clear All');
						});
					}
				}, [_('Clear All')])
			])
		]);

		// ---- Summary Card ----
		let totalCalls = countInfo.TotalUsedCount || 0;
		let summaryCard = createCard(_('Call Summary'), [
			E('div', { 'class': 'hh4x-summary-grid' }, [
				E('div', { 'class': 'hh4x-summary-item' }, [
					E('span', { 'class': 'hh4x-summary-count' }, [String(countInfo.IncomingCallUsed || 0)]),
					E('span', { 'class': 'hh4x-summary-label' }, [_('Incoming')])
				]),
				E('div', { 'class': 'hh4x-summary-item' }, [
					E('span', { 'class': 'hh4x-summary-count' }, [String(countInfo.OutgoingCallUsed || 0)]),
					E('span', { 'class': 'hh4x-summary-label' }, [_('Outgoing')])
				]),
				E('div', { 'class': 'hh4x-summary-item' }, [
					E('span', { 'class': 'hh4x-summary-count' }, [String(countInfo.MissedCallUsed || 0)]),
					E('span', { 'class': 'hh4x-summary-label' }, [_('Missed')])
				]),
				E('div', { 'class': 'hh4x-summary-item' }, [
					E('span', { 'class': 'hh4x-summary-count' }, [String(totalCalls)]),
					E('span', { 'class': 'hh4x-summary-label' }, [_('Total')])
				])
			])
		]);
		body.appendChild(summaryCard);

		// ---- Call Log Table Card ----
		if (callLog.length === 0) {
			body.appendChild(createCard(_('Call History'), [
				E('p', { 'style': 'text-align:center;color:var(--text-color-medium);padding:2em 0;' }, [_('No call records found.')])
			]));
		} else {
			let rows = [];
			for (let call of callLog) {
				let typeInfo = callTypeLabel(call.CallLogType);
				let typeBadge = E('span', { 'class': 'hh4x-call-type-badge ' + typeInfo.cls }, [typeInfo.text]);
				let dur = formatDuration(call.Duration);

				rows.push(E('div', { 'class': 'hh4x-call-row' }, [
					E('div', { 'class': 'hh4x-call-left' }, [
						typeBadge,
						E('span', { 'class': 'hh4x-call-number' }, [call.TelNumber || '--'])
					]),
					E('div', { 'class': 'hh4x-call-right' }, [
						E('span', { 'class': 'hh4x-call-date' }, [formatDate(call.Date)]),
						E('span', { 'class': 'hh4x-call-duration' }, [dur])
					])
				]));
			}

			body.appendChild(createCard(_('Call History (' + callLog.length + ')'), [
				E('div', { 'class': 'hh4x-call-list' }, rows)
			]));
		}

		return body;
	}
});
