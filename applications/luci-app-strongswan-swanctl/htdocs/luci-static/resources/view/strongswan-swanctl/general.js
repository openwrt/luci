'use strict';
'require form';
'require fs';
'require ui';
'require uci';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';

/**
 * Append the matching swanctl.conf setting (dotted path) to a description.
 */
function swanctlDescr(descr, key) {
	const code = key.replace(/</g, '&lt;').replace(/>/g, '&gt;');

	return (descr ? descr + '<br />' : '') + '<code>swanctl.conf: ' + code + '</code>';
}

/**
 * Add a file picker for a file below a swanctl directory.
 *
 * The UCI value is stored relative to `root`. The option name may differ
 * from the UCI option name (`ucioption`) so that several pickers with
 * different roots can share one UCI option.
 */
function addFileOption(s, name, ucioption, title, descr, root, type) {
	const o = s.option(form.FileUpload, name, title, descr.format(root));

	o.ucioption = ucioption;
	o.root_directory = root;

	if (type != null)
		o.depends('type', type);

	o.load = function (section_id) {
		return Promise.resolve(form.FileUpload.prototype.load.apply(this, [section_id]))
			.then(function (val) {
				return val ? root + '/' + val : val;
			});
	};

	o.parse = function (section_id) {
		const active = this.isActive(section_id);
		const value = active ? this.formvalue(section_id) : null;
		const node = this.getUIElement(section_id)?.node;
		const button = node?.querySelector('.open-file-browser');

		const setError = function (msg) {
			if (!button)
				return;

			button.classList.toggle('cbi-input-invalid', !!msg);

			if (msg) {
				button.setAttribute('data-tooltip', msg);
				button.setAttribute('data-tooltip-style', 'error');
			} else {
				button.removeAttribute('data-tooltip');
				button.removeAttribute('data-tooltip-style');
			}
		};

		// The modal dialog saves silently, so mark the field like ui.addValidator() does.
		const fail = function (msg) {
			setError(msg);
			node.addEventListener('widget-update', function () { setError(null); }, { once: true });

			return Promise.reject(new TypeError(msg));
		};

		setError(null);

		if (!active)
			return form.FileUpload.prototype.parse.apply(this, [section_id]);

		if (!value)
			return fail(_('A file must be selected.'));

		// Check on the device that the file exists before saving.
		return fs.stat(value).then(L.bind(function () {
			return form.FileUpload.prototype.parse.apply(this, [section_id]);
		}, this), function () {
			return fail(_('The file "%s" does not exist.').format(value));
		});
	};

	o.write = function (section_id, value) {
		const prefix = root + '/';
		return form.FileUpload.prototype.write.apply(this, [section_id,
			(value && value.indexOf(prefix) === 0) ? value.substring(prefix.length) : value]);
	};

	return o;
}

/**
 * Reject names of new named sections that are already used by a section of
 * another type, as UCI section names are shared by the whole config.
 *
 * Keep the list in sync with sectionNameCheck() in swanctl.js.
 */
function sectionNameCheck(extra_class) {
	const el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
		nameEl = el.querySelector('.cbi-section-create-name');

	ui.addValidator(nameEl, 'uciname', true, function (v) {
		const sections = [
			...uci.sections('ipsec', 'pools'),
			...uci.sections('ipsec', 'connection'),
			...uci.sections('ipsec', 'child'),
			...uci.sections('ipsec', 'crypto_proposal'),
			...uci.sections('ipsec', 'local'),
			...uci.sections('ipsec', 'remote'),
		];

		if (sections.find(function (s) { return s['.name'] == v; }))
			return _('Pools, Connections, Encryption Proposals, Children, Locals and Remotes may not share the same names.');

		return true;
	}, 'blur', 'keyup');

	return el;
}

return view.extend({
	render: function (result) {
		let m, s, o;

		m = new form.Map('ipsec', _('General connections configurations'),
			_('On this page, you can configure the general settings for IPsec connections.'));
		m.tabbed = true;

		// Shunt Configuration
		s = m.section(form.GridSection, 'shunt', _('Shunt'),
			_('Define Shunt pass/drop policies independent of remote connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Configuration is enabled or not'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('Mode'),
			swanctlDescr(_('Shunt policy mode'), 'connections.<conn>.children.<child>.mode'));
		o.value('pass', _('Pass'));
		o.value('drop', _('Drop'));
		o.rmempty = false;

		o = s.option(form.DynamicList, 'local_ts', _('Local Traffic Selectors'),
			swanctlDescr(_('Local traffic selectors for the shunt policy'), 'connections.<conn>.children.<child>.local_ts'));
		o.datatype = 'list(or(cidr,ipaddr))';

		o = s.option(form.DynamicList, 'remote_ts', _('Remote Traffic Selectors'),
			swanctlDescr(_('Remote traffic selectors for the shunt policy'), 'connections.<conn>.children.<child>.remote_ts'));
		o.datatype = 'list(or(cidr,ipaddr))';

		o = s.option(form.Value, 'priority', _('Priority'),
			swanctlDescr(_('Priority of the shunt policy (lower number means higher priority)'), 'connections.<conn>.children.<child>.priority'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.option(form.Value, 'interface', _('Interface'),
			swanctlDescr(_('Network interface to bind the shunt policy to'), 'connections.<conn>.children.<child>.interface'));
		o.modalonly = true;

		// Authority Configuration
		s = m.section(form.GridSection, 'authority', _('Authority'),
			_('Define Certificate Authorities that are trusted to sign and revoke peer certificates.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;

		o = s.option(form.Value, 'description', _('Description'),
			_('An optional description of what this authority is used for.'));

		o = addFileOption(s, 'cacert', 'cacert', _('CA Certificate'),
			swanctlDescr(_('CA certificate to use as trust anchor, relative to %s.'), 'authorities.<name>.cacert'),
			'/etc/swanctl/x509ca');

		o = s.option(form.Value, 'cert_uri_base', _('Certificate Base URI'),
			swanctlDescr(_('Base URI for the Hash and URL feature of IKEv2.') + '<br />' +
			_('Instead of sending complete certificates, a URI that resolves to the DER encoded certificate is sent.') + '<br />' +
			_('The certificate URIs are built by appending the SHA1 hash of the DER encoded certificate to this base URI.'),
				'authorities.<name>.cert_uri_base'));
		o.placeholder = 'http://certs.example.com/';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'crl_uri', _('CRL URIs'),
			swanctlDescr(_('URIs where a CRL (certificate revocation list) issued by this CA can be fetched.') + '<br />' +
			_('Supported schemes are http, ldap and file.') + '<br />' +
			_('A local file must be given as a file URI, e.g. %s.').format('file:///etc/swanctl/x509crl/ca.crl') + '<br />' +
			_('CRLs stored in %s are read by swanctl when loading credentials.').format('/etc/swanctl/x509crl'),
				'authorities.<name>.crl_uris'));
		o.placeholder = 'http://crl.example.com/ca.crl';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'ocsp_uri', _('OCSP URIs'),
			swanctlDescr(_('URIs of OCSP responders that can be queried for the revocation status of certificates issued by this CA.') + '<br />' +
			_('These are usually http URLs.'),
				'authorities.<name>.ocsp_uris'));
		o.placeholder = 'http://ocsp.example.com';
		o.modalonly = true;

		// Pool Configuration
		// The section name is used as pool name, so it is not anonymous.
		s = m.section(form.GridSection, 'pools', _('Pools'),
			_('A pool is a named range of virtual IP addresses that the IKE daemon hands out to remote peers ' +
				'(road warriors) when they connect, so that they get an address inside your network.') + '<br />' +
			_('Besides the addresses, a pool can also carry additional configuration attributes ' +
				'such as DNS servers or split tunneling networks, which are sent to the peer together with the address.') + '<br />' +
			_('The name of the section is the name of the pool, under which a connection refers to it.') + ' ' +
			_('Pools are only needed on the responder side, a connection that only initiates tunnels does not need one.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		s.tab('general', _('General'));
		s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.Value, 'addrs', _('Addresses'),
			swanctlDescr(_('Addresses that are allocated to the peers from this pool, one address per connected peer.') + '<br />' +
			_('Either a subnet in CIDR notation or an address range can be given.') + '<br />' +
			_('Choose a range that is not used by any local network and large enough for all peers that connect at the same time.'),
				'pools.<name>.addrs'));
		o.datatype = 'or(cidr,iprange)';
		o.placeholder = '10.0.0.0/24 ' + _('or') + ' 10.0.0.10-10.0.0.200';
		o.rmempty = false;

		o = s.taboption('general', form.DynamicList, 'dns', _('DNS Servers'),
			swanctlDescr(_('IP addresses of DNS servers that are sent to the peers.') + '<br />' +
			_('The peers use them to resolve names while the tunnel is up, e.g. for hosts in the remote network.') + '<br />' +
			_('Whether the attribute is applied depends on the client.'),
				'pools.<name>.dns'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'nbns', _('NBNS Servers'),
			swanctlDescr(_('IP addresses of NBNS (NetBIOS name service, also known as WINS) servers that are sent to the peers.') + '<br />' +
			_('Only relevant for legacy Windows clients that resolve NetBIOS names.'),
				'pools.<name>.nbns'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'dhcp', _('DHCP Servers'),
			swanctlDescr(_('IP addresses of DHCP servers that are sent to the peers.') + '<br />' +
			_('Peers can use them to request further configuration over the tunnel.'),
				'pools.<name>.dhcp'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'netmask', _('Netmask'),
			swanctlDescr(_('Netmask that is sent to the peers together with their virtual IP address.') + '<br />' +
			_('Usually not required, as most clients derive it on their own.'),
				'pools.<name>.netmask'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'server', _('Server'),
			swanctlDescr(_('IP addresses of the server that are sent to the peers as an additional attribute.') + '<br />' +
			_('Usually not required.'),
				'pools.<name>.server'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'subnet', _('Subnet'),
			swanctlDescr(_('Subnets in CIDR notation that are announced to the peers as protected by the tunnel.') + '<br />' +
			_('Clients that support the attribute (e.g. Cisco Unity) use them to decide which traffic is sent through the tunnel.'),
				'pools.<name>.subnet'));
		o.datatype = 'cidr';
		o.placeholder = '192.168.1.0/24';
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, 'split_include', _('Split Include'),
			swanctlDescr(_('Subnets in CIDR notation that the peers send through the tunnel (split tunneling).') + '<br />' +
			_('All other traffic of the peer bypasses the tunnel.') + '<br />' +
			_('Only supported by clients that implement the split tunneling attribute.'),
				'pools.<name>.split_include'));
		o.datatype = 'cidr';
		o.placeholder = '192.168.1.0/24';
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, 'split_exclude', _('Split Exclude'),
			swanctlDescr(_('Subnets in CIDR notation that the peers must not send through the tunnel.') + '<br />' +
			_('All other traffic of the peer is sent through the tunnel.') + '<br />' +
			_('Only supported by clients that implement the split tunneling attribute.'),
				'pools.<name>.split_exclude'));
		o.datatype = 'cidr';
		o.placeholder = '192.168.2.0/24';
		o.modalonly = true;

		return m.render().then(function (node) {
			return ikev1.prepend(node);
		});
	}
});
