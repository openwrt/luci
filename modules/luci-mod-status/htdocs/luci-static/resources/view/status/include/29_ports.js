'use strict';
'require baseclass';
'require fs';
'require ui';
'require uci';
'require rpc';
'require network';
'require firewall';

var callGetBuiltinEthernetPorts = rpc.declare({
	object: 'luci',
	method: 'getBuiltinEthernetPorts',
	expect: { result: [] }
});

function isString(v)
{
	return typeof(v) === 'string' && v !== '';
}

function resolveVLANChain(ifname, bridges, mapping)
{
	while (!mapping[ifname]) {
		var m = ifname.match(/^(.+)\.([^.]+)$/);

		if (!m)
			break;

		if (bridges[m[1]]) {
			if (bridges[m[1]].vlan_filtering)
				mapping[ifname] = bridges[m[1]].vlans[m[2]];
			else
				mapping[ifname] = bridges[m[1]].ports;
		}
		else if (/^[0-9]{1,4}$/.test(m[2]) && m[2] <= 4095) {
			mapping[ifname] = [ m[1] ];
		}
		else {
			break;
		}

		ifname = m[1];
	}
}

function buildVLANMappings(mapping)
{
	var bridge_vlans = uci.sections('network', 'bridge-vlan'),
	    vlan_devices = uci.sections('network', 'device'),
	    interfaces = uci.sections('network', 'interface'),
	    bridges = {};

	/* find bridge VLANs */
	for (var i = 0, s; (s = bridge_vlans[i]) != null; i++) {
		if (!isString(s.device) || !/^[0-9]{1,4}$/.test(s.vlan) || +s.vlan > 4095)
			continue;

		var aliases = L.toArray(s.alias),
		    ports = L.toArray(s.ports),
		    br = bridges[s.device] = (bridges[s.device] || { ports: [], vlans: {}, vlan_filtering: true });

		br.vlans[s.vlan] = [];

		for (var j = 0; j < ports.length; j++) {
			var port = ports[j].replace(/:[ut*]+$/, '');

			if (br.ports.indexOf(port) === -1)
				br.ports.push(port);

			br.vlans[s.vlan].push(port);
		}

		for (var j = 0; j < aliases.length; j++)
			if (aliases[j] != s.vlan)
				br.vlans[aliases[j]] = br.vlans[s.vlan];
	}

	/* find bridges, VLAN devices */
	for (var i = 0, s; (s = vlan_devices[i]) != null; i++) {
		if (s.type == 'bridge') {
			if (!isString(s.name))
				continue;

			var ports = L.toArray(s.ports),
			    br = bridges[s.name] || (bridges[s.name] = { ports: [], vlans: {}, vlan_filtering: false });

			if (s.vlan_filtering == '0')
				br.vlan_filtering = false;
			else if (s.vlan_filtering == '1')
				br.vlan_filtering = true;

			for (var j = 0; j < ports.length; j++)
				if (br.ports.indexOf(ports[j]) === -1)
					br.ports.push(ports[j]);

			mapping[s.name] = br.ports;
		}
		else if (s.type == '8021q' || s.type == '8021ad') {
			if (!isString(s.name) || !isString(s.vid) || !isString(s.ifname))
				continue;

			/* parent device is a bridge */
			if (bridges[s.ifname]) {
				/* parent bridge is VLAN enabled, device refers to VLAN ports */
				if (bridges[s.ifname].vlan_filtering)
					mapping[s.name] = bridges[s.ifname].vlans[s.vid];

				/* parent bridge is not VLAN enabled, device refers to all bridge ports */
				else
					mapping[s.name] = bridges[s.ifname].ports;
			}

			/* parent is a simple netdev */
			else {
				mapping[s.name] = [ s.ifname ];
			}

			resolveVLANChain(s.ifname, bridges, mapping);
		}
	}

	/* resolve VLAN tagged interfaces in bridge ports */
	for (var brname in bridges) {
		for (var i = 0; i < bridges[brname].ports.length; i++)
			resolveVLANChain(bridges[brname].ports[i], bridges, mapping);

		for (var vid in bridges[brname].vlans)
			for (var i = 0; i < bridges[brname].vlans[vid].length; i++)
				resolveVLANChain(bridges[brname].vlans[vid][i], bridges, mapping);
	}

	/* find implicit VLAN devices */
	for (var i = 0, s; (s = interfaces[i]) != null; i++) {
		if (!isString(s.device))
			continue;

		resolveVLANChain(s.device, bridges, mapping);
	}
}

function resolveVLANPorts(ifname, mapping, seen)
{
	var ports = [];

	if (!seen)
		seen = {};

	if (mapping[ifname]) {
		for (var i = 0; i < mapping[ifname].length; i++) {
			if (!seen[mapping[ifname][i]]) {
				seen[mapping[ifname][i]] = true;
				ports.push.apply(ports, resolveVLANPorts(mapping[ifname][i], mapping, seen));
			}
		}
	}
	else {
		ports.push(ifname);
	}

	return ports.sort(L.naturalCompare);
}

function buildInterfaceMapping(zones, networks) {
	var vlanmap = {},
	    portmap = {},
	    netmap = {};

	buildVLANMappings(vlanmap);

	for (var i = 0; i < networks.length; i++) {
		var l3dev = networks[i].getDevice();

		if (!l3dev)
			continue;

		var ports = resolveVLANPorts(l3dev.getName(), vlanmap);

		for (var j = 0; j < ports.length; j++) {
			portmap[ports[j]] = portmap[ports[j]] || { networks: [], zones: [] };
			portmap[ports[j]].networks.push(networks[i]);
		}

		netmap[networks[i].getName()] = networks[i];
	}

	for (var i = 0; i < zones.length; i++) {
		var networknames = zones[i].getNetworks();

		for (var j = 0; j < networknames.length; j++) {
			if (!netmap[networknames[j]])
				continue;

			var l3dev = netmap[networknames[j]].getDevice();

			if (!l3dev)
				continue;

			var ports = resolveVLANPorts(l3dev.getName(), vlanmap);

			for (var k = 0; k < ports.length; k++) {
				portmap[ports[k]] = portmap[ports[k]] || { networks: [], zones: [] };

				if (portmap[ports[k]].zones.indexOf(zones[i]) === -1)
					portmap[ports[k]].zones.push(zones[i]);
			}
		}
	}

	return portmap;
}

function formatSpeed(carrier, speed, duplex) {
	if ((speed > 0) && duplex) {
		var d = (duplex == 'half') ? '\u202f(H)' : '',
		    e = E('span', { 'title': _('Speed: %d Mibit/s, Duplex: %s').format(speed, duplex) });

		switch (true) {
		case (speed < 1000):
			e.innerText = '%d\u202fM%s'.format(speed, d);
			break;
		case (speed == 1000):
			e.innerText = '1\u202fGbE' + d;
			break;
		case (speed >= 1e6 && speed < 1e9):
			e.innerText = '%f\u202fTbE'.format(speed / 1e6);
			break;
		case (speed >= 1e9):
			e.innerText = '%f\u202fPbE'.format(speed / 1e9);
			break;
		default: e.innerText = '%f\u202fGbE'.format(speed / 1000);
		}

		return e;
	}

	return carrier ? _('Connected') : _('no link');
}

function formatStats(portdev) {
	var stats = portdev._devstate('stats') || {};

	return ui.itemlist(E('span'), [
		_('Received bytes'), '%1024mB'.format(stats.rx_bytes),
		_('Received packets'), '%1000mPkts.'.format(stats.rx_packets),
		_('Received multicast'), '%1000mPkts.'.format(stats.multicast),
		_('Receive errors'), '%1000mPkts.'.format(stats.rx_errors),
		_('Receive dropped'), '%1000mPkts.'.format(stats.rx_dropped),

		_('Transmitted bytes'), '%1024mB'.format(stats.tx_bytes),
		_('Transmitted packets'), '%1000mPkts.'.format(stats.tx_packets),
		_('Transmit errors'), '%1000mPkts.'.format(stats.tx_errors),
		_('Transmit dropped'), '%1000mPkts.'.format(stats.tx_dropped),

		_('Collisions seen'), stats.collisions
	]);
}

function renderNetworkBadge(network, zonename) {
	var l3dev = network.getDevice();
	var span = E('span', { 'class': 'ifacebadge', 'style': 'margin:.125em 0' }, [
		E('span', {
			'class': 'zonebadge',
			'title': zonename ? _('Part of zone %q').format(zonename) : _('No zone assigned'),
			'style': firewall.getZoneColorStyle(zonename)
		}, '\u202f'),
		'\u202f', network.getName(), ': '
	]);

	if (l3dev)
		span.appendChild(E('img', {
			'title': l3dev.getI18n(),
			'src': L.resource('icons/%s%s.png'.format(l3dev.getType(), l3dev.isUp() ? '' : '_disabled'))
		}));
	else
		span.appendChild(E('em', _('(no interfaces attached)')));

	return span;
}

function renderNetworksTooltip(pmap) {
	var res = [ null ],
	    zmap = {};

	for (var i = 0; pmap && i < pmap.zones.length; i++) {
		var networknames = pmap.zones[i].getNetworks();

		for (var k = 0; k < networknames.length; k++)
			zmap[networknames[k]] = pmap.zones[i].getName();
	}

	for (var i = 0; pmap && i < pmap.networks.length; i++)
		res.push(E('br'), renderNetworkBadge(pmap.networks[i], zmap[pmap.networks[i].getName()]));

	if (res.length > 1)
		res[0] = N_((res.length - 1) / 2, 'Part of network:', 'Part of networks:');
	else
		res[0] = _('Port is not part of any network');

	return E([], res);
}

return baseclass.extend({
	title: _('Port status'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callGetBuiltinEthernetPorts(), []),
			L.resolveDefault(fs.read('/etc/board.json'), '{}'),
			firewall.getZones(),
			network.getNetworks(),
			uci.load('network')
		]);
	},

	render: function(data) {
		if (L.hasSystemFeature('swconfig'))
			return null;

		var board = JSON.parse(data[1]),
		    known_ports = [],
		    port_map = buildInterfaceMapping(data[2], data[3]);

		if (Array.isArray(data[0]) && data[0].length > 0) {
			known_ports = data[0].map(port => ({
				...port,
				netdev: network.instantiateDevice(port.device)
			}));
		}
		else {
			if (L.isObject(board) && L.isObject(board.network)) {
				for (var k = 'lan'; k != null; k = (k == 'lan') ? 'wan' : null) {
					if (!L.isObject(board.network[k]))
						continue;

					if (Array.isArray(board.network[k].ports))
						for (let i = 0; i < board.network[k].ports.length; i++)
							known_ports.push({
								role: k,
								device: board.network[k].ports[i],
								netdev: network.instantiateDevice(board.network[k].ports[i])
							});
					else if (typeof(board.network[k].device) == 'string')
						known_ports.push({
							role: k,
							device: board.network[k].device,
							netdev: network.instantiateDevice(board.network[k].device)
						});
				}
			}
		}

		known_ports.sort(function(a, b) {
			return L.naturalCompare(a.device, b.device);
		});

		return E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit, minmax(70px, 1fr));margin-bottom:1em' }, known_ports.map(function(port) {
			var speed = port.netdev.getSpeed(),
			    duplex = port.netdev.getDuplex(),
			    carrier = port.netdev.getCarrier(),
			    pmap = port_map[port.netdev.getName()],
			    pzones = (pmap && pmap.zones.length) ? pmap.zones.sort(function(a, b) { return L.naturalCompare(a.getName(), b.getName()) }) : [ null ];

			return E('div', { 'class': 'ifacebox', 'style': 'margin:.25em;min-width:70px;max-width:100px' }, [
				E('div', { 'class': 'ifacebox-head', 'style': 'font-weight:bold' }, [ port.netdev.getName() ]),
				E('div', { 'class': 'ifacebox-body' }, [
					E('img', { 'src': L.resource('icons/port_%s.png').format(carrier ? 'up' : 'down') }),
					E('br'),
					formatSpeed(carrier, speed, duplex)
				]),
				E('div', { 'class': 'ifacebox-head cbi-tooltip-container', 'style': 'display:flex' }, [
					E([], pzones.map(function(zone) {
						return E('div', {
							'class': 'zonebadge',
							'style': 'cursor:help;flex:1;height:3px;opacity:' + (carrier ? 1 : 0.25) + ';' + firewall.getZoneColorStyle(zone)
						});
					})),
					E('span', { 'class': 'cbi-tooltip left' }, [ renderNetworksTooltip(pmap) ])
				]),
				E('div', { 'class': 'ifacebox-body' }, [
					E('div', { 'class': 'cbi-tooltip-container', 'style': 'text-align:left;font-size:80%' }, [
						'\u25b2\u202f%1024.1mB'.format(port.netdev.getTXBytes()),
						E('br'),
						'\u25bc\u202f%1024.1mB'.format(port.netdev.getRXBytes()),
						E('span', { 'class': 'cbi-tooltip' }, formatStats(port.netdev))
					]),
				])
			]);
		}));
	}
});
