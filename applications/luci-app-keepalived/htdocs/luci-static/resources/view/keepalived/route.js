'use strict';
'require view';
'require ui';
'require form';
'require uci';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('keepalived'),
		]);
	},

	renderRoute: function(m) {
		var s, o;

		s = m.section(form.GridSection, 'route', _('Routes'),
			_('Routes would be referenced into Static and Virtual Routes of VRRP instances'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.optional = false;
		o.placeholder = 'name';

		o = s.option(widgets.DeviceSelect, 'device', _('Device'),
			_('Device to use for Routing'));
		o.optional = true;
		o.noaliases = true;

		o = s.option(form.Value, 'address', _('Target/Destination'),
			_('Target IP Address of the Route'));
		o.optional = true;
		o.datatype = 'ipaddr';
		o.placeholder = '192.168.1.1';

		o = s.option(form.Value, 'src_addr', _('Source Address'),
			_('Source Address of the Route'));
		o.optional = true;
		o.datatype = 'ipaddr';
		o.placeholder = '192.168.1.1';

		o = s.option(form.Value, 'gateway', _('Gateway'),
			_('Gateway to use for the Route'));
		o.optional = true;
		o.datatype = 'ipaddr';
		o.placeholder = '192.168.1.1';

		o = s.option(form.Value, 'table', _('Route Table'),
			_('System Route Table'));
		o.value('default', _('default'));
		o.value('Main', _('Main'));
		o.optional = true;

		o = s.option(form.Flag, 'blackhole', _('Blackhole'));
		o.optional = true;
		o.placeholder = 'name';
	},

	renderStaticRoutes: function(m) {
		var s, o;
		var route;

		route = uci.sections('keepalived', 'route');
		if (route == '') {
			ui.addNotification(null, E('p', _('Routes must be configured for Static Routes')));
		}

		s = m.section(form.GridSection, 'static_routes', _('Static Routes'),
			_('Static Routes are not moved by vrrpd, they stay on the machine.') + '<br/>' +
			_('If you already have routes on your machines and ' +
			  'your machines can ping each other, you don\'t need this section'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.DynamicList, 'route', _('Route'),
			_('List of Route Object'));
		for (var i = 0; i < route.length; i++) {
			o.value(route[i]['name']);
		}
		o.optional = true;
	},

	render: function() {
		var m;

		m = new form.Map('keepalived');

		this.renderRoute(m);
		this.renderStaticRoutes(m);

		return m.render();
	}
});
