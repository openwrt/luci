'use strict';
'require view';
'require ui';
'require poll';
'require dom';
'require view.apmond.common as common';

/*
 * ApmonD clients: "ubus call apmond clients {include_stale: true}" on the collector, one list
 * of every client of every access point, in node order then by MAC. The same table as under
 * each node on the Access points page, plus the node: columns empty for every client are left
 * out, stale clients are greyed out and can be forgotten. The filter box matches the MAC, node,
 * SSID, interface, port, bridge, VLAN and VXLAN of a client.
 */

/* the filter text, kept across refreshes */
var filterText = '';

return view.extend({
	forgetButton: function(mac) {
		var self = this;

		return E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'title': _('Remove it from the collector now. A client that is still connected comes back.'),
			'click': ui.createHandlerFn(this, function() {
				return common.forgetClient(mac).then(function() {
					return self.refresh();
				}).catch(function(e) {
					ui.addNotification(null, E('p', {}, [ _('Could not forget %s: %s').format(mac, e.message || e) ]), 'error');
				});
			})
		}, [ _('Forget') ]);
	},

	/* the text the filter looks in */
	filterTextOf: function(c) {
		var parts = [
			c.client_mac,
			c.node_hostname,
			c.node_mac,
			common.formatWhere(c),
			common.text(c.vlan),
			common.formatVxlan(c.vxlan)
		];

		return parts.join(' ').toLowerCase();
	},

	/* does client c match the filter text? */
	matches: function(c, f) {
		if (!f) {
			return true;
		}
		return this.filterTextOf(c).indexOf(f.toLowerCase()) >= 0;
	},

	renderClients: function(clients) {
		var self = this;
		var shown;

		if (!clients.length) {
			return E('em', {}, [ _('No clients') ]);
		}

		shown = clients.filter(function(c) {
			return self.matches(c, filterText);
		});

		if (!shown.length) {
			return E('em', {}, [ _('No client matches the filter') ]);
		}

		return common.renderClientTable(shown, {
			node: true,
			forget: function(mac) {
				return self.forgetButton(mac);
			}
		});
	},

	/* resolves to { st, clients } */
	fetchData: function() {
		return Promise.all([ common.getStatus(), common.getClients() ]).then(function(res) {
			return { st: res[0], clients: res[1] };
		});
	},

	renderData: function(data) {
		if (data.st == null) {
			return E('div', { 'class': 'alert-message error' },
				_('Could not read the ApmonD status. Is apmond installed, enabled and running?'));
		}

		if (data.st.role != 'collector') {
			return E('div', {}, [ common.collectorBanner(data.st) ]);
		}

		if (data.clients == null) {
			return E('div', {}, [
				common.collectorBanner(data.st),
				E('div', { 'class': 'alert-message error' }, _('Could not read the client list from apmond.'))
			]);
		}

		return E('div', {}, [
			common.collectorBanner(data.st),
			this.renderClients(data.clients)
		]);
	},

	refresh: function() {
		var self = this;

		return this.fetchData().then(function(d) {
			self.data = d;
			dom.content(self.box, self.renderData(d));
		});
	},

	load: function() {
		return this.fetchData();
	},

	render: function(data) {
		var self = this;
		var filter = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'placeholder': _('Filter'),
			'value': filterText,
			'keyup': function(ev) {
				filterText = ev.target.value;
				dom.content(self.box, self.renderData(self.data));
			}
		});

		this.data = data;
		this.box = E('div', {}, [ this.renderData(data) ]);

		poll.add(function() {
			return self.refresh();
		}, 30);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('ApmonD Clients') ]),
			E('div', { 'class': 'cbi-map-descr' }, [ _('Every client of every access point, refreshed every 30 seconds. Stale clients are greyed out.') ]),
			E('div', { 'style': 'margin-bottom:1em' }, [ filter ]),
			this.box,
			common.footer()
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
