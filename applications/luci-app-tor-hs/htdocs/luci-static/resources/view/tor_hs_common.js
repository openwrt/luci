'use strict';
'require view';
'require ui';
'require rpc';
'require form';

var callTorHSList = rpc.declare({
			object: 'tor-hs-rpc',
			method: 'list-hs',
			expect: {'':{}  }});

return view.extend({
	formdata: { torhs: {} },

	load: function() {
		return Promise.all([
			callTorHSList()
		]);
	},

	render: function(data) {
		var m, s, o;

		m  = new form.Map('tor-hs', 'Common settings');

		s = m.section(form.NamedSection, 'common', _('Global settings'));
		o = s.option(form.Value, 'HSDir', _('HSDir'), _('Path to directory with hidden services.'));
		o.rmempty = false;
		o.datatype = "directory";

		o = s.option(form.Value, 'GenConf', _('GenConf'), _('Path to generated config file.'));
		o.rmempty = false;
		o.datatype = "file";

		o = s.option(form.Flag, 'RestartTor', _('Restart Tor'), _('Restart Tor daemon after tor-hs config change'));
		o.rmempty = false;

		o = s.option(form.Flag, 'UpdateTorConf', _('Auto-update Tor config'), _('Auto-update Tor uci config.'));
		o.rmempty = false;
		o.default=0;

		return m.render();
	},
});
