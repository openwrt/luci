'use strict';
/* global hmUi */
'require view';
'require ui';
'require haproxy-manager.ui as hmUi';

function parseStatus(output) {
	var status = { listeners: [] };

	String(output || '').split(/\r?\n/).forEach(function(line) {
		var fields = line.split('\t');
		if (fields[0] == 'listener') {
			status.listeners.push({
				protocol: fields[1] || '',
				address: fields[2] || '',
				process: fields.slice(3).join('\t') || ''
			});
		}
		else if (fields[0])
			status[fields[0]] = fields.slice(1).join('\t');
	});

	return status;
}

function parseBackups(output) {
	return String(output || '').split(/\r?\n/).map(function(line) {
		var fields = line.split('\t');
		return fields[0] == 'backup' ? { id: fields[1], latest: fields[2] == '1', files: fields[3] } : null;
	}).filter(Boolean);
}

function parseIncidents(output) {
	return String(output || '').split(/\r?\n/).map(function(line) {
		var fields = line.split('\t');
		return fields[0] == 'incident' ? {
			id: fields[1],
			latest: fields[2] == '1',
			result: fields[3] || '',
			action: fields[4] || '',
			interface: fields[5] || '',
			reason: fields[6] || ''
		} : null;
	}).filter(Boolean);
}

function parseFirewall(output) {
	var result = { conflicts: '0', enabled: '0', policy: '' };
	String(output || '').split(/\r?\n/).forEach(function(line) {
		var fields = line.split('\t');
		if (fields[0] && fields[0] != 'conflict' && fields[0] != 'port')
			result[fields[0]] = fields.slice(1).join('\t');
	});
	return result;
}

function backupDate(id) {
	var match = String(id || '').match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
	return match ? '%s-%s-%s %s:%s:%s'.format(match[1], match[2], match[3], match[4], match[5], match[6]) : id;
}

function statusItem(label, value) {
	return E('div', { 'class': 'hm-status-item' }, [
		E('span', { 'class': 'hm-status-label' }, label),
		E('span', { 'class': 'hm-status-value' }, value)
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			hmUi.exec('/usr/libexec/haproxy-manager/status', []).catch(function(err) {
				return { stdout: '', stderr: err.message || String(err), code: 1 };
			}),
			hmUi.exec('/usr/libexec/haproxy-manager/backups', []).catch(function() { return { stdout: '' }; }),
			hmUi.exec('/usr/libexec/haproxy-manager/firewall-plan', []).catch(function() { return { stdout: '' }; }),
			hmUi.exec('/usr/libexec/haproxy-manager/incidents', []).catch(function() { return { stdout: '' }; })
		]);
	},

	showIncident: function(incidentId) {
		return hmUi.exec('/usr/libexec/haproxy-manager/incident', [ incidentId ]).then(function(result) {
			ui.showModal(_('Incident diagnostics'), [
				E('p', _('Diagnostic report for %s.').format(backupDate(incidentId))),
				E('pre', { 'class': 'hm-incident-report' }, result.stdout || _('Not available')),
				E('div', { 'class': 'right' }, E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'type': 'button',
					'click': ui.hideModal
				}, _('Close')))
			]);
		}).catch(function(err) {
			hmUi.notifyError(err);
		});
	},

	showRestore: function(backupId) {
		ui.showModal(_('Restore configuration?'), [
			E('p', _('HAProxy, firewall, and LuCI settings will be restored from %s.').format(backupDate(backupId))),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'type': 'button',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() {
						return hmUi.exec('/usr/libexec/haproxy-manager/rollback', [ backupId ]).then(function(r) {
							ui.hideModal();
							hmUi.notify(r.stdout || _('Restored'), 'info');
							hmUi.reloadAfterApply(3500);
						}).catch(function(err) {
							ui.hideModal();
							hmUi.notifyError(err);
						});
					})
				}, _('Restore'))
			])
		]);
	},

	render: function(data) {
		var res = data[0];
		var status = parseStatus(res.stdout);
		var backups = parseBackups(data[1].stdout);
		var firewall = parseFirewall(data[2].stdout);
		var incidents = parseIncidents(data[3].stdout);
		var running = status.service == 'running';
		var autoRecovery = status.auto_recovery != '0';
		var recoveryResults = {
			'recovered': _('Recovered'),
			'failed': _('Failed'),
			'invalid-config': _('Invalid configuration'),
			'backup-failed': _('Recovery point failed'),
			'detected': _('In progress')
		};
		recoveryResults.reconciled = _('WAN address reconciled');
		recoveryResults['rolled-back'] = _('Failed, configuration restored');
		recoveryResults['rollback-failed'] = _('Failed, restore also failed');
		recoveryResults['address-unavailable'] = _('WAN address unavailable');
		recoveryResults['invalid-generated-config'] = _('Generated configuration is invalid');
		recoveryResults['install-failed'] = _('Configuration installation failed');
		var lastRecovery = status.last_incident ? '%s - %s%s'.format(
			backupDate(status.last_incident),
			recoveryResults[status.last_incident_result] || status.last_incident_result,
			status.last_incident_interface ? ' (%s)'.format(status.last_incident_interface) : ''
		) : _('No incidents recorded');
		var firewallText = firewall.enabled != '1' ? _('Manual') : +firewall.conflicts > 0 ?
			_('%d conflicts').format(+firewall.conflicts) : _('Managed');
		var modes = {
			generated: _('Generated routes'),
			raw: _('Raw configuration'),
			none: _('Not managed')
		};
		var listeners = status.listeners.map(function(listener) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Protocol') }, listener.protocol),
				E('td', { 'class': 'td', 'data-title': _('Address') }, E('code', listener.address)),
				E('td', { 'class': 'td', 'data-title': _('Process') }, listener.process)
			]);
		});
		var backupRows = backups.map(function(backup) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Created') }, [
					E('span', backupDate(backup.id)),
					backup.latest ? E('span', { 'class': 'hm-badge hm-backup-latest' }, _('Latest')) : ''
				]),
				E('td', { 'class': 'td', 'data-title': _('Contents') }, _('%d configuration files').format(+backup.files || 0)),
				E('td', { 'class': 'td cbi-section-actions' }, E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() { this.showRestore(backup.id); })
				}, _('Restore')))
			]);
		}.bind(this));
		var incidentRows = incidents.map(function(incident) {
			var result = recoveryResults[incident.result] || incident.result || _('Not available');
			var context = [ incident.action, incident.interface ].filter(Boolean).join(' / ');
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'data-title': _('Created') }, [
					E('span', backupDate(incident.id)),
					incident.latest ? E('span', { 'class': 'hm-badge hm-backup-latest' }, _('Latest')) : ''
				]),
				E('td', { 'class': 'td', 'data-title': _('Result') }, result),
				E('td', { 'class': 'td', 'data-title': _('Trigger') }, context || incident.reason || '-'),
				E('td', { 'class': 'td cbi-section-actions' }, E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() { return this.showIncident(incident.id); })
				}, _('View')))
			]);
		}.bind(this));

		hmUi.ensureStyles();

		if (!listeners.length) {
			listeners.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '3' }, _('No HAProxy or LuCI listeners detected.'))
			]));
		}

		if (!backupRows.length) {
			backupRows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '3' }, _('No recovery points yet.'))
			]));
		}

		if (!incidentRows.length) {
			incidentRows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '4' }, _('No incidents recorded'))
			]));
		}

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', _('HAProxy Status')),
			E('div', { 'class': 'cbi-map-descr' }, _('Service health, active listeners, and recovery points.')),
			res.code && res.stderr ? E('div', { 'class': 'alert-message error' }, res.stderr) : '',
			E('div', { 'class': 'hm-status-grid' }, [
				statusItem(_('Service'), E('span', {
					'class': 'hm-state %s'.format(running ? 'hm-state-on' : 'hm-state-off')
				}, running ? _('Running') : _('Stopped'))),
				statusItem(_('WAN address'), status.wan_ip || _('Not set')),
				statusItem(_('HAProxy version'), status.version || _('Not available')),
				statusItem(_('Automatic recovery'), E('span', {
					'class': 'hm-state %s'.format(autoRecovery ? 'hm-state-on' : 'hm-state-off')
				}, autoRecovery ? _('Enabled') : _('Disabled'))),
				statusItem(_('Configuration mode'), modes[status.active_mode] || status.active_mode || modes.none),
				statusItem(_('Last recovery'), lastRecovery),
				statusItem(_('Firewall'), E('span', {
					'class': 'hm-state %s'.format(+firewall.conflicts > 0 ? 'hm-state-danger' : firewall.enabled == '1' ? 'hm-state-on' : 'hm-state-off')
				}, firewallText))
			]),
			E('h3', _('Active listeners')),
			E('table', { 'class': 'table hm-listener-table' }, [
				E('thead', {}, [ E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Protocol')),
					E('th', { 'class': 'th' }, _('Address')),
					E('th', { 'class': 'th' }, _('Process'))
				]) ]),
				E('tbody', {}, listeners)
			]),
			E('div', { 'class': 'hm-section-heading' }, [
				E('h3', _('Recovery incidents')),
				E('p', { 'class': 'cbi-section-descr' }, _('The seven latest automatic recovery reports are retained on the router.'))
			]),
			E('table', { 'class': 'table hm-incident-table' }, [
				E('thead', {}, [ E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Created')),
					E('th', { 'class': 'th' }, _('Result')),
					E('th', { 'class': 'th' }, _('Trigger')),
					E('th', { 'class': 'th' })
				]) ]),
				E('tbody', {}, incidentRows)
			]),
			E('div', { 'id': 'recovery', 'class': 'hm-section-heading' }, [
				E('div', { 'class': 'hm-section-title-row' }, [
					E('h3', _('Recovery points')),
					E('button', {
						'class': 'btn cbi-button cbi-button-add',
						'type': 'button',
						'click': ui.createHandlerFn(this, function() {
							return hmUi.exec('/usr/libexec/haproxy-manager/backup', []).then(function() {
								window.location.reload();
							}).catch(function(err) { hmUi.notifyError(err); });
						})
					}, _('Create recovery point'))
				]),
				E('p', { 'class': 'cbi-section-descr' }, _('Restore HAProxy, firewall, and LuCI settings from a previous snapshot.'))
			]),
			E('table', { 'class': 'table hm-backup-table' }, [
				E('thead', {}, [ E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Created')),
					E('th', { 'class': 'th' }, _('Contents')),
					E('th', { 'class': 'th' })
				]) ]),
				E('tbody', {}, backupRows)
			]),
			E('div', { 'class': 'cbi-page-actions hm-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'type': 'button',
					'click': function() { window.location.reload(); }
				}, _('Refresh'))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
