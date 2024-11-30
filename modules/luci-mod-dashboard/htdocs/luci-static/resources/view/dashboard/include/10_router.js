'use strict';
'require baseclass';
'require fs';
'require rpc';
'require network';

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

return baseclass.extend({

	params: [],

	load: function() {
		return Promise.all([
			network.getWANNetworks(),
			network.getWAN6Networks(),
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {})
		]);
	},

	renderHtml: function(data, type) {

		var icon = type;
		var title = 'router' == type ? _('System') : _('Internet');
		var container_wapper = E('div', { 'class': type + '-status-self dashboard-bg box-s1'});
		var container_box = E('div', { 'class': type + '-status-info'});
		var container_item = E('div', { 'class': 'settings-info'});

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
			var container_internet_v4 = E('div');
			var container_internet_v6 = E('div');

			for(var idx in data) {

				for(var ver in data[idx]) {
					var classname = ver,
						suppelements = '',
						visible = data[idx][ver].visible;

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
							var addrs = data[idx][ver].value;
							if(Array.isArray(addrs) && addrs.length) {
								for(var ip in addrs) {
									data[idx][ver].value = addrs[ip].split('/')[0];
								}
							}
						}

						if (visible) {
							container_internet_v4.appendChild(
								E('p', { 'class': 'mt-2'}, [
									E('span', {'class': ''}, [ data[idx][ver].title + '：' ]),
									E('span', {'class': classname }, [ data[idx][ver].value ]),
									suppelements
								])
							);
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
							container_internet_v6.appendChild(
								E('p', {'class': 'mt-2'}, [
									E('span', {'class': ''}, [data[idx][ver].title + '：']),
									E('span', {'class': classname}, [data[idx][ver].value]),
									suppelements
								])
							);
						}
					}
				}
			}

			container_item.appendChild(container_internet_v4);
			container_item.appendChild(container_internet_v6);
		} else {
			for(var idx in data) {
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

	renderUpdateWanData: function(data, v6) {

		var min_metric = 2000000000;
		var min_metric_i = 0;
		for (var i = 0; i < data.length; i++) {
			var metric = data[i].getMetric();
			if (metric < min_metric) {
				min_metric = metric;
				min_metric_i = i;
			}
		 }

		var ifc = data[min_metric_i];
		if(ifc){
			if (v6) {
				var uptime = ifc.getUptime();
				this.params.internet.v6.uptime.value = (uptime > 0) ? '%t'.format(uptime) : '-';
				this.params.internet.v6.ipprefixv6.value =  ifc.getIP6Prefix() || '-';
				this.params.internet.v6.gatewayv6.value =  ifc.getGateway6Addr() || '-';
				this.params.internet.v6.protocol.value=  ifc.getI18n() || E('em', _('Not connected'));
				this.params.internet.v6.addrsv6.value = ifc.getIP6Addrs() || [ '-' ];
				this.params.internet.v6.dnsv6.value = ifc.getDNS6Addrs() || [ '-' ];
				this.params.internet.v6.connected.value = ifc.isUp();
			} else {
				var uptime = ifc.getUptime();
				this.params.internet.v4.uptime.value = (uptime > 0) ? '%t'.format(uptime) : '-';
				this.params.internet.v4.protocol.value=  ifc.getI18n() || E('em', _('Not connected'));
				this.params.internet.v4.gatewayv4.value =  ifc.getGatewayAddr() || '0.0.0.0';
				this.params.internet.v4.connected.value = ifc.isUp();
				this.params.internet.v4.addrsv4.value = ifc.getIPAddrs() || [ '-'];
				this.params.internet.v4.dnsv4.value = ifc.getDNSAddrs() || [ '-' ];
			}
		}
	},

	renderInternetBox: function(data) {

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

	renderRouterBox: function(data) {

		var boardinfo   = data[2],
			systeminfo  = data[3];

		var datestr = null;

		if (systeminfo.localtime) {
			var date = new Date(systeminfo.localtime * 1000);

			datestr = '%04d-%02d-%02d %02d:%02d:%02d'.format(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1,
				date.getUTCDate(),
				date.getUTCHours(),
				date.getUTCMinutes(),
				date.getUTCSeconds()
			);
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

	render: function(data) {
		return [this.renderInternetBox(data), this.renderRouterBox(data)];
	}
});
