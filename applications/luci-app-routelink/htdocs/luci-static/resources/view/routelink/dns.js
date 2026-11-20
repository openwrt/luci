'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require routelink.common as rl';

/* Access log (P4): the DNS log (searchable) and where devices go, and the switch that turns both on. */

var PAGE = 100;
var RANGES = [
	[ 'lastHour', _('Last hour') ],
	[ 'today', _('Today') ],
	[ 'yesterday', _('Yesterday') ],
	[ 'last7d', _('Last 7 days') ]
];

return view.extend({
	load: function() {
		return Promise.all([ rl.info(), L.resolveDefault(rl.devices(), []), uci.load('routelink') ]).then(function(r) {
			/* a configuration from before 0.4 has no dns section */
			if (!uci.get('routelink', 'dns')) {
				uci.add('routelink', 'dns', 'dns');
				uci.set('routelink', 'dns', 'enabled', '0');
			}
			return r;
		});
	},

	render: function(data) {
		var info = data[0], devices = data[1] || [], self = this;
		this.byMac = {};
		devices.forEach(function(d) { self.byMac[d.mac] = d; });
		this.state = { tab: 'dns', range: 'today', mac: '', q: '', page: 0 };

		var m = new form.Map('routelink', _('Access log'),
			_('Which names the devices look up (DNS) and where their internet traffic goes. Devices that use encrypted DNS (DoH, DoT) show up with addresses only.'));
		var s = m.section(form.NamedSection, 'dns', 'dns', _('Settings'));
		s.addremove = false;
		var o = s.option(form.Flag, 'enabled', _('Record DNS lookups and destinations'),
			_('Off by default. When on, the router keeps every name each device looks up, with the answer, and per hour the 100 busiest destinations of each device, for the days set below. Only on a gateway.'));
		o.rmempty = false;
		o = s.option(form.Value, 'keep_days', _('Keep (days)'));
		o.datatype = 'and(uinteger,range(1,365))';
		o.placeholder = '7';
		o = s.option(form.Value, 'max_records', _('At most (DNS records)'));
		o.datatype = 'and(uinteger,range(1000,1000000))';
		o.placeholder = '100000';

		var deviceSelect = E('select', { 'class': 'cbi-input-select', change: function(ev) {
			self.state.mac = ev.target.value;
			self.state.page = 0;
			self.refresh();
		} }, [ E('option', { value: '' }, _('All devices')) ].concat(devices.filter(function(d) {
			return d.mac.indexOf(':') > 0;
		}).map(function(d) {
			var label = rl.deviceLabel(d);
			return E('option', { value: d.mac }, [ label === d.mac ? d.mac : '%s (%s)'.format(label, d.mac) ]);
		})));
		var rangeSelect = E('select', { 'class': 'cbi-input-select', change: function(ev) {
			self.state.range = ev.target.value;
			self.state.page = 0;
			self.refresh();
		} }, RANGES.map(function(r) { return E('option', { value: r[0], selected: r[0] === 'today' ? '' : null }, r[1]); }));
		this.search = E('input', { type: 'search', 'class': 'cbi-input-text', placeholder: _('Name contains…'), keydown: function(ev) {
			if (ev.key === 'Enter') {
				self.state.q = this.value.trim();
				self.state.page = 0;
				self.refresh();
			}
		} });
		this.searchRow = E('span', {}, [ ' ', this.search, ' ',
			E('button', { 'class': 'btn cbi-button', click: function() {
				self.state.q = self.search.value.trim();
				self.state.page = 0;
				self.refresh();
			} }, _('Search')) ]);

		this.tabs = E('ul', { 'class': 'cbi-tabmenu' }, [
			E('li', { 'class': 'cbi-tab', 'data-tab': 'dns' }, E('a', { href: '#', click: function(ev) { ev.preventDefault(); self.setTab('dns'); } }, _('DNS lookups'))),
			E('li', { 'class': 'cbi-tab-disabled', 'data-tab': 'dest' }, E('a', { href: '#', click: function(ev) { ev.preventDefault(); self.setTab('dest'); } }, _('Destinations')))
		]);
		this.summary = E('p', { 'class': 'cbi-section-descr' });
		this.table = E('div');
		this.pager = E('div', { style: 'margin-top:8px' });

		var log = E('div', { 'class': 'cbi-section' }, [
			this.tabs,
			E('div', { style: 'margin:8px 0' }, [ _('Device') + ': ', deviceSelect, ' ', _('Range') + ': ', rangeSelect, this.searchRow ]),
			this.summary,
			this.table,
			this.pager
		]);

		return m.render().then(function(node) {
			/* the 0.1 daemon lists no capabilities and has no log to show */
			if ((info.capabilities || []).indexOf('dns') < 0) {
				node.appendChild(E('div', { 'class': 'alert-message notice' }, _('This plugin version cannot record DNS lookups.')));
				return node;
			}
			if (!info.dns_enabled)
				node.appendChild(E('div', { 'class': 'alert-message notice' },
					_('DNS logging is off. What was recorded before is still shown below.')));
			node.appendChild(log);
			self.refresh();
			return node;
		});
	},

	setTab: function(tab) {
		this.state.tab = tab;
		this.state.page = 0;
		this.tabs.querySelectorAll('li').forEach(function(li) {
			li.className = li.getAttribute('data-tab') === tab ? 'cbi-tab' : 'cbi-tab-disabled';
		});
		this.searchRow.style.display = tab === 'dns' ? '' : 'none';
		this.refresh();
	},

	refresh: function() {
		var self = this, st = this.state, r = rl.resolvePreset(st.range, new Date());
		this.pager.replaceChildren();
		if (st.tab === 'dest') {
			if (!st.mac) {
				this.summary.textContent = '';
				this.table.replaceChildren(E('p', {}, _('Choose a device to see where it goes.')));
				return Promise.resolve();
			}
			return L.resolveDefault(rl.destinations(st.mac, r[0], r[1], 200), { destinations: [] }).then(function(res) {
				self.summary.textContent = _('Busiest destinations, %s – %s.').format(rl.formatTime(r[0]), rl.formatTime(r[1]));
				self.table.replaceChildren(rl.destinationTable(res.destinations || []));
			});
		}
		return rl.dns(st.mac || undefined, r[0], r[1], st.q || undefined, PAGE, st.page * PAGE).then(function(res) {
			self.summary.textContent = _('%d lookups, newest first.').format(res.count);
			self.table.replaceChildren(rl.dnsTable(res.records || [], st.mac ? null : self.byMac));
			var pages = Math.ceil(res.count / PAGE);
			if (pages > 1) {
				var buttons = [];
				if (st.page > 0)
					buttons.push(E('button', { 'class': 'btn cbi-button', click: function() { st.page--; self.refresh(); } }, _('Newer')));
				buttons.push(' %d / %d '.format(st.page + 1, pages));
				if (st.page + 1 < pages)
					buttons.push(E('button', { 'class': 'btn cbi-button', click: function() { st.page++; self.refresh(); } }, _('Older')));
				self.pager.replaceChildren.apply(self.pager, buttons);
			}
		}).catch(function(e) {
			ui.addNotification(null, E('p', {}, [ _('Query failed: %s').format(e.message) ]), 'error');
		});
	}
});
