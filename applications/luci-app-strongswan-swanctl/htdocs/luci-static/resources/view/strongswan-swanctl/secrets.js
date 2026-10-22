'use strict';
'require form';
'require fs';
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

return view.extend({
	render: function (result) {
		let m, s, o;

		m = new form.Map('ipsec', _('Secrets'),
			_('On this page, you can configure the secrets used for IPsec authentication.'));

		s = m.section(form.GridSection, 'secret');
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;

		o = s.option(form.Value, 'description', _('Description'),
			_('An optional description of what this secret is used for.'));

		o = s.option(form.ListValue, 'type', _('Type'),
			swanctlDescr(_('Kind of secret to define'), 'secrets.<type>'));
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
			swanctlDescr(_('Identities this secret is valid for'), 'secrets.<type>.id<suffix>'));
		o.depends('type', 'eap');
		o.depends('type', 'xauth');
		o.depends('type', 'ntlm');
		o.depends('type', 'ike');
		o.depends('type', 'ppk');

		o = s.option(form.Value, 'secret', _('Secret'),
			swanctlDescr(_('Shared secret for authentication, or passphrase to decrypt a private key.'), 'secrets.<type>.secret'));
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
				swanctlDescr(_('Key file to use, relative to %s.'), 'secrets.' + type + '.file'),
				'/etc/swanctl/' + type, type);
			o.modalonly = true;
		});

		o = s.option(form.Value, 'handle', _('Handle'),
			swanctlDescr(_('Handle of the private key on the smartcard.'), 'secrets.token.handle'));
		o.depends('type', 'token');
		o.modalonly = true;

		o = s.option(form.Value, 'slot', _('Slot'),
			swanctlDescr(_('Slot of the smartcard to use.'), 'secrets.token.slot'));
		o.depends('type', 'token');
		o.modalonly = true;

		o = s.option(form.Value, 'module', _('Module'),
			swanctlDescr(_('PKCS#11 module to use.'), 'secrets.token.module'));
		o.depends('type', 'token');
		o.modalonly = true;

		o = s.option(form.Value, 'pin', _('PIN'),
			swanctlDescr(_('PIN to access the private key on the smartcard.'), 'secrets.token.pin'));
		o.datatype = 'string';
		o.password = true;
		o.depends('type', 'token');
		o.modalonly = true;

		return m.render().then(function (node) {
			return ikev1.prepend(node);
		});
	}
});
