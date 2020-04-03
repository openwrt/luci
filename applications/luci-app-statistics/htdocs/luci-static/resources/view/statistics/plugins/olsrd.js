'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('OLSRd Plugin Configuration'),
	description: _('The OLSRd plugin reads information about meshed networks from the txtinfo plugin of OLSRd.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'Host', _('Host'),
			_('IP or hostname where to get the txtinfo output from'));
		o.datatype = 'host';

		o = s.option(form.Value, 'Port', _('Port'));
		o.datatype = 'port';

		o = s.option(form.ListValue, 'CollectLinks', _('CollectLinks'),
			_('Specifies what information to collect about links.'));
		o.default = 'Detail';
		o.value('No');
		o.value('Summary');
		o.value('Detail');

		o = s.option(form.ListValue, 'CollectRoutes', _('CollectRoutes'),
			_('Specifies what information to collect about routes.'));
		o.default = 'Summary';
		o.value('No');
		o.value('Summary');
		o.value('Detail');

		o = s.option(form.ListValue, 'CollectTopology', _('CollectTopology'),
			_('Specifies what information to collect about the global topology.'));
		o.default = 'Summary';
		o.value('No');
		o.value('Summary');
		o.value('Detail');
	},

	configSummary: function(section) {
		return _('Monitoring OLSRd status at %s:%d').format(
			section.Host || 'localhost',
			section.Port || 2006
		);
	}
});
