'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('hysteria', _('Hysteria'),
			_('Hysteria is a powerful, lightning fast and censorship resistant proxy.'));

		s = m.section(form.TypedSection, 'client');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add client instance', 'Hysteria clientd instance');

		s.tab('general', _('General'));
		s.tab('tproxy', _('Tproxy'));
		s.tab('dnsmasq', _('Dnsmasq'));

		s.taboption('general', form.Flag, 'enabled',
			_('Enabled'),
			_('Enable Hysteria Client instance.'));

		o = s.taboption('general', form.Value, 'confdir',
			_('Configuration Directory'),
			_('Directory where the Hysteria Client configuration file is located.')
		)
		o.optional = true;
		o.placeholder = '/etc/hysteria';

		o = s.taboption('general', form.Value, 'conffile',
			_('Configuration File'),
			_('Hysteria Client configuration file.')
		)
		o.optional = true;
		o.render = function(option_index, section_id, in_table) {
			this.placeholder = section_id + '.yaml';

			return Promise.resolve(this.cfgvalue(section_id))
				.then(this.renderWidget.bind(this, section_id, option_index))
				.then(this.renderFrame.bind(this, section_id, in_table, option_index));
		};

		o = s.taboption('tproxy', form.Flag, 'enabled_tproxy',
			_('Enabled Tproxy'),
			_('Enabled Tproxy Auto config.'));

		o = s.taboption('tproxy', form.Value, 'tproxy_route_table',
			_('Route Table')
		);
		o.depends('enabled_tproxy', '1');
		o.placeholder = "100";

		o = s.taboption('tproxy', form.Value, 'tproxy_mark',
			_('Mark')
		);
		o.depends('enabled_tproxy', '1');
		o.placeholder = "0x1000";

		o = s.taboption('tproxy', form.Value, 'tproxy_user',
			_('User')
		);
		o.depends('enabled_tproxy', '1');
		o.placeholder = "hysteria";

		o = s.taboption('tproxy', form.Value, 'tproxy_port',
			_('Port')
		);
		o.depends('enabled_tproxy', '1');
		o.placeholder = "2500";

		o = s.taboption('tproxy', form.Value, 'tproxy_table',
			_('NFT Table Name')
		);
		o.depends('enabled_tproxy', '1');
		o.render = function(option_index, section_id, in_table) {
			this.placeholder = section_id;

			return Promise.resolve(this.cfgvalue(section_id))
				.then(this.renderWidget.bind(this, section_id, option_index))
				.then(this.renderFrame.bind(this, section_id, in_table, option_index));
		};

		o = s.taboption('tproxy', form.Value, 'tproxy_set',
			_('NFT Table Set')
		);
		o.depends('enabled_tproxy', '1');
		o.placeholder = 'proxy';

		s.taboption('dnsmasq', form.Flag, 'enabled_dnsmasq',
			_('Enabled Dnsmasq'),
			_('Enabled Dnsmasq Auto config.'));

		o = s.taboption('dnsmasq', form.Value, 'dnsmasq_server',
			_('DNS'),
			_('Forward to dns server.')
		);
		o.depends('enabled_dnsmasq', '1');
		o.placeholder = "127.0.0.53";

		o = s.taboption('dnsmasq', form.Value, 'dnsmasq_nftset',
			_('Ntfset'),
			_('ntfset to record proxy address.')
		);
		o.depends('enabled_dnsmasq', '1');
		o.render = function(option_index, section_id, in_table) {
			this.placeholder = '4#ip#' + section_id + "#" + (s.cfgvalue(section_id, 'tproxy_set') || 'proxy');

			return Promise.resolve(this.cfgvalue(section_id))
				.then(this.renderWidget.bind(this, section_id, option_index))
				.then(this.renderFrame.bind(this, section_id, in_table, option_index));
		};

		o = s.taboption('dnsmasq', form.DynamicList, 'dnsmasq_domains',
			_('Domains'),
			_('List of domain names that need to be proxied.')
		);
		o.optional = true;
		o.depends('enabled_dnsmasq', '1');

		return m.render();
	},
});
