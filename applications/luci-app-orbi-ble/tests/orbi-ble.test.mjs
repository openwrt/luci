// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 Zhixuan WU <cogito.wu@gmail.com>

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'htdocs', 'luci-static', 'resources', 'view', 'orbi-ble.js'), 'utf8');

class Element {
	constructor(tag, attrs = {}, children) {
		this.tag = tag;
		this.attrs = Object.fromEntries(Object.entries(attrs).filter(([, value]) => value != null));
		this.children = [];
		this.innerHTML = null;
		this.isConnected = true;
		if (Array.isArray(children))
			this.replaceChildren(...children);
		else if (children instanceof Element)
			this.appendChild(children);
		else if (children != null)
			this.innerHTML = String(children);
	}

	appendChild(child) {
		assert.ok(child instanceof Element);
		this.children.push(child);
		return child;
	}

	replaceChildren(...children) {
		this.innerHTML = null;
		this.children = children.filter(child => child != null).map(child =>
			child instanceof Element ? child : String(child));
	}

	get textContent() {
		return (this.innerHTML || '') + this.children.map(child =>
			child instanceof Element ? child.textContent : child).join('');
	}
}

function nodes(root) {
	return [root, ...root.children.filter(child => child instanceof Element).flatMap(nodes)];
}

async function flush() {
	for (let i = 0; i < 20; i++)
		await Promise.resolve();
}

class Clock {
	now = 0;
	nextId = 0;
	timers = new Map();
	delays = [];

	setTimeout(callback, delay) {
		this.delays.push(delay);
		const id = ++this.nextId;
		this.timers.set(id, { callback, at: this.now + delay });
		return id;
	}

	clearTimeout(id) {
		this.timers.delete(id);
	}

	async advance(milliseconds) {
		await flush();
		const end = this.now + milliseconds;
		for (let count = 0; ; count++) {
			const next = [...this.timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
			if (!next || next[1].at > end)
				break;
			assert.ok(count < 1000, 'fixture timer loop must be bounded');
			this.now = next[1].at;
			this.timers.delete(next[0]);
			next[1].callback();
			await flush();
		}
		this.now = end;
		await flush();
	}
}

function state(phase = 'ready', devices = []) {
	return {
		version: '0.1.0',
		phase,
		...(phase === 'ready' ? {
			adapter: { hci: 'hci3', address: '02:00:00:00:00:AA', powered: true, discovering: false }
		} : {}),
		devices
	};
}

function device(overrides = {}) {
	return {
		address: '02:00:00:00:00:01',
		address_type: 'random',
		name: 'Example sensor',
		connected: false,
		paired: false,
		services_resolved: false,
		uuids: [],
		...overrides
	};
}

function reply(current = state()) {
	return { ok: true, state: current };
}

function harness(handlers = {}, options = {}) {
	const calls = [], declarations = [], notifications = [];
	const clock = new Clock();
	const page = vm.runInNewContext(`(function() {\n${source}\n})()`, {
		Promise,
		Date: { now: () => clock.now },
		setTimeout: clock.setTimeout.bind(clock),
		clearTimeout: clock.clearTimeout.bind(clock),
		_: text => text,
		E: (tag, attrs, children) => new Element(tag, attrs, children),
		L: { hasViewPermission: () => options.writable !== false },
		view: { extend: definition => definition },
		rpc: {
			declare: spec => {
				declarations.push(JSON.parse(JSON.stringify(spec)));
				return (...args) => {
					calls.push({ method: spec.method, args, at: clock.now });
					assert.equal(typeof handlers[spec.method], 'function', `unexpected RPC: ${spec.method}`);
					return handlers[spec.method](...args);
				};
			}
		},
		ui: {
			createHandlerFn: (target, handler) => (...args) => handler.apply(target, args),
			addNotification: (title, node, level) => notifications.push({ title, node, level })
		}
	}, { filename: 'orbi-ble.js' });
	const button = label => {
		const found = nodes(page.container).find(node => node.tag === 'button' && node.textContent === label);
		assert.ok(found, `missing button: ${label}`);
		return found;
	};
	return { page, clock, calls, declarations, notifications, button };
}

test('package menu, authenticated ACL and RPC declarations share exactly six methods', () => {
	const menu = JSON.parse(readFileSync(resolve(root, 'root', 'usr', 'share', 'luci', 'menu.d', 'luci-app-orbi-ble.json')));
	const acl = JSON.parse(readFileSync(resolve(root, 'root', 'usr', 'share', 'rpcd', 'acl.d', 'luci-app-orbi-ble.json')));
	assert.deepEqual(Object.keys(menu), ['admin/services/orbi-ble']);
	assert.equal(menu['admin/services/orbi-ble'].title, 'Orbi BLE Service');
	assert.deepEqual(menu['admin/services/orbi-ble'].action, { type: 'view', path: 'orbi-ble' });
	assert.deepEqual(menu['admin/services/orbi-ble'].depends, { acl: ['luci-app-orbi-ble'] });
	assert.deepEqual(acl, {
		'luci-app-orbi-ble': {
			description: 'Grant access to Orbi BLE Central management',
			read: { ubus: { ble: ['status'] } },
			write: { ubus: { ble: ['start', 'stop', 'scan', 'connect', 'disconnect'] } }
		}
	});
	assert.deepEqual(harness().declarations, [
		{ object: 'ble', method: 'status', reject: true },
		{ object: 'ble', method: 'start', reject: true },
		{ object: 'ble', method: 'stop', reject: true },
		{ object: 'ble', method: 'scan', params: ['seconds'], reject: true },
		{ object: 'ble', method: 'connect', params: ['address'], reject: true },
		{ object: 'ble', method: 'disconnect', params: ['address'], reject: true }
	]);
	const makefile = readFileSync(resolve(root, 'Makefile'), 'utf8');
	assert.match(makefile, /^LUCI_TITLE:=LuCI support for Orbi BLE Service$/m);
	assert.match(makefile, /^LUCI_DEPENDS:=\+luci-base \+ble-service$/m);
	assert.match(makefile, /^PKG_LICENSE:=Apache-2.0$/m);
	assert.match(makefile, /^PKG_MAINTAINER:=Zhixuan WU <cogito\.wu@gmail\.com>$/m);
});

test('legacy generic LuCI package identifiers and paths are absent', () => {
	const legacyPackage = ['luci', 'app', 'ble'].join('-');
	const legacyMenu = ['admin', 'services', 'ble'].join('/');
	const legacyTitle = ['BLE', 'Service'].join(' ');
	const legacyView = ['ble', 'js'].join('.');
	const legacyPot = ['ble', 'pot'].join('.');
	const legacyTest = ['ble', 'test', 'mjs'].join('.');

	assert.equal(existsSync(resolve(root, 'htdocs', 'luci-static', 'resources', 'view', legacyView)), false);
	assert.equal(existsSync(resolve(root, 'po', 'templates', legacyPot)), false);
	assert.equal(existsSync(resolve(root, 'tests', legacyTest)), false);

	const menuText = readFileSync(resolve(root, 'root', 'usr', 'share', 'luci', 'menu.d', 'luci-app-orbi-ble.json'), 'utf8');
	const aclText = readFileSync(resolve(root, 'root', 'usr', 'share', 'rpcd', 'acl.d', 'luci-app-orbi-ble.json'), 'utf8');
	const packageText = [
		readFileSync(resolve(root, 'Makefile'), 'utf8'),
		readFileSync(resolve(root, 'README.md'), 'utf8'),
		source,
		menuText,
		aclText,
		readFileSync(resolve(root, 'po', 'templates', 'orbi-ble.pot'), 'utf8'),
		readFileSync(fileURLToPath(import.meta.url), 'utf8')
	].join('\n');
	assert.equal(packageText.includes(legacyPackage), false);

	const menu = JSON.parse(menuText);
	const entry = menu['admin/services/orbi-ble'];
	assert.equal(Object.hasOwn(menu, legacyMenu), false);
	assert.notEqual(entry.title, legacyTitle);
	assert.notEqual(entry.action.path, 'ble');
	assert.doesNotMatch(source, new RegExp("_\\('" + legacyTitle + "'\\)"));
});

test('initial load, manual refresh and idle time never scan or poll', async () => {
	const h = harness({ status: () => reply() });
	h.page.render(await h.page.load());
	assert.match(h.page.container.textContent, /No devices listed/);
	await h.button('Refresh').attrs.click();
	await h.clock.advance(300000);
	assert.deepEqual(h.calls.map(call => call.method), ['status', 'status']);
	assert.equal(h.clock.timers.size, 0);
	assert.equal(h.page.handleSave, null);
	assert.equal(h.page.handleSaveApply, null);
	assert.equal(h.page.handleReset, null);
});

test('service phase and read-only permission gate mutations, not refresh', async () => {
	for (const [phase, enabled] of [
		['stopped', ['Start', 'Refresh']],
		['starting', ['Stop', 'Refresh']],
		['ready', ['Stop', 'Scan (10 seconds)', 'Refresh']],
		['stopping', ['Stop', 'Refresh']],
		['failed', ['Start', 'Stop', 'Refresh']]
	]) {
		const h = harness();
		h.page.render(reply(state(phase)));
		const actual = nodes(h.page.container).filter(node =>
			node.tag === 'button' && !Object.hasOwn(node.attrs, 'disabled')).map(node => node.textContent);
		assert.deepEqual(actual, enabled, phase);
	}
	const options = { writable: false };
	const h = harness({ status: () => reply(state('ready', [device()])) }, options);
	h.page.render(reply(state('ready', [device()])));
	for (const label of ['Start', 'Stop', 'Scan (10 seconds)', 'Connect'])
		assert.ok(Object.hasOwn(h.button(label).attrs, 'disabled'), label);
	await h.button('Connect').attrs.click();
	assert.equal(h.calls.length, 0);
	assert.match(h.notifications[0].node.textContent, /not currently available/);
	await h.button('Refresh').attrs.click();
	assert.equal(h.calls[0].method, 'status');
});

test('all backend text is safe and the page does not add a second name filter', () => {
	const unsafe = '<img src=x onerror=alert(1)>';
	const current = state('ready', [
		device({ name: unsafe, address_type: unsafe, rssi: -65 }),
		device({ address: '02:00:00:00:00:02', name: '02-00-00-00-00-02' }),
		device({ address: '02:00:00:00:00:03', name: '' }),
		device({ address: unsafe, name: 'Unusable address' })
	]);
	current.detail = '<svg onload=alert(2)>';
	current.adapter.address = unsafe;
	const h = harness();
	h.page.render(reply(current));
	assert.equal(nodes(h.page.container).filter(node => node.innerHTML != null).length, 0);
	assert.match(h.page.container.textContent, /<img src=x onerror=alert\(1\)>/);
	assert.match(h.page.container.textContent, /<svg onload=alert\(2\)>/);
	assert.match(h.page.container.textContent, /02-00-00-00-00-02/);
	assert.match(h.page.container.textContent, /Unnamed device/);
	assert.match(h.page.container.textContent, /-65 dBm/);
	assert.equal(nodes(h.page.container).filter(node => node.tag === 'tr').length, 5);
	const buttons = nodes(h.page.container).filter(node => node.tag === 'button' && node.textContent === 'Connect');
	assert.equal(buttons.length, 4);
	assert.ok(Object.hasOwn(buttons[3].attrs, 'disabled'));
});

test('scan sends ten seconds and all controls share a duplicate-action guard', async () => {
	let finish;
	const h = harness({ scan: () => new Promise(resolve => { finish = resolve; }) });
	h.page.render(reply());
	const scan = h.button('Scan (10 seconds)');
	const first = scan.attrs.click();
	await flush();
	assert.match(h.page.container.textContent, /Scanning/);
	assert.ok(nodes(h.page.container).filter(node => node.tag === 'button')
		.every(node => Object.hasOwn(node.attrs, 'disabled')));
	await scan.attrs.click();
	await h.button('Refresh').attrs.click();
	assert.deepEqual(h.calls, [{ method: 'scan', args: [10], at: 0 }]);
	finish(reply());
	await first;
	assert.equal(h.page.busy, false);
	assert.equal(h.clock.timers.size, 0);
});

test('connect and disconnect use only the selected address and update connection state', async () => {
	const address = '02:00:00:00:00:01';
	const h = harness({
		connect: () => reply(state('ready', [device({ connected: true, services_resolved: true })])),
		disconnect: () => reply(state('ready', [device()]))
	});
	h.page.render(reply(state('ready', [device()])));
	const oldConnect = h.button('Connect');
	await oldConnect.attrs.click();
	assert.match(h.page.container.textContent, /Connected \/ services resolved/);
	await oldConnect.attrs.click();
	assert.equal(h.calls.length, 1, 'a stale Connect handler must not issue another mutation');
	await h.button('Disconnect').attrs.click();
	assert.deepEqual(h.calls.map(({ method, args }) => ({ method, args })), [
		{ method: 'connect', args: [address] }, { method: 'disconnect', args: [address] }
	]);
	assert.match(h.page.container.textContent, /Disconnected/);
});

test('Start follows only transitional status and never performs an automatic scan', async () => {
	let statusCalls = 0;
	const h = harness({
		start: () => reply(state('starting')),
		status: () => reply(state(++statusCalls === 1 ? 'starting' : 'ready'))
	});
	h.page.render(reply(state('stopped')));
	const action = h.button('Start').attrs.click();
	await flush();
	assert.match(h.page.container.textContent, /Service: Starting/);
	await h.clock.advance(2000);
	await action;
	assert.equal(h.page.data.phase, 'ready');
	assert.equal(h.page.busy, false);
	assert.deepEqual(h.calls.map(call => call.method), ['start', 'status', 'status']);
	assert.equal(h.notifications.length, 0);
	assert.equal(h.clock.timers.size, 0);
	await h.clock.advance(300000);
	assert.equal(h.calls.length, 3);
});

test('Stop follows stopping and preserves a successful inactive failed-state reply', async () => {
	const h = harness({ stop: () => reply(state('stopping')), status: () => reply(state('stopped')) });
	h.page.render(reply());
	const action = h.button('Stop').attrs.click();
	await h.clock.advance(1000);
	await action;
	assert.equal(h.page.data.phase, 'stopped');
	assert.equal(h.notifications.length, 0);
	const failed = { ...state('failed'), detail: 'Saved failure' };
	const inactive = harness({ stop: () => reply(failed) });
	inactive.page.render(reply(failed));
	await inactive.button('Stop').attrs.click();
	assert.equal(inactive.calls.length, 1);
	assert.equal(inactive.notifications.length, 0);
	assert.match(inactive.page.container.textContent, /Saved failure/);
});

test('Stop reports post-transition failures even when the service was already failed', async () => {
	const failed = { ...state('failed'), detail: 'Controller initialization failed' };
	for (const terminal of [
		reply(state('stopped')),
		reply(failed),
		{ ok: false, state: failed, error: failed.detail }
	]) {
		const h = harness({
			stop: () => reply(state('stopping')),
			status: () => terminal
		});
		h.page.render({ ok: false, state: failed, error: failed.detail });
		h.notifications.length = 0;
		const action = h.button('Stop').attrs.click();
		await h.clock.advance(1000);
		await action;
		assert.deepEqual(h.calls.map(call => call.method), ['stop', 'status']);
		assert.equal(h.page.data.phase, terminal.state.phase);
		if (terminal.state.phase === 'failed')
			assert.equal(h.notifications[0].node.textContent, failed.detail);
		else
			assert.equal(h.notifications.length, 0);
		assert.equal(h.page.busy, false);
		assert.equal(h.clock.timers.size, 0);
	}
});

test('failed load and failed lifecycle expose phase/detail without requiring code or retryable', async () => {
	const failed = { ...state('failed'), detail: 'Controller initialization failed' };
	const h = harness({
		status: () => ({ ok: false, state: failed, error: failed.detail }),
		start: () => reply(state('starting'))
	});
	h.page.render(await h.page.load());
	assert.match(h.page.container.textContent, /Service: Failed/);
	assert.equal(h.notifications[0].node.textContent, failed.detail);
	h.notifications.length = 0;
	const action = h.button('Start').attrs.click();
	await h.clock.advance(1000);
	await action;
	assert.equal(h.page.data.phase, 'failed');
	assert.equal(h.notifications.length, 1);
	assert.equal(h.notifications[0].node.textContent, failed.detail);
});

test('an error reply in the desired phase is not mistaken for success', async () => {
	for (const [method, initial, terminal] of [['start', 'stopped', 'ready'], ['stop', 'ready', 'stopped']]) {
		const h = harness({
			[method]: () => ({ ok: false, state: state(terminal), error: 'Lifecycle request failed' })
		});
		h.page.render(reply(state(initial)));
		await h.button(method === 'start' ? 'Start' : 'Stop').attrs.click();
		assert.equal(h.notifications.length, 1);
		assert.equal(h.notifications[0].node.textContent, 'Lifecycle request failed');
		assert.match(h.page.container.textContent, /Lifecycle request failed/);
	}
});

test('scan and connection errors stay text and perform only read-only reconciliation', async () => {
	for (const [method, label] of [['scan', 'Scan (10 seconds)'], ['connect', 'Connect'], ['disconnect', 'Disconnect']]) {
		const current = state('ready', [device({ connected: method === 'disconnect' })]);
		const h = harness({
			[method]: () => ({ ok: false, error: '<img src=x onerror=alert(3)>', code: 'DEVICE_NOT_FOUND', retryable: true }),
			status: () => reply(current)
		});
		h.page.render(reply(current));
		await h.button(label).attrs.click();
		assert.deepEqual(h.calls.map(call => call.method), [method, 'status']);
		assert.equal(h.notifications.length, 1);
		assert.equal(h.notifications[0].node.innerHTML, null);
		assert.equal(h.notifications[0].node.textContent, '<img src=x onerror=alert(3)>');
		assert.equal(h.page.busy, false);
	}
});

test('synchronous RPC exceptions and failed reconciliation release busy but gate mutations', async () => {
	let available = false;
	const h = harness({
		scan: () => { throw new Error('Scan transport failed'); },
		status: () => {
			if (!available)
				throw new Error('Status transport failed');
			return reply();
		}
	});
	h.page.render(reply());
	await h.button('Scan (10 seconds)').attrs.click();
	assert.equal(h.page.busy, false);
	assert.equal(h.page.stale, true);
	assert.deepEqual(h.notifications.map(item => item.node.textContent), ['Scan transport failed', 'Status transport failed']);
	assert.ok(Object.hasOwn(h.button('Stop').attrs, 'disabled'));
	assert.ok(!Object.hasOwn(h.button('Refresh').attrs, 'disabled'));
	available = true;
	await h.button('Refresh').attrs.click();
	assert.equal(h.page.stale, false);
	assert.ok(!Object.hasOwn(h.button('Stop').attrs, 'disabled'));
});

test('a lost lifecycle response is reconciled without resending or hiding its error', async () => {
	let reads = 0;
	const h = harness({
		start: () => { throw new Error('Start response lost'); },
		status: () => reply(state(++reads === 1 ? 'starting' : 'ready'))
	});
	h.page.render(reply(state('stopped')));
	const action = h.button('Start').attrs.click();
	await h.clock.advance(1000);
	await action;
	assert.deepEqual(h.calls.map(call => call.method), ['start', 'status', 'status']);
	assert.equal(h.page.data.phase, 'ready');
	assert.equal(h.notifications[0].node.textContent, 'Start response lost');
	assert.equal(h.clock.timers.size, 0);
});

test('Start follows failure cleanup through stopping, but Stop rejects an unexpected ready phase', async () => {
	const failed = { ...state('failed'), detail: 'Controller startup failed' };
	const states = [reply(state('stopping')), { ok: false, state: failed, error: failed.detail }];
	const h = harness({ start: () => reply(state('starting')), status: () => states.shift() });
	h.page.render(reply(state('stopped')));
	const action = h.button('Start').attrs.click();
	await h.clock.advance(1000);
	assert.equal(h.page.data.phase, 'stopping');
	await h.clock.advance(1000);
	await action;
	assert.equal(h.notifications[0].node.textContent, failed.detail);
	const unexpected = harness({ stop: () => reply() });
	unexpected.page.render(reply());
	await unexpected.button('Stop').attrs.click();
	assert.match(unexpected.notifications[0].node.textContent, /Unexpected BLE lifecycle state: ready/);
});

test('lifecycle follow-up stops at exactly 240 seconds without an extra status request', async () => {
	const h = harness({ start: () => reply(state('starting')), status: () => reply(state('starting')) });
	h.page.render(reply(state('stopped')));
	const action = h.button('Start').attrs.click();
	await h.clock.advance(240000);
	await action;
	assert.equal(h.clock.now, 240000);
	assert.equal(h.calls.filter(call => call.method === 'status').length, 239);
	assert.ok(h.calls.every(call => call.at < 240000));
	assert.equal(h.notifications.length, 1);
	assert.match(h.notifications[0].node.textContent, /BLE start did not finish/);
	assert.equal(h.page.busy, false);
	assert.equal(h.clock.timers.size, 0);
});

test('status wait is eight seconds and late operation replies cannot overwrite refreshed state', async () => {
	const unavailable = harness({ status: () => new Promise(() => {}) });
	const loading = unavailable.page.load();
	await unavailable.clock.advance(8000);
	unavailable.page.render(await loading);
	assert.equal(unavailable.page.data, null);
	assert.equal(unavailable.notifications[0].node.textContent, 'BLE request timed out');
	assert.ok(!Object.hasOwn(unavailable.button('Refresh').attrs, 'disabled'));
	assert.equal(unavailable.clock.timers.size, 0);
	let finish;
	let current = state();
	const h = harness({
		scan: () => new Promise(resolve => { finish = resolve; }),
		status: () => reply(current)
	});
	h.page.render(reply());
	const action = h.button('Scan (10 seconds)').attrs.click();
	await h.clock.advance(18000);
	await action;
	assert.equal(h.notifications[0].node.textContent, 'BLE request timed out');
	current = state('stopped');
	await h.button('Refresh').attrs.click();
	finish(reply());
	await flush();
	assert.equal(h.page.data.phase, 'stopped');
	assert.equal(h.clock.timers.size, 0);
});

test('lifecycle request wait is ten seconds with a bounded status recovery', async () => {
	const h = harness({ start: () => new Promise(() => {}), status: () => reply(state('stopped')) });
	h.page.render(reply(state('stopped')));
	const action = h.button('Start').attrs.click();
	await h.clock.advance(10000);
	await action;
	assert.deepEqual(h.calls.map(({ method, at }) => ({ method, at })), [
		{ method: 'start', at: 0 }, { method: 'status', at: 10000 }
	]);
	assert.equal(h.notifications[0].node.textContent, 'BLE request timed out');
	assert.equal(h.clock.timers.size, 0);
});

test('a delayed timer cannot allow lifecycle success beyond the wall-clock deadline', async () => {
	let finish;
	const h = harness({
		start: () => reply(state('starting')),
		status: () => new Promise(resolve => { finish = resolve; })
	});
	h.page.render(reply(state('stopped')));
	const action = h.button('Start').attrs.click();
	await h.clock.advance(1000);
	h.clock.now = 240001;
	finish(reply());
	await action;
	assert.equal(h.page.data.phase, 'starting');
	assert.equal(h.page.stale, true);
	assert.match(h.notifications[0].node.textContent, /BLE start did not finish/);
	assert.equal(h.calls.length, 2);
	assert.equal(h.clock.timers.size, 0);
});

test('detaching the view stops follow-up and replacement views ignore old requests', async () => {
	const h = harness({ start: () => reply(state('starting')) });
	const old = h.page.render(reply(state('stopped')));
	const action = h.button('Start').attrs.click();
	await flush();
	old.isConnected = false;
	await h.clock.advance(1000);
	await action;
	assert.deepEqual(h.calls.map(call => call.method), ['start']);
	assert.equal(h.notifications.length, 0);
	assert.equal(h.clock.timers.size, 0);
	let finish;
	const replacement = harness({ scan: () => new Promise(resolve => { finish = resolve; }) });
	replacement.page.render(reply());
	const oldAction = replacement.button('Scan (10 seconds)').attrs.click();
	await flush();
	const newer = replacement.page.render(reply(state('stopped')));
	finish(reply());
	await oldAction;
	assert.equal(replacement.page.container, newer);
	assert.equal(replacement.page.data.phase, 'stopped');
	assert.equal(replacement.page.busy, false);
	assert.equal(replacement.clock.timers.size, 0);
});

test('permission changes are rechecked even by previously enabled button handlers', async () => {
	const options = { writable: true };
	const h = harness({}, options);
	h.page.render(reply());
	const scan = h.button('Scan (10 seconds)');
	options.writable = false;
	await scan.attrs.click();
	assert.equal(h.calls.length, 0);
	assert.equal(h.notifications.length, 1);
	assert.ok(Object.hasOwn(h.button('Scan (10 seconds)').attrs, 'disabled'));
});

test('initial errors remain safe text and can be recovered with manual Refresh', async () => {
	let available = false;
	const h = harness({
		status: () => available ? reply() : { ok: false, error: '<svg onload=alert(4)>' }
	});
	h.page.render(await h.page.load());
	assert.equal(h.page.data, null);
	assert.equal(h.notifications[0].node.textContent, '<svg onload=alert(4)>');
	assert.equal(h.notifications[0].node.innerHTML, null);
	assert.equal(nodes(h.page.container).filter(node => node.innerHTML != null).length, 0);
	assert.match(h.page.container.textContent, /Service: Unavailable/);
	assert.ok(Object.hasOwn(h.button('Start').attrs, 'disabled'));
	available = true;
	await h.button('Refresh').attrs.click();
	assert.equal(h.page.data.phase, 'ready');
	assert.equal(h.page.stale, false);
});

test('malformed replies fail explicitly rather than becoming empty or ready state', async () => {
	for (const value of [null, 6, {}, { ok: true }, reply({ ...state(), devices: null }),
		reply(state('unknown')), reply({ ...state(), phase: ['ready'] }),
		reply({ ...state(), adapter: null }), reply(state('ready', [{ address: '02:00:00:00:00:01' }]))]) {
		const h = harness({ status: () => value });
		h.page.render(await h.page.load());
		assert.equal(h.page.data, null);
		assert.equal(h.page.stale, true);
		assert.equal(h.notifications[0].node.textContent, 'Invalid BLE service response');
		assert.equal(h.clock.timers.size, 0);
	}
});

test('translation template covers page, menu and ACL strings without translated test data', () => {
	const strings = new Set([...source.matchAll(/_\('((?:[^'\\]|\\.)*)'\)/g)].map(match =>
		match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')));
	const collect = object => {
		for (const [key, value] of Object.entries(object)) {
			if ((key === 'title' || key === 'description') && typeof value === 'string')
				strings.add(value);
			else if (value && typeof value === 'object')
				collect(value);
		}
	};
	collect(JSON.parse(readFileSync(resolve(root, 'root', 'usr', 'share', 'luci', 'menu.d', 'luci-app-orbi-ble.json'))));
	collect(JSON.parse(readFileSync(resolve(root, 'root', 'usr', 'share', 'rpcd', 'acl.d', 'luci-app-orbi-ble.json'))));
	const pot = readFileSync(resolve(root, 'po', 'templates', 'orbi-ble.pot'), 'utf8');
	const entries = new Set(pot.split(/\r?\n\r?\n/).map(block => {
		const lines = block.split(/\r?\n/);
		const index = lines.findIndex(line => line.startsWith('msgid '));
		if (index < 0)
			return null;
		let value = JSON.parse(lines[index].slice(6));
		for (let i = index + 1; i < lines.length && lines[i].startsWith('"'); i++)
			value += JSON.parse(lines[i]);
		return value;
	}).filter(Boolean));
	assert.deepEqual([...entries].sort(), [...strings].sort());
});
