'use strict';
'require form';
'require fs';
'require view';

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

		o = addFileOption(s, 'cacert', 'cacert', _('CA Certificate'),
			_('CA certificate to use as trust anchor, relative to %s.'),
			'/etc/swanctl/x509ca');

		o = s.option(form.Value, 'cert_uri_base', _('Certificate Base URI'),
			_('Base URI for the Hash and URL feature of IKEv2.') + '<br />' +
			_('Instead of sending complete certificates, a URI that resolves to the DER encoded certificate is sent.') + '<br />' +
			_('The certificate URIs are built by appending the SHA1 hash of the DER encoded certificate to this base URI.'));
		o.placeholder = 'http://certs.example.com/';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'crl_uri', _('CRL URIs'),
			_('URIs where a CRL (certificate revocation list) issued by this CA can be fetched.') + '<br />' +
			_('Supported schemes are http, ldap and file.') + '<br />' +
			_('A local file must be given as a file URI, e.g. %s.').format('file:///etc/swanctl/x509crl/ca.crl') + '<br />' +
			_('CRLs stored in %s are read by swanctl when loading credentials.').format('/etc/swanctl/x509crl'));
		o.placeholder = 'http://crl.example.com/ca.crl';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'ocsp_uri', _('OCSP URIs'),
			_('URIs of OCSP responders that can be queried for the revocation status of certificates issued by this CA.') + '<br />' +
			_('These are usually http URLs.'));
		o.placeholder = 'http://ocsp.example.com';
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

		// One file picker per key type, each rooted in its swanctl directory.
		// The stored value is relative to that directory, like cacert.
		// Unique option name per type, all mapped to the UCI option 'file'.
		['private', 'rsa', 'ecdsa', 'pkcs8', 'pkcs12'].forEach(function (type) {
			o = addFileOption(s, 'file_' + type, 'file', _('Key File'),
				_('Key file to use, relative to %s.'),
				'/etc/swanctl/' + type, type);
			o.modalonly = true;
		});

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
