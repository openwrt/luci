'use strict';
'require view';
'require uci';
'require form';
'require rpc';


return view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([this.callHostHints(), uci.load('dhcp')]);
	},
	render: function([hosts]) {
		var m, s, o;

		m = new form.Map('dhcp', _('Canonical Names'));

		s = m.section(form.GridSection, 'cname', _(''));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;

		o = s.option(form.Value, 'cname', _('Hostname'));
		o.datatype = 'hostname';
		o.rmempty = true;
		o.sortable  = true;
		o.validate = (sid, value) => {
			return value.length > 0 ? true : 'must be specified';
		};

		o = s.option(form.Value, 'target', _('Target'));
		o.datatype = 'hostname';
		o.rmempty = true;
		o.sortable  = true;
		o.validate = (sid, value) => {
			return value.length > 0 ? true : 'must be specified';
		};

		var domain = '.' + uci.get_first('dhcp', 'dnsmasq', 'domain');
		Object.keys(hosts)
			.map(mac => hosts[mac].name)
			.filter(name => name != null)
			.map(name => name + (name.includes('.') ? '' : domain))
			.sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}))
			.forEach(function(name) {
				o.value(name, name);
		});

		return m.render();
	}
});
