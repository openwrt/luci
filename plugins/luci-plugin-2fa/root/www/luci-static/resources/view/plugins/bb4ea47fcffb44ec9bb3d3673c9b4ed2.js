'use strict';
'require baseclass';
'require form';
'require uci';
'require rpc';
'require uqr';

var CBIQRCode = form.DummyValue.extend({
	renderWidget(section_id) {
		var key = uci.get('luci_plugins', section_id, 'key_root') || '';
		var type = uci.get('luci_plugins', section_id, 'type_root') || 'totp';

		if (!key)
			return E('em', {}, _('Set and save the secret key first to display a QR code.'));

		var issuer = 'OpenWrt';
		var label = 'root';
		var option;

		if (type == 'hotp') {
			var counter = uci.get('luci_plugins', section_id, 'counter_root') || '0';
			option = 'counter=' + counter;
		}
		else {
			var step = uci.get('luci_plugins', section_id, 'step_root') || '30';
			option = 'period=' + step;
		}

		var otpAuth = 'otpauth://' + type + '/' + encodeURIComponent(issuer) + ':' + encodeURIComponent(label) +
			'?secret=' + key + '&issuer=' + encodeURIComponent(issuer) + '&' + option;
		var svg = uqr.renderSVG(otpAuth, { pixelSize: 4 });

		return E('div', {}, [
			E('div', { 'style': 'max-width:260px' }, [ E(svg) ]),
			E('br'),
			E('em', {}, _('Scan this QR code with your authenticator app.')),
			E('br'),
			E('code', { 'style': 'word-break:break-all;font-size:10px;' }, otpAuth)
		]);
	}
});

return baseclass.extend({
	class: 'auth',
	class_i18n: _('Authentication'),

	type: 'login',
	type_i18n: _('Login'),

	name: 'TOTP/HOTP 2FA',
	id: 'bb4ea47fcffb44ec9bb3d3673c9b4ed2',
	title: _('Two-Factor Authentication'),
	description: _('Adds TOTP/HOTP verification as an additional authentication factor for LuCI login.'),

	addFormOptions(s) {
		let o;

		// Tab: Basic Settings
		s.tab('basic', _('Basic Settings'));

		o = s.taboption('basic', form.Flag, 'enabled', _('Enable 2FA'),
			_('Enable two-factor authentication for LuCI login.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'priority', _('Priority'),
			_('Execution order for this plugin. Lower values run earlier.'));
		o.depends('enabled', '1');
		o.datatype = 'integer';
		o.placeholder = '15';
		o.rmempty = true;

		// User configuration section
		o = s.taboption('basic', form.SectionValue, '_users', form.TableSection, 'luci_plugins', _('User Configuration'),
			_('Configure 2FA keys for individual users. The key must be a Base32-encoded secret.'));
		o.depends('enabled', '1');

		var ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = false;
		ss.nodescriptions = true;

		// Since we can't easily enumerate users, provide a simple key configuration
		o = s.taboption('basic', form.Value, 'key_root', _('Secret Key for root'),
			_('Base32-encoded secret key for TOTP/HOTP. Generate using an authenticator app.'));
		o.depends('enabled', '1');
		o.password = true;
		o.rmempty = true;
		o.validate = function(section_id, value) {
			if (!value || value === '')
				return true;
			// Validate Base32 format
			if (!/^[A-Z2-7]+=*$/i.test(value.replace(/\s/g, '')))
				return _('Invalid Base32 format. Use only A-Z and 2-7 characters.');
			return true;
		};

		o = s.taboption('basic', form.ListValue, 'type_root', _('OTP Type for root'),
			_('TOTP (Time-based) is recommended. HOTP (Counter-based) is for special cases.'));
		o.depends('enabled', '1');
		o.value('totp', _('TOTP (Time-based)'));
		o.value('hotp', _('HOTP (Counter-based)'));
		o.default = 'totp';

		o = s.taboption('basic', form.Value, 'step_root', _('TOTP Time Step'),
			_('Time step in seconds for TOTP. Default is 30 seconds.'));
		o.depends({ 'enabled': '1', 'type_root': 'totp' });
		o.placeholder = '30';
		o.datatype = 'uinteger';
		o.rmempty = true;

		o = s.taboption('basic', CBIQRCode, '_qrcode', _('Authenticator QR Code'));
		o.depends('enabled', '1');

		// Tab: Security
		s.tab('security', _('Security'));

		o = s.taboption('security', form.Flag, 'rate_limit_enabled', _('Enable Rate Limiting'),
			_('Limit failed OTP attempts to prevent brute-force attacks.'));
		o.depends('enabled', '1');
		o.default = '1';

		o = s.taboption('security', form.Value, 'rate_limit_max_attempts', _('Max Failed Attempts'),
			_('Maximum failed attempts before lockout.'));
		o.depends('rate_limit_enabled', '1');
		o.placeholder = '5';
		o.datatype = 'uinteger';
		o.rmempty = true;

		o = s.taboption('security', form.Value, 'rate_limit_window', _('Rate Limit Window (seconds)'),
			_('Time window for counting failed attempts.'));
		o.depends('rate_limit_enabled', '1');
		o.placeholder = '60';
		o.datatype = 'uinteger';
		o.rmempty = true;

		o = s.taboption('security', form.Value, 'rate_limit_lockout', _('Lockout Duration (seconds)'),
			_('How long to lock out after too many failed attempts.'));
		o.depends('rate_limit_enabled', '1');
		o.placeholder = '300';
		o.datatype = 'uinteger';
		o.rmempty = true;

		o = s.taboption('security', form.Flag, 'strict_mode', _('Strict Mode'),
			_('Block remote access when system time is not calibrated. LAN access is still allowed.'));
		o.depends('enabled', '1');
		o.default = o.disabled;

		// Tab: Advanced
		s.tab('advanced', _('Advanced'));

		o = s.taboption('advanced', form.Flag, 'ip_whitelist_enabled', _('Enable IP Whitelist'),
			_('Allow bypassing 2FA from trusted IP addresses.'));
		o.depends('enabled', '1');
		o.default = o.disabled;

		o = s.taboption('advanced', form.DynamicList, 'ip_whitelist', _('Whitelisted IPs'),
			_('IP addresses or CIDR ranges that bypass 2FA. Example: 192.168.1.0/24'));
		o.depends('ip_whitelist_enabled', '1');
		o.datatype = 'or(ip4addr, ip6addr, cidr4, cidr6)';
		o.rmempty = true;

		o = s.taboption('advanced', form.Value, 'min_valid_time', _('Minimum Valid Time'),
			_('Unix timestamp before which system time is considered uncalibrated. Default: 2026-01-01.'));
		o.depends('enabled', '1');
		o.placeholder = '1767225600';
		o.datatype = 'uinteger';
		o.rmempty = true;
	},

	configSummary(section) {
		if (section.enabled != '1')
			return null;

		var summary = [];
		
		if (section.key_root)
			summary.push(_('root user configured'));
		
		if (section.rate_limit_enabled == '1')
			summary.push(_('rate limiting on'));
		
		if (section.ip_whitelist_enabled == '1')
			summary.push(_('IP whitelist on'));

		if (section.strict_mode == '1')
			summary.push(_('strict mode'));

		return summary.length ? summary.join(', ') : _('2FA enabled');
	}
});
