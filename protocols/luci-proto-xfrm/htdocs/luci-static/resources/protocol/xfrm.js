'use strict';
'require uci';
'require form';
'require network';
'require tools.widgets as widgets';

return network.registerProtocol('xfrm', {
	getI18n: function() {
		return _('IPsec XFRM');
	},

	getIfname: function() {
		return this._ubus('l3_device') || this.sid;
	},

	getPackageName: function() {
		return 'xfrm';
	},

	isFloating: function() {
		return true;
	},

	isVirtual: function() {
		return true;
	},

	getDevice: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {
		var o, ss;

		o = s.taboption('general', form.Value, 'ifid', _('Interface ID'), _('Required. XFRM interface ID to be used for SA.'));
		o.datatype = 'integer';

		o = s.taboption('general', widgets.NetworkSelect, 'tunlink', _('Underlying interface'),_('Optional. Bind to a specific interface.'));
		o.exclude = s.section;
		o.nocreate = true;

		o = s.taboption('general', form.Value, 'mtu', _('MTU'), _('Optional. Maximum Transmission Unit of the XFRM interface.'));
		o.datatype = 'range(68,65535)';
		o.placeholder = '1280';
		o.optional = true;
	}
});
