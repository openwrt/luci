'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('Exec Plugin Configuration'),
	description: _('The exec plugin starts external commands to read values from or to notify external processes when certain threshold values have been reached.'),

	addFormOptions: function(s) {
		var o, ss;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.SectionValue, '__input', form.TableSection, 'collectd_exec_input');
		o.title = _('Add command for reading values');
		o.description = _('Here you can define external commands which will be started by collectd in order to read certain values. The values will be read from stdout.');
		o.depends('enable', '1');

		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;

		o = ss.option(form.Value, 'cmdline', _('Script'));
		o.default = '/usr/bin/stat-dhcpusers';

		o = ss.option(widgets.UserSelect, 'cmduser', _('User'));
		o.default = 'nobody';
		o.optional = true;

		o = ss.option(widgets.GroupSelect, 'cmdgroup', _('Group'));
		o.default = 'nogroup';
		o.optional = true;

		o = s.option(form.SectionValue, '__notify', form.TableSection, 'collectd_exec_notify');
		o.title = _('Add notification command');
		o.description = _('Here you can define external commands which will be started by collectd when certain threshold values have been reached. The values leading to invocation will be fed to the the called programs stdin.');
		o.depends('enable', '1');

		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;

		o = ss.option(form.Value, 'cmdline', _('Script'));
		o.default = '/usr/bin/stat-dhcpusers';

		o = ss.option(widgets.UserSelect, 'cmduser', _('User'));
		o.default = 'nobody';
		o.optional = true;

		o = ss.option(widgets.GroupSelect, 'cmdgroup', _('Group'));
		o.default = 'nogroup';
		o.optional = true;
	},

	configSummary: function(section) {
		return _('Command monitoring enabled');
	}
});
