'use strict';

/* global require, __dirname, process */
// Run with: sh applications/luci-app-package-manager/tests/run_tests.sh
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'htdocs/luci-static/resources/view/package-manager.js'), 'utf8');
let apk = true, modal, getScope, tableRows;
const calls = [], notifications = [];
const element = {
	value: '', firstElementChild: { style: {} }, firstChild: {},
	setAttribute() {}, removeAttribute() {}, classList: { contains: () => false }
};
const pager = { ...element, parentNode: { style: {} }, getAttribute: () => 100, querySelector: () => element };
element.parentNode = pager;
const ctx = vm.createContext({
	L: { hasViewPermission: () => true, hasSystemFeature: () => apk, toArray: v => v },
	rpc: { declare: () => () => Promise.resolve([]) },
	view: { extend() {} },
	fs: { exec_direct: (path, args) => { calls.push([path, ...args]); return Promise.resolve(''); } },
	ui: {
		showModal: (title, body) => { modal = body; },
		addNotification: (title, body) => { notifications.push(body); }
	},
	document: { querySelector: () => element, querySelectorAll: () => [pager] },
	E: (tag, attrs, children) => ({ tag, attrs, children }),
	_: s => s,
	cbi_update_table: (selector, rows) => { tableRows = rows; },
	capture: scope => { getScope = scope; },
	console
});

// Keep the view source intact, including its top-level return, as LuCI does.
const loadView = vm.compileFunction(`
	'use strict';
	capture(() => ({
		packages, parseApkUpgradable, updateLists, downloadLists, handleInstall, handleRemove,
		rows(mode, pattern) {
			currentDisplayMode = mode;
			display(pattern);
			return currentDisplayRows;
		}
	}));
	${source}
`, [], { parsingContext: ctx });
loadView();
vm.runInContext(`
	String.prototype.format = function(...args) {
		let i = 0;
		return this.replace(/%[0-9.]*[a-zA-Z]/g, () => String(args[i++]));
	};
`, ctx);
const api = getScope();
const { packages, rows } = api;
const installed = [
	{ name: 'appfilter', version: '7.0.1-r1' },
	{ name: 'base-files', version: '1719~3a0f609352' },
	{ name: 'kernel', version: '6.12.103~1bf713ad49146ba1cf2266d2fbaa88b0-r1' },
	{ name: 'luci-app-adguardhome', version: '3.0.0-r5', 'file-size': 100, description: 'Installed version' }
].map(pkg => ({ ...pkg, status: ['installed'] }));
const available = [
	{ name: 'appfilter', version: '2026.04.20~569f93bf-r1' },
	{ name: 'base-files', version: '1950~0c4cd0f9920a' },
	{ name: 'kernel', version: '6.12.103~0413601b1c3f0490e17f340fe09229ea-r1' },
	{ name: 'luci-app-adguardhome', version: '26.236.50544~cb5d434', 'file-size': 200, description: 'Other repository' },
	{ name: 'new-package', version: '1.0-r0' }
];
const output = 'appfilter-2026.04.20~569f93bf-r1 x86_64 {open-app-filter} () [upgradable from: appfilter-7.0.1-r1]\n' +
	'base-files-1950~0c4cd0f9920a x86_64 {base-files} (GPL-2.0) [upgradable from: base-files-1719~3a0f609352]\n';
const data = text => [[], JSON.stringify(available), JSON.stringify(installed), text];

(async () => {
	await api.updateLists(data(output));
	assert.deepEqual(Array.from(rows('updates'), row => row[0]), ['appfilter', 'base-files']);
	const buttons = Object.fromEntries(rows('available').map(row => [row[0], row[4].attrs['data-action']]));
	assert.equal(buttons.kernel, undefined);
	assert.equal(buttons['luci-app-adguardhome'], undefined);
	assert.equal(buttons['base-files'], 'upgrade');
	assert.equal(buttons['new-package'], 'install');

	// A tagged repository can offer a different candidate than the available map.
	const tagged = { name: 'luci-app-adguardhome', version: '3.1.0-r0', size: 300, description: 'Tagged candidate' };
	packages.available.providers[tagged.name].push(tagged);
	api.parseApkUpgradable('luci-app-adguardhome-3.1.0-r0 x86_64 {adguardhome} (GPL-3.0) [upgradable from: luci-app-adguardhome-3.0.0-r5]');
	assert.equal(packages.upgradable[tagged.name], tagged);
	assert.equal(rows('updates').find(row => row[0] === tagged.name)[1], '3.0.0-r5 » 3.1.0-r0');
	assert.equal(rows('available').find(row => row[0] === tagged.name)[1], '3.1.0-r0');
	for (const mode of ['updates', 'available']) {
		const row = rows(mode).find(row => row[0] === tagged.name);
		assert.equal(row[2][0], tagged.size);
		assert.equal(row[3], tagged.description);
		assert.equal(rows(mode, 'Tagged candidate').length, 1);
		assert.equal(rows(mode, 'Other repository').length, 0);
	}
	const installedRow = rows('installed').find(row => row[0] === tagged.name);
	assert.equal(installedRow[1], '3.0.0-r5');
	assert.equal(installedRow[2][0], 100);
	assert.equal(installedRow[3], 'Installed version');
	api.handleInstall({ target: { getAttribute: key => key === 'data-package' ? tagged.name : 'upgrade' } });
	assert.ok(JSON.stringify(modal).includes('3.1.0-r0'));
	assert.ok(!JSON.stringify(modal).includes('26.236.50544'));
	assert.ok(JSON.stringify(modal).includes('Tagged candidate'));

	// Missing candidate metadata must not borrow another version's size or description.
	api.parseApkUpgradable('luci-app-adguardhome-3.2.0-r0 x86_64 {adguardhome} () [upgradable from: luci-app-adguardhome-3.0.0-r5]');
	for (const mode of ['updates', 'available']) {
		const row = rows(mode).find(row => row[0] === tagged.name);
		assert.equal(row[2][1], '-');
		assert.equal(row[3], '-');
	}

	// Preserve apk's version order for duplicate names, including numeric names and revisions.
	api.parseApkUpgradable('lib-test-2-1.0_rc1-r0 x86_64 {lib-test} () [upgradable from: lib-test-2-0.9-r0]\r\n' +
		'lib-test-2-1.0-r1 x86_64 {lib-test} () [upgradable from: lib-test-2-0.9-r0]\r\n');
	assert.equal(packages.upgradable['lib-test-2'].version, '1.0-r1');
	assert.equal(packages.upgradable['lib-test-2'].depends, undefined);
	await api.updateLists(data('invalid output\n' + output +
		'foo-1.0-r0 x86_64 {} () [upgradable from: bar-0.9-r0]\n'));
	assert.equal(notifications.length, 1);
	assert.match(JSON.stringify(notifications[0]), /may be incomplete/);
	assert.ok(tableRows.length > 0);
	assert.deepEqual(Array.from(rows('updates'), row => row[0]), ['appfilter', 'base-files']);
	assert.equal(rows('available').find(row => row[0] === 'new-package')[4].attrs['data-action'], 'install');
	assert.equal(rows('installed')[0][4].attrs.click, api.handleRemove);
	await api.updateLists(data('invalid output'));
	assert.equal(rows('updates').length, 0);
	assert.equal(rows('installed').length, installed.length);
	assert.equal(notifications.length, 1);
	await api.updateLists(data(''));
	assert.equal(rows('updates').length, 0);
	assert.equal(Object.keys(packages.upgradable).length, 0);
	assert.equal(notifications.length, 1);
	// Dismissing the banner and refreshing valid/invalid data must not recreate it.
	notifications.length = 0;
	await api.updateLists(data(output));
	await api.updateLists(data('invalid output'));
	assert.equal(notifications.length, 0);

	await api.downloadLists();
	assert.equal(calls.filter(call => call[1] === 'list-upgradable').length, 1);
	const execDirect = ctx.fs.exec_direct;
	ctx.fs.exec_direct = (path, args) => args[0] === 'list-upgradable'
		? Promise.reject(new Error('apk failed')) : execDirect(path, args);
	await assert.rejects(api.downloadLists(), /apk failed/);
	ctx.fs.exec_direct = execDirect;
	apk = false;
	calls.length = 0;
	await api.downloadLists();
	assert.equal(calls.length, 2);
	assert.equal(rows('updates').length, 4);
	packages.installed.pkgs.kernel.version = '99.0-r0';
	assert.equal(rows('updates').length, 3);
	assert.equal(rows('available').find(row => row[0] === 'kernel')[4].attrs['data-action'], 'upgrade');
	assert.equal(rows('available').find(row => row[0] === tagged.name)[2][0], 200);
	assert.equal(rows('available').find(row => row[0] === tagged.name)[3], 'Other repository');

	// Loading a fresh view resets the warning guard.
	apk = true;
	loadView();
	await getScope().updateLists(data('invalid output'));
	assert.equal(notifications.length, 1);

	const acl = JSON.parse(readFileSync(join(root, 'root/usr/share/rpcd/acl.d/luci-app-package-manager.json'), 'utf8'));
	assert.deepEqual(acl['luci-app-package-manager'].read.file['/usr/libexec/package-manager-call list-upgradable'], ['exec']);
	console.log('APK update list, buttons, details, parsing, refresh, ACL and opkg regression checks passed.');
})().catch(err => { console.error(err); process.exitCode = 1; });
