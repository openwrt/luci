'use strict';
'require view';
'require rpc';
'require ui';
'require nes-emulator as nesEmulator';

const callCanControl = rpc.declare({
	object: 'session',
	method: 'access',
	params: [ 'scope', 'object', 'function' ],
	expect: { '': { access: false } }
});

const callStatus = rpc.declare({
	object: 'nes-emulator',
	method: 'status',
	expect: { '': {} }
});

const callRoms = rpc.declare({
	object: 'nes-emulator',
	method: 'roms',
	expect: { '': { roms: [] } }
});

const callLoad = nesEmulator.declareLongRunningRpc({
	object: 'nes-emulator',
	method: 'load',
	params: [ 'path' ],
	expect: { '': {} }
});

const callImport = nesEmulator.declareLongRunningRpc({
	object: 'nes-emulator',
	method: 'import',
	params: [ 'staged', 'name' ],
	expect: { '': {} }
});

const callReserveUpload = rpc.declare({
	object: 'nes-emulator',
	method: 'reserve_upload',
	expect: { '': {} }
});

const callDiscardUpload = rpc.declare({
	object: 'nes-emulator',
	method: 'discard_upload',
	params: [ 'staged' ],
	expect: { '': {} }
});

const callStart = nesEmulator.declareLongRunningRpc({
	object: 'nes-emulator',
	method: 'start',
	expect: { '': {} }
});

const callStop = rpc.declare({
	object: 'nes-emulator',
	method: 'stop',
	expect: { '': {} }
});

const callPause = rpc.declare({
	object: 'nes-emulator',
	method: 'pause',
	expect: { '': {} }
});

const callEmuReset = rpc.declare({
	object: 'nes-emulator',
	method: 'reset',
	expect: { '': {} }
});

function withTimeout(promise, ms) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(_('Request timed out'))),
			ms
		);
		Promise.resolve(promise).then(
			value => {
				clearTimeout(timer);
				resolve(value);
			},
			error => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

function requireSuccess(reply) {
	if (!reply)
		throw new Error(_('Empty response'));
	if (reply.error || reply.ok === false)
		throw new Error(reply.error || _('Operation failed'));
	return reply;
}

return view.extend({
	load() {
		return callCanControl('ubus', 'nes-emulator', 'access')
			.catch(() => ({ access: false }));
	},

	render(data) {
		this.canControl = Boolean(data && data.access);
		this.actionBusy = false;
		this.lastStatus = null;
		// Invalidate requests owned by an older rendering of this view.
		this.refreshGeneration = (this.refreshGeneration || 0) + 1;
		const body = E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('NES Emulator')),
			E('div', { class: 'cbi-map-descr' },
				_('FCEUmm, picture rendering and optional JPEG encoding all run on the router CPU. The browser is only a display, audio sink and controller.')),
			E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Status')),
				E('div', { id: 'nes-status', class: 'cbi-value' },
					E('em', {}, _('Loading status…'))),
				E('div', { class: 'cbi-page-actions' }, [
					E('button', {
						class: 'btn cbi-button cbi-button-apply',
						'data-nes-action': '1',
						'data-nes-kind': 'start',
						disabled: true,
						click: ui.createHandlerFn(this, 'onStart')
					}, _('Start')),
					' ',
					E('button', {
						class: 'btn cbi-button cbi-button-action',
						'data-nes-action': '1',
						'data-nes-kind': 'pause',
						disabled: true,
						click: ui.createHandlerFn(this, 'onPause')
					}, _('Pause / Resume')),
					' ',
					E('button', {
						class: 'btn cbi-button cbi-button-action',
						'data-nes-action': '1',
						'data-nes-kind': 'reset',
						disabled: true,
						click: ui.createHandlerFn(this, 'onEmuReset')
					}, _('Reset console')),
					' ',
					E('button', {
						class: 'btn cbi-button cbi-button-remove',
						'data-nes-action': '1',
						'data-nes-kind': 'stop',
						disabled: true,
						click: ui.createHandlerFn(this, 'onStop')
					}, _('Stop emulation')),
					' ',
					E('button', {
						class: 'btn cbi-button',
						click: ui.createHandlerFn(this, 'onRefreshAll')
					}, _('Refresh'))
				])
			]),
			this.canControl ? E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Upload ROM from this computer')),
				E('p', {},
					_('The authenticated LuCI uploader stages the file, then rpcd validates its size, extension and NES header before an atomic import. Maximum size: 16 MiB.')),
				E('div', { class: 'cbi-page-actions' }, [
					E('button', {
						class: 'btn cbi-button cbi-button-apply',
						'data-nes-action': '1',
						'data-nes-kind': 'upload',
						disabled: !this.canControl,
						click: ui.createHandlerFn(this, 'onUpload')
					}, _('Choose, upload & load ROM'))
				])
			]) : '',
			E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('ROMs on router')),
				E('div', { id: 'nes-rom-table' },
					E('em', {}, _('Loading ROM list…')))
			]),
			E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Play')),
				this.canControl ? E('p', {}, [
					E('a', {
						href: L.url('admin/services/nes-emulator/play')
					}, _('Open Play tab (control permission required)'))
				]) : E('p', { class: 'alert-message warning' },
					_('Read-only access: game controls, ROM loading and uploads are disabled.')),
				this.canControl && window.location.protocol === 'https:'
					? E('details', {}, [
						E('summary', {}, _('Connection help')),
						E('p', {},
							_('LuCI is using HTTPS, while the local game client uses HTTP. If the browser blocks the new window or upgrades it to HTTPS, allow HTTP for this router address or use a trusted reverse proxy.'))
					])
					: ''
			])
		]);

		requestAnimationFrame(() => this.onRefreshAll());
		return body;
	},

	statusText(status) {
		if (!status || status.error)
			return E('em', {}, status && status.error
				? status.error
				: _('Daemon is not reachable'));

		const parts = [
			status.core || 'FCEUmm',
			status.rom ? _('ROM: %s').format(status.rom) : _('no ROM'),
			status.running ? _('running') : _('stopped'),
			status.on_demand ? _('on demand') : '',
			status.paused ? _('paused') : '',
			status.stream_format || '',
			status.stream_fps
				? _('%s stream FPS').format(status.stream_fps)
				: ''
		].filter(Boolean);

		return E('span', {}, parts.join(' · '));
	},

	romTable(list, error, notice, truncated) {
		const rows = (list || []).map(item => {
			const path = typeof item === 'string'
				? item
				: (item.path || item.name || '');
			const label = typeof item === 'string'
				? item
				: (item.name || item.path || '');
			const unreadable = typeof item === 'object' &&
				item !== null && item.readable === false;
			const reason = unreadable
				? (item.error ||
					_('Not readable by nesd; upload through LuCI or set group nesd and mode 0640.'))
				: '';

			return E('tr', { class: 'tr' }, [
				E('td', { class: 'td' }, unreadable
					? [
						label,
						E('br'),
						E('small', { class: 'warning' }, reason)
					]
					: label),
				E('td', { class: 'td' }, [
					E('button', {
						class: 'btn cbi-button cbi-button-apply',
						'data-nes-action': '1',
						'data-nes-kind': 'load',
						'data-nes-unavailable': unreadable ? '1' : '0',
						disabled: Boolean(
							this.actionBusy ||
							!path ||
							!this.canControl ||
							unreadable
						),
						title: reason,
						click: ui.createHandlerFn(this, 'onLoad', path)
					}, _('Load'))
				])
			]);
		});

		if (!rows.length) {
			rows.push(E('tr', { class: 'tr' }, [
				E('td', { class: 'td', colspan: 2 },
					E('em', {}, error || (this.canControl
						? _('No ROMs — upload one above')
						: _('No ROMs found'))))
			]));
		}
		if (truncated || notice) {
			rows.push(E('tr', { class: 'tr' }, [
				E('td', { class: 'td', colspan: 2 },
					E('small', {}, [
						truncated ? _('ROM list was truncated. ') : '',
						notice || ''
					]))
			]));
		}

		return E('table', { class: 'table' }, [
			E('tr', { class: 'tr table-titles' }, [
				E('th', { class: 'th' }, _('File')),
				E('th', { class: 'th' }, _('Action'))
			]),
			...rows
		]);
	},

	notifyError(title, error) {
		ui.addNotification(
			null,
			E('p', {}, _('%s: %s').format(title, error.message || error)),
			'error'
		);
	},

	statusHasGame(status) {
		if (!status || status.error)
			return false;
		if (typeof status.game_loaded === 'boolean')
			return status.game_loaded;
		return Boolean(status.rom || status.rom_path);
	},

	stateAllowsAction(kind, status) {
		if (kind === 'load' || kind === 'upload')
			return true;
		if (!status || status.error)
			return false;

		const loaded = this.statusHasGame(status);
		switch (kind) {
		case 'start':
			return loaded && !status.running;
		case 'pause':
		case 'reset':
		case 'stop':
			return loaded && Boolean(status.running);
		default:
			return true;
		}
	},

	syncActionButtons() {
		document.querySelectorAll('[data-nes-action]').forEach(button => {
			const kind = button.getAttribute('data-nes-kind') || '';
			const unavailable =
				button.getAttribute('data-nes-unavailable') === '1';
			button.disabled = Boolean(
				this.actionBusy ||
				!this.canControl ||
				unavailable ||
				!this.stateAllowsAction(kind, this.lastStatus)
			);
			if (kind === 'pause') {
				button.textContent = this.lastStatus &&
					this.lastStatus.paused
					? _('Resume')
					: _('Pause');
			}
		});
	},

	setActionBusy(busy) {
		this.actionBusy = busy;
		this.syncActionButtons();
	},

	async runAction(action, successText, timeoutMs = 30000) {
		if (this.actionBusy)
			return;
		this.setActionBusy(true);
		try {
			requireSuccess(await withTimeout(action(), timeoutMs));
			if (successText) {
				ui.addNotification(null, E('p', {}, successText), 'info');
			}
			await this.onRefreshAll();
		}
		catch (error) {
			this.notifyError(_('Operation failed'), error);
		}
		finally {
			this.setActionBusy(false);
		}
	},

	async onLoad(path) {
		if (!this.canControl || !path)
			return;
		await this.runAction(
			() => callLoad(path),
			_('Loaded %s').format(path),
			nesEmulator.getActionTimeout()
		);
	},

	async onUpload() {
		let staged = '';

		if (!this.canControl || this.actionBusy)
			return;
		this.setActionBusy(true);
		try {
			const reservation = requireSuccess(
				await withTimeout(callReserveUpload(), 20000)
			);
			staged = reservation.staged || '';
			if (!/^\/tmp\/nes-emulator-upload\/[0-9a-f]{32}\.rom$/.test(staged))
				throw new Error(_('Invalid upload reservation'));
			const reply = await ui.uploadFile(
				staged,
				null,
				_('Supported: iNES/NES 2.0, UNIF and FDS; maximum 16 MiB')
			);
			// rpcd import is transactional but cannot be cancelled. Waiting for
			// its real result avoids a false timeout followed by a racing discard.
			const result = await callImport(
				staged,
				reply.name || 'upload.nes'
			);
			if (result && result.stored)
				staged = '';
			if (result && result.stored &&
			    (result.error || result.ok === false)) {
				ui.addNotification(
					null,
					E('p', {}, _('ROM was stored but could not be loaded: %s (%s)')
						.format(
							result.path || reply.name || _('uploaded ROM'),
							result.error || _('Operation failed')
						)),
					'warning'
				);
				await this.onRefreshAll();
				return;
			}
			requireSuccess(result);
			staged = '';
			ui.addNotification(
				null,
				E('p', {}, _('ROM uploaded and loaded: %s')
					.format(result.path || reply.name)),
				'info'
			);
			await this.onRefreshAll();
		}
		catch (error) {
			if (staged)
				await withTimeout(callDiscardUpload(staged), 20000)
					.catch(() => {});
			this.notifyError(_('Upload failed'), error);
		}
		finally {
			this.setActionBusy(false);
		}
	},

	onStart() {
		if (!this.canControl ||
		    !this.stateAllowsAction('start', this.lastStatus))
			return Promise.resolve();
		return this.runAction(
			callStart,
			_('Emulation started'),
			nesEmulator.getActionTimeout()
		);
	},

	onStop() {
		if (!this.canControl ||
		    !this.stateAllowsAction('stop', this.lastStatus))
			return Promise.resolve();
		return this.runAction(callStop, _('Emulation stopped'));
	},

	onPause() {
		if (!this.canControl ||
		    !this.stateAllowsAction('pause', this.lastStatus))
			return Promise.resolve();
		return this.runAction(callPause);
	},

	onEmuReset() {
		if (!this.canControl ||
		    !this.stateAllowsAction('reset', this.lastStatus))
			return Promise.resolve();
		return this.runAction(callEmuReset, _('Console reset'));
	},

	async onRefreshAll() {
		const generation = (this.refreshGeneration || 0) + 1;
		this.refreshGeneration = generation;
		const statusRequest = withTimeout(callStatus(), 5000)
			.catch(error => ({ error: error.message || String(error) }))
			.then(status => {
				if (generation !== this.refreshGeneration)
					return;
				this.lastStatus = status;
				const statusNode = document.getElementById('nes-status');
				if (statusNode)
					statusNode.replaceChildren(this.statusText(status));
				this.syncActionButtons();
			});
		const romRequest = withTimeout(callRoms(), 15000)
			.catch(error => ({
				roms: [],
				error: error.message || String(error)
			}))
			.then(roms => {
				if (generation !== this.refreshGeneration)
					return;
				const romNode = document.getElementById('nes-rom-table');
				if (romNode) {
					romNode.replaceChildren(
						this.romTable(
							roms.roms || [],
							roms.error,
							roms.notice,
							roms.truncated
						)
					);
				}
				this.syncActionButtons();
			});

		await Promise.all([ statusRequest, romRequest ]);
		return generation === this.refreshGeneration;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
