'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render() {
		let m, s, o;

		m = new form.Map('bmx7', _('BMX7'));
		s = m.section(form.NamedSection, 'general');
		s.anonymous = true;

		o = s.option(form.Value, 'runtimeDir', _('runtimeDir'));
		o = s.option(form.Value, 'trustedNodesDir', _('trustedNodesDir'));

		s = m.section(form.TypedSection, 'plugin', _('Plugins'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'plugin', _('Plugin')); 

		s = m.section(form.TypedSection, 'dev', _('Devices'));
		s.addremove = true;
		s.anonymous = false;

		o = s.option(widgets.DeviceSelect, 'dev', _('Dev')); 

		s = m.section(form.TypedSection, 'tunDev', _('Tunnel Devices'));
		s.addremove = true;
		s.anonymous = false;

		o = s.option(form.Value, 'tunDev', _('Dev'));
		o = s.option(form.Value, 'tun6Address', _('tun6Address'));
		o = s.option(form.Value, 'tun4Address', _('tun4Address'));

		s = m.section(form.TypedSection, 'tunOut', _('Gateway Devices'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'tunOut', _('tunOut'));
		o.value('ip4');
		o.value('ip6');

		o = s.option(form.Value, 'network', _('Network')); 
		o.datatype = 'ipaddr';

		o = s.option(form.Value, 'exportDistance', _('exportDistance'));
		o.datatype = 'uinteger';
		o = s.option(form.Value, 'minPrefixLen', _('minPrefixLen'));
		o.datatype = 'uinteger';

		s = m.section(form.NamedSection, 'luci', _('luci'));
		s.uciconfig = 'bmx7-luci';
		s.anonymous = true;

		o = s.option(form.Flag, 'ignore', _('Ignore'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'json', _('JSON source')); 
		o.rmempty = false;

		return m.render();
	},
});

