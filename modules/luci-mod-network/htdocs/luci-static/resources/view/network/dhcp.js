'use strict';
'require view';
'require dom';
'require poll';
'require rpc';
'require uci';
'require form';
'require network';
'require validation';
'require tools.widgets as widgets';

const callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

const callDUIDHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getDUIDHints',
	expect: { '': {} }
});

const callDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	expect: { '': {} }
});

const callUfpList = rpc.declare({
	object: 'fingerprint',
	method: 'fingerprint',
	expect: { '': {} }
});

const CBILeaseStatus = form.DummyValue.extend({
	renderWidget(section_id, option_id, cfgvalue) {
		return E([
			E('h4', _('Active DHCPv4 Leases')),
			E('table', { 'id': 'lease_status_table', 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					L.hasSystemFeature('odhcpd', 'dhcpv4') ? E('th', { 'class': 'th' }, _('Interface')) : E([]),
					E('th', { 'class': 'th' }, _('Hostname')),
					E('th', { 'class': 'th' }, _('IPv4 address')),
					E('th', { 'class': 'th' }, _('MAC address')),
					E('th', { 'class': 'th' }, _('DUID')),
					E('th', { 'class': 'th' }, _('IAID')),
					E('th', { 'class': 'th' }, _('Remaining time'))
				]),
				E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td' }, E('em', _('Collecting data...')))
				])
			])
		]);
	}
});

const CBILease6Status = form.DummyValue.extend({
	renderWidget(section_id, option_id, cfgvalue) {
		return E([
			E('h4', _('Active DHCPv6 Leases')),
			E('table', { 'id': 'lease6_status_table', 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					L.hasSystemFeature('odhcpd', 'dhcpv6') ? E('th', { 'class': 'th' }, _('Interface')) : E([]),
					E('th', { 'class': 'th' }, _('Hostname')),
					E('th', { 'class': 'th' }, _('IPv6 addresses')),
					E('th', { 'class': 'th' }, _('DUID')),
					E('th', { 'class': 'th' }, _('IAID')),
					E('th', { 'class': 'th' }, _('Remaining time'))
				]),
				E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td' }, E('em', _('Collecting data...')))
				])
			])
		]);
	}
});

function calculateNetwork(addr, mask) {
	addr = validation.parseIPv4(String(addr));

	if (!isNaN(mask))
		mask = validation.parseIPv4(network.prefixToMask(+mask));
	else
		mask = validation.parseIPv4(String(mask));

	if (addr == null || mask == null)
		return null;

	return [
		[
			addr[0] & (mask[0] >>> 0 & 255),
			addr[1] & (mask[1] >>> 0 & 255),
			addr[2] & (mask[2] >>> 0 & 255),
			addr[3] & (mask[3] >>> 0 & 255)
		].join('.'),
		mask.join('.')
	];
}

function generateDnsmasqInstanceEntry(d) {
	const idx = d['.index'], name = d['.name'], anon = d['.anonymous'];
	const label = anon ? `dnsmasq[${idx}]` : name;
	const parts = [`${idx} (${_('Name')}: ${label}`];
	if (d.domain) parts.push(`${_('Domain')}: ${d.domain}`);
	if (d.local) parts.push(`${_('Local')}: ${d.local}`);
	return [name, parts.join(', ') + ')'];
}

function getDHCPPools() {
	return uci.load('dhcp').then(function() {
		const tasks = [], pools = [];

		for (const section of uci.sections('dhcp', 'dhcp')) {
			if (section.ignore == '1' || !section.interface)
				continue;

			tasks.push(network.getNetwork(section.interface).then(L.bind(function(section_id, net) {
				const cidr = net ? (net.getIPAddrs()[0] || '').split('/') : null;

				if (cidr && cidr.length == 2) {
					const net_mask = calculateNetwork(cidr[0], cidr[1]);

					pools.push({
						section_id: section_id,
						network: net_mask[0],
						netmask: net_mask[1]
					});
				}
			}, null, section['.name'])));
		}

		return Promise.all(tasks).then(function() {
			return pools;
		});
	});
}

function validateHostname(sid, s) {
	if (!s) return true;

	if (s.length > 256)
		return _('Expecting: %s').format(_('valid hostname'));

	const labels = s.replace(/^\*?\.?|\.$/g, '').split(/\./);

	for (const label of labels) {
		if (!label.match(/^[a-z0-9_](?:[a-z0-9-]{0,61}[a-z0-9])?$/i))
			return _('Expecting: %s').format(_('valid hostname'));
	}

	return true;
}

function validateDUIDIAID(sid, s) {
	if (!s) return true;

	const parts = s.split('%');
	if (parts.length > 2)
		return _('Expecting: %s').format(_('maximum one "%"'));

	// DUID_MAX_LEN = 130 => 260 hex chars
	if (parts[0].length < 20 || parts[0].length > 260 || !parts[0].match(/^([a-f0-9]{2})+$/i))
		return _('Expecting: %s').format(_('DUID with an even number (20 to 260) of hexadecimal characters'));

	if (parts.length == 2 && (parts[1].length < 1 || parts[1].length > 8 || !parts[1].match(/^[a-f0-9]+$/i)))
		return _('Expecting: %s').format(_('IAID of 1 to 8 hexadecimal characters'));

	return true;
};

function expandAndFormatMAC(macs) {
	const result = [];

	macs.forEach(mac => {
		if (isValidMAC(mac)) {
			const expandedMac = mac.split(':').map(part => {
				return (part.length === 1 && part !== '*') ? '0' + part : part;
			}).join(':').toUpperCase();
			result.push(expandedMac);
		}
	});

	return result.length ? result : null;
}

function isValidMAC(sid, s) {
	if (!s) return true;

	for (const mac of L.toArray(s))
		if (!mac.match(/^(([0-9a-f]{1,2}|\*)[:-]){5}([0-9a-f]{1,2}|\*)$/i))
			return _('Expecting a valid MAC address, optionally including wildcards') + _('; invalid MAC: ') + mac;

	return true;
}

return view.extend({
	load() {
		return Promise.all([
			callHostHints(),
			callDUIDHints(),
			getDHCPPools(),
			network.getNetworks(),
			L.hasSystemFeature('ufpd') ? callUfpList() : null
		]);
	},

	render([hosts, duids, pools, networks, macdata]) {
		let m;

		m = new form.Map('dhcp', _('DHCP'));
		m.tabbed = true;

		if (L.hasSystemFeature('dnsmasq'))
			this.add_dnsmasq_cfg(m, networks);

		if (L.hasSystemFeature('odhcpd'))
			this.add_odhcpd_cfg(m);

		this.add_leases_cfg(m, hosts, duids, pools, macdata);

		return m.render().then(function(mapEl) {
			poll.add(function() {
				return callDHCPLeases().then(function(leaseinfo) {
					const leases = Array.isArray(leaseinfo.dhcp_leases) ? leaseinfo.dhcp_leases : [];
					const leases6 = Array.isArray(leaseinfo.dhcp6_leases) ? leaseinfo.dhcp6_leases : [];

					cbi_update_table('#lease_status_table',
						leases.map(function(lease) {
							let exp;
							let vendor;

							if (lease.expires === false)
								exp = E('em', _('unlimited'));
							else if (lease.expires <= 0)
								exp = E('em', _('expired'));
							else
								exp = '%t'.format(lease.expires);

							for (let mac in macdata) {
								if (mac.toUpperCase() === lease.macaddr) {
									vendor = macdata[mac].vendor ?
										` (${macdata[mac].vendor})` : null;
								}
							}

							const hint = lease.macaddr ? hosts[lease.macaddr] : null;
							const name = hint ? hint.name : null;
							let host = null;

							if (name && lease.hostname && lease.hostname != name)
								host = '%s (%s)'.format(lease.hostname, name);
							else if (lease.hostname)
								host = lease.hostname;

							const columns = [
								host || '-',
								lease.ipaddr,
								vendor ? lease.macaddr + vendor : lease.macaddr,
								lease.duid || '-',
								lease.iaid || '-',
								exp
							];

							if (L.hasSystemFeature('odhcpd', 'dhcpv4'))
								columns.unshift(lease.interface || '-');

							return columns;
						}),
						E('em', _('There are no active leases'))
					);

					cbi_update_table('#lease6_status_table',
						leases6.map(function(lease) {
							let exp;

							if (lease.expires === false)
								exp = E('em', _('unlimited'));
							else if (lease.expires <= 0)
								exp = E('em', _('expired'));
							else
								exp = '%t'.format(lease.expires);

							const hint = lease.macaddr ? hosts[lease.macaddr] : null;
							const name = hint ? (hint.name || L.toArray(hint.ipaddrs || hint.ipv4)[0] || L.toArray(hint.ip6addrs || hint.ipv6)[0]) : null;
							let host = null;

							if (name && lease.hostname && lease.hostname != name && lease.ip6addr != name)
								host = '%s (%s)'.format(lease.hostname, name);
							else if (lease.hostname)
								host = lease.hostname;
							else if (name)
								host = name;

							const columns = [
								host || '-',
								lease.ip6addrs ? lease.ip6addrs.join('<br />') : lease.ip6addr,
								lease.duid,
								lease.iaid,
								exp
							];

							if (L.hasSystemFeature('odhcpd', 'dhcpv6'))
								columns.unshift(lease.interface || '-');

							return columns;
						}),
						E('em', _('There are no active leases'))
					);
				});
			});

			return mapEl;
		});
	},

	add_dnsmasq_cfg(m, networks) {
		let s, o, ss, so;

		s = m.section(form.TypedSection, 'dnsmasq', _('dnsmasq'));
		s.hidetitle = true;
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add server instance', 'Dnsmasq instance');
		s.renderContents = function(/* ... */) {
			const renderTask = form.TypedSection.prototype.renderContents.apply(this, arguments);
			const sections = this.cfgsections();

			return Promise.resolve(renderTask).then(function(nodes) {
				if (sections.length == 1) {
					nodes.querySelector('#cbi-dhcp-dnsmasq > h3').remove();
					nodes.querySelector('#cbi-dhcp-dnsmasq > .cbi-section-remove').remove();
				}
				else if (sections.length > 1) {
					nodes.querySelectorAll('#cbi-dhcp-dnsmasq > .cbi-section-remove').forEach(function(div, i) {
						const section = uci.get('dhcp', sections[i]);
						const hline = div.nextElementSibling;
						const btn = div.firstElementChild;

						if (!section || section['.anonymous']) {
							hline.innerText = i ? _('Unnamed instance #%d', 'Dnsmasq instance').format(i+1) : _('Default instance', 'Dnsmasq instance');
							btn.innerText = i ? _('Remove instance #%d', 'Dnsmasq instance').format(i+1) : _('Remove default instance', 'Dnsmasq instance');
						}
						else {
							hline.innerText = _('Instance "%q"', 'Dnsmasq instance').format(section['.name']);
							btn.innerText = _('Remove instance "%q"', 'Dnsmasq instance').format(section['.name']);
						}
					});
				}

				nodes.querySelector('#cbi-dhcp-dnsmasq > .cbi-section-create input').placeholder = _('New instance name…', 'Dnsmasq instance');

				return nodes;
			});
		};

		s.tab('general', _('General'));
		s.tab('devices', _('Devices &amp; Ports'));
		s.tab('logging', _('Log'));
		s.tab('files', _('Files'));
		s.tab('relay', _('Relay'));

		// Begin general
		s.taboption('general', form.Flag, 'authoritative',
			_('Authoritative'),
			_('This is the only DHCP server in the local network.'));

		s.taboption('general', form.Value, 'domain',
			_('Local domain'),
			_('Local domain suffix appended to DHCP names and hosts file entries.'));

		o = s.taboption('general', form.Flag, 'sequential_ip',
			_('Allocate IPs sequentially'),
			_('Allocate IP addresses sequentially, starting from the lowest available address.'));
		o.optional = true;

		o = s.taboption('general', form.Value, 'dhcpleasemax',
			_('Max. DHCP leases'),
			_('Maximum allowed number of active DHCP leases.'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = 150;

		o = s.taboption('general', form.Flag, 'address_as_local',
			_('Resolve addresses locally'),
			_('Never send queries for FQDNs in the Address option to an upstream resolver.'));
		o.optional = true;
		// End general

		// Begin devices
		o = s.taboption('devices', form.Flag, 'nonwildcard',
			_('Non-wildcard'),
			_('Bind only to configured interface addresses, instead of the wildcard address.'));
		o.default = o.enabled;
		o.optional = false;
		o.rmempty = true;

		o = s.taboption('devices', widgets.NetworkSelect, 'interface',
			_('Listen interfaces'),
			_('Listen only on the specified interfaces, and loopback if not excluded explicitly.'));
		o.multiple = true;
		o.nocreate = true;

		o = s.taboption('devices', widgets.IPSelect, 'listen_address',
			_('Listen addresses'),
			_('Listen only on the specified addresses.'));
		o.multiple = true;

		o = s.taboption('devices', widgets.NetworkSelect, 'notinterface',
			_('Exclude interfaces'),
			_('Do not listen on the specified interfaces.'));
		o.loopback = true;
		o.multiple = true;
		o.nocreate = true;
		// End devices

		// Begin logging
		o = s.taboption('logging', form.Flag, 'logdhcp',
			_('Extra DHCP logging'),
			_('Log all options sent to DHCP clients and the tags used to determine them.'));
		o.optional = true;

		o = s.taboption('logging', form.Value, 'logfacility',
			_('Log facility'),
			_('Set log class/facility for syslog entries.'));
		o.optional = true;
		o.value('KERN');
		o.value('USER');
		o.value('MAIL');
		o.value('DAEMON');
		o.value('AUTH');
		o.value('LPR');
		o.value('NEWS');
		o.value('UUCP');
		o.value('CRON');
		o.value('LOCAL0');
		o.value('LOCAL1');
		o.value('LOCAL2');
		o.value('LOCAL3');
		o.value('LOCAL4');
		o.value('LOCAL5');
		o.value('LOCAL6');
		o.value('LOCAL7');
		o.value('-', _('stderr'));

		o = s.taboption('logging', form.Flag, 'quietdhcp',
			_('Suppress logging'),
			_('Suppress logging of the routine operation for the DHCP protocol.'));
		o.optional = true;
		o.depends('logdhcp', '0');
		// End logging

		// Begin files
		s.taboption('files', form.Flag, 'readethers',
			_('Use %s').format('<code>/etc/ethers</code>'),
			_('Read %s to configure the DHCP server.').format('<code>/etc/ethers</code>'));

		s.taboption('files', form.Value, 'leasefile',
			_('Lease file'),
			_('File to store DHCP lease information.'));
		// End files

		// Begin relay
		o = s.taboption('relay', form.SectionValue, '__relays__', form.TableSection, 'relay', null,
			_('Relay DHCP requests elsewhere. OK: v4↔v4, v6↔v6. Not OK: v4↔v6, v6↔v4.')
			+ '<br />' + _('Note: you may also need a DHCP Proxy (currently unavailable) when specifying a non-standard Relay To port(<code>addr#port</code>).')
			+ '<br />' + _('You may add multiple unique Relay To on the same Listen addr.'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable  = true;
		ss.rowcolors = true;
		ss.nodescriptions = true;

		so = ss.option(widgets.IPSelect, 'local_addr', _('Relay from'));
		so.rmempty = false;
		so.multiple = false;

		so = ss.option(form.Value, 'server_addr', _('Relay to address'));
		so.rmempty = false;
		so.optional = false;
		so.placeholder = '192.168.10.1#535';
		so.validate = function(section, value) {
			const m = this.section.formvalue(section, 'local_addr');
			let n = this.section.formvalue(section, 'server_addr');
			let p;

			if (!m || !n) {
				return _('Both "Relay from" and "Relay to address" must be specified.');
			}
			else {
				p = n.split('#');
				if (p.length > 1 && !/^[0-9]+$/.test(p[1]))
					return _('Expected port number.');
				else
					n = p[0];

				if ((validation.parseIPv6(m) && validation.parseIPv6(n)) ||
					validation.parseIPv4(m) && validation.parseIPv4(n))
					return true;
				else
					return _('Address families of "Relay from" and "Relay to address" must match.')
			}
			return true;
		};

		so = ss.option(widgets.NetworkSelect, 'interface', _('Only accept replies via'));
		so.optional = true;
		so.rmempty = false;
		so.placeholder = 'lan';
		// End relay

		// Begin pxe_tftp
		s.tab('pxe_tftp', _('PXE/TFTP'));
		o = s.taboption('pxe_tftp', form.Flag, 'enable_tftp',
			_('Enable TFTP server'),
			_('Enable the built-in single-instance TFTP server.'));
		o.optional = true;

		o = s.taboption('pxe_tftp', form.Value, 'tftp_root',
			_('TFTP server root'),
			_('Root directory for files served via TFTP. <em>Enable TFTP server</em> and <em>TFTP server root</em> turn on the TFTP server and serve files from <em>TFTP server root</em>.'));
		o.depends('enable_tftp', '1');
		o.optional = true;
		o.placeholder = '/';

		o = s.taboption('pxe_tftp', form.Value, 'dhcp_boot',
			_('Network boot image'),
			_('Filename of the boot image advertised to clients.'));
		o.depends('enable_tftp', '1');
		o.optional = true;
		o.placeholder = 'pxelinux.0';

		// PXE - https://openwrt.org/docs/guide-user/base-system/dhcp#booting_options
		o = s.taboption('pxe_tftp', form.SectionValue, '__pxe__', form.GridSection, 'boot', null,
			_('Special <abbr title="Preboot eXecution Environment">PXE</abbr> boot options for Dnsmasq.'));
		ss = o.subsection;
		ss.addremove = true;
		ss.anonymous = true;
		ss.modaltitle = _('Edit PXE/TFTP/BOOTP Host');
		ss.nodescriptions = true;

		so = ss.option(form.Value, 'filename',
			_('Filename'),
			_('Host requests this filename from the boot server.'));
		so.optional = false;
		so.placeholder = 'pxelinux.0';

		so = ss.option(form.Value, 'servername',
			_('Server name'),
			_('The hostname of the boot server'));
		so.optional = false;
		so.placeholder = 'myNAS';

		so = ss.option(form.Value, 'serveraddress',
			_('Server address'),
			_('The IP address of the boot server'));
		so.optional = false;
		so.placeholder = '192.168.1.2';

		so = ss.option(form.DynamicList, 'dhcp_option',
			_('DHCP Options'),
			_('Additional options to send to the below match tags.') + '<br />' +
			_('%s means "the address of the system running dnsmasq".').format('<code>0.0.0.0</code>'));
		so.optional = true;
		so.placeholder = 'option:root-path,192.168.1.2:/data/netboot/root';

		so = ss.option(form.Value, 'networkid',
			_('Match this Tag'),
			_('Only DHCP Clients with this tag are sent this boot option.'));
		so.optional = true;
		so.noaliases = true;

		so = ss.option(form.Flag, 'force',
			_('Force'),
			_('Always send the chosen DHCP options. Sometimes needed, with e.g. PXELinux.'));
		so.optional = true;

		so = ss.option(form.Value, 'instance',
			_('Instance'),
			_('Dnsmasq instance to which this boot section is bound. If unspecified, the section is valid for all dnsmasq instances.'));
		so.optional = true;

		Object.values(L.uci.sections('dhcp', 'dnsmasq')).forEach(function(val, index) {
			const [name, display_str] = generateDnsmasqInstanceEntry(val);
			so.value(name, display_str);
		});
		// End pxe_tftp

		return s;
	},

	add_odhcpd_cfg(m) {
		let s, o, ss, so;

		s = m.section(form.TypedSection, 'odhcpd', _('odhcpd'));
		s.hidetitle = true;
		s.anonymous = true;

		// Begin general
		s.tab('general', _('General'),
			_('Note that many options are set on a per-interface basis in the <a href="./network">Interfaces</a> tab.'));

		o = s.taboption('general', form.Flag, 'maindhcp',
			_('DHCPv4'),
			_('Use <code>odhcp</code> for DHCPv4. This will disable DHCPv4 support in <code>dnsmasq</code>.') + '<br />' +
			_('The DHCPv4 functionality also needs to be enabled on a per-interface basis.'));

		o = s.taboption('general', form.Value, 'leasefile',
			_('Lease file'),
			_('File to store active DHCP leases in.'));

		o = s.taboption('general', form.Value, 'leasetrigger',
			_('Lease trigger'),
			_('Path to a script to run each time the lease file changes.'));

		o = s.taboption('general', form.Value, 'hostsdir',
			_('Hosts file'),
			_('Directory to store hosts files (IP address to hostname mapping) in. Used by e.g. <code>dnsmasq</code>.'));

		o = s.taboption('general', form.Value, 'piodir',
			_('PIO directory'),
			_('Directory to store IPv6 prefix information files in (to detect and announce stale prefixes).'));

		o = s.taboption('general', form.Value, 'loglevel',
			_('Log level'),
			_('Log level of the <code>odhcpd</code> daemon.'));
		o.value('0', _('Emergency'));
		o.value('1', _('Alert'));
		o.value('2', _('Critical'));
		o.value('3', _('Error'));
		o.value('4', _('Warning'));
		o.value('5', _('Notice'));
		o.value('6', _('Info'));
		o.value('7', _('Debug'));
		// End general

		// Begin pxe6
		s.tab('pxe6', _('PXE over IPv6'));

		o = s.taboption('pxe6', form.SectionValue, '__pxe6__', form.TableSection, 'boot6', null,
			_('<abbr title="Preboot eXecution Environment">PXE</abbr> over IPv6 boot options.') + '<br />' +
			_('The last entry without an architecture becomes the default.'));
		ss = o.subsection;
		ss.addremove = true;
		ss.anonymous = true;
		ss.nodescriptions = true;
		ss.sortable = true;

		// URL https://www.rfc-editor.org/rfc/rfc5970.html#section-3.1 i.e. https://www.rfc-editor.org/rfc/rfc3986
		so = ss.option(form.Value, 'url', _('URL'));
		so.optional = false;
		so.datatype = 'string';
		so.placeholder = 'tftp://[fd11::1]/pxe.efi';

		// Arch https://www.iana.org/assignments/dhcpv6-parameters/dhcpv6-parameters.xhtml#processor-architecture
		so = ss.option(form.Value, 'arch', _('Architecture'));
		so.optional = true;
		so.rmempty = true;
		so.datatype = 'range(0,65535)';
		so.default = '';
		so.value('');
		so.value('0', _('00: x86 BIOS'));
		so.value('6', _('06: x86 UEFI (IA32)'));
		so.value('7', _('07: x64 UEFI'));
		so.value('10', _('10: ARM 32-bit UEFI'));
		so.value('11', _('11: ARM 64-bit UEFI'));
		so.value('15', _('15: x86 UEFI boot from HTTP'));
		so.value('16', _('16: x64 UEFI boot from HTTP'));
		so.value('17', _('17: ebc boot from HTTP'));
		so.value('18', _('18: ARM UEFI 32 boot from HTTP'));
		so.value('19', _('19: ARM UEFI 64 boot from HTTP'));
		so.value('20', _('20: pc/at bios boot from HTTP'));
		so.value('21', _('21: ARM 32 uboot'));
		so.value('22', _('22: ARM 64 uboot'));
		so.value('23', _('23: ARM uboot 32 boot from HTTP'));
		so.value('24', _('24: ARM uboot 64 boot from HTTP'));
		so.value('25', _('25: RISC-V 32-bit UEFI'));
		so.value('26', _('26: RISC-V 32-bit UEFI boot from HTTP'));
		so.value('27', _('27: RISC-V 64-bit UEFI'));
		so.value('28', _('28: RISC-V 64-bit UEFI boot from HTTP'));
		so.value('29', _('29: RISC-V 128-bit UEFI'));
		so.value('30', _('30: RISC-V 128-bit UEFI boot from HTTP'));
		so.value('31', _('31: s390 Basic'));
		so.value('32', _('32: s390 Extended'));
		so.value('33', _('33: MIPS 32-bit UEFI'));
		so.value('34', _('34: MIPS 64-bit UEFI'));
		so.value('35', _('35: Sunway 32-bit UEFI'));
		so.value('36', _('36: Sunway 64-bit UEFI'));
		so.value('37', _('37: LoongArch 32-bit UEFI'));
		so.value('38', _('38: LoongArch 32-bit UEFI boot from HTTP'));
		so.value('39', _('39: LoongArch 64-bit UEFI'));
		so.value('39', _('40: LoongArch 64-bit UEFI boot from HTTP'));
		so.value('41', _('41: ARM rpiboot'));
		// End pxe6
	},

	add_leases_cfg(m, hosts, duids, pools, macdata) {
		const has_dhcpv6 = L.hasSystemFeature('dnsmasq', 'dhcpv6') || L.hasSystemFeature('odhcpd');
		let s, o, ss, so;

		s = m.section(form.TypedSection, '__leases__', _('Leases'));
		s.hidetitle = true;
		s.anonymous = true;
		s.cfgsections = function() { return [ '__leases__' ] };

		o = s.option(form.SectionValue, '__static_leases__', form.GridSection, 'host', null,
			_('Static leases are used to assign fixed IP addresses and symbolic hostnames to DHCP clients. They are also required for non-dynamic interface configurations where only hosts with a corresponding lease are served.') + '<br /><br />' +
			_('Use the <em>Add</em> Button to add a new lease entry. The <em>MAC address</em> identifies the host, the <em>IPv4 address</em> specifies the fixed address to use, and the <em>Hostname</em> is assigned as a symbolic name to the requesting host. The optional <em>Lease time</em> can be used to set non-standard host-specific lease time, e.g. 12h, 3d or infinite.') + '<br /><br />' +
			_('The tag construct filters which host directives are used; more than one tag can be provided, in this case the request must match all of them. Tagged directives are used in preference to untagged ones. Note that one of mac, duid or hostname still needs to be specified (can be a wildcard).'));
		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;
		ss.sortable = true;
		ss.nodescriptions = true;
		ss.max_cols = 8;
		ss.modaltitle = _('Edit static lease');

		so = ss.option(form.Value, 'name',
			_('Hostname'),
			_('The hostname for this host (optional).'));
		so.validate = validateHostname;
		so.rmempty  = true;
		so.write = function(section, value) {
			uci.set('dhcp', section, 'name', value);
			uci.set('dhcp', section, 'dns', '1');
		};
		so.remove = function(section) {
			uci.unset('dhcp', section, 'name');
			uci.unset('dhcp', section, 'dns');
		};

		so = ss.option(form.DynamicList, 'mac',
			_('MAC Addresses'),
			_('The hardware address(es) of this host.') + '<br /><br />' +
			_('The same IPv4 address will be (re)assigned to <em>any</em> host using one of the MAC addresses listed above.') + '<br />' +
			_('Only one of the MAC addresses is expected to be in active use on the network at any given time.'));
		so.rmempty  = true;
		so.cfgvalue = function(section) {
			const macs = uci.get('dhcp', section, 'mac');
			let formattedMacs;
			let hint, entry;

			if(!Array.isArray(macs)){
				formattedMacs = expandAndFormatMAC(L.toArray(macs));
			} else {
				formattedMacs = expandAndFormatMAC(macs);
			}

			if (!macdata) {
				return formattedMacs;
			}


			if (Array.isArray(formattedMacs)){
				for (let mac in formattedMacs) {
					entry = formattedMacs[mac].toLowerCase();
					if (macdata[entry]) {
						hint = macdata[entry].vendor ? macdata[entry].vendor : null;
						formattedMacs[mac] += ` (${hint})`;
					}
				}
				return formattedMacs;
			}

			if (formattedMacs) {
				entry = formattedMacs[0].toLowerCase();
				hint = macdata[entry].vendor ? macdata[entry].vendor : null;
				formattedMacs[0] += ` (${hint})`;
			}
			return formattedMacs;
		};
		so.validate = function(section_id, value) {
			// check MAC isn't in use in other host entries
			if (!section_id) return true;
			const this_macs = this.section.formvalue(section_id, 'mac')
				.map(function(m) { return m.toUpperCase() });

			for (const host of uci.sections('dhcp', 'host')) {
				if (host['.name'] == section_id)
					continue;
				const host_macs = L.toArray(host.mac).map(function(m) { return m.toUpperCase() });
				if (host_macs.some(lm => this_macs.includes(lm)))
					return _('The MAC address %h is already used by another static lease in the same DHCP pool')
						.format(host_macs.find(lm => this_macs.includes(lm)));
			}
			return isValidMAC(section_id, value);
		}
		Object.keys(hosts).forEach(function(mac) {
			let vendor;
			const lower_mac = mac.toLowerCase();
			if (macdata)
				vendor = macdata[lower_mac] ? macdata[lower_mac].vendor : null;
			const hint = vendor || hosts[mac].name || L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4)[0];
			so.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
		});

		so = ss.option(form.Value, 'ip', _('IPv4 address'), _('The IPv4 address for this host, or <em>ignore</em> to ignore DHCP requests from this host.'));
		so.value('ignore', _('Ignore'));
		so.datatype = 'or(ip4addr,"ignore")';
		so.validate = function(section, value) {
			const m = this.section.formvalue(section, 'mac');
			const n = this.section.formvalue(section, 'name');

			if ((m && !m.length > 0) && !n)
				return _('One of hostname or MAC address must be specified!');

			if (!value || value == 'ignore')
				return true;

			const leases = uci.sections('dhcp', 'host');

			for (const lease of leases)
				if (lease['.name'] != section && lease.ip == value)
					return _('The IP address %h is already used by another static lease').format(value);

			for (const pool of pools) {
				const net_mask = calculateNetwork(value, pool.netmask);

				if (net_mask && net_mask[0] == pool.network)
					return true;
			}

			return _('The IP address is outside of any DHCP pool address range');
		};
		const ipaddrs = {};
		Object.keys(hosts).forEach(function(mac) {
			for (const ip of L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4))
				ipaddrs[ip] = hosts[mac].name || mac;
		});
		L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ipv4) {
			o.value(ipv4, ipaddrs[ipv4] ? '%s (%s)'.format(ipv4, ipaddrs[ipv4]) : ipv4);
		});

		so = ss.option(form.Value, 'leasetime',
			_('Lease time'),
			_('Host-specific lease time, e.g. <code>5m</code>, <code>3h</code>, <code>7d</code>.'));
		so.rmempty = true;
		so.value('5m', _('5m (5 minutes)'));
		so.value('3h', _('3h (3 hours)'));
		so.value('12h', _('12h (12 hours - default)'));
		so.value('7d', _('7d (7 days)'));
		so.value('infinite', _('infinite (lease does not expire)'));

		so = ss.option(form.DynamicList, 'duid',
			_('DUID/IAIDs'),
			_('The <abbr title="Dynamic Host Configuration Protocol for IPv6">DHCPv6</abbr>-<abbr title="DHCP Unique Identifier">DUID</abbr>s and, optionally, <abbr title="Identity Association Identifier">IAID</abbr>s of this host.') + '<br /><br />' +
			_('The same IPv6 addresses will be (re)assigned to <em>any</em> host using one of the <code>DUID</code> or <code>DUID%IAID</code> values listed above. Only one is expected to be in active use on the network at any given time.') + '<br /><br />' +
			_('Syntax: <code>&lt;DUID-hex-str&gt;</code> <em>or</em> <code>&lt;DUID-hex-str&gt;%&lt;IAID-hex-str&gt;</code>'));
		so.rmempty = true;
		so.validate = validateDUIDIAID;
		Object.keys(duids).forEach(function(duid_iaid) {
			const desc = duids[duid_iaid].hostname || duids[duid_iaid].macaddr || duids[duid_iaid].ip6addrs[0] || '?';
			so.value(duid_iaid, '%s (%s)'.format(duid_iaid, desc));
		});

		so = ss.option(form.Value, 'hostid',
			_('IPv6 Token'),
			_('The hexadecimal <abbr title="Address suffix"><a href="%s">IPv6 token</a></abbr> for this host (up to 16 chars, i.e. 64 bits).')
			.format('https://datatracker.ietf.org/doc/html/draft-chown-6man-tokenised-ipv6-identifiers-02'));
		so.datatype = 'and(rangelength(0,16),hexstring)';

		so = ss.option(form.DynamicList, 'tag',
			_('Tag'),
			_('Additional tags for this host.'));

		so = ss.option(form.DynamicList, 'match_tag',
			_('Match Tag'),
			_('When a host matches an entry then the special tag %s is set. Use %s to match all known hosts.').format('<code>known</code>', '<code>known</code>') + '<br /><br />' +
			_('Ignore requests from unknown machines using %s.').format('<code>!known</code>') + '<br /><br />' +
			_('If a host matches an entry which cannot be used because it specifies an address on a different subnet, the tag %s is set.').format('<code>known-othernet</code>'));
		so.value('known', _('known'));
		so.value('!known', _('!known (not known)'));
		so.value('known-othernet', _('known-othernet (on different subnet)'));
		so.optional = true;

		so = ss.option(form.Value, 'instance',
			_('Instance'),
			_('Dnsmasq instance to which this DHCP host section is bound. If unspecified, the section is valid for all dnsmasq instances.'));
		so.optional = true;
		Object.values(L.uci.sections('dhcp', 'dnsmasq')).forEach(function(val, index) {
			const [name, display_str] = generateDnsmasqInstanceEntry(val);
			so.value(name, display_str);
		});

		so = ss.option(form.Flag, 'broadcast',
			_('Broadcast'),
			_('Force broadcast DHCP response.'));

		so = ss.option(form.Flag, 'dns',
			_('Forward/reverse DNS'),
			_('Add static forward and reverse DNS entries for this host.'));

		s.option(CBILeaseStatus, '__status__');

		if (has_dhcpv6)
			s.option(CBILease6Status, '__status6__');
	}
});
