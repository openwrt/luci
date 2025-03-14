'use strict';
'require view';
'require form';
'require tools.widgets as widgets';
'require uci';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('keepalived');

		s = m.section(form.GridSection, 'track_interface', _('Track Interface'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.optional = false;

		o = s.option(widgets.DeviceSelect, 'value', _('Device'),
			_('Device to track'));
		o.noaliases = true;
		o.rmempty = false;
		o.optional = false;

		o = s.option(form.Value, 'weight', _('Weight'),
			_('When a weight is specified, instead of setting the' +
			  'vrrp_instance to the FAULT state in case of failure, ' +
			  'its priority will be increased or decreased by the ' +
			  'weight when the interface is up or down'));
		o.optional = false;
		o.datatype = 'uinteger';

		return m.render();
	}
});
