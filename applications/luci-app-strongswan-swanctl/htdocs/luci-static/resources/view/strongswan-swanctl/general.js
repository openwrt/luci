'use strict';
'require form';
'require view';

return view.extend({
	render: function (result) {
		let m, s, o;

		m = new form.Map('ipsec', _('General connections configurations'),
			_('On this page, you can configure the general settings for IPsec connections.'));
		m.tabbed = true;

		// Shunt Configuration
		s = m.section(form.GridSection, 'shunt', _('Shunt'),
			_('Define Shunt pass/drop policies independent of remote connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Configuration is enabled or not'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('Mode'),
			_('Shunt policy mode'));
		o.value('pass', _('Pass'));
		o.value('drop', _('Drop'));
		o.rmempty = false;

		o = s.option(form.DynamicList, 'local_ts', _('Local Traffic Selectors'),
			_('Local traffic selectors for the shunt policy'));
		o.datatype = 'list(or(cidr,ipaddr))';

		o = s.option(form.DynamicList, 'remote_ts', _('Remote Traffic Selectors'),
			_('Remote traffic selectors for the shunt policy'));
		o.datatype = 'list(or(cidr,ipaddr))';

		o = s.option(form.Value, 'priority', _('Priority'),
			_('Priority of the shunt policy (lower number means higher priority)'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.option(form.Value, 'interface', _('Interface'),
			_('Network interface to bind the shunt policy to'));
		o.modalonly = true;

		return m.render();
	}
});
