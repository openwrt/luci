'use strict';
'require form';
'require network';
'require rpc';
'require tools.widgets as widgets';
'require uci';
'require ui';
network.registerPatternVirtual(/^yggdrasil-.+$/);

function validatePrivateKey(section_id,value) {
	if (value.length == 0) {
		return true;
	};
	if (!value.match(/^([0-9a-fA-F]){128}$/)) {
		if (value != "auto") {
			return _('Invalid private key string %s').format(value);
		}
		return true;
	}
	return true;
};

function validatePublicKey(section_id,value) {
	if (value.length == 0) {
		return true;
	};
	if (!value.match(/^([0-9a-fA-F]){64}$/))
		return _('Invalid public key string %s').format(value);
	return true;
};

function validateYggdrasilListenUri(section_id,value) {
	if (value.length == 0) {
		return true;
	};
	if (!value.match(/^(tls|tcp|unix|quic):\/\//))
		return _('Unsupported URI scheme in %s').format(value);
	return true;
};

function validateYggdrasilPeerUri(section_id,value) {
	if (!value.match(/^(tls|tcp|unix|quic|socks|sockstls):\/\//))
		return _('URI scheme %s not supported').format(value);
	return true;
};

var cbiKeyPairGenerate = form.DummyValue.extend({
	cfgvalue: function(section_id, value) {
		return E('button', {
			'class':'btn',
			'click':ui.createHandlerFn(this, function(section_id,ev) {
				var prv = this.section.getUIElement(section_id,'private_key'),
					pub = this.section.getUIElement(section_id,'public_key'),
					map = this.map;

				return generateKey().then(function(keypair){
					prv.setValue(keypair.priv);
					pub.setValue(keypair.pub);
					map.save(null,true);
				});
			},section_id)
		},[_('Generate new key pair')]);
	}
});

function updateActivePeers(ifname) {
	getPeers(ifname).then(function(peers){
		var table = document.querySelector('#yggdrasil-active-peerings-' + ifname);
		if (table) {
			while (table.rows.length > 1) { table.deleteRow(1); }
			peers.forEach(function(peer) {
				var row = table.insertRow(-1);
				row.style.fontSize = "xx-small";
				if (!peer.up) {
					row.style.opacity = "66%";
				}
				var cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = peer.remote;

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = peer.up ? "Up" : "Down";

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = peer.inbound ? "In" : "Out";

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.innerHTML = "<u style='cursor: default'>" + peer.address + "</u>"
				cell.dataToggle = "tooltip";
				cell.title = "Key: " + peer.key;

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = '%t'.format(peer.uptime);

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = '%.2f ms'.format(peer.latency_ms / 10**6);

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = '%.2mB'.format(peer.bytes_recvd);

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = '%.2mB'.format(peer.bytes_sent);

				cell = row.insertCell(-1)
				cell.className = "td"
				cell.textContent = peer.priority;

				cell = row.insertCell(-1)
				cell.className = "td"
				if (!peer.up) {
					cell.innerHTML = "<u style='cursor: default'>%t ago</u>".format(peer.last_error_time)
					cell.dataToggle = "tooltip"
					cell.title = peer.last_error
				} else {
					cell.innerHTML = "-"
				}
			});
			setTimeout(updateActivePeers.bind(this, ifname), 5000);
		}
	});
}

var cbiActivePeers = form.DummyValue.extend({
	cfgvalue: function(section_id, value) {
		updateActivePeers(this.option);
		return E('table', {
			'class': 'table',
			'id': 'yggdrasil-active-peerings-' + this.option,
		},[
			E('tr', {'class': 'tr'}, [
				E('th', {'class': 'th'}, _('URI')),
				E('th', {'class': 'th'}, _('State')),
				E('th', {'class': 'th'}, _('Dir')),
				E('th', {'class': 'th'}, _('IP Address')),
				E('th', {'class': 'th'}, _('Uptime')),
				E('th', {'class': 'th'}, _('Latency')),
				E('th', {'class': 'th'}, _('RX')),
				E('th', {'class': 'th'}, _('TX')),
				E('th', {'class': 'th'}, _('Priority')),
				E('th', {'class': 'th'}, _('Last Error')),
			])
		]);
	}
});

var generateKey = rpc.declare({
	object:'luci.yggdrasil',
	method:'generateKeyPair',
	expect:{keys:{}}
});

var getPeers = rpc.declare({
	object:'luci.yggdrasil',
	method:'getPeers',
	params:['interface'],
	expect:{peers:[]}
});

var callIsJumperInstalled = rpc.declare({
	object:'luci.yggdrasil-jumper',
	method:'isInstalled',
	expect:{isInstalled: false}
});

var callValidateJumperConfig = rpc.declare({
	object:'luci.yggdrasil-jumper',
	method:'validateConfig',
	params:['config'],
	expect:{output: "Unknown error."}
});

function validateJumperConfig(section) {
	var last_input = "", last_output = "";

	return function(section_id, input) {
		if (last_input != input) {
			last_input = input

			callValidateJumperConfig(input).then(function(output) {
				last_output = output;

				var option = section.getUIElement(section_id).jumper_config;
				option.triggerValidation(section_id);
			});
		}

		if (last_output.length == 0) {
			return true;
		}

		return _(last_output);
	};
};

return network.registerProtocol('yggdrasil',
	{
		getI18n: function() {
			return _('Yggdrasil Network');
		},
		getIfname: function() {
			return this._ubus('l3_device') || this.sid;
		},
		getType: function() {
			return "tunnel";
		},
		getPackageName: function() {
			return 'yggdrasil';
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
			return(network.getIfnameOf(ifname)==this.getIfname());
		},
		renderFormOptions: function(s) {
			var o, ss;
			o=s.taboption('general',form.Value,'private_key',_('Private key'),_('The private key for your Yggdrasil node'));
			o.optional=false;
			o.password=true;
			o.validate=validatePrivateKey;

			o=s.taboption('general',form.Value,'public_key',_('Public key'),_('The public key for your Yggdrasil node'));
			o.optional=true;
			o.validate=validatePublicKey;

			s.taboption('general',cbiKeyPairGenerate,'_gen_server_keypair',' ');

			o=s.taboption('advanced',form.Value,'mtu',_('MTU'),_('A default MTU of 65535 is set by Yggdrasil. It is recomended to utilize the default.'));
			o.optional=true;
			o.placeholder=65535;
			o.datatype='range(1280, 65535)';

			o=s.taboption('general',form.TextValue,'node_info',_('Node info'),_('Optional node info. This must be a { "key": "value", ... } map or set as null. This is entirely optional but, if set, is visible to the whole network on request.'));
			o.optional=true;
			o.placeholder="{}";

			o=s.taboption('general',form.Flag,'node_info_privacy',_('Node info privacy'),_('Enable node info privacy so that only items specified in "Node info" are sent back. Otherwise defaults including the platform, architecture and Yggdrasil version are included.'));
			o.default=o.disabled;

			try {
				s.tab('peers',_('Peers'));
			} catch(e) {};
			o=s.taboption('peers', form.SectionValue, '_active', form.NamedSection, this.sid, "interface", _("Active peers"))
			ss=o.subsection;
			ss.option(cbiActivePeers, this.sid);

			o=s.taboption('peers', form.SectionValue, '_listen', form.NamedSection, this.sid, "interface", _("Listen for peers"))
			ss=o.subsection;

			o=ss.option(form.DynamicList,'listen_address',_('Listen addresses'), _('Add listeners in order to accept incoming peerings from non-local nodes. Multicast peer discovery works regardless of listeners set here. URI Format: <code>tls://0.0.0.0:0</code> or <code>tls://[::]:0</code> to listen on all interfaces. Choose an acceptable URI <code>tls://</code>, <code>tcp://</code>, <code>unix://</code> or <code>quic://</code>'));
			o.placeholder="tls://0.0.0.0:0"
			o.validate=validateYggdrasilListenUri;

			o=s.taboption('peers',form.DynamicList,'allowed_public_key',_('Accept from public keys'),_('If empty, all incoming connections will be allowed (default). This does not affect outgoing peerings, nor link-local peers discovered via multicast.'));
			o.validate=validatePublicKey;

			o=s.taboption('peers', form.SectionValue, '_peers', form.TableSection, 'yggdrasil_%s_peer'.format(this.sid), _("Peer addresses"))
			ss=o.subsection;
			ss.addremove=true;
			ss.anonymous=true;
			ss.addbtntitle=_("Add peer address");

			o=ss.option(form.Value,"address",_("Peer URI"));
			o.placeholder="tls://0.0.0.0:0"
			o.validate=validateYggdrasilPeerUri;
			ss.option(widgets.NetworkSelect,"interface",_("Peer interface"));

			o=s.taboption('peers', form.SectionValue, '_interfaces', form.TableSection, 'yggdrasil_%s_interface'.format(this.sid), _("Multicast rules"))
			ss=o.subsection;
			ss.addbtntitle=_("Add multicast rule");
			ss.addremove=true;
			ss.anonymous=true;

			o=ss.option(widgets.DeviceSelect,"interface",_("Devices"));
			o.multiple=true;

			ss.option(form.Flag,"beacon",_("Send multicast beacon"));

			ss.option(form.Flag,"listen",_("Listen to multicast beacons"));

			o=ss.option(form.Value,"port",_("Port"));
			o.optional=true;
			o.datatype='range(1, 65535)';

			o=ss.option(form.Value,"password",_("Password"));
			o.optional=true;

			// Jumper tab
			try {
				s.tab('jumper',_('Jumper'));
			} catch(e) {};

			o=s.taboption(
				'jumper',
				form.HiddenValue,
				'hidden_value',
				' ',
				_('%s is an independent project that aims to reduce latency of a connection over Yggdrasil network transparently, utilizing NAT traversal to bypass intermediary nodes.'.format('<a href="https://github.com/one-d-wide/yggdrasil-jumper">Yggdrasil Jumper</a>'))
					+ ' ' + _('It periodically probes for active sessions and automatically establishes direct peerings over internet with remote nodes running Yggdrasil Jumper without requiring firewall or port configuration.')
			);

			o=s.taboption(
				'jumper',
				form.Flag,
				'jumper_enable',
				_('Enable Yggdrasil Jumper'),
				_('The checkbox cannot be modified unless the <code>yggdrasil-jumper</code> package is installed.')
			);
			o.default=false;
			o.rmempty=false;
			o.readonly=true;

			// Unlock enable option if jumper is installed
			callIsJumperInstalled().then(function(isInstalled) {
				if (isInstalled) {
					var o = s.children.find(function(o) { return o.option == "jumper_enable"; });
					o.readonly = false;
					// Explicit rerendering request isn't needed because the protocol tab
					// is constructed only after all async functions is done
				}
			});

			o=s.taboption(
				'jumper',
				form.ListValue,
				'jumper_loglevel',
				_('Log level')
			);
			o.value('off', _('Off'));
			o.value('error', _('Error'));
			o.value('warn', _('Warn'));
			o.value('info', _('Info'));
			o.value('debug', _('Debug'));
			o.value('trace', _('Trace'));
			o.default='info';
			o.rmempty=false;

			o=s.taboption(
				'jumper',
				form.Flag,
				'allocate_listen_addresses',
				_('Allocate listen addresses'),
				_('Allow Yggdrasil Jumper to configure Yggdrasil with proper listen address and random port automatically.')
			);
			o.default=true;
			o.rmempty=false;

			o=s.taboption(
				'jumper',
				form.Flag,
				'jumper_autofill_listen_addresses',
				_('Autofill listen addresses'),
				_('Retrieve the listener addresses from the Yggdrasil interface configuration.')
			);
			o.default=true;
			o.rmempty=false;

			o=s.taboption(
				'jumper',
				form.TextValue,
				'jumper_config',
				_('Extra config'),
				_('Additional configuration settings (in TOML format).')
			);
			o.optional=true;
			o.validate=validateJumperConfig(s);

			return;
		},
		deleteConfiguration: function() {
			uci.sections('network', 'yggdrasil_%s_interface'.format(this.sid), function(s) {
				uci.remove('network', s['.name']);
			});
			uci.sections('network', 'yggdrasil_%s_peer'.format(this.sid), function(s) {
				uci.remove('network', s['.name']);
			});
		}
	}
);
