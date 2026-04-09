'use strict';
'require baseclass';
'require form';

/*
UI configuration for example authentication plugin.

This file provides the configuration interface for the auth plugin
in System > Plugins. It defines the plugin metadata and configuration
options that will be stored in the luci_plugins UCI config.

The filename must match the backend plugin UUID (32-char hex).
*/

return baseclass.extend({
	// Plugin classification
	class: 'auth',
	class_i18n: _('Authentication'),

	type: 'login',
	type_i18n: _('Login'),

	// Plugin identity
	name: 'Example Auth Plugin',
	id: 'd0ecde1b009d44ff82faa8b0ff219cef',
	title: _('Example Authentication Plugin'),
	description: _('A simple example authentication plugin that demonstrates the auth plugin interface. ' +
	               'This plugin adds a verification code challenge after password login.'),

	// Add configuration form options
	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'priority', _('Priority'),
			_('Execution order. Lower values run first.'));
		o.default = '10';
		o.datatype = 'integer';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'challenge_field', _('Challenge Field Name'),
			_('The form field name for the verification code input.'));
		o.default = 'verification_code';
		o.rmempty = false;
		o.depends('enabled', '1');

		o = s.option(form.Value, 'help_text', _('Help Text'),
			_('Text displayed to help users understand what to enter.'));
		o.default = 'Enter your verification code';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'test_code', _('Test Code'),
			_('For demonstration purposes, the expected verification code. ' +
			  'In a real plugin, this would integrate with TOTP/SMS/WebAuthn systems.'));
		o.default = '123456';
		o.password = true;
		o.depends('enabled', '1');
	},

	// Display current configuration summary
	configSummary(section) {
		if (section.enabled != '1')
			return null;

		const challenge_field = section.challenge_field || 'verification_code';
		const help_text = section.help_text || 'Enter your verification code';

		return _('Field: %s - %s').format(challenge_field, help_text);
	}
});
