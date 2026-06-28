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

		m = new form.Map('pppoe', _('Roaring Penguin PPPoE Server'),
			_('PPPoE Server Configuration'));

		s = m.section(form.TypedSection, 'pppoe_server', _('Server Configuration'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));

		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'), _('Interface on which to listen.'));
		o.optional = true;
		o.nocreate = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'localip', _('IP of listening side'), _('If specified as <code>0.0.0.0</code> the selection of local IP address is delegated to <code>pppd</code>'));
		o.datatype = 'ipaddr';
		o.placeholder = '10.0.0.1';
		o.value('10.0.0.1');
		o.value('0.0.0.0');
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'firstremoteip', _('First remote IP'), _('If specified as <code>0.0.0.0</code> remote IP allocation will be delegated to <code>pppd</code>'));
		o.datatype = 'ipaddr';
		o.placeholder = '10.67.15.1';
		o.value('10.67.15.1');
		o.value('0.0.0.0');
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'ac_name', _('Access Concentrator Name'));
		o.rmempty = true;
		o.value('', _('Default: hostname'));
		o.depends({ enabled: '1' });

		o = s.option(form.DynamicList, 'service_name', _('Service Name'), _('Each one causes the named service to be advertised in a Service-Name tag in the PADO frame. The first one specifies the default service, and is used if the PPPoE client requests a Service-Name of length zero.'));
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'maxsessions', _('Maximum Sessions'), _('Maximum concurrent sessions'));
		o.datatype = 'range(1,65534)';
		o.placeholder = 64;
		o.value('', _('Default: 64'));
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'maxsessionsperpeer', _('Maximum sessions per peer'));
		o.optional = true
		o.datatype = 'range(0,65534)';
		o.placeholder = 0;
		o.value('0', _('No limit'));
		o.value('10');
		o.value('100');
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Flag, 'use_non_uci_config', _('Use Non-UCI Config'), '<code>/etc/default/pppoe-server</code>');
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'optionsfile', _('Options file'));
		o.placeholder = '/etc/ppp/pppoe-server-options';
		o.value('/etc/ppp/options');
		o.value('/etc/ppp/pppoe-server-options');
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Flag, 'randomsessions', _('Random session selection'), _('Tells the PPPoE server to permute session numbers randomly.'));
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Flag, 'unit', _('Unit'), _('Invokes <code>pppd</code> with the unit flag'));
		o.optional = true;
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'offset', _('Offset'), _('PPP Offset'), _('Instead of numbering PPPoE sessions starting at 1, numbering starts at %s'.format('<code>offset</code>+1')));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = 0;
		o.value('0');
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'timeout', _('Timeout'), _('Causes <code>pppoe</code> to exit if no session traffic is detected for %s seconds.'.format('<code>timeout</code>')));
		// no default timeout is assumed
		o.optional = true;
		o.datatype = 'uinteger';
		o.value('0', _('No timeout'));
		o.value('60');
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Value, 'mss', _('MSS'), _('Max Segment Size'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.placeholder = 1468;
		o.value('1412');
		o.value('1468');
		o.rmempty = true;
		o.depends({ enabled: '1' });

		o = s.option(form.Flag, 'sync', _('Synchronous PPP encapsulation'), _('Reduces CPU usage, but may cause a race condition on slow CPUs'));
		o.depends({ enabled: '1' });

		return m.render();
	}
});
