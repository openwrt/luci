'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Ping Plugin Configuration'),
	description: _('The ping plugin will send icmp echo replies to selected hosts and measure the roundtrip time for each host.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Hosts', _('Monitor hosts'));
		o.default = '127.0.0.1';
		o.datatype = 'host';
		o.depends('enable', '1');

		o = s.option(form.ListValue, 'AddressFamily', _('Address family'));
		o.default = 'any';
		o.depends('enable', '1');
		o.value('any');
		o.value('ipv4');
		o.value('ipv6');

		o = s.option(form.Value, 'TTL', _('TTL for ping packets'));
		o.default = '127';
		o.datatype = 'range(0, 255)';
		o.depends('enable', '1');

		o = s.option(form.Value, 'Interval', _('Interval for pings'), _('Seconds'));
		o.default = '30';
		o.datatype = 'ufloat';
		o.depends('enable', '1');

	    o=s.option(form.Value,'MaxMissed',_('Maximum Missed Packets'),
		       _('When a host has not replied to this number of packets in a row, re-resolve the hostname in DNS.  Useful for dynamic DNS hosts.  Default is -1 = disabled.'));
		o.placeholder = '-1';
		o.datatype = 'and(min(-1),integer)'
		o.optional = true;
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var hosts = L.toArray(section.Hosts);

		if (hosts.length)
			return N_(hosts.length, 'Monitoring one host', 'Monitoring %d hosts').format(hosts.length);
	}
});
