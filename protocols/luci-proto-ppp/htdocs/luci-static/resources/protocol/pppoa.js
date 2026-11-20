'use strict';
'require uci';
'require form';
'require network';

network.registerPatternVirtual(/^pppoa-.+$/);

function write_keepalive(section_id, value) {
	var f_opt = this.map.lookupOption('_keepalive_failure', section_id),
	    i_opt = this.map.lookupOption('_keepalive_interval', section_id),
	    f = parseInt(f_opt?.[0]?.formvalue(section_id), 10),
	    i = parseInt(i_opt?.[0]?.formvalue(section_id), 10);

	if (isNaN(i))
		i = 1;

	if (isNaN(f))
		f = (i == 1) ? null : 5;

	if (f !== null)
		uci.set('network', section_id, 'keepalive', '%d %d'.format(f, i));
	else
		uci.unset('network', section_id, 'keepalive');
}

return network.registerProtocol('pppoa', {
	getI18n: function() {
		return _('PPPoATM');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'pppoa-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'ppp-mod-pppoa';
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
		var dev = this.getL3Device() || this.getDevice(), o;

		o = s.taboption('general', form.ListValue, 'encaps', _('PPPoA Encapsulation'));
		o.value('vc', 'VC-Mux');
		o.value('llc', 'LLC');

		o = s.taboption('general', form.Value, 'atmdev', _('ATM device number'));
		o.default  = '0';
		o.datatype = 'uinteger';

		o = s.taboption('general', form.Value, 'vci', _('ATM Virtual Channel Identifier (VCI)'));
		o.default  = '35';
		o.datatype = 'uinteger';

		o = s.taboption('general', form.Value, 'vpi', _('ATM Virtual Path Identifier (VPI)'));
		o.default  = '8';
		o.datatype = 'uinteger';

		s.taboption('general', form.Value, 'username', _('PAP/CHAP username'));

		o = s.taboption('general', form.Value, 'password', _('PAP/CHAP password'));
		o.password = true;

		if (L.hasSystemFeature('ipv6')) {
			o = s.taboption('advanced', form.ListValue, 'ppp_ipv6', _('Obtain IPv6 address'), _('Enable IPv6 negotiation on the PPP link'));
			o.ucioption = 'ipv6';
			o.value('auto', _('Automatic'));
			o.value('0', _('Disabled'));
			o.value('1', _('Manual'));
			o.default = 'auto';
		}

		o = s.taboption('advanced', form.Value, 'reqprefix', _('Request IPv6-prefix'),
			_('Either a prefix length hint (e.g. 56) only, whereby the operator selects the prefix, or specify a prefix also (e.g. %s)')
			.format('<code>2001:db8::/56</code>'));
		o.depends("ppp_ipv6", "auto");

		o = s.taboption('advanced', form.Flag, 'norelease', _('Do not send a Release when restarting'), _('Enable to minimise the chance of prefix change after a restart'));
		o.depends("ppp_ipv6", "auto");
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, '_keepalive_failure', _('LCP echo failure threshold'), _('Presume peer to be dead after given amount of LCP echo failures, use 0 to ignore failures'));
		o.placeholder = '5';
		o.datatype    = 'uinteger';
		o.write       = write_keepalive;
		o.remove      = write_keepalive;
		o.cfgvalue = function(section_id) {
			var v = uci.get('network', section_id, 'keepalive');
			if (typeof(v) == 'string' && v != '') {
				var m = v.match(/^(\d+)[ ,]\d+$/);
				return m ? m[1] : v;
			}
		};

		o = s.taboption('advanced', form.Value, '_keepalive_interval', _('LCP echo interval'), _('Send LCP echo requests at the given interval in seconds, only effective in conjunction with failure threshold'));
		o.placeholder = '1';
		o.datatype    = 'and(uinteger,min(1))';
		o.write       = write_keepalive;
		o.remove      = write_keepalive;
		o.cfgvalue = function(section_id) {
			var v = uci.get('network', section_id, 'keepalive');
			if (typeof(v) == 'string' && v != '') {
				var m = v.match(/^\d+[ ,](\d+)$/);
				return m ? m[1] : v;
			}
		};

		o = s.taboption('advanced', form.Value, 'demand', _('Inactivity timeout'), _('Close inactive connection after the given amount of seconds, use 0 to persist connection'));
		o.placeholder = '0';
		o.datatype    = 'uinteger';

		o = s.taboption('advanced', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = dev ? (dev.getMTU() || '1500') : '1500';
		o.datatype    = 'max(9200)';
	}
});
