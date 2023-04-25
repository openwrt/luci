'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('cUrl Plugin Configuration'),

	addFormOptions: function(s) {
		var o, ss;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.SectionValue, '__pages', form.TableSection, 'collectd_curl_page');
		o.title = _('Fetch pages');
		o.depends('enable', '1');

		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;

		o = ss.option(form.Flag, 'enable', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = ss.option(form.Value, 'name', _('Name'));

		o = ss.option(form.Value, 'url', _('URL'));
	},

	configSummary: function(section) {
		return _('cURL plugin enabled');
	}
});
