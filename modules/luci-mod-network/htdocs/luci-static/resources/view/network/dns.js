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
'require tools.dnsrecordhandlers as drh';

const callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

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

function validateAddressList(sid, s) {
	if (!s) return true;

	const m = s.match(/^\/(.+)\/$/);
	const names = m ? m[1].split(/\//) : [ s ];

	for (const name of names) {
		const res = validateHostname(sid, name);

		if (res !== true)
			return res;
	}

	return true;
}

function validateServerSpec(sid, s) {
	if (!s) return true;

	let m = s.match(/^(\/.*\/)?(.*)$/);
	if (!m)
		return _('Expecting: %s').format(_('valid hostname'));

	if (m[1] != '//' && m[1] != '/#/') {
		const res = validateAddressList(sid, m[1]);
		if (res !== true)
			return res;
	}

	if (m[2] == '' || m[2] == '#')
		return true;

	// ipaddr%scopeid#srvport@source@interface#srcport

	m = m[2].match(/^([0-9a-f:.]+)(?:%[^#@]+)?(?:#(\d+))?(?:@([0-9a-f:.]+)(?:@[^#]+)?(?:#(\d+))?)?$/);

	if (!m)
		return _('Expecting: %s').format(_('valid IP address'));

	if (validation.parseIPv4(m[1])) {
		if (m[3] != null && !validation.parseIPv4(m[3]))
			return _('Expecting: %s').format(_('valid IPv4 address'));
	}
	else if (validation.parseIPv6(m[1])) {
		if (m[3] != null && !validation.parseIPv6(m[3]))
			return _('Expecting: %s').format(_('valid IPv6 address'));
	}
	else {
		return _('Expecting: %s').format(_('valid IP address'));
	}

	if ((m[2] != null && +m[2] > 65535) || (m[4] != null && +m[4] > 65535))
		return _('Expecting: %s').format(_('valid port value'));

	return true;
}

return view.extend({
	load: function() {
		return Promise.all([
			callHostHints(),
			uci.load('firewall')
		]);
	},

	render: function([hosts]) {
		let m, s, o, ss, so, dnss;

		let noi18nstrings = {
			etc_hosts: '<code>/etc/hosts</code>',
			localhost_v6: '<code>::1</code>',
			loopback_slash_8_v4: '<code>127.0.0.0/8</code>',
			not_found: '<code>Not found</code>',
			nxdomain: '<code>NXDOMAIN</code>',
			rfc_1918_link: '<a href="https://www.rfc-editor.org/rfc/rfc1918">RFC1918</a>',
			rfc_4193_link: '<a href="https://www.rfc-editor.org/rfc/rfc4193">RFC4193</a>',
			rfc_4291_link: '<a href="https://www.rfc-editor.org/rfc/rfc4291">RFC4291</a>',
			rfc_6303_link: '<a href="https://www.rfc-editor.org/rfc/rfc6303">RFC6303</a>',
			reverse_arpa: '<code>*.IN-ADDR.ARPA,*.IP6.ARPA</code>',
			servers_file_entry01: '<code>server=1.2.3.4</code>',
			servers_file_entry02: '<code>server=/domain/1.2.3.4</code>',

		};

		const recordtypes = [
			'ANY',
			'A',
			'AAAA',
			'ALIAS',
			'CAA',
			'CERT',
			'CNAME',
			'DS',
			'HINFO',
			'HIP',
			'HTTPS',
			'KEY',
			'LOC',
			'MX',
			'NAPTR',
			'NS',
			'OPENPGPKEY',
			'PTR',
			'RP',
			'SIG',
			'SOA',
			'SRV',
			'SSHFP',
			'SVCB',
			'TLSA',
			'TXT',
			'URI',
		]

		function customi18n(template, values) {
			if (!values)
				values = noi18nstrings;
			return template.replace(/\{(\w+)\}/g, (match, key) => values[key] || match);
		};

		m = new form.Map('dhcp', _('DNS'));

		s = m.section(form.TypedSection, 'dnsmasq');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add server instance', 'Dnsmasq instance');

		s.renderContents = function(/* ... */) {
			const renderTask = form.TypedSection.prototype.renderContents.apply(this, arguments);
			const sections = this.cfgsections();

			return Promise.resolve(renderTask).then(function(nodes) {
				if (sections.length < 2) {
					nodes.querySelector('#cbi-dhcp-dnsmasq > h3').remove();
					nodes.querySelector('#cbi-dhcp-dnsmasq > .cbi-section-remove').remove();
				}
				else {
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
		s.tab('cache', _('Cache'));
		s.tab('devices', _('Devices &amp; Ports'));
		s.tab('dnsrecords', _('DNS Records'));
		s.tab('dnssecopt', _('DNSSEC'));
		s.tab('filteropts', _('Filter'));
		s.tab('forward', _('Forwards'));
		s.tab('limits', _('Limits'));
		s.tab('logging', _('Log'));
		s.tab('files', _('Resolv &amp; Hosts Files'));
		s.tab('ipsets', _('IP Sets'));

		// Begin general
		o = s.taboption('general', form.Value, 'local',
			_('Resolve these locally'),
			_('Never forward these matching domains or subdomains; resolve from DHCP or hosts files only.'));
		o.placeholder = '/internal.example.com/private.example.com/example.org';

		s.taboption('general', form.Value, 'domain',
			_('Local domain'),
			_('Local domain suffix appended to DHCP names and hosts file entries.'));

		s.taboption('general', form.Flag, 'expandhosts',
			_('Expand hosts'),
			_('Add local domain suffix to names served from hosts files.'));

		o = s.taboption('general', form.DynamicList, 'address',
			_('Addresses'),
			_('Resolve specified FQDNs to an IP.') + '<br />' +
			customi18n(_('Syntax: {code_syntax}.'),
				{code_syntax: '<code>/fqdn[/fqdn…]/[ipaddr]</code>'}) + '<br />' +
			customi18n(_('{example_nx} returns {nxdomain}.',
				'hint: <code>/example.com/</code> returns <code>NXDOMAIN</code>.'),
				{example_nx: '<code>/example.com/</code>', nxdomain: '<code>NXDOMAIN</code>'}) + '<br />' +
			customi18n(_('{any_domain} matches any domain (and returns {nxdomain}).',
				'hint: <code>/#/</code> matches any domain (and returns NXDOMAIN).'),
				{any_domain:'<code>/#/</code>', nxdomain: '<code>NXDOMAIN</code>'}) + '<br />' +
			customi18n(
				_('{example_null} returns {null_addr} addresses ({null_ipv4}, {null_ipv6}) for {example_com} and its subdomains.',
					'hint: <code>/example.com/#</code> returns NULL addresses (<code>0.0.0.0</code>, <code>::</code>) for example.com and its subdomains.'),
				{	example_null: '<code>/example.com/#</code>',
					null_addr: '<code>NULL</code>',
					null_ipv4: '<code>0.0.0.0</code>',
					null_ipv6: '<code>::</code>',
					example_com: '<code>example.com</code>',
				}
			)
		);
		o.optional = true;
		o.placeholder = '/router.local/router.lan/192.168.0.1';

		o = s.taboption('general', form.DynamicList, 'ipset',
			_('IP sets'),
			_('List of IP sets to populate with the IPs of DNS lookup results of the FQDNs also specified here.'));
		o.optional = true;
		o.placeholder = '/example.org/ipset,ipset6';

		o = s.taboption('general', form.Flag, 'allservers',
			_('All servers'),
			_('Query all available upstream resolvers.') + ' ' + _('First answer wins.'));
		o.optional = true;
		// End general

		// Begin cache
		o = s.taboption('cache', form.MultiValue, 'cache_rr',
			_('Cache arbitrary RR'), _('By default, dnsmasq caches A, AAAA, CNAME and SRV DNS record types.') + '<br/>' +
			_('This option adds additional record types to the cache.'));
		o.optional = true;
		o.create = true;
		o.multiple = true;
		o.display_size = 5;
		recordtypes.forEach(r => {
			o.value(r);
		});
		// End cache

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

		o = s.taboption('devices', form.Value, 'port',
			_('DNS server port'),
			_('Listening port for inbound DNS queries.'));
		o.optional = true;
		o.datatype = 'port';
		o.placeholder = 53;

		o = s.taboption('devices', form.Value, 'queryport',
			_('DNS query port'),
			_('Fixed source port for outbound DNS queries.'));
		o.optional = true;
		o.datatype = 'port';
		o.placeholder = _('any');

		o = s.taboption('devices', form.Value, 'minport',
			_('Minimum source port #'),
			_('Min valid value %s.').format('<code>1024</code>') + ' ' + _('Useful for systems behind firewalls.'));
		o.optional = true;
		o.datatype = 'port';
		o.placeholder = 1024;
		o.depends('queryport', '');

		o = s.taboption('devices', form.Value, 'maxport',
			_('Maximum source port #'),
			_('Max valid value %s.').format('<code>65535</code>') + ' ' + _('Useful for systems behind firewalls.'));
		o.optional = true;
		o.datatype = 'port';
		o.placeholder = 50000;
		o.depends('queryport', '');
		// End devices

		// Begin dnsrecords
		o = s.taboption('dnsrecords', form.SectionValue, '__dnsrecords__', form.TypedSection, '__dnsrecords__');

		dnss = o.subsection;

		dnss.anonymous = true;
		dnss.cfgsections = function() { return [ '__dnsrecords__' ] };

		dnss.tab('hosts', _('Hostnames'));
		dnss.tab('srvhosts', _('SRV'));
		dnss.tab('mxhosts', _('MX'));
		dnss.tab('cnamehosts', _('CNAME'));
		dnss.tab('dnsrr', _('DNS-RR'));

		o = dnss.taboption('srvhosts', form.SectionValue, '__srvhosts__', form.TableSection, 'srvhost', null,
			_('Bind service records to a domain name: specify the location of services. See <a href="%s">RFC2782</a>.').format('https://datatracker.ietf.org/doc/html/rfc2782')
			+ '<br />' + _('_service: _sip, _ldap, _imap, _stun, _xmpp-client, … . (Note: while _http is possible, no browsers support SRV records.)')
			+ '<br />' + _('_proto: _tcp, _udp, _sctp, _quic, … .')
			+ '<br />' + _('You may add multiple records for the same Target.')
			+ '<br />' + _('Larger weights (of the same prio) are given a proportionately higher probability of being selected.'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable  = true;
		ss.rowcolors = true;

		so = ss.option(form.Value, 'srv', _('SRV'), _('Syntax:') + ' ' + '<code>_service._proto.example.com.</code>');
		so.rmempty = false;
		so.datatype = 'hostname';
		so.placeholder = '_sip._tcp.example.com.';

		so = ss.option(form.Value, 'target', _('Target'), _('CNAME or fqdn'));
		so.rmempty = false;
		so.datatype = 'hostname';
		so.placeholder = 'sip.example.com.';

		so = ss.option(form.Value, 'port', _('Port'));
		so.rmempty = false;
		so.datatype = 'port';
		so.placeholder = '5060';

		so = ss.option(form.Value, 'class', _('Priority'), _('Ordinal: lower comes first.'));
		so.rmempty = true;
		so.datatype = 'range(0,65535)';
		so.placeholder = '10';

		so = ss.option(form.Value, 'weight', _('Weight'));
		so.rmempty = true;
		so.datatype = 'range(0,65535)';
		so.placeholder = '50';

		o = dnss.taboption('mxhosts', form.SectionValue, '__mxhosts__', form.TableSection, 'mxhost', null,
			_('Bind service records to a domain name: specify the location of services.')
			 + '<br />' + _('You may add multiple records for the same domain.'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable  = true;
		ss.rowcolors = true;
		ss.nodescriptions = true;

		so = ss.option(form.Value, 'domain', _('Domain'));
		so.rmempty = false;
		so.datatype = 'hostname';
		so.placeholder = 'example.com.';

		so = ss.option(form.Value, 'relay', _('Relay'));
		so.rmempty = false;
		so.datatype = 'hostname';
		so.placeholder = 'relay.example.com.';

		so = ss.option(form.Value, 'pref', _('Priority'), _('Ordinal: lower comes first.'));
		so.rmempty = true;
		so.datatype = 'range(0,65535)';
		so.placeholder = '0';

		o = dnss.taboption('cnamehosts', form.SectionValue, '__cname__', form.TableSection, 'cname', null,
			_('Set an alias for a hostname.'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable  = true;
		ss.rowcolors = true;
		ss.nodescriptions = true;

		so = ss.option(form.Value, 'cname', _('Domain'));
		so.rmempty = false;
		so.validate = validateHostname;
		so.placeholder = 'www.example.com.';

		so = ss.option(form.Value, 'target', _('Target'));
		so.rmempty = false;
		so.datatype = 'hostname';
		so.placeholder = 'example.com.';

		o = dnss.taboption('hosts', form.SectionValue, '__hosts__', form.GridSection, 'domain', null,
			_('Hostnames are used to bind a domain name to an IP address. This setting is redundant for hostnames already configured with static leases, but it can be useful to rebind an FQDN.'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable  = true;

		so = ss.option(form.Value, 'name', _('Hostname'));
		so.rmempty = false;
		so.datatype = 'hostname';

		so = ss.option(form.Value, 'ip', _('IP address'));
		so.rmempty = false;
		so.datatype = 'ipaddr("nomask")';

		const ipaddrs = {};

		Object.keys(hosts).forEach(function(mac) {
			for (const addr of L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4))
				ipaddrs[addr] = hosts[mac].name || mac;
		});

		L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ipv4) {
			so.value(ipv4, '%s (%s)'.format(ipv4, ipaddrs[ipv4]));
		});

		o = dnss.taboption('dnsrr', form.SectionValue, '__dnsrr__', form.GridSection, 'dnsrr', null, 
			_('Set an arbitrary resource record (RR) type.') + '<br/>' + 
			_('Hexdata is automatically en/decoded on save and load'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable  = true;
		ss.rowcolors = true;
		ss.nodescriptions = true;

		function hexdecodeload(section_id) {
			let value = uci.get('dhcp', section_id, 'hexdata') || '';
			// Remove any spaces or colons from the hex string - they're allowed
			value = value.replace(/[\s:]/g, '');
			// Hex-decode the string before displaying
			let decodedString = '';
			for (let i = 0; i < value.length; i += 2) {
				decodedString += String.fromCharCode(parseInt(value.substr(i, 2), 16));
			}
			return decodedString;
		}

		function hexencodesave(section, value) {
			if (!value || value.length === 0) {
				uci.unset('dhcp', section, 'hexdata');
				return;
			}
			// Hex-encode the string before saving
			const encodedArr = value.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
			uci.set('dhcp', section, this.option, encodedArr);
		}

		so = ss.option(form.Value, 'rrname', _('Resource Record Name'));
		so.rmempty = false;
		so.datatype = 'hostname';
		so.placeholder = 'svcb.example.com.';

		so = ss.option(form.Value, 'rrnumber', _('Resource Record Number'));
		so.rmempty = false;
		so.datatype = 'uinteger';
		so.placeholder = '64';

		so = ss.option(form.Value, '_hexdata', _('Raw Data'));
		so.rmempty = true;
		so.datatype = 'string';
		so.placeholder = 'free-form string';
		so.load = hexdecodeload;
		so.write = hexencodesave;
		so.modalonly = true;
		so.depends({ rrnumber: '65', '!reverse': true });

		so = ss.option(form.DummyValue, 'hexdata', _('Hex Data'));
		so.width = '50%';
		so.rawhtml = true;
		so.load = function(section_id) {
			let hexdata = uci.get('dhcp', section_id, 'hexdata') || '';
			hexdata = hexdata.replace(/[:]/g, '');
			return hexdata.replace(/(.{2})/g, '$1 ');
		};

		function writetype65(section_id, value) {
			let rrnum = uci.get('dhcp', section_id, 'rrnumber');
			if (rrnum !== '65') return;

			let priority = parseInt(this.section.formvalue(section_id, '_svc_priority'), 10);
			let target = this.section.formvalue(section_id, '_svc_target') || '.';
			let params = value.trim().split('\n').map(l => l.trim()).filter(Boolean);

			const hex = drh.buildSvcbHex(priority, target, params);	
			uci.set('dhcp', section_id, 'hexdata', hex);
		};

		function loadtype65(section_id) {
			let rrnum = uci.get('dhcp', section_id, 'rrnumber');
			if (rrnum !== '65') return null;

			let hexdata = uci.get('dhcp', section_id, 'hexdata');
			return drh.parseSvcbHex(hexdata);
		};

		// Type 65 builder fields (hidden unless rrnumber === 65)
		so = ss.option(form.Value, '_svc_priority', _('Svc Priority'));
		so.placeholder = 1;
		so.datatype = 'and(uinteger,min(0),max(65535))'
		so.modalonly = true;
		so.depends({ rrnumber: '65' });
		so.write = writetype65;
		so.load = function(section_id) {
			const parsed = loadtype65(section_id);
			return parsed?.priority?.toString() || '';
		};

		so = ss.option(form.Value, '_svc_target', _('Svc Target'));
		so.placeholder = 'svc.example.com.';
		so.dataype = 'hostname';
		so.modalonly = true;
		so.depends({ rrnumber: '65' });
		so.write = writetype65;
		so.load = function(section_id) {
			const parsed = loadtype65(section_id);
			return parsed?.target || '';
		};

		so = ss.option(form.TextValue, '_svc_params', _('Svc Parameters'));
		so.placeholder = 'alpn=h2,h3\nipv4hint=192.0.2.1,192.0.2.2\nipv6hint=2001:db8::1,2001:db8::2\nport=8000';
		so.modalonly = true;
		so.rows = 4;
		so.depends({ rrnumber: '65' });
		so.write = writetype65;
		so.load = function(section_id) {
			const parsed = loadtype65(section_id);
			return parsed?.params?.join('\n') || '';
		};
		// End dnsrecords

		// Begin dnssec
		if (L.hasSystemFeature('dnsmasq', 'dnssec')) {
			o = s.taboption('dnssecopt', form.Flag, 'dnssec',
				_('DNSSEC'),
				_('Validate DNS replies and cache DNSSEC data, requires upstream to support DNSSEC.'));
			o.optional = true;

			o = s.taboption('dnssecopt', form.Flag, 'dnsseccheckunsigned',
				_('DNSSEC check unsigned'),
				_('Verify unsigned domain responses really come from unsigned domains.'));
			o.default = o.enabled;
			o.optional = true;
		}
		// End dnssec

		// Begin filteropts
		s.taboption('filteropts', form.Flag, 'domainneeded',
			_('Domain required'),
			_('Never forward DNS queries which lack dots or domain parts.') + '<br />' +
			customi18n(_('Names not in {etc_hosts} are answered {not_found}.') )
		);

		o = s.taboption('filteropts', form.Flag, 'rebind_protection',
			_('Rebind protection'),
			customi18n(_('Discard upstream responses containing {rfc_1918_link} addresses.') ) + '<br />' +
			customi18n(_('Discard also upstream responses containing {rfc_4193_link}, Link-Local and private IPv4-Mapped {rfc_4291_link} IPv6 Addresses.') )
		);
		o.rmempty = false;

		o = s.taboption('filteropts', form.Flag, 'rebind_localhost',
			_('Allow localhost'),
			customi18n(
			_('Exempt {loopback_slash_8_v4} and {localhost_v6} from rebinding checks, e.g. for <abbr title="Real-time Block List">RBL</abbr> services.')
			)
		);
		o.depends('rebind_protection', '1');

		o = s.taboption('filteropts', form.DynamicList, 'rebind_domain',
			_('Domain whitelist'),
			customi18n(_('List of domains to allow {rfc_1918_link} responses for.') )
		);
		o.depends('rebind_protection', '1');
		o.optional = true;
		o.placeholder = 'ihost.netflix.com';
		o.validate = validateAddressList;

		o = s.taboption('filteropts', form.Flag, 'localservice',
			_('Local service only'),
			_('Accept DNS queries only from hosts whose address is on a local subnet.'));
		o.optional = false;
		o.rmempty = false;

		o = s.taboption('filteropts', form.Flag, 'boguspriv',
			_('Filter private'),
			customi18n(
			_('Reject reverse lookups to {rfc_6303_link} IP ranges ({reverse_arpa}) not in {etc_hosts}.') )
		);
		o.default = o.enabled;

		s.taboption('filteropts', form.Flag, 'filterwin2k',
			_('Filter SRV/SOA service discovery'),
			_('Filters SRV/SOA service discovery, to avoid triggering dial-on-demand links.') + '<br />' +
			_('May prevent VoIP or other services from working.'));

		o = s.taboption('filteropts', form.Flag, 'filter_aaaa',
			_('Filter IPv6 AAAA records'),
			_('Remove IPv6 addresses from the results and only return IPv4 addresses.') + '<br />' +
			_('Can be useful if ISP has IPv6 nameservers but does not provide IPv6 routing.'));
		o.optional = true;

		o = s.taboption('filteropts', form.Flag, 'filter_a',
			_('Filter IPv4 A records'),
			_('Remove IPv4 addresses from the results and only return IPv6 addresses.'));
		o.optional = true;

		o = s.taboption('filteropts', form.MultiValue, 'filter_rr',
			_('Filter arbitrary RR'), _('Removes records of the specified type(s) from answers.'));
		o.optional = true;
		o.create = true;
		o.multiple = true;
		o.display_size = 5;
		recordtypes.forEach(r => {
			o.value(r);
		});

		s.taboption('filteropts', form.Flag, 'localise_queries',
			_('Localise queries'),
			customi18n(_('Limit response records (from {etc_hosts}) to those that fall within the subnet of the querying interface.') ) + '<br />' +
			_('This prevents unreachable IPs in subnets not accessible to you.') + '<br />' +
			_('Note: IPv4 only.'));

		s.taboption('filteropts', form.Flag, 'nonegcache',
			_('No negative cache'),
			_('Do not cache negative replies, e.g. for non-existent domains.'));

		o = s.taboption('filteropts', form.DynamicList, 'bogusnxdomain',
			customi18n(_('IPs to override with {nxdomain}') ),
			customi18n(_('Transform replies which contain the specified addresses or subnets into {nxdomain} responses.') )
		);
		o.optional = true;
		o.placeholder = '64.94.110.11';
		// End filteropts

		// Begin forward
		o = s.taboption('forward', form.DynamicList, 'server',
			_('DNS Forwards'),
			_('Forward specific domain queries to specific upstream servers.'));
		o.optional = true;
		o.placeholder = '/*.example.org/10.1.2.3';
		o.validate = validateServerSpec;

		o = s.taboption('forward', form.Value, 'serversfile',
			_('Additional servers file'),
			customi18n(_('File listing upstream resolvers, optionally domain-specific, e.g. {servers_file_entry01}, {servers_file_entry02}.') )
		);
		o.placeholder = '/etc/dnsmasq.servers';

		o = s.taboption('forward', form.Value, 'addmac',
			_('Add requestor MAC'),
			_('Add the MAC address of the requestor to DNS queries which are forwarded upstream.') + ' ' + '<br />' +
			_('%s uses the default MAC address format encoding').format('<code>enabled</code>') + ' ' + '<br />' +
			_('%s uses an alternative encoding of the MAC as base64').format('<code>base64</code>') + ' ' + '<br />' +
			_('%s uses a human-readable encoding of hex-and-colons').format('<code>text</code>'));
		o.optional = true;
		o.value('', _('off'));
		o.value('1', _('enabled (default)'));
		o.value('base64');
		o.value('text');

		s.taboption('forward', form.Flag, 'stripmac',
			_('Remove MAC address before forwarding query'),
			_('Remove any MAC address information already in downstream queries before forwarding upstream.'));

		o = s.taboption('forward', form.Value, 'addsubnet',
			_('Add subnet address to forwards'),
			_('Add a subnet address to the DNS queries which are forwarded upstream, leaving this value empty disables the feature.') + ' ' +
			_('If an address is specified in the flag, it will be used, otherwise, the address of the requestor will be used.') + ' ' +
			_('The amount of the address forwarded depends on the prefix length parameter: 32 (128 for IPv6) forwards the whole address, zero forwards none of it but still marks the request so that no upstream nameserver will add client address information either.') + ' ' + '<br />' +
			_('The default (%s) is zero for both IPv4 and IPv6.').format('<code>0,0</code>') + ' ' + '<br />' +
			_('%s adds the /24 and /96 subnets of the requestor for IPv4 and IPv6 requestors, respectively.').format('<code>24,96</code>') + ' ' + '<br />' +
			_('%s adds 1.2.3.0/24 for IPv4 requestors and ::/0 for IPv6 requestors.').format('<code>1.2.3.4/24</code>') + ' ' + '<br />' +
			_('%s adds 1.2.3.0/24 for both IPv4 and IPv6 requestors.').format('<code>1.2.3.4/24,1.2.3.4/24</code>'));
		o.optional = true;

		s.taboption('forward', form.Flag, 'stripsubnet',
			_('Remove subnet address before forwarding query'),
			_('Remove any subnet address already present in a downstream query before forwarding it upstream.'));
		// End forward

		// Begin limits
		o = s.taboption('limits', form.Value, 'ednspacket_max',
			_('Max. EDNS0 packet size'),
			_('Maximum allowed size of EDNS0 UDP packets.'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = 1280;

		o = s.taboption('limits', form.Value, 'dnsforwardmax',
			_('Max. concurrent queries'),
			_('Maximum allowed number of concurrent DNS queries.'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = 150;

		o = s.taboption('limits', form.Value, 'cachesize',
			_('Size of DNS query cache'),
			_('Number of cached DNS entries, 10000 is maximum, 0 is no caching.'));
		o.optional = true;
		o.datatype = 'range(0,10000)';
		o.placeholder = 150;

		o = s.taboption('limits', form.Value, 'min_cache_ttl',
			_('Min cache TTL'),
			_('Extend short TTL values to the seconds value given when caching them. Use with caution.') +
			_(' (Max 1h == 3600)'));
		o.optional = true;
		o.placeholder = 60;

		o = s.taboption('limits', form.Value, 'max_cache_ttl',
			_('Max cache TTL'),
			_('Set a maximum seconds TTL value for entries in the cache.'));
		o.optional = true;
		o.placeholder = 3600;
		// End limits

		// Being logging
		o = s.taboption('logging', form.Flag, 'logqueries',
			_('Log queries'),
			_('Write received DNS queries to syslog.') + ' ' + _('Dump cache on SIGUSR1, include requesting IP.'));
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
		// End logging

		// Begin files
		o = s.taboption('files', form.Flag, 'noresolv',
			_('Ignore resolv file'));
		o.optional = true;

		o = s.taboption('files', form.Value, 'resolvfile',
			_('Resolv file'),
			_('File with upstream resolvers.'));
		o.depends('noresolv', '0');
		o.placeholder = '/tmp/resolv.conf.d/resolv.conf.auto';
		o.optional = true;

		o = s.taboption('files', form.Flag, 'strictorder',
			_('Strict order'),
			_('Query upstream resolvers in the order they appear in the resolv file.'));
		o.optional = true;

		o = s.taboption('files', form.Flag, 'ignore_hosts_dir',
			_('Ignore hosts files directory'),
			_('On: use instance specific hosts file only') + '<br/>' +
			_('Off: use all files in the directory including the instance specific hosts file')
		);
		o.optional = true;

		o = s.taboption('files', form.Flag, 'nohosts',
			customi18n(_('Ignore {etc_hosts} file') )
		);
		o.optional = true;

		o = s.taboption('files', form.DynamicList, 'addnhosts',
			_('Additional hosts files'));
		o.optional = true;
		o.placeholder = '/etc/dnsmasq.hosts';
		// End files

		// Begin ipsets
		o = s.taboption('ipsets', form.SectionValue, '__ipsets__', form.GridSection, 'ipset', null,
			_('List of IP sets to populate with the IPs of DNS lookup results of the FQDNs also specified here.') + '<br />' +
			_('The netfilter components below are only regarded when running fw4.'));

		ss = o.subsection;

		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable  = true;
		ss.rowcolors = true;
		ss.nodescriptions = true;
		ss.modaltitle = _('Edit IP set');

		so = ss.option(form.DynamicList, 'name', _('Name of the set'));
		uci.sections('firewall', 'ipset', function(s) {
			if (typeof(s.name) == 'string')
				so.value(s.name, s.comment ? '%s (%s)'.format(s.name, s.comment) : s.name);
		});
		so.rmempty = false;
		so.editable = false;
		so.datatype = 'string';

		so = ss.option(form.DynamicList, 'domain', _('FQDN'));
		so.rmempty = false;
		so.editable = false;
		so.datatype = 'hostname';

		so = ss.option(form.Value, 'table', _('Netfilter table name'), _('Defaults to fw4.'));
		so.editable = false;
		so.placeholder = 'fw4';
		so.rmempty = true;

		so = ss.option(form.ListValue, 'table_family', _('Table IP family'), _('Defaults to IPv4+6.') + ' ' + _('Can be hinted by adding 4 or 6 to the name.') + '<br />' +
			_('Adding an IPv6 to an IPv4 set and vice-versa silently fails.'));
		so.editable = false;
		so.rmempty = true;
		so.value('inet', _('IPv4+6'));
		so.value('ip', _('IPv4'));
		so.value('ip6', _('IPv6'));
		// End ipsets


		return m.render();
	}
});
