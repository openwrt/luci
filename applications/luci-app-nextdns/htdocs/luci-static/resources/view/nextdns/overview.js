'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;
		
		m = new form.Map('nextdns', _('NextDNS'),
			_('NextDNS Configuration.')
			+ '<br />'
			+ _('For further information, go to \
				<a href="https://nextdns.io" target="_blank">nextdns.io</a>.'));

		s = m.section(form.TypedSection, 'nextdns', _('General'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Enable NextDNS.'));
		o.default = '1';
		o.rmempty = false;

		s.option(form.Value, 'config', _('Configuration ID'),
			_('The ID of your NextDNS configuration.')
			+ '<br />'
			+ _('Go to nextdns.io to create a configuration.'));

		o = s.option(form.Flag, 'report_client_info', _('Report Client Info'),
			_('Expose LAN clients information in NextDNS analytics.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'log_queries', _('Log Queries'),
			_('Log individual queries to system log.'));
		o.rmempty = false;

		return m.render();
	},
});
