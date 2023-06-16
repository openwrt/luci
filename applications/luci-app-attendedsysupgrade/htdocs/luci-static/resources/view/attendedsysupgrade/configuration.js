'use strict';
'require view';
'require form';

return view.extend({
	render: function () {
		let m, s, o;

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
			_(
				'Other ASU server instances that rebuild a requested image. ' +
					'Allows to compare checksums and verify that the results are the same.'
			)
		);

		s = m.section(form.TypedSection, 'client', _('Client'));
		s.anonymous = true;

		o = s.option(
			form.Flag,
			'auto_search',
			_('Search on opening'),
			_('Search for new sysupgrades on opening the tab')
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

		return m.render();
	},
});
