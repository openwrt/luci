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

var callHostHints, callDUIDHints, callDHCPLeases, CBILeaseStatus, CBILease6Status;
var callUfpList;

callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

callDUIDHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getDUIDHints',
	expect: { '': {} }
});

callDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	expect: { '': {} }
});

callUfpList = rpc.declare({
	object: 'fingerprint',
	method: 'fingerprint',
	expect: { '': {} }
});

CBILeaseStatus = form.DummyValue.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		return E([
			E('h4', _('Active DHCP Leases')),
			E('table', { 'id': 'lease_status_table', 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Hostname')),
					E('th', { 'class': 'th' }, _('IPv4 address')),
					E('th', { 'class': 'th' }, _('MAC address')),
					E('th', { 'class': 'th' }, _('Lease time remaining'))
				]),
				E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td' }, E('em', _('Collecting data...')))
				])
			])
		]);
	}
});

CBILease6Status = form.DummyValue.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		return E([
			E('h4', _('Active DHCPv6 Leases')),
			E('table', { 'id': 'lease6_status_table', 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Hostname')),
					E('th', { 'class': 'th' }, _('IPv6 address')),
					E('th', { 'class': 'th' }, _('DUID')),
					E('th', { 'class': 'th' }, _('IAID')),
					E('th', { 'class': 'th' }, _('Lease time remaining'))
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

function generateDnsmasqInstanceEntry(data) {
	const nameValueMap = new Map(Object.entries(data));
	let formatString = nameValueMap.get('.index') + ' (' +  _('Name') + (nameValueMap.get('.anonymous') ? ': dnsmasq[' + nameValueMap.get('.index') + ']': ': ' + nameValueMap.get('.name'));

	if (data.domain) {
		formatString += ', ' +  _('Domain')  + ': ' + data.domain;
	}
	if (data.local) {
		formatString += ', ' +  _('Local')  + ': ' + data.local;
	}
	formatString += ')';

	return [nameValueMap.get('.name'), formatString];
}

function getDHCPPools() {
	return uci.load('dhcp').then(function() {
		let sections = uci.sections('dhcp', 'dhcp'),
		    tasks = [], pools = [];

		for (var i = 0; i < sections.length; i++) {
			if (sections[i].ignore == '1' || !sections[i].interface)
				continue;

			tasks.push(network.getNetwork(sections[i].interface).then(L.bind(function(section_id, net) {
				var cidr = net ? (net.getIPAddrs()[0] || '').split('/') : null;

				if (cidr && cidr.length == 2) {
					var net_mask = calculateNetwork(cidr[0], cidr[1]);

					pools.push({
						section_id: section_id,
						network: net_mask[0],
						netmask: net_mask[1]
					});
				}
			}, null, sections[i]['.name'])));
		}

		return Promise.all(tasks).then(function() {
			return pools;
		});
	});
}

function validateHostname(sid, s) {
	if (s == null || s == '')
		return true;

	if (s.length > 256)
		return _('Expecting: %s').format(_('valid hostname'));

	var labels = s.replace(/^\*?\.?|\.$/g, '').split(/\./);

	for (var i = 0; i < labels.length; i++)
		if (!labels[i].match(/^[a-z0-9_](?:[a-z0-9-]{0,61}[a-z0-9])?$/i))
			return _('Expecting: %s').format(_('valid hostname'));

	return true;
}

function expandAndFormatMAC(macs) {
	let result = [];

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
	if (!s)
		return true;

	let macaddrs = L.toArray(s);

	for (var i = 0; i < macaddrs.length; i++)
		if (!macaddrs[i].match(/^(([0-9a-f]{1,2}|\*)[:-]){5}([0-9a-f]{1,2}|\*)$/i))
			return _('Expecting a valid MAC address, optionally including wildcards') + _('; invalid MAC: ') + macaddrs[i];

	return true;
}

function validateMACAddr(pools, sid, s) {
	if (s == null || s == '')
		return true;

	var leases = uci.sections('dhcp', 'host'),
	    this_macs = L.toArray(s).map(function(m) { return m.toUpperCase() });

	for (var i = 0; i < pools.length; i++) {
		var this_net_mask = calculateNetwork(this.section.formvalue(sid, 'ip'), pools[i].netmask);

		if (!this_net_mask)
			continue;

		for (var j = 0; j < leases.length; j++) {
			if (leases[j]['.name'] == sid || !leases[j].ip)
				continue;

			var lease_net_mask = calculateNetwork(leases[j].ip, pools[i].netmask);

			if (!lease_net_mask || this_net_mask[0] != lease_net_mask[0])
				continue;

			var lease_macs = L.toArray(leases[j].mac).map(function(m) { return m.toUpperCase() });

			for (var k = 0; k < lease_macs.length; k++)
				for (var l = 0; l < this_macs.length; l++)
					if (lease_macs[k] == this_macs[l])
						return _('The MAC address %h is already used by another static lease in the same DHCP pool').format(this_macs[l]);
		}
	}

	return isValidMAC(sid, s);
}

return view.extend({
	load: function() {
		return Promise.all([
			callHostHints(),
			callDUIDHints(),
			getDHCPPools(),
			network.getNetworks(),
			L.hasSystemFeature('ufpd') ? callUfpList() : null,
			uci.load('firewall')
		]);
	},

	render: function([hosts, duids, pools, networks, macdata]) {
		var has_dhcpv6 = L.hasSystemFeature('dnsmasq', 'dhcpv6') || L.hasSystemFeature('odhcpd'),
		    m, s, o, ss, so;

		let noi18nstrings = {
			etc_ethers: '<code>/etc/ethers</code>',
		};

		function customi18n(template, values) {
			if (!values)
				values = noi18nstrings;
			return template.replace(/\{(\w+)\}/g, (match, key) => values[key] || match);
		};

		m = new form.Map('dhcp', _('DHCP'));

		s = m.section(form.TypedSection, 'dnsmasq');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add server instance', 'Dnsmasq instance');

		s.renderContents = function(/* ... */) {
			var renderTask = form.TypedSection.prototype.renderContents.apply(this, arguments),
			    sections = this.cfgsections();

			return Promise.resolve(renderTask).then(function(nodes) {
				if (sections.length < 2) {
					nodes.querySelector('#cbi-dhcp-dnsmasq > h3').remove();
					nodes.querySelector('#cbi-dhcp-dnsmasq > .cbi-section-remove').remove();
				}
				else {
					nodes.querySelectorAll('#cbi-dhcp-dnsmasq > .cbi-section-remove').forEach(function(div, i) {
						var section = uci.get('dhcp', sections[i]),
						    hline = div.nextElementSibling,
						    btn = div.firstElementChild;

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
		s.tab('leases', _('Static Leases'));
		s.tab('relay', _('Relay'));
		s.tab('pxe_tftp', _('PXE/TFTP'));

		var ipaddrs = {};

		Object.keys(hosts).forEach(function(mac) {
			var addrs = L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4);

			for (var i = 0; i < addrs.length; i++)
				ipaddrs[addrs[i]] = hosts[mac].name || mac;
		});

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
			customi18n(_('Use {etc_ethers}') ),
			customi18n(_('Read {etc_ethers} to configure the DHCP server.') )
			);

		s.taboption('files', form.Value, 'leasefile',
			_('Lease file'),
			_('File to store DHCP lease information.'));
		// End files

		// Begin leases
		o = s.taboption('leases', form.SectionValue, '__leases__', form.GridSection, 'host', null,
			_('Static leases are used to assign fixed IP addresses and symbolic hostnames to DHCP clients. They are also required for non-dynamic interface configurations where only hosts with a corresponding lease are served.') + '<br /><br />' +
			_('Use the <em>Add</em> Button to add a new lease entry. The <em>MAC address</em> identifies the host, the <em>IPv4 address</em> specifies the fixed address to use, and the <em>Hostname</em> is assigned as a symbolic name to the requesting host. The optional <em>Lease time</em> can be used to set non-standard host-specific lease time, e.g. 12h, 3d or infinite.') + '<br /><br />' +
			_('The tag construct filters which host directives are used; more than one tag can be provided, in this case the request must match all of them. Tagged directives are used in preference to untagged ones. Note that one of mac, duid or hostname still needs to be specified (can be a wildcard).'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable = true;
		ss.nodescriptions = true;
		ss.max_cols = 8;
		ss.modaltitle = _('Edit static lease');

		so = ss.option(form.Value, 'name',
			_('Hostname'),
			_('Optional hostname to assign'));
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

		//this can be a .DynamicList or a .Value with a widget and dnsmasq handles multimac OK.
		so = ss.option(form.DynamicList, 'mac',
			_('MAC address(es)'),
			_('The hardware address(es) of this entry/host.') + '<br /><br />' +
			_('In DHCPv4, it is possible to include more than one mac address. This allows an IP address to be associated with multiple macaddrs, and dnsmasq abandons a DHCP lease to one of the macaddrs when another asks for a lease. It only works reliably if only one of the macaddrs is active at any time.'));
		//As a special case, in DHCPv4, it is possible to include more than one hardware address. eg: --dhcp-host=11:22:33:44:55:66,12:34:56:78:90:12,192.168.0.2 This allows an IP address to be associated with multiple hardware addresses, and gives dnsmasq permission to abandon a DHCP lease to one of the hardware addresses when another one asks for a lease
		so.rmempty  = true;
		so.cfgvalue = function(section) {
			var macs = uci.get('dhcp', section, 'mac');
			var formattedMacs;
			var hint, entry;

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
		//removed jows renderwidget function which hindered multi-mac entry
		so.validate = validateMACAddr.bind(so, pools);
		Object.keys(hosts).forEach(function(mac) {
			var vendor;
			var lower_mac = mac.toLowerCase();
			if (macdata)
				vendor = macdata[lower_mac] ? macdata[lower_mac].vendor : null;
			const hint = vendor || hosts[mac].name || L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4)[0];
			so.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
		});

		so = ss.option(form.Value, 'ip', _('IPv4 address'), _('The IP address to be used for this host, or <em>ignore</em> to ignore any DHCP request from this host.'));
		so.value('ignore', _('Ignore'));
		so.datatype = 'or(ip4addr,"ignore")';
		so.validate = function(section, value) {
			var m = this.section.formvalue(section, 'mac'),
			    n = this.section.formvalue(section, 'name');

			if ((m && !m.length > 0) && !n)
				return _('One of hostname or MAC address must be specified!');

			if (!value || value == 'ignore')
				return true;

			var leases = uci.sections('dhcp', 'host');

			for (var i = 0; i < leases.length; i++)
				if (leases[i]['.name'] != section && leases[i].ip == value)
					return _('The IP address %h is already used by another static lease').format(value);

			for (var i = 0; i < pools.length; i++) {
				var net_mask = calculateNetwork(value, pools[i].netmask);

				if (net_mask && net_mask[0] == pools[i].network)
					return true;
			}

			return _('The IP address is outside of any DHCP pool address range');
		};

		L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ipv4) {
			so.value(ipv4, ipaddrs[ipv4] ? '%s (%s)'.format(ipv4, ipaddrs[ipv4]) : ipv4);
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

		so = ss.option(form.Value, 'duid',
			_('DUID'),
			_('The DHCPv6-DUID (DHCP unique identifier) of this host.'));
		so.datatype = 'and(rangelength(20,36),hexstring)';
		Object.keys(duids).forEach(function(duid) {
			so.value(duid, '%s (%s)'.format(duid, duids[duid].hostname || duids[duid].macaddr || duids[duid].ip6addr || '?'));
		});

		so = ss.option(form.Value, 'hostid',
			_('IPv6-Suffix (hex)'),
			_('The IPv6 interface identifier (address suffix) as hexadecimal number (max. 16 chars).'));
		so.datatype = 'and(rangelength(0,16),hexstring)';

		so = ss.option(form.DynamicList, 'tag',
			_('Tag'),
			_('Assign new, freeform tags to this entry.'));

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
			var [name, display_str] = generateDnsmasqInstanceEntry(val);
			so.value(name, display_str);
		});


		so = ss.option(form.Flag, 'broadcast',
			_('Broadcast'),
			_('Force broadcast DHCP response.'));

		so = ss.option(form.Flag, 'dns',
			_('Forward/reverse DNS'),
			_('Add static forward and reverse DNS entries for this host.'));

		o = s.taboption('leases', CBILeaseStatus, '__status__');

		if (has_dhcpv6)
			o = s.taboption('leases', CBILease6Status, '__status6__');
		// End leases

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

		so = ss.option(form.Value, 'local_addr', _('Relay from'));
		so.rmempty = false;
		so.datatype = 'ipaddr';

		for (var family = 4; family <= 6; family += 2) {
			for (var i = 0; i < networks.length; i++) {
				if (networks[i].getName() != 'loopback') {
					var addrs = (family == 6) ? networks[i].getIP6Addrs() : networks[i].getIPAddrs();
					for (var j = 0; j < addrs.length; j++) {
						var addr = addrs[j].split('/')[0];
						so.value(addr, E([], [
							addr, ' (',
							widgets.NetworkSelect.prototype.renderIfaceBadge(networks[i]),
							')'
						]));
					}
				}
			}
		}

		so = ss.option(form.Value, 'server_addr', _('Relay to address'));
		so.rmempty = false;
		so.optional = false;
		so.placeholder = '192.168.10.1#535';
		so.validate = function(section, value) {
			var m = this.section.formvalue(section, 'local_addr'),
			    n = this.section.formvalue(section, 'server_addr'),
			    p;

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

		/* PXE - https://openwrt.org/docs/guide-user/base-system/dhcp#booting_options */
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
			var [name, display_str] = generateDnsmasqInstanceEntry(val);
			so.value(name, display_str);
		});

		o = s.taboption('pxe_tftp', form.SectionValue, '__pxe6__', form.TableSection, 'boot6', null,
			_('Special <abbr title="Preboot eXecution Environment">PXE</abbr> boot options for odhcpd IPv6.') + ' ' +
			_('The last entry absent architecture becomes the default.'));
		ss = o.subsection;
		ss.addremove = true;
		ss.anonymous = true;
		ss.nodescriptions = true;
		ss.sortable = true;

		/* URL https://www.rfc-editor.org/rfc/rfc5970.html#section-3.1 i.e. https://www.rfc-editor.org/rfc/rfc3986 */
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
		// End pxe_tftp


		return m.render().then(function(mapEl) {
			poll.add(function() {
				return callDHCPLeases().then(function(leaseinfo) {
					var leases = Array.isArray(leaseinfo.dhcp_leases) ? leaseinfo.dhcp_leases : [],
					    leases6 = Array.isArray(leaseinfo.dhcp6_leases) ? leaseinfo.dhcp6_leases : [];

					cbi_update_table(mapEl.querySelector('#lease_status_table'),
						leases.map(function(lease) {
							var exp;
							var vendor;

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

							var hint = lease.macaddr ? hosts[lease.macaddr] : null,
							    name = hint ? hint.name : null,
							    host = null;

							if (name && lease.hostname && lease.hostname != name)
								host = '%s (%s)'.format(lease.hostname, name);
							else if (lease.hostname)
								host = lease.hostname;

							return [
								host || '-',
								lease.ipaddr,
								vendor ? lease.macaddr + vendor : lease.macaddr,
								exp
							];
						}),
						E('em', _('There are no active leases')));

					if (has_dhcpv6) {
						cbi_update_table(mapEl.querySelector('#lease6_status_table'),
							leases6.map(function(lease) {
								var exp;

								if (lease.expires === false)
									exp = E('em', _('unlimited'));
								else if (lease.expires <= 0)
									exp = E('em', _('expired'));
								else
									exp = '%t'.format(lease.expires);

								var hint = lease.macaddr ? hosts[lease.macaddr] : null,
								    name = hint ? (hint.name || L.toArray(hint.ipaddrs || hint.ipv4)[0] || L.toArray(hint.ip6addrs || hint.ipv6)[0]) : null,
								    host = null;

								if (name && lease.hostname && lease.hostname != name && lease.ip6addr != name)
									host = '%s (%s)'.format(lease.hostname, name);
								else if (lease.hostname)
									host = lease.hostname;
								else if (name)
									host = name;

								return [
									host || '-',
									lease.ip6addrs ? lease.ip6addrs.join('<br />') : lease.ip6addr,
									lease.duid,
									lease.iaid,
									exp
								];
							}),
							E('em', _('There are no active leases')));
					}
				});
			});

			return mapEl;
		});
	}
});
