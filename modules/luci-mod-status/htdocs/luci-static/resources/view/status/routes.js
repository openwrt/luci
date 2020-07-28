'use strict';
'require view';
'require fs';
'require rpc';
'require validation';

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
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'neigh', 'show' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'route', 'show', 'table', 'all' ]), {})
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
			var m = lines[i].match(/^([0-9a-f:.]+) (.+) (\S+)$/),
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
				flags.table || 'main'
			]);
		}

		return res;
	},

	render: function(data) {
		var networks = data[0],
		    ip4neigh = data[1].stdout || '',
		    ip4route = data[2].stdout || '',
		    ip6neigh = data[3].stdout || '',
		    ip6route = data[4].stdout || '';

		var neigh4tbl = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, [ _('IPv4-Address') ]),
				E('div', { 'class': 'th' }, [ _('MAC-Address') ]),
				E('div', { 'class': 'th' }, [ _('Interface') ])
			])
		]);

		var route4tbl = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, [ _('Network') ]),
				E('div', { 'class': 'th' }, [ _('Target') ]),
				E('div', { 'class': 'th' }, [ _('IPv4-Gateway') ]),
				E('div', { 'class': 'th' }, [ _('Metric') ]),
				E('div', { 'class': 'th' }, [ _('Table') ])
			])
		]);

		var neigh6tbl = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, [ _('IPv6-Address') ]),
				E('div', { 'class': 'th' }, [ _('MAC-Address') ]),
				E('div', { 'class': 'th' }, [ _('Interface') ])
			])
		]);

		var route6tbl = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, [ _('Network') ]),
				E('div', { 'class': 'th' }, [ _('Target') ]),
				E('div', { 'class': 'th' }, [ _('Source') ]),
				E('div', { 'class': 'th' }, [ _('Metric') ]),
				E('div', { 'class': 'th' }, [ _('Table') ])
			])
		]);

		cbi_update_table(neigh4tbl, this.parseNeigh(ip4neigh, networks, false));
		cbi_update_table(route4tbl, this.parseRoute(ip4route, networks, false));
		cbi_update_table(neigh6tbl, this.parseNeigh(ip6neigh, networks, true));
		cbi_update_table(route6tbl, this.parseRoute(ip6route, networks, true));

		return E([], [
			E('h2', {}, [ _('Routes') ]),
			E('p', {}, [ _('The following rules are currently active on this system.') ]),

			E('h3', {}, [ _('ARP') ]),
			neigh4tbl,

			E('h3', {}, _('Active <abbr title="Internet Protocol Version 4">IPv4</abbr>-Routes')),
			route4tbl,

			E('h3', {}, [ _('IPv6 Neighbours') ]),
			neigh6tbl,

			E('h3', {}, _('Active <abbr title="Internet Protocol Version 6">IPv6</abbr>-Routes')),
			route6tbl
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

