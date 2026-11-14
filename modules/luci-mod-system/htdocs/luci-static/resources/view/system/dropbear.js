'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('dropbear', _('SSH Access'), _('Dropbear offers <abbr title="Secure Shell">SSH</abbr> network shell access and an integrated <abbr title="Secure Copy">SCP</abbr> server'));

		s = m.section(form.TypedSection, 'dropbear', _('Dropbear Instance'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add instance');

		o = s.option(form.Flag, 'enable', _('Enable Instance'), _('Enable <abbr title="Secure Shell">SSH</abbr> service instance'));
		o.default  = o.enabled;

		// Virtual option: derives UI mode from Interface/DirectInterface,
		// is not stored in UCI; inactive real options are removed on save
		o = s.option(form.ListValue, '_bind_to', _('Bind to'), _('Select how the SSH service should be bound to network interfaces or IP addresses'));
		o.widget = 'radio';
		o.value('all', _('All interfaces (unspecified)'));
		o.value('interface', _('IP addresses of interface'));
		o.value('direct', _('Network interface'));
		o.default = 'all';
		o.cfgvalue = function(section) {
			if (this.section.cfgvalue(section, 'DirectInterface'))
				return 'direct';
			if (this.section.cfgvalue(section, 'Interface'))
				return 'interface';
			return 'all';
		};
		o.forcewrite = true;
		o.write = function(section) {
			this.remove(section);
		};

		o = s.option(widgets.NetworkSelect, 'DirectInterface', _('Interface'), _('Listen only on the given interface'));
		o.nocreate = true;
		o.depends('_bind_to', 'direct');
		o.validate = function(section, value) {
			return value ? true : _('Please select an interface');
		};

		o = s.option(widgets.NetworkSelect, 'Interface', _('Interface'), _('Listen on up to 10 IPs on the given interface'));
		o.nocreate = true;
		o.depends('_bind_to', 'interface');
		o.validate = function(section, value) {
			return value ? true : _('Please select an interface');
		};

		o = s.option(form.Value, 'Port', _('Port'));
		o.datatype    = 'port';
		o.placeholder = 22;

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
