'use strict';
'require form';
'require network';
'require tools.widgets as widgets';
'require view';

return view.extend({
	load: function() {
		return Promise.all([
			network.getNetworks(),
		]);
	},

	render: function (loaded_promises) {
		let m, s, o;
		const networks = loaded_promises[0];

		m = new form.Map('pppoe', _('Roaring Penguin PPPoE Relay'),
			_('PPPoE Relay Configuration'));

		s = m.section(form.TypedSection, 'pppoe_relay', _('Relay Configuration'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(widgets.NetworkSelect, 'server_interface', _('Server Interface'), _('Interface on which to listen. Only PPPoE servers may be connected to this interface.'));
		o.multiple = true;
		o.optional = true;
		o.nocreate = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(widgets.NetworkSelect, 'client_interface', _('Client Interface'), _('Interface from which to relay. Only PPPoE clients may be connected to this interface.'));
		o.multiple = true;
		o.optional = true;
		o.nocreate = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(widgets.NetworkSelect, 'both_interface', _('Both Interface'), _('Interface upon which to listen and to relay. Both PPPoE clients and servers may be connected to this interface.'));
		o.multiple = true;
		o.optional = true;
		o.nocreate = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Flag, 'use_non_uci_config', _('Use Non-UCI Config'), '<code>/etc/default/pppoe-relay</code>');
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'maxsessions', _('Maximum Sessions'));
		o.datatype = 'range(1,65534)';
		o.placeholder = 5000;
		o.value('', _('Default: 5000'));
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'timeout', _('Timeout'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = 600;
		o.value('0', _('No timeout'));
		o.value('', _('Default: 600'));
		o.rmempty = true;
		o.depends({ enabled: '1' });

		return m.render();
	}
});
