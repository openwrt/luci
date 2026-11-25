'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function () {
		return uci.load('attendedsysupgrade');
	},

	render: function () {
		let m, s, o;

		// Shared with owut, which creates it on installation.
		if (!uci.get('attendedsysupgrade', 'owut'))
			uci.add('attendedsysupgrade', 'owut', 'owut');

		m = new form.Map(
			'attendedsysupgrade',
			_('Attended Sysupgrade'),
			_('Attendedsysupgrade Configuration.')
		);

		s = m.section(form.TypedSection, 'server', _('Server'));
		s.anonymous = true;

		s.option(
			form.Value,
			'url',
			_('Address'),
			_('Address of the sysupgrade server')
		);

		s.option(
			form.DynamicList,
			'rebuilder',
			_('Rebuilders'),
			_('Other ASU server instances that rebuild a requested image. ' +
			  'Allows to compare checksums and verify that the results are the same.'
			)
		);

		s = m.section(form.TypedSection, 'client', _('Client'));
		s.anonymous = true;

		o = s.option(
			form.Flag,
			'login_check_for_upgrades',
			_('Check for upgrades'),
			_('Check for upgrades whenever the Status -> Overview page is loaded.')
		);
		o.default = '0';
		o.rmempty = false;

		o = s.option(
			form.Flag,
			'auto_search',
			_('Search on opening'),
			_('Search for upgrades when opening the Attended Sysupgrade tab')
		);
		o.default = '1';
		o.rmempty = false;

		o = s.option(
			form.Flag,
			'advanced_mode',
			_('Advanced Mode'),
			_('Show advanced options like package list modification')
		);
		o.default = '0';
		o.rmempty = false;

		s = m.section(
			form.NamedSection,
			'owut',
			'owut',
			_('Package repositories'),
			_('Custom apk repositories listed in %s (except %s), together with the keys in %s. These settings are shared with owut.').format(
				'<code>/etc/apk/repositories.d/*</code>',
				'<code>distfeeds.list</code>',
				'<code>/etc/apk/keys</code>')
		);
		s.addremove = false;

		const modes = [ 'append', 'disable', 'replace' ];
		const mode = uci.get('attendedsysupgrade', 'owut', 'repositories_mode');

		o = s.option(
			form.ListValue,
			'repositories_mode',
			_('Repositories mode'),
			_('Append: add the custom repositories allowed by the server to the build request.') + '<br />' +
			_('Disable: don\'t use custom repositories.') + '<br />' +
			_('Replace: only supported by owut, no upgrade can be requested here while it is set.')
		);
		o.value('append', _('Append'));
		o.value('disable', _('Disable'));
		o.value('replace', _('Replace (owut only)'));
		// Keep an unknown value visible instead of silently selecting another one.
		if (mode && !modes.includes(mode))
			o.value(mode, _('%h (unknown)').format(mode));
		o.default = 'append';
		o.validate = function (section_id, value) {
			return (!value || modes.includes(value))
				? true : _('Unknown repositories mode');
		};

		o = s.option(
			form.DynamicList,
			'repository_aliases',
			_('Repository aliases'),
			_('Applied to the repository urls after adjusting them to the target version, each a regular expression and its replacement separated by a space, e.g. %s.').format(
				'<code>SNAPSHOT main</code>')
		);

		return m.render();
	},
});
