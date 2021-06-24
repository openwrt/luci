'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Network Plugin Configuration'),
	description: _('The network plugin provides network based communication between different collectd instances. Collectd can operate both in client and server mode. In client mode locally collected data is transferred to a collectd server instance, in server mode the local instance receives data from other hosts.'),

	addFormOptions: function(s) {
		var o, ss;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';

		o = s.option(form.Value, 'TimeToLive', _('TTL for network packets'));
		o.placeholder = '1';
		o.datatype = 'range(1, 255)';
		o.depends('enable', '1');

		o = s.option(form.Value, 'MaxPacketSize', _('Maximum packet size'), _('Set the maximum size for datagrams sent over the network'));
		o.placeholder = '1452';
		o.datatype = 'range(1024, 65535)';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'Forward', _('Enable forwarding'), _('Forwarding between listen and server addresses'));
		o.depends('enable', '1');

		o = s.option(form.Flag, 'ReportStats', _('Enable statistics'), _('Create statistics about the network plugin itself'));
		o.depends('enable', '1');

		o = s.option(form.SectionValue, '__listeners', form.TableSection, 'collectd_network_listen');
		o.title = _('Listener interfaces');
		o.description = _('This section defines on which interfaces collectd will wait for incoming connections.');
		o.depends('enable', '1');

		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;

		o = ss.option(form.Value, 'host', _('Listen host'));
		o.default = '0.0.0.0';
		o.datatype = 'ipaddr("nomask")';

		o = ss.option(form.Value, 'port', _('Listen port'));
		o.default = '25826';
		o.datatype = 'port';
		//o.optional = true;

		o = s.option(form.SectionValue, '__servers', form.TableSection, 'collectd_network_server');
		o.title = _('Server interfaces');
		o.description = _('This section defines to which servers the locally collected data is sent to.');
		o.depends('enable', '1');

		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;

		o = ss.option(form.Value, 'host', _('Server host'));
		o.default = '0.0.0.0';
		o.datatype = 'or(hostname,ipaddr("nomask"))';

		o = ss.option(form.Value, 'port', _('Server port'));
		o.default = '25826';
		o.datatype = 'port';
		//o.optional = true;
	},

	configSummary: function(section) {
		return _('Network communication enabled');
	}
});
