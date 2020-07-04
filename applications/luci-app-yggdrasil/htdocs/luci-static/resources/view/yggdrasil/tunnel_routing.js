'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yggdrasil', 'Yggdrasil');

		s = m.section(form.TypedSection, "yggdrasil", _("Tunnel Routing")); 
		s.anonymous = true;
		s.option(form.Flag, "TunnelRouting_Enable", "Enable tunnel routing",
			_("Allow tunneling non-Yggdrasil traffic over Yggdrasil. This effectively " +
				"allows you to use Yggdrasil to route to, or to bridge other networks, " +
				"similar to a VPN tunnel. Tunnelling works between any two nodes and " +
				"does not require them to be directly peered."));

		o = m.section(form.TableSection, "ipv4_remote_subnet", _("IPv4 remote subnet"),
			_("IPv4 subnets belonging to remote nodes, mapped to the node's public"));
		o.option(form.Value, "key", _("Key"), _("Public encryption key"));
		o.option(form.Value, "subnet", _("Subnet"), _("IPv4 subnet"));
		o.anonymous = true;
		o.addremove = true;

		o = m.section(form.TableSection, "ipv4_local_subnet", _("IPv4 local subnet"),
			_("IPv4 subnets belonging to this node's end of the tunnels. Only traffic "  +
				"from these ranges will be tunnelled."));
		o.option(form.Value, "subnet", _("Subnet"), _("IPv4 subnet"));
		o.anonymous = true;
		o.addremove = true;

		o = m.section(form.TableSection, "ipv6_remote_subnet", _("IPv6 remote subnet"),
			_("IPv6 subnets belonging to remote nodes, mapped to the node's public"));
		o.option(form.Value, "key", _("Key"), _("Public encryption key"));
		o.option(form.Value, "subnet", _("Subnet"), _("IPv6 subnet"));
		o.anonymous = true;
		o.addremove = true;

		o = m.section(form.TableSection, "ipv6_local_subnet", _("IPv6 local subnet"),
			_("IPv6 subnets belonging to this node's end of the tunnels. Only traffic " +
				"from these ranges (or the Yggdrasil node's IPv6 address/subnet) " +
				"will be tunnelled."));
		o.option(form.Value, "subnet", _("Subnet"), _("IPv6 subnet"));
		o.anonymous = true;
		o.addremove = true;

		return m.render();
	}
});
