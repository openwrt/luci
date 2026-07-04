'use strict';
'require form';
'require view';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('nut_monitor', _('NUT Monitor'),
			_('Network UPS Tools Monitoring Configuration'));

		s = m.section(form.NamedSection, 'upsmon', 'upsmon', _('Global Settings'));
		s.addremove = true;
		s.optional = false;

		o = s.option(form.Value, 'minsupplies', _('Minimum required number or power supplies'));
		o.datatype = 'uinteger'
		o.placeholder = 1;
		o.optional = true;

		o = s.option(form.Value, 'pollfreq', _('Poll frequency'));
		o.datatype = 'uinteger'
		o.placeholder = 5;
		o.optional = true;

		o = s.option(form.Value, 'pollfreqalert', _('Poll frequency alert'));
		o.datatype = 'uinteger'
		o.optional = true;
		o.placeholder = 5;

		o = s.option(form.Value, 'hostsync', _('Host Sync'));
		o.optional = true;
		o.placeholder = 15;

		o = s.option(form.Value, 'deadtime', _('Deadtime'));
		o.datatype = 'uinteger'
		o.optional = true;
		o.placeholder = 15;

		return m.render();
	}
});
