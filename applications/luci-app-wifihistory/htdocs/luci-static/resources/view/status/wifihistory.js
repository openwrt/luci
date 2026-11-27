'use strict';
'require view';
'require poll';
'require rpc';
'require form';
'require ui';

const callGetHistory = rpc.declare({
	object: 'luci.wifihistory',
	method: 'getHistory'
});

function getHistory() {
	return callGetHistory().then(function(result) {
		if (result?.error)
			throw new Error(result.error);

		if (!result || typeof result.history != 'object' ||
		    result.history == null || Array.isArray(result.history))
			throw new Error('history-invalid-response');

		return result.history;
	});
}

function historyErrorMessage(error) {
	switch (error?.message) {
	case 'history-read-failed':
		return _('Unable to read station history. Check the system log for details.');
	case 'history-invalid-json':
	case 'history-invalid-format':
	case 'history-invalid-response':
		return _('Station history is invalid or corrupted. Check the system log for details.');
	default:
		return _('Unable to retrieve station history. Please try again.');
	}
}

const callGetStatus = rpc.declare({
	object: 'luci.wifihistory',
	method: 'getStatus'
});

const callClearHistory = rpc.declare({
	object: 'luci.wifihistory',
	method: 'clearHistory'
});

function formatDate(epoch) {
	if (!epoch || epoch <= 0)
		return '-';

	return new Date(epoch * 1000).toLocaleString();
}

return view.extend({
	load() {
		return Promise.all([
			getHistory().then(
				history => ({ history }),
				error => ({ historyError: error })
			),
			callGetStatus().catch(function(error) {
				console.warn('Unable to retrieve WiFi history storage status:', error);
				return null;
			})
		]);
	},
	updateTable(table, history) {
		const stations = Object.values(history);

		/* Sort connected stations first, then by most recently seen */
		stations.sort((a, b) => {
			if (a.connected !== b.connected)
				return a.connected ? -1 : 1;

			return (b.last_seen || 0) - (a.last_seen || 0);
		});

		const rows = [];

		for (const s of stations) {
			let hint;
			if (s.hostname && s.ipv4 && s.ipv6)
				hint = '%s (%s, %s)'.format(s.hostname, s.ipv4, s.ipv6);
			else if (s.hostname && (s.ipv4 || s.ipv6))
				hint = '%s (%s)'.format(s.hostname, s.ipv4 || s.ipv6);
			else if (s.ipv4 || s.ipv6)
				hint = s.ipv4 || s.ipv6;
			else
				hint = '-';

			let sig_value = '-';
			let sig_title = '';

			if (s.signal && s.signal !== 0) {
				if (s.noise && s.noise !== 0) {
					sig_value = '%d/%d\xa0%s'.format(s.signal, s.noise, _('dBm'));
					sig_title = '%s: %d %s / %s: %d %s / %s %d'.format(
						_('Signal'), s.signal, _('dBm'),
						_('Noise'), s.noise, _('dBm'),
						_('SNR'), s.signal - s.noise);
				}
				else {
					sig_value = '%d\xa0%s'.format(s.signal, _('dBm'));
					sig_title = '%s: %d %s'.format(_('Signal'), s.signal, _('dBm'));
				}
			}

			let icon;
			if (!s.connected) {
				icon = L.resource('icons/signal-none.svg');
			}
			else {
				/* Estimate signal quality as percentage:
				 * Map dBm range [-110, -40] to [0%, 100%] */
				const q = Math.min((s.signal + 110) / 70 * 100, 100);
				if (q == 0)
					icon = L.resource('icons/signal-000-000.svg');
				else if (q < 25)
					icon = L.resource('icons/signal-000-025.svg');
				else if (q < 50)
					icon = L.resource('icons/signal-025-050.svg');
				else if (q < 75)
					icon = L.resource('icons/signal-050-075.svg');
				else
					icon = L.resource('icons/signal-075-100.svg');
			}

			rows.push([
				E('span', {
					'class': 'ifacebadge',
					'style': s.connected ? '' : 'opacity:0.5',
					'title': s.connected ? _('Connected') : _('Disconnected')
				}, [
					E('img', { 'src': icon, 'style': 'width:16px;height:16px' }),
					E('span', {}, [ ' ', s.connected ? _('Yes') : _('No') ])
				]),
				s.mac,
				hint,
				s.network || '-',
				E('span', { 'title': sig_title }, sig_value),
				formatDate(s.first_seen),
				formatDate(s.last_seen)
			]);
		}

		cbi_update_table(table, rows, E('em', _('No station history available')));
	},

	handleClearHistory(ev) {
		return ui.showModal(_('Clear Station History'), [
			E('p', _('This will permanently delete all recorded station history. Are you sure?')),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, _('Cancel')), ' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': ui.createHandlerFn(this, function() {
						return callClearHistory().then(L.bind(function(result) {
							if (!result || result.result !== true) {
								let message;

								switch (result?.error) {
								case 'busy':
									message = _('History is currently being updated. Try again.');
									break;
								case 'storage-unavailable':
									message = _('Configured storage is unavailable (%s). History was not cleared.').format(result.reason || 'unknown');
									break;
								case 'storage-clear-pending':
									message = _('History clearing is pending. The operation will be retried when storage is available.');
									break;
								case 'marker-check-failed':
									message = _('Unable to check the history clear status. No changes were made.');
									break;
								case 'marker-write-failed':
									message = _('Unable to create the history clear marker. No changes were made.');
									break;
								case 'ram-write-failed':
									message = _('Failed to clear history in RAM. The operation may be retried automatically.');
									break;
								default:
									message = _('Failed to clear station history.');
								}

								ui.addNotification(_('Clear History'), E('p', message), 'error');
								return;
							}

							ui.hideModal();
							return getHistory().then(L.bind(function(history) {
								this.updateTable('#wifi_history_table', history);
							}, this)).catch(function(err) {
								ui.addNotification(_('Clear History'), E('p',
									_('History was cleared, but could not be reloaded: %s').format(historyErrorMessage(err))), 'warning');
							});
						}, this)).catch(function(err) {
							ui.addNotification(_('Clear History'), E('p',
								_('RPC request failed: %s').format(err.message || err)), 'error');
						});
					})
				}, _('Clear'))
			])
		]);
	},

	renderStorageStatus(status) {
		if (!status)
			return E('div', { 'class': 'cbi-map-descr' },
				_('Unable to retrieve storage status.'));
		let text;

		switch (status?.reason) {
		case 'ok':
			text = _('History is saved to %s and survives a reboot.').format(status.path);
			break;

		case 'not-mounted':
			text = _('%s is not on a mounted external device. History is kept in RAM only until the device is available.').format(status.path);
			break;

		case 'not-usb':
			text = _('%s is not on a USB device. History is kept in RAM only.').format(status.path);
			break;

		case 'invalid':
			text = _('The configured storage path is invalid or points outside the mounted device. History is kept in RAM only.');
			break;

		default:
			text = _('History is kept in RAM only and is lost on reboot.');
		}

		return E('div', { 'class': 'cbi-map-descr' }, text);
	},

	renderSettings() {
		const m = new form.Map('wifihistory');
		const s = m.section(form.NamedSection, 'config', 'wifihistory');
		let o;

		o = s.option(form.Value, 'storage_path', _('Storage path'),
			_('Directory on a mounted external drive (for example USB) used to keep the history across reboots. Leave empty to keep the history in RAM only.'));
		o.placeholder = '/mnt/sda1/wifihistory';
		o.rmempty = true;
		o.validate = function(section_id, value) {
			if (value && value.charAt(0) !== '/')
				return _('The path must be absolute');

			return true;
		};

		o = s.option(form.Value, 'save_interval', _('Write interval'),
			_('Seconds between periodic writes to the storage path. Connection changes and service stop are written immediately.'));
		o.datatype = 'range(30,86400)';
		o.placeholder = '300';
		o.rmempty = true;

		return m.render();
	},

	render([ historyResult, status ]) {
		const isReadonlyView = !L.hasViewPermission();
		const history = historyResult.history;

		return this.renderSettings().then(L.bind(function(settings) {
			const v = E([], [
				E('h2', _('Station History')),
				E('div', { 'class': 'cbi-map-descr' },
					_('This page displays a history of all WiFi stations that have connected to this device, including currently connected and previously seen devices.')),

				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'right', 'style': 'margin-bottom:1em' }, [
						E('button', {
							'class': 'btn cbi-button-negative',
							'disabled': isReadonlyView || null,
							'click': ui.createHandlerFn(this, 'handleClearHistory')
						}, _('Clear History'))
					]),

					E('div', {
						'id': 'wifi_history_error',
						'class': 'alert-message warning',
						'style': historyResult.historyError ? '' : 'display:none'
					}, historyResult.historyError
						? historyErrorMessage(historyResult.historyError) : ''),
					E('table', { 'class': 'table', 'id': 'wifi_history_table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th' }, _('Connected')),
							E('th', { 'class': 'th' }, _('MAC address')),
							E('th', { 'class': 'th' }, _('Host')),
							E('th', { 'class': 'th' }, _('Network')),
							E('th', { 'class': 'th' }, '%s / %s'.format(_('Signal'), _('Noise'))),
							E('th', { 'class': 'th' }, _('First seen')),
							E('th', { 'class': 'th' }, _('Last seen'))
						])
					])
				]),

				E('h3', _('Storage')),
				this.renderStorageStatus(status),
				settings
			]);

			if (history)
				this.updateTable(v.querySelector('#wifi_history_table'), history);

			poll.add(L.bind(function() {
				return getHistory().then(L.bind(function(history) {
					this.updateTable('#wifi_history_table', history);

					const errorNode = v.querySelector('#wifi_history_error');
					if (errorNode) {
						errorNode.style.display = 'none';
						errorNode.textContent = '';
					}
				}, this)).catch(function(error) {
					const errorNode = v.querySelector('#wifi_history_error');
					if (errorNode) {
						errorNode.textContent = historyErrorMessage(error);
						errorNode.style.display = '';
					}
				});
			}, this), 5);

			return v;
		}, this));
	}
});
