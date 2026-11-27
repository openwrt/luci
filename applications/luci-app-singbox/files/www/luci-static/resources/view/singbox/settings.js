'use strict';
// settings.js — advanced config. Sections: Service enable / log level;
// TUN interface (stack, address, MTU, auto_route, strict_route); Clash API
// monitoring; DNS (direct / tunnel / strategy); URL test (interval,
// tolerance, URL); subscription auto-update.

'require view';
'require form';
'require fs';
'require ui';
'require uci';

return view.extend({
	load: function() {
		return uci.load('singbox');
	},

	render: function() {
		var m = new form.Map('singbox', _('sing-box Settings'), _('Advanced configuration for TUN interface, DNS, URL test and monitoring.'));
		this.map = m;

		var s, o;

	s = m.section(form.NamedSection, 'general', 'general', _('Service'));
	o = s.option(form.Flag, 'enabled', _('Enabled'));
	o = s.option(form.ListValue, 'log_level', _('Log Level'));
	o.value('debug', 'Debug');
	o.value('info', 'Info');
	o.value('warn', 'Warning');
	o.value('error', 'Error');
	o.default = 'info';
	o.description = _('sing-box logs to syslog; view them in the Logs tab or with `logread -e sing-box`. Rotation is handled automatically by logd.');

		s = m.section(form.NamedSection, 'general', 'general', _('TUN Interface'));
		o = s.option(form.ListValue, 'stack', _('TCP Stack'));
		o.value('gvisor', 'gVisor (recommended for MIPS)');
		o.value('system', 'System (faster but may not work on all devices)');
		o.default = 'gvisor';

		o = s.option(form.Value, 'tun_address', _('TUN Address'));
		o.default = '172.19.0.1/30';
		o.datatype = 'cidr4';

		o = s.option(form.Value, 'tun_mtu', _('MTU'));
		o.default = '1400';
		o.datatype = 'range(1280,1500)';

		o = s.option(form.Flag, 'auto_route', _('Auto Route'));
		o.default = '1';

		o = s.option(form.Flag, 'strict_route', _('Strict Route'));
		o.default = '1';

		s = m.section(form.NamedSection, 'general', 'general', _('Monitoring (Clash API)'));
		o = s.option(form.Flag, 'clash_api', _('Enable Clash API'));
		o.default = '1';

		o = s.option(form.Value, 'clash_api_port', _('Clash API Port'));
		o.default = '9090';
		o.datatype = 'port';

		s = m.section(form.NamedSection, 'dns', 'dns', _('DNS'));
		o = s.option(form.Value, 'direct_server', _('Direct DNS'));
		o.placeholder = 'auto (use ISP DNS)';
		o.default = 'auto';

		o = s.option(form.Value, 'tunnel_server', _('Tunnel DNS (via VPN)'));
		o.placeholder = '8.8.8.8';
		o.default = '8.8.8.8';
		o.datatype = 'ipaddr';

		o = s.option(form.ListValue, 'strategy', _('DNS Strategy'));
		o.value('prefer_ipv4', 'Prefer IPv4');
		o.value('prefer_ipv6', 'Prefer IPv6');
		o.value('ipv4_only', 'IPv4 Only');
		o.default = 'prefer_ipv4';

		s = m.section(form.NamedSection, 'urltest', 'urltest', _('URL Test (Auto Server Selection)'));
		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';

		o = s.option(form.Value, 'interval', _('Test Interval'));
		o.default = '3m';
		o.placeholder = '3m, 5m, 10m';

		o = s.option(form.Value, 'tolerance', _('Tolerance (ms)'));
		o.default = '50';
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'test_url', _('Test URL'));
		o.default = 'http://www.gstatic.com/generate_204';

		s = m.section(form.TypedSection, 'subscription', _('Subscription'));
		s.anonymous = true;
		o = s.option(form.Flag, 'enabled', _('Auto Update'));
		o = s.option(form.Value, 'url', _('Subscription URL'));
		o.placeholder = 'http://example.com/sub';
		o.datatype = 'url';

		o = s.option(form.Value, 'update_interval', _('Update Interval'));
		o.default = '24h';

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		var map = this.map;
		return map.save.apply(map, mode ? [false, true] : []).then(function() {
			return fs.exec('/usr/share/singbox/generate-config.sh');
		}).then(function(res) {
			if (res.code !== 0) {
				throw new Error(res.stdout || res.stderr || 'Config validation failed');
			}
			return fs.exec('/etc/init.d/sing-box', ['restart']);
		}).then(function() {
			ui.addNotification(null, E('p', _('Settings applied and sing-box restarted')));
		}).catch(function(err) {
			ui.addNotification(null, E('p', { style: 'color:#f44336;' }, _('Error: %s').format(err.message || err)));
		});
	}
});
