'use strict';
'require uci';
'require form';
'require network';

network.registerPatternVirtual(/^pppossh-.+$/);

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

return network.registerProtocol('pppossh', {
	getI18n: function() {
		return _('PPPoSSH');
	},

	getIfname: function() {
		return this._ubus('l3_device') || 'pppossh-%s'.format(this.sid);
	},

	getPackageName: function() {
		return 'pppossh';
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
		var o;

		o = s.taboption('general', form.Value, 'sshuser', _('SSH username'));
		o.rmempty = false;
		o.validate = function(section_id, value) {
			var id_opt = this.section.children.filter(function(o) { return o.option == 'identity' })[0];
			if (id_opt && value.length) {
				var input = this.map.findElement('id', id_opt.cbid(section_id)).querySelector('input[type="text"]');
				if (input)
					input.placeholder = (value == 'root' ? '/root' : '/home/' + value) + '/.ssh/id_rsa';
			}
			return true;
		};

		o = s.taboption('general', form.Value, 'server', _('SSH server address'));
		o.datatype = 'host(0)';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'port', _('SSH server port'));
		o.datatype = 'port';
		o.optional = true;
		o.placeholder = 22;

		o = s.taboption('general', form.Value, 'ssh_options', _('Extra SSH command options'));
		o.optional = true;

		o = s.taboption('general', form.DynamicList, 'identity', _('List of SSH key files for auth'));
		o.optional = true;
		o.datatype = 'file';

		o = s.taboption('general', form.Value, 'ipaddr', _('Local IP address to assign'));
		o.datatype = 'ipaddr("nomask")';

		o = s.taboption('general', form.Value, 'peeraddr', _('Peer IP address to assign'));
		o.datatype = 'ipaddr("nomask")';

		if (L.hasSystemFeature('ipv6')) {
			o = s.taboption('advanced', form.Flag, 'ppp_ipv6', _('Obtain IPv6 address'), _('Enable IPv6 negotiation on the PPP link'));
			o.ucioption = 'ipv6';
			o.default = o.disabled;
		}

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
	}
});
