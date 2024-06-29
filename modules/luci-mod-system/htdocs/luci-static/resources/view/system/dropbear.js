'use strict';
'require view';
'require form';
'require uci';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('firewall')
		]);
	},

	render: function() {
		var sshFirewallRule = uci.get('firewall', 'wan_ssh_allow');

		var m, s, o;

		m = new form.Map('dropbear', _('SSH Access'), _('Dropbear offers <abbr title="Secure Shell">SSH</abbr> network shell access and an integrated <abbr title="Secure Copy">SCP</abbr> server'));

		s = m.section(form.TypedSection, 'dropbear', _('Dropbear Instance'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add instance');

		o = s.option(form.Flag, 'enable', _('Enable Instance'), _('Enable <abbr title="Secure Shell">SSH</abbr> service instance'));
		o.default  = o.enabled;

		o = s.option(widgets.NetworkSelect, 'Interface', _('Interface'), _('Listen only on the given interface or, if unspecified, on all'));
		o.nocreate    = true;

		o = s.option(form.Value, 'Port', _('Port'));
		o.datatype    = 'port';
		o.placeholder = 22;

		if (sshFirewallRule && sshFirewallRule.enabled !== '1') {
			o = s.option(form.Flag, '_wan_ssh_firewall_rule', _('Allow SSH from WAN'),
				_('Enable firewall rule to allow access to the 22 port')
			);
			o.depends({ enable: '1', Port: '22' });
			o.write = function(section_id, value) {
				if (value === '1') {
					uci.set('firewall', 'wan_ssh_allow', 'enabled', '1');
				}
			};
		}

		o = s.option(form.Flag, 'PasswordAuth', _('Password authentication'), _('Allow <abbr title="Secure Shell">SSH</abbr> password authentication'));
		o.enabled  = 'on';
		o.disabled = 'off';
		o.default  = o.enabled;
		o.rmempty  = false;

		o = s.option(form.Flag, 'RootPasswordAuth', _('Allow root logins with password'), _('Allow the <em>root</em> user to log in with password'));
		o.enabled  = 'on';
		o.disabled = 'off';
		o.default  = o.enabled;

		o = s.option(form.Flag, 'GatewayPorts', _('Gateway Ports'), _('Allow remote hosts to connect to local SSH forwarded ports'));
		o.enabled  = 'on';
		o.disabled = 'off';
		o.default  = o.disabled;

		return m.render();
	}
});
