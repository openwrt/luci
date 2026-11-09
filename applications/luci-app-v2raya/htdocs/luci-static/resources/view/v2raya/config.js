// SPDX-License-Identifier: Apache-2.0
'use strict';
'require form';
'require uci';
'require view';

return view.extend({
	load: function () {
		return uci.load('v2raya');
	},

	render: function () {
		var m, s, o;

		m = new form.Map('v2raya', _('v2rayA'),
			_('Settings for the v2rayA service. Save & Apply restarts the service so the new values take effect. v2rayA 2.5.x uses only its bundled v2raya_core; Xray-core and sing-box are not supported backends.'));

		s = m.section(form.NamedSection, 'config', 'v2raya');
		s.tab('general', _('General'));
		s.tab('proxy', _('Transparent proxy'),
			_('The transparent proxy mode, routing rules and nodes are configured in the v2rayA web interface. These options control core start-up and hooks.'));
		s.tab('logging', _('Logging'));
		s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enable service'));
		o.default = '0';
		o.rmempty = false;
		o.description = _('Start v2rayA at boot. You can also start or stop it from the overview page.');

		o = s.taboption('general', form.Value, 'address', _('Listening address'));
		o.placeholder = '0.0.0.0:2017';
		o.rmempty = false;
		o.validate = function (section_id, value) {
			if (!value)
				return _('An address is required.');

			if (!/^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9._-]+):[0-9]{1,5}$/.test(value))
				return _('Enter an address and port, for example 0.0.0.0:2017 or [::]:2017.');

			return true;
		};
		o.description = _('The web interface listens on this address. Use 127.0.0.1:2017 to keep it off the LAN.');

		o = s.taboption('general', form.Value, 'baseurl', _('Base URL'));
		o.placeholder = '/';
		o.description = _('URL prefix when v2rayA runs behind a reverse proxy.');
		o.validate = function (section_id, value) {
			if (value && value.charAt(0) !== '/')
				return _('The base URL must start with /.');
			return true;
		};

		o = s.taboption('general', form.ListValue, 'ipv6_support', _('IPv6 support'));
		o.value('auto', _('Auto'));
		o.value('on', _('On'));
		o.value('off', _('Off'));
		o.default = 'auto';
		o.description = _('Make sure IPv6 connectivity works before forcing it on.');

		o = s.taboption('general', form.ListValue, 'nftables_support', _('nftables support'));
		o.value('auto', _('Auto'));
		o.value('on', _('On'));
		o.value('off', _('Off'));
		o.default = 'auto';
		o.description = _('nftables is the default firewall backend on OpenWrt 22.03 and later.');

		o = s.taboption('proxy', form.Value, 'core_startup_timeout', _('Core startup timeout'));
		o.datatype = 'uinteger';
		o.placeholder = '15';
		o.default = '15';
		o.description = _('Seconds to wait for v2raya_core to start. Raise this on slow MIPS routers.');

		o = s.taboption('proxy', form.Flag, 'redirect_respect_bound_device', _('Respect bound devices in redirect mode'));
		o.default = '0';
		o.description = _('Let sockets bound to a device bypass the proxy. Requires Linux 5.14 or later and cgroup v2.');

		o = s.taboption('proxy', form.Value, 'transparent_hook', _('Transparent proxy hook'));
		o.placeholder = '/usr/bin/example-hook';
		o.description = _('Executable called around transparent proxy setup and teardown.');

		o = s.taboption('proxy', form.Value, 'core_hook', _('Core life-cycle hook'));
		o.placeholder = '/usr/bin/example-hook';
		o.description = _('Executable called around v2raya_core start and stop.');

		o = s.taboption('proxy', form.Value, 'plugin_manager', _('Plugin manager'));
		o.placeholder = '/usr/bin/example-plugin-manager';
		o.description = _('Executable used to parse protocols that v2rayA does not know natively.');

		o = s.taboption('logging', form.ListValue, 'log_level', _('Log level'));
		o.value('trace', _('Trace'));
		o.value('debug', _('Debug'));
		o.value('info', _('Info'));
		o.value('warn', _('Warning'));
		o.value('error', _('Error'));
		o.default = 'warn';
		o.description = _('Warning keeps flash writes down. Use Info while debugging.');

		o = s.taboption('logging', form.Value, 'log_max_days', _('Keep logs for'));
		o.datatype = 'uinteger';
		o.placeholder = '1';
		o.default = '1';
		o.description = _('Number of days to keep rotated log files.');

		o = s.taboption('logging', form.Flag, 'log_disable_color', _('Disable colours in the log'));
		o.default = '1';
		o.description = _('The log file is plain text, so colours are not useful there.');

		o = s.taboption('logging', form.Flag, 'log_disable_timestamp', _('Disable timestamps in the log'));
		o.default = '0';
		o.description = _('Only relevant when v2rayA writes to syslog or journald.');

		o = s.taboption('advanced', form.Value, 'v2ray_assetsdir', _('Rule data directory'));
		o.placeholder = '/usr/share/v2ray';
		o.default = '/usr/share/v2ray';
		o.description = _('Directory containing geoip.dat and geosite.dat. Leave empty for auto-detection.');

		o = s.taboption('advanced', form.Value, 'v2ray_bin', _('Core binary (v2raya_core only)'));
		o.placeholder = _('Auto-detect');
		o.description = _('Path to v2raya_core. Leave empty to use the binary next to v2raya or in PATH. Only the matching v2raya_core is supported; Xray-core and sing-box use incompatible configuration formats.');

		o = s.taboption('advanced', form.Value, 'v2ray_confdir', _('Extra configuration directory'));
		o.placeholder = _('None');
		o.description = _('Additional v2ray configuration files merged into the generated configuration.');

		o = s.taboption('advanced', form.Value, 'gomemlimit', _('Go memory limit'));
		o.placeholder = '64MiB';
		o.default = '64MiB';
		o.description = _('Soft memory limit for both v2raya and v2raya_core (GOMEMLIMIT). Use 0 to disable, or 96MiB on a larger router.');

		o = s.taboption('advanced', form.Value, 'gomaxprocs', _('Go scheduler threads'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.default = '2';
		o.description = _('GOMAXPROCS. 0 uses every CPU core; 2 is enough for most routers.');

		o = s.taboption('advanced', form.Value, 'gogc', _('Go GC percent'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.default = '0';
		o.description = _('GOGC. 0 keeps the Go default; lower values use less memory and more CPU.');

		o = s.taboption('advanced', form.Value, 'nofile', _('Open file limit'));
		o.datatype = 'uinteger';
		o.placeholder = '16384';
		o.default = '16384';
		o.description = _('Maximum open file descriptors. 16384 is plenty for a home router and bounds a connection flood.');

		return m.render();
	}
});
