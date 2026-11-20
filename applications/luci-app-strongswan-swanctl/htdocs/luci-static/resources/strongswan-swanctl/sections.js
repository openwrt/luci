'use strict';
'require baseclass';
'require form';
'require fs';
'require uci';
'require ui';

/*
 * Options of the local, remote and child sections and helpers for
 * sections referenced by connections, shared by the connection page and
 * the authentication and children page.
 */

/**
 * Append the matching swanctl.conf setting (dotted path) to a description.
 */
function swanctlDescr(descr, key) {
	const code = key.replace(/</g, '&lt;').replace(/>/g, '&gt;');

	return (descr ? descr + '<br />' : '') + '<code>swanctl.conf: ' + code + '</code>';
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

/**
 * Tooltip for a form.MultiValue whose choices are sections of another type.
 *
 * The dropdown of a MultiValue only shows values which are available as
 * choice, so warn about configured values which are not available (anymore),
 * e.g. if the section was deleted. Otherwise warn if there is nothing to
 * select at all, unless empty is null.
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
 * Add the network options of a child to the general tab of `s`.
 *
 * If `extra` is set, the options are only shown in the dialog and only if
 * these dependencies are met as well, so they can be added to other
 * sections. If `proposal` is set, the ESP proposal option with this name is
 * added after the traffic selectors.
 */
function addChildNetworkOptions(s, extra, proposal) {
	let o;

	const depends = function (option, dependency) {
		option.depends(Object.assign({}, dependency, extra));
	};

	const restrict = function (option) {
		if (!extra)
			return;

		option.modalonly = true;
		depends(option, {});
	};

	o = s.taboption('general', form.DynamicList, 'local_ts', _('Local Traffic Selectors'),
		swanctlDescr(_('Local network(s)'), 'connections.<conn>.children.<child>.local_ts'));
	o.datatype = 'cidr';
	o.placeholder = '192.168.1.1/24';
	o.rmempty = false;
	restrict(o);

	o = s.taboption('general', form.DynamicList, 'remote_ts', _('Remote Traffic Selectors'),
		swanctlDescr(_('Remote network(s)'), 'connections.<conn>.children.<child>.remote_ts'));
	o.datatype = 'cidr';
	o.placeholder = '192.168.2.1/24';
	o.rmempty = false;
	restrict(o);

	if (proposal)
		addChildProposalOption(s, proposal, extra);

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
	restrict(o);

	o = s.taboption('general', form.ListValue, 'start_action', _('Start Action'),
		swanctlDescr(_('Action on initial configuration load'), 'connections.<conn>.children.<child>.start_action'));
	o.value('', '%s (%s)'.format('none', _('default')));
	o.value('trap');
	o.value('start');
	o.optional = true;
	o.default = '';
	o.rmempty = true;
	o.modalonly = true;
	restrict(o);
}

/**
 * Add the ESP proposal option of a child to the general tab of `s`.
 *
 * The name of the `option` may differ, so it can be added to other
 * sections. If `extra` is set, the option is only shown in the dialog and
 * only if these dependencies are met as well.
 */
function addChildProposalOption(s, option, extra) {
	const o = s.taboption('general', form.MultiValue, option,
		_('Crypto Proposal (Phase 2)'),
		swanctlDescr(_('List of ESP (phase two) proposals. Only Proposals with checked ESP flag are selectable') + '<br />' +
		_('If none is selected, the default proposals of strongSwan are used.'),
			'connections.<conn>.children.<child>.esp_proposals'));
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
	], null);
	o.tooltipicon = '⚠️';
	o.rmempty = true;

	if (extra) {
		o.modalonly = true;
		o.depends(Object.assign({}, extra));
	}
}

/**
 * Add the tabs and options of a child section (ESP, phase 2) to `s`.
 */
function addChildOptions(s) {
	let o;

	o = s.tab('general', _('General'));
	o = s.tab('advanced', _('Advanced'));
	o = s.tab('expert', _('Expert'));

	o = s.taboption('general', form.ListValue, 'mode', _('Child mode'), swanctlDescr(null, 'connections.<conn>.children.<child>.mode'));
	o.rmempty = false;
	o.value('tunnel', _('Tunnel'));
	o.value('transport', _('Transport'));
	o.default = 'tunnel';

	addChildNetworkOptions(s, null, null);

	o = s.taboption('general', form.ListValue, 'close_action', _('Close Action'),
		swanctlDescr(_('Action when CHILD_SA is closed'), 'connections.<conn>.children.<child>.close_action'));
	o.value('', '%s (%s)'.format('none', _('default')));
	o.value('trap');
	o.value('start');
	o.optional = true;
	o.default = '';
	o.rmempty = true;
	o.modalonly = true;

	addChildProposalOption(s, 'crypto_proposal', null);

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

	o = s.taboption('advanced', form.Value, 'life_time', _('Life Time'),
		swanctlDescr(_('Maximum time before the CHILD_SA gets closed, as a hard limit.'), 'connections.<conn>.children.<child>.life_time')
	);
	o.validate = validateTimeFormat;
	o.rmempty = true;
	o.modalonly = true;

	o = s.taboption('advanced', form.ListValue, 'hw_offload', _('H/W Offload'),
		swanctlDescr(_('Enable Hardware offload'), 'connections.<conn>.children.<child>.hw_offload'));
	o.value('yes');
	o.value('no');
	o.value('auto');
	o.optional = true;
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'rand_time', _('Random Time'),
		swanctlDescr(_('Time range from which to choose a random value to subtract from the rekey time.') + '<br />' +
		_('If not configured, the difference between life time and rekey time is used.') + '<br />' +
		_('Use %s to disable randomization.').format('<code>0s</code>'),
			'connections.<conn>.children.<child>.rand_time')
	);
	o.validate = validateTimeFormat;
	o.rmempty = true;
	o.modalonly = true;

	o = s.taboption('expert', form.Flag, 'ipcomp', _('IPComp'),
		swanctlDescr(_('Enable ipcomp compression'), 'connections.<conn>.children.<child>.ipcomp'));
	o.default = '0';
	o.modalonly = true;

	o = s.taboption('expert', form.Flag, 'policies', _('Policies'),
		swanctlDescr(_('Whether to install IPsec policies or not.') + ' ' +
		_('Disabling this is only useful in special cases, e.g. with route based routing.'),
			'connections.<conn>.children.<child>.policies'));
	o.default = '1';
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'priority', _('Priority'),
		swanctlDescr(_('Priority of the CHILD_SA'), 'connections.<conn>.children.<child>.priority'));
	o.datatype = 'uinteger';
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'mark_in', _('Mark In'),
		swanctlDescr(_('Netfilter mark on inbound traffic, used to match the policy.') + '<br />' +
			markDescription(),
			'connections.<conn>.children.<child>.mark_in'));
	o.value('%unique');
	o.value('%unique-dir');
	o.optional = true;
	o.validate = validateMark;
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'mark_out', _('Mark Out'),
		swanctlDescr(_('Netfilter mark applied to outbound traffic, used to match the policy.') + '<br />' +
			markDescription(),
			'connections.<conn>.children.<child>.mark_out'));
	o.value('%unique');
	o.value('%unique-dir');
	o.optional = true;
	o.validate = validateMark;
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'replay_window', _('Replay Window'),
		swanctlDescr('%s; %s'.format(_('Replay Window of the CHILD_SA'),
			_('Values larger than 32 are supported by the Netlink backend only')),
			'connections.<conn>.children.<child>.replay_window'));
	o.datatype = 'uinteger';
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'rekey_bytes', _('Rekey Bytes'),
		swanctlDescr(_('Number of bytes processed before initiating CHILD_SA rekeying.') + ' ' +
		_('Also used to derive lifebytes if set (110% of this value).') + ' ' +
		_('Use "0" to disable byte based rekeying.'),
			'connections.<conn>.children.<child>.rekey_bytes')
	);
	o.datatype = 'uinteger';
	o.placeholder = '0';
	o.rmempty = true;
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'life_bytes', _('Life Bytes'),
		swanctlDescr(_('Maximum number of bytes processed before the CHILD_SA gets closed.') + ' ' +
		_('Use "0" to disable (default).'),
			'connections.<conn>.children.<child>.life_bytes')
	);
	o.datatype = 'uinteger';
	o.placeholder = '0';
	o.rmempty = true;
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'rekey_packets', _('Rekey Packets'),
		swanctlDescr(_('Number of packets processed before initiating CHILD_SA rekeying.') + ' ' +
		_('Also used to derive lifepackets if set (110% of this value).') + ' ' +
		_('Use "0" to disable packet based rekeying (default).'),
			'connections.<conn>.children.<child>.rekey_packets')
	);
	o.datatype = 'uinteger';
	o.placeholder = '0';
	o.rmempty = true;
	o.modalonly = true;

	o = s.taboption('expert', form.Value, 'life_packets', _('Life Packets'),
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

	o = s.option(form.ListValue, 'revocation', _('Revocation Policy'),
		swanctlDescr(_('Certificate revocation policy for CRL or OCSP revocation checking.') + '<br />' +
		_('Strict: Fail if no revocation information is available.') + '<br />' +
		_('If URI: Fail only if a CRL or OCSP URI is available, but revocation checking fails.') + '<br />' +
		_('Relaxed: Fail only if the certificate has been revoked.'),
			'connections.<conn>.remote<suffix>.revocation'));
	o.value('relaxed', _('Relaxed'));
	o.value('ifuri', _('If URI'));
	o.value('strict', _('Strict'));
	o.default = 'relaxed';
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
 * Return the names of the connections referencing a section in a list option,
 * except the connection `exclude`. Other section types are searched as well
 * if they are passed in `types`. The `option` may also be an array of list
 * options.
 */
function getReferencingConnections(option, section_id, exclude, types) {
	return uci.sections('ipsec').filter(function (connection) {
		if (!types.includes(connection['.type']))
			return false;

		if (connection['.name'] == exclude)
			return false;

		return L.toArray(option).some(function (name) {
			return L.toArray(connection[name]).includes(section_id);
		});
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
 * Show the names of referencing sections in a dialog.
 *
 * LuCI only has one dialog, which ui.showModal() replaces. If a dialog is
 * already open, e.g. the connection dialog, its nodes are moved aside and
 * put back on close, so the form keeps its state.
 */
function showReferencesModal(title, names) {
	const modalOpen = document.body.classList.contains('modal-overlay-active');
	const overlay = document.getElementById('modal_overlay');
	const dlg = overlay?.firstElementChild;
	let restore = null;

	if (modalOpen && dlg) {
		const nodes = Array.from(dlg.childNodes);
		const className = dlg.getAttribute('class');
		const scrollTop = overlay.scrollTop;

		restore = function () {
			dlg.setAttribute('class', className);
			dlg.replaceChildren(...nodes);
			overlay.scrollTop = scrollTop;
		};
	}

	const close = function () {
		if (restore)
			restore();
		else
			ui.hideModal();
	};

	ui.showModal(title, [
		E('p', {}, [ names.join(', ') ]),
		E('div', { 'class': 'right' }, [
			E('button', {
				'class': 'btn cbi-button',
				'click': close
			}, [ _('Dismiss') ])
		])
	], 'cbi-modal');
}

/**
 * Show the sections of the given `types` referencing a section in a list
 * option.
 *
 * Only shown in the table, since it is not configurable. If the section `s`
 * belongs to a connection, the form value of its list option is used, since
 * it may not be saved yet. See updateConnectionsOption() of the connection
 * page. Otherwise the `option` may also be an array of list options.
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

			if (widget && section['.name'] == connection)
				return L.toArray(widget.getValue()).includes(section_id);

			return L.toArray(option).some(function (name) {
				return L.toArray(section[name]).includes(section_id);
			});
		}).map(section => section['.name']);

		return names.length > 0 ? names : null;
	};
	/*
	 * Long lists make the table hard to read, so only show the number of
	 * sections and list their names in a dialog.
	 */
	o.textvalue = function (section_id) {
		// Number of sections shown by name, more are only counted.
		const MAX_SHOWN_REFERENCES = 3;
		const names = this.cfgvalue(section_id);

		if (!names)
			return null;

		if (names.length <= MAX_SHOWN_REFERENCES)
			return '%h'.format(names.join(', '));

		return E('a', {
			'href': '#',
			'click': function (ev) {
				ev.preventDefault();
				showReferencesModal('%s - %s'.format(title, section_id), names);
			}
		}, [ _('%d references').format(names.length) ]);
	};

	return o;
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

return baseclass.extend({
	swanctlDescr: swanctlDescr,
	validateTimeFormat: validateTimeFormat,
	validateMark: validateMark,
	markDescription: markDescription,
	multiValueSectionTooltip: multiValueSectionTooltip,
	addFileOption: addFileOption,
	addChildNetworkOptions: addChildNetworkOptions,
	addChildProposalOption: addChildProposalOption,
	addChildOptions: addChildOptions,
	addLocalOptions: addLocalOptions,
	addRemoteOptions: addRemoteOptions,
	sectionNameCheck: sectionNameCheck,
	getReferencingConnections: getReferencingConnections,
	getListWidget: getListWidget,
	addConnectionsOption: addConnectionsOption,
	preventReferencedRemove: preventReferencedRemove
});
