'use strict';
'require baseclass';
'require rpc';
'require uci';
'require network';
'require validation';

const callLuciDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	expect: { '': {} }
});
 
const callODHCPD4Leases = rpc.declare({
	object: 'dhcp',
	method: 'ipv4leases',
	expect: { 'device': {} }
});

const callODHCPD6Leases = rpc.declare({
	object: 'dhcp',
	method: 'ipv6leases',
	expect: { 'device': {} }
});

const callUfpList = rpc.declare({
	object: 'fingerprint',
	method: 'fingerprint',
});

function DUIDtoMAC(duid) {
	if (duid == null || duid == '')
		return null;

	var mac = null;
	if (duid.match(/^00010001[a-f0-9]{20}$/i))
		mac = duid.substring(16,);
	else if (duid.match(/^00030001[a-f0-9]{12}$/i))
		mac = duid.substring(8,);

	return mac ? mac.match(/.{1,2}/g).join(":").toUpperCase() : null;
}

return baseclass.extend({
	title: '',

	isMACStatic: {},
	isDUIDStatic: {},
	isDUIDIAIDStatic: {},

	isReadonlyView: !L.hasViewPermission(),
	mac_hints: null,
	ufp_list: null,

	load() {
		return Promise.all([
			callLuciDHCPLeases(),
			L.hasSystemFeature('odhcpd', 'dhcpv4') ? L.resolveDefault(callODHCPD4Leases()) : null,
			L.hasSystemFeature('odhcpd', 'dhcpv6') ? L.resolveDefault(callODHCPD6Leases()) : null,
			network.getHostHints(),
			L.hasSystemFeature('ufpd') ? callUfpList() : null,
			L.resolveDefault(uci.load('dhcp'))
		]);
	},

	render([dnsmasq_leases, odhcpd_leases4, odhcpd_leases6, host_hints, ufp_list]) {
		this.mac_hints = host_hints.getMACHints(false);
		this.ufp_list = ufp_list;

		if (L.hasSystemFeature('dnsmasq') || L.hasSystemFeature('odhcpd'))
			return this.renderLeases(dnsmasq_leases, odhcpd_leases4, odhcpd_leases6);

		return E([]);
	},

	renderLeases(dnsmasq_leases, odhcpd_leases4, odhcpd_leases6) {
		const leases4 = L.toArray(dnsmasq_leases.dhcp_leases);
		const leases6 = L.toArray(dnsmasq_leases.dhcp6_leases);

		if (leases4.length == 0 && leases6.length == 0 && !odhcpd_leases4 && !odhcpd_leases6)
			return E([]);

		for (const host of uci.sections('dhcp', 'host')) {

			for (const mac of L.toArray(host.mac).map(m => m.toUpperCase())) {
				this.isMACStatic[mac] = true;
			}

			for (const duid_iaid of L.toArray(host.duid).map(m => m.toUpperCase())) {
				const parts = duid_iaid.split('%').length;

				if (parts == 1)
					this.isDUIDStatic[duid_iaid] = true;
				else if (parts == 2)
					this.isDUIDIAIDStatic[duid_iaid] = true;
			}
		};

		const dnsmasq_table4 = this.createDnsmasqTable4(leases4);
		const odhcpd_table4 = this.createOdhcpdTable4(odhcpd_leases4);
		const dnsmasq_table6 = this.createDnsmasqTable6(leases6);
		const odhcpd_table6 = this.createOdhcpdTable6(odhcpd_leases6);

		return E([
			E('h3', _('Active DHCPv4 Leases')),
			dnsmasq_table4,
			odhcpd_table4,
			E('h3', _('Active DHCPv6 Leases')),
			dnsmasq_table6,
			odhcpd_table6
		]);
	},

	createDnsmasqTable4(leases4) {
		const table4 = E('table', { 'id': 'status_leases4', 'class': 'table leases4' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Hostname')),
				E('th', { 'class': 'th' }, _('IPv4 address')),
				E('th', { 'class': 'th' }, _('MAC address')),
				E('th', { 'class': 'th' }, _('DUID')),
				E('th', { 'class': 'th' }, _('Lease time remaining')),
				this.isReadonlyView ? E([]) : E('th', { 'class': 'th cbi-section-actions' }, _('Static Lease'))
			])
		]);

		cbi_update_table(table4, leases4.map(L.bind(function(lease) {
			let exp;

			if (lease.expires === false)
				exp = E('em', _('unlimited'));
			else if (lease.expires <= 0)
				exp = E('em', _('expired'));
			else
				exp = '%t'.format(lease.expires);

			const hint = lease.macaddr ? this.mac_hints.filter(function(h) { return h[0] == lease.macaddr })[0] : null;
			let host = null;

			if (hint && lease.hostname && lease.hostname != hint[1])
				host = '%s (%s)'.format(lease.hostname, hint[1]);
			else if (lease.hostname)
				host = lease.hostname;

			const vendor = this.ufp_list?.[lease.macaddr.toLowerCase()]?.vendor ?? null;
			const mac_desc = vendor ? `${lease.macaddr} (${vendor})` : lease.macaddr;

			const columns = [
				host || '-',
				lease.ipaddr,
				mac_desc,
				lease.duid || '-',
				exp,
			];

			if (!this.isReadonlyView && lease.macaddr) {
				columns.push(E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': L.bind(this.handleCreateStaticLease4, this, lease),
					'data-tooltip': _('Reserve a specific IP address for this device'),
					'disabled': this.isMACStatic[lease.macaddr.toUpperCase()]
				}, [ _('Reserve IP') ]));
			}

			return columns;
		}, this)), E('em', _('There are no active leases')));

		return table4;
	},

	createOdhcpdTable4(iface_leases4) {
		console.log("DHCPv4 leases " + JSON.stringify(iface_leases4));

		const table4 = E('table', { 'id': 'status_leases4', 'class': 'table leases4' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Hostname')),
				E('th', { 'class': 'th' }, _('IPv4 address')),
				E('th', { 'class': 'th' }, _('MAC address')),
				E('th', { 'class': 'th' }, _('FR')),
				E('th', { 'class': 'th' }, _('Lease time remaining')),
				this.isReadonlyView ? E([]) : E('th', { 'class': 'th cbi-section-actions' }, _('Static Lease'))
			])
		]);

		const leases4 = Object.entries(iface_leases4).flatMap(([iface, { leases }]) =>
			leases.map(lease => {
				lease.iface = iface;
				lease.reconf = lease['accept-reconf'];
				lease.macaddr = lease.mac.toUpperCase().match(/.{1,2}/g).join(':');
				lease.ipaddr = lease.address;
				return lease;
			})
		);

		cbi_update_table(table4, leases4.map(L.bind(function(lease) {
			let exp;
			if (lease.valid == 0xffffffff)
				exp = E('em', _('unlimited'));
			else if (lease.valid <= 0)
				exp = E('em', _('expired'));
			else
				exp = '%t'.format(lease.valid);

			const hint = lease.macaddr ? this.mac_hints.filter(function(h) { return h[0] == lease.macaddr })[0] : null;
			let host = null;

			if (hint && lease.hostname && lease.hostname != hint[1])
				host = '%s (%s)'.format(lease.hostname, hint[1]);
			else if (lease.hostname)
				host = lease.hostname;

			const vendor = this.ufp_list?.[lease.macaddr.toLowerCase()]?.vendor ?? null;
			const mac_desc = vendor ? `${lease.macaddr} (${vendor})` : lease.macaddr;

			const columns = [
				lease.iface,
				host || '-',
				lease.ipaddr,
				mac_desc,
				lease.reconf ? _('Yes') : _('No'),
				exp,
			];

			if (!this.isReadonlyView) {
				columns.push(E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': L.bind(this.handleCreateStaticLease4, this, lease),
					'data-tooltip': _('Reserve a specific IP address for this device'),
					'disabled': this.isMACStatic[lease.macaddr.toUpperCase()]
				}, [ _('Reserve IP') ]));
			}

			return columns;
		}, this)), E('em', _('There are no active leases')));

		return table4;
	},

	createDnsmasqTable6(leases6) {
		const table6 = E('table', { 'id': 'status_leases6', 'class': 'table leases6' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Host')),
				E('th', { 'class': 'th' }, _('IPv6 addresses')),
				E('th', { 'class': 'th' }, _('DUID')),
				E('th', { 'class': 'th' }, _('IAID')),
				E('th', { 'class': 'th' }, _('Lease time remaining')),
				this.isReadonlyView ? E([]) : E('th', { 'class': 'th cbi-section-actions' }, _('Static Lease'))
			])
		]);

		cbi_update_table(table6, leases6.map(L.bind(function(lease) {
			let exp;
			if (lease.expires === false)
				exp = E('em', _('unlimited'));
			else if (lease.expires <= 0)
				exp = E('em', _('expired'));
			else
				exp = '%t'.format(lease.expires);

			const hint = lease.macaddr ? this.mac_hints.filter(function(h) { return h[0] == lease.macaddr })[0] : null;
			let host = null;

			if (hint && lease.hostname && lease.hostname != hint[1] && lease.ip6addr != hint[1])
				host = '%s (%s)'.format(lease.hostname, hint[1]);
			else if (lease.hostname)
				host = lease.hostname;
			else if (hint)
				host = hint[1];

			const duid = lease.duid?.toUpperCase();
			const iaid = lease.iaid?.toUpperCase();

			// Note: "disabled: false" doesn't work
			let disabled = null;
			if (!duid)
				disabled = true;
			else if (duid && this.isDUIDStatic[duid])
				disabled = true;
			else if (duid && iaid && this.isDUIDIAIDStatic[`${duid}%${iaid}`])
				disabled = true;

			const columns = [
				host || '-',
				lease.ip6addrs ? lease.ip6addrs.join('<br />') : lease.ip6addr,
				duid || '-',
				iaid || '-',
				exp
			];

			if (!this.isReadonlyView && lease.duid) {
				columns.push(E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': L.bind(this.handleCreateStaticLease6, this, lease),
					'data-tooltip': _('Reserve a specific IP address for this device'),
					'disabled': disabled
				}, [ _('Reserve IP') ]));
			}

			return columns;
		}, this)), E('em', _('There are no active leases')));

		return table6;
	},

	createOdhcpdTable6(iface_leases6) {
		if (!iface_leases6)
			return null;

		const table6 = E('table', { 'id': 'status_leases6', 'class': 'table leases6' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Host')),
				E('th', { 'class': 'th' }, _('IPv6 addresses')),
				E('th', { 'class': 'th' }, _('DUID')),
				E('th', { 'class': 'th' }, _('IAID')),
				E('th', { 'class': 'th' }, _('FR')),
				E('th', { 'class': 'th' }, _('Lease time remaining')),
				this.isReadonlyView ? E([]) : E('th', { 'class': 'th cbi-section-actions' }, _('Static Lease'))
			])
		]);

		const leases6 = Object.entries(iface_leases6).flatMap(([iface, { leases }]) =>
			leases.map(lease => {
				lease.iface = iface;
				lease.duid = lease.duid.toUpperCase();
				lease.iaid = lease.iaid.toString(16).toUpperCase();
				lease.duid_iaid = `${lease.duid}%${lease.iaid}`;
				lease.ip6addrs = lease['ipv6-addr'].map(addr => addr.address);
				lease.reconf = lease['accept-reconf'];
				lease.macaddr = DUIDtoMAC(lease.duid);
				return lease;
			})
		);

		cbi_update_table(table6, leases6.map(L.bind(function(lease) {
			let exp;
			if (lease.valid == 0xffffffff)
				exp = E('em', _('unlimited'));
			else if (lease.valid <= 0)
				exp = E('em', _('expired'));
			else
				exp = '%t'.format(lease.valid);

			const hint = lease.macaddr ? this.mac_hints.filter(function(h) { return h[0] == lease.macaddr })[0] : null;

			let host = null;
			if (hint && lease.hostname && lease.hostname != hint[1] && lease.ip6addrs[0] != hint[1])
				host = '%s (%s)'.format(lease.hostname, hint[1]);
			else if (lease.hostname)
				host = lease.hostname;
			else if (hint)
				host = hint[1];

			// Note: "disabled: false" doesn't work
			let disabled = null;
			if (this.isDUIDStatic[lease.duid])
				disabled = true;
			if (this.isDUIDIAIDStatic[lease.duid_iaid])
				disabled = true;

			const columns = [
				lease.iface,
				host || '-',
				lease.ip6addrs.join('<br />'),
				lease.duid,
				lease.iaid,
				lease.reconf ? _('Yes') : _('No'),
				exp
			];

			if (!this.isReadonlyView) {
				columns.push(E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': L.bind(this.handleCreateStaticLease6, this, lease),
					'data-tooltip': _('Reserve a specific IP address for this device'),
					'disabled': disabled
				}, [ _('Reserve IP') ]));
			}

			return columns;

		}, this)), E('em', _('There are no active leases')));

		return table6;
	},

	handleCreateStaticLease4(lease, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		const cfg = uci.add('dhcp', 'host');
		uci.set('dhcp', cfg, 'name', lease.hostname);
		uci.set('dhcp', cfg, 'ip', lease.ipaddr);
		uci.set('dhcp', cfg, 'mac', [lease.macaddr.toUpperCase()]);

		return uci.save()
			.then(L.bind(L.ui.changes.init, L.ui.changes))
			.then(L.bind(L.ui.changes.displayChanges, L.ui.changes));
	},

	handleCreateStaticLease6(lease, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		const cfg = uci.add('dhcp', 'host');
		const ip6addr = lease.ip6addrs?.[0]?.replace(/\/128$/, '');
		const ip6arr = ip6addr ? validation.parseIPv6(ip6addr) : null;

		// Combine DUID and IAID if both available
		// (note that we know that lease.duid is set here)
		let duid_iaid = lease.duid.toUpperCase();
		if (lease.iaid)
			duid_iaid += `%${lease.iaid}`.toUpperCase();

		uci.set('dhcp', cfg, 'name', lease.hostname);
		uci.set('dhcp', cfg, 'duid', [duid_iaid]);
		if (lease.macaddr)
			uci.set('dhcp', cfg, 'mac', [lease.macaddr]);
		if (ip6arr)
			uci.set('dhcp', cfg, 'hostid', (ip6arr[6] * 0xFFFF + ip6arr[7]).toString(16));

		return uci.save()
			.then(L.bind(L.ui.changes.init, L.ui.changes))
			.then(L.bind(L.ui.changes.displayChanges, L.ui.changes));
	},
});
