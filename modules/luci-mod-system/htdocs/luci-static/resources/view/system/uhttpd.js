'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('firewall')
		]);
	},

	render: function() {
		var httpsFirewallRule = uci.get('firewall', 'wan_https_allow');

		var m, s, o;

		m = new form.Map('uhttpd', _('HTTP(S) Access'), _('uHTTPd offers <abbr title="Hypertext Transfer Protocol">HTTP</abbr> or <abbr title="Hypertext Transfer Protocol Secure">HTTPS</abbr> network access.'));

		s = m.section(form.NamedSection, 'main', 'uhttpd', _('Settings'));
		s.addremove = false;

		o = s.option(form.Flag, 'redirect_https', _('Redirect to HTTPS'), _('Enable automatic redirection of <abbr title="Hypertext Transfer Protocol">HTTP</abbr> requests to <abbr title="Hypertext Transfer Protocol Secure">HTTPS</abbr> port.'));
		o.rmempty = false;

		if (httpsFirewallRule && httpsFirewallRule.enabled !== '1') {
			o = s.option(form.Flag, '_wan_https_firewall_rule', _('Allow HTTP and HTTPS from WAN'),
				_('Enable firewall rule to allow access to the 80 and 443 ports')
			);
			o.depends('enabled', '');
			o.depends('enabled', '1');
			o.write = function(section_id, value) {
				if (value === '1') {
					uci.set('firewall', 'wan_https_allow', 'enabled', '1');
				}
			};
		}

		return m.render();
	}
});
