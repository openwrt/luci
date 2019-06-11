requestAnimationFrame(function() {
	document.querySelectorAll('[data-iface-status]').forEach(function(container) {
		var network = container.getAttribute('data-iface-status'),
		    icon = container.querySelector('img'),
		    info = container.querySelector('span');

		L.poll(5, L.url('admin/network/iface_status', network), null, function(xhr, ifaces) {
			var ifc = Array.isArray(ifaces) ? ifaces[0] : null;
			if (!ifc)
				return;

			L.itemlist(info, [
				_('Device'),  ifc.ifname,
				_('Uptime'),  ifc.is_up ? '%t'.format(ifc.uptime) : null,
				_('MAC'),     ifc.ifname ? ifc.macaddr : null,
				_('RX'),      ifc.ifname ? '%.2mB (%d %s)'.format(ifc.rx_bytes, ifc.rx_packets, _('Pkts.')) : null,
				_('TX'),      ifc.ifname ? '%.2mB (%d %s)'.format(ifc.tx_bytes, ifc.tx_packets, _('Pkts.')) : null,
				_('IPv4'),    ifc.ipaddrs ? ifc.ipaddrs[0] : null,
				_('IPv4'),    ifc.ipaddrs ? ifc.ipaddrs[1] : null,
				_('IPv4'),    ifc.ipaddrs ? ifc.ipaddrs[2] : null,
				_('IPv4'),    ifc.ipaddrs ? ifc.ipaddrs[3] : null,
				_('IPv4'),    ifc.ipaddrs ? ifc.ipaddrs[4] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[0] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[1] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[2] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[3] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[4] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[5] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[6] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[7] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[8] : null,
				_('IPv6'),    ifc.ip6addrs ? ifc.ip6addrs[9] : null,
				_('IPv6-PD'), ifc.ip6prefix,
				null,         ifc.ifname ? null : E('em', _('Interface not present or not connected yet.'))
			]);

			icon.src = L.resource('icons/%s%s.png').format(ifc.type, ifc.is_up ? '' : '_disabled');
		});

		L.run();
	});
});
