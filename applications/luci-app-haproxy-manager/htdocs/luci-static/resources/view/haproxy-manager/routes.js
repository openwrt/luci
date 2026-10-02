'use strict';
/* global hmUi */
'require view';
'require dom';
'require form';
'require ui';
'require haproxy-manager.ui as hmUi';

function listValue(value) {
	if (Array.isArray(value))
		return value;
	if (value == null || value === '')
		return [];
	return String(value).trim().split(/\s+/);
}

function routeKind(map, sectionId) {
	return map.data.get('haproxy_manager', sectionId, 'kind') ||
		map.data.get('haproxy_manager', sectionId, 'protocol') || 'web';
}

function kindLabel(kind) {
	switch (kind) {
	case 'web': return _('Web');
	case 'ssh': return _('SSH');
	case 'rdp': return _('Remote Desktop');
	case 'custom': return _('Custom TCP');
	case 'http': return _('HTTP only');
	case 'https': return _('HTTPS only');
	case 'both': return _('Legacy Web');
	default: return _('TCP');
	}
}

function portMapIsValid(value) {
	var match = String(value || '').match(/^(\d+):(\d+)$/);
	return !!match && +match[1] >= 1 && +match[1] <= 65535 && +match[2] >= 1 && +match[2] <= 65535;
}

function parseFirewall(output) {
	var result = { ports: {}, conflicts: [], conflict_count: '0', enabled: '0', policy: '', managed_rule: '0' };

	String(output || '').split(/\r?\n/).forEach(function(line) {
		var fields = line.split('\t');
		if (fields[0] == 'port')
			result.ports[fields[1]] = true;
		else if (fields[0] == 'conflict')
			result.conflicts.push({ section: fields[1], name: fields[2], ports: fields[3] });
		else if (fields[0] == 'conflicts')
			result.conflict_count = fields[1] || '0';
		else if (fields[0])
			result[fields[0]] = fields.slice(1).join('\t');
	});

	return result;
}

function specContains(spec, port) {
	return String(spec || '').split(/[\s,]+/).some(function(token) {
		var range = token.split('-').map(Number);
		return range.length == 1 ? range[0] == port : port >= range[0] && port <= range[1];
	});
}

function routePorts(map, sectionId, kind) {
	var main = function(option, fallback) {
		return map.data.get('haproxy_manager', 'main', option) || fallback;
	};

	switch (kind) {
	case 'web':
		return [
			map.data.get('haproxy_manager', sectionId, 'web_http') == '0' ? null : main('http_port', '80'),
			map.data.get('haproxy_manager', sectionId, 'web_https') == '0' ? null : main('https_port', '443')
		].filter(Boolean);
	case 'ssh':
		return [map.data.get('haproxy_manager', sectionId, 'ssh_listen_port') || '22'];
	case 'rdp':
		return [map.data.get('haproxy_manager', sectionId, 'rdp_listen_port') || '3389'];
	case 'custom':
		return listValue(map.data.get('haproxy_manager', sectionId, 'port_map')).map(function(item) {
			return item.split(':')[0];
		});
	case 'http': return [main('http_port', '80')];
	case 'https': return [main('https_port', '443')];
	case 'both': return [main('http_port', '80'), main('https_port', '443')];
	default:
		return [map.data.get('haproxy_manager', sectionId, 'listen_port') ||
			map.data.get('haproxy_manager', sectionId, 'backend_port')].filter(Boolean);
	}
}

return view.extend({
	load: function() {
		return Promise.all([
			hmUi.exec('/usr/libexec/haproxy-manager/firewall-plan', []).catch(function() {
				return { stdout: '' };
			})
		]);
	},

	render: function(data) {
		var m, s, o;
		var firewall = parseFirewall(data[0].stdout);

		hmUi.ensureStyles();

		m = new form.Map('haproxy_manager', _('HAProxy Services'),
			_('Publish Web, SSH, Remote Desktop, and custom TCP services from one place.'));

		s = m.section(form.GridSection, 'route', _('Services'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add service');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.modalonly = true;

		o = s.option(form.Value, 'name', _('Service name'));
		o.placeholder = _('My service');
		o.rmempty = true;
		o.modalonly = true;

		o = s.option(form.ListValue, 'kind', _('Service type'));
		o.value('web', _('Web (HTTP + HTTPS)'));
		o.value('ssh', _('SSH'));
		o.value('rdp', _('Remote Desktop'));
		o.value('custom', _('Custom TCP'));
		o.default = 'web';
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.Value, 'host', _('Domain'));
		o.placeholder = 'example.org';
		o.datatype = 'hostname';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('kind', 'web');

		o = s.option(form.Value, 'backend_host', _('Destination host'));
		o.placeholder = '192.0.2.10';
		o.datatype = 'or(ipaddr,hostname)';
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.Flag, 'web_http', _('Publish HTTP'));
		o.default = '1';
		o.modalonly = true;
		o.depends('kind', 'web');

		o = s.option(form.Value, 'backend_http_port', _('Destination HTTP port'));
		o.datatype = 'port';
		o.default = '80';
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ kind: 'web', web_http: '1' });

		o = s.option(form.Flag, 'web_https', _('Publish HTTPS'));
		o.default = '1';
		o.modalonly = true;
		o.depends('kind', 'web');

		o = s.option(form.Value, 'backend_https_port', _('Destination HTTPS port'));
		o.datatype = 'port';
		o.default = '443';
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ kind: 'web', web_https: '1' });

		o = s.option(form.Value, 'ssh_listen_port', _('Public SSH port'));
		o.datatype = 'port';
		o.default = '22';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('kind', 'ssh');

		o = s.option(form.Value, 'ssh_backend_port', _('Destination SSH port'));
		o.datatype = 'port';
		o.default = '22';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('kind', 'ssh');

		o = s.option(form.Value, 'rdp_listen_port', _('Public RDP port'));
		o.datatype = 'port';
		o.default = '3389';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('kind', 'rdp');

		o = s.option(form.Value, 'rdp_backend_port', _('Destination RDP port'));
		o.datatype = 'port';
		o.default = '3389';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('kind', 'rdp');

		o = s.option(form.DynamicList, 'port_map', _('TCP port mappings'));
		o.placeholder = '8443:443';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('kind', 'custom');
		o.validate = function(sectionId, value) {
			return portMapIsValid(value) || _('Use the public:destination format, for example 8443:443.');
		};

		o = s.option(form.DummyValue, '_status', _('Status'));
		o.modalonly = false;
		o.textvalue = function(sectionId) {
			var enabled = m.data.get('haproxy_manager', sectionId, 'enabled') != '0';
			return E('span', {
				'class': 'hm-state %s'.format(enabled ? 'hm-state-on' : 'hm-state-off')
			}, enabled ? _('On') : _('Off'));
		};

		o = s.option(form.DummyValue, '_service', _('Service'));
		o.modalonly = false;
		o.textvalue = function(sectionId) {
			var kind = routeKind(m, sectionId);
			var name = m.data.get('haproxy_manager', sectionId, 'name') ||
				m.data.get('haproxy_manager', sectionId, 'host') || kindLabel(kind);
			var enabled = m.data.get('haproxy_manager', sectionId, 'enabled') != '0';

			return E('div', { 'class': 'hm-service-cell' }, [
				E('div', { 'class': 'hm-route-name' }, [
					E('strong', name),
					E('span', {
						'class': 'hm-state hm-mobile-only %s'.format(enabled ? 'hm-state-on' : 'hm-state-off')
					}, enabled ? _('On') : _('Off'))
				]),
				E('span', { 'class': 'hm-badge' }, kindLabel(kind))
			]);
		};

		o = s.option(form.DummyValue, '_endpoint', _('Public endpoint'));
		o.modalonly = false;
		o.textvalue = function(sectionId) {
			var kind = routeKind(m, sectionId);
			var ports = routePorts(m, sectionId, kind);
			var host = m.data.get('haproxy_manager', sectionId, 'host');

			if (kind == 'web' || kind == 'http' || kind == 'https' || kind == 'both') {
				return E('div', { 'class': 'hm-endpoint' }, [
					E('span', { 'class': 'hm-endpoint-value' }, host || _('Not set')),
					E('span', { 'class': 'hm-port-summary' }, ports.map(function(port) { return ':' + port; }).join(' + '))
				]);
			}

			return E('div', { 'class': 'hm-port-list' }, ports.map(function(port) {
				return E('code', ':' + port);
			}));
		};

		o = s.option(form.DummyValue, '_destination', _('Destination'));
		o.modalonly = false;
		o.textvalue = function(sectionId) {
			var kind = routeKind(m, sectionId);
			var host = m.data.get('haproxy_manager', sectionId, 'backend_host') || _('Not set');
			var mappings = [];

			if (kind == 'web') {
				if (m.data.get('haproxy_manager', sectionId, 'web_http') != '0')
					mappings.push(_('HTTP') + ' :' + (m.data.get('haproxy_manager', sectionId, 'backend_http_port') || '80'));
				if (m.data.get('haproxy_manager', sectionId, 'web_https') != '0')
					mappings.push(_('HTTPS') + ' :' + (m.data.get('haproxy_manager', sectionId, 'backend_https_port') || '443'));
			}
			else if (kind == 'ssh')
				mappings.push(':' + (m.data.get('haproxy_manager', sectionId, 'ssh_backend_port') || '22'));
			else if (kind == 'rdp')
				mappings.push(':' + (m.data.get('haproxy_manager', sectionId, 'rdp_backend_port') || '3389'));
			else if (kind == 'custom')
				mappings = listValue(m.data.get('haproxy_manager', sectionId, 'port_map')).map(function(item) { return ':' + item.split(':')[1]; });
			else
				mappings.push(':' + (m.data.get('haproxy_manager', sectionId, 'backend_port') || ''));

			return E('div', { 'class': 'hm-destination' }, [
				E('code', host),
				E('span', mappings.join(' / '))
			]);
		};

		o = s.option(form.DummyValue, '_firewall', _('Firewall'));
		o.modalonly = false;
		o.textvalue = function(sectionId) {
			var kind = routeKind(m, sectionId);
			var ports = routePorts(m, sectionId, kind).map(Number);
			var conflict = firewall.conflicts.some(function(item) {
				return ports.some(function(port) { return specContains(item.ports, port); });
			});
			var state = firewall.enabled != '1' ? _('Manual') : conflict ? _('Conflict') :
				(firewall.managed_rule == '1' || firewall.policy == 'ACCEPT' ? _('Ready') : _('Pending'));

			return E('span', {
				'class': 'hm-state %s'.format(conflict ? 'hm-state-danger' : firewall.enabled == '1' ? 'hm-state-on' : 'hm-state-off')
			}, state);
		};

		function applied(reload) {
			hmUi.notifyApplied();
			if (reload)
				hmUi.reloadAfterApply();
		}

		function applyMap(reload) {
			return hmUi.saveAndApply(m).then(function() {
				applied(reload);
			}).catch(function(error) {
				hmUi.notifyError(error);
			});
		}

		var baseHandleDrop = s.handleDrop;
		var baseHandleTouchEnd = s.handleTouchEnd;

		s.handleModalSave = function(modalMap, ev) {
			var mapNode = this.getActiveModalMap();
			var activeMap = dom.findClassInstance(mapNode);

			return activeMap.save(null, true).then(function() {
				return hmUi.commitAndApply();
			}).then(function() {
				return this.handleModalCancel(modalMap, ev, true);
			}.bind(this)).then(function() {
				applied(true);
			}).catch(function(error) {
				hmUi.notifyError(error);
			});
		};

		s.handleRemove = function(sectionId) {
			ui.showModal(_('Delete service?'), [
				E('p', _('The service will be removed from HAProxy and the firewall immediately.')),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn cbi-button',
						'click': ui.hideModal
					}, _('Cancel')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-negative important',
						'click': ui.createHandlerFn(this, function() {
							ui.hideModal();
							m.data.remove('haproxy_manager', sectionId);
							return applyMap(true);
						})
					}, _('Delete and apply'))
				])
			]);
		};

		function applyReorder() {
			window.setTimeout(function() {
				applyMap(true);
			}, 100);
		}

		s.handleDrop = function(ev) {
			var shouldApply = !!(ev.currentTarget && ev.currentTarget.matches &&
				ev.currentTarget.matches('.drag-over-above, .drag-over-below'));
			var result = baseHandleDrop.call(this, ev);
			if (shouldApply)
				applyReorder();
			return result;
		};

		s.handleTouchEnd = function(ev) {
			var row = ev.target && ev.target.closest ? ev.target.closest('.tr') : null;
			var shouldApply = !!(document.querySelector('.touchsort-element') && row &&
				row.parentNode.querySelector('.drag-over-above, .drag-over-below'));
			var result = baseHandleTouchEnd.call(this, ev);
			if (shouldApply)
				applyReorder();
			return result;
		};

		return m.render().then(function(node) {
			var filterInput = E('input', {
				'id': 'haproxy-route-filter',
				'class': 'cbi-input-text hm-filter',
				'type': 'search',
				'placeholder': _('Filter services'),
				'aria-label': _('Filter services')
			});
			var countNode = E('span', { 'class': 'hm-route-count' });
			var emptyNode = E('p', {
				'class': 'alert-message notice hm-filter-empty',
				'hidden': ''
			}, _('No matching services'));
			var toolbar = E('div', { 'class': 'hm-toolbar' }, [ filterInput, countNode ]);
			var section = node.querySelector('.cbi-section');

			function updateFilter() {
				var query = filterInput.value.trim().toLowerCase();
				var rows = node.querySelectorAll('.cbi-section-table-row[data-sid]');
				var visible = 0;

				for (var i = 0; i < rows.length; i++) {
					var match = !query || rows[i].textContent.toLowerCase().indexOf(query) > -1;
					rows[i].hidden = !match;
					visible += match ? 1 : 0;
				}

				countNode.textContent = _('%d services').format(visible);
				emptyNode.hidden = visible > 0 || !query;
			}

			filterInput.addEventListener('input', updateFilter);

			if (section) {
				var table = section.querySelector('.table');
				if (table)
					table.classList.add('hm-route-table');
				section.insertBefore(toolbar, table || section.firstChild);
				section.appendChild(emptyNode);
			}

			if (firewall.conflicts.length) {
				node.insertBefore(E('div', { 'class': 'alert-message warning hm-inline-alert' }, [
					E('strong', _('Firewall conflict detected.')),
					' ',
					E('a', { 'href': L.url('admin/services/haproxy-manager/settings') }, _('Review firewall settings'))
				]), node.firstChild.nextSibling);
			}

			node.appendChild(E('div', { 'class': 'cbi-page-actions hm-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() {
						return hmUi.exec('/usr/libexec/haproxy-manager/generate', [ '/tmp/haproxy-manager-preview.cfg' ]).then(function() {
							return hmUi.exec('/usr/libexec/haproxy-manager/validate', [ '/tmp/haproxy-manager-preview.cfg' ]);
						}).then(function() {
							return hmUi.exec('/usr/libexec/haproxy-manager/firewall-plan', []);
						}).then(function(r) {
							var plan = parseFirewall(r.stdout);
							hmUi.notify(plan.conflicts.length ?
								_('Configuration is valid. Firewall conflicts: %d').format(plan.conflicts.length) :
								_('Configuration and firewall are ready.'), plan.conflicts.length ? 'warning' : 'info');
						}).catch(function(err) {
							hmUi.notifyError(err);
						});
					})
				}, _('Check configuration')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'type': 'button',
					'click': ui.createHandlerFn(this, function() {
						return applyMap(true);
					})
				}, _('Synchronize now'))
			]));

			updateFilter();
			return node;
		}.bind(this));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
