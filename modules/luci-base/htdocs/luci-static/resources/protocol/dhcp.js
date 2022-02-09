'use strict';
'require rpc';
'require form';
'require network';

var callFileRead = rpc.declare({
	object: 'file',
	method: 'read',
	params: [ 'path' ],
	expect: { data: '' },
	filter: function(value) { return value.trim() }
});

return network.registerProtocol('dhcp', {
	getI18n: function() {
		return _('DHCP client');
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.Value, 'hostname', _('Hostname to send when requesting DHCP'));
		o.default = '';
		o.value('', _('Send the hostname of this device'));
		o.value('*', _('Do not send a hostname'));
		o.datatype    = 'or(hostname, "*")';
		o.load = function(section_id) {
			return callFileRead('/proc/sys/kernel/hostname').then(L.bind(function(hostname) {
				this.placeholder = hostname;
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};

		o = s.taboption('advanced', form.Flag, 'broadcast', _('Use broadcast flag'), _('Required for certain ISPs, e.g. Charter with DOCSIS 3'));
		o.default = o.disabled;

		o = s.taboption('advanced', form.Value, 'clientid', _('Client ID to send when requesting DHCP'));
		o.datatype  = 'hexstring';

		s.taboption('advanced', form.Value, 'vendorid', _('Vendor Class to send when requesting DHCP'));
	}
});
