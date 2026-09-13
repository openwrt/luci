'use strict';
'require baseclass';
'require form';

return baseclass.extend({

	class: 'http',
	class_i18n: _('HTTP'),

	type: 'headers',
	type_i18n: _('Headers'),

	name: 'Content-Security-Policy',
	id: 'c0ffee2cf63e160c091224d95d69cdff',
	title: _('Content Security Policy'),
	description: _('Adds a Content-Security-Policy HTTP response header to protect against XSS and content injection attacks.'),

	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(form.ListValue, 'mode', _('Mode'));
		o.value('strict', _('Strict'));
		o.value('permissive', _('Permissive'));
		o.value('custom', _('Custom (experts only)'));
		o.default = 'strict';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'policy', _('Custom CSP Policy String'),
			_('WARNING: Wrong values can render the web-UI inaccessible, requiring SSH to recover (/etc/config/luci_plugins).'));
		o.default = "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'trusted-types-eval'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://sysupgrade.openwrt.org;";
		o.depends({ enabled: '1', mode: 'custom' });
	},

	configSummary(section) {
		if (section.enabled !== '1')
			return _('Disabled');
		return _('Mode: %s').format(section.mode || 'strict');
	}
});
