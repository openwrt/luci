'use strict';

// Run with: node applications/luci-app-package-manager/tests/apk-upgradable.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'htdocs/luci-static/resources/view/package-manager.js'), 'utf8');
let apk = true, modal;
const calls = [];
const element = { value: '', firstElementChild: { style: {} }, setAttribute() {} };
const pager = { ...element, parentNode: { style: {} }, querySelector: () => element };
const ctx = vm.createContext({
	L: { hasViewPermission: () => true, hasSystemFeature: () => apk, toArray: v => v },
	rpc: { declare: () => () => Promise.resolve([]) },
	view: { extend() {} },
	fs: { exec_direct: (path, args) => { calls.push([path, ...args]); return Promise.resolve(''); } },
	ui: { showModal: (title, body) => { modal = body; } },
	document: { querySelector: () => element, querySelectorAll: () => [pager] },
	E: (tag, attrs, children) => ({ tag, attrs, children }),
	_: s => s,
	cbi_update_table() {},
	console
});

// LuCI wraps views in a function. Expose its scope here to exercise the real code.
assert.ok(source.includes('\nreturn view.extend({'));
vm.runInContext(source.replace('\nreturn view.extend({', '\nview.extend({'), ctx);
vm.runInContext(`
	String.prototype.format = function(...args) {
		let i = 0;
		return this.replace(/%[0-9.]*[a-zA-Z]/g, () => String(args[i++]));
	};
	handlePage = function() {};
`, ctx);
const packages = vm.runInContext('packages', ctx);
const rows = mode => {
	vm.runInContext(`currentDisplayMode = '${mode}'; display();`, ctx);
	return vm.runInContext('currentDisplayRows', ctx);
};
const installed = [
	{ name: 'appfilter', version: '7.0.1-r1' },
	{ name: 'base-files', version: '1719~3a0f609352' },
	{ name: 'kernel', version: '6.12.103~1bf713ad49146ba1cf2266d2fbaa88b0-r1' },
	{ name: 'luci-app-adguardhome', version: '3.0.0-r5' }
].map(pkg => ({ ...pkg, status: ['installed'] }));
const available = [
	{ name: 'appfilter', version: '2026.04.20~569f93bf-r1' },
	{ name: 'base-files', version: '1950~0c4cd0f9920a' },
	{ name: 'kernel', version: '6.12.103~0413601b1c3f0490e17f340fe09229ea-r1' },
	{ name: 'luci-app-adguardhome', version: '26.236.50544~cb5d434' },
	{ name: 'new-package', version: '1.0-r0' }
];
const output = 'appfilter-2026.04.20~569f93bf-r1 x86_64 {open-app-filter} () [upgradable from: appfilter-7.0.1-r1]\n' +
	'base-files-1950~0c4cd0f9920a x86_64 {base-files} (GPL-2.0) [upgradable from: base-files-1719~3a0f609352]\n';
const data = text => [[], JSON.stringify(available), JSON.stringify(installed), text];

(async () => {
	await ctx.updateLists(data(output));
	assert.deepEqual(Array.from(rows('updates'), row => row[0]), ['appfilter', 'base-files']);
	const buttons = Object.fromEntries(rows('available').map(row => [row[0], row[4].attrs['data-action']]));
	assert.equal(buttons.kernel, undefined);
	assert.equal(buttons['luci-app-adguardhome'], undefined);
	assert.equal(buttons['base-files'], 'upgrade');
	assert.equal(buttons['new-package'], 'install');

	// A tagged repository can offer a different candidate than the available map.
	const tagged = { name: 'luci-app-adguardhome', version: '3.1.0-r0', description: 'Tagged candidate' };
	packages.available.providers[tagged.name].push(tagged);
	ctx.parseApkUpgradable('luci-app-adguardhome-3.1.0-r0 x86_64 {adguardhome} (GPL-3.0) [upgradable from: luci-app-adguardhome-3.0.0-r5]');
	assert.equal(packages.upgradable[tagged.name], tagged);
	assert.ok(rows('updates').find(row => row[0] === tagged.name)[1].endsWith('3.1.0-r0'));
	assert.equal(rows('available').find(row => row[0] === tagged.name)[1], '3.1.0-r0');
	ctx.handleInstall({ target: { getAttribute: key => key === 'data-package' ? tagged.name : 'upgrade' } });
	assert.ok(JSON.stringify(modal).includes('3.1.0-r0'));
	assert.ok(!JSON.stringify(modal).includes('26.236.50544'));

	// Preserve apk's version order for duplicate names, including numeric names and revisions.
	ctx.parseApkUpgradable('lib-test-2-1.0_rc1-r0 x86_64 {lib-test} () [upgradable from: lib-test-2-0.9-r0]\r\n' +
		'lib-test-2-1.0-r1 x86_64 {lib-test} () [upgradable from: lib-test-2-0.9-r0]\r\n');
	assert.equal(packages.upgradable['lib-test-2'].version, '1.0-r1');
	assert.equal(packages.upgradable['lib-test-2'].depends, undefined);
	assert.throws(() => ctx.parseApkUpgradable('invalid output'), /Unable to parse/);
	assert.throws(() => ctx.parseApkUpgradable('foo-1.0-r0 x86_64 {} () [upgradable from: bar-0.9-r0]'), /Unable to parse/);
	await ctx.updateLists(data(''));
	assert.equal(rows('updates').length, 0);
	assert.equal(Object.keys(packages.upgradable).length, 0);

	await ctx.downloadLists();
	assert.equal(calls.filter(call => call[1] === 'list-upgradable').length, 1);
	const execDirect = ctx.fs.exec_direct;
	ctx.fs.exec_direct = (path, args) => args[0] === 'list-upgradable'
		? Promise.reject(new Error('apk failed')) : execDirect(path, args);
	await assert.rejects(ctx.downloadLists(), /apk failed/);
	ctx.fs.exec_direct = execDirect;
	apk = false;
	calls.length = 0;
	await ctx.downloadLists();
	assert.equal(calls.length, 2);
	assert.equal(rows('updates').length, 4);
	packages.installed.pkgs.kernel.version = '99.0-r0';
	assert.equal(rows('updates').length, 3);
	assert.equal(rows('available').find(row => row[0] === 'kernel')[4].attrs['data-action'], 'upgrade');

	const acl = JSON.parse(readFileSync(join(root, 'root/usr/share/rpcd/acl.d/luci-app-package-manager.json'), 'utf8'));
	assert.deepEqual(acl['luci-app-package-manager'].read.file['/usr/libexec/package-manager-call list-upgradable'], ['exec']);
	console.log('APK update list, buttons, details, parsing, refresh, ACL and opkg regression checks passed.');
})().catch(err => { console.error(err); process.exitCode = 1; });
