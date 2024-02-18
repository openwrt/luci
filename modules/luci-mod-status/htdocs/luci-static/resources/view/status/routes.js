'use strict';
'require view';
'require fs';
'require rpc';
'require validation';
'require ui';

var callNetworkInterfaceDump = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { interface: [] }
});

function applyMask(addr, mask, v6) {
	var words = v6 ? validation.parseIPv6(addr) : validation.parseIPv4(addr);

	if (!words || mask < 0 || mask > (v6 ? 128 : 32))
		return null;

	for (var i = 0; i < words.length; i++) {
		var b = Math.min(mask, v6 ? 16 : 8);
		words[i] &= ((1 << b) - 1);
		mask -= b;
	}

	return String.prototype.format.apply(
		v6 ? '%x:%x:%x:%x:%x:%x:%x:%x' : '%d.%d.%d.%d', words);
}

return view.extend({
	load: function() {
		return Promise.all([
			callNetworkInterfaceDump(),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', 'neigh', 'show' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', 'route', 'show', 'table', 'all' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', 'rule', 'show' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'neigh', 'show' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'route', 'show', 'table', 'all' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'rule', 'show' ]), {})
		]);
	},

	getNetworkByDevice(networks, dev, addr, mask, v6) {
		var addr_arrays = [ 'ipv4-address', 'ipv6-address', 'ipv6-prefix', 'ipv6-prefix-assignment', 'route' ],
		    matching_iface = null,
		    matching_prefix = -1;

		for (var i = 0; i < networks.length; i++) {
			if (!L.isObject(networks[i]))
				continue;

			if (networks[i].l3_device != dev && networks[i].device != dev)
				continue;

			for (var j = 0; j < addr_arrays.length; j++) {
				var addr_list = networks[i][addr_arrays[j]];

				if (!Array.isArray(addr_list) || addr_list.length == 0)
					continue;

				for (var k = 0; k < addr_list.length; k++) {
					var cmp_addr = addr_list[k].address || addr_list[k].target,
					    cmp_mask = addr_list[k].mask;

					if (cmp_addr == null)
						continue;

					var addr1 = applyMask(cmp_addr, cmp_mask, v6),
					    addr2 = applyMask(addr, cmp_mask, v6);

					if (addr1 != addr2 || mask < cmp_mask)
						continue;

					if (cmp_mask > matching_prefix) {
						matching_iface = networks[i].interface;
						matching_prefix = cmp_mask;
					}
				}
			}
		}

		return matching_iface;
	},

	parseNeigh: function(s, networks, v6) {
		var lines = s.trim().split(/\n/),
		    res = [];

		for (var i = 0; i < lines.length; i++) {
			var m = lines[i].match(/^([0-9a-f:.]+) (.+) (\S+) *$/),
			    addr = m ? m[1] : null,
			    flags = m ? m[2].trim().split(/\s+/) : [],
			    state = (m ? m[3] : null) || 'FAILED';

			if (!addr || state == 'FAILED' || addr.match(/^fe[89a-f][0-9a-f]:/))
				continue;

			for (var j = 0; j < flags.length; j += 2)
				flags[flags[j]] = flags[j + 1];

			if (!flags.lladdr)
				continue;

			var net = this.getNetworkByDevice(networks, flags.dev, addr, v6 ? 128 : 32, v6);

			res.push([
				addr,
				flags.lladdr.toUpperCase(),
				E('span', { 'class': 'ifacebadge' }, [ net ? net : '(%s)'.format(flags.dev) ])
			]);
		}

		return res;
	},

	parseRoute: function(s, networks, v6) {
		var lines = s.trim().split(/\n/),
		    res = [];

		for (var i = 0; i < lines.length; i++) {
			var m = lines[i].match(/^(?:([a-z_]+|\d+) )?(default|[0-9a-f:.\/]+) (.+)$/),
			    type = (m ? m[1] : null) || 'unicast',
			    dest = m ? (m[2] == 'default' ? (v6 ? '::/0' : '0.0.0.0/0') : m[2]) : null,
			    flags = m ? m[3].trim().split(/\s+/) : [];

			if (!dest || type != 'unicast' || dest == 'fe80::/64' || dest == 'ff00::/8')
				continue;

			for (var j = 0; j < flags.length; j += 2)
				flags[flags[j]] = flags[j + 1];

			var addr = dest.split('/'),
			    bits = (addr[1] != null) ? +addr[1] : (v6 ? 128 : 32),
			    net = this.getNetworkByDevice(networks, flags.dev, addr[0], bits, v6);

			res.push([
				E('span', { 'class': 'ifacebadge' }, [ net ? net : '(%s)'.format(flags.dev) ]),
				dest,
				(v6 ? flags.from : flags.via) || '-',
				String(flags.metric || 0),
				flags.table || 'main',
				flags.proto,
			]);
		}

		return res;
	},

	parseRule: function(s) {
		var lines = s.trim().split(/\n/),
		    res = [];

		for (var i = 0; i < lines.length; i++) {
			var m = lines[i].match(/^(\d+):\s+(.+)$/),
			    prio = m ? m[1] : null,
			    rule = m ? m[2] : null;

			res.push([
				prio,
				rule
			]);
		}

		return res;
	},

	render: function(data) {
		var networks = data[0],
		    ip4neigh = data[1].stdout || '',
		    ip4route = data[2].stdout || '',
		    ip4rule = data[3].stdout || '',
		    ip6neigh = data[4].stdout || '',
		    ip6route = data[5].stdout || '',
		    ip6rule = data[6].stdout || '';

		var device_title = _('Which is used to access this %s').format(_('Target'));
		var target_title = _('Network and its mask that define the size of the destination');
		var gateway_title = _('The address through which this %s is reachable').format(_('Target'));
		var metric_title = _('Quantifies the cost or distance to a destination in a way that allows routers to make informed decisions about the optimal path to forward data packets');
		var table_title = _('Common name or numeric ID of the %s in which this route is found').format(_('Table'));
		var proto_title = _('The routing protocol identifier of this route');
		var source_title = _('Network and its mask that define which source addresses use this route');

		var neigh4tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('IP address') ]),
				E('th', { 'class': 'th' }, [ _('MAC address') ]),
				E('th', { 'class': 'th' }, [ _('Interface') ])
			])
		]);

		var route4tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th', 'title': device_title }, [ _('Device') ]),
				E('th', { 'class': 'th', 'title': target_title }, [ _('Target') ]),
				E('th', { 'class': 'th', 'title': gateway_title }, [ _('Gateway') ]),
				E('th', { 'class': 'th', 'title': metric_title }, [ _('Metric') ]),
				E('th', { 'class': 'th', 'title': table_title }, [ _('Table') ]),
				E('th', { 'class': 'th', 'title': proto_title }, [ _('Protocol') ])
			])
		]);

		var rule4tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Priority') ]),
				E('th', { 'class': 'th' }, [ _('Rule') ])
			])
		]);

		var neigh6tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('IP address') ]),
				E('th', { 'class': 'th' }, [ _('MAC address') ]),
				E('th', { 'class': 'th' }, [ _('Interface') ])
			])
		]);

		var route6tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th', 'title': device_title }, [ _('Device') ]),
				E('th', { 'class': 'th', 'title': target_title }, [ _('Target') ]),
				E('th', { 'class': 'th', 'title': source_title }, [ _('Source') ]),
				E('th', { 'class': 'th', 'title': metric_title }, [ _('Metric') ]),
				E('th', { 'class': 'th', 'title': table_title }, [ _('Table') ]),
				E('th', { 'class': 'th', 'title': proto_title }, [ _('Protocol') ])
			])
		]);

		var rule6tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Priority') ]),
				E('th', { 'class': 'th' }, [ _('Rule') ])
			])
		]);

		cbi_update_table(neigh4tbl, this.parseNeigh(ip4neigh, networks, false),
			E('em', _('No entries available'))
		);
		cbi_update_table(route4tbl, this.parseRoute(ip4route, networks, false),
			E('em', _('No entries available'))
		);
		cbi_update_table(rule4tbl, this.parseRule(ip4rule, networks, false),
			E('em', _('No entries available'))
		);
		cbi_update_table(neigh6tbl, this.parseNeigh(ip6neigh, networks, true),
			E('em', _('No entries available'))
		);
		cbi_update_table(route6tbl, this.parseRoute(ip6route, networks, true),
			E('em', _('No entries available'))
		);
		cbi_update_table(rule6tbl, this.parseRule(ip6rule, networks, false),
			E('em', _('No entries available'))
		);

		var view = E([], [
			E('h2', {}, [ _('Routing') ]),
			E('p', {}, [ _('The following rules are currently active on this system.') ]),
			E('div', {}, [
				E('div', { 'class': 'cbi-section', 'data-tab': 'ipv4routing', 'data-tab-title': _('IPv4 Routing') }, [
					E('h3', {}, [ _('IPv4 Neighbours') ]),
					neigh4tbl,

					E('h3', {}, [ _('Active IPv4 Routes') ]),
					route4tbl,

					E('h3', {}, [ _('Active IPv4 Rules') ]),
					rule4tbl
				]),
				E('div', { 'class': 'cbi-section', 'data-tab': 'ipv6routing', 'data-tab-title': _('IPv6 Routing') }, [
					E('h3', {}, [ _('IPv6 Neighbours') ]),
					neigh6tbl,

					E('h3', {}, [ _('Active IPv6 Routes') ]),
					route6tbl,

					E('h3', {}, [ _('Active IPv6 Rules') ]),
					rule6tbl
				])
			])
		]);

		ui.tabs.initTabGroup(view.lastElementChild.childNodes);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
