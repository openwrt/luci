'use strict';
'require form';
'require view';
'require tools.widgets as widgets';

return view.extend({
	render: function (result) {
		let m, s, o;

		m = new form.Map('ipsec', _('Service configuration'),
			_('On this page, you can configure the IPsec service.'));
		m.tabbed = true;

		// strongSwan General Settings
		s = m.section(form.NamedSection, 'globals', 'ipsec', _('General Settings'));

		o = s.option(widgets.NetworkSelect, 'interface', _('Listening Interfaces'),
			_('Interfaces that accept VPN traffic.') + '<br /> ' +
			_('Select an interface or leave empty for all interfaces.'));
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;

		o = s.option(form.Value, 'debug', _('Debug Level'),
			_('Trace level: 0 is least verbose, 4 is most'));
		o.default = '0';
		o.datatype = 'range(0,4)';

		return m.render();
	}
});
