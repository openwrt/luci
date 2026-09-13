'use strict';
'require view';
'require poll';
'require rpc';
'require ui';

const callGetHistory = rpc.declare({
	object: 'luci.wifihistory',
	method: 'getHistory',
	expect: { history: {} }
});

const callClearHistory = rpc.declare({
	object: 'luci.wifihistory',
	method: 'clearHistory',
	expect: { result: true }
});

function formatDate(epoch) {
	if (!epoch || epoch <= 0)
		return '-';

	return new Date(epoch * 1000).toLocaleString();
}

return view.extend({
	load() {
		return callGetHistory();
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
						return callClearHistory().then(L.bind(function() {
							ui.hideModal();
							return callGetHistory().then(L.bind(function(history) {
								this.updateTable('#wifi_history_table', history);
							}, this));
						}, this));
					})
				}, _('Clear'))
			])
		]);
	},

	render(history) {
		const isReadonlyView = !L.hasViewPermission();

		const v = E([], [
			E('h2', _('Station History')),
			E('div', { 'class': 'cbi-map-descr' },
				_('This page displays a history of all WiFi stations that have connected to this device, including currently connected and previously seen devices.')),

			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'right', 'style': 'margin-bottom:1em' }, [
					E('button', {
						'class': 'btn cbi-button-negative',
						'disabled': isReadonlyView,
						'click': ui.createHandlerFn(this, 'handleClearHistory')
					}, _('Clear History'))
				]),

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
			])
		]);

		this.updateTable(v.querySelector('#wifi_history_table'), history);

		poll.add(L.bind(function() {
			return callGetHistory().then(L.bind(function(history) {
				this.updateTable('#wifi_history_table', history);
			}, this));
		}, this), 5);

		return v;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
