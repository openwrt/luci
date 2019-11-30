// Copyright 2019 Shun Li <riverscn@gmail.com>
// This is free software, licensed under the Apache License, Version 2.0

'use strict';
'require form';
'require tools.widgets as widgets';

return L.view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('omcproxy', _('omcproxy'), _('Embedded IGMPv3 and MLDv2 proxy'));

		s = m.section(form.TypedSection, 'proxy', _('Proxy Instance'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add instance');

        o = s.option(form.ListValue, 'scope', _('Scope'), _('Minimum multicast scope to proxy (only affects IPv6 multicast)'));
		o.datatype    = 'string';
		o.value('', _('default'))
		o.value('global', _('global'))
		o.value('organization', _('organization-local'))
		o.value('site', _('site-local'))
		o.value('admin', _('admin-local'))
		o.value('realm', _('realm'))
		o.default = '';
		o.rmempty = true;

		o = s.option(widgets.NetworkSelect, 'uplink', _('Uplink interface'), _('Where does the multicast come from?'));
		o.nocreate    = true;
		o.rmempty = false;

		o = s.option(widgets.NetworkSelect, 'downlink', _('Downlink interface'), _('Where does the multicast go to?'));
		o.nocreate    = true;
		o.rmempty = false;

		return m.render();
	}
});