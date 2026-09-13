'use strict';
'require baseclass';
'require form';

/*
class, type, name and id are used to build a reference for the uci config. E.g.

config http_auth '6c4b5551b62b4bc8a3053fb519d71d5f'
	option name '2FA'
	...

*/

return baseclass.extend({

	class: 'http',
	class_i18n: _('HTTP'),

	type: 'auth',
	type_i18n: _('Auth'),

	name: '2FA', // to make visual ID in UCI config easy
	id: '6c4b5551b62b4bc8a3053fb519d71d5f', // cat /proc/sys/kernel/random/uuid | tr -d -
	title: _('2FA Example Plugin'),
	description: _('This plugin does nothing. It is just a UI example.'),

	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(form.Value, 'foo', _('Foo'));
		o.default = '2FA value';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'bar', _('Bar'));
		o.default = '2000';
		o.depends('enabled', '1');
	},

	configSummary(section) {
		return _('I am class %s, type %s, name %s, bar: %d').format(this.class_i18n, this.type_i18n, this.name, section.bar || 1000);
	}
});
