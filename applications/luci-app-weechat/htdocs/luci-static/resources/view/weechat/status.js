'use strict';
'require view';
'require rpc';
'require uci';
'require ui';
'require poll';
'require tools.weechat as weechatTools';

function renderEnabledState(isEnabled) {
	return [
		isEnabled
			? E('span', { 'class': 'label success', 'style': 'margin-right: 8px;' }, _('Enabled'))
			: E('span', { 'class': 'label danger', 'style': 'margin-right: 8px;' }, _('Disabled')),
		E('span', { 'class': 'cbi-value-description' },
			isEnabled ? _('Service is allowed to start.') : _('Service is disabled in configuration.'))
	];
}

function getServiceStatus(serviceData) {
	var isRunning = false,
	    pid = null;

	if (serviceData && serviceData.weechat && serviceData.weechat.instances) {
		var instances = serviceData.weechat.instances;
		for (var inst in instances) {
			if (instances[inst].running) {
				isRunning = true;
				pid = instances[inst].pid;
				break;
			}
		}
	}

	return { running: isRunning, pid: pid };
}

return view.extend({
	callServiceList: rpc.declare({
		object: 'service',
		method: 'list',
		params: ['name'],
		expect: { '': {} }
	}),

	callRcList: rpc.declare({
		object: 'rc',
		method: 'list',
		expect: { '': {} }
	}),

	callRcInit: rpc.declare({
		object: 'rc',
		method: 'init',
		params: ['name', 'action']
	}),

	callDaemonInfo: rpc.declare({
		object: 'weechat',
		method: 'get_daemon_info',
		expect: { '': {} }
	}),

	callEnableService: rpc.declare({
		object: 'weechat',
		method: 'enable_service',
		expect: { success: false }
	}),

	/*
	 * The init script only starts WeeChat with option enabled '1'. Let the
	 * backend commit just that option, uci.apply() would apply every change
	 * staged in this session, for any config.
	 */
	ensureEnabled: function() {
		if (uci.get('weechat', 'weechat', 'enabled') === '1')
			return Promise.resolve();

		return this.callEnableService().then(function(success) {
			if (!success)
				throw new Error(_('Could not enable the service in /etc/config/weechat'));

			var cell = document.getElementById('weechat-service-enabled');
			if (cell) {
				while (cell.firstChild)
					cell.removeChild(cell.firstChild);
				renderEnabledState(true).forEach(function(node) { cell.appendChild(node); });
			}

			uci.unload('weechat');
			return uci.load('weechat');
		});
	},

	load: function() {
		return Promise.all([
			uci.load('weechat'),
			this.callServiceList('weechat'),
			this.callRcList(),
			L.resolveDefault(this.callDaemonInfo(), {})
		]);
	},

	handleServiceAction: function(statusBadge, pidLabel, btnStart, btnRestart, btnStop, isReadonly, action) {
		btnStart.disabled = true;
		btnRestart.disabled = true;
		btnStop.disabled = true;

		var ensureEnabled = (action === 'start') ? this.ensureEnabled() : Promise.resolve();

		return ensureEnabled.then(L.bind(function() {
			return this.callRcInit('weechat', action);
		}, this)).then(L.bind(function(ret) {
			if (ret)
				throw new Error(_('Command failed with return code %d').format(ret));

			return new Promise(function(resolve) {
				window.setTimeout(resolve, 1000);
			});
		}, this)).then(L.bind(function() {
			return this.updateServiceStatus(statusBadge, pidLabel, btnStart, btnRestart, btnStop, isReadonly);
		}, this)).catch(function(e) {
			ui.addNotification(null, E('p', _('Failed to execute "/etc/init.d/weechat %s": %s').format(action, e.message || e)));
		});
	},

	handleToggleAutostart: function(enable, autostartBadge, autostartBtn, isReadonly, ev) {
		var action = enable ? 'enable' : 'disable';
		autostartBtn.disabled = true;

		var prepare = enable ? this.ensureEnabled() : Promise.resolve();

		return prepare.then(L.bind(function() {
			return this.callRcInit('weechat', action);
		}, this)).then(L.bind(function(ret) {
			if (ret)
				throw new Error(_('Command failed with return code %d').format(ret));

			autostartBadge.className = 'label ' + (enable ? 'success' : '');
			autostartBadge.textContent = enable ? _('Enabled') : _('Disabled');
			autostartBtn.textContent = enable ? _('Disable Autostart') : _('Enable Autostart');
			autostartBtn.disabled = isReadonly ? true : false;
			autostartBtn.onclick = isReadonly ? null : ui.createHandlerFn(this, 'handleToggleAutostart', !enable, autostartBadge, autostartBtn, isReadonly);
		}, this)).catch(function(e) {
			autostartBtn.disabled = false;
			ui.addNotification(null, E('p', _('Failed to execute "/etc/init.d/weechat %s": %s').format(action, e.message || e)));
		});
	},

	updateServiceStatus: function(statusBadge, pidLabel, btnStart, btnRestart, btnStop, isReadonly) {
		return this.callServiceList('weechat').then(function(res) {
			var st = getServiceStatus(res);
			var isRunning = st.running;
			var pid = st.pid;

			statusBadge.className = 'label ' + (isRunning ? 'success' : 'danger');
			statusBadge.textContent = isRunning ? _('Running') : _('Stopped');
			pidLabel.textContent = (isRunning && pid) ? ('PID: ' + pid) : '';

			btnStart.disabled = (isRunning || isReadonly);
			btnRestart.disabled = (!isRunning || isReadonly);
			btnStop.disabled = (!isRunning || isReadonly);
		});
	},

	render: function(data) {
		var serviceData = data[1] || {},
		    rcData = data[2] || {},
		    daemonInfo = data[3] || {},
		    isReadonly = !L.hasViewPermission(),
		    st = getServiceStatus(serviceData),
		    isRunning = st.running,
		    pid = st.pid,
		    isAutostart = !!(rcData && rcData.weechat && rcData.weechat.enabled),
		    isEnabled = (uci.get('weechat', 'weechat', 'enabled') === '1'),
		    version = (daemonInfo && daemonInfo.version) ? daemonInfo.version : '-';

		var statusBadge = E('span', {
			'class': 'label ' + (isRunning ? 'success' : 'danger'),
			'style': 'padding: 4px 10px; font-size: 90%; font-weight: bold; border-radius: 4px;'
		}, isRunning ? _('Running') : _('Stopped'));

		var pidLabel = E('span', {
			'class': 'cbi-value-description',
			'style': 'margin-left: 8px; font-weight: normal;'
		}, (isRunning && pid) ? ('PID: ' + pid) : '');

		var autostartBadge = E('span', {
			'class': 'label ' + (isAutostart ? 'success' : ''),
			'style': 'margin-right: 12px;'
		}, isAutostart ? _('Enabled') : _('Disabled'));

		var autostartBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'disabled': isReadonly ? 'disabled' : null
		}, isAutostart ? _('Disable Autostart') : _('Enable Autostart'));

		if (!isReadonly) {
			autostartBtn.onclick = ui.createHandlerFn(this, 'handleToggleAutostart', !isAutostart, autostartBadge, autostartBtn, isReadonly);
		}

		var btnStart = E('button', {
			'class': 'btn cbi-button cbi-button-action weechat-btn-control',
			'disabled': (isRunning || isReadonly) ? 'disabled' : null
		}, _('Start'));

		var btnRestart = E('button', {
			'class': 'btn cbi-button cbi-button-reload weechat-btn-control',
			'disabled': (!isRunning || isReadonly) ? 'disabled' : null
		}, _('Restart'));

		var btnStop = E('button', {
			'class': 'btn cbi-button cbi-button-negative weechat-btn-control',
			'disabled': (!isRunning || isReadonly) ? 'disabled' : null
		}, _('Stop'));

		if (!isReadonly) {
			btnStart.addEventListener('click',
				ui.createHandlerFn(this, 'handleServiceAction',
					statusBadge, pidLabel, btnStart, btnRestart, btnStop, isReadonly, 'start'));
			btnRestart.addEventListener('click',
				ui.createHandlerFn(this, 'handleServiceAction',
					statusBadge, pidLabel, btnStart, btnRestart, btnStop, isReadonly, 'restart'));
			btnStop.addEventListener('click',
				ui.createHandlerFn(this, 'handleServiceAction',
					statusBadge, pidLabel, btnStart, btnRestart, btnStop, isReadonly, 'stop'));
		}

		var relayEnabled = (uci.get('weechat', 'weechat', 'relay_enabled') === '1'),
		    relayPort = uci.get('weechat', 'weechat', 'relay_port') || '9000',
		    relayTls = (uci.get('weechat', 'weechat', 'relay_tls') === '1');

		var servers = uci.sections('weechat', 'server'),
		    enabledCount = 0;

		servers.forEach(function(srv) {
			if (srv.enabled !== '0' && srv.enabled !== false && srv.enabled !== 'off')
				enabledCount++;
		});

		var relayStatusNode;
		if (relayEnabled) {
			var clientBtn = E('a', {
				'class': 'btn cbi-button cbi-button-neutral',
				'href': 'https://www.glowing-bear.org/',
				'target': '_blank',
				'rel': 'noreferrer noopener',
				'style': 'display: inline-block; margin-top: 6px;'
			}, [ _('Open Web Client (Hosted)'), ' ↗' ]);

			relayStatusNode = E('div', {}, [
				E('div', {}, [
					E('span', { 'class': 'label success' }, _('Enabled'))
				]),
				E('div', { 'class': 'cbi-value-description', 'style': 'margin-top: 4px;' },
					_('Port %s · TLS %s').format(relayPort, relayTls ? _('enabled') : _('disabled'))),
				E('div', { 'style': 'margin-top: 6px;' }, clientBtn)
			]);
		} else {
			relayStatusNode = E('div', {}, [
				E('span', { 'class': 'label' }, _('Disabled'))
			]);
		}

		var ircStatusNode = E('div', {}, [
			E('span', {},
				_('%d configured · %d enabled').format(servers.length, enabledCount))
		]);

		var serverRows = [];
		if (servers.length === 0) {
			serverRows.push(E('tr', { 'class': 'tr cbi-section-table-row' }, [
				E('td', { 'colspan': 8, 'class': 'td cbi-section-table-cell center' },
					_('No IRC servers configured. Go to Servers tab to add one.'))
			]));
		} else {
			servers.forEach(function(s) {
				var isSrvEnabled = (s.enabled !== '0' && s.enabled !== false && s.enabled !== 'off');
				var isSrvSsl = (s.ssl !== '0' && s.ssl !== false && s.ssl !== 'off');
				var parsed = weechatTools.parseAutoJoin(s.autojoin);
				var chans = parsed.channels;

				var chanNodes = [];
				if (chans.length > 0) {
					chans.forEach(function(chan) {
						chanNodes.push(E('code', {
							'style': 'margin: 2px 4px 2px 0; display: inline-block; padding: 2px 6px; border-radius: 3px;'
						}, chan));
					});
				} else {
					chanNodes.push(E('em', { 'class': 'cbi-value-description' }, _('no channels')));
				}

				serverRows.push(E('tr', { 'class': 'tr cbi-section-table-row' }, [
					E('td', { 'class': 'td cbi-section-table-cell' },
						isSrvEnabled
							? E('span', { 'class': 'label success' }, _('Enabled'))
							: E('span', { 'class': 'label' }, _('Disabled'))),
					E('td', { 'class': 'td cbi-section-table-cell' }, E('strong', {}, s['.name'])),
					E('td', { 'class': 'td cbi-section-table-cell' }, s.address || '-'),
					E('td', { 'class': 'td cbi-section-table-cell' }, s.port || '6697'),
					E('td', { 'class': 'td cbi-section-table-cell' }, isSrvSsl ? _('Yes') : _('No')),
					E('td', { 'class': 'td cbi-section-table-cell' }, s.nicks || s.username || '-'),
					E('td', { 'class': 'td cbi-section-table-cell' }, chanNodes),
					E('td', { 'class': 'td cbi-section-table-cell cbi-section-actions', 'style': 'text-align: right; white-space: nowrap;' }, [
						E('a', {
							'class': 'btn cbi-button cbi-button-edit',
							'href': L.url('admin/services/weechat/servers') + '?server=' + encodeURIComponent(s['.name']) + '#edit=' + encodeURIComponent(s['.name']),
							'title': _('Edit server'),
							'aria-label': _('Edit server')
						}, '✎')
					])
				]));
			});
		}

		poll.add(L.bind(function() {
			return this.updateServiceStatus(statusBadge, pidLabel, btnStart, btnRestart, btnStop, isReadonly);
		}, this), 5);

		return E('div', { 'class': 'cbi-map' }, [
			E('link', { 'rel': 'stylesheet', 'href': L.resource('view/weechat/weechat.css') }),

			E('h2', {}, _('WeeChat - Status')),
			E('div', { 'class': 'cbi-map-descr' },
				_('WeeChat runs as a headless daemon on your router. It keeps you connected to IRC networks and exposes a secure Relay API for web or mobile clients.')),

			/* Two cards grid */
			E('div', { 'class': 'weechat-status-grid' }, [
				/* Card 1: Service Status */
				E('div', { 'class': 'weechat-panel' }, [
					E('h3', {}, _('Service Status')),
					E('table', {}, [
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left', 'style': 'width: 35%;' }, _('WeeChat Daemon')),
							E('td', { 'class': 'td left' }, [ statusBadge, pidLabel ])
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Version')),
							E('td', { 'class': 'td left' }, E('span', {}, version))
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Service enabled')),
							E('td', { 'class': 'td left', 'id': 'weechat-service-enabled' }, renderEnabledState(isEnabled))
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Autostart at boot')),
							E('td', { 'class': 'td left' }, [ autostartBadge, autostartBtn ])
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('Service control')),
							E('td', { 'class': 'td left' }, [ btnStart, btnRestart, btnStop ])
						])
					])
				]),

				/* Card 2: Overview */
				E('div', { 'class': 'weechat-panel' }, [
					E('h3', {}, _('Overview')),
					E('table', {}, [
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left', 'style': 'width: 30%;' }, _('Relay server')),
							E('td', { 'class': 'td left' }, relayStatusNode)
						]),
						E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td left' }, _('IRC servers')),
							E('td', { 'class': 'td left' }, ircStatusNode)
						])
					])
				])
			]),

			/* Configured IRC Servers Table */
			E('div', { 'class': 'weechat-servers-panel' }, [
				E('h3', {}, _('Configured IRC Servers')),
				E('table', { 'class': 'table cbi-section-table' }, [
					E('tr', { 'class': 'tr cbi-section-table-titles' }, [
						E('th', { 'class': 'th cbi-section-table-cell', 'style': 'width: 10%; white-space: nowrap;' }, _('Status')),
						E('th', { 'class': 'th cbi-section-table-cell', 'style': 'width: 12%; white-space: nowrap;' }, _('Server')),
						E('th', { 'class': 'th cbi-section-table-cell', 'style': 'width: 20%; white-space: nowrap;' }, _('Hostname')),
						E('th', { 'class': 'th cbi-section-table-cell', 'style': 'width: 7%; white-space: nowrap;' }, _('Port')),
						E('th', { 'class': 'th cbi-section-table-cell', 'style': 'width: 7%; white-space: nowrap;' }, _('TLS')),
						E('th', { 'class': 'th cbi-section-table-cell', 'style': 'width: 13%; white-space: nowrap;' }, _('Nicknames')),
						E('th', { 'class': 'th cbi-section-table-cell', 'style': 'width: 26%;' }, _('Channels')),
						E('th', { 'class': 'th cbi-section-table-cell cbi-section-actions', 'style': 'width: 5%; text-align: right;' }, '')
					])
				].concat(serverRows))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
