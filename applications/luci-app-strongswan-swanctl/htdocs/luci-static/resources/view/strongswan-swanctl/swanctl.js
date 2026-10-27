'use strict';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require strongswan-swanctl.service as service';
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

/**
 * Validate a mark value.
 *
 * Mirrors swanctl_is_valid_mark() of the init script: %unique, %unique-dir
 * or <value>[/<mask>], with decimal or hexadecimal (0x...) numbers.
 */
function validateMark(section_id, value) {
	if (!value || value == '%unique' || value == '%unique-dir')
		return true;

	const decimal = '[0-9]+';
	const hexadecimal = '0[xX][0-9a-fA-F]+';
	const number = '(?:%s|%s)'.format(decimal, hexadecimal);

	// '^%s(?:/%s)?$' matches the whole string as <number> or <number>/<number>:
	//   ^ and $       anchor the pattern to the start and end of the value
	//   %s            a decimal or hexadecimal number (the value)
	//   (?:/%s)?      an optional, non-capturing group: a slash followed by
	//                 another number (the mask)
	const markRegex = new RegExp('^%s(?:/%s)?$'.format(number, number));

	if (!markRegex.test(value))
		return _('Expecting: %s').format(
			_('%s, %s or %s with decimal or hexadecimal (0x...) numbers')
				.format('%unique', '%unique-dir', '<value>[/<mask>]'));

	return true;
}

function markDescription() {
	return [
		_('Format:'),
		'<code>&lt;value&gt;[/&lt;mask&gt;]</code>: ' + _('Decimal or hexadecimal (0x prefix) numbers.') + ' ' +
			_('The mask defaults to 0xffffffff.'),
		'<code>%unique</code>: ' + _('A unique mark is allocated for each CHILD_SA.') + ' ' +
			_('If set for Mark In and Mark Out, both directions use the same mark.'),
		'<code>%unique-dir</code>: ' + _('A unique mark is allocated for each CHILD_SA and direction, so Mark In and Mark Out differ.'),
		_('Leave empty to not set a mark.')
	].join('<br />');
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
 * Tooltip for a form.MultiValue whose choices are sections of another type.
 *
 * The dropdown of a MultiValue only shows values which are available as
 * choice, so warn about configured values which are not available (anymore),
 * e.g. if the section was deleted. Otherwise warn if there is nothing to
 * select at all.
 * Used as o.tooltip, both arguments are arrays of tooltip lines, %s in the
 * first line of missing is replaced by the unavailable values.
 */
function multiValueSectionTooltip(missing, empty) {
	return function (section_id) {
		const values = L.toArray(this.cfgvalue(section_id));
		const unavailable = values.filter(value => !this.keylist.includes(value));

		if (unavailable.length > 0)
			return [ missing[0].format(unavailable.join(', ')), ...missing.slice(1) ];

		if (this.keylist.length > 0 || values.length > 0)
			return null;

		return empty;
	};
}

/**
 * Whether the cipher is an authenticated encryption (AEAD) algorithm.
 *
 * Mirrors is_aead() of the init script.
 */
function isAead(cipher) {
	return /^(aes.*(gcm|ccm|gmac)|chacha20poly1305$)/.test(cipher ?? '');
}

/**
 * Assemble the proposal string of a crypto_proposal section.
 *
 * Mirrors config_ike_proposal(), config_esp_proposal() and append_ke() of
 * the init script, so the overview table shows the same string as written to
 * the swanctl configuration. See proposalTooltip().
 */
function assembleProposal(section_id) {
	const get = option => uci.get('ipsec', section_id, option);

	if (get('use_custom_proposal') == '1')
		return get('custom_proposal') || null;

	const encryption = get('encryption_algorithm');

	if (!encryption)
		return null;

	const parts = [ encryption ];

	if (!isAead(encryption) && get('hash_algorithm'))
		parts.push(get('hash_algorithm'));

	if (get('is_esp') != '1' && get('prf_algorithm'))
		parts.push(get('prf_algorithm'));

	if (get('dh_group'))
		parts.push(get('dh_group'));

	L.toArray(get('ke')).filter(ke => ke).slice(0, 7).forEach(function (ke, i) {
		parts.push(/^ke[1-7]_/.test(ke) ? ke : 'ke%d_%s'.format(i + 1, ke));
	});

	return parts.join('-');
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

/**
 * Add the tabs and options of a child section (ESP, phase 2) to `s`.
 */
function addChildOptions(s) {
	let o;

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
	o.tooltip = function () {
		if (uci.get('ipsec', 'netlink', 'install_routes_xfrmi') == '1')
			return null;

		return _('This option must be enabled in the service configuration (Netlink Settings) for routes to be set automatically.') + '<br />' +
			'<code>ipsec.netlink.install_routes_xfrmi</code><br />' +
			_('Otherwise, routes for the XFRM interface must be set manually.');
	};
	o.tooltipicon = '⚠️';
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

		uci.sections('ipsec', 'crypto_proposal').filter(function (section) {
			return section.is_esp == '1';
		}).forEach(L.bind(function (section) {
			this.value(section['.name']);
		}, this));

		return this.super('load', [section_id]);
	};
	o.tooltip = multiValueSectionTooltip([
		_('Configured proposals are not available as ESP proposal: %s'),
		_('Check the ESP Proposal option of the proposals or create the missing ones.')
	], [
		_('No ESP proposal exists yet.'),
		_('Create a proposal with the ESP Proposal option enabled first.')
	]);
	o.tooltipicon = '⚠️';
	o.rmempty = true;

	o = s.taboption('advanced', form.Value, 'updown', _('Up/Down Script Path'),
		swanctlDescr(_('Path to script to run on CHILD_SA up/down events'), 'connections.<conn>.children.<child>.updown'));
	o.datatype = 'file';
	o.modalonly = true;

	o = s.taboption('advanced', form.ListValue, 'dpd_action', _('DPD Action'),
		swanctlDescr(_('Action when DPD timeout occurs'), 'connections.<conn>.children.<child>.dpd_action'));
	o.value('', '%s (%s)'.format('clear', _('default')));
	o.value('trap');
	o.value('restart');
	o.default = '';
	o.rmempty = true;
	o.optional = true;
	o.modalonly = true;

	o = s.taboption('advanced', form.Value, 'inactivity', _('Inactivity'),
		swanctlDescr(_('Interval before closing an inactive CHILD_SA'), 'connections.<conn>.children.<child>.inactivity'));
	o.validate = validateTimeFormat;
	o.placeholder = '0s';
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

	o = s.taboption('advanced', form.Value, 'rand_time', _('Random Time'),
		swanctlDescr(_('Time range from which to choose a random value to subtract from the rekey time.') + '<br />' +
		_('If not configured, the difference between life time and rekey time is used.') + '<br />' +
		_('Use %s to disable randomization.').format('<code>0s</code>'),
			'connections.<conn>.children.<child>.rand_time')
	);
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

	o = s.taboption('advanced', form.Flag, 'policies', _('Policies'),
		swanctlDescr(_('Whether to install IPsec policies or not.') + ' ' +
		_('Disabling this is only useful in special cases, e.g. with route based routing.'),
			'connections.<conn>.children.<child>.policies'));
	o.default = '1';
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

	o = s.taboption('advanced', form.Value, 'mark_in', _('Mark In'),
		swanctlDescr(_('Netfilter mark on inbound traffic, used to match the policy.') + '<br />' +
			markDescription(),
			'connections.<conn>.children.<child>.mark_in'));
	o.value('%unique');
	o.value('%unique-dir');
	o.optional = true;
	o.validate = validateMark;
	o.modalonly = true;

	o = s.taboption('advanced', form.Value, 'mark_out', _('Mark Out'),
		swanctlDescr(_('Netfilter mark applied to outbound traffic, used to match the policy.') + '<br />' +
			markDescription(),
			'connections.<conn>.children.<child>.mark_out'));
	o.value('%unique');
	o.value('%unique-dir');
	o.optional = true;
	o.validate = validateMark;
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
}

/**
 * Add the options of a local authentication round to `s`.
 */
function addLocalOptions(s) {
	let o;

	o = s.option(form.ListValue, 'auth', _('Authentication Method'),
		swanctlDescr(_('IKE authentication (phase 1)'), 'connections.<conn>.local<suffix>.auth'));
	o.value('psk', _('Pre-shared Key'));
	o.value('pubkey', _('Public Key'));
	o.value('eap-mschapv2', _('EAP MSCHAPv2'));
	o.value('eap-tls', _('EAP TLS'));
	o.value('xauth', _('XAuth (IKEv1 only)'));
	o.default = 'psk';
	o.rmempty = false;

	o = s.option(form.Value, 'id', _('Local Identifier'),
		swanctlDescr(_('Local identifier for IKE (phase 1)'), 'connections.<conn>.local<suffix>.id'));
	o.datatype = 'string';
	o.placeholder = 'C=US, O=Acme Corporation, CN=headquarters';
	o.modalonly = true;

	o = s.option(form.FileUploadList, 'certs', _('Local Certificates'),
		swanctlDescr(_('Certificates to use for authentication.') + '<br />' +
		_('Select a file relative to /etc/swanctl/x509 or upload a new one.'),
			'connections.<conn>.local<suffix>.certs'));
	o.root_directory = '/etc/swanctl/x509';
	o.absolute_path = false;
	o.enable_upload = true;
	o.enable_remove = true;
	o.modalonly = true;
	o.depends('auth', 'pubkey');
	o.depends('auth', 'eap-tls');

	o = s.option(form.FileUploadList, 'pubkeys', _('Local Public Keys'),
		swanctlDescr(_('Raw public keys to use for authentication.') + '<br />' +
		_('Select a file relative to /etc/swanctl/pubkey or upload a new one.'),
			'connections.<conn>.local<suffix>.pubkeys'));
	o.root_directory = '/etc/swanctl/pubkey';
	o.absolute_path = false;
	o.enable_upload = true;
	o.enable_remove = true;
	o.modalonly = true;
	o.depends('auth', 'pubkey');

	o = addFileOption(s, 'key', _('Local Key'),
		_('Private key to use with the certificate, relative to %s.'),
		'/etc/swanctl/private');
	o.modalonly = true;
	o.depends('auth', 'pubkey');
	o.depends('auth', 'eap-tls');

	o = s.option(form.Value, 'eap_id', _('EAP ID'),
		swanctlDescr(_('Client EAP identity to use in the EAP method.') + ' ' +
			_('Defaults to the local identity.'),
			'connections.<conn>.local<suffix>.eap_id'));
	o.datatype = 'string';
	o.modalonly = true;
	o.depends('auth', 'eap-mschapv2');
	o.depends('auth', 'eap-tls');

	o = s.option(form.Value, 'aaa_id', _('AAA ID'),
		swanctlDescr(_('Server side EAP identity to expect in the EAP method.') + ' ' +
			_('Defaults to the remote identity.'),
			'connections.<conn>.local<suffix>.aaa_id'));
	o.datatype = 'string';
	o.modalonly = true;
	o.depends('auth', 'eap-mschapv2');
	o.depends('auth', 'eap-tls');

	o = s.option(form.Value, 'xauth_id', _('XAuth ID'),
		swanctlDescr(_('Client XAuth username used in the XAuth exchange.') + ' ' +
			_('Defaults to the local identity.') + ' ' +
			_('Only supported with IKEv1.'),
			'connections.<conn>.local<suffix>.xauth_id'));
	o.datatype = 'string';
	o.modalonly = true;
	o.depends('auth', 'xauth');
}

/**
 * Add the options of a remote authentication round to `s`.
 */
function addRemoteOptions(s) {
	let o;

	o = s.option(form.ListValue, 'auth', _('Authentication Method'),
		swanctlDescr(_('IKE authentication (phase 1)'), 'connections.<conn>.remote<suffix>.auth'));
	o.value('psk', _('Pre-shared Key'));
	o.value('pubkey', _('Public Key'));
	o.value('eap-mschapv2', _('EAP MSCHAPv2'));
	o.value('eap-tls', _('EAP TLS'));
	o.default = 'psk';
	o.rmempty = false;

	o = s.option(form.Value, 'id', _('Remote Identifier'),
		swanctlDescr(_('Remote identifier for IKE (phase 1)'), 'connections.<conn>.remote<suffix>.id'));
	o.datatype = 'string';
	o.placeholder = 'C=US, O=Acme Corporation, CN=soho';
	o.modalonly = true;

	o = s.option(form.FileUploadList, 'cacerts', _('Remote CA Certificates'),
		swanctlDescr(_('Restrict the remote peer\'s certificate to be issued by one of these CAs.') + '<br />' +
		_('Select a file relative to /etc/swanctl/x509ca or upload a new one.'),
			'connections.<conn>.remote<suffix>.cacerts'));
	o.root_directory = '/etc/swanctl/x509ca';
	o.absolute_path = false;
	o.enable_upload = true;
	o.enable_remove = true;
	o.modalonly = true;
	o.depends('auth', 'pubkey');
	o.depends('auth', 'eap-tls');

	o = s.option(form.FileUploadList, 'pubkeys', _('Remote Public Keys'),
		swanctlDescr(_('Raw public keys accepted for authentication of the remote peer.') + '<br />' +
		_('Select a file relative to /etc/swanctl/pubkey or upload a new one.'),
			'connections.<conn>.remote<suffix>.pubkeys'));
	o.root_directory = '/etc/swanctl/pubkey';
	o.absolute_path = false;
	o.enable_upload = true;
	o.enable_remove = true;
	o.modalonly = true;
	o.depends('auth', 'pubkey');

	o = s.option(form.Value, 'eap_id', _('EAP ID'),
		swanctlDescr(_('EAP identity to use with the remote peer'), 'connections.<conn>.remote<suffix>.eap_id'));
	o.datatype = 'string';
	o.default = '%any';
	o.depends('auth', 'eap-mschapv2');
	o.depends('auth', 'eap-tls');
	o.modalonly = true;
}

function sectionNameCheck(extra_class) {
	var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
		nameEl = el.querySelector('.cbi-section-create-name');
	ui.addValidator(nameEl, 'uciname', true, function(v) {
		let sections = [
			...uci.sections('ipsec', 'pools'),
			...uci.sections('ipsec', 'connection'),
			...uci.sections('ipsec', 'child'),
			...uci.sections('ipsec', 'crypto_proposal'),
			...uci.sections('ipsec', 'local'),
			...uci.sections('ipsec', 'remote'),
		];
		if (sections.find(function(s) {
			return s['.name'] == v;
		})) {
			return _('Pools, Connections, Encryption Proposals, Children, Locals and Remotes may not share the same names.') + ' ' +
				_('Use combinations like child1_phase1.');
		}
		return true;
	}, 'blur', 'keyup');
	return el;
};

/**
 * Dialog of a section embedded in the connection dialog.
 *
 * Holds the connection, the list option referencing the section and the
 * section shown in the dialog. Null if no such dialog is open.
 */
let embeddedModal = null;

/**
 * Set while the connection dialog is saved because of an embedded section.
 *
 * This happens before the dialog of an embedded section opens and when an
 * embedded section is removed from the connection.
 */
let embeddedSave = false;

function withEmbeddedSave(fn) {
	embeddedSave = true;

	return Promise.resolve().then(fn).finally(function () {
		embeddedSave = false;
	});
}

function getReferences(connection, option) {
	return L.toArray(uci.get('ipsec', connection, option));
}

function setReferences(connection, option, list) {
	uci.set('ipsec', connection, option, list.length > 0 ? list : null);
}

/**
 * Return the names of the connections referencing a section in a list option,
 * except the connection `exclude`. Other section types are searched as well
 * if they are passed in `types`.
 */
function getReferencingConnections(option, section_id, exclude, types) {
	return uci.sections('ipsec').filter(function (connection) {
		if (!types.includes(connection['.type']))
			return false;

		if (connection['.name'] == exclude)
			return false;

		return L.toArray(connection[option]).includes(section_id);
	}).map(connection => connection['.name']);
}

/**
 * Return the widget of the list option of a connection in the map, or null
 * if it is not rendered.
 */
function getListWidget(map, connection, option) {
	if (!map.root)
		return null;

	const [ listOption ] = map.lookupOption(option, connection) ?? [];

	return listOption?.getUIElement(connection) ?? null;
}

/**
 * Show the sections of the given `types` referencing a section in a list
 * option.
 *
 * Only shown in the table, since it is not configurable. If the section `s`
 * belongs to a connection, the form value of its list option is used, since
 * it may not be saved yet. See updateConnectionsOption().
 */
function addConnectionsOption(s, option, title, types) {
	const o = s.option(form.DummyValue, '_connections', title);

	o.modalonly = false;
	o.cfgvalue = function (section_id) {
		const connection = this.section.connection;
		const widget = connection ? getListWidget(this.map, connection, option) : null;
		const names = uci.sections('ipsec').filter(function (section) {
			if (!types.includes(section['.type']))
				return false;

			const list = (widget && section['.name'] == connection) ? widget.getValue() : section[option];

			return L.toArray(list).includes(section_id);
		}).map(section => section['.name']);

		return names.length > 0 ? names.join(', ') : null;
	};

	return o;
}

/**
 * Update the connections column of the section embedded for a list option.
 *
 * Used as o.onchange of the list option, so the column follows the form value.
 */
function updateConnectionsOption(map, connection, option) {
	const [ embedded ] = map.lookupOption('_' + option, connection) ?? [];
	const field = embedded ? map.findElement('data-field', embedded.cbid(connection)) : null;
	const column = embedded?.subsection.children.find(o => o.option == '_connections');

	if (!field || !column)
		return;

	field.querySelectorAll('tr[data-sid] > td[data-name="_connections"]').forEach(function (td) {
		const value = column.textvalue(td.parentNode.getAttribute('data-sid'));

		td.replaceChildren(value ?? E('em', _('none')));
	});
}

/**
 * Prevent deleting sections which are referenced by a section of the given
 * `types` in a list option.
 *
 * If the section `s` belongs to a connection, the references of that
 * connection are ignored. Call it after setting a custom handleRemove.
 */
function preventReferencedRemove(s, option, types) {
	const handleRemove = s.handleRemove;

	s.renderRowActions = function (section_id) {
		const tdEl = form.GridSection.prototype.renderRowActions.apply(this, arguments);
		const button = tdEl.querySelector('.cbi-button-remove');
		const names = getReferencingConnections(option, section_id, this.connection, types);

		if (button && names.length > 0) {
			button.disabled = true;
			button.title = _('Referenced by %s').format(names.join(', '));
		}

		return tdEl;
	};

	s.handleRemove = function (section_id, ev) {
		if (getReferencingConnections(option, section_id, this.connection, types).length > 0)
			return Promise.resolve();

		return handleRemove.apply(this, arguments);
	};
}

/**
 * Parse a mandatory list option of a connection referencing other sections.
 *
 * Used as o.parse. The list may be empty while the connection dialog is saved
 * because of an embedded section, since the referenced sections are just
 * being created or removed. Saving the connection dialog itself still
 * requires at least one entry.
 */
function parseReferenceList(section_id) {
	if (embeddedSave && L.toArray(this.formvalue(section_id)).length == 0)
		return Promise.resolve(this.remove(section_id));

	return form.AbstractValue.prototype.parse.apply(this, [section_id]);
}

/**
 * Save the dialog of the connection or of an embedded section.
 *
 * Used as handleModalSave of the connection section. The dialog of an
 * embedded section is stacked onto the connection dialog and keeps its
 * buttons, so it is saved here as well. A new embedded section is appended
 * to the list of the connection first.
 */
function handleConnectionModalSave(modalMap, ev) {
	if (this.getPreviousModalMap() && embeddedModal) {
		const { connection, option, section_id } = embeddedModal;
		const list = getReferences(connection, option);

		if (!list.includes(section_id)) {
			setReferences(connection, option, [ ...list, section_id ]);
			embeddedModal.added = true;
		}
	}

	return form.GridSection.prototype.handleModalSave.apply(this, arguments);
}

/**
 * Close the dialog of the connection or of an embedded section.
 *
 * Used as handleModalCancel of the connection section. If the dialog of a new
 * embedded section is dismissed after saving it failed, the section is
 * removed from the list of the connection again.
 */
function handleConnectionModalCancel(modalMap, ev, isSaving) {
	if (this.getPreviousModalMap() && embeddedModal) {
		const { connection, option, section_id, added } = embeddedModal;

		if (added && !isSaving)
			setReferences(connection, option,
				getReferences(connection, option).filter(name => name != section_id));

		embeddedModal = null;
	}

	return form.GridSection.prototype.handleModalCancel.apply(this, arguments);
}

/**
 * Embed the sections which can be referenced by a list option of the
 * connection into a tab of the connection dialog.
 *
 * The option name equals the type of the sections. The table shows all
 * sections of the type, like the table on the main page. A section added here
 * is appended to the list once its dialog is saved. A section can only be
 * deleted here if no other connection references it.
 */
function addEmbeddedSection(s, tab, option, title, description, addOptions) {
	const o = s.taboption(tab, form.SectionValue, '_' + option, form.GridSection, option, title, description);
	const ss = o.subsection;

	o.modalonly = true;

	// The embedded section needs the connection to look up the references.
	o.load = function (section_id) {
		this.subsection.connection = section_id;

		return form.SectionValue.prototype.load.apply(this, [section_id]);
	};

	ss.addremove = true;
	ss.nodescriptions = true;
	ss.renderSectionAdd = sectionNameCheck;
	ss.modaltitle = function (section_id) {
		return '%s - %s'.format(title, section_id);
	};

	ss.renderMoreOptionsModal = function (section_id, ev) {
		embeddedModal = { connection: this.connection, option: option, section_id: section_id };

		return withEmbeddedSave(L.bind(form.GridSection.prototype.renderMoreOptionsModal, this, section_id, ev));
	};

	ss.handleRemove = function (section_id, ev) {
		const widget = getListWidget(this.map, this.connection, option);

		if (!widget)
			return Promise.resolve();

		// Saving the connection dialog writes the form value, so change that instead of the UCI value.
		widget.setValue(L.toArray(widget.getValue()).filter(name => name != section_id));
		this.map.data.remove('ipsec', section_id);

		return withEmbeddedSave(L.bind(this.map.save, this.map, null, true));
	};

	preventReferencedRemove(ss, option, [ 'connection' ]);

	addOptions(ss);
	addConnectionsOption(ss, option, _('Referenced by'), [ 'connection' ]);
}

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
			service.getState(),
		]).then(function (data) {
			let hasNoGlobals = uci.sections('ipsec', 'globals').length === 0;
			return {
				algorithms: data[0],
				legacyConfig: hasNoGlobals,
				serviceState: data[3],
			};
		});
	},

	render: function (result) {
		let m, s, o;
		const legacyConfig = result.legacyConfig;
		const serviceState = result.serviceState;
		const algorithms = result.algorithms.data ?? {};
		const error = result.algorithms.error;

		if (error && serviceState.running)
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
		s.handleModalSave = handleConnectionModalSave;
		s.handleModalCancel = handleConnectionModalCancel;

		o = s.tab('general', _('General'));
		o = s.tab('authentication', _('Authentication'));
		o = s.tab('advanced', _('Advanced'));
		o = s.tab('children', _('Children'));
		o = s.tab('locals', _('Locals'));
		o = s.tab('remotes', _('Remotes'));

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

		o = s.taboption('advanced', form.MultiValue, 'pools', _('Pools'),
			swanctlDescr(_('Pools from which virtual IP addresses and configuration attributes are assigned to the remote peers.') + '<br />' +
			_('Pools can be defined on the general page.'),
				'connections.<conn>.pools'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			uci.sections('ipsec', 'pools').forEach(L.bind(function (section) {
				this.value(section['.name']);
			}, this));

			return this.super('load', [section_id]);
		};
		o.tooltip = multiValueSectionTooltip([
			_('Configured pools do not exist: %s'),
			_('Select existing pools or create the missing ones on the general page.')
		], [
			_('No pool exists yet.'),
			_('Create a pool on the general page first.')
		]);

		o = s.taboption('advanced', form.Flag, 'pull', _('Pull'),
			swanctlDescr(_('Pull virtual IP addresses and configuration attributes from the remote peer (Config Mode).') + '<br />' +
			_('If disabled, the client waits for the server to push them.'),
				'connections.<conn>.pull'));
		o.default = '1';
		o.modalonly = true;
		o.rmempty = true;
		o.depends('keyexchange', 'ikev1');
		o.depends('keyexchange', 'ike');

		o = s.taboption('general', form.MultiValue, 'crypto_proposal', _('Crypto Proposal'),
			swanctlDescr(_('List of IKE (phase 1) proposals to use for authentication'), 'connections.<conn>.proposals'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			uci.sections('ipsec', 'crypto_proposal').filter(function (section) {
				return section.is_esp != '1';
			}).forEach(L.bind(function (section) {
				this.value(section['.name']);
			}, this));

			return this.super('load', [section_id]);
		};
		o.tooltip = multiValueSectionTooltip([
			_('Configured proposals are not available as IKE proposal: %s'),
			_('Check the ESP Proposal option of the proposals or create the missing ones.')
		], [
			_('No IKE proposal exists yet.'),
			_('Create a proposal with the ESP Proposal option disabled first.')
		]);
		o.tooltipicon = '⚠️';
		o.rmempty = true;

		o = s.taboption('general', form.MultiValue, 'child', _('Children'),
			swanctlDescr(_('The Children containing the ESP (phase 2) section'), 'connections.<conn>.children.<child>'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			uci.sections('ipsec', 'child').forEach(L.bind(function (section) {
				this.value(section['.name'], '%s (%s)'.format(section['.name'], section['mode']));
			}, this));

			return this.super('load', [section_id]);
		};
		o.tooltip = multiValueSectionTooltip([
			_('Configured child sections do not exist: %s'),
			_('Select existing child sections or create the missing ones.')
		], [
			_('No child section exists yet.'),
			_('Create a child section first.')
		]);
		o.tooltipicon = '⚠️';
		o.rmempty = false;
		o.parse = parseReferenceList;
		o.onchange = function (ev, section_id) {
			updateConnectionsOption(this.map, section_id, 'child');
		};

		o = s.taboption('authentication', form.DynamicList, 'local', _('Local Authentication'),
			swanctlDescr(_('Local authentication sections used for this connection.') + ' ' +
			_('Each section corresponds to one authentication round.') + ' ' +
			_('The order matters: the sections are used in the order they are listed.'),
				'connections.<conn>.local<suffix>'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'local');
			this.placeholder = _('Select a section');
			if (sections.length == 0) {
				this.tooltip = _('No local section exists yet.') + ' ' +
					_('Create a local section first.');
				this.tooltipicon = '⚠️';
			} else {
				this.tooltip = null;
				this.tooltipicon = null;
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.validate = function (section_id, value) {
			if (value == '' || uci.get('ipsec', value, '.type') == 'local')
				return true;
			return _('Unknown Local section');
		};
		o.onchange = function (ev, section_id) {
			updateConnectionsOption(this.map, section_id, 'local');
		};

		o = s.taboption('authentication', form.DynamicList, 'remote', _('Remote Authentication'),
			swanctlDescr(_('Remote authentication sections used for this connection.') + ' ' +
			_('Each section corresponds to one authentication round.') + ' ' +
			_('The order matters: the sections are used in the order they are listed.'),
				'connections.<conn>.remote<suffix>'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'remote');
			this.placeholder = _('Select a section');
			if (sections.length == 0) {
				this.tooltip = _('No remote section exists yet.') + ' ' +
					_('Create a remote section first.');
				this.tooltipicon = '⚠️';
			} else {
				this.tooltip = null;
				this.tooltipicon = null;
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.validate = function (section_id, value) {
			if (value == '' || uci.get('ipsec', value, '.type') == 'remote')
				return true;
			return _('Unknown Remote section');
		};
		o.rmempty = false;
		o.parse = parseReferenceList;
		o.onchange = function (ev, section_id) {
			updateConnectionsOption(this.map, section_id, 'remote');
		};

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
			swanctlDescr(_('Number of retransmissions attempts during initial negotiation.') + '<br />' +
			_('Use %s to retry until the connection is established or fails with a permanent error.').format('<code>0</code>'),
				'connections.<conn>.keyingtries'));
		o.datatype = 'uinteger';
		o.placeholder = '1';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'dpd_delay', _('DPD Delay'),
			swanctlDescr(_('Interval to check liveness of a peer'), 'connections.<conn>.dpd_delay'));
		o.validate = validateTimeFormat;
		o.placeholder = '0s';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'dpd_timeout', _('DPD Timeout'),
			swanctlDescr(_('Timeout to close connection if no response to DPD is received.'),
				'connections.<conn>.dpd_timeout'));
		o.validate = validateTimeFormat;
		o.placeholder = '0s';
		o.modalonly = true;
		o.depends('keyexchange', 'ikev1');
		o.depends('keyexchange', 'ike');

		o = s.taboption('advanced', form.Value, 'rekey_time', _('Rekey Time'),
			swanctlDescr(_('IKEv2 interval to refresh keying material; also used to compute lifetime'), 'connections.<conn>.rekey_time'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'over_time', _('Overtime'),
			swanctlDescr(_('Limit on time to complete rekeying/reauthentication'), 'connections.<conn>.over_time'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'reauth_time', _('Reauthentication Time'),
			swanctlDescr(_('Interval to reauthenticate the IKE SA by creating a new one from scratch.') + '<br />' +
			_('The default is %s, which means that reauthentication is off.').format('<code>0s</code>'),
				'connections.<conn>.reauth_time'));
		o.validate = validateTimeFormat;
		o.placeholder = '0s';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rand_time', _('Random Time'),
			swanctlDescr(_('Time range from which to choose a random value to subtract from the rekey and reauthentication times.') + '<br />' +
			_('If not configured, the overtime is used.') + '<br />' +
			_('Use %s to disable randomization.').format('<code>0s</code>'),
				'connections.<conn>.rand_time'));
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

		o = s.taboption('advanced', form.Value, 'dscp', _('DSCP'),
			swanctlDescr(_('Differentiated Services Field Codepoint to set on outgoing IKE packets as six digit binary string'),
				'connections.<conn>.dscp'));
		o.value('000000', '%s / %s (000000)'.format(_('CS0'), _('Default')));
		o.value('001000', '%s (001000)'.format(_('CS1')));
		o.value('010000', '%s (010000)'.format(_('CS2')));
		o.value('011000', '%s (011000)'.format(_('CS3')));
		o.value('100000', '%s (100000)'.format(_('CS4')));
		o.value('101000', '%s (101000)'.format(_('CS5')));
		o.value('110000', '%s (110000)'.format(_('CS6')));
		o.value('111000', '%s (111000)'.format(_('CS7')));
		o.value('101110', '%s (101110)'.format(_('EF')));
		o.value('001010', '%s (001010)'.format(_('AF11')));
		o.value('010010', '%s (010010)'.format(_('AF21')));
		o.value('011010', '%s (011010)'.format(_('AF31')));
		o.value('100010', '%s (100010)'.format(_('AF41')));
		o.validate = function (section_id, value) {
			if (value && !value.match(/^[01]{6}$/))
				return _('Expecting a six digit binary string');

			return true;
		};
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'unique', _('Uniqueness Policy'),
			swanctlDescr(_('Connection uniqueness policy to avoid multiple connections from the same user.') + '<br />' +
			'<code>no</code>: ' + _('Replace an existing connection if the peer sends an INITIAL_CONTACT notify.') + '<br />' +
			'<code>never</code>: ' + _('Never replace an existing connection, even if the peer sends an INITIAL_CONTACT notify.') + '<br />' +
			'<code>keep</code>: ' + _('Reject a new connection and keep the existing one.') + '<br />' +
			'<code>replace</code>: ' + _('Delete an existing connection if a new one is established.'),
				'connections.<conn>.unique'));
		o.value('', '%s (%s)'.format('no', _('default')));
		o.value('never');
		o.value('keep');
		o.value('replace');
		o.optional = true;
		o.default = '';
		o.rmempty = true;
		o.modalonly = true;

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

		o = s.taboption('advanced', form.Flag, 'aggressive', _('Aggressive Mode'),
			swanctlDescr(_('Use IKEv1 Aggressive Mode instead of IKEv1 Main Mode'), 'connections.<conn>.aggressive'));
		o.tooltip = function () {
			if (uci.get('ipsec', 'globals', 'aggressive') == '1')
				return null;

			return _('Aggressive Mode with PSK authentication is rejected as responder unless it is allowed in the service configuration (General Settings).') + '<br />' +
				'<code>ipsec.globals.aggressive</code><br />' +
				'<code>strongswan.conf: charon.i_dont_care_about_security_and_use_aggressive_mode_psk</code>';
		};
		o.tooltipicon = '⚠️';
		o.default = '0';
		o.modalonly = true;
		o.depends('keyexchange', 'ikev1');
		o.depends('keyexchange', 'ike');

		addEmbeddedSection(s, 'children', 'child', _('Children'),
			_('The children of this connection are selected on the General tab.') + ' ' +
			_('Children used by other connections cannot be deleted here.'),
			addChildOptions);

		addEmbeddedSection(s, 'locals', 'local', _('Local'),
			_('The locals of this connection and their order are selected on the Authentication tab.') + ' ' +
			_('Locals used by other connections cannot be deleted here.'),
			addLocalOptions);

		addEmbeddedSection(s, 'remotes', 'remote', _('Remote'),
			_('The remotes of this connection and their order are selected on the Authentication tab.') + ' ' +
			_('Remotes used by other connections cannot be deleted here.'),
			addRemoteOptions);

		// Local Configuration
		s = m.section(form.GridSection, 'local', _('Local'),
			_('Define local IKE authentication rounds referenced from connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		addLocalOptions(s);
		addConnectionsOption(s, 'local', _('Referenced by'), [ 'connection' ]);
		preventReferencedRemove(s, 'local', [ 'connection' ]);

		// Remote Configuration
		s = m.section(form.GridSection, 'remote', _('Remote'),
			_('Define remote IKE authentication rounds referenced from connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		addRemoteOptions(s);
		addConnectionsOption(s, 'remote', _('Referenced by'), [ 'connection' ]);
		preventReferencedRemove(s, 'remote', [ 'connection' ]);

		// Children Configuration
		s = m.section(form.GridSection, 'child', _('Children'),
			_('Define Connection Children to be used in Remote Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;

		addChildOptions(s);
		addConnectionsOption(s, 'child', _('Referenced by'), [ 'connection' ]);
		preventReferencedRemove(s, 'child', [ 'connection' ]);

		// Crypto Proposals
		s = m.section(form.GridSection, 'crypto_proposal',
			_('Encryption Proposals'),
			_('Configure Cipher Suites to define IKE (Phase 1) or ESP (Phase 2) Proposals.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;
		preventReferencedRemove(s, 'crypto_proposal', [ 'connection', 'child' ]);

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
		o.modalonly = true;
		o.depends('use_custom_proposal', '1');
		o.rmempty = false;

		o = s.option(form.DummyValue, '_proposal', _('Proposal'));
		o.modalonly = false;
		o.cfgvalue = assembleProposal;

		o = s.option(form.ListValue, 'encryption_algorithm',
			_('Encryption Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.tooltip = proposalTooltip;
		o.default = 'aes256gcm128';
		o.depends('use_custom_proposal', '0');
		addAlgorithms(o, algorithms.encryption);
		addAlgorithms(o, algorithms.aead);
		o.modalonly = true;

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
		o.modalonly = true;

		o = s.option(form.ListValue, 'dh_group', _('Diffie-Hellman Group'),
			_('Algorithms marked with * are considered insecure'));
		o.tooltip = proposalTooltip;
		o.default = 'modp3072';
		o.depends('use_custom_proposal', '0');
		addAlgorithms(o, algorithms.ke);
		o.modalonly = true;

		o = s.option(form.DynamicList, 'ke', _('Multiple Key Exchanges'),
			_('With peers that support multiple IKEv2 key exchanges (RFC 9370), ' +
				'up to seven additional key exchanges may be negotiated.') + '<br/>' +
			_('If more than 7 are stored, those that exceed this limit will not be ' +
				'included in the swanctl configuration.'));
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
		o.modalonly = true;

		addConnectionsOption(s, 'crypto_proposal', _('Referenced by'), [ 'connection', 'child' ]);

		return m.render().then(function (node) {
			const banner = service.banner(serviceState,
				_('Some options are unavailable until the IPsec service is enabled.'));
			if (banner)
				node.insertBefore(banner, node.firstChild);
			if (legacyConfig)
				showMigrationOverlay(node);
			return ikev1.prepend(node);
		});
	}
});
