'use strict';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require strongswan-swanctl.service as service';
'require strongswan-swanctl.sections as sections';
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

const {
	swanctlDescr,
	validateTimeFormat,
	multiValueSectionTooltip,
	addChildNetworkOptions,
	addChildOptions,
	addLocalOptions,
	addRemoteOptions,
	sectionNameCheck,
	getListWidget,
	addConnectionsOption,
	preventReferencedRemove
} = sections;

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
 * Return the configuration mode of a connection.
 *
 * Connections without the option were configured with local and remote
 * sections, as the remote sections were mandatory.
 */
function getConfigMode(connection) {
	const mode = uci.get('ipsec', connection, 'config_mode');

	if (mode)
		return mode;

	if (getReferences(connection, 'remote').length > 0)
		return 'advanced';

	return 'simple';
}

/**
 * Show the local and remote part of a connection in one table column.
 */
function formatLocalRemote(local, remote) {
	return '%s ⇄ %s'.format(local.join(', ') || '-', remote.join(', ') || '-');
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

	return o;
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
		o = s.tab('expert', _('Expert'));
		o = s.tab('children', _('Children'));
		o = s.tab('locals', _('Locals'));
		o = s.tab('remotes', _('Remotes'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enabled'),
			_('Configuration is enabled or not'));
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'config_mode', _('Configuration Mode'),
			_('Simple: Both sides authenticate with a pre-shared key, which is configured on the Authentication tab.') + ' ' +
			_('The local and remote networks are set on this tab.') + '<br />' +
			_('Advanced: The authentication rounds are configured with local and remote sections, e.g. for certificates or EAP.') + ' ' +
			_('The networks are configured with child sections.'));
		o.value('simple', _('Simple'));
		o.value('advanced', _('Advanced'));
		o.rmempty = false;
		// The derived mode must be written, as the init script treats a
		// missing option as advanced.
		o.forcewrite = true;
		o.load = function (section_id) {
			return getConfigMode(section_id);
		};

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

		o = s.taboption('general', form.MultiValue, 'crypto_proposal', _('Crypto Proposal'),
			swanctlDescr(_('List of IKE (phase 1) proposals to use for authentication') + '<br />' +
			_('If none is selected, the default proposals of strongSwan are used.'),
				'connections.<conn>.proposals'));
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
		], null);
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
		o.modalonly = true;
		o.depends('config_mode', 'advanced');
		o.parse = parseReferenceList;
		o.onchange = function (ev, section_id) {
			updateConnectionsOption(this.map, section_id, 'child');
		};

		// Only shown in the table, as a summary for both configuration modes.
		o = s.option(form.DummyValue, '_authentication', _('Authentication'));
		o.modalonly = false;
		o.cfgvalue = function (section_id) {
			if (getConfigMode(section_id) == 'simple')
				return _('Pre-shared Key');

			return formatLocalRemote(getReferences(section_id, 'local'),
				getReferences(section_id, 'remote'));
		};

		o = s.option(form.DummyValue, '_networks', _('Networks'));
		o.modalonly = false;
		o.cfgvalue = function (section_id) {
			if (getConfigMode(section_id) == 'simple')
				return formatLocalRemote(L.toArray(uci.get('ipsec', section_id, 'local_ts')),
					L.toArray(uci.get('ipsec', section_id, 'remote_ts')));

			return getReferences(section_id, 'child').join(', ') || null;
		};

		addChildNetworkOptions(s, { 'config_mode': 'simple' }, 'esp_proposal');

		o = s.taboption('authentication', form.Value, 'psk', _('Pre-shared Key'),
			swanctlDescr(_('Key that both sides use for authentication.') + ' ' +
			_('The key is bound to the local and remote identifier.') + ' ' +
			_('Without identifiers, the key applies to all connections.') + ' ' +
			_('If no key is entered, the global secrets configured on the Secrets page are used.'),
				'secrets.ike-<conn>.secret'));
		o.password = true;
		o.modalonly = true;
		o.depends('config_mode', 'simple');
		o.validate = function (section_id, value) {
			if (value && value.includes('"'))
				return _('The key must not contain double quotes.');

			return true;
		};

		o = s.taboption('authentication', form.Value, 'local_id', _('Local Identifier'),
			swanctlDescr(_('Local identifier for IKE (phase 1)'), 'connections.<conn>.local.id'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=headquarters';
		o.modalonly = true;
		o.depends('config_mode', 'simple');

		o = s.taboption('authentication', form.Value, 'remote_id', _('Remote Identifier'),
			swanctlDescr(_('Remote identifier for IKE (phase 1)'), 'connections.<conn>.remote.id'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=soho';
		o.modalonly = true;
		o.depends('config_mode', 'simple');

		o = s.taboption('authentication', form.DynamicList, 'local', _('Local Authentication'),
			swanctlDescr(_('Local authentication sections used for this connection.') + ' ' +
			_('Each section corresponds to one authentication round.') + ' ' +
			_('The order matters: the sections are used in the order they are listed.'),
				'connections.<conn>.local<suffix>'));
		o.depends('config_mode', 'advanced');
		o.modalonly = true;
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
		o.depends('config_mode', 'advanced');
		o.modalonly = true;
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
		o.depends('config_mode', 'advanced');

		o = s.taboption('authentication', form.Flag, 'send_certreq', _('Send Certificate Request'),
			swanctlDescr(_('Send certificate request payloads to offer trusted root CA certificates to the peer'), 'connections.<conn>.send_certreq'));
		o.default = '1';
		o.modalonly = true;
		o.depends('config_mode', 'advanced');

		o = s.taboption('advanced', form.DynamicList, 'vips', _('Virtual IP addresses'),
			swanctlDescr(_('Virtual IP addresses used as the source IP for outgoing traffic.'), 'connections.<conn>.vips'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.MultiValue, 'pools', _('Pools'),
			swanctlDescr(_('Pools from which virtual IP addresses and configuration attributes are assigned to the remote peers.') + '<br />' +
			_('Pools can be defined on the Pools & Authorities page.'),
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
			_('Select existing pools or create the missing ones on the Pools & Authorities page.')
		], [
			_('No pool exists yet.'),
			_('Create a pool on the Pools & Authorities page first.')
		]);
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'pull', _('Pull'),
			swanctlDescr(_('Pull virtual IP addresses and configuration attributes from the remote peer (Config Mode).') + '<br />' +
			_('If disabled, the client waits for the server to push them.'),
				'connections.<conn>.pull'));
		o.default = '1';
		o.modalonly = true;
		o.rmempty = true;
		o.depends('keyexchange', 'ikev1');
		o.depends('keyexchange', 'ike');

		o = s.taboption('advanced', form.Flag, 'mobike', _('MOBIKE'),
			swanctlDescr(_('MOBIKE (IKEv2 Mobility and Multihoming Protocol)'), 'connections.<conn>.mobike'));
		o.default = '1';
		o.modalonly = true;
		o.depends('keyexchange', 'ikev2');
		o.depends('keyexchange', 'ike');

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

		o = s.taboption('expert', form.ListValue, 'fragmentation', _('IKE Fragmentation'),
			swanctlDescr(_('Use IKE fragmentation'), 'connections.<conn>.fragmentation'));
		o.value('yes');
		o.value('no');
		o.value('force');
		o.value('accept');
		o.default = 'yes';
		o.modalonly = true;

		o = s.taboption('expert', form.Value, 'over_time', _('Overtime'),
			swanctlDescr(_('Limit on time to complete rekeying/reauthentication'), 'connections.<conn>.over_time'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('expert', form.Value, 'reauth_time', _('Reauthentication Time'),
			swanctlDescr(_('Interval to reauthenticate the IKE SA by creating a new one from scratch.') + '<br />' +
			_('The default is %s, which means that reauthentication is off.').format('<code>0s</code>'),
				'connections.<conn>.reauth_time'));
		o.validate = validateTimeFormat;
		o.placeholder = '0s';
		o.modalonly = true;

		o = s.taboption('expert', form.Value, 'rand_time', _('Random Time'),
			swanctlDescr(_('Time range from which to choose a random value to subtract from the rekey and reauthentication times.') + '<br />' +
			_('If not configured, the overtime is used.') + '<br />' +
			_('Use %s to disable randomization.').format('<code>0s</code>'),
				'connections.<conn>.rand_time'));
		o.validate = validateTimeFormat;
		o.modalonly = true;

		o = s.taboption('expert', form.Value, 'dscp', _('DSCP'),
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

		o = s.taboption('expert', form.ListValue, 'unique', _('Uniqueness Policy'),
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

		o = addEmbeddedSection(s, 'children', 'child', _('Children'),
			_('The children of this connection are selected on the General tab.') + ' ' +
			_('Children used by other connections cannot be deleted here.'),
			addChildOptions);
		o.depends('config_mode', 'advanced');

		o = addEmbeddedSection(s, 'locals', 'local', _('Local'),
			_('The locals of this connection and their order are selected on the Authentication tab.') + ' ' +
			_('Locals used by other connections cannot be deleted here.'),
			addLocalOptions);
		o.depends('config_mode', 'advanced');

		o = addEmbeddedSection(s, 'remotes', 'remote', _('Remote'),
			_('The remotes of this connection and their order are selected on the Authentication tab.') + ' ' +
			_('Remotes used by other connections cannot be deleted here.'),
			addRemoteOptions);
		o.depends('config_mode', 'advanced');

		// Crypto Proposals
		s = m.section(form.GridSection, 'crypto_proposal',
			_('Encryption Proposals'),
			_('Configure Cipher Suites to define IKE (Phase 1) or ESP (Phase 2) Proposals.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sectionNameCheck;
		preventReferencedRemove(s, [ 'crypto_proposal', 'esp_proposal' ], [ 'connection', 'child' ]);

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

		addConnectionsOption(s, [ 'crypto_proposal', 'esp_proposal' ], _('Referenced by'), [ 'connection', 'child' ]);

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
