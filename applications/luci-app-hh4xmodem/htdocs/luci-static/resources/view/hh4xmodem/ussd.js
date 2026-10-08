/*
 * ussd.js - USSD code sender for HH4xModem
 * Copyright (C) 2026 HH4xModem
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
'require rpc';
'require ui';
'require view';

const callSendUssd = rpc.declare({
	object: 'hh4xmodem',
	method: 'send_ussd',
	params: { code: '' },
	reject: true
});

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function() {
		return L.resolveDefault(null);
	},

	render: function() {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [_('USSD Codes')]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Send USSD codes to your network operator (e.g., balance check, data plans).')
			]),
			E('hr'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [_('USSD Code')]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', {
								'type': 'text',
								'id': 'ussd-code',
								'class': 'cbi-input-text',
								'style': 'width: 100%; direction: ltr; font-family: monospace; font-size: 1.1em;',
								'placeholder': '*100#',
								'autofocus': null,
								'keydown': function(ev) {
									if (ev.keyCode === 13) {
										var btn = document.getElementById('ussd-send');
										if (btn) btn.click();
									}
								}
							})
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [_('Keypad')]),
						E('div', { 'class': 'cbi-value-field', 'style': 'display: flex; flex-wrap: wrap; gap: 4px;' },
							['1','2','3','4','5','6','7','8','9','*','0','#'].map(function(ch) {
								return E('button', {
									'class': 'btn cbi-button',
									'style': 'min-width: 2.8em; font-size: 1.2em; text-align: center;',
									'click': function() {
										var inp = document.getElementById('ussd-code');
										if (inp) {
											var start = inp.selectionStart || inp.value.length;
											inp.value = inp.value.slice(0, start) + ch + inp.value.slice(inp.selectionEnd || start);
											inp.focus();
											inp.selectionStart = inp.selectionEnd = start + 1;
										}
									}
								}, [ch]);
							})
						)
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, ['']),
						E('div', { 'class': 'cbi-value-field' }, [
							E('button', {
								'id': 'ussd-send',
								'class': 'cbi-button cbi-button-action important',
								'click': function(ev) {
									ev.preventDefault();
									var code = document.getElementById('ussd-code');
									if (!code || !code.value.trim()) {
										ui.addNotification(null, E('p', [_('Please enter a USSD code.')]), 'info');
										return;
									}
									sendUssdCode(code.value.trim());
								}
							}, [_('Send')]),
							' ',
							E('button', {
								'class': 'cbi-button cbi-button-neutral',
								'click': function() {
									clearUssd();
								}
							}, [_('Clear')])
						])
					])
				])
			]),
			E('div', { 'id': 'ussd-output', 'class': 'ussd-output', 'style': 'display:none;' })
		]);
	}
});

function setButtonsEnabled(enabled) {
	var send = document.getElementById('ussd-send');
	var code = document.getElementById('ussd-code');
	if (send) send.disabled = !enabled;
	if (code) code.disabled = !enabled;
}

function showOutput(msg) {
	var out = document.getElementById('ussd-output');
	if (!out) return;
	out.style.display = 'block';
	out.textContent = msg;
}

function clearUssd() {
	var code = document.getElementById('ussd-code');
	var out = document.getElementById('ussd-output');
	if (code) code.value = '';
	if (out) { out.style.display = 'none'; out.textContent = ''; }
	if (code) code.focus();
}

function sendUssdCode(code) {
	showOutput(_('Sending...'));
	setButtonsEnabled(false);

	callSendUssd({ code: code }).then(function(r) {
		if (!r) { showOutput(_('No response from modem.')); return; }
		if (r.error == null && r.text) {
			showOutput(r.text);
		} else if (r.error) {
			showOutput(r.error);
		} else {
			showOutput(_('No response from modem.'));
		}
	}).catch(function(err) {
		showOutput(_('Error: ') + String(err));
	}).finally(function() {
		setButtonsEnabled(true);
		var send = document.getElementById('ussd-send');
		if (send) send.textContent = _('Send');
	});
}
