'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require network';

return view.extend({
	handleCommand(exec, args) {
		const buttons = document.querySelectorAll('.diag-action > .cbi-button');
		const out = document.querySelector('textarea');

		for (const button of buttons)
			button.setAttribute('disabled', 'true');

		return fs.exec_direct(exec, args, 'text', false, true, (ev) => {
			out.textContent = ev.target.response;
		}).then((res) =>  {
			out.textContent = res;
		}).catch((err) =>  {
			ui.addNotification(null, E('p', [ err ]))
		}).finally(() => {
			for (const button of buttons)
				button.removeAttribute('disabled');
		});
	},

	handlePing(ev, cmd) {
		const exec = cmd || 'ping';
		const addr = ev.currentTarget.parentNode.previousSibling.value;
		const args = (exec == 'ping') ? [ '-4', '-c', '5', '-W', '1', addr ] : [ '-6', '-c', '5', addr ];

		return this.handleCommand(exec, args);
	},

	handleTraceroute(ev, cmd) {
		const exec = cmd || 'traceroute';
		const addr = ev.currentTarget.parentNode.previousSibling.value;
		const args = (exec == 'traceroute') ? [ '-4', '-q', '1', '-w', '1', '-n', '-m', String(L.env.rpctimeout || 20), addr ] : [ '-q', '1', '-w', '2', '-n', addr ];

		return this.handleCommand(exec, args);
	},

	handleNslookup(ev, cmd) {
		const addr = ev.currentTarget.parentNode.previousSibling.value;

		return this.handleCommand('nslookup', [ addr ]);
	},

	handleArpScan(ev, cmd) {
		const addr = ev.currentTarget.parentNode.previousSibling.value;

		return this.handleCommand('arp-scan', [ '-l', '-I', addr ]);
	},

	load() {
		return Promise.all([
			L.resolveDefault(fs.stat('/bin/ping6') || fs.stat('/usr/bin/ping6'), false),
			L.resolveDefault(fs.stat('/bin/traceroute6') || fs.stat('/usr/bin/traceroute6'), false),
			L.resolveDefault(fs.stat('/usr/bin/arp-scan'), false),
			network.getDevices(),
			uci.load('luci')
		]);
	},

	render([has_ping6, has_traceroute6, has_arpscan, devices]) {
		const dns_host = uci.get('luci', 'diag', 'dns') || 'openwrt.org';
		const ping_host = uci.get('luci', 'diag', 'ping') || 'openwrt.org';
		const route_host = uci.get('luci', 'diag', 'route') || 'openwrt.org';

		const table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', 'style': 'overflow:initial' }, [
						E('input', {
							'style': 'margin:5px 0',
							'type': 'text',
							'value': ping_host
						}),
						E('span', { 'class': 'diag-action' }, [
							has_ping6 ? new ui.ComboButton('ping', {
								'ping': '%s %s'.format(_('IPv4'), _('Ping')),
								'ping6': '%s %s'.format(_('IPv6'), _('Ping')),
							}, {
								'click': ui.createHandlerFn(this, 'handlePing'),
								'classes': {
									'ping': 'btn cbi-button cbi-button-action',
									'ping6': 'btn cbi-button cbi-button-action'
								}
							}).render() : E('button', {
								'class': 'cbi-button cbi-button-action',
								'click': ui.createHandlerFn(this, 'handlePing')
							}, [ _('Ping') ])
						])
					]),

					E('td', { 'class': 'td left', 'style': 'overflow:initial' }, [
						E('input', {
							'style': 'margin:5px 0',
							'type': 'text',
							'value': route_host
						}),
						E('span', { 'class': 'diag-action' }, [
							has_traceroute6 ? new ui.ComboButton('traceroute', {
								'traceroute': '%s %s'.format(_('IPv4'), _('Traceroute')),
								'traceroute6': '%s %s'.format(_('IPv6'), _('Traceroute')),
							}, {
								'click': ui.createHandlerFn(this, 'handleTraceroute'),
								'classes': {
									'traceroute': 'btn cbi-button cbi-button-action',
									'traceroute6': 'btn cbi-button cbi-button-action'
								}
							}).render() : E('button', {
								'class': 'cbi-button cbi-button-action',
								'click': ui.createHandlerFn(this, 'handleTraceroute')
							}, [ _('Traceroute') ])
						])
					]),

					E('td', { 'class': 'td left' }, [
						E('input', {
							'style': 'margin:5px 0',
							'type': 'text',
							'value': dns_host
						}),
						E('span', { 'class': 'diag-action' }, [
							E('button', {
								'class': 'cbi-button cbi-button-action',
								'click': ui.createHandlerFn(this, 'handleNslookup')
							}, [ _('Nslookup') ])
						])
					]),

					has_arpscan ? E('td', { 'class': 'td left' }, [
						E('select', {
							'style': 'margin:5px 0'
						}, devices.map((device) => {
							if (!device.isUp())
								return E([]);

							return E('option', { 'value': device.getName() }, [ device.getI18n() ]);
						})),
						E('span', { 'class': 'diag-action' }, [
							E('button', {
								'class': 'cbi-button cbi-button-action',
								'click': ui.createHandlerFn(this, 'handleArpScan')
							}, [ _('Arp-scan') ])
						])
					]) : E([]),
				])
			]);

		const view = E('div', { 'class': 'cbi-map'}, [
			E('h2', {}, [ _('Diagnostics') ]),
			E('div', { 'class': 'cbi-map-descr'}, _('Execution of various network commands to check the connection and name resolution to other systems.')),
			table,
			E('div', {'class': 'cbi-section'}, [
				E('div', { 'id' : 'command-output'},
					E('textarea', {
						'id': 'widget.command-output',
						'style': 'width: 100%; font-family:monospace; white-space:pre',
						'readonly': true,
						'wrap': 'off',
						'rows': '20'
					})
				)
			])
		]);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
