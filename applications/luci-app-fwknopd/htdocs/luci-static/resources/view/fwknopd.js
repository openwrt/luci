'use strict';
'require fs';
'require dom';
'require view';
'require form';
'require ui';
'require tools.widgets as widgets';

var domparser = new DOMParser();
var QRCODE_VARIABLES = ['KEY_BASE64', 'KEY', 'HMAC_KEY_BASE64', 'HMAC_KEY'];
var INVALID_KEYS = ['__CHANGEME__', 'CHANGEME'];

function setOptionValue(map, section_id, option, value) {
	var option = L.toArray(map.lookupOption(option, section_id))[0];
	var uiEl = option ? option.getUIElement(section_id) : null;
	if (uiEl)
		uiEl.setValue(value);
}

function lines(content) {
	return content.split(/\r?\n/);
}

function parseKeys(content) {
	var l = lines(content);
	var keys = {};
	for (var i = 0; i < l.length; i++) {
		var p = l[i].split(/:(.*)/, 2);
		if (p.length == 2)
			keys[p[0].trim()] = p[1].trim();
	}
	return keys;
}

var KeyTypeValue = form.ListValue.extend({
	__init__: function() {
		this.super('__init__', arguments);
	},

	cfgvalue: function(section_id) {
		for (var i = 0; i < this.keylist.length; i++) {
			var value = this.map.data.get(
				this.uciconfig || this.section.uciconfig || this.map.config,
				this.ucisection || section_id,
				this.keylist[i]
			);
			if (value)
				return this.keylist[i];
		}
		return this.keylist[0];
	},

	remove: function() {
		// Ignore
	},

	write: function() {
		// Ignore
	},
});

var YNValue = form.Flag.extend({
	__init__: function() {
		this.super('__init__', arguments);
		this.enabled = 'Y';
		this.disabled = 'N';
		this.default = 'N';
	},
	
	cfgvalue: function(section_id) {
		var value = this.super('cfgvalue', arguments);
		return value ? String(value).toUpperCase() : value;
	},

	parse: function(section_id) {
		var active = this.isActive(section_id),
		    cval = this.cfgvalue(section_id),
		    fval = active ? this.formvalue(section_id) : null;

		if (String(fval).toUpperCase() != cval) {
			if (fval == 'Y')
				return Promise.resolve(this.write(section_id, fval));
			else if (cval !== undefined)
				return Promise.resolve(this.remove(section_id));
		}
	},
});

var QrCodeValue = form.DummyValue.extend({
	__init__: function() {
		this.super('__init__', arguments);
		this.needsRefresh = {};

		this.components = [];
		QRCODE_VARIABLES.forEach(L.bind(function(option) {
			this.components.push(option);
			var dep = {};
			dep[option] = /.+/;
			this.depends(dep);
		}, this));
	},

	cfgQrCode: function(section_id) {
		var qr = [];
		for (var i = 0; i < this.components.length; i++) {
			var value = this.map.data.get(
				this.uciconfig || this.section.uciconfig || this.map.config,
				this.ucisection || section_id,
				this.components[i]
			);

			if (value)
				qr.push(this.components[i] + ':' + value);
		}
		return qr ? qr.join(' ') : null;
	},

	formQrCode: function(section_id) {
		var qr = [];
		for (var i = 0; i < this.components.length; i++) {
			var value = null;

			var uiEl = L.toArray(this.map.lookupOption(this.components[i], section_id))[0];
			if (uiEl) {
				if (uiEl.isActive(section_id))
					value = uiEl.formvalue(section_id);
			}

			if (value)
				qr.push(this.components[i] + ':' + value);
		}
		return qr ? qr.join(' ') : null;
	},

	onchange: function(ev, section_id) {
		if (this.needsRefresh[section_id] !== undefined)
			this.needsRefresh[section_id] = true;
		else {
			this.refresh(section_id);
		}
	},

	refresh: function(section_id) {
		var qrcode = this.formQrCode(section_id);
		var formvalue = this.formvalue(section_id);
		if (formvalue != qrcode) {
			this.getUIElement(section_id).setValue(qrcode);
			var uiEl = document.getElementById(this.cbid(section_id));
			if (uiEl) {
				var contentEl = uiEl.nextSibling;
				if (contentEl.childNodes.length == 1) {
					dom.append(contentEl, E('em', { 'class': 'spinning',  }, [ _('Loading…') ]));
				}

				this.needsRefresh[section_id] = false;

				// Render QR code
				return this.renderSvg(qrcode)
					.then(L.bind(function(svgEl) {
						dom.content(contentEl, svgEl || E('div'));

						var needsAnotherRefresh = this.needsRefresh[section_id];
						delete this.needsRefresh[section_id];

						if (needsAnotherRefresh) {
							this.refresh(section_id);
						}
					}, this)).finally(L.bind(function() {
						if (this.needsRefresh[section_id] === undefined) {
							if (contentEl.childNodes.length == 2)
								contentEl.removeChild(contentEl.lastChild);
							delete this.needsRefresh[section_id];
						}
					}, this)).catch(L.error);
			}
		}
		// Nothing to render
		return Promise.resolve(null);
	},

	renderWidget: function(section_id) {
		var qrcode = this.cfgQrCode(section_id);
		return this.renderSvg(qrcode)
			.then(L.bind(function(svgEl) {
				var uiEl = new ui.Hiddenfield(qrcode, { id: this.cbid(section_id) });
				return E([
					uiEl.render(),
					E('div', {}, svgEl || E('div'))
				]);
			}, this));
	},

	qrEncodeSvg: function(qrcode) {
		return fs.exec('/usr/bin/qrencode', ['--type', 'svg', '--inline', '-o', '-', qrcode])
			.then(function(response) {
				return response.stdout;
			});
	},

	renderSvg: function(qrcode) {
		if (qrcode)
			return this.qrEncodeSvg(qrcode)
				.then(function(rawsvg) {
					return domparser.parseFromString(rawsvg, 'image/svg+xml')
						.querySelector('svg');
				});
		else
			return Promise.resolve(null);
	},
});

var GenerateButton = form.Button.extend({
	__init__: function() {
		this.super('__init__', arguments);
		this.onclick = L.bind(this.generateKeys, this);
		this.keytypes = {};
	},

	keytype: function(key, regex) {
		this.keytypes[key] = regex;
	},

	qrcode: function(option) {
		this.qrcode = option;
	},

	generateKeys: function(ev, section_id) {
		return fs.exec('/usr/sbin/fwknopd', ['--key-gen'])
			.then(function(response) { return parseKeys(response.stdout); })
			.then(L.bind(this.applyKeys, this, section_id))
			.catch(L.error);
	},

	applyKeys: function(section_id, keys) {
		for (var key in keys) {
			setOptionValue(this.map, section_id, key, keys[key]);
			for (var type in this.keytypes) {
				if (this.keytypes[type].test(key))
					setOptionValue(this.map, section_id, type, key);
			}
		}

		// Force update of dependencies (element visibility)
		this.map.checkDepends();

		// Refresh QR code
		var option = L.toArray(this.map.lookupOption(this.qrcode, section_id))[0];
		if (option)
			return option.refresh(section_id);
		else
			return Promise.resolve(null);
	},

});

return view.extend({

	render: function() {
		var m, s, o;

		m = new form.Map('fwknopd', _('Firewall Knock Operator Daemon'));

		s = m.section(form.TypedSection, 'global', _('Enable Uci/Luci control'));
		s.anonymous = true;
		s.option(form.Flag, 'uci_enabled', _('Enable config overwrite'), _('When unchecked, the config files in /etc/fwknopd will be used as is, ignoring any settings here.'));

		s = m.section(form.TypedSection, 'network', _('Network configuration'));
		s.anonymous = true;
		o = s.option(widgets.NetworkSelect, 'network', _('Network'), _('The network on which the daemon listens. The daemon \
								is automatically started when the network is up-and-running. This option \
								has precedence over “PCAP_INTF” option.'));
		o.unpecified = true;
		o.nocreate = true;
		o.rmempty = true;

		// set the access.conf settings
		s = m.section(form.TypedSection, 'access', _('access.conf stanzas'));
		s.anonymous = true;
		s.addremove = true;

		var qrCode = s.option(QrCodeValue, 'qr', _('QR code'), ('QR code to configure fwknopd Android application.'));

		o = s.option(form.Value, 'SOURCE', 'SOURCE', _('The source address from which the SPA packet will be accepted. The string “ANY” is \
								also accepted if a valid SPA packet should be honored from any source IP. \
								Networks should be specified in CIDR notation (e.g. “192.168.10.0/24”), \
								and individual IP addresses can be specified as well. Multiple entries \
								are comma-separated.'));
		o.validate = function(section_id, value) {
			return String(value).length > 0 ? true : _('The source address has to be specified.');
		}

		s.option(form.Value, 'DESTINATION', 'DESTINATION', _('The destination address for which the SPA packet will be accepted. The \
								string “ANY” is also accepted if a valid SPA packet should be honored to any \
								destination IP. Networks should be specified in CIDR notation \
								(e.g. “192.168.10.0/24”), and individual IP addresses can be specified as well. \
								Multiple entries are comma-separated.'));

		o = s.option(GenerateButton, 'keys', _('Generate keys'), _('Generates the symmetric key used for decrypting an incoming \
								SPA packet, that is encrypted by the fwknop client with Rijndael block cipher, \
								and HMAC authentication key used to verify the authenticity of the incoming SPA \
								packet before the packet is decrypted.'));
		o.inputtitle = _("Generate Keys");
		o.keytype('keytype', /^KEY/);
		o.keytype('hkeytype', /^HMAC_KEY/);
		o.qrcode('qr');

		o = s.option(form.Value, 'KEY', 'KEY', _('Define the symmetric key used for decrypting an incoming SPA \
								packet that is encrypted by the fwknop client with Rijndael.'));
		o.depends('keytype', 'KEY');
		o.onchange = L.bind(qrCode.onchange, qrCode);
		o.validate = function(section_id, value) {
			return (String(value).length > 0 && !INVALID_KEYS.includes(value)) ? true : _('The symmetric key has to be specified.');
		}

		o = s.option(form.Value, 'KEY_BASE64', 'KEY_BASE64', _('Define the symmetric key (in Base64 encoding) used for \
								decrypting an incoming SPA packet that is encrypted by the fwknop client \
								with Rijndael.'));
		o.depends('keytype', 'KEY_BASE64');
		o.onchange = L.bind(qrCode.onchange, qrCode);
		o.validate = function(section_id, value) {
			return (String(value).length > 0 && !INVALID_KEYS.includes(value)) ? true : _('The symmetric key has to be specified.');
		}

		o = s.option(KeyTypeValue, 'keytype', _('Key type'));
		o.value('KEY', _('Normal key'));
		o.value('KEY_BASE64', _('Base64 key'));
		o.onchange = L.bind(qrCode.onchange, qrCode);

		o = s.option(form.Value, 'HMAC_KEY', 'HMAC_KEY', _('Define the HMAC authentication key used for verifying \
								the authenticity of the SPA packet before the packet is decrypted.'));
		o.depends('hkeytype', 'HMAC_KEY');
		o.onchange = L.bind(qrCode.onchange, qrCode);
		o.validate = function(section_id, value) {
			return (String(value).length > 0 && !INVALID_KEYS.includes(value)) ? true : _('The HMAC authentication key has to be specified.');
		}

		o = s.option(form.Value, 'HMAC_KEY_BASE64', 'HMAC_KEY_BASE64', _('Define the HMAC authentication key \
								(in Base64 encoding) used for verifying the authenticity of the SPA \
								packet before the packet is decrypted.'));
		o.depends('hkeytype', 'HMAC_KEY_BASE64');
		o.onchange = L.bind(qrCode.onchange, qrCode);
		o.validate = function(section_id, value) {
			return (String(value).length > 0 && !INVALID_KEYS.includes(value)) ? true : _('The HMAC authentication key has to be specified.');
		}

		o = s.option(KeyTypeValue, 'hkeytype', _('HMAC key type'));
		o.value('HMAC_KEY', _('Normal key'));
		o.value('HMAC_KEY_BASE64', _('Base64 key'));
		o.onchange = L.bind(qrCode.onchange, qrCode);

		o = s.option(form.Value, 'OPEN_PORTS', 'OPEN_PORTS', _('Define a set of ports and protocols (tcp or udp) that will be opened if a valid knock sequence is seen. \
							If this entry is not set, fwknopd will attempt to honor any proto/port request specified in the SPA data \
							(unless of it matches any “RESTRICT_PORTS” entries). Multiple entries are comma-separated.'));
		o.placeholder = "protocol/port,...";

		o = s.option(form.Value, 'RESTRICT_PORTS', 'RESTRICT_PORTS', _('Define a set of ports and protocols (tcp or udp) that are explicitly not allowed \
							regardless of the validity of the incoming SPA packet. Multiple entries are comma-separated.'));
		o.placeholder = "protocol/port,...";

		o = s.option(form.Value, 'FW_ACCESS_TIMEOUT', 'FW_ACCESS_TIMEOUT', _('Define the length of time access will be granted by fwknopd through the firewall after a \
							valid knock sequence from a source IP address. If “FW_ACCESS_TIMEOUT” is not set then the default \
							timeout of 30 seconds will automatically be set.'));
		o.placeholder = "30";

		s.option(YNValue, 'REQUIRE_SOURCE_ADDRESS', 'REQUIRE_SOURCE_ADDRESS', _('Force all SPA packets to contain a real IP address within the encrypted data. \
							This makes it impossible to use the -s command line argument on the fwknop client command line, so either -R \
							has to be used to automatically resolve the external address (if the client behind a NAT) or the client must \
							know the external IP and set it via the -a argument.'));

		s = m.section(form.TypedSection, 'config', _('fwknopd.conf config options'));
		s.anonymous=true;
		s.option(form.Value, 'MAX_SPA_PACKET_AGE', 'MAX_SPA_PACKET_AGE', _('Maximum age in seconds that an SPA packet will be accepted. Defaults to 120 seconds.'));
		s.option(form.Value, 'PCAP_INTF', 'PCAP_INTF', _('Specify the ethernet interface on which fwknopd will sniff packets.'));
		s.option(YNValue, 'ENABLE_IPT_FORWARDING', 'ENABLE_IPT_FORWARDING', _('Allow SPA clients to request access to services through an iptables firewall instead of just to it.'));
		s.option(YNValue, 'ENABLE_NAT_DNS', 'ENABLE_NAT_DNS', _('Allow SPA clients to request forwarding destination by DNS name.'));

		return m.render();
	}
});
