'use strict';
'require network';
'require view';
'require poll';
'require rpc';
'require fs';

var callNetworkInterfaceStatus = rpc.declare({
	object: 'network.interface',
	method: 'status',
	expect: { '': {} },
	params: [ 'interface' ]
});

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board',
	expect: { '': {} }
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info',
	expect: { '': {} }
});

var callLuciRpcGetNetworkDevices = rpc.declare({
	object: 'luci-rpc',
	method: 'getNetworkDevices',
	expect: { '': {} }
});

return view.extend({
	loadStatus: function() {
		return Promise.all([
			callSystemInfo(),
			callSystemBoard(),
			L.resolveDefault(callNetworkInterfaceStatus('wan'), {}),
			L.resolveDefault(callNetworkInterfaceStatus('wwan'), {}),
			L.resolveDefault(callNetworkInterfaceStatus('wan6'), {}),
			L.resolveDefault(callNetworkInterfaceStatus('wan_6'), {}),
			L.resolveDefault(callLuciRpcGetNetworkDevices(), {}),
			fs.trimmed('/proc/sys/net/netfilter/nf_conntrack_count'),
			fs.trimmed('/proc/sys/net/netfilter/nf_conntrack_max')
		]);
	},

	load: function() {
		return this.loadStatus();
	},

	renderConnectedStatus: function(ifstatus) {
		var nAddrs = L.toArray(ifstatus['ipv4-address']).length + L.toArray(ifstatus['ipv6-address']).length;

		if (nAddrs > 0)
			return E('span', { 'style': 'color:#0a4' }, [ _('Connected') ]);
		else if (ifstatus.up)
			return _('Connecting…');
		else
			return E('span', { 'style': 'color:#a00' }, [ _('Disconnected') ]);
	},

	renderProtocolName: function(proto) {
		switch (proto) {
		case 'dhcp':
			return _('WAN DHCP');

		case 'dhcpv6':
			return _('DHCPv6-PD');

		case 'pppoe':
			return _('WAN PPPoE');

		case 'static':
			return _('Static configuration');

		default:
			return 'UNKNOWN';
		}
	},

	renderAddressList: function(addrs) {
		var list = [];

		for (var i = 0; i < addrs.length; i++) {
			if (i)
				list.push(', ');

			if (addrs[i].valid)
				list.push(E('span', { 'style': 'white-space:nowrap' }, [
					'%s/%d (valid %t)'.format(addrs[i].address, addrs[i].mask, addrs[i].valid)
				]));
			else
				list.push(E('span', { 'style': 'white-space:nowrap' }, [
					'%s/%d'.format(addrs[i].address, addrs[i].mask)
				]));
		}

		return E([], list);
	},

	renderTable: function(data) {
		var sysinfo = data[0],
		    board = data[1],
		    ewanStatus = data[2],
		    wwanStatus = data[3],
		    pwan6Status = data[4],
		    vwan6Status = data[5],
		    netDevs = data[6],
		    ctCount = +data[7],
		    ctLimit = +data[8],
		    wanStatus = wwanStatus.proto ? wwanStatus : ewanStatus,
		    wan6Status = vwan6Status.proto ? vwan6Status : (pwan6Status.proto ? pwan6Status : wanStatus),
		    wanAddr = L.toArray(wanStatus['ipv4-address'])[0],
		    wanRoute = L.toArray(wanStatus['route']).filter(function(rt) { return rt.target == '0.0.0.0' })[0],
		    wanDNS4 = L.toArray(wanStatus['dns-server']).filter(function(host) { return host.indexOf(':') == -1 }),
		    wanDNS6 = L.toArray(wan6Status['dns-server']).filter(function(host) { return host.indexOf(':') != -1 }),
		    wan6Route = L.toArray(wan6Status['route']).filter(function(rt) { return rt.target == '::' })[0],
		    wan6Dev = netDevs[wan6Status.l3_device || wan6Status.device] || {},
		    wan6LL = L.toArray(wan6Dev['ip6addrs']).filter(function(addr) { return addr.address.match(/^fe[89ab][0-9a-f]:/i) })[0];

		var info = [
			false, _('Firmware Version:'), board.release ? board.release.description : 'UNKNOWN',
			false, _('Hardware Variant:'), board.system || 'UNKNOWN',
			false, _('Model Name:'), board.model || 'UNKNOWN',
			false, _('Internet IPv4 Connection Status:'), this.renderConnectedStatus(wanStatus),
			true, _('IPv4 Address is from:'), this.renderProtocolName(wanStatus.proto),
			true, _('IPv4 Address:'), wanAddr ? wanAddr.address : '',
			true, _('Subnet Mask:'), wanAddr ? network.prefixToMask(wanAddr.mask) : '',
			true, _('IPv4 Default Gateway:'), wanRoute ? wanRoute.nexthop : '',
			true, _('IPv4 DNS Address:'), wanDNS4.length ? wanDNS4.join(', ') : '',
			true, _('Connection tracking capacity:'), ctLimit ? '%d/%d'.format(ctCount, ctLimit) : 'UNKNOWN',
			false, _('Internet IPv6 Connection Status:'), this.renderConnectedStatus(wan6Status),
			true, _('IPv6 Address is from:'), this.renderProtocolName(wan6Status.proto),
			true, _('Delegated Prefix:'), this.renderAddressList(L.toArray(wan6Status['ipv6-prefix'])),
			true, _('IPv6 Address:'), this.renderAddressList(L.toArray(wan6Status['ipv6-address'])),
			true, _('Link-Local Address:'), wan6LL ? wan6LL.address : '',
			true, _('IPv6 Default Gateway:'), wan6Route ? wan6Route.nexthop : '',
			true, _('IPv6 DNS Address:'), wanDNS6.length ? wanDNS6.join(', ') : '',
			false, _('Router Active Time:'), '%d:%02d:%02d'.format(
				sysinfo.uptime / 3600,
				sysinfo.uptime / 60 % 60,
				sysinfo.uptime % 60
			)
		];

		var table = E('div', { 'class': 'table' });

		for (var i = 0; i < info.length; i += 3) {
			var title = info[i] ? '\xa0\xa0\xa0' + info[i+1] : E('strong', [ info[i+1] ]);

			table.appendChild(E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td nowrap', 'style': 'width:40%' }, [ title ]),
				E('div', { 'class': 'td' }, [ info[i+2] ])
			]));
		}

		return table;
	},

	render: function(data) {
		var first = true,
		    view = E('div', [ E('h1', [ _('Router Status') ]), E('div') ]);

		poll.add(L.bind(function() {
			return (first ? Promise.resolve(data) : this.loadStatus()).then(L.bind(function(data) {
				view.replaceChild(this.renderTable(data), view.lastElementChild);
				first = false;
			}, this));
		}, this), 5);

		return view;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
