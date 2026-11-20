'use strict';
'require baseclass';
'require fs';
'require rpc';
'require network';
'require uci';
'require view.dashboard.lib.charts as charts';
'require view.dashboard.lib.system as system';

var callGetUnixtime = rpc.declare({
	object: 'luci',
	method: 'getUnixtime',
	expect: { result: 0 }
});

return baseclass.extend({

	params: [],

	widgets: [
		{ id: 'internet', slot: 'cards', title: _('Internet'), order: 10 },
		{ id: 'uptime', slot: 'cards', title: _('Uptime'), order: 15 },
		{ id: 'internet', slot: 'tabs', title: _('Internet'), order: 10 },
		{ id: 'system', slot: 'tabs', title: _('System'), order: 20 }
	],

	load() {
		return Promise.all([
			network.getWANNetworks(),
			network.getWAN6Networks(),
			system.board(),
			system.info(),
			L.resolveDefault(callGetUnixtime(), 0),
			uci.load('system')
		]);
	},

	renderValue(value) {
		if (Array.isArray(value))
			return E('span', {}, value.map(v => E('div', {}, [ v ])));

		return (value == null || value === '') ? '-' : value;
	},

	// Same markup as the status page's system table.
	renderKeyValueTable(rows) {
		return E('table', { 'class': 'table' }, rows.map(row => E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, [ row.title ]),
			E('td', { 'class': 'td left' }, [ this.renderValue(row.value) ])
		])));
	},

	renderInternetColumn(group) {
		const connected = group.connected.value === true;
		const rows = [];

		for (const key in group) {
			if (key == 'title' || key == 'connected' || !group[key].visible)
				continue;

			let value = group[key].value;

			if (/^addrs/.test(key) && Array.isArray(value))
				value = value.map(a => a.split('/')[0]);

			rows.push({ title: group[key].title, value: value });
		}

		return E('div', {}, [
			E('h3', {}, [
				group.title, ' ',
				charts.badge(connected ? _('Connected') : _('Not connected'), connected ? 'success' : 'warning')
			]),
			connected ? this.renderKeyValueTable(rows) : charts.empty(_('Not configured or no address acquired'))
		]);
	},

	renderInternetTab() {
		return E('div', {}, [
			this.renderInternetColumn(this.params.internet.v4),
			this.renderInternetColumn(this.params.internet.v6)
		]);
	},

	renderSystemTab() {
		const rows = [];

		for (const key in this.params.router)
			rows.push({ title: this.params.router[key].title, value: this.params.router[key].value });

		return this.renderKeyValueTable(rows);
	},

	renderInternetKpi() {
		const v4 = this.params.internet.v4;
		const v6 = this.params.internet.v6;
		const connected = (v4.connected.value === true || v6.connected.value === true);
		const address = (family, addrs) => (family.connected.value === true)
			? [ addrs.title, L.toArray(addrs.value)[0]?.split('/')[0] ].filter(part => part != null).join(' · ') : null;

		return charts.kpi({
			icon: connected ? 'internet' : 'not-internet',
			title: _('Internet'),
			value: [ connected ? _('Connected') : _('Not connected') ],
			sub: [ address(v4, v4.addrsv4), address(v6, v6.addrsv6) ],
			stacked: true
		});
	},

	renderSystemKpi() {
		const router = this.params.router;

		return charts.kpi({
			icon: 'router',
			title: router.uptime.title,
			value: [ router.uptime.value || '-' ],
			sub: [ router.model.value || '' ]
		});
	},

	renderUpdateWanData(data, v6) {

		let min_metric = 2000000000;
		let min_metric_i = 0;
		for (let i = 0; i < data.length; i++) {
			const metric = data[i].getMetric();
			if (metric < min_metric) {
				min_metric = metric;
				min_metric_i = i;
			}
		 }

		const ifc = data[min_metric_i];
		if(ifc){
			if (v6) {
				const uptime = ifc.getUptime();
				this.params.internet.v6.uptime.value = (uptime > 0) ? '%t'.format(uptime) : '-';
				this.params.internet.v6.ipprefixv6.value =  ifc.getIP6Prefix() || '-';
				this.params.internet.v6.gatewayv6.value =  ifc.getGateway6Addr() || '-';
				this.params.internet.v6.protocol.value=  ifc.getI18n() || E('em', _('Not connected'));
				this.params.internet.v6.addrsv6.value = ifc.getIP6Addrs() || [ '-' ];
				this.params.internet.v6.dnsv6.value = ifc.getDNS6Addrs() || [ '-' ];
				this.params.internet.v6.connected.value = ifc.isUp();
			} else {
				const uptime = ifc.getUptime();
				this.params.internet.v4.uptime.value = (uptime > 0) ? '%t'.format(uptime) : '-';
				this.params.internet.v4.protocol.value=  ifc.getI18n() || E('em', _('Not connected'));
				this.params.internet.v4.gatewayv4.value =  ifc.getGatewayAddr() || '0.0.0.0';
				this.params.internet.v4.connected.value = ifc.isUp();
				this.params.internet.v4.addrsv4.value = ifc.getIPAddrs() || [ '-'];
				this.params.internet.v4.dnsv4.value = ifc.getDNSAddrs() || [ '-' ];
			}
		}
	},

	renderInternetBox(data) {

		this.params.internet = {

			v4: {
				title: _('IPv4 Internet'),

				connected: {
					title: _('Connected'),
					visible: true,
					value: false
				},

				uptime: {
					title: _('Uptime'),
					visible: true,
					value: '-'
				},

				protocol: {
					title: _('Protocol'),
					visible: true,
					value: '-'
				},

				addrsv4: {
					title: _('IPv4'),
					visible: true,
					value: [ '-' ]
				},

				gatewayv4: {
					title: _('GatewayV4'),
					visible: true,
					value: '-'
				},

				dnsv4: {
					title: _('DNSv4'),
					visible: true,
					value: ['-']
				}
			},

			v6: {
				title: _('IPv6 Internet'),

				connected: {
					title: _('Connected'),
					visible: true,
					value: false
				},

				uptime: {
					title: _('Uptime'),
					visible: true,
					value: '-'
				},

				protocol: {
					title: _('Protocol'),
					visible: true,
					value: ' - '
				},

				ipprefixv6 : {
					title: _('IPv6 prefix'),
					visible: true,
					value: ' - '
				},

				addrsv6: {
					title: _('IPv6'),
					visible: true,
					value: [ '-' ]
				},

				gatewayv6: {
					title: _('GatewayV6'),
					visible: true,
					value: '-'
				},

				dnsv6: {
					title: _('DNSv6'),
					visible: true,
					value: [ '-' ]
				}
			}
		};

		this.renderUpdateWanData(data[0], false);
		this.renderUpdateWanData(data[1], true);
	},

	renderRouterBox(data) {

		const boardinfo   = data[2];
		const systeminfo  = data[3];
		const unixtime    = data[4];

		let datestr = null;

		if (unixtime) {
			const date = new Date(unixtime * 1000);
			const zn = uci.get('system', '@system[0]', 'zonename')?.replaceAll(' ', '_') || 'UTC';
			const ts = uci.get('system', '@system[0]', 'clock_timestyle') || 0;
			const hc = uci.get('system', '@system[0]', 'clock_hourcycle') || 0;

			datestr = new Intl.DateTimeFormat(undefined, {
				dateStyle: 'medium',
				timeStyle: (ts == 0) ? 'long' : 'full',
				hourCycle: (hc == 0) ? undefined : hc,
				timeZone: zn
			}).format(date);
		}

		this.params.router = {
			uptime: {
				title: _('Uptime'),
				value: systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null,
			},

			localtime: {
				title: _('Local Time'),
				value: datestr
			},

			kernel: {
				title: _('Kernel Version'),
				value: boardinfo.kernel
			},

			model: {
				title: _('Model'),
				value: boardinfo.model
			},

			system: {
				title: _('Architecture'),
				value: boardinfo.system
			},

			release: {
				title: _('Firmware Version'),
				value: boardinfo?.release?.description
			}
		};
	},

	render(data) {
		this.renderInternetBox(data);
		this.renderRouterBox(data);

		return {
			cards: [
				{ id: 'internet', node: () => this.renderInternetKpi() },
				{ id: 'uptime', node: () => this.renderSystemKpi() }
			],
			tabs: [
				{ id: 'internet', title: _('Internet'), content: () => this.renderInternetTab() },
				{ id: 'system', title: _('System'), content: () => this.renderSystemTab() }
			]
		};
	}
});
