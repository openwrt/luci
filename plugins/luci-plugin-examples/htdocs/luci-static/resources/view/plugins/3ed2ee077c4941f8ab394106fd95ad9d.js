'use strict';
'require baseclass';
'require form';

/*
class, type, name and id are used to build a reference for the uci config. E.g.

config foo_bar '3ed2ee077c4941f8ab394106fd95ad9d'
	option name 'Chonki Boi'
	...

*/

return baseclass.extend({

	class: 'foo',
	class_i18n: _('FOO'),

	type: 'bar',
	type_i18n: _('Bar'),

	name: 'Chonki Boi', // to make visual ID in UCI config easy
	id: '3ed2ee077c4941f8ab394106fd95ad9d', // cat /proc/sys/kernel/random/uuid | tr -d -
	title: _('Chonki Boi Example Plugin'),
	description: _('This plugin does nothing. It is just a UI example.'),

	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(form.Value, 'foo', _('Foo'));
		o.default = 'chonkk value';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'bar', _('Bar'));
		o.default = '1000';
		o.depends('enabled', '1');
	},

	configSummary(section) {
		return _('I am class %s, type %s, name %s, bar: %d').format(this.class_i18n, this.type_i18n, this.name, section.bar || 1000);
	}
});
