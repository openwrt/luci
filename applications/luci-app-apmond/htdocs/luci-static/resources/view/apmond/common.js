'use strict';
'require baseclass';
'require rpc';
'require dom';

/*
 * Shared code of the luci-app-apmond views: the apmond ubus calls, value formatting and the
 * version footer. Not a page of its own (it is not in the menu); the views require it as
 * view.apmond.common.
 *
 * apmond 2.x is a C daemon with the ubus object "apmond" (see docs/PROTOCOL.md in openNDS/apmond).
 * The views call it through rpcd (rpc.declare), allowed by
 * /usr/share/rpcd/acl.d/luci-app-apmond.json. Nothing is run through a shell except
 * "apmond read_log" on the Log page.
 */

/* luci-app-apmond version, as apmond: the only place to change at a version bump */
var last_version = '1.0.1';
var version = '2.0.1';

var callStatus = rpc.declare({
	object: 'apmond',
	method: 'status',
	expect: { '': {} }
});

var callNodes = rpc.declare({
	object: 'apmond',
	method: 'nodes',
	expect: { 'nodes': [] },
	reject: true
});

var callClients = rpc.declare({
	object: 'apmond',
	method: 'clients',
	params: [ 'include_stale' ],
	expect: { 'clients': [] },
	reject: true
});

var callForgetNode = rpc.declare({
	object: 'apmond',
	method: 'forget',
	params: [ 'node_mac' ],
	reject: true
});

var callForgetClient = rpc.declare({
	object: 'apmond',
	method: 'forget',
	params: [ 'client_mac' ],
	reject: true
});

return baseclass.extend({
	version: version,
	last_version: last_version,

	/* resolves to the status object, or null when apmond is not running or not reachable */
	getStatus: function() {
		return L.resolveDefault(callStatus(), null).then(function(st) {
			if (st == null || typeof(st) != 'object' || st.version == null) {
				return null;
			}
			return st;
		});
	},

	/* resolves to the list of nodes, or null when the call fails */
	getNodes: function() {
		return L.resolveDefault(callNodes(), null).then(function(list) {
			if (!Array.isArray(list)) {
				return null;
			}
			return list;
		});
	},

	/* resolves to the flat client list, stale clients included, or null when the call fails */
	getClients: function() {
		return L.resolveDefault(callClients(true), null).then(function(list) {
			if (!Array.isArray(list)) {
				return null;
			}
			return list;
		});
	},

	forgetNode: function(mac) {
		return callForgetNode(mac);
	},

	forgetClient: function(mac) {
		return callForgetClient(mac);
	},

	/* "-" for null, undefined or "" (vlan null is untagged), else the value as text */
	text: function(v) {
		if (v == null || v === '') {
			return '-';
		}
		return String(v);
	},

	/* the _date fields, "Thu_Oct_29_15:47:00_GMT_2026" -> "Thu Oct 29 15:47:00 GMT 2026" */
	formatDate: function(v) {
		if (v == null || v === '') {
			return '-';
		}
		return String(v).replace(/_/g, ' ');
	},

	formatBytes: function(v) {
		var n = parseInt(v, 10);
		var units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
		var i = 0;

		if (isNaN(n)) {
			return '-';
		}

		while (n >= 1024 && i < units.length - 1) {
			n = n / 1024;
			i++;
		}

		if (i == 0) {
			return String(n) + ' ' + units[i];
		}
		return n.toFixed(2) + ' ' + units[i];
	},

	/* free_ram_kb and similar, a KiB count */
	formatKiB: function(v) {
		var n = parseInt(v, 10);

		if (isNaN(n)) {
			return '-';
		}
		return this.formatBytes(n * 1024);
	},

	/* seconds -> "1d 2h 3m 4s" */
	formatDuration: function(v) {
		var s = parseInt(v, 10);
		var d;
		var h;
		var m;
		var out = [];

		if (isNaN(s)) {
			return '-';
		}

		d = Math.floor(s / 86400);
		h = Math.floor(s / 3600) % 24;
		m = Math.floor(s / 60) % 60;

		if (d) {
			out.push(d + 'd');
		}
		if (d || h) {
			out.push(h + 'h');
		}
		if (d || h || m) {
			out.push(m + 'm');
		}
		out.push((s % 60) + 's');

		return out.join(' ');
	},

	/* an age in seconds -> "12s ago", "5m ago", "3h ago", "2d ago", as the apmond -t tables */
	formatAge: function(v) {
		var s = parseInt(v, 10);

		if (isNaN(s)) {
			return '-';
		}
		if (s < 0) {
			s = 0;
		}

		if (s < 120) {
			return _('%ss ago').format(s);
		}
		if (s < 7200) {
			return _('%sm ago').format(Math.floor(s / 60));
		}
		if (s < 172800) {
			return _('%sh ago').format(Math.floor(s / 3600));
		}
		return _('%sd ago').format(Math.floor(s / 86400));
	},

	/* uptime in two units: "16d 5h", "3h 12m", "4m 10s", "12s" */
	formatUptime: function(v) {
		var s = parseInt(v, 10);
		var d;
		var h;
		var m;

		if (isNaN(s)) {
			return '-';
		}

		d = Math.floor(s / 86400);
		h = Math.floor(s / 3600) % 24;
		m = Math.floor(s / 60) % 60;

		if (d) {
			return d + 'd ' + h + 'h';
		}
		if (h) {
			return h + 'h ' + m + 'm';
		}
		if (m) {
			return m + 'm ' + (s % 60) + 's';
		}
		return s + 's';
	},

	/* "192.168.111.1/24" -> "192.168.111.1" */
	stripPrefix: function(a) {
		return String(a).replace(/\/[0-9]+$/, '');
	},

	/* Wi-Fi tx/rx_bitrate_kbps -> "6.0 / 390.0 Mbit/s" */
	formatRates: function(c) {
		var tx = parseInt(c.tx_bitrate_kbps, 10);
		var rx = parseInt(c.rx_bitrate_kbps, 10);
		var txt = '-';
		var rxt = '-';

		if (!isNaN(tx)) {
			txt = (tx / 1000).toFixed(1);
		}
		if (!isNaN(rx)) {
			rxt = (rx / 1000).toFixed(1);
		}
		if (isNaN(tx) && isNaN(rx)) {
			return '-';
		}
		return txt + ' / ' + rxt + ' ' + _('Mbit/s');
	},

	/* the rate cell: TX / RX bitrates for Wi-Fi, the port's link speed for wired */
	formatClientRate: function(c) {
		if (c.kind == 'wifi') {
			return this.formatRates(c);
		}
		return this.formatLink(c.speed_mbps);
	},

	/* RX / TX bytes: "1.74 KiB / 662 B", "-" when the client has neither */
	formatClientBytes: function(c) {
		if (c.rx_bytes == null && c.tx_bytes == null) {
			return '-';
		}
		return this.formatBytes(c.rx_bytes) + ' / ' + this.formatBytes(c.tx_bytes);
	},

	/* a radio as "2.4 GHz ch 1 HE40, 20 dBm" */
	formatRadio: function(r) {
		var f = parseInt(r.frequency_mhz, 10);
		var band = '';
		var t;

		if (!isNaN(f)) {
			if (f < 3000) {
				band = '2.4 GHz';
			}
			else if (f < 5925) {
				band = '5 GHz';
			}
			else {
				band = '6 GHz';
			}
		}

		t = band;
		if (r.channel != null) {
			t = (t + ' ' + _('ch %s').format(r.channel)).trim();
		}
		if (r.htmode) {
			t = t + ' ' + r.htmode;
		}
		else if (r.width_mhz != null) {
			t = t + ' ' + r.width_mhz + ' MHz';
		}
		if (r.txpower_dbm != null) {
			t = t + ', ' + r.txpower_dbm + ' dBm';
		}
		if (t === '') {
			return this.text(r.phy);
		}
		return t;
	},

	/* true when any item has a value other than null / "" for fn(item) */
	anyValue: function(items, fn) {
		return items.some(function(x) {
			var v = fn(x);

			return v != null && v !== '';
		});
	},

	/*
	 * The client table columns for a list of clients: a column is left out when it would be
	 * empty for every client (so wired-only lists show MAC, port@bridge, link speed and
	 * last seen). opts.node adds the node column (Clients page); opts.forget(mac) returns a
	 * Forget button for a stale client.
	 */
	clientColumns: function(clients, opts) {
		var self = this;
		var cols = [];
		var wifi = clients.filter(function(c) {
			return c.kind == 'wifi';
		});
		var stale = clients.filter(function(c) {
			return c.state == 'stale';
		});

		var hasVlan = this.anyValue(clients, function(c) {
			return c.vlan;
		});
		var hasVxlan = this.anyValue(clients, function(c) {
			return c.vxlan;
		});
		var hasBytes = this.anyValue(clients, function(c) {
			if (c.rx_bytes != null) {
				return c.rx_bytes;
			}
			return c.tx_bytes;
		});
		var hasConnected = this.anyValue(wifi, function(c) {
			return c.connected_s;
		});

		cols.push({ title: _('Client MAC'), cell: function(c) {
			return c.client_mac;
		} });

		if (opts && opts.node) {
			cols.push({ title: _('Node'), cell: function(c) {
				return E('span', { 'title': self.text(c.node_mac) }, [ self.text(c.node_hostname) ]);
			} });
		}

		cols.push({ title: _('SSID@interface or port@bridge'), cell: function(c) {
			return self.formatWhere(c);
		} });

		if (hasVlan) {
			cols.push({ title: _('VLAN'), cell: function(c) {
				return self.text(c.vlan);
			} });
		}

		if (hasVxlan) {
			cols.push({ title: _('VXLAN'), cell: function(c) {
				return self.formatVxlan(c.vxlan);
			} });
		}

		if (wifi.length) {
			cols.push({ title: _('Signal'), cell: function(c) {
				return self.renderSignal(c);
			} });
		}

		if (wifi.length) {
			cols.push({ title: _('TX / RX bitrate or link'), cell: function(c) {
				return self.formatClientRate(c);
			} });
		}
		else {
			cols.push({ title: _('Link'), cell: function(c) {
				return self.formatClientRate(c);
			} });
		}

		if (hasBytes) {
			cols.push({ title: _('RX / TX bytes'), cell: function(c) {
				return self.formatClientBytes(c);
			} });
		}

		if (hasConnected) {
			cols.push({ title: _('Connected'), cell: function(c) {
				if (c.kind != 'wifi') {
					return '-';
				}
				return self.formatDuration(c.connected_s);
			} });
		}

		cols.push({ title: _('Last seen'), cell: function(c) {
			var state = _('active');

			if (c.state == 'stale') {
				state = _('stale');
			}
			return E('span', { 'title': self.formatDate(c.last_seen_date) }, [
				'%s, %s'.format(state, self.formatAge(c.last_seen_age_s))
			]);
		} });

		if (stale.length && opts && opts.forget) {
			cols.push({ title: ' ', cell: function(c) {
				if (c.state != 'stale') {
					return '';
				}
				return opts.forget(c.client_mac);
			} });
		}

		return cols;
	},

	/* a client table, stale clients greyed out; see clientColumns() for opts */
	renderClientTable: function(clients, opts) {
		var cols = this.clientColumns(clients, opts);
		var head = E('tr', { 'class': 'tr table-titles' }, cols.map(function(col) {
			return E('th', { 'class': 'th' }, [ col.title ]);
		}));
		var rows = clients.map(function(c) {
			var attrs = { 'class': 'tr' };

			if (c.state == 'stale') {
				attrs.style = 'opacity:0.5';
			}

			return E('tr', attrs, cols.map(function(col) {
				return E('td', { 'class': 'td', 'data-title': col.title }, [ col.cell(c) ]);
			}));
		});

		return E('table', { 'class': 'table' }, [ head ].concat(rows));
	},

	/* a wired client's port line speed, speed_mbps -> "Link 100 Mbit/s"; not a bitrate */
	formatLink: function(v) {
		var n = parseInt(v, 10);

		if (isNaN(n)) {
			return '-';
		}
		return _('Link %s Mbit/s').format(n);
	},

	/* vxlan { vni, device } -> "vni 42 (vxlan42)", or "-" */
	formatVxlan: function(v) {
		if (v == null || typeof(v) != 'object' || v.vni == null) {
			return '-';
		}
		if (v.device) {
			return _('vni %s (%s)').format(v.vni, v.device);
		}
		return _('vni %s').format(v.vni);
	},

	/* where a client is connected: "SSID@phy0-ap0" for Wi-Fi, "lan1@br-lan" for wired */
	formatWhere: function(c) {
		if (c.kind == 'wifi') {
			return '%s@%s'.format(this.text(c.ap_ssid), this.text(c.ap_ifname));
		}
		return '%s@%s'.format(this.text(c.port), this.text(c.bridge));
	},

	/* a ULA (fc00::/7), lower case, or null: only such a value is made a link */
	parseULA: function(v) {
		var s = '';

		if (typeof(v) == 'string') {
			s = v.toLowerCase();
		}
		if (!/^f[cd][0-9a-f]{2}:[0-9a-f:]+$/.test(s) || s.length > 39) {
			return null;
		}
		return s;
	},

	/* ipv4_addresses: the a.b.c.d or a.b.c.d/len strings of the array, [] if missing */
	parseIPv4: function(v) {
		if (!Array.isArray(v)) {
			return [];
		}

		return v.map(function(a) {
			return String(a);
		}).filter(function(a) {
			return /^[0-9]{1,3}(\.[0-9]{1,3}){3}(\/[0-9]{1,2})?$/.test(a);
		});
	},

	/*
	 * LuCI signal icon for a dBm value, with the quality mapping of the associated stations
	 * table in luci-mod-status: q = min((dBm + 110) / 70 * 100, 100)
	 */
	signalIcon: function(dbm) {
		var q = Math.min((dbm + 110) / 70 * 100, 100);

		if (q <= 0) {
			return 'icons/signal-000-000.svg';
		}
		if (q < 25) {
			return 'icons/signal-000-025.svg';
		}
		if (q < 50) {
			return 'icons/signal-025-050.svg';
		}
		if (q < 75) {
			return 'icons/signal-050-075.svg';
		}
		return 'icons/signal-075-100.svg';
	},

	/* signal cell: "-" for wired, else the LuCI icon and "-58 dBm" */
	renderSignal: function(c) {
		var dbm = parseInt(c.signal_avg_dbm, 10);
		var title;

		if (c.kind != 'wifi' || isNaN(dbm)) {
			return '-';
		}

		title = _('Signal') + ': ' + dbm + ' ' + _('dBm');
		if (c.ack_signal_avg_dbm != null) {
			title = title + ', ' + _('ACK signal') + ': ' + c.ack_signal_avg_dbm + ' ' + _('dBm');
		}

		return E('span', { 'style': 'white-space:nowrap', 'title': title }, [
			E('img', {
				'src': L.resource(this.signalIcon(dbm)),
				'alt': '',
				'style': 'width:20px;height:20px;vertical-align:middle'
			}),
			' ' + dbm + ' ' + _('dBm')
		]);
	},

	/*
	 * The host part of a URL: an IPv6 address in brackets, an IPv4 address or a host name as it is.
	 * null for an empty address.
	 */
	urlHost: function(addr) {
		if (addr == null || addr == '') {
			return null;
		}
		if (String(addr).indexOf(':') >= 0) {
			return '[' + addr + ']';
		}
		return String(addr);
	},

	/* a page on another node, by its address, in the scheme this page was loaded with */
	nodeURL: function(addr, page) {
		var proto = 'https:';
		var path = '/cgi-bin/luci/admin/services/apmond/' + page;

		if (typeof(window) != 'undefined' && window.location && window.location.protocol) {
			proto = window.location.protocol;
		}
		if (L.url) {
			path = L.url('admin/services/apmond/' + page);
		}

		return proto + '//' + this.urlHost(addr) + path;
	},

	/* a link opened in a new window */
	link: function(url, label) {
		return E('a', { 'href': url, 'target': '_blank', 'rel': 'noopener', 'title': url }, [ label ]);
	},

	/* the Access points page of the collector, in the scheme this page was loaded with */
	collectorURL: function(addr) {
		return this.nodeURL(addr, 'accesspoints');
	},

	/*
	 * The address of the collector this sender reports to: status.collector (the address in use:
	 * the collector ULA, the LAN IPv4 gateway or the configured collector, see collector_via),
	 * falling back to the collector ULA. null when neither is known.
	 */
	collectorAddress: function(st) {
		var ula;

		if (st.collector != null && st.collector != '') {
			return String(st.collector);
		}

		ula = this.parseULA(st.collector_ula);
		if (ula) {
			return ula;
		}

		return null;
	},

	/*
	 * The banner at the top of the Status, Access points and Clients pages. On a sender: this
	 * node reports to the collector at <collector ULA>, with a "Go to collector" link to the
	 * collector's Access points page in a new tab. On the collector: a small note. null while
	 * the status is unknown.
	 */
	collectorBanner: function(st) {
		var addr;
		var parts;

		if (st == null) {
			return null;
		}

		if (st.role == 'collector') {
			return E('p', { 'class': 'apmond-collector-note', 'style': 'font-size:smaller; opacity:0.7' }, [
				_('This node is the collector.')
			]);
		}

		addr = this.collectorAddress(st);
		parts = [ E('strong', {}, [ _('Not the collector.') ]), ' ' ];

		if (!addr) {
			parts.push(_('This node reports to the collector, which has the data of every access point.'));
			return E('div', { 'class': 'alert-message notice apmond-collector-banner' }, [ E('p', {}, parts) ]);
		}

		parts.push(_('This node reports to the collector at %s, which has the data of every access point.').format(addr));
		parts.push(' ');
		parts.push(E('a', {
			'class': 'btn cbi-button cbi-button-action',
			'href': this.collectorURL(addr),
			'target': '_blank',
			'rel': 'noopener',
			'title': this.collectorURL(addr)
		}, [ _('Go to collector') ]));

		return E('div', { 'class': 'alert-message notice apmond-collector-banner' }, [ E('p', {}, parts) ]);
	},

	/* the footer text for a status object (null while unknown) */
	footerText: function(st) {
		var t = _('luci-app-apmond %s').format(version);
		var v;

		if (st === undefined) {
			return t;
		}

		v = _('unknown');
		if (st && st.package_version) {
			v = st.package_version;
			if (st.build_commit) {
				v = v + ' (' + st.build_commit + ')';
			}
		}
		else if (st && st.version) {
			v = st.version;
		}

		return '%s, %s'.format(t, _('apmond %s').format(v));
	},

	/* a small line for the bottom of a page; the apmond version is filled in when it arrives */
	footer: function() {
		var self = this;
		var node = E('div', {
			'class': 'apmond-version',
			'style': 'text-align:right; font-size:smaller; opacity:0.7; margin-top:1em'
		}, [ this.footerText() ]);

		this.getStatus().then(function(st) {
			dom.content(node, [ self.footerText(st) ]);
		});

		return node;
	}
});
