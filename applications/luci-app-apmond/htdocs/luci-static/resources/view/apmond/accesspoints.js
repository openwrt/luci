'use strict';
'require view';
'require ui';
'require poll';
'require dom';
'require view.apmond.common as common';

/*
 * ApmonD access points: "ubus call apmond nodes" on the collector, every node that has
 * reported, the collector first. A sender has no node list; its banner links to this page on
 * the collector.
 *
 * Node rows: state ok / late / lost from the collector; late and lost rows are greyed and a
 * lost node can be forgotten. "Show clients" opens the node's detail, indented under its row
 * on a light background: a radio table (one row per AP) and the client table, both without
 * columns that would be empty for every row.
 */

/* node macs whose detail is open, kept across refreshes */
var expanded = {};

var GREY = 'opacity:0.5';

/* the detail of a node, indented under its row; theme colours, with fallbacks */
var DETAIL_STYLE = [
	'padding:0.5em 0.5em 0.75em 2em',
	'background:var(--background-color-low, rgba(128,128,128,0.07))',
	'border-left:3px solid var(--border-color-medium, rgba(128,128,128,0.4))'
].join(';');

var SUBTITLE_STYLE = 'margin:0.5em 0 0.25em 0;font-weight:bold';

return view.extend({
	/* a Forget button; after forgetting, the page data is fetched again */
	forgetButton: function(what, mac) {
		var self = this;

		return E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'title': _('Remove it from the collector now. A node or client that still reports comes back.'),
			'click': ui.createHandlerFn(this, function() {
				var call;

				if (what == 'node') {
					call = common.forgetNode(mac);
				}
				else {
					call = common.forgetClient(mac);
				}

				return call.then(function() {
					return self.refresh();
				}).catch(function(e) {
					ui.addNotification(null, E('p', {}, [ _('Could not forget %s: %s').format(mac, e.message || e) ]), 'error');
				});
			})
		}, [ _('Forget') ]);
	},

	/* IPv4 addresses without the prefix length, one per line, or "-" */
	renderIPv4: function(v) {
		var addrs = common.parseIPv4(v);
		var out = [];

		if (!addrs.length) {
			return '-';
		}

		addrs.forEach(function(a, i) {
			if (i) {
				out.push(E('br'));
			}
			out.push(E('span', { 'title': a }, [ common.stripPrefix(a) ]));
		});

		return E('span', {}, out);
	},

	/*
	 * LuCI cell: a short "LuCI" link to that node's Access points page over its ULA, in a new
	 * window, with the full ULA as tooltip; "-" when it has no ULA. This node's own row says
	 * "this node", as a link would only open this page again.
	 */
	renderLuCI: function(v, own) {
		var ula = common.parseULA(v);
		var url;

		if (!ula) {
			return '-';
		}
		if (own) {
			return E('span', { 'title': ula }, [ _('this node') ]);
		}

		url = common.nodeURL(ula, 'accesspoints');
		return E('a', { 'href': url, 'target': '_blank', 'rel': 'noopener', 'title': ula }, [ _('LuCI') ]);
	},

	stateLabel: function(s) {
		if (s == 'ok') {
			return _('ok');
		}
		if (s == 'late') {
			return _('late');
		}
		if (s == 'lost') {
			return _('lost');
		}
		return common.text(s);
	},

	/* "ok, 12s ago" with the report date as tooltip */
	renderState: function(n) {
		var label = '%s, %s'.format(this.stateLabel(n.state), common.formatAge(n.age_s));
		var title = _('Last report: %s. Reports: %s, lost: %s').format(
			common.formatDate(n.last_report_date), common.text(n.reports), common.text(n.lost_reports));

		return E('span', { 'title': title }, [ label ]);
	},

	/* package version, build commit as tooltip, in red with a note when the node needs a restart */
	renderVersion: function(n) {
		var v = n.package_version || n.apmond_version;
		var title = '';

		if (n.build_commit) {
			title = _('Build commit %s').format(n.build_commit);
		}

		if (n.restart_needed === true) {
			return E('span', {
				'style': 'color:#c00;font-weight:bold',
				'title': _('The apmond binary was replaced; restart apmond on this node.')
			}, [ common.text(v) + ' ' + _('(restart needed)') ]);
		}

		return E('span', { 'title': title }, [ common.text(v) ]);
	},

	/* the APs of all radios of a node, each with its radio: [ { radio, ap }, ... ] */
	nodeAPs: function(radios) {
		var out = [];

		if (!Array.isArray(radios)) {
			return out;
		}

		radios.forEach(function(r) {
			(r.aps || []).forEach(function(ap) {
				out.push({ radio: r, ap: ap });
			});
		});

		return out;
	},

	/*
	 * The radio table of a node: one row per AP with radio (band, channel, mode, power), SSID
	 * and interface; VLAN and VXLAN only when an AP of this node has one.
	 */
	renderRadios: function(radios) {
		var aps = this.nodeAPs(radios);
		var cols = [];
		var hasVlan;
		var hasVxlan;
		var head;
		var rows;

		if (!aps.length) {
			return E('em', {}, [ _('No access points') ]);
		}

		cols.push({ title: _('Radio'), cell: function(x) {
			return E('span', { 'title': common.text(x.radio.phy) }, [ common.formatRadio(x.radio) ]);
		} });
		cols.push({ title: _('SSID'), cell: function(x) {
			return E('span', { 'title': common.text(x.ap.bssid) }, [ common.text(x.ap.ssid) ]);
		} });
		cols.push({ title: _('Interface'), cell: function(x) {
			return common.text(x.ap.ifname);
		} });

		hasVlan = common.anyValue(aps, function(x) {
			return x.ap.vlan;
		});
		hasVxlan = common.anyValue(aps, function(x) {
			return x.ap.vxlan;
		});

		if (hasVlan) {
			cols.push({ title: _('VLAN'), cell: function(x) {
				return common.text(x.ap.vlan);
			} });
		}

		if (hasVxlan) {
			cols.push({ title: _('VXLAN'), cell: function(x) {
				return common.formatVxlan(x.ap.vxlan);
			} });
		}

		head = E('tr', { 'class': 'tr table-titles' }, cols.map(function(col) {
			return E('th', { 'class': 'th' }, [ col.title ]);
		}));

		rows = aps.map(function(x) {
			return E('tr', { 'class': 'tr' }, cols.map(function(col) {
				return E('td', { 'class': 'td', 'data-title': col.title }, [ col.cell(x) ]);
			}));
		});

		return E('table', { 'class': 'table' }, [ head ].concat(rows));
	},

	renderClients: function(node) {
		var self = this;
		var clients = node.clients || [];

		if (!clients.length) {
			return E('em', {}, [ _('No clients') ]);
		}

		return common.renderClientTable(clients, {
			forget: function(mac) {
				return self.forgetButton('client', mac);
			}
		});
	},

	/* the detail of a node: radios and clients */
	renderDetail: function(n) {
		return E('div', { 'style': DETAIL_STYLE }, [
			E('div', { 'style': SUBTITLE_STYLE }, [ _('Radios') ]),
			this.renderRadios(n.radios),
			E('div', { 'style': SUBTITLE_STYLE }, [ _('Clients') ]),
			this.renderClients(n)
		]);
	},

	renderNodes: function(nodes, ownId) {
		var self = this;
		var titles = [
			_('Device'), _('MAC address'), _('LuCI'), _('IPv4 address'), _('State'), _('apmond'),
			_('Release'), _('Uptime'), _('Free RAM'), _('Clients'), ' '
		];
		var rows = [];

		nodes.forEach(function(n) {
			var own = (n.node_mac == ownId);
			var open = !!expanded[n.node_mac];
			var detailStyle = null;
			var detail;
			var btn;
			var forget = '';
			var clientCount = n.client_count;
			var attrs = { 'class': 'tr' };
			var cells;

			if (!open) {
				detailStyle = 'display:none';
			}

			detail = E('tr', { 'class': 'tr', 'style': detailStyle }, [
				E('td', { 'class': 'td', 'colspan': String(titles.length), 'style': 'flex:1 1 100%;padding:0' }, [
					self.renderDetail(n)
				])
			]);

			btn = E('button', {
				'class': 'btn cbi-button',
				'click': function(ev) {
					expanded[n.node_mac] = !expanded[n.node_mac];
					if (expanded[n.node_mac]) {
						detail.style.display = '';
						ev.target.firstChild.data = _('Hide clients');
					}
					else {
						detail.style.display = 'none';
						ev.target.firstChild.data = _('Show clients');
					}
				}
			}, [ open ? _('Hide clients') : _('Show clients') ]);

			if (n.state == 'lost' && !own) {
				forget = self.forgetButton('node', n.node_mac);
			}

			if (clientCount == null) {
				clientCount = (n.clients || []).length;
			}

			if (n.state != null && n.state != 'ok') {
				attrs.style = GREY;
			}

			cells = [
				E('span', { 'title': common.text(n.model) }, [ common.text(n.hostname) ]),
				n.node_mac,
				self.renderLuCI(n.node_ula, own),
				self.renderIPv4(n.ipv4_addresses),
				self.renderState(n),
				self.renderVersion(n),
				common.text(n.openwrt_release),
				E('span', { 'title': common.formatDuration(n.uptime_s) }, [ common.formatUptime(n.uptime_s) ]),
				common.formatKiB(n.free_ram_kb),
				String(clientCount),
				E('span', { 'style': 'white-space:nowrap' }, [ btn, ' ', forget ])
			];

			rows.push(E('tr', attrs, cells.map(function(v, i) {
				return E('td', { 'class': 'td', 'data-title': titles[i] }, [ v ]);
			})));
			rows.push(detail);
		});

		return E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, titles.map(function(t) {
				return E('th', { 'class': 'th' }, [ t ]);
			}))
		].concat(rows));
	},

	/* the nodes that use the built-in default passphrase, for a notice on the collector */
	defaultPassphraseNodes: function(nodes) {
		return nodes.filter(function(n) {
			return n.default_passphrase === true;
		}).map(function(n) {
			return common.text(n.hostname);
		});
	},

	/* resolves to { st, nodes } */
	fetchData: function() {
		return Promise.all([ common.getStatus(), common.getNodes() ]).then(function(res) {
			return { st: res[0], nodes: res[1] };
		});
	},

	renderData: function(data) {
		var st = data.st;
		var nodes = data.nodes;
		var out = [];
		var dflt;

		if (st == null) {
			return E('div', { 'class': 'alert-message error' },
				_('Could not read the ApmonD status. Is apmond installed, enabled and running?'));
		}

		out.push(common.collectorBanner(st));

		if (st.role != 'collector') {
			return E('div', {}, out);
		}

		if (nodes == null) {
			out.push(E('div', { 'class': 'alert-message error' },
				_('Could not read the node list from apmond.')));
			return E('div', {}, out);
		}

		if (!nodes.length) {
			out.push(E('div', { 'class': 'alert-message notice' },
				_('This node is the collector. No reports have been received yet.')));
			return E('div', {}, out);
		}

		dflt = this.defaultPassphraseNodes(nodes);
		if (dflt.length) {
			out.push(E('div', { 'class': 'alert-message notice' }, [
				_('These nodes use the built-in default passphrase: %s. Set your own passphrase in Settings, the same on every node.').format(dflt.join(', '))
			]));
		}

		out.push(E('p', {}, [
			_('Access points that have reported to this node, the collector. Click "Show clients" for the radios and clients of an access point. Late and lost nodes and stale clients are greyed out.')
		]));
		out.push(this.renderNodes(nodes, st.id));

		return E('div', {}, out);
	},

	refresh: function() {
		var self = this;

		return this.fetchData().then(function(d) {
			dom.content(self.box, self.renderData(d));
		});
	},

	load: function() {
		return this.fetchData();
	},

	render: function(data) {
		var self = this;

		this.box = E('div', {}, [ this.renderData(data) ]);

		poll.add(function() {
			return self.refresh();
		}, 30);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('ApmonD Access Points') ]),
			E('div', { 'class': 'cbi-map-descr' }, [ _('Refreshed every 30 seconds.') ]),
			this.box,
			common.footer()
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
