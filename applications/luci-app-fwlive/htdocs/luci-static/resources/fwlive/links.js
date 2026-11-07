'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
'require baseclass'; /* LuCI require() needs Class.isSubclass — plain return {} fails */
'require fwlive.log as log';
'require fwlive.hostname as hostname';

/**
 * Link-builder helpers for luci-app-fwlive.
 *
 * Pure helpers (no filter side-effects):
 *   luciUrl, firewallZonesPath, firewallZonesUrl, firewallZonesLink
 *
 * Filter-aware helpers (require an onFilterClick callback):
 *   filterLink, addrFilterLink, ruleAdminLink, ifaceLink
 *
 * Focus identity (column slot is not the click field):
 *   stampFilterField, filterLinkIdentity, findFilterLinkByIdentity
 *
 * Constant path helper:
 *   ruleAdminPath
 *
 * No host element — all functions return DOM nodes or strings.
 * May require fwlive.log for formatCell and fwlive.hostname for cache reads.
 */

function luciUrl(path) {
	if (typeof L !== 'undefined' && L.url) return L.url(path);

	return '/cgi-bin/luci/' + path;
}

function firewallZonesPath() {
	return 'admin/network/firewall/zones';
}

function firewallZonesUrl() {
	return luciUrl(firewallZonesPath());
}

function firewallZonesLink(label) {
	return E(
		'a',
		{
			'href': firewallZonesUrl(),
			'class': 'fwlive-filter-link'
		},
		[label || _('Network → Firewall')]
	);
}

function stampFilterField(node, field, value, slot) {
	if (node && typeof node === 'object') {
		node._fwliveFilterField = String(field);
		if (value != null) node._fwliveFilterValue = String(value);
		if (slot != null && slot !== '') node._fwliveFilterSlot = String(slot);
	}
	return node;
}

function filterLinkRowId(node) {
	if (!node) return null;
	if (node._fwliveRowId != null) return String(node._fwliveRowId);
	if (node.closest) {
		const row = node.closest('tr');
		if (row && row._fwliveRowId != null) return String(row._fwliveRowId);
	}
	return null;
}

function filterLinkIdentity(node) {
	if (
		!node ||
		!node.classList ||
		typeof node.classList.contains !== 'function' ||
		!node.classList.contains('fwlive-filter-link') ||
		node._fwliveFilterField == null
	)
		return null;
	const rowId = filterLinkRowId(node);
	if (rowId == null) return null;
	const ident = { rowId: rowId, field: String(node._fwliveFilterField) };
	if (node._fwliveFilterValue != null) ident.value = String(node._fwliveFilterValue);
	if (node._fwliveFilterSlot != null) ident.slot = String(node._fwliveFilterSlot);
	return ident;
}

function linkMatchesFilterIdentity(link, ident) {
	if (!link || !ident) return false;
	if (String(link._fwliveFilterField) !== ident.field) return false;
	if (
		ident.value != null &&
		(link._fwliveFilterValue == null || String(link._fwliveFilterValue) !== ident.value)
	)
		return false;
	if (
		ident.slot != null &&
		(link._fwliveFilterSlot == null || String(link._fwliveFilterSlot) !== ident.slot)
	)
		return false;
	return filterLinkRowId(link) === ident.rowId;
}

function collectFilterLinks(node, out) {
	if (!node) return;
	if (
		node.nodeType === 1 &&
		node.classList &&
		typeof node.classList.contains === 'function' &&
		node.classList.contains('fwlive-filter-link')
	)
		out.push(node);
	const kids = node.childNodes;
	if (!kids) return;
	for (let i = 0; i < kids.length; i++) collectFilterLinks(kids[i], out);
}

function findFilterLinkByIdentity(root, ident) {
	if (!root || !ident) return null;
	const links = [];
	collectFilterLinks(root, links);
	for (let i = 0; i < links.length; i++) {
		if (linkMatchesFilterIdentity(links[i], ident)) return links[i];
	}
	return null;
}

/**
 * @param {string} field  - filter field name
 * @param {string} value  - filter value
 * @param {string} [label] - display label (defaults to value)
 * @param {function} onFilterClick - callback(field, value, ev)
 */
function filterLink(field, value, label, onFilterClick) {
	if (!value) return log.formatCell(value);

	return stampFilterField(
		E(
			'a',
			{
				'href': '#',
				'class': 'fwlive-filter-link',
				'title': _('Filter by %s').format(log.filterFieldLabel(field)),
				'click': function (ev) {
					onFilterClick(field, value, ev);
				}
			},
			[label || value]
		),
		field,
		value
	);
}

/**
 * @param {string} field  - filter field ('src' or 'dst')
 * @param {string} ip     - IP address
 * @param {boolean} showHostnames
 * @param {Map|null} hostnameCache
 * @param {function} onFilterClick - callback(field, value, ev)
 */
function addrFilterLink(field, ip, showHostnames, hostnameCache, onFilterClick) {
	if (!ip) return log.formatCell(ip);

	const name = showHostnames ? hostname.cachedName(hostnameCache, ip) : null;
	const display = name || ip;
	const title = name ? ip : _('Filter by %s').format(log.filterFieldLabel(field));

	return stampFilterField(
		E(
			'a',
			{
				'href': '#',
				'class': 'fwlive-filter-link',
				'title': title,
				'click': function (ev) {
					onFilterClick(field, ip, ev);
				}
			},
			[display]
		),
		field,
		ip
	);
}

function ruleAdminPath() {
	return 'admin/network/firewall/rules';
}

/**
 * @param {string} hint            - rule hint token
 * @param {string} label           - display label
 * @param {function} onFilterClick - callback(field, value, ev)
 */
function ruleAdminLink(hint, label, onFilterClick) {
	if (!hint) return log.formatCell(hint);

	const path = ruleAdminPath();
	const url = '%s#%s'.format(luciUrl(path), encodeURIComponent(hint));
	const text = label || hint;

	return stampFilterField(
		E(
			'a',
			{
				'href': '#',
				'class': 'fwlive-filter-link fwlive-rule-link',
				'title': _(
					'Filter logs by rule (hint: %s). Ctrl+click to open firewall settings.'
				).format(hint),
				'click': function (ev) {
					if (ev && (ev.ctrlKey || ev.metaKey)) {
						if (ev.preventDefault) ev.preventDefault();
						window.location = url;
						return;
					}
					onFilterClick('q', hint, ev);
				}
			},
			[text]
		),
		'q',
		hint
	);
}

/**
 * @param {string} value           - interface name
 * @param {function} onFilterClick - callback(field, value, ev)
 * @param {string} [slot]          - focus identity (column id); click field stays interface
 */
function ifaceLink(value, onFilterClick, slot) {
	if (!value) return log.formatCell(value);

	return stampFilterField(
		E(
			'a',
			{
				'href': '#',
				'class': 'fwlive-filter-link fwlive-iface-badge',
				'title': _('Filter by %s').format(log.filterFieldLabel('interface')),
				'click': function (ev) {
					onFilterClick('interface', value, ev);
				}
			},
			[value]
		),
		'interface',
		value,
		slot
	);
}

return baseclass.extend({
	luciUrl: luciUrl,
	firewallZonesPath: firewallZonesPath,
	firewallZonesUrl: firewallZonesUrl,
	firewallZonesLink: firewallZonesLink,
	filterLink: filterLink,
	addrFilterLink: addrFilterLink,
	ruleAdminPath: ruleAdminPath,
	ruleAdminLink: ruleAdminLink,
	ifaceLink: ifaceLink,
	stampFilterField: stampFilterField,
	filterLinkIdentity: filterLinkIdentity,
	findFilterLinkByIdentity: findFilterLinkByIdentity
});
