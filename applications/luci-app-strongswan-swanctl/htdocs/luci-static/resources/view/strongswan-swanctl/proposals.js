'use strict';
'require form';
'require rpc';
'require uci';
'require ui';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require strongswan-swanctl.sections as sections';
'require strongswan-swanctl.service as service';

const callListAlgorithms = rpc.declare({
	object: 'luci.swanctl',
	method: 'list-algs',
	expect: { }
});

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

return view.extend({
	load: function () {
		return Promise.all([
			callListAlgorithms(),
			service.getState()
		]).then(function (data) {
			return {
				algorithms: data[0],
				serviceState: data[1]
			};
		});
	},

	render: function (result) {
		let m, s, o;
		const serviceState = result.serviceState;
		const algorithms = result.algorithms.data ?? {};
		const error = result.algorithms.error;

		if (error && serviceState.running)
			ui.addNotification(null, E('p', _('Some options are unavailable because swanctl failed to load: %s').format(error)), 'warning');

		m = new form.Map('ipsec', _('Encryption Proposals'),
			_('On this page, you can configure the encryption proposals used by IPsec connections.'));

		s = m.section(form.GridSection, 'crypto_proposal');
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sections.sectionNameCheck;
		sections.preventReferencedRemove(s, [ 'crypto_proposal', 'esp_proposal' ], [ 'connection', 'child' ]);

		o = s.option(form.Flag, 'is_esp', _('ESP Proposal'),
			_('Whether this is an ESP (phase 2) proposal or not'));

		o = s.option(form.Flag, 'use_custom_proposal', _('Use custom proposal'),
			_('When enabled, you can specify your own proposal string.'));
		o.default = '0';
		o.rmempty = true;

		o = s.option(form.Value, 'custom_proposal', _('Custom proposal'),
			sections.swanctlDescr(_('Using this option only if you know exactly what you are doing.') + '<br />' +
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

		sections.addConnectionsOption(s, [ 'crypto_proposal', 'esp_proposal' ], _('Referenced by'), [ 'connection', 'child' ]);

		return m.render().then(function (node) {
			const banner = service.banner(serviceState,
				_('Some options are unavailable until the IPsec service is enabled.'));
			if (banner)
				node.insertBefore(banner, node.firstChild);
			return ikev1.prepend(node);
		});
	}
});
