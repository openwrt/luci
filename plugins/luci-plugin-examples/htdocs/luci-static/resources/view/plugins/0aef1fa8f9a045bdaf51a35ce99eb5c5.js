'use strict';
'require baseclass';
'require form';

/*
class, type, name and id are used to build a reference for the uci config. E.g.

config http_headers '0aef1fa8f9a045bdaf51a35ce99eb5c5'
	option name 'X-Foobar'
	...

*/

return baseclass.extend({

	class: 'http',
	class_i18n: _('HTTP'),

	type: 'headers',
	type_i18n: _('Headers'),

	name: 'X-Foobar', // to make visual ID in UCI config easy
	id: '0aef1fa8f9a045bdaf51a35ce99eb5c5', // cat /proc/sys/kernel/random/uuid | tr -d - 
	title: _('X-Foobar Example Plugin'),
	description: _('This plugin sets an X-Foobar HTTP header.'),

	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(form.Value, 'foo', _('Foo'));
		o.default = 'foo';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'bar', _('Bar'));
		o.default = '4000';
		o.depends('enabled', '1');
	},

	configSummary(section) {
		return _('I am class %s, type %s, name %s, bar: %d').format(this.class_i18n, this.type_i18n, this.name, section.bar || 1000);
	}
});
