'use strict';
'require view';
'require form';
'require network';
'require tools.widgets as widgets';

return view.extend({
	load() {
		return Promise.all([
			network.getDevices(),
		]);
	},

	render([netDevs]) {
		let m, s, o;

		m = new form.Map('libreswan', _('IPSec Global Settings'));

		s = m.section(form.NamedSection, 'globals', 'libreswan');
		s.anonymous = false;
		s.addremove = false;

		o = s.option(form.ListValue, 'debug', _('Debug Logs'));
		o.default = false;
		o.rmempty = false;
		o.value('none', _('none - No Logging'));
		o.value('base', _('base - Moderate Logging'));
		o.value('cpu-usage', _('cpu-usage - Timing/Load Logging'));
		o.value('crypto', _('crypto - All crypto related Logging'));
		o.value('tmi', _('tmi - Too Much/Excessive Logging'));
		o.value('private', _('private - Sensitive private-key/password Logging'));
		o.default = 'none'

		o = s.option(form.Flag, 'uniqueids', _('Uniquely Identify Remotes'),
			_('Whether IDs should be considered identifying remote parties uniquely'));
		o.default = false;
		o.rmempty = false;

		o = s.option(widgets.NetworkSelect, 'listen_interface', _('Listen Interface'),
			_('Interface for IPsec to use'));
		o.datatype = 'string';
		o.multiple = false;
		o.optional = true;

		o = s.option(form.Value, 'listen', _('Listen Address'),
			_('IP address to listen on, default depends on Listen Interface'));
		o.datatype = 'ip4addr';
		for (let nd of netDevs) {
			var addrs = nd.getIPAddrs();
			for (let ad of addrs) {
				o.value(ad.split('/')[0]);
			}
		}
		o.depends({ 'listen_interface' : '' });

		o = s.option(form.Value, 'nflog_all', _('Enable nflog on nfgroup'),
			_('NFLOG group number to log all pre-crypt and post-decrypt traffic to'));
		o.datatype = 'uinteger';
		o.default = 0;
		o.rmempty = true;
		o.optional = true;

		o = s.option(form.DynamicList, 'virtual_private', _('Allowed Virtual Private'),
			_('The address ranges that may live behind a NAT router through which a client connects'));
		o.datatype = 'neg(ip4addr)';
		o.multiple = true;
		o.optional = true;

		return m.render();
	}
});
