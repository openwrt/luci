// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 Zhixuan WU <cogito.wu@gmail.com>

'use strict';
'require view';
'require rpc';
'require ui';

const calls = {
	status: rpc.declare({ object: 'ble', method: 'status', reject: true }),
	start: rpc.declare({ object: 'ble', method: 'start', reject: true }),
	stop: rpc.declare({ object: 'ble', method: 'stop', reject: true }),
	scan: rpc.declare({ object: 'ble', method: 'scan', params: ['seconds'], reject: true }),
	connect: rpc.declare({ object: 'ble', method: 'connect', params: ['address'], reject: true }),
	disconnect: rpc.declare({ object: 'ble', method: 'disconnect', params: ['address'], reject: true })
};

const phases = {
	stopped: _('Stopped'),
	starting: _('Starting'),
	ready: _('Ready'),
	stopping: _('Stopping'),
	failed: _('Failed')
};

const STATUS_TIMEOUT = 8000;
const LIFECYCLE_TIMEOUT = 10000;
const OPERATION_TIMEOUT = 18000;
const FOLLOWUP_TIMEOUT = 240000;
const FOLLOWUP_INTERVAL = 1000;

function responseError(reply) {
	return new Error(reply && typeof reply.error === 'string' && reply.error
		? reply.error : _('Invalid BLE service response'));
}

function stateFrom(reply) {
	if (!reply || typeof reply.ok !== 'boolean' || !reply.state)
		throw responseError(reply);

	const state = reply.state;
	if (typeof state.phase !== 'string' ||
	    !Object.prototype.hasOwnProperty.call(phases, state.phase) ||
	    typeof state.version !== 'string' ||
	    (state.detail != null && typeof state.detail !== 'string') ||
	    !Array.isArray(state.devices) || state.devices.some(device =>
		    !device || typeof device.address !== 'string' ||
		    typeof device.name !== 'string' || typeof device.address_type !== 'string' ||
		    typeof device.connected !== 'boolean' || typeof device.services_resolved !== 'boolean' ||
		    (device.rssi != null && !Number.isFinite(device.rssi))))
		throw new Error(_('Invalid BLE service response'));

	if ((state.phase === 'ready' && state.adapter == null) ||
	    (state.adapter != null &&
	    (typeof state.adapter.hci !== 'string' || typeof state.adapter.address !== 'string' ||
	     typeof state.adapter.powered !== 'boolean' || typeof state.adapter.discovering !== 'boolean')))
		throw new Error(_('Invalid BLE service response'));

	return state;
}

async function request(method, args, timeout) {
	let timer;
	try {
		return await Promise.race([
			Promise.resolve().then(() => calls[method].apply(null, args)),
			new Promise((resolve, reject) => {
				timer = setTimeout(() => reject(new Error(_('BLE request timed out'))), timeout);
			})
		]);
	}
	finally {
		clearTimeout(timer);
	}
}

function pending(phase, method) {
	return phase === 'stopping' || (method === 'start' && phase === 'starting');
}

return view.extend({
	load() {
		return request('status', [], STATUS_TIMEOUT).then(reply => {
			stateFrom(reply);
			return reply;
		// Keep load errors on this page, as text, with Refresh still available.
		}).catch(error => ({ loadError: new Error(String(error && error.message || error)) }));
	},

	allowed(method, address) {
		if (method === 'status')
			return true;
		if (!L.hasViewPermission() || this.stale)
			return false;
		if (method === 'start')
			return this.data.phase === 'stopped' || this.data.phase === 'failed';
		if (method === 'stop')
			return this.data.phase !== 'stopped';
		if (this.data.phase !== 'ready')
			return false;
		if (method === 'scan')
			return true;
		if (!/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(address))
			return false;

		const device = this.data.devices.find(device => device.address === address);
		return !!device && (method === 'connect' ? !device.connected
			: method === 'disconnect' && device.connected);
	},

	notify(error) {
		this.message = String(error && error.message || error);
		ui.addNotification(null, E('p', {}, [this.message]), 'error');
	},

	async perform(method, address, label) {
		if (this.busy)
			return;
		if (!this.allowed(method, address)) {
			this.notify(new Error(_('This BLE action is not currently available')));
			this.paint();
			return;
		}

		const container = this.container;
		const active = () => this.container === container && container.isConnected;
		if (!active())
			return;

		const lifecycle = method === 'start' || method === 'stop';
		const deadline = Date.now() + FOLLOWUP_TIMEOUT;
		const timeoutMessage = method === 'start'
			? _('BLE start did not finish; refresh to check the current state')
			: _('BLE stop did not finish; refresh to check the current state');
		const statusBudget = () => {
			if (!lifecycle)
				return STATUS_TIMEOUT;
			const remaining = deadline - Date.now();
			if (remaining <= 0)
				throw new Error(timeoutMessage);
			return Math.min(STATUS_TIMEOUT, remaining);
		};

		const read = async (method, args, timeout) => {
			if (!active())
				throw new Error(_('BLE view is no longer active'));
			this.stale = true;
			const reply = await request(method, args, timeout);
			if (!active())
				throw new Error(_('BLE view is no longer active'));
			if (lifecycle && Date.now() >= deadline)
				throw new Error(timeoutMessage);
			this.data = stateFrom(reply);
			this.stale = false;
			this.paint();
			if (reply.ok !== true)
				throw responseError(reply);
			return reply;
		};

		const follow = async allowInactiveFailure => {
			for (;;) {
				const phase = this.data.phase;
				if (phase === (method === 'start' ? 'ready' : 'stopped'))
					return;
				// Stop may succeed while retaining an inactive service's saved failure.
				if (allowInactiveFailure && phase === 'failed')
					return;
				allowInactiveFailure = false;
				if (phase === 'failed')
					throw new Error(this.data.detail || _('BLE lifecycle operation failed'));
				if (!pending(phase, method))
					throw new Error(_('Unexpected BLE lifecycle state') + ': ' + phase);
				const remaining = deadline - Date.now();
				if (remaining <= 0)
					throw new Error(timeoutMessage);
				await new Promise(resolve =>
					setTimeout(resolve, Math.min(FOLLOWUP_INTERVAL, remaining)));
				await read('status', [], statusBudget());
			}
		};

		this.busy = true;
		this.message = label;
		this.paint();
		try {
			const args = method === 'scan' ? [10]
				: method === 'connect' || method === 'disconnect' ? [address] : [];
			const reply = await read(method, args, lifecycle ? LIFECYCLE_TIMEOUT
				: method === 'status' ? STATUS_TIMEOUT : OPERATION_TIMEOUT);
			if (lifecycle)
				await follow(method === 'stop' && reply.state.phase === 'failed');
			if (active())
				this.message = '';
		}
		catch (error) {
			if (!active())
				return;
			this.notify(error);
			if (method !== 'status') {
				try {
					// Reconcile an uncertain result without retrying the mutation.
					if (this.stale)
						await read('status', [], statusBudget());
					if (lifecycle && pending(this.data.phase, method))
						await follow(false);
				}
				catch (statusError) {
					if (active() && statusError.message !== error.message)
						this.notify(statusError);
				}
			}
		}
		finally {
			if (active()) {
				this.busy = false;
				this.paint();
			}
		}
	},

	button(label, method, address, progress) {
		return E('button', {
			'type': 'button',
			'class': 'btn cbi-button',
			'disabled': this.busy || !this.allowed(method, address) ? '' : null,
			'click': ui.createHandlerFn(this, () =>
				this.perform(method, address, progress || label))
		}, [label]);
	},

	paint() {
		const state = this.data;
		const adapter = state && state.adapter;
		const devices = state ? state.devices : [];
		const table = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [_('Device')]),
				E('th', { 'class': 'th' }, [_('Address')]),
				E('th', { 'class': 'th' }, [_('Signal strength')]),
				E('th', { 'class': 'th' }, [_('Connection')]),
				E('th', { 'class': 'th' }, [_('Action')])
			])
		]);

		devices.forEach(device => {
			const connection = device.connected
				? device.services_resolved ? _('Connected / services resolved')
					: _('Connected / resolving services')
				: _('Disconnected');
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [device.name || _('Unnamed device')]),
				E('td', { 'class': 'td' }, [
					E('code', {}, [device.address]), E('br'), device.address_type
				]),
				E('td', { 'class': 'td' }, [
					device.rssi == null ? '-' : String(device.rssi) + ' dBm'
				]),
				E('td', { 'class': 'td' }, [connection]),
				E('td', { 'class': 'td cbi-section-actions' }, [
					device.connected
						? this.button(_('Disconnect'), 'disconnect', device.address, _('Disconnecting'))
						: this.button(_('Connect'), 'connect', device.address, _('Connecting'))
				])
			]));
		});
		if (!devices.length)
			table.appendChild(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '5' }, [
					!state ? _('Refresh to retrieve BLE service status.')
						: state.phase === 'ready'
							? _('No devices listed. Make a device discoverable, then scan.')
							: _('The BLE service must be ready before discovering devices.')
				])
			]));

		this.container.replaceChildren(
			E('h2', {}, [_('Orbi BLE Service')]),
			E('p', {}, [_('Manage Bluetooth Low Energy (BLE) Central connections.')]),
			E('div', { 'class': 'cbi-section' }, [
				E('p', {}, [E('strong', {}, [_('Service') + ': ']),
					state ? phases[state.phase] : _('Unavailable')]),
				E('p', {}, [E('strong', {}, [_('Version') + ': ']), state ? state.version : '-']),
				adapter ? E('p', {}, [
					E('strong', {}, [_('Adapter') + ': ']),
					adapter.hci, ' (', adapter.address, ') - ',
					adapter.powered ? _('Powered on') : _('Powered off'),
					adapter.discovering ? ' - ' + _('Discovering') : ''
				]) : '',
				state && state.detail ? E('p', {}, [state.detail]) : '',
				this.message ? E('p', { 'role': 'status', 'aria-live': 'polite' }, [this.message]) : '',
				this.stale ? E('p', {}, [
					_('Status is unavailable. Refresh before performing another action.')
				]) : '',
				E('div', { 'class': 'cbi-page-actions' }, [
					this.button(_('Start'), 'start', null, _('Starting BLE service')),
					' ', this.button(_('Stop'), 'stop', null, _('Stopping BLE service')),
					' ', this.button(_('Scan (10 seconds)'), 'scan', null, _('Scanning')),
					' ', this.button(_('Refresh'), 'status', null, _('Refreshing'))
				])
			]),
			E('h3', {}, [_('Devices')]),
			table,
			E('p', { 'class': 'cbi-section-descr' }, [
				_('The service lists devices with a meaningful BlueZ name or alias. Unnamed devices and address-only aliases are omitted, even if they are valid BLE devices.')
			]),
			E('p', { 'class': 'cbi-section-descr' }, [
				_('Refresh reads the current device cache and connection state; it does not start a scan. Pairing and GATT server configuration are not provided.')
			])
		);
	},

	render(reply) {
		this.data = reply.loadError ? null : stateFrom(reply);
		this.busy = false;
		this.stale = !this.data;
		this.message = '';
		this.container = E('div');
		if (reply.loadError)
			this.notify(reply.loadError);
		else if (reply.ok !== true)
			this.notify(responseError(reply));
		this.paint();
		return this.container;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
