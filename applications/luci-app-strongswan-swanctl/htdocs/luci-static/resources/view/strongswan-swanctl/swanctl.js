'use strict';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require form';
'require rpc';
'require uci';
'require ui';
'require fs';

const callListAlgorithms = rpc.declare({
	object: 'luci.swanctl',
	method: 'list-algs',
	expect: { }
});

/**
 * Append the matching swanctl.conf setting (dotted path) to a description.
 */
function swanctlDescr(descr, key) {
	const code = key.replace(/</g, '&lt;').replace(/>/g, '&gt;');

	return (descr ? descr + '<br />' : '') + '<code>swanctl.conf: ' + code + '</code>';
}

// Extend the description of the keyexchange field if IKEv1 is selected.
function showIkev1Hint(node, value) {
	let hint = node.querySelector('.cbi-value-description > span');

	if (!hint) {
		hint = E('span', { 'style': 'color: var(--error-color-high, red)' }, [
			E('br'),
			_('IKEv1 is deprecated and may be removed in future updates.'),
			E('br'),
			_('Please upgrade your connections to IKEv2.')
		]);
		node.querySelector('.cbi-value-description').appendChild(hint);
	}

	hint.hidden = !(value == 'ikev1' || value == 'ike');
}

function validateTimeFormat(section_id, value) {
	if (value && !value.match(/^\d+[smhd]$/)) {
		return _('Number must have suffix s, m, h or d');
	}

	return true;
}

function addAlgorithms(o, algorithms) {
	algorithms?.forEach(function (algorithm) {
		const { name: name, insecure: insecure } = algorithm;

		if (insecure) {
			o.value(name, '%s*'.format(name));
		} else {
			o.value(name);
		}
	});
}

/**
 * Describe how the proposal string is assembled from the single options.
 *
 * Mirrors config_ike_proposal() and config_esp_proposal() of the init
 * script. Used as o.tooltip, parts in brackets are optional.
 */
function proposalTooltip() {
	return [
		_('Without "Use custom proposal" the proposal is assembled from the options of this section:'),
		_('IKE (phase 1)') + ': proposals = encryption_algorithm-[hash_algorithm]-[prf_algorithm]-[dh_group]-[ke1_<ke>…ke7_<ke>]',
		_('ESP (phase 2)') + ': esp_proposals = encryption_algorithm-[hash_algorithm]-[dh_group]-[ke1_<ke>…ke7_<ke>]',
		_('The hash is omitted for authenticated encryption (AEAD) algorithms. The PRF is used for IKE proposals only.')
	];
}

/**
 * Show "none" in the overview table while a custom proposal is used.
 *
 * Otherwise the table would list the default algorithms, although they are
 * ignored in favor of the custom proposal string.
 */
function hideForCustomProposal(o) {
	o.textvalue = function (section_id) {
		if (uci.get('ipsec', section_id, 'use_custom_proposal') == '1')
			return null;

		return this.super('textvalue', [section_id]);
	};
}

/**
 * Add a file picker for a file below a swanctl directory.
 *
 * The UCI value is stored relative to `root`.
 */
function addFileOption(s, name, title, descr, root) {
	const o = s.option(form.FileUpload, name, title, descr.format(root));

	o.root_directory = root;

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

		// The selection is optional, an empty value removes the option.
		if (!active || !value)
			return form.FileUpload.prototype.parse.apply(this, [section_id]);

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

function sectionNameCheck(extra_class) {
	var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
		nameEl = el.querySelector('.cbi-section-create-name');
	ui.addValidator(nameEl, 'uciname', true, function(v) {
		let sections = [
			...uci.sections('ipsec', 'connection'),
			...uci.sections('ipsec', 'child'),
			...uci.sections('ipsec', 'crypto_proposal'),
			...uci.sections('ipsec', 'local'),
			...uci.sections('ipsec', 'remote'),
		];
		if (sections.find(function(s) {
			return s['.name'] == v;
		})) {
			return _('Connections, Encryption Proposals, Children, Locals and Remotes may not share the same names.') + ' ' +
				_('Use combinations like child1_phase1.');
		}
		return true;
	}, 'blur', 'keyup');
	return el;
};

let migrationOverlay = null;

function renderMigrationContent(errorMessage) {
	const dialog = migrationOverlay.firstElementChild;
	const migrateButton = E('button', {
		'class': 'btn cbi-button cbi-button-apply',
		'click': handleMigrate
	}, [_('Migrate')]);

	const content = E([], [
		E('h4', _('Migrate IPsec configuration')),
		E('p', _('A legacy IPsec configuration was found.') + ' ' +
			_('It must be migrated to the new swanctl uci schema in ' +
				'\'/etc/config/ipsec\' before it can be managed here.')),
		E('p', _('Before migration, the file \'/etc/config/ipsec\' is moved to \'/etc/config/ipsec_bak\'.') + ' ' +
			_('The migration may require manual intervention.') + ' ' +
			_('Therefore, the VPN is not restarted.')),
		E('p', _('Warning: The migration will drop all IPsec VPN connections.'))
	]);

	if (errorMessage)
		content.appendChild(E('p', errorMessage));

	content.appendChild(E('div', { 'class': 'right' }, [migrateButton]));

	dialog.replaceChildren(content);
}

function showMigrationOverlay(viewNode) {
	if (migrationOverlay)
		return;

	const dialog = E('div', { 'class': 'modal', 'style': 'margin:0;' });
	migrationOverlay = E('div', {
		'class': 'migration-overlay',
		'style': 'position:absolute;top:0;right:0;bottom:0;left:0;z-index:900;display:flex;align-items:center;justify-content:center;padding:1em;pointer-events:all;'
	}, [dialog]);

	viewNode.style.position = 'relative';
	viewNode.appendChild(migrationOverlay);

	const maincontent = document.getElementById('maincontent');
	if (maincontent)
		maincontent.style.pointerEvents = 'none';

	renderMigrationContent(null);
}

function handleMigrate() {
	const dialog = migrationOverlay.firstElementChild;

	dialog.replaceChildren(E([], [
		E('h4', _('Migrate IPsec configuration')),
		E('p', _('Migrating IPsec configuration…'))
	]));

	fs.exec('/etc/init.d/swanctl', ['migrate', L.env.sessionid]).then(function (result) {
		if (result.code != 0)
			renderMigrationContent(_('Migration failed: %s').format(result.stderr || result.stdout || _('unknown error')));
		else
			window.location.reload();
	}).catch(function (e) {
		renderMigrationContent(_('Migration failed: %s').format(e.message));
	});
}

return view.extend({
	load: function () {
		return Promise.all([
			callListAlgorithms(),
			L.resolveDefault(uci.load('network'), null),
			L.resolveDefault(uci.load('ipsec'), null),
		]).then(function (data) {
			let hasNoGlobals = uci.sections('ipsec', 'globals').length === 0;
			return {
				algorithms: data[0],
				legacyConfig: hasNoGlobals,
			};
		});
	},

	render: function (result) {
		let m, s, o;
		const legacyConfig = result.legacyConfig;
		const algorithms = result.algorithms.data ?? {};
		const error = result.algorithms.error;

		if (error)
			ui.addNotification(null, E('p', _('Some options are unavailable because swanctl failed to load: %s').format(error)), 'warning');

		m = new form.Map('ipsec', _('Connection configurations'),
			_('On this page, you can configure the IPsec connections.'));
		m.tabbed = true;

		// Connection Configuration
		s = m.section(form.GridSection, 'connection', _('Connection'),
			_('Define Connection IKE Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck

		o = s.tab('general', _('General'));
		o = s.tab('authentication', _('Authentication'));
		o = s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enabled'),
			_('Configuration is enabled or not'));
		o.rmempty = false;

		o = s.taboption('general', form.DynamicList, 'remote_addrs', _('Remote Endpoints'),
			swanctlDescr(_('IP address or FQDN name of the tunnel remote endpoints.') + ' ' +
			_('If no value is specified, "%any" is assumed.'),
				'connections.<conn>.remote_addrs'));
		o.datatype = 'or(hostname,ipaddr)';
		o.placeholder = '%any';

		o = s.taboption('general', form.DynamicList, 'local_addrs', _('Local Endpoints'),
			swanctlDescr(_('IP address or FQDN name of the tunnel local endpoints.') + ' ' +
			_('If no value is specified, "%any" is assumed.'),
				'connections.<conn>.local_addrs'));
		o.datatype = 'or(hostname,ipaddr)';
		o.placeholder = '%any';
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, 'vips', _('Virtual IP addresses'),
			swanctlDescr(_('Virtual IP addresses used as the source IP for outgoing traffic.'), 'connections.<conn>.vips'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('general', form.MultiValue, 'crypto_proposal', _('Crypto Proposal'),
			swanctlDescr(_('List of IKE (phase 1) proposals to use for authentication'), 'connections.<conn>.proposals'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'crypto_proposal').filter(function (section) {
				return section.is_esp != '1';
			});
			if (sections.length == 0) {
				this.value('', _('Please create a Proposal first'));
			} else {
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = true;

		o = s.taboption('general', form.MultiValue, 'child', _('Children'),
			swanctlDescr(_('The Children containing the ESP (phase 2) section'), 'connections.<conn>.children.<child>'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'child');
			if (sections.length == 0) {
				this.value('', _('Please create a Children first'));
			} else {
				sections.forEach(L.bind(function (section) {
					this.value(section['.name'], '%s (%s)'.format(section['.name'], section['mode']));
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		o = s.taboption('authentication', form.MultiValue, 'local', _('Local Authentication'),
			swanctlDescr(_('Local authentication sections used for this connection.') + ' ' +
			_('Each section corresponds to one authentication round.'),
				'connections.<conn>.local<suffix>'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'local');
			if (sections.length == 0) {
				this.value('', _('Please create a Local section first'));
			} else {
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};

		o = s.taboption('authentication', form.MultiValue, 'remote', _('Remote Authentication'),
			swanctlDescr(_('Remote authentication sections used for this connection.') + ' ' +
			_('Each section corresponds to one authentication round.'),
				'connections.<conn>.remote<suffix>'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'remote');
			if (sections.length == 0) {
				this.value('', _('Please create a Remote section first'));
			} else {
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		o = s.taboption('authentication', form.ListValue, 'send_cert', _('Send Certificate'),
			swanctlDescr(_('Whether to send our own certificate to the remote peer'), 'connections.<conn>.send_cert'));
		o.value('always');
		o.value('ifasked');
		o.value('never');
		o.default = 'ifasked';
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('authentication', form.Flag, 'send_certreq', _('Send Certificate Request'),
			swanctlDescr(_('Send certificate request payloads to offer trusted root CA certificates to the peer'), 'connections.<conn>.send_certreq'));
		o.default = '1';
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'mobike', _('MOBIKE'),
			swanctlDescr(_('MOBIKE (IKEv2 Mobility and Multihoming Protocol)'), 'connections.<conn>.mobike'));
		o.default = '1';
		o.modalonly = true;
		o.depends('keyexchange', 'ikev2');
		o.depends('keyexchange', 'ike');

		o = s.taboption('advanced', form.ListValue, 'fragmentation', _('IKE Fragmentation'),
			swanctlDescr(_('Use IKE fragmentation'), 'connections.<conn>.fragmentation'));
		o.value('yes');
		o.value('no');
		o.value('force');
		o.value('accept');
		o.default = 'yes';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'keyingtries', _('Keying Retries'),
			swanctlDescr(_('Number of retransmissions attempts during initial negotiation'), 'connections.<conn>.keyingtries'));
		o.datatype = 'or(uinteger, "%forever")';
		o.placeholder = '3';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'dpd_delay', _('DPD Delay'),
			swanctlDescr(_('Interval to check liveness of a peer'), 'connections.<conn>.dpd_delay'));
		o.validate = validateTimeFormat;
		o.placeholder = '30s';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'inactivity', _('Inactivity'),
			swanctlDescr(_('Interval before closing an inactive CHILD_SA'), 'connections.<conn>.children.<child>.inactivity'));
		o.validate = validateTimeFormat;
		o.placeholder = '0s';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rekey_time', _('Rekey Time'),
			swanctlDescr(_('IKEv2 interval to refresh keying material; also used to compute lifetime'), 'connections.<conn>.rekey_time'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'over_time', _('Overtime'),
			swanctlDescr(_('Limit on time to complete rekeying/reauthentication'), 'connections.<conn>.over_time'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'encap', _('ESP Encapsulation'),
			swanctlDescr(_('To enforce UDP encapsulation of ESP packets, the IKE daemon can manipulate the NAT detection payloads.') + '<br />' +
			_('This makes the peer believe that a NAT situation exist on the transmission path, forcing it to encapsulate ESP packets in UDP.') + '<br />' +
			_('Usually this is not required but it can help to work around connectivity issues with too restrictive intermediary firewalls that block ESP packets.'),
				'connections.<conn>.encap'));
		o.modalonly = true;
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('advanced', form.ListValue, 'keyexchange', _('Keyexchange'),
			swanctlDescr(_('Version of IKE for negotiation'), 'connections.<conn>.version'));
		o.value('ikev1', 'IKEv1 (%s)'.format(_('deprecated')));
		o.value('ikev2', 'IKEv2');
		o.value('ike', 'IKE (%s, %s)'.format(_('both'), _('deprecated')));
		o.default = 'ikev2';
		o.modalonly = true;
		o.render = function (option_index, section_id) {
			return form.ListValue.prototype.render.apply(this, arguments).then(L.bind(function (node) {
				showIkev1Hint(node, this.cfgvalue(section_id) ?? this.default);
				return node;
			}, this));
		};
		o.onchange = function (ev, section_id, value) {
			showIkev1Hint(ev.target.closest('.cbi-value'), value);
		};

		// Local Configuration
		s = m.section(form.GridSection, 'local', _('Local'),
			_('Define local IKE authentication rounds referenced from connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		o = s.option(form.ListValue, 'auth', _('Authentication Method'),
			swanctlDescr(_('IKE authentication (phase 1)'), 'connections.<conn>.local<suffix>.auth'));
		o.value('psk', _('Pre-shared Key'));
		o.value('pubkey', _('Public Key'));
		o.default = 'psk';
		o.rmempty = false;

		o = s.option(form.Value, 'id', _('Local Identifier'),
			swanctlDescr(_('Local identifier for IKE (phase 1)'), 'connections.<conn>.local<suffix>.id'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=headquarters';
		o.modalonly = true;

		o = addFileOption(s, 'certs', _('Local Certificate'),
			swanctlDescr(_('Certificate to use for authentication, relative to %s.'), 'connections.<conn>.local<suffix>.certs'),
			'/etc/swanctl/x509');
		o.modalonly = true;
		o.depends('auth', 'pubkey');

		o = addFileOption(s, 'key', _('Local Key'),
			_('Private key to use with the certificate, relative to %s.'),
			'/etc/swanctl/private');
		o.modalonly = true;
		o.depends('auth', 'pubkey');

		// Remote Configuration
		s = m.section(form.GridSection, 'remote', _('Remote'),
			_('Define remote IKE authentication rounds referenced from connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		o = s.option(form.ListValue, 'auth', _('Authentication Method'),
			swanctlDescr(_('IKE authentication (phase 1)'), 'connections.<conn>.remote<suffix>.auth'));
		o.value('psk', _('Pre-shared Key'));
		o.value('pubkey', _('Public Key'));
		o.value('eap-mschapv2', 'EAP MSCHAPv2');
		o.value('eap-tls', 'EAP TLS');
		o.default = 'psk';
		o.rmempty = false;

		o = s.option(form.Value, 'id', _('Remote Identifier'),
			swanctlDescr(_('Remote identifier for IKE (phase 1)'), 'connections.<conn>.remote<suffix>.id'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=soho';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'cacerts', _('Remote CA Certificates'),
			swanctlDescr(_('Restrict the remote peer\'s certificate to be issued by one of these CAs.') + '<br />' +
			_('Select a file relative to /etc/swanctl/x509ca. CA certificates can be uploaded in the authorities section.'),
				'connections.<conn>.remote<suffix>.cacerts'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			return L.resolveDefault(fs.list('/etc/swanctl/x509ca'), []).then(L.bind(function (entries) {
				entries.filter(function (entry) {
					return entry.type == 'file';
				}).forEach(L.bind(function (entry) {
					this.value(entry.name);
				}, this));

				return this.super('load', [section_id]);
			}, this));
		};
		o.modalonly = true;
		o.depends('auth', 'pubkey');
		o.depends('auth', 'eap-tls');

		o = s.option(form.Value, 'eap_id', _('EAP ID'),
			swanctlDescr(_('EAP identity to use with the remote peer'), 'connections.<conn>.remote<suffix>.eap_id'));
		o.datatype = 'string';
		o.default = '%any';
		o.depends('auth', 'eap-mschapv2');
		o.depends('auth', 'eap-tls');
		o.modalonly = true;

		// Children Configuration
		s = m.section(form.GridSection, 'child', _('Children'),
			_('Define Connection Children to be used in Remote Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		o = s.tab('general', _('General'));
		o = s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.ListValue, 'mode', _('Child mode'), swanctlDescr(null, 'connections.<conn>.children.<child>.mode'));
		o.rmempty = false;
		o.value('tunnel', _('Tunnel'));
		o.value('transport', _('Transport'));
		o.default = 'tunnel';

		o = s.taboption('general', form.DynamicList, 'local_ts', _('Local Traffic Selectors'),
			swanctlDescr(_('Local network(s)'), 'connections.<conn>.children.<child>.local_ts'));
		o.datatype = 'cidr';
		o.placeholder = '192.168.1.1/24';
		o.rmempty = false;

		o = s.taboption('general', form.DynamicList, 'remote_ts', _('Remote Traffic Selectors'),
			swanctlDescr(_('Remote network(s)'), 'connections.<conn>.children.<child>.remote_ts'));
		o.datatype = 'cidr';
		o.placeholder = '192.168.2.1/24';
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'if_id', ('XFRM Interface ID'),
			swanctlDescr(_('XFRM interface ID set on input and output interfaces'), 'connections.<conn>.children.<child>.if_id_in, connections.<conn>.children.<child>.if_id_out'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var xfrmSections = uci.sections('network').filter(function (section) {
				return section.proto == 'xfrm';
			});

			xfrmSections.forEach(L.bind(function (section) {
				this.value(section.ifid,
					'%s (%s)'.format(section.ifid, section['.name']));
			}, this));

			return this.super('load', [section_id]);
		}
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'start_action', _('Start Action'),
			swanctlDescr(_('Action on initial configuration load'), 'connections.<conn>.children.<child>.start_action'));
		o.value('', '%s (%s)'.format('none', _('default')));
		o.value('trap');
		o.value('start');
		o.optional = true;
		o.default = '';
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'close_action', _('Close Action'),
			swanctlDescr(_('Action when CHILD_SA is closed'), 'connections.<conn>.children.<child>.close_action'));
		o.value('', '%s (%s)'.format('none', _('default')));
		o.value('trap');
		o.value('start');
		o.optional = true;
		o.default = '';
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('general', form.MultiValue, 'crypto_proposal',
			_('Crypto Proposal (Phase 2)'),
			swanctlDescr(_('List of ESP (phase two) proposals. Only Proposals with checked ESP flag are selectable'), 'connections.<conn>.children.<child>.esp_proposals'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'crypto_proposal').filter(function (section) {
				return section.is_esp == '1';
			});
			if (sections.length == 0) {
				this.value('', _('Please create an ESP Proposal first'));
			} else {
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'updown', _('Up/Down Script Path'),
			swanctlDescr(_('Path to script to run on CHILD_SA up/down events'), 'connections.<conn>.children.<child>.updown'));
		o.datatype = 'file';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'dpd_action', _('DPD Action'),
			swanctlDescr(_('Action when DPD timeout occurs'), 'connections.<conn>.children.<child>.dpd_action'));
		o.value('', '%s (%s)'.format('clear', _('default')));
		o.value('trap');
		o.value('start');
		o.default = '';
		o.rmempty = true;
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rekey_time', _('Rekey Time'),
			swanctlDescr(_('Interval before a CHILD_SA is rekeyed.') + ' ' +
			_('Also used to derive lifetime (110% of this value).') + '<br />' +
			_('If not configured, the default value is "1h".'),
				'connections.<conn>.children.<child>.rekey_time')
		);
		o.placeholder = '1h';
		o.validate = validateTimeFormat;
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'life_time', _('Life Time'),
			swanctlDescr(_('Maximum time before the CHILD_SA gets closed, as a hard limit.'), 'connections.<conn>.children.<child>.life_time')
		);
		o.validate = validateTimeFormat;
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'ipcomp', _('IPComp'),
			swanctlDescr(_('Enable ipcomp compression'), 'connections.<conn>.children.<child>.ipcomp'));
		o.default = '0';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'hw_offload', _('H/W Offload'),
			swanctlDescr(_('Enable Hardware offload'), 'connections.<conn>.children.<child>.hw_offload'));
		o.value('yes');
		o.value('no');
		o.value('auto');
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'priority', _('Priority'),
			swanctlDescr(_('Priority of the CHILD_SA'), 'connections.<conn>.children.<child>.priority'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'replay_window', _('Replay Window'),
			swanctlDescr('%s; %s'.format(_('Replay Window of the CHILD_SA'),
				_('Values larger than 32 are supported by the Netlink backend only')),
				'connections.<conn>.children.<child>.replay_window'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rekey_bytes', _('Rekey Bytes'),
			swanctlDescr(_('Number of bytes processed before initiating CHILD_SA rekeying.') + ' ' +
			_('Also used to derive lifebytes if set (110% of this value).') + ' ' +
			_('Use "0" to disable byte based rekeying.'),
				'connections.<conn>.children.<child>.rekey_bytes')
		);
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'life_bytes', _('Life Bytes'),
			swanctlDescr(_('Maximum number of bytes processed before the CHILD_SA gets closed.') + ' ' +
			_('Use "0" to disable (default).'),
				'connections.<conn>.children.<child>.life_bytes')
		);
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rekey_packets', _('Rekey Packets'),
			swanctlDescr(_('Number of packets processed before initiating CHILD_SA rekeying.') + ' ' +
			_('Also used to derive lifepackets if set (110% of this value).') + ' ' +
			_('Use "0" to disable packet based rekeying (default).'),
				'connections.<conn>.children.<child>.rekey_packets')
		);
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'life_packets', _('Life Packets'),
			swanctlDescr(_('Maximum number of packets processed before the CHILD_SA gets closed.') + ' ' +
			_('Use "0" to disable (default).'),
				'connections.<conn>.children.<child>.life_packets')
		);
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.rmempty = true;
		o.modalonly = true;

		// Crypto Proposals
		s = m.section(form.GridSection, 'crypto_proposal',
			_('Encryption Proposals'),
			_('Configure Cipher Suites to define IKE (Phase 1) or ESP (Phase 2) Proposals.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		o = s.option(form.Flag, 'is_esp', _('ESP Proposal'),
			_('Whether this is an ESP (phase 2) proposal or not'));

		o = s.option(form.Flag, 'use_custom_proposal', _('Use custom proposal'),
			_('When enabled, you can specify your own proposal string.'));
		o.default = '0';
		o.rmempty = true;

		o = s.option(form.Value, 'custom_proposal', _('Custom proposal'),
			swanctlDescr(_('Using this option only if you know exactly what you are doing.') + '<br />' +
			_('Manually defining a proposal can break compatibility with peers or cause connection failures.') + '<br />' +
			_('Using this setting may prevent future updates or migrations.') + '<br />' +
			_('You are responsible for maintaining compatibility!') + '<br />' +
			_('The string is used verbatim as the proposal instead of the assembled one.'),
				'connections.<conn>.proposals, connections.<conn>.children.<child>.esp_proposals'));
		o.depends('use_custom_proposal', '1');
		o.rmempty = false;

		o = s.option(form.ListValue, 'encryption_algorithm',
			_('Encryption Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.tooltip = proposalTooltip;
		o.default = 'aes256gcm128';
		o.depends('use_custom_proposal', '0');
		addAlgorithms(o, algorithms.encryption);
		addAlgorithms(o, algorithms.aead);
		hideForCustomProposal(o);

		const encryptionAlgorithmNames = algorithms.encryption?.map(algorithm => algorithm.name);
		o = s.option(form.ListValue, 'hash_algorithm', _('Hash Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.tooltip = proposalTooltip;
		encryptionAlgorithmNames?.forEach(function (algorithmName) {
			o.depends({'encryption_algorithm': algorithmName, 'use_custom_proposal': '0'});
		});
		o.default = 'sha512';
		o.rmempty = false;
		addAlgorithms(o, algorithms.integrity);
		hideForCustomProposal(o);

		o = s.option(form.ListValue, 'dh_group', _('Diffie-Hellman Group'),
			_('Algorithms marked with * are considered insecure'));
		o.tooltip = proposalTooltip;
		o.default = 'modp3072';
		o.depends('use_custom_proposal', '0');
		addAlgorithms(o, algorithms.ke);
		hideForCustomProposal(o);

		o = s.option(form.DynamicList, 'ke', _('Multiple Key Exchanges'),
			_('With peers that support multiple IKEv2 key exchanges (RFC 9370), ') +
				('up to seven additional key exchanges may be negotiated.') + '<br/>' +
			_('If more than 7 are stored, those that exceed this limit will not be ') +
				('included in the swanctl configuration.'));
		o.tooltip = proposalTooltip;
		o.modalonly = true;
		o.depends('use_custom_proposal', '0');
		addAlgorithms(o, algorithms.ke);

		o = s.option(form.ListValue, 'prf_algorithm', _('PRF Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.tooltip = proposalTooltip;
		o.validate = function (section_id, value) {
			const encryptionAlgorithm = this.section.formvalue(section_id, 'encryption_algorithm');
			const aeadAlgorithmNames = algorithms.aead?.map(algorithm => algorithm.name);

			if (aeadAlgorithmNames?.includes(encryptionAlgorithm) && !value) {
				return _('PRF Algorithm must be configured when using an Authenticated Encryption Algorithm');
			}

			return true;
		};
		o.optional = true;
		o.depends({'is_esp': '0', 'use_custom_proposal': '0'});
		addAlgorithms(o, algorithms.prf);
		hideForCustomProposal(o);

		return m.render().then(function (node) {
			if (legacyConfig)
				showMigrationOverlay(node);
			return ikev1.prepend(node);
		});
	}
});
