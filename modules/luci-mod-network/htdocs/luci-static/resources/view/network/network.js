function iface_reconnect(id) {
	L.halt();
	L.dom.content(document.getElementById(id + '-ifc-description'), E('em', _('Interface is reconnecting...')));
	L.post(L.url('admin/network/iface_reconnect', id), null, L.run);
}

function iface_delete(ev) {
	if (!confirm(_('Really delete this interface? The deletion cannot be undone! You might lose access to this device if you are connected via this interface'))) {
		ev.preventDefault();
		return false;
	}

	ev.target.previousElementSibling.value = '1';
	return true;
}

var networks = [];

document.querySelectorAll('[data-network]').forEach(function(n) {
	networks.push(n.getAttribute('data-network'));
});

function render_iface(ifc) {
	return E('span', { class: 'cbi-tooltip-container' }, [
		E('img', { 'class' : 'middle', 'src': L.resource('icons/%s%s.png').format(
			ifc.is_alias ? 'alias' : ifc.type,
			ifc.is_up ? '' : '_disabled') }),
		E('span', { 'class': 'cbi-tooltip ifacebadge large' }, [
			E('img', { 'src': L.resource('icons/%s%s.png').format(
				ifc.type, ifc.is_up ? '' : '_disabled') }),
			L.itemlist(E('span', { 'class': 'left' }), [
				_('Type'),      ifc.typename,
				_('Device'),    ifc.ifname,
				_('Connected'), ifc.is_up ? _('yes') : _('no'),
				_('MAC'),       ifc.macaddr,
				_('RX'),        '%.2mB (%d %s)'.format(ifc.rx_bytes, ifc.rx_packets, _('Pkts.')),
				_('TX'),        '%.2mB (%d %s)'.format(ifc.tx_bytes, ifc.tx_packets, _('Pkts.'))
			])
		])
	]);
}

L.poll(5, L.url('admin/network/iface_status', networks.join(',')), null,
	function(x, ifcs) {
		if (ifcs) {
			for (var idx = 0; idx < ifcs.length; idx++) {
				var ifc = ifcs[idx];

				var s = document.getElementById(ifc.id + '-ifc-devices');
				if (s) {
					var c = [ render_iface(ifc) ];

					if (ifc.subdevices && ifc.subdevices.length)
					{
						var sifs = [ ' (' ];

						for (var j = 0; j < ifc.subdevices.length; j++)
							sifs.push(render_iface(ifc.subdevices[j]));

						sifs.push(')');

						c.push(E('span', {}, sifs));
					}

					c.push(E('br'));
					c.push(E('small', {}, ifc.is_alias ? _('Alias of "%s"').format(ifc.is_alias) : ifc.name));

					L.dom.content(s, c);
				}

				var d = document.getElementById(ifc.id + '-ifc-description');
				if (d && ifc.proto && ifc.ifname) {
					var desc = null, c = [];

					if (ifc.is_dynamic)
						desc = _('Virtual dynamic interface');
					else if (ifc.is_alias)
						desc = _('Alias Interface');

					if (ifc.desc)
						desc = desc ? '%s (%s)'.format(desc, ifc.desc) : ifc.desc;

					L.itemlist(d, [
						_('Protocol'), desc || '?',
						_('Uptime'),   ifc.is_up ? '%t'.format(ifc.uptime) : null,
						_('MAC'),      (!ifc.is_dynamic && !ifc.is_alias && ifc.macaddr) ? ifc.macaddr : null,
						_('RX'),       (!ifc.is_dynamic && !ifc.is_alias) ? '%.2mB (%d %s)'.format(ifc.rx_bytes, ifc.rx_packets, _('Pkts.')) : null,
						_('TX'),       (!ifc.is_dynamic && !ifc.is_alias) ? '%.2mB (%d %s)'.format(ifc.tx_bytes, ifc.tx_packets, _('Pkts.')) : null,
						_('IPv4'),     ifc.ipaddrs ? ifc.ipaddrs[0] : null,
						_('IPv4'),     ifc.ipaddrs ? ifc.ipaddrs[1] : null,
						_('IPv4'),     ifc.ipaddrs ? ifc.ipaddrs[2] : null,
						_('IPv4'),     ifc.ipaddrs ? ifc.ipaddrs[3] : null,
						_('IPv4'),     ifc.ipaddrs ? ifc.ipaddrs[4] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[0] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[1] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[2] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[3] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[4] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[5] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[6] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[7] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[8] : null,
						_('IPv6'),     ifc.ip6addrs ? ifc.ip6addrs[9] : null,
						_('IPv6-PD'),  ifc.ip6prefix,
						_('Information'), ifc.is_auto ? null : _('Not started on boot'),
						_('Error'),    ifc.errors ? ifc.errors[0] : null,
						_('Error'),    ifc.errors ? ifc.errors[1] : null,
						_('Error'),    ifc.errors ? ifc.errors[2] : null,
						_('Error'),    ifc.errors ? ifc.errors[3] : null,
						_('Error'),    ifc.errors ? ifc.errors[4] : null,
					]);
				}
				else if (d && !ifc.proto) {
					var e = document.getElementById(ifc.id + '-ifc-edit');
					if (e) e.disabled = true;

					var link = L.url('admin/system/opkg') + '?query=luci-proto';
					L.dom.content(d, [
						E('em', _('Unsupported protocol type.')), E('br'),
						E('a', { href: link }, _('Install protocol extensions...'))
					]);
				}
				else if (d && !ifc.ifname) {
					var link = L.url('admin/network/network', ifc.name) + '?tab.network.%s=physical'.format(ifc.name);
					L.dom.content(d, [
						E('em', _('Network without interfaces.')), E('br'),
						E('a', { href: link }, _('Assign interfaces...'))
					]);
				}
				else if (d) {
					L.dom.content(d, E('em' ,_('Interface not present or not connected yet.')));
				}
			}
		}
	}
);
