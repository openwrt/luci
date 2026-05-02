'use strict';
'require baseclass';
'require view';
'require form';

return baseclass.extend({
	class: 'password',
	class_i18n: _('Password'),

	type: 'policy',
	type_i18n: _('Policy'),

	name: 'Password Policy',
	id: '51af4ae847774aac863d4c94a9ba6d58',
	title: _('Password Policy'),
	description: _('Here you can enforce a password policy sytem wide'),

	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enabled', _('Enable password policy'));
		o.default = o.disabled;
		o.remempty = false;

		o = s.option(form.Value, 'pw_length', _('Minimum password length'));
		o.optional = false;
		o.datatype = 'uinteger';
		o.placeholder = 8;

		o = s.option(form.Flag, 'digits', _('Digits'));
		o.default = false;

		o = s.option(form.Flag, 'uc_lc', _('Upper / lower case characters'));
		o.default = false;

		o = s.option(form.Flag, 'special_characters', _('Special characters'));
		o.default = false;

	},

	configSummary(section) {
		if (section.enabled != '1')
			return null;

		var summary = [];

		if (section.pw_length)
			summary.push(_('min. password length'));

		if (section.digits)
			summary.push(_('digit occurence'));

		if (section.uc_lc)
			summary.push(_('uppercase/lowercase occurence'));

		if (section.special_characters)
			summary.push(_('special characters occurence'));

		return summary.length ? summary.join (', ') : _('Password Policy enabled');
	}
});
