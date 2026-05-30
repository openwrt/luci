'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('apinger', _('Apinger - Interfaces'),
			_('Names must match the interface name found in /etc/config/network.'));

		s = m.section(form.GridSection, 'interface');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add Interface Instance');

		o = s.option(form.Flag, 'debug', _('Debug'));
		o.datatype = 'boolean';
		o.default = false;

		o = s.option(form.Value, 'status_interval', _('Status Update Interval'));
		o.datatype = 'range(1-60)';
		o.default = '5';

		o = s.option(form.Value, 'rrd_interval', _('RRD Collection Interval'));
		o.datatype = 'range(15-60)';
		o.default = '30';

		return m.render();
	},
});
