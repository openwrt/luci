'use strict';
'require baseclass';
'require fs';
'require rpc';
'require network';
'require uci';

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

var callGetUnixtime = rpc.declare({
	object: 'luci',
	method: 'getUnixtime',
	expect: { result: 0 }
});

return baseclass.extend({

	params: [],

	load() {
		return Promise.all([
			network.getWANNetworks(),
			network.getWAN6Networks(),
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(callGetUnixtime(), 0),
			uci.load('system')
		]);
	},

	renderRow(title, value, className = '', tag = 'p') {
		return E(tag, { 'class': 'mt-2' }, [
			E('span', {}, [ title + '：' ]),
			E('span', { 'class': className }, [ value ])
		]);
	},

	renderArrayAsTable(title, values) {
		const table = E('table', { 'class': 'table' });

		if (Array.isArray(values) && values.length > 0) {
			values.forEach((val) => {
				table.appendChild(E('tr', {}, [
					E('td', {}, [ title + '：' ]),
					E('td', {}, [ val ])
				]));
			});
		} else {
			table.appendChild(E('tr', {}, [
				E('td', {}, [ title + '：' ]),
				E('td', {}, [ '-' ])
			]));
		}

		return table;
	},

	renderHtml(data, type) {

		let icon = type;
		const title = 'router' == type ? _('System') : _('Internet');
		const container_wapper = E('div', { 'class': type + '-status-self dashboard-bg box-s1'});
		const container_box = E('div', { 'class': type + '-status-info'});
		const container_item = E('div', { 'class': 'settings-info'});

		if ('internet' == type) {
			icon = (data.v4.connected.value || data.v6.connected.value) ? type : 'not-internet';
		}

		container_box.appendChild(E('div', { 'class': 'title'}, [
			E('img', {
				'src': L.resource('view/dashboard/icons/' + icon + '.svg'),
				'width': 'router' == type ? 64 : 54,
				'title': title,
				'class': (type == 'router' || icon == 'not-internet') ? 'middle svgmonotone' : 'middle'
			}),
			E('h3', title)
		]));

		container_box.appendChild(E('hr'));

		if ('internet' == type) {
			const container_internet_v4 = E('div');
			const container_internet_v6 = E('div');

			for(let idx in data) {

				for(let ver in data[idx]) {
					let classname = ver;
					const visible = data[idx][ver].visible;

					if('connected' === ver) {
						classname = data[idx][ver].value ? 'label label-success' : 'label label-danger';
						data[idx][ver].value = data[idx][ver].value ? _('yes') : _('no');
					}

					if ('v4' === idx) {

						if ('title' === ver) {
							container_internet_v4.appendChild(
								E('p', { 'class': 'mt-2'}, [
									E('span', {'class': ''}, [ data[idx].title ]),
								])
							);
							continue;
						}

						if ('addrsv4' === ver) {
							const addrs = data[idx][ver].value;
							if(Array.isArray(addrs) && addrs.length) {
								for(let ip in addrs) {
									data[idx][ver].value = addrs[ip].split('/')[0];
								}
							}
						}

						if (visible) {
							if (['dnsv4'].includes(ver) && Array.isArray(data[idx][ver].value)) {
								container_internet_v4.appendChild(this.renderArrayAsTable(data[idx][ver].title, data[idx][ver].value));
							} else {
								container_internet_v4.appendChild(this.renderRow(data[idx][ver].title, data[idx][ver].value, classname));
							}
						}

					} else {

						if ('title' === ver) {
							container_internet_v6.appendChild(
								E('p', { 'class': 'mt-2'}, [
									E('span', {'class': ''}, [ data[idx].title ]),
								])
							);
							continue;
						}

						if (visible) {
							if (['dnsv6'].includes(ver) && Array.isArray(data[idx][ver].value)) {
								container_internet_v6.appendChild(this.renderArrayAsTable(data[idx][ver].title, data[idx][ver].value));
							} else {
								container_internet_v6.appendChild(this.renderRow(data[idx][ver].title, data[idx][ver].value, classname));
							}
						}
					}
				}
			}

			container_item.appendChild(container_internet_v4);
			container_item.appendChild(container_internet_v6);
		} else {
			for(let idx in data) {
				container_item.appendChild(
					E('p', { 'class': 'mt-2'}, [
						E('span', {'class': ''}, [ data[idx].title + '：' ]),
						E('span', {'class': ''}, [ data[idx].value ])
					])
				);
			}
		}

		container_box.appendChild(container_item);
		container_box.appendChild(E('hr'));
		container_wapper.appendChild(container_box);
		return container_wapper;
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
					visible: false,
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

		return this.renderHtml(this.params.internet, 'internet');
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

		return this.renderHtml(this.params.router, 'router');
	},

	render(data) {
		return [this.renderInternetBox(data), this.renderRouterBox(data)];
	}
});
