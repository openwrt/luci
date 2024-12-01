'use strict';
'require view';
'require network';
'require request';
'require fs';
'require ui';
'require rpc';
'require dom';

const callNetworkRrdnsLookup = rpc.declare({
	object: 'network.rrdns',
	method: 'lookup',
	params: [ 'addrs', 'timeout', 'limit' ],
	expect: { '': {} }
});

var chartRegistry = {},
	trafficPeriods = [],
	trafficData = { columns: [], data: [] },
	hostNames = {},
	hostInfo = {},
	ouiData = [];

return view.extend({
	load: function() {
		return Promise.all([
			this.loadHosts(),
			this.loadPeriods(),
			this.loadData(),
			this.loadOUI()
		]);
	},

	loadHosts: function() {
		return L.resolveDefault(network.getHostHints()).then(function(res) {
			if (res) {
				var hints = res.getMACHints();

				for (var i = 0; i < hints.length; i++) {
					hostInfo[hints[i][0]] = {
						name: res.getHostnameByMACAddr(hints[i][0]),
						ipv6: res.getIP6AddrByMACAddr(hints[i][0]),
						ipv4: res.getIPAddrByMACAddr(hints[i][0])
					};
				}
			}
		});
	},

	loadOUI: function() {
		var url = 'https://raw.githubusercontent.com/jow-/oui-database/master/oui.json';

		return L.resolveDefault(request.get(url, { cache: true })).then(function(res) {
			res = res ? res.json() : [];

			if (Array.isArray(res))
				ouiData = res;
		});
	},

	loadPeriods: function() {
		return L.resolveDefault(fs.exec_direct('/usr/libexec/nlbwmon-action', [ 'periods' ], 'json')).then(function(res) {
			if (L.isObject(res) && Array.isArray(res.periods))
				trafficPeriods = res.periods;
		});
	},

	loadData: function(period) {
		var args = [ 'download', '-g', 'family,mac,ip,layer7', '-o', '-rx_bytes,-tx_bytes' ];

		if (period)
			args.push('-t', period);

		return fs.exec_direct('/usr/libexec/nlbwmon-action', args, 'json').then(L.bind(function(res) {
			if (!L.isObject(res) || !Array.isArray(res.columns) || !Array.isArray(res.data))
				throw new Error(_('Malformed data received'));

			trafficData = res;

			var addrs = this.query(null, [ 'ip' ], null),
			    ipAddrs = [];

			for (var i = 0; i < addrs.length; i++)
				if (ipAddrs.indexOf(addrs[i].ip) < 0)
					ipAddrs.push(addrs[i].ip);

			if (ipAddrs.length)
				return L.resolveDefault(callNetworkRrdnsLookup(ipAddrs, 1000, 1000), {}).then(function(res) {
					hostNames = res;
				});
		}, this)).catch(function(err) {
			ui.addNotification(null, _('Unable to fetch traffic statistic data: %s').format(err.message));
		});
	},

	off: function(elem) {
		var val = [0, 0];
		do {
			if (!isNaN(elem.offsetLeft) && !isNaN(elem.offsetTop)) {
				val[0] += elem.offsetLeft;
				val[1] += elem.offsetTop;
			}
		}
		while ((elem = elem.offsetParent) != null);
		return val;
	},

	kpi: function(id, val1, val2, val3) {
		var e = L.dom.elem(id) ? id : document.getElementById(id);

		if (val1 && val2 && val3)
			e.innerHTML = _('%s, %s and %s').format(val1, val2, val3);
		else if (val1 && val2)
			e.innerHTML = _('%s and %s').format(val1, val2);
		else if (val1)
			e.innerHTML = val1;

		e.parentNode.style.display = val1 ? 'list-item' : '';
	},

	pie: function(id, data) {
		var total = data.reduce(function(n, d) { return n + d.value }, 0);

		data.sort(function(a, b) { return b.value - a.value });

		if (total === 0)
			data = [{
				value: 1,
				color: '#cccccc',
				label: [ _('no traffic') ]
			}];

		for (var i = 0; i < data.length; i++) {
			if (!data[i].color) {
				var hue = 120 / (data.length-1) * i;
				data[i].color = 'hsl(%u, 80%%, 50%%)'.format(hue);
				data[i].label.push(hue);
			}
		}

		var node = L.dom.elem(id) ? id : document.getElementById(id),
		    key = L.dom.elem(id) ? id.id : id,
		    ctx = node.getContext('2d');

		if (chartRegistry.hasOwnProperty(key))
			chartRegistry[key].destroy();

		chartRegistry[key] = new Chart(ctx).Doughnut(data, {
			segmentStrokeWidth: 1,
			percentageInnerCutout: 30
		});

		return chartRegistry[key];
	},

	oui: function(mac) {
		var m, l = 0, r = ouiData.length / 3 - 1;
		var mac1 = parseInt(mac.replace(/[^a-fA-F0-9]/g, ''), 16);

		while (l <= r) {
			m = l + Math.floor((r - l) / 2);

			var mask = (0xffffffffffff -
						(Math.pow(2, 48 - ouiData[m * 3 + 1]) - 1));

			var mac1_hi = ((mac1 / 0x10000) & (mask / 0x10000)) >>> 0;
			var mac1_lo = ((mac1 &  0xffff) & (mask &  0xffff)) >>> 0;

			var mac2 = parseInt(ouiData[m * 3], 16);
			var mac2_hi = (mac2 / 0x10000) >>> 0;
			var mac2_lo = (mac2 &  0xffff) >>> 0;

			if (mac1_hi === mac2_hi && mac1_lo === mac2_lo)
				return ouiData[m * 3 + 2];

			if (mac2_hi > mac1_hi ||
				(mac2_hi === mac1_hi && mac2_lo > mac1_lo))
				r = m - 1;
			else
				l = m + 1;
		}

		return null;
	},

	query: function(filter, group, order) {
		var keys = [], columns = {}, records = {}, result = [];

		if (typeof(group) !== 'function' && typeof(group) !== 'object')
			group = ['mac'];

		for (var i = 0; i < trafficData.columns.length; i++)
			columns[trafficData.columns[i]] = i;

		for (var i = 0; i < trafficData.data.length; i++) {
			var record = trafficData.data[i];

			if (typeof(filter) === 'function' && filter(columns, record) !== true)
				continue;

			var key;

			if (typeof(group) === 'function') {
				key = group(columns, record);
			}
			else {
				key = [];

				for (var j = 0; j < group.length; j++)
					if (columns.hasOwnProperty(group[j]))
						key.push(record[columns[group[j]]]);

				key = key.join(',');
			}

			if (!records.hasOwnProperty(key)) {
				var rec = {};

				for (var col in columns)
					rec[col] = record[columns[col]];

				records[key] = rec;
				result.push(rec);
			}
			else {
				records[key].conns    += record[columns.conns];
				records[key].rx_bytes += record[columns.rx_bytes];
				records[key].rx_pkts  += record[columns.rx_pkts];
				records[key].tx_bytes += record[columns.tx_bytes];
				records[key].tx_pkts  += record[columns.tx_pkts];
			}
		}

		if (typeof(order) === 'function')
			result.sort(order);

		return result;
	},

	renderPeriods: function() {
		if (!trafficPeriods.length)
			return E([]);

		var choices = {},
		    keys = [];

		for (var e, i = trafficPeriods.length - 1; e = trafficPeriods[i]; i--) {
			var ymd1 = e.split(/-/);
			var d1 = new Date(+ymd1[0], +ymd1[1] - 1, +ymd1[2]);
			var ymd2, d2, pd;

			if (i) {
				ymd2 = trafficPeriods[i - 1].split(/-/);
				d2 = new Date(+ymd2[0], +ymd2[1] - 1, +ymd2[2]);
				d2.setDate(d2.getDate() - 1);
				pd = e;
			}
			else {
				d2 = new Date();
				pd = '-';
			}

			keys.push(pd);
			choices[pd] = '%04d-%02d-%02d - %04d-%02d-%02d'.format(
				d1.getFullYear(), d1.getMonth() + 1, d1.getDate(),
				d2.getFullYear(), d2.getMonth() + 1, d2.getDate()
			);
		}

		var dropdown = new ui.Dropdown('-', choices, { sort: keys, optional: false }).render();

		dropdown.addEventListener('cbi-dropdown-change', ui.createHandlerFn(this, function(ev) {
			ui.hideTooltip(ev);

			var period = ev.detail.value.value != '-' ? ev.detail.value.value : null;

			return this.loadData(period).then(L.bind(function() {
				this.renderHostData();
				this.renderLayer7Data();
				this.renderIPv6Data();
			}, this));
		}));

		return E([], [
			E('p', [ _('Select accounting period:'), ' ', dropdown ]),
			E('hr')
		]);
	},

	formatHostname: function(dns) {
		if (dns === undefined || dns === null || dns === '')
			return '-';

		dns = dns.split('.')[0];

		if (dns.length > 12)
			return '<span title="%q">%h…</span>'.format(dns, dns.substr(0, 12));

		return '%h'.format(dns);
	},

	renderHostData: function() {
		var trafData = [], connData = [];
		var rx_total = 0, tx_total = 0, conn_total = 0;

		var hostData = this.query(
			function(c, r) {
				return (r[c.rx_bytes] > 0 || r[c.tx_bytes] > 0);
			},
			['mac'],
			//function(c, r) {
			//	return (r[c.mac] !== '00:00:00:00:00:00') ? r[c.mac] : r[c.ip];
			//},
			function(r1, r2) {
				return ((r2.rx_bytes + r2.tx_bytes) - (r1.rx_bytes + r1.tx_bytes));
			}
		);

		var rows = [];

		for (var i = 0; i < hostData.length; i++) {
			var rec = hostData[i],
			    mac = rec.mac.toUpperCase(),
			    key = (mac !== '00:00:00:00:00:00') ? mac : rec.ip,
			    dns = hostInfo[mac] ? hostInfo[mac].name : null;

			var cell = E('div', this.formatHostname(dns));

			rows.push([
				cell,
				E('a', {
					'href':         '#' + rec.mac,
					'data-col':     'ip',
					'data-tooltip': _('Source IP')
				}, (mac !== '00:00:00:00:00:00') ? mac : _('other')),
				[ rec.conns, E('a', {
					'href':         '#' + rec.mac,
					'data-col':     'layer7',
					'data-tooltip': _('Protocol')
				}, '%1000.2m'.format(rec.conns)) ],
				[ rec.rx_bytes, '%1024.2mB'.format(rec.rx_bytes) ],
				[ rec.rx_pkts,  '%1000.2mP'.format(rec.rx_pkts)  ],
				[ rec.tx_bytes, '%1024.2mB'.format(rec.tx_bytes) ],
				[ rec.tx_pkts,  '%1000.2mP'.format(rec.tx_pkts)  ]
			]);

			trafData.push({
				value: rec.rx_bytes + rec.tx_bytes,
				label: ["%s: %%1024.2mB".format(key), cell]
			});

			connData.push({
				value: rec.conns,
				label: ["%s: %%1000.2m".format(key), cell]
			});

			rx_total += rec.rx_bytes;
			tx_total += rec.tx_bytes;
			conn_total += rec.conns;
		}

		cbi_update_table('#host-data', rows, E('em', _('No data recorded yet.')));

		this.pie('traf-pie', trafData);
		this.pie('conn-pie', connData);

		this.kpi('rx-total', '%1024.2mB'.format(rx_total));
		this.kpi('tx-total', '%1024.2mB'.format(tx_total));
		this.kpi('conn-total', '%1000m'.format(conn_total));
		this.kpi('host-total', '%u'.format(hostData.length));
	},

	renderLayer7Data: function() {
		var rxData = [], txData = [];
		var topConn = [[0],[0],[0]], topRx = [[0],[0],[0]], topTx = [[0],[0],[0]];

		var layer7Data = this.query(
			null, ['layer7'],
			function(r1, r2) {
				return ((r2.rx_bytes + r2.tx_bytes) - (r1.rx_bytes + r1.tx_bytes));
			}
		);

		var rows = [];

		for (var i = 0, c = 0; i < layer7Data.length; i++) {
			var rec = layer7Data[i],
			    cell = E('div', rec.layer7 || _('other'));

			rows.push([
				cell,
				[ rec.conns,    '%1000m'.format(rec.conns)       ],
				[ rec.rx_bytes, '%1024.2mB'.format(rec.rx_bytes) ],
				[ rec.rx_pkts,  '%1000.2mP'.format(rec.rx_pkts)  ],
				[ rec.tx_bytes, '%1024.2mB'.format(rec.tx_bytes) ],
				[ rec.tx_pkts,  '%1000.2mP'.format(rec.tx_pkts)  ]
			]);

			rxData.push({
				value: rec.rx_bytes,
				label: ["%s: %%1024.2mB".format(rec.layer7 || _('other')), cell]
			});

			txData.push({
				value: rec.tx_bytes,
				label: ["%s: %%1024.2mB".format(rec.layer7 || _('other')), cell]
			});

			if (rec.layer7) {
				topRx.push([rec.rx_bytes, rec.layer7]);
				topTx.push([rec.tx_bytes, rec.layer7]);
				topConn.push([rec.conns, rec.layer7]);
			}
		}

		cbi_update_table('#layer7-data', rows, E('em', 	_('No data recorded yet.')));

		this.pie('layer7-rx-pie', rxData);
		this.pie('layer7-tx-pie', txData);

		topRx.sort(function(a, b) { return b[0] - a[0] });
		topTx.sort(function(a, b) { return b[0] - a[0] });
		topConn.sort(function(a, b) { return b[0] - a[0] });

		this.kpi('layer7-total', layer7Data.length);
		this.kpi('layer7-most-rx', topRx[0][1], topRx[1][1], topRx[2][1]);
		this.kpi('layer7-most-tx', topTx[0][1], topTx[1][1], topTx[2][1]);
		this.kpi('layer7-most-conn', topConn[0][1], topConn[1][1], topConn[2][1]);
	},

	renderIPv6Data: function() {
		var col       = { },
		    rx4_total = 0,
		    tx4_total = 0,
		    rx6_total = 0,
		    tx6_total = 0,
		    v4_total  = 0,
		    v6_total  = 0,
		    ds_total  = 0,
		    families  = { },
		    records   = { };

		var ipv6Data = this.query(
			null, ['family', 'mac'],
			function(r1, r2) {
				return ((r2.rx_bytes + r2.tx_bytes) - (r1.rx_bytes + r1.tx_bytes));
			}
		);

		for (var i = 0, c = 0; i < ipv6Data.length; i++) {
			var rec = ipv6Data[i],
			    mac = rec.mac.toUpperCase(),
			    ip  = rec.ip,
			    fam = families[mac] || 0,
			    recs = records[mac] || {};

			if (rec.family == 4) {
				rx4_total += rec.rx_bytes;
				tx4_total += rec.tx_bytes;
				fam |= 1;
			}
			else {
				rx6_total += rec.rx_bytes;
				tx6_total += rec.tx_bytes;
				fam |= 2;
			}

			recs[rec.family] = rec;
			records[mac] = recs;

			families[mac] = fam;
		}

		for (var mac in families) {
			switch (families[mac])
			{
			case 3:
				ds_total++;
				break;

			case 2:
				v6_total++;
				break;

			case 1:
				v4_total++;
				break;
			}
		}

		var rows = [];

		for (var mac in records) {
			if (mac === '00:00:00:00:00:00')
				continue;

			var dns = hostInfo[mac] ? hostInfo[mac].name : null,
			    rec4 = records[mac][4],
			    rec6 = records[mac][6];

			rows.push([
				this.formatHostname(dns),
				mac,
				[
					0,
					E([], [
						E('span', _('IPv4')),
						E('span', _('IPv6'))
					])
				],
				[
					(rec4 ? rec4.rx_bytes : 0) + (rec6 ? rec6.rx_bytes : 0),
					E([], [
						E('span', rec4 ? '%1024.2mB'.format(rec4.rx_bytes) : '-'),
						E('span', rec6 ? '%1024.2mB'.format(rec6.rx_bytes) : '-')
					])
				],
				[
					(rec4 ? rec4.rx_pkts : 0) + (rec6 ? rec6.rx_pkts : 0),
					E([], [
						E('span', rec4 ? '%1000.2mP'.format(rec4.rx_pkts)  : '-'),
						E('span', rec6 ? '%1000.2mP'.format(rec6.rx_pkts)  : '-')
					])
				],
				[
					(rec4 ? rec4.tx_bytes : 0) + (rec6 ? rec6.tx_bytes : 0),
					E([], [
						E('span', rec4 ? '%1024.2mB'.format(rec4.tx_bytes) : '-'),
						E('span', rec6 ? '%1024.2mB'.format(rec6.tx_bytes) : '-')
					])
				],
				[
					(rec4 ? rec4.tx_pkts : 0) + (rec6 ? rec6.tx_pkts : 0),
					E([], [
						E('span', rec4 ? '%1000.2mP'.format(rec4.tx_pkts)  : '-'),
						E('span', rec6 ? '%1000.2mP'.format(rec6.tx_pkts)  : '-')
					])
				]
			]);
		}

		cbi_update_table('#ipv6-data', rows, E('em', _('No data recorded yet.')));

		var shareData = [], hostsData = [];

		if (rx4_total > 0 || tx4_total > 0)
			shareData.push({
				value: rx4_total + tx4_total,
				label: ["IPv4: %1024.2mB"],
				color: 'hsl(140, 100%, 50%)'
		        });

		if (rx6_total > 0 || tx6_total > 0)
			shareData.push({
				value: rx6_total + tx6_total,
				label: ["IPv6: %1024.2mB"],
				color: 'hsl(180, 100%, 50%)'
			});

		if (v4_total > 0)
			hostsData.push({
				value: v4_total,
				label: [_('%d IPv4-only hosts')],
				color: 'hsl(140, 100%, 50%)'
			});

		if (v6_total > 0)
			hostsData.push({
				value: v6_total,
				label: [_('%d IPv6-only hosts')],
				color: 'hsl(180, 100%, 50%)'
			});

		if (ds_total > 0)
			hostsData.push({
				value: ds_total,
				label: [_('%d dual-stack hosts')],
				color: 'hsl(50, 100%, 50%)'
			});

		this.pie('ipv6-share-pie', shareData);
		this.pie('ipv6-hosts-pie', hostsData);

		this.kpi('ipv6-hosts', '%.2f%%'.format(100 / (ds_total + v4_total + v6_total) * (ds_total + v6_total)));
		this.kpi('ipv6-share', '%.2f%%'.format(100 / (rx4_total + rx6_total + tx4_total + tx6_total) * (rx6_total + tx6_total)));
		this.kpi('ipv6-rx', '%1024.2mB'.format(rx6_total));
		this.kpi('ipv6-tx', '%1024.2mB'.format(tx6_total));
	},

	renderHostDetail: function(node, tooltip) {
		var key = node.getAttribute('href').substr(1),
		    col = node.getAttribute('data-col'),
		    label = node.getAttribute('data-tooltip');

		var detailData = this.query(
			function(c, r) {
				return ((r[c.mac] === key || r[c.ip] === key) &&
				        (r[c.rx_bytes] > 0 || r[c.tx_bytes] > 0));
			},
			[col],
			function(r1, r2) {
				return ((r2.rx_bytes + r2.tx_bytes) - (r1.rx_bytes + r1.tx_bytes));
			}
		);

		var rxData = [], txData = [];

		dom.content(tooltip, [
			E('div', { 'class': 'head' }, [
				E('div', { 'class': 'pie' }, [
					E('label', _('Download', 'Traffic counter')),
					E('canvas', { 'id': 'bubble-pie1', 'width': 100, 'height': 100 })
				]),
				E('div', { 'class': 'pie' }, [
					E('label', _('Upload', 'Traffic counter')),
					E('canvas', { 'id': 'bubble-pie2', 'width': 100, 'height': 100 })
				]),
				E('div', { 'class': 'kpi' }, [
					E('ul', [
						E('li', _('Hostname: <big id="bubble-hostname">example.org</big>')),
						E('li', _('Vendor: <big id="bubble-vendor">Example Corp.</big>'))
					])
				])
			]),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, label || col),
					E('th', { 'class': 'th' }, _('Conn.')),
					E('th', { 'class': 'th' }, _('Down. (Bytes)')),
					E('th', { 'class': 'th' }, _('Down. (Pkts.)')),
					E('th', { 'class': 'th' }, _('Up. (Bytes)')),
					E('th', { 'class': 'th' }, _('Up. (Pkts.)')),
				])
			])
		]);

		var rows = [];

		for (var i = 0; i < detailData.length; i++) {
			var rec = detailData[i],
			    cell = E('div', rec[col] || _('other'));

			rows.push([
				cell,
				[ rec.conns,    '%1000.2m'.format(rec.conns)     ],
				[ rec.rx_bytes, '%1024.2mB'.format(rec.rx_bytes) ],
				[ rec.rx_pkts,  '%1000.2mP'.format(rec.rx_pkts)  ],
				[ rec.tx_bytes, '%1024.2mB'.format(rec.tx_bytes) ],
				[ rec.tx_pkts,  '%1000.2mP'.format(rec.tx_pkts)  ]
			]);

			rxData.push({
				label: ['%s: %%1024.2mB'.format(rec[col] || _('other')), cell],
				value: rec.rx_bytes
			});

			txData.push({
				label: ['%s: %%1024.2mB'.format(rec[col] || _('other')), cell],
				value: rec.tx_bytes
			});
		}

		cbi_update_table(tooltip.lastElementChild, rows);

		this.pie(tooltip.querySelector('#bubble-pie1'), rxData);
		this.pie(tooltip.querySelector('#bubble-pie2'), txData);

		var mac = key.toUpperCase();
		var name = hostInfo.hasOwnProperty(mac) ? hostInfo[mac].name : null;

		if (!name)
			for (var i = 0; i < detailData.length; i++)
				if ((name = hostNames[detailData[i].ip]) !== undefined)
					break;

		if (mac !== '00:00:00:00:00:00') {
			this.kpi(tooltip.querySelector('#bubble-hostname'), name);
			this.kpi(tooltip.querySelector('#bubble-vendor'), this.oui(mac));
		}
		else {
			this.kpi(tooltip.querySelector('#bubble-hostname'));
			this.kpi(tooltip.querySelector('#bubble-vendor'));
		}

		var rect = node.getBoundingClientRect(), x, y;

		if ('ontouchstart' in window || window.innerWidth <= 992) {
			var vpHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
			    scrollFrom = window.pageYOffset,
			    scrollTo = scrollFrom + rect.top - vpHeight * 0.5,
			    start = null;

			tooltip.style.top = (rect.top + rect.height + window.pageYOffset) + 'px';
			tooltip.style.left = 0;

			var scrollStep = function(timestamp) {
				if (!start)
					start = timestamp;

				var duration = Math.max(timestamp - start, 1);
				if (duration < 100) {
					document.body.scrollTop = scrollFrom + (scrollTo - scrollFrom) * (duration / 100);
					window.requestAnimationFrame(scrollStep);
				}
				else {
					document.body.scrollTop = scrollTo;
				}
			};

			window.requestAnimationFrame(scrollStep);
		}
		else {
			x = rect.left + rect.width + window.pageXOffset,
		    y = rect.top + window.pageYOffset;

			if ((y + tooltip.offsetHeight) > (window.innerHeight + window.pageYOffset))
				y -= ((y + tooltip.offsetHeight) - (window.innerHeight + window.pageYOffset));

			tooltip.style.top = y + 'px';
			tooltip.style.left = x + 'px';
		}

		return false;
	},

	setupCharts: function() {
		Chart.defaults.global.customTooltips = L.bind(function(tooltip) {
			var tooltipEl = document.getElementById('chartjs-tooltip');

			if (!tooltipEl) {
				tooltipEl = document.createElement('div');
				tooltipEl.setAttribute('id', 'chartjs-tooltip');
				document.body.appendChild(tooltipEl);
			}

			if (!tooltip) {
				if (tooltipEl.row)
					tooltipEl.row.style.backgroundColor = '';

				tooltipEl.style.opacity = 0;
				return;
			}

			var pos = this.off(tooltip.chart.canvas);

			tooltipEl.className = tooltip.yAlign;
			tooltipEl.innerHTML = tooltip.text[0];

			tooltipEl.style.opacity = 1;
			tooltipEl.style.left = pos[0] + tooltip.x + 'px';
			tooltipEl.style.top = pos[1] + tooltip.y - tooltip.caretHeight - tooltip.caretPadding + 'px';

			var row = findParent(tooltip.text[1], '.tr'),
			    hue = tooltip.text[2];

			if (row && !isNaN(hue)) {
				row.style.backgroundColor = 'hsl(%u, 100%%, 80%%)'.format(hue);
				tooltipEl.row = row;
			}
		}, this);

		Chart.defaults.global.tooltipFontSize = 10;
		Chart.defaults.global.tooltipTemplate = function(tip) {
			tip.label[0] = tip.label[0].format(tip.value);
			return tip.label;
		};

		this.renderHostData();
		this.renderLayer7Data();
		this.renderIPv6Data();
	},

	handleDownload: function(type, group, order) {
		var args = [ 'download', '-f', type ];

		if (group)
			args.push('-g', group);

		if (order)
			args.push('-o', order);

		return fs.exec_direct('/usr/libexec/nlbwmon-action', args, 'blob').then(function(blob) {
			var data = blob.slice(0, blob.size, (type == 'csv') ? 'text/csv' : 'application/json'),
			    name = 'nlbwmon-data.%s'.format(type),
			    url = window.URL.createObjectURL(data),
			    link = E('a', { 'style': 'display:none', 'href': url, 'download': name });

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		}).catch(function(err) {
			ui.addNotification(null, E('p', [ _('Failed to download traffic data: %s').format(err.message) ]));
		});
	},

	handleCommit: function() {
		return fs.exec('/usr/libexec/nlbwmon-action', [ 'commit' ]).then(function(res) {
			if (res.code != 0)
				throw new Error(res.stderr || res.stdout);

			window.location.reload(true);
		}).catch(function(err) {
			ui.addNotification(null, E('p', [ _('Failed to commit database: %s').format(err.message) ]));
		});
	},

	render: function() {
		document.addEventListener('tooltip-open', L.bind(function(ev) {
			this.renderHostDetail(ev.detail.target, ev.target);
		}, this));

		if ('ontouchstart' in window) {
			document.addEventListener('touchstart', function(ev) {
				var tooltip = document.querySelector('.cbi-tooltip');
				if (tooltip === ev.target || tooltip.contains(ev.target))
					return;

				ui.hideTooltip(ev);
			});
		}

		var node = E([], [
			E('link', { 'rel': 'stylesheet', 'href': L.resource('view/nlbw.css') }),
			E('script', {
				'type': 'text/javascript',
				'src': L.resource('nlbw.chart.min.js'),
				'load': L.bind(this.setupCharts, this)
			}),

			E('h2', [ _('Netlink Bandwidth Monitor') ]),
			this.renderPeriods(),

			E('div', [
				E('div', { 'class': 'cbi-section', 'data-tab': 'traffic', 'data-tab-title': _('Traffic Distribution') }, [
					E('div', { 'class': 'head' }, [
						E('div', { 'class': 'pie' }, [
							E('label', [ _('Traffic / Host') ]),
							E('canvas', { 'id': 'traf-pie', 'width': 200, 'height': 200 })
						]),

						E('div', { 'class': 'pie' }, [
							E('label', [ _('Connections / Host') ]),
							E('canvas', { 'id': 'conn-pie', 'width': 200, 'height': 200 })
						]),

						E('div', { 'class': 'kpi' }, [
							E('ul', [
								E('li', _('<big id="host-total">0</big> hosts')),
								E('li', _('<big id="rx-total">0</big> download')),
								E('li', _('<big id="tx-total">0</big> upload')),
								E('li', _('<big id="conn-total">0</big> connections'))
							])
						])
					]),

					E('table', { 'class': 'table', 'id': 'host-data' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th left hostname' }, [ _('Host') ]),
							E('th', { 'class': 'th right' }, [ _('MAC') ]),
							E('th', { 'class': 'th right' }, [ _('Connections') ]),
							E('th', { 'class': 'th right' }, [ _('Download (Bytes)') ]),
							E('th', { 'class': 'th right' }, [ _('Download (Packets)') ]),
							E('th', { 'class': 'th right' }, [ _('Upload (Bytes)') ]),
							E('th', { 'class': 'th right' }, [ _('Upload (Packets)') ]),
						]),
						E('tr', { 'class': 'tr placeholder' }, [
							E('td', { 'class': 'td' }, [
								E('em', { 'class': 'spinning' }, [ _('Collecting data...') ])
							])
						])
					]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button',
							'click': ui.createHandlerFn(this, 'handleCommit')
							}, _('Force reload…')
						)
					])
				]),

				E('div', { 'class': 'cbi-section', 'data-tab': 'layer7', 'data-tab-title': _('Application Protocols') }, [
					E('div', { 'class': 'head' }, [
						E('div', { 'class': 'pie' }, [
							E('label', [ _('Download / Application') ]),
							E('canvas', { 'id': 'layer7-rx-pie', 'width': 200, 'height': 200 })
						]),

						E('div', { 'class': 'pie' }, [
							E('label', [ _('Upload / Application') ]),
							E('canvas', { 'id': 'layer7-tx-pie', 'width': 200, 'height': 200 })
						]),

						E('div', { 'class': 'kpi' }, [
							E('ul', [
								E('li', _('<big id="layer7-total">0</big> different application protocols')),
								E('li', _('<big id="layer7-most-rx">0</big> cause the most download')),
								E('li', _('<big id="layer7-most-tx">0</big> cause the most upload')),
								E('li', _('<big id="layer7-most-conn">0</big> cause the most connections'))
							])
						])
					]),

					E('table', { 'class': 'table', 'id': 'layer7-data' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th left' }, [ _('Application') ]),
							E('th', { 'class': 'th right' }, [ _('Connections') ]),
							E('th', { 'class': 'th right' }, [ _('Download (Bytes)') ]),
							E('th', { 'class': 'th right' }, [ _('Download (Packets)') ]),
							E('th', { 'class': 'th right' }, [ _('Upload (Bytes)') ]),
							E('th', { 'class': 'th right' }, [ _('Upload (Packets)') ]),
						]),
						E('tr', { 'class': 'tr placeholder' }, [
							E('td', { 'class': 'td' }, [
								E('em', { 'class': 'spinning' }, [ _('Collecting data...') ])
							])
						])
					]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button',
							'click': ui.createHandlerFn(this, 'handleCommit')
							}, _('Force reload…')
						)
					])
				]),

				E('div', { 'class': 'cbi-section', 'data-tab': 'ipv6', 'data-tab-title': _('IPv6') }, [
					E('div', { 'class': 'head' }, [
						E('div', { 'class': 'pie' }, [
							E('label', [ _('IPv4 vs. IPv6') ]),
							E('canvas', { 'id': 'ipv6-share-pie', 'width': 200, 'height': 200 })
						]),

						E('div', { 'class': 'pie' }, [
							E('label', [ _('Dualstack enabled hosts') ]),
							E('canvas', { 'id': 'ipv6-hosts-pie', 'width': 200, 'height': 200 })
						]),

						E('div', { 'class': 'kpi' }, [
							E('ul', [
								E('li', _('<big id="ipv6-hosts">0%</big> IPv6 support rate among hosts')),
								E('li', _('<big id="ipv6-share">0%</big> of the total traffic is IPv6')),
								E('li', _('<big id="ipv6-rx">0B</big> total IPv6 download')),
								E('li', _('<big id="ipv6-tx">0B</big> total IPv6 upload'))
							])
						])
					]),

					E('table', { 'class': 'table', 'id': 'ipv6-data' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th left' }, [ _('Host') ]),
							E('th', { 'class': 'th right' }, [ _('MAC') ]),
							E('th', { 'class': 'th double right hide-xs' }, [ _('Family') ]),
							E('th', { 'class': 'th double right' }, [ _('Download (Bytes)') ]),
							E('th', { 'class': 'th double right' }, [ _('Download (Packets)') ]),
							E('th', { 'class': 'th double right' }, [ _('Upload (Bytes)') ]),
							E('th', { 'class': 'th double right' }, [ _('Upload (Packets)') ]),
						]),
						E('tr', { 'class': 'tr placeholder' }, [
							E('td', { 'class': 'td' }, [
								E('em', { 'class': 'spinning' }, [ _('Collecting data...') ])
							])
						])
					]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button',
							'click': ui.createHandlerFn(this, 'handleCommit')
							}, _('Force reload…')
						)
					])
				]),

				E('div', { 'class': 'cbi-section', 'data-tab': 'export', 'data-tab-title': _('Export') }, [
					E('div', { 'class': 'cbi-section-node cbi-sction-node-tabbed' }, [
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('Grouped by MAC (CSV)')),
							E('div', { 'class': 'cbi-value-field' }, [
								E('button', {
									'class': 'cbi-button',
									'click': ui.createHandlerFn(this, 'handleDownload', 'csv', 'mac', '-rx,-tx')
								}, [ _('Export') ])
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('Grouped by IP (CSV)')),
							E('div', { 'class': 'cbi-value-field' }, [
								E('button', {
									'class': 'cbi-button',
									'click': ui.createHandlerFn(this, 'handleDownload', 'csv', 'ip', '-rx,-tx')
								}, [ _('Export') ])
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('Grouped by protocol (CSV)')),
							E('div', { 'class': 'cbi-value-field' }, [
								E('button', {
									'class': 'cbi-button',
									'click': ui.createHandlerFn(this, 'handleDownload', 'csv', 'layer7', '-rx,-tx')
								}, [ _('Export') ])
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('Dump (JSON)')),
							E('div', { 'class': 'cbi-value-field' }, [
								E('button', {
									'class': 'cbi-button',
									'click': ui.createHandlerFn(this, 'handleDownload', 'json', null, null)
								}, [ _('Export') ])
							])
						])
					])
				])
			])
		]);

		ui.tabs.initTabGroup(node.lastElementChild.childNodes);

		return node;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
