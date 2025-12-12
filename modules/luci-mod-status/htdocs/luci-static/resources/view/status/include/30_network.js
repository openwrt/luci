'use strict';
'require baseclass';
'require fs';
'require network';
'require rpc';
'require ui';


/* returns per odhcp6c active interface JSON like:
{"result":{"eth1":{"dhcp_solicit":3,"dhcp_advertise":3,"dhcp_request":3,...}}} */
const callOdhcp6cStats = rpc.declare({
	object: 'luci',
	method: 'getOdhcp6cStats',
	expect: { '': {} },
});

function progressbar(value, max, byte) {
	const vn = parseInt(value) || 0;
	const mn = parseInt(max) || 100;
	const fv = byte ? String.format('%1024.2mB', value) : value;
	const fm = byte ? String.format('%1024.2mB', max) : max;
	const pc = Math.floor((100 / mn) * vn);

	return E('div', {
		'class': 'cbi-progressbar',
		'title': '%s / %s (%d%%)'.format(fv, fm, pc)
	}, E('div', { 'style': 'width:%.2f%%'.format(pc) }));
}

function renderbox(ifc, ipv6, dhcpv6_stats) {
	const dev = ifc.getL3Device();
	const active = (dev && ifc.getProtocol() != 'none');
	const addrs = (ipv6 ? ifc.getIP6Addrs() : ifc.getIPAddrs()) || [];
	const dnssrv = (ipv6 ? ifc.getDNS6Addrs() : ifc.getDNSAddrs()) || [];
	const expires = ifc.getExpiry();
	const uptime = ifc.getUptime();

	function addEntries(label, array) {
		return Array.isArray(array) ? array.flatMap((item) => [label, item]) : [label, null];
	}

	function addDhcpv6Stats() {
		if (ipv6 && ifc.getProtocol() === 'dhcpv6' && dhcpv6_stats && dhcpv6_stats[dev.device]) {
			const arr = [];
			for (const [pkt_type, count] of Object.entries(dhcpv6_stats[dev.device]))
				arr.push(pkt_type.replace('dhcp_', _('DHCPv6') + ' '), `${count} ${_('pkts', 'packets, abbreviated')}`);
			return [_('DHCPv6 Statistics'), E('span', { 'class': 'cbi-tooltip-container'}, [
				'📊',
				E('span', { 'class': 'cbi-tooltip' }, ui.itemlist(E('span'), arr))
			])];
		}
		return ['', null];
	}

	return E('div', { class: 'ifacebox' }, [
		E('div', { class: 'ifacebox-head center ' + (active ? 'active' : '') },
			E('strong', ipv6 ? _('IPv6 Upstream') : _('IPv4 Upstream'))),
		E('div', { class: 'ifacebox-body left' }, [
			L.itemlist(E('span'), [
				_('Protocol'), ifc.getI18n() || E('em', _('Not connected')),
				...addEntries(_('Prefix Delegated'), ipv6 ? ifc.getIP6Prefixes?.() : null),
				...addEntries(_('Address'), addrs),
				_('Gateway'), ipv6 ? (ifc.getGateway6Addr() || '::') : (ifc.getGatewayAddr() || '0.0.0.0'),
				...addEntries(_('DNS'), dnssrv),
				_('Expires'), (expires != null && expires > -1) ? '%t'.format(expires) : null,
				_('Connected'), (uptime > 0) ? '%t'.format(uptime) : null,
				...addDhcpv6Stats(),
			]),
			E('div', {}, renderBadge(
				L.resource('icons/%s.svg').format(dev ? dev.getType() : 'ethernet_disabled'), null,
				_('Device'), dev ? dev.getI18n() : '-',
				_('MAC address'), dev.getMAC())
			)
		])
	]);
}

return baseclass.extend({
	title: _('Network'),

	load() {
		return Promise.all([
			fs.trimmed('/proc/sys/net/netfilter/nf_conntrack_count'),
			fs.trimmed('/proc/sys/net/netfilter/nf_conntrack_max'),
			network.getWANNetworks(),
			network.getWAN6Networks(),
			callOdhcp6cStats(),
		]);
	},

	render([ct_count, ct_max, wan_nets, wan6_nets, dhcpv6_stats]) {

		const fields = [
			{ label: _('Active Connections'), value: ct_max ? ct_count : null }
		];

		const ctstatus = E('table', { 'class': 'table' });

		for (const { label, value } of fields) {
			ctstatus.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ label ]),
				E('td', { 'class': 'td left' }, [
					(value != null) ? progressbar(value, ct_max) : '?'
				])
			]));
		}

		const netstatus = E('div', { 'class': 'network-status-table' });

		for (const wan_net of wan_nets)
			netstatus.appendChild(renderbox(wan_net, false));

		for (const wan6_net of wan6_nets)
			netstatus.appendChild(renderbox(wan6_net, true, dhcpv6_stats?.result));

		return E([
			netstatus,
			ctstatus
		]);
	}
});
