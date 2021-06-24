'use strict';
'require form';
'require fs';
'require view';

return view.extend({
	load: function() {
		return fs.list('/dev').then(function(devs) {
			return devs.filter(function(dev) {
				return dev.type == 'block' ? dev.name.match(/^[sh]d[a-z]$/) : false;
			});
		});
	},

	render: function(devs) {
		var m, s, o;
		m = new form.Map('hd-idle', _('HDD Idle'), _('HDD Idle is a utility program for spinning-down external disks after a period of idle time.'));

		s = m.section(form.TypedSection, 'hd-idle', _('Settings'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add new hdd setting...');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Value, 'disk', _('Disk'));
		devs.forEach(function(dev) {
			o.value(dev.name);
		});

		o = s.option(form.Value, 'idle_time_interval', _('Idle time'));
		o.default = 10;

		o = s.option(form.ListValue, 'idle_time_unit', _('Idle time unit'));
		o.value('seconds', _('s', 'Abbreviation for seconds'));
		o.value('minutes', _('min', 'Abbreviation for minutes'));
		o.value('hours', _('h', 'Abbreviation for hours'));
		o.value('days', _('d', 'Abbreviation for days'));
		o.default = 'minutes';

		return m.render();
	}
});
