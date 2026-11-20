'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function () {
		const m = new form.Map('antiblock', _('AntiBlock'));

		const s = m.section(form.NamedSection, 'config', 'main', _('AntiBlock'));
		s.addremove = true;

		let o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(form.DynamicList, 'blacklist', _('Blacklist'), _('Prevent adding IP from these subnets to the routing table, optional parameter'));
		o.depends('enabled', '1');

		o = s.option(form.Flag, 'log', _('Log'), _('Show operations log, optional parameter'));
		o.depends('enabled', '1');

		o = s.option(form.Flag, 'stat', _('Statistics'), _('Show statistics data, optional parameter'));
		o.depends('enabled', '1');

		return m.render();
	},
});
