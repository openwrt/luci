'use strict';
'require rpc';
'require form';
'require network';
'require tools.widgets as widgets';

var callGetCertificateFiles = rpc.declare({
	object: 'luci.openfortivpn',
	method: 'getCertificates',
	params: [ 'interface' ],
	expect: { '': {} }
});

var callSetCertificateFiles = rpc.declare({
	object: 'luci.openfortivpn',
	method: 'setCertificates',
	params: [ 'interface', 'user_cert', 'user_key', 'ca_file' ],
	expect: { '': {} }
});

network.registerPatternVirtual(/^vpn-.+$/);

function sanitizeCert(s) {
	if (typeof(s) != 'string')
		return null;

	s = s.trim();

	if (s == '')
		return null;

	s = s.replace(/\r\n?/g, '\n');

	if (!s.match(/\n$/))
		s += '\n';

	return s;
}

function validateCert(priv, section_id, value) {
	var lines = value.trim().split(/[\r\n]/),
	    start = false,
	    i;

	if (value === null || value === '')
		return true;

	for (i = 0; i < lines.length; i++) {
		if (lines[i].match(/^-{5}BEGIN ((|RSA |DSA )PRIVATE KEY|(|TRUSTED |X509 )CERTIFICATE)-{5}$/))
			start = true;
		else if (start && !lines[i].match(/^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/))
			break;
	}

	if (!start || i < lines.length - 1 || !lines[i].match(/^-{5}END ((|RSA |DSA )PRIVATE KEY|(|TRUSTED |X509 )CERTIFICATE)-{5}$/))
		return _('This does not look like a valid PEM file');

	return true;
}

return network.registerProtocol('openfortivpn', {
	getI18n: function() {
		return _('OpenFortivpn');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'vpn-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'openfortivpn';
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
		var o;

		o = s.taboption('general', form.Value, 'peeraddr', _('VPN Server'));
		o.datatype = 'host(0)';

		o = s.taboption('general', form.Value, 'port', _('VPN Server port'));
		o.placeholder = '443';
		o.datatype = 'port';
		o.optional = true;

		s.taboption("general", form.Value, "username", _("Username"));

		o = s.taboption('general', form.Value, 'password', _('Password'));
		o.password = true;

		o = s.taboption('general', form.TextValue, 'user_cert', _('User certificate (PEM encoded)'));
		o.rows = 10;
		o.monospace = true;
		o.validate = L.bind(validateCert, o, false);
		o.load = function(section_id) {
			var certLoadPromise = certLoadPromise || callGetCertificateFiles(section_id);
			return certLoadPromise.then(function(certs) { return certs.user_cert });
		};
		o.write = function(section_id, value) {
			return callSetCertificateFiles(section_id, sanitizeCert(value), null, null);
		};

		o = s.taboption('general', form.TextValue, 'user_key', _('User key (PEM encoded)'));
		o.rows = 10;
		o.monospace = true;
		o.validate = L.bind(validateCert, o, true);
		o.load = function(section_id) {
			var certLoadPromise = certLoadPromise || callGetCertificateFiles(section_id);
			return certLoadPromise.then(function(certs) { return certs.user_key });
		};
		o.write = function(section_id, value) {
			return callSetCertificateFiles(section_id, null, sanitizeCert(value), null);
		};

		o = s.taboption('general', form.TextValue, 'ca_file', _('CA certificate (PEM encoded; Use instead of system-wide store to verify the gateway certificate.'));
		o.rows = 10;
		o.monospace = true;
		o.validate = L.bind(validateCert, o, false);
		o.load = function(section_id) {
			var certLoadPromise = certLoadPromise || callGetCertificateFiles(section_id);
			return certLoadPromise.then(function(certs) { return certs.ca_file });
		};
		o.write = function(section_id, value) {
			return callSetCertificateFiles(section_id, null, null, sanitizeCert(value));
		};

		o = s.taboption('advanced', widgets.NetworkSelect, 'tunlink', _('Bind interface'), _('Bind the tunnel to this interface (optional).'));
		o.exclude = s.section;
		o.nocreate = true;
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'persist_int', _('Persistent reconnect interval'), _("Optional, in seconds. If set to '0', no reconnect is attempted."));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'trusted_cert', _("VPN Server certificate's SHA256 hash"));
		o.datatype = 'and(hexstring,length(64))'
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'defaultroute', _('Use default gateway'), _('If unchecked, no default route is configured'));
		o.default = o.enabled;
		o.optional = true;

		o = s.taboption('advanced', form.Flag, 'peerdns', _('Use DNS servers advertised by peer'), _('If unchecked, the advertised DNS server addresses are ignored'));
		o.default = o.enabled;
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'metric', _('Use gateway metric'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.taboption("advanced", form.Value, 'local_ip', _("Local IP address"));
		o.placeholder = '192.168.0.5'
		o.dataype = 'ipaddr'
		o.optional = true;

	}
});
