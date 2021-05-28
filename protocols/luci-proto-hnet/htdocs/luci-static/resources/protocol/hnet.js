'use strict';
'require form';
'require network';

return network.registerProtocol('hnet', {
	getI18n: function() {
		return _('Automatic Homenet (HNCP)');
	},

	getOpkgPackage: function() {
		return 'hnet-full';
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.ListValue, 'mode', _('Category'));
		o.value('auto', _('Automatic'));
		o.value('external', _('External'));
		o.value('internal', _('Internal'));
		o.value('leaf', _('Leaf'));
		o.value('guest', _('Guest'));
		o.value('adhoc', _('Ad-Hoc'));
		o.value('hybrid', _('Hybrid'));
		o.default = 'auto';

		s.taboption('advanced', form.Value, 'link_id', _('IPv6 assignment hint'), _('Assign prefix parts using this hexadecimal subprefix ID for this interface.'));

		o = s.taboption('advanced', form.Value, 'ip4assign', _('IPv4 assignment length'));
		o.datatype = 'max(32)';
		o.default = '24';

		o = s.taboption('advanced', form.Value, 'dnsname', _('DNS-Label / FQDN'));
		o.default = s.section;
	}
});
