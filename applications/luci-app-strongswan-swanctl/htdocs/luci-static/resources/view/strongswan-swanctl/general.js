'use strict';
'require form';
'require view';

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
			_('Shunt policy mode'));
		o.value('pass', _('Pass'));
		o.value('drop', _('Drop'));
		o.rmempty = false;

		o = s.option(form.DynamicList, 'local_ts', _('Local Traffic Selectors'),
			_('Local traffic selectors for the shunt policy'));
		o.datatype = 'list(or(cidr,ipaddr))';

		o = s.option(form.DynamicList, 'remote_ts', _('Remote Traffic Selectors'),
			_('Remote traffic selectors for the shunt policy'));
		o.datatype = 'list(or(cidr,ipaddr))';

		o = s.option(form.Value, 'priority', _('Priority'),
			_('Priority of the shunt policy (lower number means higher priority)'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.option(form.Value, 'interface', _('Interface'),
			_('Network interface to bind the shunt policy to'));
		o.modalonly = true;

		// Authority Configuration
		s = m.section(form.GridSection, 'authority', _('Authority'),
			_('Define Certificate Authorities that are trusted to sign and revoke peer certificates.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;

		o = s.option(form.Value, 'description', _('Description'),
			_('An optional description of what this authority is used for.'));

		o = s.option(form.Value, 'cacert', _('CA Certificate'),
			_('CA certificate to use as trust anchor, relative to /etc/swanctl/x509ca.'));
		o.datatype = 'file';

		o = s.option(form.Value, 'cert_uri_base', _('Certificate Base URI'),
			_('Base URI for the hash and URL feature to fetch certificates from the trusted CAs.'));
		o.modalonly = true;

		o = s.option(form.DynamicList, 'crl_uri', _('CRL URIs'),
			_('URIs where a CRL for the CA can be fetched.'));
		o.modalonly = true;

		o = s.option(form.DynamicList, 'ocsp_uri', _('OCSP URIs'),
			_('URIs where an OCSP responder for the CA is available.'));
		o.modalonly = true;

		// Secrets Configuration
		s = m.section(form.GridSection, 'secret', _('Secrets'),
			_('Define shared secrets and private key passphrases used for authentication.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;

		o = s.option(form.Value, 'description', _('Description'),
			_('An optional description of what this secret is used for.'));

		o = s.option(form.ListValue, 'type', _('Type'),
			_('Kind of secret to define'));
		o.rmempty = false;
		o.default = 'ike';
		o.value('eap');
		o.value('xauth');
		o.value('ntlm');
		o.value('ike');
		o.value('ppk');
		o.value('private');
		o.value('rsa');
		o.value('ecdsa');
		o.value('pkcs8');
		o.value('pkcs12');
		o.value('token');

		o = s.option(form.DynamicList, 'id', _('Identity'),
			_('Identities this secret is valid for'));
		o.depends('type', 'eap');
		o.depends('type', 'xauth');
		o.depends('type', 'ntlm');
		o.depends('type', 'ike');
		o.depends('type', 'ppk');

		o = s.option(form.Value, 'secret', _('Secret'),
			_('Shared secret for authentication, or passphrase to decrypt a private key.'));
		o.datatype = 'string';
		o.password = true;
		o.depends('type', 'eap');
		o.depends('type', 'xauth');
		o.depends('type', 'ntlm');
		o.depends('type', 'ike');
		o.depends('type', 'ppk');
		o.depends('type', 'private');
		o.depends('type', 'rsa');
		o.depends('type', 'ecdsa');
		o.depends('type', 'pkcs8');
		o.depends('type', 'pkcs12');
		o.modalonly = true;

		o = s.option(form.Value, 'file', _('Key File'),
			_('Path to the private key file.'));
		o.datatype = 'file';
		o.depends('type', 'private');
		o.depends('type', 'rsa');
		o.depends('type', 'ecdsa');
		o.depends('type', 'pkcs8');
		o.depends('type', 'pkcs12');

		o = s.option(form.Value, 'handle', _('Handle'),
			_('Handle of the private key on the smartcard.'));
		o.depends('type', 'token');
		o.modalonly = true;

		o = s.option(form.Value, 'slot', _('Slot'),
			_('Slot of the smartcard to use.'));
		o.depends('type', 'token');
		o.modalonly = true;

		o = s.option(form.Value, 'module', _('Module'),
			_('PKCS#11 module to use.'));
		o.depends('type', 'token');
		o.modalonly = true;

		o = s.option(form.Value, 'pin', _('PIN'),
			_('PIN to access the private key on the smartcard.'));
		o.datatype = 'string';
		o.password = true;
		o.depends('type', 'token');
		o.modalonly = true;

		return m.render();
	}
});
