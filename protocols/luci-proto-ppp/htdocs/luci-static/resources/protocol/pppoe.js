'use strict';
'require uci';
'require form';
'require network';

network.registerPatternVirtual(/^pppoe-.+$/);

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

return network.registerProtocol('pppoe', {
	getI18n: function() {
		return _('PPPoE');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'pppoe-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'ppp-mod-pppoe';
	},

	renderFormOptions: function(s) {
		var dev = this.getL3Device() || this.getDevice(), o;

		s.taboption('general', form.Value, 'username', _('PAP/CHAP username'));

		o = s.taboption('general', form.Value, 'password', _('PAP/CHAP password'));
		o.password = true;

		o = s.taboption('general', form.Value, 'ac', _('Access Concentrator'), _('Leave empty to autodetect'));
		o.placeholder = _('auto');

		o = s.taboption('general', form.Value, 'ac_mac',
			'<abbr title="%s">%s</abbr>'.format(_('Access Concentrator'), _('AC')) + ' ' + _('MAC Address'),
			_('Leave empty to autodetect'));
		o.placeholder = _('auto');
		o.datatype    = 'macaddr';

		o = s.taboption('general', form.Value, 'service', _('Service Name'), _('Leave empty to autodetect'));
		o.placeholder = _('auto');

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

		o = s.taboption('advanced', form.Value, 'host_uniq', _('Host-Uniq tag content'), _('Raw hex-encoded bytes. Leave empty unless your ISP require this'));
		o.placeholder = _('auto');
		o.datatype    = 'hexstring';

		o = s.taboption('advanced', form.Value, 'demand', _('Inactivity timeout'), _('Close inactive connection after the given amount of seconds, use 0 to persist connection'));
		o.placeholder = '0';
		o.datatype    = 'uinteger';

		o = s.taboption('advanced', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = dev ? (dev.getMTU() || '1500') : '1500';
		o.datatype    = 'max(9200)';
	}
});
