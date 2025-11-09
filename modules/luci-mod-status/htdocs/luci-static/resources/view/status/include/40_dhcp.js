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
 
const callUfpList = rpc.declare({
	object: 'fingerprint',
	method: 'fingerprint',
});

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
			network.getHostHints(),
			L.hasSystemFeature('ufpd') ? callUfpList() : null,
			L.resolveDefault(uci.load('dhcp'))
		]);
	},

	render([dhcp_leases, host_hints, ufp_list]) {
		this.mac_hints = host_hints.getMACHints(false);
		this.ufp_list = ufp_list;

		if (L.hasSystemFeature('dnsmasq') || L.hasSystemFeature('odhcpd'))
			return this.renderLeases(dhcp_leases);

		return E([]);
	},

	renderLeases(dhcp_leases) {
		const leases4 = L.toArray(dhcp_leases.dhcp_leases);
		const leases6 = L.toArray(dhcp_leases.dhcp6_leases);

		if (leases4.length == 0 && leases6.length == 0)
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

		const table4 = this.createTable4(leases4);
		const table6 = this.createTable6(leases6);

		return E([
			E('h3', _('Active DHCPv4 Leases')),
			table4,
			E('h3', _('Active DHCPv6 Leases')),
			table6
		]);
	},

	createTable4(leases4) {
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

	createTable6(leases6) {
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
		uci.set('dhcp', cfg, 'mac', [lease.macaddr]);
		if (ip6arr)
			uci.set('dhcp', cfg, 'hostid', (ip6arr[6] * 0xFFFF + ip6arr[7]).toString(16));

		return uci.save()
			.then(L.bind(L.ui.changes.init, L.ui.changes))
			.then(L.bind(L.ui.changes.displayChanges, L.ui.changes));
	},
});
