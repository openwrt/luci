'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';


var callGetWgInstances = rpc.declare({
	object: 'luci.wireguard',
	method: 'getWgInstances'
});

function timestampToStr(timestamp) {
	if (timestamp < 1)
		return _('Never', 'No WireGuard peer handshake yet');

	var seconds = (Date.now() / 1000) - timestamp;
	var ago;

	if (seconds < 60)
		ago = _('%ds ago').format(seconds);
	else if (seconds < 3600)
		ago = _('%dm ago').format(seconds / 60);
	else if (seconds < 86401)
		ago = _('%dh ago').format(seconds / 3600);
	else
		ago = _('over a day ago');

	return (new Date(timestamp * 1000)).toUTCString() + ' (' + ago + ')';
}

/*
{
	"jow": {
		"public_key": "o4iLoC1pl8+vEUshV7eUyKrryo7cr0WJkjS/Dlixxy8=",
		"name": "jow",
		"fwmark": "off",
		"listen_port": "51821",
		"peers": [
			{
				"endpoint": "45.13.105.118:51821",
				"public_key": "672KLy/R4miKXdvw2unuf9jQzVEmNnqen5kF+zVjMX0=",
				"name": "m300",
				"latest_handshake": "1668680574",
				"persistent_keepalive": "off",
				"allowed_ips": [
					"192.168.220.10/32"
				],
				"transfer_tx": "308",
				"transfer_rx": "220"
			},
			{
				"endpoint": "171.22.3.161:51821",
				"public_key": "yblNj1s41F8m1MdXhxD2U+Aew6ZR6Miy8OcNK/fkAks=",
				"name": "ac2",
				"latest_handshake": "0",
				"persistent_keepalive": "off",
				"allowed_ips": [
					"192.168.220.11/32"
				],
				"transfer_tx": "2960",
				"transfer_rx": "0"
			}
		]
	}
}
*/

function handleInterfaceDetails(iface) {
	ui.showModal(_('Instance Details'), [
		ui.itemlist(E([]), [
			_('Name'), iface.name,
			_('Public Key'), E('code', [ iface.public_key ]),
			_('Listen Port'), iface.listen_port,
			_('Firewall Mark'), iface.fwmark != 'off' ? iface.fwmark : E('em', _('none'))
		]),
		E('div', { 'class': 'right' }, [
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.hideModal
			}, [ _('Dismiss') ])
		])
	]);
}

function handlePeerDetails(peer) {
	ui.showModal(_('Peer Details'), [
		ui.itemlist(E([]), [
			_('Description'), peer.name,
			_('Public Key'), E('code', [ peer.public_key ]),
			_('Endpoint'), peer.endpoint,
			_('Allowed IPs'), (Array.isArray(peer.allowed_ips) && peer.allowed_ips.length) ? peer.allowed_ips.join(', ') : E('em', _('none')),
			_('Received Data'), '%1024mB'.format(peer.transfer_rx),
			_('Transmitted Data'), '%1024mB'.format(peer.transfer_tx),
			_('Latest Handshake'), timestampToStr(+peer.latest_handshake),
			_('Keep-Alive'), (peer.persistent_keepalive != 'off') ? _('every %ds', 'WireGuard keep alive interval').format(+peer.persistent_keepalive) : E('em', _('none')),
		]),
		E('div', { 'class': 'right' }, [
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.hideModal
			}, [ _('Dismiss') ])
		])
	]);
}

function renderPeerTable(instanceName, peers) {
	var t = new L.ui.Table(
		[
			_('Peer'),
			_('Endpoint'),
			_('Data Received'),
			_('Data Transmitted'),
			_('Latest Handshake')
		],
		{
			id: 'peers-' + instanceName
		},
		E('em', [
			_('No peers connected')
		])
	);

	t.update(peers.map(function(peer) {
		return [
			[
				peer.name || '',
				E('div', {
					'style': 'cursor:pointer',
					'click': ui.createHandlerFn(this, handlePeerDetails, peer)
				}, [
					E('p', [
						peer.name ? E('span', [ peer.name ]) : E('em', [ _('Untitled peer') ])
					]),
					E('span', {
						'class': 'ifacebadge hide-sm',
						'data-tooltip': _('Public key: %h', 'Tooltip displaying full WireGuard peer public key').format(peer.public_key)
					}, [
						E('code', [ peer.public_key.replace(/^(.{5}).+(.{6})$/, '$1…$2') ])
					])
				])
			],
			peer.endpoint,
			[ +peer.transfer_rx, '%1024mB'.format(+peer.transfer_rx) ],
			[ +peer.transfer_tx, '%1024mB'.format(+peer.transfer_tx) ],
			[ +peer.latest_handshake, timestampToStr(+peer.latest_handshake) ]
		];
	}));

	return t.render();
}

return view.extend({
	renderIfaces: function(ifaces) {
		var res = [
			E('h2', [ _('WireGuard Status') ])
		];

		for (var instanceName in ifaces) {
			res.push(
				E('h3', [ _('Instance "%h"', 'WireGuard instance heading').format(instanceName) ]),
				E('p', {
					'style': 'cursor:pointer',
					'click': ui.createHandlerFn(this, handleInterfaceDetails, ifaces[instanceName])
				}, [
					E('span', { 'class': 'ifacebadge' }, [
						E('img', { 'src': L.resource('icons', 'tunnel.png') }),
						'\xa0',
						instanceName
					]),
					E('span', { 'style': 'opacity:.8' }, [
						' · ',
						_('Port %d', 'WireGuard listen port').format(ifaces[instanceName].listen_port),
						' · ',
						E('code', { 'click': '' }, [ ifaces[instanceName].public_key ])
					])
				]),
				renderPeerTable(instanceName, ifaces[instanceName].peers)
			);
		}

		if (res.length == 1)
			res.push(E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
				E('em', [ _('No WireGuard interfaces configured.') ])
			]));

		return E([], res);
	},

	render: function() {
		poll.add(L.bind(function () {
			return callGetWgInstances().then(L.bind(function(ifaces) {
				dom.content(
					document.querySelector('#view'),
					this.renderIfaces(ifaces)
				);
			}, this));
		}, this), 5);

		return E([], [
			E('h2', [ _('WireGuard Status') ]),
			E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
				E('em', [ _('Loading data…') ])
			])
		]);
	},

	handleReset: null,
	handleSaveApply: null,
	handleSave: null
});
