/*
 * Copyright (c) 2025-2026 Pierre Gaufillet <pierre.gaufillet@bergamote.eu>
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('ha-cluster'),
			L.resolveDefault(fs.stat('/usr/sbin/lease-sync'), null),
			L.resolveDefault(ui.menu.load(), null)
		]);
	},

	render: function(data) {
		var leaseSyncInstalled = data[1] != null;

		if (!leaseSyncInstalled) {
			// The Software page comes with luci-app-package-manager
			var softwarePage = [ 'admin', 'system', 'package-manager' ].reduce(function(node, name) {
				return (node && node.children) ? node.children[name] : null;
			}, data[2]);
			var hint = E('div', { 'class': 'alert-message warning' },
				E('p', {}, _('Install the lease-sync package to enable real-time DHCP lease synchronization.')));
			if (softwarePage && softwarePage.satisfied)
				hint.appendChild(E('div', { 'class': 'right' }, E('a', { 'class': 'btn', 'href': L.url('admin/system/package-manager') }, _('Go to Software…'))));
			return E('div', { 'class': 'cbi-map' }, [
				E('h2', {}, _('High Availability - Advanced Lease Sync')),
				hint
			]);
		}

		var m, s, o;

		m = new form.Map('ha-cluster', _('High Availability - Advanced Lease Sync'),
			_('Tuning for high-churn environments, unreliable networks, or troubleshooting.'));

		s = m.section(form.TypedSection, 'advanced', _('Lease-Sync Tuning'),
			_('Default values work for most deployments.'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'lease_sync_port', _('Sync Port'),
			_('UDP port for lease sync.'));
		o.datatype = 'port';
		o.placeholder = '5378';

		o = s.option(form.Value, 'lease_sync_interval', _('Sync Interval'),
			_('Seconds between full sync requests. Safety net for missed updates.'));
		o.datatype = 'uinteger';
		o.placeholder = '30';

		o = s.option(form.Value, 'lease_sync_peer_timeout', _('Peer Timeout'),
			_('Seconds without heartbeat before peer is offline. Should be 4x sync_interval.'));
		o.datatype = 'uinteger';
		o.placeholder = '120';

		o = s.option(form.ListValue, 'lease_sync_log_level', _('Log Level'),
			_('Use Debug (3) for troubleshooting sync issues.'));
		o.value('0', _('Error'));
		o.value('1', _('Warning'));
		o.value('2', _('Info (default)'));
		o.value('3', _('Debug'));
		o.default = '2';

		return m.render();
	}
});
