'use strict';
'require view';
'require ui';
'require form';
'require uci';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('keepalived'),
		]);
	},

	renderIPAddress: function(m) {
		var s, o;

		s = m.section(form.GridSection, 'ipaddress', _('IP Addresses'),
			_('Addresses would be referenced into Static and Virtual IP Address of VRRP instances'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.optional = false;
		o.placeholder = 'name';

		o = s.option(form.Value, 'address', _('Address'),
			_('IP Address of the object'));
		o.rmempty = false;
		o.optional = false;
		o.datatype = 'ipaddr';
		o.placeholder = '192.168.1.1';

		o = s.option(widgets.DeviceSelect, 'device', _('Device'),
			_('Device to use to assign the Address'));
		o.optional = true;
		o.noaliases = true;

		o = s.option(form.Value, 'label_suffix', _('Virtual Device Label'),
			_('Creates virtual device with Label'));
		o.datatype = 'maxlength(4)';
		o.optional = true;

		o = s.option(form.ListValue, 'scope', _('Scope'),
			_('Scope of the Address'));
		o.value('site', _('Site'));
		o.value('link', _('Link'));
		o.value('host', _('Host'));
		o.value('nowhere', _('No Where'));
		o.value('global', _('Global'));
		o.optional = true;
	},

	renderStaticIPAddress: function(m) {
		var s, o;
		var ipaddress;

		ipaddress = uci.sections('keepalived', 'ipaddress');
		if (ipaddress == '') {
			ui.addNotification(null, E('p', _('IP Addresses must be configured for Static IP List')));
		}

		s = m.section(form.GridSection, 'static_ipaddress', _('Static IP Addresses'),
			_('Static Addresses are not moved by vrrpd, they stay on the machine.') + ' ' +
			_('If your systems already have IPs and they can ping ' +
			  'each other, you do not need this section'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.DynamicList, 'address', _('IP Address'),
			_('List of IP Addresses'));
		for (var i = 0; i < ipaddress.length; i++) {
			o.value(ipaddress[i]['name']);
		}
		o.optional = true;
	},

	render: function() {
		var m;

		m = new form.Map('keepalived');

		this.renderIPAddress(m);
		this.renderStaticIPAddress(m);

		return m.render();
	}
});
