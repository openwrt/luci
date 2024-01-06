'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('crowdsec', _('CrowdSec'),
			_('Gain <a href="http://www.crowdsec.net">crowd-sourced</a> protection against malicious IPs. ' +
			'Benefit from the most accurate CTI in the world.'));


		s = m.section(form.TypedSection, 'bouncer', _('Bouncer'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'api_url', _('URL of local API'),
			_('The URL of your local CrowdSec API instance.')); 
		o.default = '';
		o.rmempty = false;

		o = s.option(form.Value, 'api_key', _('API key'),
			_('The key of your bouncer as registered on the local CrowdSec API.'));
		o.default = '';
		o.password = true;
		o.rmempty = false;

		o = s.option(widgets.DeviceSelect, 'interface', _('Filtered interfaces'),
			_('List of interfaces with traffic to be filtered.'));
		o.noaliases = true;
		o.multiple = true;
		o.rmempty = false;

		o = s.option(form.Flag, 'ipv6', _('Enable support for IPv6'),
			_('If unchecked IPv6 will not be filtered.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'filter_input', _('Filter input chain'),
			_('Block packets from filtered interfaces addressed to the router itself.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'filter_forward', _('Filter forward chain'),
			_('Block packets from filtered interfaces addressed to devices in your network.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'deny_log', _('Log filtered ip addresses'),
			_('If checked, a log statement will be added to the firewall rule and blocked ' +
			'ip addresses will be logged to System Log.'));
		o.default = '0';
		o.rmempty = false;


		return m.render();
	},
});

