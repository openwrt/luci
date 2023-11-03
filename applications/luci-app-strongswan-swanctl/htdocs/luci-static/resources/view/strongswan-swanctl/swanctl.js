'use strict';
'require view';
'require form';
'require uci';
'require tools.widgets as widgets';

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

		o = s.option(form.ListValue, 'crypto_proposal', _('Crypto Proposal'),
			_('List of IKE (phase 1) proposals to use for authentication'));
		o.value('encryption_algorithm');
		o.value('hash_algorithm');
		o.value('dh_group');
		o.value('prf_algorithm');

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

		o = s.option(form.Value, 'authentication_method',
			_('Authentication Method'), _('IKE authentication (phase 1)'));
		o.datatype = 'string';

		s = m.section(form.TypedSection, 'ipsec',
			_('strongSwan General Settings'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'encryption_algorithm',
			_('Encryption Algorithm'),
			'%s (aes128, aes192, aes256, 3des)'.format(_('Encryption method')));
		o.value('aes128');
		o.value('aes192');
		o.value('aes256');
		o.value('3des');
		o.rmempty = false;

		o = s.option(form.ListValue, 'hash_algorithm', _('Hash Algorithm'),
			'%s (md5, sha1, sha2, ...)'.format(_('Hash algorithm')));
		o.value('md5');
		o.value('sha1');
		o.value('sha2');
		o.value('sha256');
		o.value('sha384');
		o.value('sha512');
		o.value('sha3_256');
		o.value('sha3_384');
		o.value('sha3_512');
		o.value('blake2s256');
		o.value('blake2b512');
		o.value('blake2s256');
		o.value('blake2b512');
		o.value('whirlpool');
		o.value('tiger');
		o.rmempty = false;

		o = s.option(form.ListValue, 'dh_group', _('Diffie-Hellman Group'),
			'%s (modp768, modp1024, ...)'.format(_('Diffie-Hellman exponentiation')));
		o.value('modp768');
		o.value('modp1024');
		o.value('modp1536');
		o.value('modp2048');
		o.value('modp3072');
		o.value('modp4096');
		o.rmempty = false;

		o = s.option(form.ListValue, 'prf_algorithm', _('PRF Algorithm'),
			_('Pseudo-Random Functions to use with IKE'));
		o.value('prf_hmac_md5');
		o.value('prfmd5');
		o.value('prfsha1');
		o.value('prfsha256');
		o.value('pfsha384');
		o.value('prfsha512');

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

		o = s.option(form.ListValue, 'crypto_proposal',
			_('Crypto Proposal (Phase 2)'), _('List of ESP (phase two) proposals'));
		o.value('encryption_algorithm');
		o.value('hash_algorithm');
		o.value('dh_group');
		o.value('prf_algorithm');
		o.required = true;

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

		return m.render();
	}
});