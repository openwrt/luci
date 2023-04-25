'use strict';
'require form';
'require view';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('mwan3')
		]);
	},

	render: function () {
		var m, s, o;

		m = new form.Map('mwan3', _('MultiWAN Manager - Members'),
			_('Members are profiles attaching a metric and weight to an MWAN interface.') + '<br />' +
			_('Names may contain characters A-Z, a-z, 0-9, _ and no spaces.') + '<br />' +
			_('Members may not share the same name as configured interfaces, policies or rules.'));

		s = m.section(form.GridSection, 'member');
		s.addremove = true;
		s.anonymous = false;
		s.nodescriptions = true;

		o = s.option(form.ListValue, 'interface', _('Interface'));
		var options = uci.sections('mwan3', 'interface')
		for (var i = 0; i < options.length; i++) {
			var value = options[i]['.name'];
			o.value(value);
		}

		o = s.option(form.Value, 'metric', _('Metric'),
			_('Acceptable values: 1-256. Defaults to 1 if not set'));
		o.datatype = 'range(1, 256)';

		o = s.option(form.Value, 'weight', ('Weight'),
			_('Acceptable values: 1-1000. Defaults to 1 if not set'));
		o.datatype = 'range(1, 1000)';

		return m.render();
	}
})
