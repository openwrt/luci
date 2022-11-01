'use strict';
'require view';
'require rpc';
'require form';
'require poll';


var callGetWgInstances = rpc.declare({
	object: 'luci.wireguard',
	method: 'getWgInstances'
});

function timestampToStr(timestamp) {
	if (timestamp < 1) {
		return _('Never');
	}
	var now = new Date();
	var seconds = (now.getTime() / 1000) - timestamp;
	var ago = '';
	if (seconds < 60) {
		ago = _('%ds ago').format(parseInt(seconds));
	} else if (seconds < 3600) {
		ago = _('%dm ago').format(parseInt(seconds / 60));
	} else if (seconds < 86401) {
		ago = _('%dh ago').format(parseInt(seconds / 3600));
	} else {
		ago = _('over a day ago');
	}
	var t = new Date(timestamp * 1000);
	return t.toUTCString() + ' (' + ago + ')';
}

function generatePeerOption(key, title, value) {
	return E('div', { 'class': 'cbi-value', 'style': 'padding: 0;' }, [
		E('label', {
			'class': 'cbi-value-title', 'style': 'font-weight: bold;'
		}, title),
		E('input', {
			'class': 'cbi-input-text',
			'data-name': key,
			'style': 'border: none; float: left; width: 50%;',
			'disabled': '',
			'value': value
		})
	]);
}

function generatePeerTable(options, iconSrc) {
	return E('div', { 'class': 'table cbi-section-table' }, [
		E('div', { 'class': 'td' },
			E('img', { 'src': iconSrc, 'class': 'tunnel-icon' })
		),
		E('div', { 'class': 'td peer-options' },
			options.filter(function (option) {
				return option[2] != null;
			}).map(function (option) {
				return generatePeerOption.apply(null, option);
			})
		)
	]);
}

function getTunnelIcon(latestHandshake) {
	var img = (new Date().getTime() / 1000 - latestHandshake) < 140 ?
		'tunnel' : 'tunnel_disabled';

	return L.resource('icons', img + '.png');
}

function generatePeerRows(peers) {
	var peerRows = [];

	peers.forEach(function (peer) {
		var peerData = parsePeerData(peer);
		var iconSrc = getTunnelIcon(peer.latest_handshake);

		peerRows.push(E('tr', {
			'class': 'tr cbi-section-table-row'
		}, [
			E('td', {
				'class': 'td peer-name',
				'style': 'width: 25%; font-size: 0.9rem;'
			}, peer.name),
			E('td', { 'class': 'td', 'data-section-id': peer.name },
				generatePeerTable(peerData, iconSrc)
			)
		]));
	});

	if (!peerRows.length) {
		peerRows.push(
			E('tr', { 'class': 'tr placeholder' },
				E('td', { 'class': 'td' },
					E('em', _('No peer information available')))));
	}

	return peerRows;
}

function parseIfaceData(iface) {
	return [
		['public_key', _('Public Key'),
			iface.public_key != '(none)' ? iface.public_key : null],
		['listen_port', _('Listen Port'),
			iface.listen_port > 0 ? iface.listen_port : null],
		['fwmark', _('Firewall Mark'),
			iface.fwmark != 'off' ? iface.fwmark : null]
	];
}

function parsePeerData(peer) {
	return [
		['public_key', _('Public Key'),
			peer.public_key],
		['endpoint', _('Endpoint'),
			peer.endpoint == '(none)' ? null : peer.endpoint],
		['allowed_ips', _('Allowed IPs'),
			peer.allowed_ips.length == 0 ? null : peer.allowed_ips.join(', ')],
		['persistent_keepalive', _('Persistent Keepalive'),
			peer.persistent_keepalive == 'off' ? null : peer.persistent_keepalive + 's'],
		['latest_handshake', _('Latest Handshake'),
			timestampToStr(peer.latest_handshake)],
		['transfer_rx', _('Data Received'),
			'%1024mB'.format(peer.transfer_rx)],
		['transfer_tx', _('Data Transmitted'),
			'%1024mB'.format(peer.transfer_tx)]
	];
}

return view.extend({
	load: function () {
		return callGetWgInstances();
	},

	poll_status: function (nodes, ifaces) {
		Object.keys(ifaces).forEach(function (ifaceName) {
			var iface = ifaces[ifaceName];

			var section = nodes.querySelector(
				'[data-section-id="%q"]'.format(ifaceName)
			);

			parseIfaceData(iface).forEach(function (option) {
				if (option[2] != null) {
					var optionEl = section.querySelector(
						'[data-name="%q"]'.format(option[0])
					);
					var inputEl = optionEl.querySelector('input');

					inputEl.value = option[2];
				}
			});

			iface.peers.forEach(function (peer) {
				var peerData = parsePeerData(peer);
				var iconSrc = getTunnelIcon(peer.latest_handshake);

				var peerSection = section.querySelector(
					'[data-section-id="%q"]'.format(peer.name)
				);
				var iconEl = peerSection.querySelector('.tunnel-icon');
				iconEl.src = iconSrc;

				peerData.forEach(function (option) {
					if (option[2]) {
						var inputEl = peerSection.querySelector(
							'[data-name="%q"]'.format(option[0])
						);
						inputEl.value = option[2];
					}
				})
			});
		});
	},

	render: function (ifaces) {
		var m, s, o, ss;

		m = new form.JSONMap(ifaces, _('WireGuard Status'));
		m.tabbed = true;

		var ifaceNames = Object.keys(ifaces);

		for (var i = ifaceNames.length - 1; i >= 0; i--) {
			var ifaceName = ifaceNames[i];
			var iface = ifaces[ifaceName];

			s = m.section(form.TypedSection, ifaceName);
			s.tabbed = true;
			s.anonymous = true;

			var ifaceData = parseIfaceData(iface);
			ifaceData.forEach(function (option) {
				if (option[2] != null) {
					o = s.option(form.Value, option[0], option[1]);
					o.readonly = true;
				}
			});

			o = s.option(form.SectionValue, 'peers', form.TypedSection, 'peers');
			ss = o.subsection;

			ss.render = L.bind(function (view, section_id) {
				return E('div', { 'class': 'cbi-section' }, [
					E('h3', _('Peers')),
					E('table', { 'class': 'table cbi-section-table' },
						generatePeerRows(this.peers))
				]);
			}, iface, this);
		}

		return m.render().then(L.bind(function (m, nodes) {
			if (!ifaceNames.length)
				nodes.appendChild(E('p', {}, E('em', _('No WireGuard interfaces configured.'))));

			poll.add(L.bind(function () {
				return callGetWgInstances().then(
					L.bind(this.poll_status, this, nodes)
				);
			}, this), 5);
			return nodes;
		}, this, m));
	},

	handleReset: null,
	handleSaveApply: null,
	handleSave: null
});
