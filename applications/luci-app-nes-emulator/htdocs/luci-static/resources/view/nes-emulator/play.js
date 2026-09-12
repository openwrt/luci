'use strict';
'require view';
'require nes-emulator as nesEmulator';

const callAccess = nesEmulator.declareLongRunningRpc({
	object: 'nes-emulator',
	method: 'access',
	expect: { '': {} }
});

function urlHost(hostname) {
	return hostname.includes(':') && hostname[0] !== '['
		? '[' + hostname + ']'
		: hostname;
}

return view.extend({
	load() {
		return callAccess().catch(error => ({
			error: error.message || String(error)
		}));
	},

	accessSection(access, busy) {
		access = access || {};
		const port = String(access.port || '29876');
		const token = access.token || '';
		const accessError = access.error || '';
		const effectiveError = accessError ||
			(access.ok === false ? _('Service unavailable') : '');
		const unavailableMessage = busy
			? _('Starting nesd…')
			: effectiveError
				? _('Cannot open the game client: %s').format(effectiveError)
				: _('This page requires NES emulator control permission. The access token is never exposed to read-only LuCI sessions.');
		const playUrl = 'http://' + urlHost(window.location.hostname) +
			':' + port + '/play#token=' + encodeURIComponent(token);
		const https = window.location.protocol === 'https:';
		const launch = token
			? E('a', {
				class: 'btn cbi-button cbi-button-apply',
				href: playUrl,
				target: '_blank',
				rel: 'noopener noreferrer'
			}, _('Open game window'))
			: E('span', {
				class: 'btn cbi-button disabled',
				'aria-disabled': 'true'
			}, effectiveError
				? _('Service unavailable')
				: _('Control permission required'));
		const connectionHelp = token && https
			? E('details', {}, [
				E('summary', {}, _('Connection help')),
				E('p', {},
					_('LuCI is using HTTPS, while the local game client uses HTTP. If the browser blocks the new window or upgrades it to HTTPS, allow HTTP for this router address or use a trusted reverse proxy.'))
			])
			: '';

		return E('div', { class: 'cbi-section' }, [
			!token
				? E('p', { class: 'alert-message warning' },
					unavailableMessage)
				: '',
			token
				? E('p', {},
					_('The game client opens in a separate local window. The router still runs FCEUmm and renders every frame.'))
				: '',
			connectionHelp,
			E('p', { class: 'cbi-page-actions' }, [
				launch,
				effectiveError ? ' ' : '',
				effectiveError
					? E('button', {
						class: 'btn cbi-button cbi-button-action',
						'data-nes-retry': '1',
						disabled: Boolean(busy),
						click: this.onRetry.bind(this)
					}, busy ? _('Starting…') : _('Retry'))
					: ''
			])
		]);
	},

	updateAccessSection() {
		const node = document.getElementById('nes-play-access');
		if (node) {
			node.replaceChildren(
				this.accessSection(this.access, this.retryBusy)
			);
		}
	},

	async onRetry() {
		if (this.retryBusy)
			return;
		this.retryBusy = true;
		this.updateAccessSection();
		try {
			this.access = await callAccess();
			if (!this.access) {
				this.access = {
					error: _('Empty response while starting nesd')
				};
			}
		}
		catch (error) {
			this.access = {
				error: error.message || String(error)
			};
		}
		finally {
			this.retryBusy = false;
			this.updateAccessSection();
		}
	},

	render(data) {
		this.access = data || {};
		this.retryBusy = false;

		return E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('Play (thin client)')),
			E('div', { class: 'cbi-map-descr' },
				_('The router runs FCEUmm and renders every frame in software. This page only displays the stream, plays audio and sends controller input.')),
			E('div', { id: 'nes-play-access' },
				this.accessSection(this.access, false))
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
