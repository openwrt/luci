'use strict';
'require rpc';
'require form';
'require network';
'require validation';

const callGetCertificateFiles = rpc.declare({
	object: 'luci.openconnect',
	method: 'getCertificates',
	params: [ 'interface' ],
	expect: { '': {} }
});

const callSetCertificateFiles = rpc.declare({
	object: 'luci.openconnect',
	method: 'setCertificates',
	params: [ 'interface', 'user_certificate', 'user_privatekey', 'ca_certificate' ],
	expect: { '': {} }
});

network.registerPatternVirtual(/^vpn-.+$/);

function sanitizeCert(s) {
	if (typeof(s) != 'string')
		return '';

	s = s.trim();

	if (s == '')
		return s;

	s = s.replace(/\r?\n/g, '\n');

	if (!s.match(/\n$/))
		s += '\n';

	return s;
}

function validateCert(priv, section_id, value) {
	if (!value?.trim())
		return true;

	const beg = priv ? /^-----BEGIN (RSA )?PRIVATE KEY-----$/ : /^-----BEGIN CERTIFICATE-----$/;
	const end = priv ? /^-----END (RSA )?PRIVATE KEY-----$/ : /^-----END CERTIFICATE-----$/;
	const lines = value.trim().split(/[\r?\n]/);
	const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
	const errmsg = _('This does not look like a valid PEM file');


	if (!lines?.[0].match(beg) || !lines.at(-1).match(end))
		return errmsg;

	for (let i = 1; i < lines.length - 1; i++)
		if (!base64.test(lines[i]))
			return errmsg;

	return true;
}

return network.registerProtocol('openconnect', {
	getI18n: function() {
		return _('OpenConnect');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'vpn-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'openconnect';
	},

	isFloating: function() {
		return true;
	},

	isVirtual: function() {
		return true;
	},

	getDevices: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {
		const dev = this.getDevice().getName();
		let certLoadPromise = null;
		let o;

		o = s.taboption('general', form.ListValue, 'vpn_protocol', _('VPN Protocol'));
		o.value('anyconnect', 'OpenConnect or Cisco AnyConnect SSL VPN');
		o.value('nc', 'Juniper Network Connect');
		o.value('gp', 'Palo Alto Networks GlobalProtect');
		o.value('pulse', 'Pulse Connect Secure SSL VPN');
		o.value('f5', 'F5 BIG-IP SSL VPN');
		o.value('fortinet', 'Fortinet SSL VPN');
		o.value('array', 'Array Networks SSL VPN');

		o = s.taboption('general', form.Value, 'uri', _('VPN Server'));
		o.placeholder = 'https://example.com:443/usergroup';
		o.validate = function(section_id, value) {
			const m = String(value).match(/^(?:(\w+):\/\/|)(?:\[([0-9a-f:.]{2,45})\]|([^\/:]+))(?::([0-9]{1,5}))?(?:\/.*)?$/i);

			if (!m)
				return _('Invalid server URL');

			if (m[1] != null) {
				if (!m[1].match(/^(?:https|socks|socks4|socks5)$/i))
					return _('Unsupported protocol');
			}

			if (m[2] != null) {
				if (!validation.parseIPv6(m[2]))
					return _('Invalid IPv6 address');
			}

			if (m[3] != null) {
				if (!validation.parseIPv4(m[3])) {
					if (!(m[3].length <= 253 &&
					      (m[3].match(/^[a-zA-Z0-9_]+$/) != null ||
					       (m[3].match(/^[a-zA-Z0-9_][a-zA-Z0-9_\-.]*[a-zA-Z0-9]$/) &&
					        m[3].match(/[^0-9.]/)))))
						return _('Invalid hostname or IPv4 address');
				}
			}

			if (m[4] != null) {
				var p = +m[4];

				if (p < 0 || p > 65535)
					return _('Invalid port');
			}

			return true;
		};

		s.taboption('general', form.Value, 'serverhash', _("VPN Server's certificate SHA1 hash"));
		s.taboption('general', form.Value, 'authgroup', _('Auth Group'));
		s.taboption("general", form.Value, "username", _("Username"));

		o = s.taboption('general', form.Value, 'password', _('Password'));
		o.password = true;

		o = s.taboption('general', form.Value, 'password2', _('Password2'));
		o.password = true;

		o = s.taboption('general', form.Value, 'proxy', _('Proxy Server'));
		o.optional = true;

		o = s.taboption('general', form.TextValue, 'usercert', _('User certificate (PEM encoded)'));
		o.rows = 10;
		o.monospace = true;
		o.validate = L.bind(validateCert, o, false);
		o.load = function(section_id) {
			certLoadPromise = certLoadPromise || callGetCertificateFiles(section_id);
			return certLoadPromise.then(function(certs) { return certs.user_certificate });
		};
		o.write = function(section_id, value) {
			return callSetCertificateFiles(section_id, sanitizeCert(value), '', '');
		};

		o = s.taboption('general', form.TextValue, 'userkey', _('User key (PEM encoded)'));
		o.rows = 10;
		o.monospace = true;
		o.validate = L.bind(validateCert, o, true);
		o.load = function(section_id) {
			certLoadPromise = certLoadPromise || callGetCertificateFiles(section_id);
			return certLoadPromise.then(function(certs) { return certs.user_privatekey });
		};
		o.write = function(section_id, value) {
			return callSetCertificateFiles(section_id, '', sanitizeCert(value), '');
		};

		o = s.taboption('general', form.TextValue, 'ca', _('CA certificate; if empty it will be saved after the first connection.'));
		o.rows = 10;
		o.monospace = true;
		o.validate = L.bind(validateCert, o, false);
		o.load = function(section_id) {
			certLoadPromise = certLoadPromise || callGetCertificateFiles(section_id);
			return certLoadPromise.then(function(certs) { return certs.ca_certificate });
		};
		o.write = function(section_id, value) {
			return callSetCertificateFiles(section_id, '', '', sanitizeCert(value));
		};

		o = s.taboption('advanced', form.Value, 'mtu', _('Override MTU'));
		o.optional = true;
		o.placeholder = 1406;
		o.datatype = 'range(68, 9200)';

		o = s.taboption('advanced', form.Value, 'reconnect_timeout', _('Reconnect Timeout'));
		o.optional = true;
		o.placeholder = 300;
		o.datatype = 'min(10)';
	}
});
