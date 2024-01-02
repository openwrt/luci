'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('TCPConns Plugin Configuration'),
	description: _('The tcpconns plugin collects information about open tcp connections on selected ports.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Flag, 'ListeningPorts', _('Monitor all local listen ports'));
		o.depends('enable', '1');
		o.rmempty = false;
		o.default = '0';

		o = s.option(form.DynamicList, 'LocalPorts', _('Monitor local ports'));
		o.optional = true;
		o.datatype = 'port';
		o.default = '22';
		o.depends('enable', '1');

		o = s.option(form.DynamicList, 'RemotePorts', _('Monitor remote ports'));
		o.optional = true;
		o.datatype = 'port';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'AllPortsSummary', _('Summary of all ports'));
		o.rmempty = false;
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var lports = L.toArray(section.LocalPorts),
		    rports = L.toArray(section.RemotePorts),
		    listen = section.ListeningPorts == '1',
		    summary = section.AllPortsSummary == '1';

		return _('Monitoring %s and %s, %s %s').format(
			N_(lports.length, 'one local', '%d local').format(lports.length),
			N_(rports.length, 'one remote port', '%d remote ports').format(rports.length),
			listen ? _('all local listening ports,') : '',
			summary ? _('summary of all ports') : _('no summary')
		);
	}
});
