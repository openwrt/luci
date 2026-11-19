'use strict';
'require form';
'require uci';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require strongswan-swanctl.sections as sections';
'require strongswan-swanctl.service as service';

return view.extend({
	load: function () {
		// The XFRM interface ID of a child is selected from the network config.
		return L.resolveDefault(uci.load('network'), null);
	},

	render: function () {
		let m, s;

		m = new form.Map('ipsec', _('Authentication & Children'),
			_('On this page, you can configure the authentication rounds and children used by connections in the advanced configuration mode.'));
		m.tabbed = true;

		// Local Configuration
		s = m.section(form.GridSection, 'local', _('Local'),
			_('Define local IKE authentication rounds referenced from connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sections.sectionNameCheck;

		sections.addLocalOptions(s);
		sections.addConnectionsOption(s, 'local', _('Referenced by'), [ 'connection' ]);
		sections.preventReferencedRemove(s, 'local', [ 'connection' ]);

		// Remote Configuration
		s = m.section(form.GridSection, 'remote', _('Remote'),
			_('Define remote IKE authentication rounds referenced from connections.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sections.sectionNameCheck;

		sections.addRemoteOptions(s);
		sections.addConnectionsOption(s, 'remote', _('Referenced by'), [ 'connection' ]);
		sections.preventReferencedRemove(s, 'remote', [ 'connection' ]);

		// Children Configuration
		s = m.section(form.GridSection, 'child', _('Children'),
			_('Define Connection Children to be used in Remote Configurations.'));
		s.addremove = true;
		s.nodescriptions = true;
		s.renderSectionAdd = sections.sectionNameCheck;

		sections.addChildOptions(s);
		sections.addConnectionsOption(s, 'child', _('Referenced by'), [ 'connection' ]);
		sections.preventReferencedRemove(s, 'child', [ 'connection' ]);

		return m.render().then(function (node) {
			return service.prepend(node,
				_('Changes take effect once the IPsec service is enabled.'));
		}).then(function (node) {
			return ikev1.prepend(node);
		});
	}
});
