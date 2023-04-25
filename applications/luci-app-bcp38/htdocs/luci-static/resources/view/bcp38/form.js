'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('bcp38', _('BCP38'),
			_('This function blocks packets with private address destinations ' +
			'from going out onto the internet as per ' +
			'<a href="http://tools.ietf.org/html/bcp38">BCP 38</a>. ' +
			'For IPv6, only source specific default routes are installed, so ' +
			'no BCP38 firewall routes are needed.'));


		s = m.section(form.TypedSection, 'bcp38', _('BCP38 config'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Flag, 'detect_upstream', _('Auto-detect upstream IP'), 
			_('Attempt to automatically detect if the upstream IP ' +
			'will be blocked by the configuration, and add an exception if it will. ' +
			'If this does not work correctly, you can add exceptions manually below.')); 
		o.rmempty = false;

		o = s.option(widgets.DeviceSelect, 'interface', _('Interface name'),
			_('Interface to apply the blocking to should be the upstream WAN interface).'));
		o.modalonly = true;
		o.noaliases = true;
		o.multiple = false;
		o.rmempty = false;

		o = s.option(form.DynamicList, 'match', _('Blocked IP ranges'));
		o.datatype = 'ip4addr';

		o = s.option(form.DynamicList, 'nomatch', _('Allowed IP ranges'),
			_('Takes precedence over blocked ranges. ' +
			'Use to whitelist your upstream network if you\'re behind a double NAT ' +
			'and the auto-detection doesn\'t work.'));
		o.datatype = 'ip4addr';

		return m.render();
	},
});

