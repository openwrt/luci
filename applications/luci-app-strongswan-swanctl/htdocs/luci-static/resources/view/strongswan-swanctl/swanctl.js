'use strict';
'require view';
'require form';
'require uci';
'require tools.widgets as widgets';
'require strongswan_algorithms';

function addAlgorithms(o, algorithms) {
	algorithms.forEach(function (algorithm) {
		if (strongswan_algorithms.isInsecure(algorithm)) {
			o.value(algorithm, '%s*'.format(algorithm));
		} else {
			o.value(algorithm);
		}
	});
}

return view.extend({
	render: function () {
		var m, s, o;

		m = new form.Map('ipsec', _('strongSwan Configuration'),
			_('Configure strongSwan for secure VPN connections.'));
		m.tabbed = true;

		// strongSwan General Settings
		s = m.section(form.TypedSection, 'ipsec', _('General Settings'));
		s.anonymous = true;

		o = s.option(widgets.ZoneSelect, 'zone', _('Zone'),
			_('Firewall zone that has to match the defined firewall zone'));
		o.default = 'lan';
		o.multiple = true;

		o = s.option(widgets.NetworkSelect, 'listen', _('Listening Interfaces'),
			_('Interfaces that accept VPN traffic'));
		o.datatype = 'interface';
		o.placeholder = _('Select an interface or leave empty for all interfaces');
		o.default = 'wan';
		o.multiple = true;
		o.rmempty = false;

		o = s.option(form.Value, 'debug', _('Debug Level'),
			_('Trace level: 0 is least verbose, 4 is most'));
		o.default = '0';
		o.datatype = 'range(0,4)';

		// Remote Configuration
		s = m.section(form.GridSection, 'remote', _('Remote Configuration'),
			_('Define Remote IKE Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Configuration is enabled or not'));
		o.rmempty = false;

		o = s.option(form.Value, 'gateway', _('Gateway (Remote Endpoint)'),
			_('IP address or FQDN name of the tunnel remote endpoint'));
		o.datatype = 'or(hostname,ipaddr)';
		o.rmempty = false;

		o = s.option(form.Value, 'local_gateway', _('Local Gateway'),
			_('IP address or FQDN of the tunnel local endpoint'));
		o.datatype = 'or(hostname,ipaddr)';
		o.modalonly = true;

		o = s.option(form.Value, 'local_sourceip', _('Local Source IP'),
			_('Virtual IP(s) to request in IKEv2 configuration payloads requests'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.option(form.Value, 'local_ip', _('Local IP'),
			_('Local address(es) to use in IKE negotiation'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.option(form.Value, 'local_identifier', _('Local Identifier'),
			_('Local identifier for IKE (phase 1)'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=headquarters';
		o.modalonly = true;

		o = s.option(form.Value, 'remote_identifier', _('Remote Identifier'),
			_('Remote identifier for IKE (phase 1)'));
		o.datatype = 'string';
		o.placeholder = 'C=US, O=Acme Corporation, CN=soho';
		o.modalonly = true;

		o = s.option(form.ListValue, 'authentication_method',
			_('Authentication Method'), _('IKE authentication (phase 1)'));
		o.modalonly = true;
		o.value('psk', 'Pre-shared Key');
		o.value('pubkey', 'Public Key');

		o = s.option(form.Value, 'pre_shared_key', _('Pre-Shared Key'),
			_('The pre-shared key for the tunnel'));
		o.datatype = 'string';
		o.password = true;
		o.modalonly = true;
		o.depends('authentication_method', 'psk');

		o = s.option(form.Flag, 'mobike', _('MOBIKE'),
			_('MOBIKE (IKEv2 Mobility and Multihoming Protocol)'));
		o.default = '1';
		o.modalonly = true;

		o = s.option(form.ListValue, 'fragmentation', _('IKE Fragmentation'),
			_('Use IKE fragmentation'));
		o.value('yes');
		o.value('no');
		o.value('force');
		o.value('accept');
		o.default = 'yes';
		o.modalonly = true;

		o = s.option(form.MultiValue, 'crypto_proposal', _('Crypto Proposal'),
			_('List of IKE (phase 1) proposals to use for authentication'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'crypto_proposal');
			if (sections.length == 0) {
				this.value('', _('Please create a Proposal first'));
			} else {
				sections.forEach(L.bind(function (section) {
					if (section.is_esp != '1') {
						this.value(section['.name']);
					}
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		o = s.option(form.MultiValue, 'tunnel', _('Tunnel'),
			_('Name of ESP (phase 2) section'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'tunnel');
			if (sections.length == 0) {
				this.value('', _('Please create a Tunnel first'));
			} else {
				sections.forEach(L.bind(function (section) {
					this.value(section['.name']);
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		// Tunnel Configuration
		s = m.section(form.GridSection, 'tunnel', _('Tunnel Configuration'),
			_('Define Connection Children to be used as Tunnels in Remote Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.DynamicList, 'local_subnet', _('Local Subnet'),
			_('Local network(s)'));
		o.datatype = 'subnet';
		o.placeholder = '192.168.1.1/24';
		o.rmempty = false;

		o = s.option(form.DynamicList, 'remote_subnet', _('Remote Subnet'),
			_('Remote network(s)'));
		o.datatype = 'subnet';
		o.placeholder = '192.168.2.1/24';
		o.rmempty = false;

		o = s.option(form.Value, 'local_nat', _('Local NAT'),
			_('NAT range for tunnels with overlapping IP addresses'));
		o.datatype = 'subnet';
		o.modalonly = true;

		o = s.option(form.MultiValue, 'crypto_proposal',
			_('Crypto Proposal (Phase 2)'),
			_('List of ESP (phase two) proposals. Only Proposals with checked ESP flag are selectable'));
		o.load = function (section_id) {
			this.keylist = [];
			this.vallist = [];

			var sections = uci.sections('ipsec', 'crypto_proposal');
			if (sections.length == 0) {
				this.value('', _('Please create an ESP Proposal first'));
			} else {
				sections.forEach(L.bind(function (section) {
					if (section.is_esp == '1') {
						this.value(section['.name']);
					}
				}, this));
			}

			return this.super('load', [section_id]);
		};
		o.rmempty = false;

		o = s.option(form.ListValue, 'startaction', _('Start Action'),
			_('Action on initial configuration load'));
		o.value('none');
		o.value('trap');
		o.value('start');
		o.default = 'trap';
		o.modalonly = true;

		o = s.option(form.Value, 'updown', _('Up/Down Script Path'),
			_('Path to script to run on CHILD_SA up/down events'));
		o.datatype = 'file';
		o.modalonly = true;

		// Crypto Proposals
		s = m.section(form.GridSection, 'crypto_proposal',
			_('Encryption Proposals'),
			_('Configure Cipher Suites to define IKE (Phase 1) or ESP (Phase 2) Proposals.'));
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'is_esp', _('ESP Proposal'),
			_('Whether this is an ESP (phase 2) proposal or not'));

		o = s.option(form.ListValue, 'encryption_algorithm',
			_('Encryption Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.default = 'aes256gcm128';
		addAlgorithms(o, strongswan_algorithms.getEncryptionAlgorithms());
		addAlgorithms(o, strongswan_algorithms.getAuthenticatedEncryptionAlgorithms());


		o = s.option(form.ListValue, 'hash_algorithm', _('Hash Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		strongswan_algorithms.getEncryptionAlgorithms().forEach(function (algorithm) {
			o.depends('encryption_algorithm', algorithm);
		});
		o.default = 'sha512';
		o.rmempty = false;
		addAlgorithms(o, strongswan_algorithms.getHashAlgorithms());

		o = s.option(form.ListValue, 'dh_group', _('Diffie-Hellman Group'),
			_('Algorithms marked with * are considered insecure'));
		o.default = 'modp3072';
		addAlgorithms(o, strongswan_algorithms.getDiffieHellmanAlgorithms());

		o = s.option(form.ListValue, 'prf_algorithm', _('PRF Algorithm'),
			_('Algorithms marked with * are considered insecure'));
		o.validate = function (section_id, value) {
			var encryptionAlgorithm = this.section.formvalue(section_id, 'encryption_algorithm');

			if (strongswan_algorithms.getAuthenticatedEncryptionAlgorithms().includes(
					encryptionAlgorithm) && !value) {
				return _('PRF Algorithm must be configured when using an Authenticated Encryption Algorithm');
			}

			return true;
		};
		o.optional = true;
		o.depends('is_esp', '0');
		addAlgorithms(o, strongswan_algorithms.getPrfAlgorithms());

		return m.render();
	}
});
