'use strict';
'require form';

return L.Class.extend({
	title: _('Network Plugin Configuration'),
	description: _('The network plugin provides network based communication between different collectd instances. Collectd can operate both in client and server mode. In client mode locally collected data is transferred to a collectd server instance, in server mode the local instance receives data from other hosts.'),

	addFormOptions: function(s) {
		var o, ss;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';

		o = s.option(form.Value, 'TimeToLive', _('TTL for network packets'));
		o.default = '128';
		o.datatype = 'range(0, 255)';
		o.optional = true;
		o.depends('enable', '1');

		o = s.option(form.Flag, 'Forward', _('Forwarding between listen and server addresses'));
		o.default = '0';
		o.optional = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'CacheFlush', _('Cache flush interval'),
			_('Seconds'));
		o.default = '86400';
		o.datatype = 'uinteger';
		o.optional = true;
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
		o.datatype = 'ipaddr("nomask")';

		o = ss.option(form.Value, 'port', _('Server port'));
		o.default = '25826';
		o.datatype = 'port';
		//o.optional = true;
	},

	configSummary: function(section) {
		return _('Network communication enabled');
	}
});
