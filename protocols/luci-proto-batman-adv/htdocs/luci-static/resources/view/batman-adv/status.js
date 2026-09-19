'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';


var callGetBatadvInstances = rpc.declare({
	object: 'luci.batadv',
	method: 'getBatadvInstances'
});

function msToStr(milliseconds){
	let ago;

	if (milliseconds < 1000)
		ago = _('%dms ago').format(milliseconds);
	else if (milliseconds < 60000)
		ago = _('%ds ago').format(milliseconds / 1000);
	else
		ago = _('%dm ago').format(milliseconds / 60000);

	return ago;
}

function renderNeighborTable(instanceName, neighbors, hostnames) {
	var t = new L.ui.Table(
		[
			_('Neighbor'),
			_('Last seen'),
			_('Reported Throughput'),
			_('Connected on Hardware Interface')
		],
		{
			id: 'neighs-' + instanceName,
			placeholder: _('No neighbors connected')
		},
		E('em', [
			_('No neighbors connected')
		])
	);

	t.update(neighbors.map(function(peer) {
		return [
			hostnames[peer.neigh_address] ? `${peer.neigh_address} (${hostnames[peer.neigh_address]})` : peer.neigh_address,
			[ +peer.last_seen_msecs, msToStr(peer.last_seen_msecs)],
			[ +peer.throughput, '%.1mb/s'.format(+peer.throughput*1000) ], //peer throughput is reported in kbit/s
			peer.hard_ifname,
		];
	}));

	return t.render();
}

function renderHardifTable(instanceName, hardifs) {
	var t = new L.ui.Table(
		[
			_('Interface'),
			_('Address'),
			_('Active'),
			_('Hop Penalty'),
			_('ELP Interval'),
			_('Throughput Override')
		],
		{
			id: 'hardifs-' + instanceName,
			placeholder: _('No hardifs associated')
		},
		E('em', [
			_('No hardifs associated')
		])
	);

	t.update(hardifs.map(function(iface) {
		return [
			iface.hard_ifname,
			iface.hard_address,
			iface.active,
			+iface.hop_penalty,
			+iface.elp_interval,
			+iface.throughput_override != 0 ? [+iface.throughput_override, '%.1mb/s'.format(iface.throughput_override*100000)] : [+iface.throughput_override, _('Not overridden')], //hardif throughput override is reported in 100kbit/s
		];
	}));

	return t.render();
}

return view.extend({
	renderIfaces: function(ifaces) {
		var res = [
			E('h2', [ _('Batman-adv Status') ])
		];

		if(ifaces.batctl_debug_tables){
			for (var instanceName in ifaces.devices) {
				res.push(
					E('h3', [ _('Device "%h"', 'Batman-adv device heading').format(instanceName) ]),
					E('p', [
						E('span', { 'class': 'ifacebadge' }, [
							E('img', { 'src': L.resource('icons', 'tunnel.svg'), 'style': 'width:32px;height:32px' }),
							'\xa0',
							instanceName
						]),
						E('span', { 'style': 'opacity:.8' }, [
							' · ',
							_('Algorithm %h', 'Batman-adv algorithm').format(ifaces.devices[instanceName].algo_name),
							' · ',
							E('code', { 'click': '' }, [ ifaces.devices[instanceName].mesh_address ])
						])
					]),
					E('h5', [ _('Hardware Interfaces') ]),
					renderHardifTable(instanceName, ifaces.devices[instanceName].hardifs),
					E('h5', [ _('Neighbors') ]),
					renderNeighborTable(instanceName, ifaces.devices[instanceName].neighbors, ifaces.hostnames)
				);
			}

			if (res.length == 1)
				res.push(E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
					E('em', [ _('No Batman-adv interfaces configured or active.') ])
				]));

		}
		else {
			res.push(E('h5', { 'class': 'center', 'style': 'margin-top:5em' }, [
				E('em', [ _('This page requires either batctl-default or batctl-full to work but none of them are installed.') ])
			]));
		}

		return E([], res);
	},

	render: function() {
		poll.add(L.bind(function () {
			return callGetBatadvInstances().then(L.bind(function(ifaces) {
				dom.content(
					document.querySelector('#view'),
					this.renderIfaces(ifaces)
				);
			}, this));
		}, this), 5);

		return E([], [
			E('h2', [ _('Batman-adv Status') ]),
			E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
				E('em', [ _('Loading data…') ])
			])
		]);
	},

	handleReset: null,
	handleSaveApply: null,
	handleSave: null
});
