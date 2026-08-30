'use strict';
'require baseclass'; /* LuCI require() needs Class.isSubclass — plain return {} fails */
'require fwlive.log as log';

/**
 * Link-builder helpers for luci-app-fwlive.
 *
 * Pure helpers (no filter side-effects):
 *   luciUrl, firewallZonesPath, firewallZonesUrl, firewallZonesLink
 *
 * Filter-aware helpers (require an onFilterClick callback):
 *   filterLink, addrFilterLink, ruleAdminPath, ruleAdminLink, ifaceLink
 *
 * No host element — all functions return DOM nodes or strings.
 * May require fwlive.log for formatCell.
 */

function luciUrl(path) {
	if (typeof L !== 'undefined' && L.url)
		return L.url(path);

	return '/cgi-bin/luci/' + path;
}

function firewallZonesPath() {
	return 'admin/network/firewall/zones';
}

function firewallZonesUrl() {
	return luciUrl(firewallZonesPath());
}

function firewallZonesLink(label) {
	return E('a', {
		'href': firewallZonesUrl(),
		'class': 'fwlive-filter-link'
	}, [ label || _('Network → Firewall') ]);
}

/**
 * @param {string} field  - filter field name
 * @param {string} value  - filter value
 * @param {string} [label] - display label (defaults to value)
 * @param {function} onFilterClick - callback(field, value, ev)
 */
function filterLink(field, value, label, onFilterClick) {
	if (!value)
		return log.formatCell(value);

	return E('a', {
		'href': '#',
		'class': 'fwlive-filter-link',
		'title': _('Filter by %s').format(field),
		'click': function(ev) { onFilterClick(field, value, ev); }
	}, [ label || value ]);
}

/**
 * @param {string} field  - filter field ('src' or 'dst')
 * @param {string} ip     - IP address
 * @param {boolean} showHostnames
 * @param {Map|null} hostnameCache
 * @param {function} onFilterClick - callback(field, value, ev)
 */
function addrFilterLink(field, ip, showHostnames, hostnameCache, onFilterClick) {
	if (!ip)
		return log.formatCell(ip);

	const name = showHostnames && hostnameCache ? hostnameCache.get(ip) : null;
	const display = name || ip;
	const title = name ? ip : _('Filter by %s').format(field);

	return E('a', {
		'href': '#',
		'class': 'fwlive-filter-link',
		'title': title,
		'click': function(ev) { onFilterClick(field, ip, ev); }
	}, [ display ]);
}

/**
 * @param {string} hint           - rule hint token
 * @param {string} firewallBackend - 'nft' or 'iptables'
 */
function ruleAdminPath(hint, firewallBackend) {
	if (hint === 'fw4')
		return 'admin/network/firewall/rules';

	if (firewallBackend === 'iptables')
		return 'admin/status/iptables';

	return 'admin/status/nftables';
}

/**
 * @param {string} hint            - rule hint token
 * @param {string} label           - display label
 * @param {string} firewallBackend - 'nft' or 'iptables'
 * @param {function} onFilterClick - callback(field, value, ev)
 */
function ruleAdminLink(hint, label, firewallBackend, onFilterClick) {
	if (!hint)
		return log.formatCell(hint);

	const path = ruleAdminPath(hint, firewallBackend);
	const url = '%s#%s'.format(luciUrl(path), encodeURIComponent(hint));
	const text = label || hint;

	return E('a', {
		'href': '#',
		'class': 'fwlive-filter-link fwlive-rule-link',
		'title': _('Filter logs by rule (hint: %s). Ctrl+click to open firewall settings.').format(hint),
		'click': function(ev) {
			if (ev && (ev.ctrlKey || ev.metaKey)) {
				if (ev.preventDefault)
					ev.preventDefault();
				window.location = url;
				return;
			}
			onFilterClick('q', hint, ev);
		}
	}, [ text ]);
}

/**
 * @param {string} value           - interface name
 * @param {function} onFilterClick - callback(field, value, ev)
 */
function ifaceLink(value, onFilterClick) {
	if (!value)
		return log.formatCell(value);

	return E('a', {
		'href': '#',
		'class': 'fwlive-filter-link fwlive-iface-badge',
		'title': _('Filter by interface'),
		'click': function(ev) { onFilterClick('interface', value, ev); }
	}, [ value ]);
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
	ifaceLink: ifaceLink
});
