'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yggdrasil', 'Yggdrasil');

		s = m.section(form.TypedSection, "yggdrasil", _("Session firewall settings"));
		s.anonymous = true;

		s.option(form.Flag, "SessionFirewall_Enable", _("Enable session firewall"),
			_("If disabled, network traffic from any node will be allowed. If enabled, the below rules apply"));
		s.option(form.Flag, "SessionFirewall_AllowFromDirect", _("Allow from direct"), 
			_("Allow network traffic from directly connected peers"));
		s.option(form.Flag, "SessionFirewall_AllowFromRemote", _("Allow from remote"), 
			_("Allow network traffic from remote nodes on the network that you are not directly peered with"));
		s.option(form.Flag, "SessionFirewall_AlwaysAllowOutbound", 
			_("Always allow outbound"), _("Allow outbound network traffic regardless of AllowFromDirect or AllowFromRemote"));

		s = m.section(form.TableSection, "whitelisted_encryption_public_key", 
			_("Whitelisted public keys"),
			_("Network traffic is always accepted from those peers, regardless of AllowFromDirect or AllowFromRemote"));
		s.option(form.Value, "key", _("Public key"));
		s.anonymous = true;
		s.addremove = true;

		s = m.section(form.TableSection, "blacklisted_encryption_public_key", 
			_("Blacklisted public keys"), 
			_("Network traffic is always rejected from those peers, regardless of AllowFromDirect or AllowFromRemote"));
		s.option(form.Value, "key", _("Public key"));
		s.anonymous = true;
		s.addremove = true;

		return m.render();
	}
});
