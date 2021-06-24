'use strict';
'require view';
'require rpc';
'require form';

return view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	load: function() {
		return this.callHostHints();
	},

	render: function(hosts) {
		var m, s, o;

		m = new form.Map('dhcp', _('Hostnames'));

		s = m.section(form.GridSection, 'domain', _('Host entries'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;

		o = s.option(form.Value, 'name', _('Hostname'));
		o.datatype = 'hostname';
		o.rmempty = true;

		o = s.option(form.Value, 'ip', _('IP address'));
		o.datatype = 'ipaddr';
		o.rmempty = true;

		var ipaddrs = {};

		Object.keys(hosts).forEach(function(mac) {
			var addrs = L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4);

			for (var i = 0; i < addrs.length; i++)
				ipaddrs[addrs[i]] = hosts[mac].name || mac;
		});

		L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ipv4) {
			o.value(ipv4, '%s (%s)'.format(ipv4, ipaddrs[ipv4]));
		});

		return m.render();
	}
});
