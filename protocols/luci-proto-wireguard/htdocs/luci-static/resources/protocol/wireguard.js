'use strict';
'require ui';
'require uci';
'require rpc';
'require form';
'require network';

var generateKey = rpc.declare({
	object: 'luci.wireguard',
	method: 'generateKeyPair',
	expect: { keys: {} }
});

var getPublicAndPrivateKeyFromPrivate = rpc.declare({
	object: 'luci.wireguard',
	method: 'getPublicAndPrivateKeyFromPrivate',
	params: ['privkey'],
	expect: { keys: {} }
});

var generateQrCode = rpc.declare({
	object: 'luci.wireguard',
	method: 'generateQrCode',
	params: ['privkey', 'psk', 'allowed_ips'],
	expect: { qr_code: '' }
});

function validateBase64(section_id, value) {
	if (value.length == 0)
		return true;

	if (value.length != 44 || !value.match(/^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/))
		return _('Invalid Base64 key string');

	if (value[43] != "=" )
		return _('Invalid Base64 key string');

	return true;
}

function findSection(sections, name) {
	for (var i = 0; i < sections.length; i++) {
		var section = sections[i];
		if (section['.name'] == name) return section;
	}

	return null;
}

function generateDescription(name, texts) {
	return E('li', { 'style': 'color: inherit;' }, [
		E('span', name),
		E('ul', texts.map(function (text) {
			return E('li', { 'style': 'color: inherit;' }, text);
		}))
	]);
}

return network.registerProtocol('wireguard', {
	getI18n: function() {
		return _('WireGuard VPN');
	},

	getIfname: function() {
		return this._ubus('l3_device') || this.sid;
	},

	getOpkgPackage: function() {
		return 'wireguard-tools';
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
		var o, ss;

		// -- general ---------------------------------------------------------------------

		o = s.taboption('general', form.Value, 'private_key', _('Private Key'), _('Required. Base64-encoded private key for this interface.'));
		o.password = true;
		o.validate = validateBase64;
		o.rmempty = false;

		var sections = uci.sections('network');
		var serverName = this.getIfname();
		var server = findSection(sections, serverName);

		o = s.taboption('general', form.Value, 'public_key', _('Public Key'), _('Base64-encoded public key of this interface for sharing.'));
		o.rmempty = false;
		o.write = function() {/* write nothing */};

		o.load = function(s) {
			return getPublicAndPrivateKeyFromPrivate(server.private_key).then(
				function(keypair) {
					return keypair.pub || '';
				}, 
				function(error){
					return _('Error getting PublicKey');
			}, this)
		};

		o = s.taboption('general', form.Button, 'generate_key', _('Generate Key'));
		o.inputstyle = 'apply';
		o.onclick = ui.createHandlerFn(this, function(section_id, ev) {
			 return generateKey().then(function(keypair) {
				var keyInput = document.getElementById('widget.cbid.network.%s.private_key'.format(section_id)),
					changeEvent = new Event('change'),
					pubKeyInput = document.getElementById('widget.cbid.network.%s.public_key'.format(section_id));

				keyInput.value = keypair.priv || '';
				pubKeyInput.value = keypair.pub || '';
				keyInput.dispatchEvent(changeEvent);
			});
		}, s.section);

		o = s.taboption('general', form.Value, 'listen_port', _('Listen Port'), _('Optional. UDP port used for outgoing and incoming packets.'));
		o.datatype = 'port';
		o.placeholder = _('random');
		o.optional = true;

		o = s.taboption('general', form.DynamicList, 'addresses', _('IP Addresses'), _('Recommended. IP addresses of the WireGuard interface.'));
		o.datatype = 'ipaddr';
		o.optional = true;

		o = s.taboption('general', form.Flag, 'nohostroute', _('No Host Routes'), _('Optional. Do not create host routes to peers.'));
		o.optional = true;

		// -- advanced --------------------------------------------------------------------

		o = s.taboption('advanced', form.Value, 'mtu', _('MTU'), _('Optional. Maximum Transmission Unit of tunnel interface.'));
		o.datatype = 'range(1280,1420)';
		o.placeholder = '1420';
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'fwmark', _('Firewall Mark'), _('Optional. 32-bit mark for outgoing encrypted packets. Enter value in hex, starting with <code>0x</code>.'));
		o.optional = true;
		o.validate = function(section_id, value) {
			if (value.length > 0 && !value.match(/^0x[a-fA-F0-9]{1,8}$/))
				return _('Invalid hexadecimal value');

			return true;
		};


		// -- peers -----------------------------------------------------------------------

		try {
			s.tab('peers', _('Peers'), _('Further information about WireGuard interfaces and peers at <a href=\'http://wireguard.com\'>wireguard.com</a>.'));
		}
		catch(e) {}

		o = s.taboption('peers', form.SectionValue, '_peers', form.GridSection, 'wireguard_%s'.format(s.section));
		o.depends('proto', 'wireguard');

		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;
		ss.addbtntitle = _('Add peer');
		ss.nodescriptions = true;
		ss.modaltitle = _('Edit peer');

		ss.renderSectionPlaceholder = function() {
			return E([], [
				E('br'),
				E('em', _('No peers defined yet'))
			]);
		};

		o = ss.option(form.Flag, 'disabled', _('Peer disabled'), _('Enable / Disable peer. Restart wireguard interface to apply changes.'));
		o.optional = true;
		o.editable = true;

		o = ss.option(form.Value, 'description', _('Description'), _('Optional. Description of peer.'));
		o.placeholder = 'My Peer';
		o.datatype = 'string';
		o.optional = true;

		o = ss.option(form.Value, 'description', _('QR-Code'));
		o.modalonly = true;
		o.render = L.bind(function (view, section_id) {
			var sections = uci.sections('network');
			var client = findSection(sections, section_id);
			var serverName = this.getIfname();
			var server = findSection(sections, serverName);

			var interfaceTexts = [
				'PrivateKey: ' + _('A random, on the fly generated "PrivateKey", the key will not be saved on the router')
			];

			var peerTexts = [
				'PublicKey: ' + _('The "PublicKey" of that wg interface'),
				'AllowedIPs: ' + _('The list of this client\'s "AllowedIPs" or "0.0.0.0/0, ::/0" if not configured'),
				'PresharedKey: ' + _('If available, the client\'s "PresharedKey"')
			];

			var description = [
				E('span', [
					_('If there are any unsaved changes for this client, please save the configuration before generating a QR-Code'),
					E('br'),
					_('The QR-Code works per wg interface, it will be refreshed with every button click and transfers the following information:')
				]),
				E('ul', [
					generateDescription('[Interface]', interfaceTexts),
					generateDescription('[Peer]', peerTexts)
				])
			];

			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('QR-Code')),
				E('div', {
					'class': 'cbi-value-field',
					'style': 'display: flex; flex-direction: column; align-items: baseline;',
					'id': 'qr-' + section_id
				}, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function (server, client, section_id) {
							var qrDiv = document.getElementById('qr-' + section_id);
							var qrEl = qrDiv.querySelector('value');
							var qrBtn = qrDiv.querySelector('button');
							var qrencodeErr = '<b>%q</b>'.format(
								_('For QR-Code support please install the qrencode package!'));

							if (qrEl.innerHTML != '' && qrEl.innerHTML != qrencodeErr) {
								qrEl.innerHTML = '';
								qrBtn.innerHTML = _('Generate New QR-Code')
							} else {
								qrEl.innerHTML = _('Loading QR-Code...');

								generateQrCode(server.private_key, client.preshared_key,
									client.allowed_ips).then(function (qrCode) {
										if (qrCode == '') {
											qrEl.innerHTML = qrencodeErr;
										} else {
											qrEl.innerHTML = qrCode;
											qrBtn.innerHTML = _('Hide QR-Code');
										}
									});
							}
						}, server, client, section_id)
					}, _('Generate new QR-Code')),
					E('value', {
						'class': 'cbi-section',
						'style': 'margin: 0;'
					}),
					E('div', { 'class': 'cbi-value-description' }, description)
				])
			]);
		}, this);

		o = ss.option(form.Value, 'public_key', _('Public Key'), _('Required. Base64-encoded public key of peer.'));
		o.modalonly = true;
		o.validate = validateBase64;
		o.rmempty = false;

		o = ss.option(form.Value, 'preshared_key', _('Preshared Key'), _('Optional. Base64-encoded preshared key. Adds in an additional layer of symmetric-key cryptography for post-quantum resistance.'));
		o.modalonly = true;
		o.password = true;
		o.validate = validateBase64;
		o.optional = true;

		o = ss.option(form.DynamicList, 'allowed_ips', _('Allowed IPs'), _("Optional. IP addresses and prefixes that this peer is allowed to use inside the tunnel. Usually the peer's tunnel IP addresses and the networks the peer routes through the tunnel."));
		o.datatype = 'ipaddr';
		o.optional = true;

		o = ss.option(form.Flag, 'route_allowed_ips', _('Route Allowed IPs'), _('Optional. Create routes for Allowed IPs for this peer.'));
		o.modalonly = true;

		o = ss.option(form.Value, 'endpoint_host', _('Endpoint Host'), _('Optional. Host of peer. Names are resolved prior to bringing up the interface.'));
		o.placeholder = 'vpn.example.com';
		o.datatype = 'host';

		o = ss.option(form.Value, 'endpoint_port', _('Endpoint Port'), _('Optional. Port of peer.'));
		o.placeholder = '51820';
		o.datatype = 'port';

		o = ss.option(form.Value, 'persistent_keepalive', _('Persistent Keep Alive'), _('Optional. Seconds between keep alive messages. Default is 0 (disabled). Recommended value if this device is behind a NAT is 25.'));
		o.modalonly = true;
		o.datatype = 'range(0,65535)';
		o.placeholder = '0';
	},

	deleteConfiguration: function() {
		uci.sections('network', 'wireguard_%s'.format(this.sid), function(s) {
			uci.remove('network', s['.name']);
		});
	}
});
