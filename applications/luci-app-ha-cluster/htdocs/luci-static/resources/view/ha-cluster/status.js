/*
 * Copyright (c) 2025-2026 Pierre Gaufillet <pierre.gaufillet@bergamote.eu>
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
'require view';
'require poll';
'require rpc';
'require dom';
'require ui';
'require fs';

var callHAClusterStatus = rpc.declare({
	object: 'ha-cluster',
	method: 'status',
	expect: { }
});

return view.extend({
	__init__: function() {
		this.super('__init__', arguments);
		this.pollData = null;
	},

	load: function() {
		return Promise.all([
			this.loadData(),
			L.resolveDefault(fs.stat('/usr/sbin/lease-sync'), null)
		]);
	},

	loadData: function() {
		return callHAClusterStatus().catch(function(err) {
			console.error('ha-cluster status RPC failed:', err);
			return {};
		});
	},

	formatUptime: function(seconds) {
		if (!seconds) return '-';
		var days = Math.floor(seconds / 86400);
		var hours = Math.floor((seconds % 86400) / 3600);
		var mins = Math.floor((seconds % 3600) / 60);

		var parts = [];
		if (days > 0) parts.push(days + 'd');
		if (hours > 0) parts.push(hours + 'h');
		if (mins > 0 || parts.length === 0) parts.push(mins + 'm');

		return parts.join(' ');
	},

	formatRelativeTime: function(unixTimestamp) {
		if (!unixTimestamp || unixTimestamp === 0) {
			return _('Never');
		}

		var now = Math.floor(Date.now() / 1000);
		var diff = now - unixTimestamp;

		if (diff < 60) {
			return _('Just now');
		} else if (diff < 3600) {
			var mins = Math.floor(diff / 60);
			return mins + ' ' + (mins === 1 ? _('minute ago') : _('minutes ago'));
		} else if (diff < 86400) {
			var hours = Math.floor(diff / 3600);
			return hours + ' ' + (hours === 1 ? _('hour ago') : _('hours ago'));
		} else {
			var days = Math.floor(diff / 86400);
			return days + ' ' + (days === 1 ? _('day ago') : _('days ago'));
		}
	},

	renderServiceRow: function(name, serviceInfo) {
		var isRunning = (serviceInfo && serviceInfo.running) || false;
		var isRequired = (serviceInfo && serviceInfo.required) || false;
		var pid = (serviceInfo && serviceInfo.pid) || '-';
		var uptime = (serviceInfo && this.formatUptime(serviceInfo.uptime)) || '-';

		// Determine status badge using LuCI standard classes
		var statusBadge;
		if (isRunning) {
			statusBadge = E('span', { 'class': 'label success' }, _('Running'));
		} else if (isRequired) {
			statusBadge = E('span', { 'class': 'label important' }, _('Stopped'));
		} else {
			statusBadge = E('span', { 'class': 'label' }, _('Disabled'));
		}

		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, name),
			E('td', { 'class': 'td left' }, statusBadge),
			E('td', { 'class': 'td left' }, String(pid)),
			E('td', { 'class': 'td left' }, uptime)
		]);
	},

	renderStatus: function(data, leaseSyncInstalled) {
		var status = data || {};
		var services = status.services || {};

		var clusterState = status.state || 'UNKNOWN';
		var nodeRole = status.role || 'UNKNOWN';
		var peers = status.peers || [];
		var syncStatus = status.sync || {};

		// Determine cluster state label class
		var stateClass;
		switch (clusterState) {
			case 'HEALTHY':
				stateClass = 'label success';
				break;
			case 'DEGRADED':
				stateClass = 'label warning';
				break;
			case 'FAULTY':
				stateClass = 'label important';
				break;
			default:
				stateClass = 'label';
		}

		// Determine node role label class
		var roleClass;
		switch (nodeRole) {
			case 'MASTER':
				roleClass = 'label success';
				break;
			case 'BACKUP':
				roleClass = 'label notice';
				break;
			case 'FAULT':
				roleClass = 'label important';
				break;
			case 'MIXED':
				roleClass = 'label warning';
				break;
			default:
				roleClass = 'label';
		}

		// Build per-instance role rows (shown when multiple instances exist)
		var instances = status.instances || {};
		var instanceNames = Object.keys(instances);

		return [
			E('h3', {}, _('Cluster Status')),

			// Two separate tables side-by-side for clear visual separation
			E('div', { 'class': 'cbi-section', 'style': 'display: flex; gap: 2em;' }, [
				// Table 1: Cluster Overview
				E('div', { 'class': 'cbi-section-node', 'style': 'flex: 1;' }, [
					E('table', { 'class': 'table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th', 'colspan': '2' }, _('Cluster Overview'))
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Cluster State')),
							E('td', { 'class': 'td left' }, [
								E('span', { 'class': stateClass }, clusterState)
							])
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Node Role')),
							E('td', { 'class': 'td left' }, [
								E('span', { 'class': roleClass }, nodeRole)
							])
						])
					].concat(instanceNames.length > 1 ? instanceNames.map(function(name) {
						var instRole = instances[name];
						var instClass;
						switch (instRole) {
							case 'MASTER': instClass = 'label success'; break;
							case 'BACKUP': instClass = 'label notice'; break;
							case 'FAULT':  instClass = 'label important'; break;
							default:       instClass = 'label';
						}
						return E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left', 'style': 'padding-left: 2em;' },
								_('Instance: %s').format(name)),
							E('td', { 'class': 'td left' }, [
								E('span', { 'class': instClass }, instRole)
							])
						]);
					}) : []))
				]),
				// Table 2: Last Synchronization
				E('div', { 'class': 'cbi-section-node', 'style': 'flex: 1;' }, [
					E('table', { 'class': 'table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th', 'colspan': '2' }, _('Last Synchronization'))
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Config Sync')),
							E('td', { 'class': 'td left' }, this.formatRelativeTime(syncStatus.config_last_sync))
						])
					].concat(leaseSyncInstalled ? [
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Lease Sync')),
							E('td', { 'class': 'td left' }, this.formatRelativeTime(syncStatus.lease_last_sync))
						])
					] : []))
				])
			]),

			// Service Status
			E('h3', {}, _('Service Status')),
			E('div', { 'class': 'cbi-section cbi-section-node' }, [
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Service')),
						E('th', { 'class': 'th' }, _('Status')),
						E('th', { 'class': 'th' }, _('PID')),
						E('th', { 'class': 'th' }, _('Uptime'))
					]),
					this.renderServiceRow('keepalived', services.keepalived),
					this.renderServiceRow('owsync', services.owsync)
				].concat(leaseSyncInstalled ? [
					this.renderServiceRow('lease-sync', services['lease-sync'])
				] : []))
			]),

			// Peer Status
			E('h3', {}, _('Peer Status')),
			E('div', { 'class': 'cbi-section cbi-section-node' }, [
				peers.length > 0 ?
					E('table', { 'class': 'table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th' }, _('Peer Name')),
							E('th', { 'class': 'th' }, _('Address')),
							E('th', { 'class': 'th' }, _('State')),
							E('th', { 'class': 'th' }, _('Last Seen'))
						])
					].concat(peers.map(function(peer) {
						return E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, peer.name || '-'),
							E('td', { 'class': 'td left' }, peer.address || '-'),
							E('td', { 'class': 'td left' },
								E('span', {
									'class': peer.online ? 'label success' : 'label important'
								}, peer.online ? _('Online') : _('Offline'))
							),
							E('td', { 'class': 'td left' }, peer.last_seen || '-')
						]);
					}))) :
					E('div', { 'class': 'alert-message warning' }, _('No peers configured'))
			])
		];
	},

	render: function(data) {
		var statusData = data[0];
		var leaseSyncInstalled = data[1] != null;

		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('High Availability Status')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Real-time status of the HA cluster. Updates every 5 seconds.'))
		]);

		var content = E('div', { 'id': 'ha_status_content' });
		view.appendChild(content);
		dom.content(content, this.renderStatus(statusData, leaseSyncInstalled));

		// Set up auto-refresh polling
		poll.add(L.bind(function() {
			return this.loadData().then(L.bind(function(data) {
				var statusContent = document.getElementById('ha_status_content');
				if (statusContent) {
					dom.content(statusContent, this.renderStatus(data, leaseSyncInstalled));
				}
			}, this));
		}, this), 5);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
