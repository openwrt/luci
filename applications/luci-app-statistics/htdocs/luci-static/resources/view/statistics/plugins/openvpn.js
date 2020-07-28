'use strict';
'require baseclass';
'require fs';
'require form';

return baseclass.extend({
	title: _('OpenVPN Plugin Configuration'),
	description: _('The OpenVPN plugin gathers information about the current vpn connection status.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Flag, 'CollectIndividualUsers', _('Generate a separate graph for each logged user'));
		o.depends('enable', '1');

		o = s.option(form.Flag, 'CollectUserCount', _('Aggregate number of connected users'));
		o.depends('enable', '1');

		o = s.option(form.Flag, 'CollectCompression', _('Gather compression statistics'));
		o.depends('enable', '1');

		o = s.option(form.Flag, 'ImprovedNamingSchema', _('Use improved naming schema'));
		o.depends('enable', '1');

		o = s.option(form.DynamicList, 'StatusFile', _('OpenVPN status files'));
		o.depends('enable', '1');
		o.load = function(section_id) {
			return L.resolveDefault(fs.list('/var/run'), []).then(L.bind(function(entries) {
				for (var i = 0; i < entries.length; i++)
					if (entries[i].type == 'file' && entries[i].name.match(/^openvpn\..+\.status$/))
						this.value('/var/run/' + entries[i].name);

				return this.super('load', [section_id]);
			}, this));
		};
	},

	configSummary: function(section) {
		var stats = L.toArray(section.StatusFile);

		if (stats.length)
			return N_(stats.length, 'Monitoring one OpenVPN instance', 'Monitoring %d OpenVPN instances').format(stats.length);
	}
});
