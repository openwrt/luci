'use strict';
'require form';
'require network';
'require rpc';

var callGetProfiles = rpc.declare({
	object: 'luci.jrd',
	method: 'getProfiles'
});

return network.registerProtocol('jrd', {
	getI18n: function() {
		return _('JRD Cellular');
	},

	getPackageName: function() {
		return 'jrd-modem';
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.ListValue, 'profile',
			_('Modem profile'),
			_('Select modem-specific defaults. Leave on the package default unless another supported JRD modem profile is required.'));
		o.rmempty = true;
		o.value('', _('Package default'));
		o.load = function(section_id) {
			var current = this.super('load', [ section_id ]);

			return Promise.all([ callGetProfiles(), current ]).then(function(results) {
				var data = results[0] || {};
				var profiles = Array.isArray(data.profiles) ? data.profiles : [];
				var defaultLabel = data.default ?
					_('Package default (%s)').format(data.default) :
					_('Package default');

				/* load() may be called more than once; rebuild the list cleanly. */
				this.keylist = [ '' ];
				this.vallist = [ defaultLabel ];

				profiles.forEach(function(profile) {
					if (profile && profile.name)
						this.value(profile.name, profile.label || profile.name);
				}, this);

				return results[1];
			}.bind(this));
		};

		o = s.taboption('general', form.Value, 'modem_ip',
			_('Modem IP address'),
			_('Optional override for the JRD modem control address. Leave empty to use the selected profile.'));
		o.datatype = 'ip4addr';
		o.placeholder = _('profile default');

		o = s.taboption('general', form.Value, 'port',
			_('Control port'),
			_('Optional override for the JRD kcap/JSON-RPC TCP port. Leave empty to use the selected profile.'));
		o.datatype = 'port';
		o.placeholder = _('profile default');

		o = s.taboption('general', form.Value, 'local_ip',
			_('Local management address'),
			_('Optional override for the IPv4 address assigned to the OpenWrt side of the modem link.'));
		o.datatype = 'ip4addr';
		o.placeholder = _('profile default');

		o = s.taboption('general', form.Value, 'prefix',
			_('Management prefix length'),
			_('Optional override for the management network prefix length.'));
		o.datatype = 'and(uinteger,range(1,32))';
		o.placeholder = _('profile default');

		o = s.taboption('general', form.Value, 'gateway',
			_('Modem gateway'),
			_('Optional override for the gateway on the modem management/data link.'));
		o.datatype = 'ip4addr';
		o.placeholder = _('profile default');

		o = s.taboption('advanced', form.Value, 'ethernet_interface',
			_('Ethernet LED interface'),
			_('Logical OpenWrt interface whose up/down state is reported to the JRD modem as ethlan_status for the modem-controlled LAN indicator. Leave empty to use the selected profile.'));
		o.datatype = 'uciname';
		o.placeholder = _('profile default');

		o = s.taboption('advanced', form.Flag, 'defaultroute',
			_('Use default gateway'),
			_('Install a default IPv4 route through the modem after the cellular connection is established.'));
		o.default = o.enabled;

		o = s.taboption('advanced', form.Value, 'metric',
			_('Use gateway metric'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.depends('defaultroute', '1');

		o = s.taboption('advanced', form.Flag, 'peerdns',
			_('Use modem DNS server'),
			_('Use the modem gateway as DNS server.'));
		o.default = o.enabled;

		o = s.taboption('advanced', form.Value, 'rpc_timeout',
			_('RPC timeout'),
			_('Socket timeout in seconds for each JRD control request.'));
		o.datatype = 'and(uinteger,range(1,60))';
		o.placeholder = '3';

		o = s.taboption('advanced', form.Value, 'timeout',
			_('Connection timeout'),
			_('Maximum number of seconds to wait for ConnectionStatus=2.'));
		o.datatype = 'and(uinteger,range(1,300))';
		o.placeholder = '30';
	}
});
