'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function () {
		const m = new form.Map('antiblock', _('AntiBlock'));

		const s = m.section(form.NamedSection, 'config', 'antiblock', _('AntiBlock'));
		s.addremove = true;

		let o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(form.Value, 'url', _('URL'), _('Domains file URL, either File or URL or both'));
		o.default = 'https://antifilter.download/list/domains.lst';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'file', _('File'), _('Domains file path, either File or URL or both'));
		o.depends('enabled', '1');

		o = s.option(form.Value, 'DNS', _('DNS'), _('DNS address, required parameter'));
		o.default = '1.1.1.1:53';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'listen', _('Listen'), _('Listen address, required parameter'));
		o.default = '192.168.1.1:5053';
		o.depends('enabled', '1');

		o = s.option(widgets.DeviceSelect, 'VPN_name', _('VPN name'), _('Interface name, required parameter'));
		o.depends('enabled', '1');

		o = s.option(form.Value, 'output', _('Output'), _('Log or statistics output folder, optional parameter'));
		o.depends('enabled', '1');

		o = s.option(form.Flag, 'log', _('Log'), _('Show operations log, optional parameter'));
		o.depends({ output: '/', '!contains': true });

		o = s.option(form.Flag, 'stat', _('Stat'), _('Show statistics data, optional parameter'));
		o.depends({ output: '/', '!contains': true });

		return m.render();
	},
});
