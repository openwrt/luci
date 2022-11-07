'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require network';

return view.extend({
	handleCommand: function(exec, args) {
		var buttons = document.querySelectorAll('.diag-action > .cbi-button');

		for (var i = 0; i < buttons.length; i++)
			buttons[i].setAttribute('disabled', 'true');

		return fs.exec(exec, args).then(function(res) {
			var out = document.querySelector('textarea');

			dom.content(out, [ res.stdout || '', res.stderr || '' ]);
		}).catch(function(err) {
			ui.addNotification(null, E('p', [ err ]))
		}).finally(function() {
			for (var i = 0; i < buttons.length; i++)
				buttons[i].removeAttribute('disabled');
		});
	},

	handlePing: function(ev, cmd) {
		var exec = cmd || 'ping',
		    addr = ev.currentTarget.parentNode.previousSibling.value,
		    args = (exec == 'ping') ? [ '-4', '-c', '5', '-W', '1', addr ] : [ '-6', '-c', '5', addr ];

		return this.handleCommand(exec, args);
	},

	handleTraceroute: function(ev, cmd) {
		var exec = cmd || 'traceroute',
		    addr = ev.currentTarget.parentNode.previousSibling.value,
		    args = (exec == 'traceroute') ? [ '-4', '-q', '1', '-w', '1', '-n', '-m', String(L.env.rpctimeout || 20), addr ] : [ '-q', '1', '-w', '2', '-n', addr ];

		return this.handleCommand(exec, args);
	},

	handleNslookup: function(ev, cmd) {
		var addr = ev.currentTarget.parentNode.previousSibling.value;

		return this.handleCommand('nslookup', [ addr ]);
	},

	handleArpScan: function(ev, cmd) {
		var addr = ev.currentTarget.parentNode.previousSibling.value;

		return this.handleCommand('arp-scan', [ '-l', '-I', addr ]);
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/bin/ping6'), {}),
			L.resolveDefault(fs.stat('/usr/bin/ping6'), {}),
			L.resolveDefault(fs.stat('/bin/traceroute6'), {}),
			L.resolveDefault(fs.stat('/usr/bin/traceroute6'), {}),
			L.resolveDefault(fs.stat('/usr/bin/arp-scan'), {}),
			network.getDevices(),
			uci.load('luci')
		]);
	},

	render: function(res) {
		var has_ping6 = res[0].path || res[1].path,
		    has_traceroute6 = res[2].path || res[3].path,
		    has_arpscan = res[4].path,
		    devices = res[5],
			dns_host = uci.get('luci', 'diag', 'dns') || 'openwrt.org',
			ping_host = uci.get('luci', 'diag', 'ping') || 'openwrt.org',
			route_host = uci.get('luci', 'diag', 'route') || 'openwrt.org';

		var table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, [
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

					E('td', { 'class': 'td left' }, [
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
						}, devices.map(function(device) {
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

		var view = E('div', { 'class': 'cbi-map'}, [
			E('h2', {}, [ _('Diagnostics') ]),
			E('div', { 'class': 'cbi-map-descr'}, _('Execution of various network commands to check the connection and name resolution to other systems.')),
			table,
			E('div', {'class': 'cbi-section'}, [
				E('div', { 'id' : 'command-output'},
					E('textarea', {
						'id': 'widget.command-output',
						'style': 'width: 100%',
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
