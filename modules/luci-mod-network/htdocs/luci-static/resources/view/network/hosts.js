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
		L.sortedKeys(hosts).forEach(function(mac) {
			if (hosts[mac].ipaddrs && hosts[mac].ipaddrs.length) {
				hosts[mac].ipaddrs.forEach(function(ip) {
					o.value(ip, '%s (%s)'.format(
						ip,
						hosts[mac].name || mac
					));
				});
			}
		});

		return m.render();
	}
});
