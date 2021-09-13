// Copyright 2021 Stan Grishin (stangri@melmac.net)
// Many thanks to [@vsviridov](https://github.com/vsviridov) for help with transition to JS

'use strict';
'require form';
'require uci';
'require view';
'require vpnbypass.widgets as widgets';

var pkg = {
	get Name() { return 'vpnbypass'; },
	get URL() { return 'https://docs.openwrt.melmac.net/' + pkg.Name + '/'; }
};

return view.extend({
	load: function () {
		return Promise.all([
			uci.load(pkg.Name),
			uci.load('dhcp')
		]);
	},

	render: function (data) {

		var m, d, s, o;

		m = new form.Map(pkg.Name, _('VPN Bypass'));

		s = m.section(form.NamedSection, 'config', pkg.Name);

		o = s.option(widgets.Status, '', _('Service Status'));

		o = s.option(widgets.Buttons, '', _('Service Control'));

		o = s.option(form.DynamicList, 'localport', _('Local Ports to Bypass'), _('Local ports to trigger VPN Bypass.'));
		o.datatype = 'portrange';
		o.addremove = false;
		o.optional = false;

		o = s.option(form.DynamicList, 'remoteport', _('Remote Ports to Bypass'), _('Remote ports to trigger VPN Bypass.'));
		o.datatype = 'portrange';
		o.addremove = false;
		o.optional = false;

		o = s.option(form.DynamicList, 'localsubnet', _('Local IP Addresses to Bypass'), _('Local IP addresses or subnets with direct internet access.'));
		o.datatype = 'ip4addr';
		o.addremove = false;
		o.optional = false;

		o = s.option(form.DynamicList, 'remotesubnet', _('Remote IP Addresses to Bypass'), _('Remote IP addresses or subnets which will be accessed directly.'));
		o.datatype = 'ip4addr';
		o.addremove = false;
		o.optional = false;

		d = new form.Map('dhcp');
		s = d.section(form.TypedSection, 'dnsmasq');
		s.anonymous = true;
		o = s.option(form.DynamicList, 'ipset', _('Domains to Bypass'), _('Domains to be accessed directly, see %sREADME%s for syntax.').format('<a href="' + pkg.URL + '#bypass-domains-formatsyntax" target="_blank" rel="noreferrer noopener">', '</a>'));

		return Promise.all([m.render(), d.render()]);
	}
});
