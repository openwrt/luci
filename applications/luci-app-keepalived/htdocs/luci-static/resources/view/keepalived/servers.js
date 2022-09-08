'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('keepalived'),
		]);
	},

	renderVirtualServer: function(m) {
		var s, o;
		var real_servers;

		s = m.section(form.GridSection, 'virtual_server', _('Virtual Server'),
			_('A virtual server is a service configured to listen on a specific virtual IP.') + '<br/>' +
			_('A VIP address migrates from one LVS router to the other during a failover,') +
			_('thus maintaining a presence at that IP address'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		s.tab('general', _('General'));
		s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enable'));
		o.optional = true;
		o.placeholder = 'name';

		o = s.taboption('general', form.Value, 'ipaddr', _('Address'),
			_('Address of the Server'));
		o.datatype = 'ipaddr';

		o = s.taboption('general', form.ListValue, 'protocol', _('Protocol'));
		o.value('TCP');
		o.value('UDP');
		o.default = 'TCP';
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'port', _('Port'),
			_('Server Port'));
		o.rmempty = false;
		o.optional = false;
		o.datatype = 'port';

		o = s.taboption('general', form.Value, 'fwmark', _('Mark'),
			_('Firewall fwmark. Use Virtual server from FWMARK'));
		o.datatype = 'hexstring';

		real_servers = uci.sections('keepalived', 'real_server');
		o = s.taboption('general', form.DynamicList, 'real_server', _('Real Server'));
		if (real_servers != '') {
			for (i = 0; i < real_servers.length; i++) {
				o.value(real_servers[i]['name']);
			}
		}
		o.optional = false;

		o = s.taboption('general', form.Value, 'virtualhost', _('Virtual Host'),
			_('HTTP virtualhost to use for HTTP_GET | SSL_GET'));
		o.datatype = 'hostname';
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'lb_kind', _('Forwarding Method'));
		o.value('NAT');
		o.value('DR');
		o.value('TUN');
		o.default = 'NAT';

		o = s.taboption('advanced', form.Value, 'delay_loop', _('Delay Loop'),
			_('Interval between checks in seconds'));
		o.optional = false;
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'lb_algo', _('Scheduler Algorigthm'));
		o.value('rr', _('Round-Robin'));
		o.value('wrr', _('Weighted Round-Robin'));
		o.value('lc', _('Least-Connection'));
		o.value('wlc', _('Weighted Least-Connection'));
		o.default = 'rr';

		o = s.taboption('advanced', form.Value, 'persistence_timeout', _('Persist Timeout'),
			_('Timeout value for persistent connections'));
		o.datatype = 'uinteger';
		o.default = 50;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'persistence_granularity', _('Persist Granularity'),
			_('Granularity mask for persistent connections'));
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'sorry_server_ip', _('Sorry Server Address'),
			_('Server to be added to the pool if all real servers are down'));
		o.optional = false;
		o.datatype = 'ipaddr';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'sorry_server_port', _('Sorry Server Port'));
		o.optional = false;
		o.datatype = 'port';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'rise', _('Rise'),
			_('Required number of successes for OK transition'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'fail', _('Fail'),
			_('Required number of successes for KO transition'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.modalonly = true;
	},

	renderRealServer: function(m) {
		var s, o;
		var urls;

		s = m.section(form.GridSection, 'real_server', _('Real Servers'),
			_('Real Server to redirect all request'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.optional = false;
		o.placeholder = 'name';

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = true;

		o = s.option(form.Value, 'ipaddr', _('Address'),
			_('Address of the Server'));
		o.rmempty = false;
		o.optional = false;
		o.datatype = 'ipaddr';

		o = s.option(form.Value, 'port', _('Port'),
			_('Server Port'));
		o.rmempty = false;
		o.optional = false;
		o.datatype = 'port';

		o = s.option(form.Value, 'weight', _('Weight'),
			_('Relative weight to use'));
		o.rmempty = false;
		o.optional = false;
		o.placeholder = 1;
		o.datatype = 'uinteger';

		o = s.option(form.ListValue, 'check', _('Check'),
			_('Healthcheckers. Can be multiple of each type'));
		o.value('HTTP_GET');
		o.value('SSL_GET');
		o.value('TCP_CHECK');
		o.value('MISC_CHECK');

		o = s.option(form.Value, 'connect_timeout', _('Connect Timeout'));
		o.datatype = 'uinteger';
		o.depends('check', 'TCP_CHECK'); 

		o = s.option(form.Value, 'connect_port', _('Port'),
			_('Port to connect to'));
		o.datatype = 'port';
		o.depends('check', 'TCP_CHECK'); 

		o = s.option(form.Value, 'misc_path', _('User Check Script'));
		o.datatype = 'file';
		o.depends('check', 'MISC_CHECK'); 

		urls = uci.sections('keepalived', 'url');
		o = s.option(form.DynamicList, 'url', _('URLs'));
		if (urls != '') {
			for (var i = 0; i < urls.length; i++) {
				o.value(urls[i].name);
			}
		}
		o.depends('check', 'HTTP_GET'); 
		o.depends('check', 'SSL_GET'); 

		o = s.option(form.Value, 'retry', _('Retry'));
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'delay_before_retry', _('Delay Before Retry'));
		o.datatype = 'uinteger';
	},

	render: function() {
		var m;

		m = new form.Map('keepalived');

		this.renderVirtualServer(m);
		this.renderRealServer(m);

		return m.render();
	}
});
