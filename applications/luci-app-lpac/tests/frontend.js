// SPDX-License-Identifier: Apache-2.0
/* global require, __dirname, global */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
let modal = null;

if (!String.prototype.format) {
	Object.defineProperty(String.prototype, 'format', {
		value: function() {
			const args = arguments;
			let index = 0;

			return String(this).replace(/%[sd]/g, function() {
				return String(args[index++]);
			});
		}
	});
}

function element(tag, attrs, children) {
	if (Array.isArray(tag)) {
		children = tag;
		attrs = {};
		tag = null;
	}
	else if (attrs == null || Array.isArray(attrs) || typeof attrs !== 'object') {
		children = attrs;
		attrs = {};
	}

	return {
		tag,
		attrs: attrs || {},
		children: children == null ? [] : (Array.isArray(children) ? children : [ children ]),
		appendChild: function(child) {
			this.children.push(child);
		},
		getAttribute: function(name) {
			return this.attrs[name] ?? null;
		}
	};
}

function walk(value, callback) {
	if (Array.isArray(value)) {
		value.forEach(function(item) { walk(item, callback); });
		return;
	}

	if (!value || typeof value !== 'object')
		return;

	callback(value);
	walk(value.children, callback);
	walk(value.rows, callback);
}

function findAll(root, predicate) {
	const matches = [];

	walk(root, function(node) {
		if (predicate(node))
			matches.push(node);
	});

	return matches;
}

function textContent(node) {
	if (typeof node === 'string')
		return node;

	if (!node || typeof node !== 'object')
		return '';

	return (node.children || []).map(textContent).join('');
}

global._ = function(value) { return value; };
global.E = element;
global.L = {
	hasViewPermission: function() { return true; },
	resolveDefault: function(value) { return value; },
	resource: function(value) { return `/luci-static/resources/${value}`; }
};
global.cbi_update_table = function(table, rows, empty) {
	table.rows = rows;
	table.empty = empty;
};
global.document = {};
global.window = { location: { reload: function() {} } };

const view = { extend: function(spec) { return spec; } };
const ui = {
	showModal: function(title, content) { modal = { title, content }; },
	hideModal: function() {},
	addNotification: function() {},
	createHandlerFn: function(context, handler) {
		const args = Array.prototype.slice.call(arguments, 2);

		return function() {
			return typeof handler === 'string'
				? context[handler].apply(context, args)
				: handler.apply(context, args);
		};
	}
};
const lpac = {
	dataOr: function(result, fallback) {
		return result && result.success ? result.data : fallback;
	},
	errorMessage: function(result) { return result?.error || 'error'; }
};

function loadView(relativePath) {
	const source = fs.readFileSync(path.join(appRoot, 'htdocs/luci-static/resources/view/lpac', relativePath), 'utf8');
	return Function('view', 'ui', 'lpac', source)(view, ui, lpac);
}

function byText(root, tag, label) {
	return findAll(root, function(node) {
		return node.tag === tag && textContent(node) === label;
	});
}

const profile = {
	iccid: '8912345678901234567',
	isdpAid: 'A0000005591010FFFFFFFF8900001000',
	profileState: 'disabled',
	profileNickname: 'Test profile',
	serviceProviderName: 'Test provider'
};
const profilesView = loadView('profiles.js');
const profilesPage = profilesView.render({ success: true, data: [ profile ] });
const profileTable = findAll(profilesPage, function(node) {
	return node.attrs?.id === 'lpac-profile-table';
})[0];
assert.ok(profileTable, 'the profile table should have a scoped layout identifier');
assert.ok(profileTable.attrs.class.split(/\s+/).includes('lpac-profile-table'),
	'the profile table should expose its scoped stylesheet class');
assert.strictEqual(findAll(profilesPage, function(node) {
	return node.tag === 'link' && node.attrs?.rel === 'stylesheet' &&
		node.attrs?.href === '/luci-static/resources/view/lpac/profiles.css';
}).length, 1, 'the profile view should load its scoped responsive stylesheet');
assert.deepStrictEqual(findAll(profilesPage, function(node) {
	return node.attrs?.class === 'lpac-profile-key';
}).map(textContent), [ 'Profile:', 'Provider:', 'ICCID:', 'State:' ],
	'mobile profile fields should provide inline labels with colons');
const profileActionsHeader = byText(profilesPage, 'th', 'Actions')[0];
assert.ok(profileActionsHeader.attrs.class.split(/\s+/).includes('cbi-section-actions'),
	'the Actions heading should make its generated mobile cell full-width');

[ 'Enable', 'Rename', 'Delete' ].forEach(function(label) {
	const buttons = byText(profilesPage, 'button', label);
	assert.strictEqual(buttons.length, 1, `${label} button should exist`);
	assert.ok(buttons[0].attrs.disabled == null,
		`${label} button must omit the disabled attribute when writable`);
});
const profileActionGroups = findAll(profilesPage, function(node) {
	return node.tag === 'div' && node.attrs?.class === 'lpac-profile-actions' &&
		[ 'Enable', 'Rename', 'Delete' ].every(function(label) {
		return byText(node, 'button', label).length === 1;
	});
});
assert.strictEqual(profileActionGroups.length, 1,
	'profile actions should share one standard action wrapper');
assert.strictEqual(profileActionGroups[0].children.length, 3,
	'the action wrapper should contain only three buttons without spacers');
assert.ok(profileActionGroups[0].children.every(function(node) {
	return node.tag === 'button';
}), 'the clean action row should contain only button elements');
assert.strictEqual(findAll(profilesPage, function(node) {
	return node.tag === 'span' && node.attrs?.class === 'label' &&
		textContent(node) === 'Disabled';
}).length, 1, 'a disabled profile should use the neutral state badge');

const enabledProfile = Object.assign({}, profile, {
	iccid: '8912345678901234568',
	profileState: 'enabled'
});
const enabledProfilesPage = profilesView.render({
	success: true,
	data: [ enabledProfile ]
});
assert.strictEqual(findAll(enabledProfilesPage, function(node) {
	return node.tag === 'span' && node.attrs?.class === 'label success' &&
		textContent(node) === 'Enabled';
}).length, 1, 'an enabled profile should use the standard LuCI success badge');

const disableButtons = byText(enabledProfilesPage, 'button', 'Disable');
assert.strictEqual(disableButtons.length, 1,
	'an enabled profile should retain its Disable action');
assert.ok(disableButtons[0].attrs.disabled == null,
	'the Disable action should be writable for an enabled profile');
assert.ok(byText(enabledProfilesPage, 'button', 'Delete')[0].attrs.disabled != null,
	'an enabled profile must not be deletable');
disableButtons[0].attrs.click();
assert.strictEqual(modal.title, 'Disable profile',
	'Disable should open a confirmation modal before any operation');

const unknownProfile = Object.assign({}, profile, {
	iccid: '8912345678901234569',
	profileState: 'unknown'
});
const unknownProfilesPage = profilesView.render({
	success: true,
	data: [ unknownProfile ]
});
assert.strictEqual(findAll(unknownProfilesPage, function(node) {
	return node.tag === 'span' && node.attrs?.class === 'label warning' &&
		textContent(node) === 'Unknown';
}).length, 1, 'an unknown profile state should use a warning badge');
assert.ok(byText(unknownProfilesPage, 'button', 'Unavailable')[0].attrs.disabled != null,
	'an unknown profile state must not offer a state mutation');

profilesView.showStateModal(profile, true);
assert.ok(modal, 'profile state modal should render');

const refresh = findAll(modal.content, function(node) {
	return node.attrs?.id === 'lpac-profile-refresh';
})[0];
assert.ok(refresh, 'refresh checkbox should exist');
assert.ok(refresh.attrs.checked == null,
	'refresh should be unchecked for the first attempt');
assert.strictEqual(findAll(modal.content, function(node) {
	return node.attrs?.class === 'cbi-value-description' &&
		textContent(node).startsWith('Requests a logical UICC refresh');
}).length, 1, 'refresh help should distinguish the eUICC request from a modem reboot');

[ 'Changing the active profile', 'lpac may create a provider notification' ].forEach(function(text) {
	const notes = findAll(modal.content, function(node) {
		return node.attrs?.class === 'cbi-value-description' &&
			textContent(node).startsWith(text);
	});
	assert.strictEqual(notes.length, 1,
		`${text} guidance should use the standard help-note presentation`);
	assert.strictEqual(notes[0].attrs.role, 'note',
		`${text} guidance should retain explicit note semantics`);
});
assert.strictEqual(findAll(modal.content, function(node) {
	return node.attrs?.class === 'alert-message warning';
}).length, 0, 'profile state guidance should not use oversized warning boxes');

const identifier = findAll(modal.content, function(node) {
	return node.attrs?.id === 'lpac-profile-identifier';
})[0];
assert.ok(identifier, 'identifier selector should exist');
const identifierOptions = findAll(identifier, function(node) {
	return node.tag === 'option';
});
assert.strictEqual(identifierOptions.length, 2,
	'ICCID and ISD-P AID choices should both be offered');
assert.strictEqual(identifierOptions.filter(function(node) {
	return node.attrs.selected != null;
}).length, 1, 'exactly one profile identifier should be selected');

const notificationsView = loadView('notifications.js');
const notificationsPage = notificationsView.render({
	success: true,
	data: [ {
		seqNumber: 1,
		profileManagementOperation: 'enable',
		iccid: profile.iccid,
		notificationAddress: 'example.invalid'
	} ]
});
const removeButtons = byText(notificationsPage, 'button', 'Remove');
assert.strictEqual(removeButtons.length, 1, 'Remove button should exist');
assert.ok(removeButtons[0].attrs.disabled == null,
	'Remove button must omit the disabled attribute for a writable nonzero sequence');
assert.strictEqual(findAll(notificationsPage, function(node) {
	return node.attrs?.class === 'alert-message warning' &&
		textContent(node).startsWith('Sending notifications is disabled');
}).length, 1, 'the page-wide TLS limitation should remain a prominent warning');

const settingsView = loadView('settings.js');
const settingsPage = settingsView.render([
	{
		success: true,
		data: {
			global: {
				apdu_backend: 'mbim',
				http_backend: 'curl',
				apdu_debug: '0',
				http_debug: '1',
				custom_isd_r_aid: 'A0000005591010FFFFFFFF8900000100'
			},
			at: { device: '/dev/ttyUSB2', debug: '0' },
			uqmi: { device: '/dev/cdc-wdm0', debug: '0' },
			mbim: { device: '/dev/cdc-wdm0', proxy: '0' }
		}
	},
	{ success: true, data: { apdu: [ 'mbim', 'at' ], http: [ 'curl' ] } }
]);

function findById(id) {
	return findAll(settingsPage, function(node) { return node.attrs?.id === id; })[0];
}

assert.ok(findById('lpac-apdu-debug').attrs.checked == null,
	'false APDU debug must render unchecked');
assert.ok(findById('lpac-http-debug').attrs.checked != null,
	'true HTTP debug must render checked');
assert.ok(findById('lpac-mbim-proxy').attrs.checked == null,
	'false MBIM proxy must render unchecked');

const backend = findById('lpac-apdu-backend');
const backendOptions = findAll(backend, function(node) { return node.tag === 'option'; });
const selectedBackends = backendOptions.filter(function(node) {
	return node.attrs.selected != null;
});
assert.strictEqual(selectedBackends.length, 1,
	'exactly one APDU backend should carry the selected attribute');
assert.strictEqual(selectedBackends[0].attrs.value, 'mbim',
	'the configured APDU backend should be selected');
assert.strictEqual(findAll(settingsPage, function(node) {
	return node.attrs?.class === 'alert-message warning';
}).length, 0, 'inactive backend caveats should not render as page-wide warnings');
assert.strictEqual(findAll(settingsPage, function(node) {
	return node.attrs?.class === 'cbi-value-description' &&
		textContent(node).startsWith('Use the /dev/cdc-wdmN device');
}).length, 1, 'uqmi device guidance should render as field help');
assert.strictEqual(findAll(settingsPage, function(node) {
	return node.attrs?.class === 'cbi-value-description' &&
		textContent(node).startsWith('The AT backend is timing-sensitive');
}).length, 1, 'AT compatibility guidance should render as field help');

const menu = JSON.parse(fs.readFileSync(path.join(appRoot,
	'root/usr/share/luci/menu.d/luci-app-lpac.json'), 'utf8'));
assert.strictEqual(menu['admin/network/lpac'].title, 'eSIM Manager',
	'eSIM Manager should live below the Network menu');
assert.strictEqual(menu['admin/network/lpac'].action.type, 'firstchild',
	'eSIM Manager should open its first tab');
assert.strictEqual(menu['admin/network/lpac'].order, 90,
	'eSIM Manager should avoid the built-in Network menu order range');
assert.deepStrictEqual(menu['admin/network/lpac'].depends.acl, [ 'luci-app-lpac' ],
	'the application root should require its ACL');
[ 'overview', 'profiles', 'notifications', 'settings' ].forEach(function(page) {
	assert.ok(menu[`admin/network/lpac/${page}`],
		`${page} should remain a child tab below eSIM Manager`);
});
assert.strictEqual(Object.keys(menu).some(function(path) {
	return path.startsWith('admin/modem');
}), false, 'the upstream package should not create a top-level Modem menu');

const profileCss = fs.readFileSync(path.join(appRoot,
	'htdocs/luci-static/resources/view/lpac/profiles.css'), 'utf8');
assert.ok(profileCss.includes('#lpac-profile-table,\n\t#lpac-profile-table > tbody {\n\t\tdisplay: block;'),
	'the responsive layout should not depend on a theme table display mode');
assert.ok(profileCss.includes('#lpac-profile-table .tr.table-titles {\n\t\tdisplay: none;'),
	'the custom responsive grid should hide its redundant table heading');
assert.match(profileCss, /#lpac-profile-table \.tr[^{]+{\s*display: grid;/,
	'the mobile profile rows should use a scoped grid layout');
assert.match(profileCss, /grid-template-columns:\s*minmax\(0, 2fr\) minmax\(7rem, 1fr\)/,
	'the mobile grid should reserve more space for profile names and ICCIDs');
assert.match(profileCss, /#lpac-profile-table \.td\[data-title\][^{]*::before/,
	'the stylesheet should replace only the profile table theme labels');
assert.match(profileCss, /#lpac-profile-table \.td\[data-title\][^{]*::after/,
	'the stylesheet should remove scoped theme decoration from profile cells');
assert.ok(profileCss.includes('\t\tborder-top: 0;'),
	'the responsive grid should suppress theme borders on individual cells');
assert.ok(profileCss.includes('#lpac-profile-table .tr.placeholder > .td {'),
	'the block table should retain a normalized empty-profile placeholder');
assert.match(profileCss, /\.lpac-profile-field[^{]*{[^}]*font-size:\s*1em;/s,
	'profile details should retain the normal table font size on mobile');
assert.match(profileCss, /\.lpac-profile-actions > \.btn[^{]*{[^}]*font-size:\s*13px !important;[^}]*line-height:\s*1\.8em;/s,
	'action buttons should use compact typography without changing their columns');
assert.doesNotMatch(profileCss, /^\s*\.table\s+\.td/m,
	'the responsive override must not alter unrelated LuCI tables');

console.log('ok - frontend controls, responsive layout, menu, and safety states');
