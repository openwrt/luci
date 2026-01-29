'use strict';
'require view';
'require form';
'require ui';
'require uci';
'require rpc';
'require uqr';

var callGetConfig = rpc.declare({
	object: '2fa',
	method: 'getConfig',
	expect: { }
});

var callSetConfig = rpc.declare({
	object: '2fa',
	method: 'setConfig',
	params: [
		'enabled', 'type', 'key', 'step', 'counter',
		'ip_whitelist_enabled', 'ip_whitelist',
		'rate_limit_enabled', 'rate_limit_max_attempts',
		'rate_limit_window', 'rate_limit_lockout',
		'strict_mode'
	]
});

var callGenerateKey = rpc.declare({
	object: '2fa',
	method: 'generateKey',
	params: [ 'length' ],
	expect: { key: '' }
});

var callGetCurrentCode = rpc.declare({
	object: '2fa',
	method: 'getCurrentCode',
	params: [ 'username' ],
	expect: { }
});

var callGetRateLimitStatus = rpc.declare({
	object: '2fa',
	method: 'getRateLimitStatus',
	expect: { entries: [] }
});

var callClearRateLimit = rpc.declare({
	object: '2fa',
	method: 'clearRateLimit',
	params: [ 'ip' ]
});

var callClearAllRateLimits = rpc.declare({
	object: '2fa',
	method: 'clearAllRateLimits'
});

var callCheckTimeCalibration = rpc.declare({
	object: '2fa',
	method: 'checkTimeCalibration',
	expect: { }
});

var CBIGenerateOTPKey = form.Value.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		var inputEl = E('input', {
			'id': this.cbid(section_id),
			'type': 'text',
			'class': 'cbi-input-text',
			'value': cfgvalue || '',
			'readonly': true
		});

		return E('div', { 'class': 'cbi-value-field' }, [
			inputEl,
			E('br'),
			E('span', { 'class': 'control-group' }, [
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return callGenerateKey(16).then(function(res) {
							inputEl.value = res.key || res;
							// Trigger change event
							var event = document.createEvent('Event');
							event.initEvent('change', true, true);
							inputEl.dispatchEvent(event);
						});
					})
				}, _('Generate Key'))
			])
		]);
	},

	formvalue: function(section_id) {
		var inputEl = document.getElementById(this.cbid(section_id));
		return inputEl ? inputEl.value : null;
	}
});

// Live TOTP Code Display Widget
var CBICurrentCode = form.DummyValue.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		var key = uci.get('2fa', 'root', 'key') || '';
		var containerDiv = E('div', { 'id': 'current-code-container' });

		if (!key) {
			containerDiv.appendChild(E('em', {}, _('Generate a key first to see the current code')));
			return containerDiv;
		}

		// Time calibration warning div (hidden by default)
		var timeWarningDiv = E('div', { 
			'id': 'time-calibration-warning',
			'style': 'display: none; background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin-bottom: 10px;'
		}, [
			E('strong', { 'style': 'color: #856404;' }, '⚠️ ' + _('Warning: System time not calibrated')),
			E('p', { 'style': 'margin: 5px 0 0 0; color: #856404; font-size: 12px;' }, 
				_('System time appears to be incorrect (before 2026). TOTP codes will not work during login. Please sync system time.'))
		]);
		containerDiv.appendChild(timeWarningDiv);

		var codeDisplay = E('div', { 'class': 'current-code-display', 'style': 'display: flex; align-items: center; gap: 15px;' }, [
			E('span', { 
				'id': 'current-totp-code',
				'style': 'font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 5px; color: #0066cc;'
			}, _('Loading...')),
			E('span', { 
				'id': 'totp-countdown',
				'style': 'font-size: 14px; color: #666;'
			}, '')
		]);

		containerDiv.appendChild(codeDisplay);

		// Use LuCI's poll system for updates
		L.Poll.add(function() {
			var codeEl = document.getElementById('current-totp-code');
			var countdownEl = document.getElementById('totp-countdown');
			var warningEl = document.getElementById('time-calibration-warning');

			if (!codeEl) {
				return;
			}

			return callGetCurrentCode('root').then(function(res) {
				if (res.code && codeEl) {
					codeEl.textContent = res.code;
					
					// Show time calibration warning if needed
					if (warningEl && res.time_calibrated === false) {
						warningEl.style.display = 'block';
						codeEl.style.color = '#999';
						codeEl.style.textDecoration = 'line-through';
					} else if (warningEl) {
						warningEl.style.display = 'none';
						codeEl.style.textDecoration = 'none';
					}
					
					if (res.type === 'totp' && res.time_remaining !== undefined && countdownEl) {
						countdownEl.textContent = _('Expires in %d seconds').format(res.time_remaining);
						
						// Change color when time is running low (only if time is calibrated)
						if (res.time_calibrated !== false) {
							if (res.time_remaining <= 5) {
								codeEl.style.color = '#cc0000';
							} else {
								codeEl.style.color = '#0066cc';
							}
						}
					} else if (res.type === 'hotp' && countdownEl) {
						countdownEl.textContent = _('Counter: %s').format(res.counter || '0');
						codeEl.style.color = '#0066cc';
					}
				}
			}).catch(function(err) {
				if (codeEl) {
					codeEl.textContent = '------';
					codeEl.style.color = '#999';
				}
			});
		}, 1); // Poll every 1 second for smooth TOTP code countdown

		return containerDiv;
	}
});

var CBIQRCode = form.DummyValue.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		var type = uci.get('2fa', 'root', 'type') || 'totp';
		var key = uci.get('2fa', 'root', 'key') || '';
		var issuer = 'OpenWrt';
		var label = 'root';
		var qrDiv = E('div', { 'id': 'qr-code-container' });

		if (!key) {
			qrDiv.appendChild(E('em', {}, _('Generate a key first to see QR code')));
			return qrDiv;
		}

		var option;
		if (type == 'hotp') {
			var counter = uci.get('2fa', 'root', 'counter') || '0';
			option = 'counter=' + counter;
		} else {
			var step = uci.get('2fa', 'root', 'step') || '30';
			option = 'period=' + step;
		}

		var otpauth_str = 'otpauth://' + type + '/' + encodeURIComponent(issuer) + ':' + encodeURIComponent(label) + '?secret=' + key + '&issuer=' + encodeURIComponent(issuer) + '&' + option;

		var svgContent = uqr.renderSVG(otpauth_str, { pixelSize: 4 });
		qrDiv.innerHTML = svgContent;
		
		return E('div', {}, [
			qrDiv,
			E('br'),
			E('em', {}, _('Scan this QR code with your authenticator app')),
			E('br'),
			E('code', { 'style': 'word-break: break-all; font-size: 10px;' }, otpauth_str)
		]);
	}
});

var CBIIPWhitelist = form.DynamicList.extend({
	datatype: 'or(ip4addr,ip6addr,cidr4,cidr6)'
});

var CBIRateLimitStatus = form.DummyValue.extend({
	renderWidget: function(section_id, option_id, cfgvalue) {
		var containerDiv = E('div', { 'id': 'rate-limit-status-container' });
		
		var refreshBtn = E('button', {
			'class': 'cbi-button cbi-button-action',
			'style': 'margin-bottom: 10px;',
			'click': ui.createHandlerFn(this, function() {
				return this.refreshStatus(containerDiv);
			})
		}, _('Refresh'));
		
		var clearAllBtn = E('button', {
			'class': 'cbi-button cbi-button-negative',
			'style': 'margin-left: 10px; margin-bottom: 10px;',
			'click': ui.createHandlerFn(this, function() {
				return callClearAllRateLimits().then(function() {
					ui.addNotification(null, E('p', _('All rate limits cleared.')), 'info');
					return this.refreshStatus(containerDiv);
				}.bind(this));
			})
		}, _('Clear All'));
		
		var statusDiv = E('div', { 'id': 'rate-limit-status-list' }, [
			E('em', {}, _('Click "Refresh" to load rate limit status'))
		]);
		
		return E('div', {}, [
			E('div', {}, [refreshBtn, clearAllBtn]),
			statusDiv
		]);
	},
	
	refreshStatus: function(container) {
		var statusDiv = container.querySelector('#rate-limit-status-list') || container;
		statusDiv.innerHTML = '';
		statusDiv.appendChild(E('em', {}, _('Loading...')));
		
		return callGetRateLimitStatus().then(function(result) {
			statusDiv.innerHTML = '';
			
			if (!result.entries || result.entries.length === 0) {
				statusDiv.appendChild(E('em', {}, _('No rate limit entries.')));
				return;
			}
			
			var table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('IP Address')),
					E('th', { 'class': 'th' }, _('Failed Attempts')),
					E('th', { 'class': 'th' }, _('Status')),
					E('th', { 'class': 'th' }, _('Actions'))
				])
			]);
			
			result.entries.forEach(function(entry) {
				// Backend returns Unix timestamp in seconds, convert to milliseconds for JavaScript Date
				var status = entry.locked ? 
					_('Locked until ') + new Date(entry.locked_until * 1000).toLocaleString() :
					_('Active');
				var statusClass = entry.locked ? 'color: red;' : '';
				
				var clearBtn = E('button', {
					'class': 'cbi-button cbi-button-remove',
					'click': ui.createHandlerFn(this, function() {
						return callClearRateLimit(entry.ip).then(function() {
							ui.addNotification(null, E('p', _('Rate limit cleared for ') + entry.ip), 'info');
							return this.refreshStatus(container);
						}.bind(this));
					}.bind(this))
				}, _('Clear'));
				
				table.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, entry.ip),
					E('td', { 'class': 'td' }, String(entry.attempts)),
					E('td', { 'class': 'td', 'style': statusClass }, status),
					E('td', { 'class': 'td' }, clearBtn)
				]));
			}.bind(this));
			
			statusDiv.appendChild(table);
		}.bind(this)).catch(function(err) {
			statusDiv.innerHTML = '';
			statusDiv.appendChild(E('em', { 'style': 'color: red;' }, _('Error loading status: ') + err.message));
		});
	}
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('2fa'),
			callGetConfig()
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('2fa', _('2-Factor Authentication'),
			_('Configure two-factor authentication for LuCI login. ' +
			  'When enabled, you will need to enter a one-time password from your authenticator app in addition to your username and password.'));

		// ================================================================
		// OTP Settings Section - All OTP-related configuration
		// ================================================================
		s = m.section(form.NamedSection, 'root', 'login', _('OTP Settings'),
			_('Configure your one-time password settings. Generate a secret key and scan the QR code with your authenticator app.'));
		s.anonymous = true;
		s.addremove = false;

		// Tab 1: Basic Settings
		s.tab('basic', _('Basic'));

		// Tab 2: Advanced Settings
		s.tab('advanced', _('Advanced'));

		// === Basic Tab ===

		// Enable 2FA toggle
		// Note: This option reads/writes to 'settings' UCI section but is displayed
		// in the OTP section for better UX. The ucisection override handles this.
		o = s.taboption('basic', form.Flag, 'enabled', _('Enable 2FA'),
			_('Enable two-factor authentication for LuCI login. You must configure a secret key before enabling.'));
		o.rmempty = false;
		o.ucisection = 'settings';

		// Strict Mode checkbox
		o = s.taboption('basic', form.Flag, 'strict_mode', _('Strict Mode'),
			_('Controls behavior when system time appears uncalibrated (before 2026). '
			+'<br>'+_('When ENABLED: Non-LAN IPs are blocked from logging in; IPs from LAN interface subnet bypass 2FA entirely. ')
			+'<br>'+_('When DISABLED: All IPs bypass 2FA when time is uncalibrated (less secure but prevents lockouts).')));
		o.rmempty = false;
		o.ucisection = 'settings';

		// Secret Key
		o = s.taboption('basic', CBIGenerateOTPKey, 'key', _('Secret Key'),
			_('The secret key used to generate OTP codes. Click "Generate Key" to create a new key, then scan the QR code below with your authenticator app.'));

		// Current Code Display
		o = s.taboption('basic', CBICurrentCode, '_current_code', _('Current Code'),
			_('This is the current one-time password generated from your secret key. Use it to verify your authenticator app shows the same code.'));

		// QR Code
		o = s.taboption('basic', CBIQRCode, '_qrcode', _('QR Code'),
			_('Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)'));

		// === Advanced Tab ===

		// OTP Type
		o = s.taboption('advanced', form.ListValue, 'type', _('OTP Type'),
			_('TOTP (Time-based) is recommended for most users. HOTP (Counter-based) can be used in environments without reliable time sync.'));
		o.value('totp', _('TOTP (Time-based) - Recommended'));
		o.value('hotp', _('HOTP (Counter-based)'));
		o.default = 'totp';

		// Time Step (TOTP)
		// Note: Most authenticator apps use 30 seconds. Some may support 15-60 seconds.
		// Values outside this range may not be compatible with common authenticator apps.
		o = s.taboption('advanced', form.Value, 'step', _('Time Step (seconds)'),
			_('Time interval for TOTP code generation. Default is 30 seconds. Most authenticator apps only support 30 seconds.'));
		o.depends('type', 'totp');
		o.default = '30';
		o.datatype = 'range(15,60)';
		o.placeholder = '30';

		// Counter (HOTP)
		o = s.taboption('advanced', form.Value, 'counter', _('Counter'),
			_('Current counter value for HOTP. This increments with each successful login. Only modify if you need to resynchronize with your authenticator.'));
		o.depends('type', 'hotp');
		o.default = '0';
		o.datatype = 'uinteger';

		// ================================================================
		// Security Settings Section - IP Whitelist & Brute Force Protection
		// ================================================================
		var securitySection = m.section(form.NamedSection, 'settings', 'settings', _('Security Settings'),
			_('Configure security policies to protect your login and manage trusted networks.'));
		securitySection.anonymous = true;
		securitySection.addremove = false;

		// Tab 1: IP Whitelist
		securitySection.tab('whitelist', _('IP Whitelist'));

		// Tab 2: Brute Force Protection
		securitySection.tab('bruteforce', _('Brute Force Protection'));

		// === IP Whitelist Tab ===

		o = securitySection.taboption('whitelist', form.Flag, 'ip_whitelist_enabled', _('Enable IP Whitelist'),
			_('Allow specific IP addresses or networks to bypass 2FA authentication. Useful for trusted networks like your home or office LAN.'));
		o.rmempty = false;

		o = securitySection.taboption('whitelist', CBIIPWhitelist, 'ip_whitelist', _('Trusted IP Addresses'),
			_('Enter IP addresses or CIDR ranges that should bypass 2FA. These trusted addresses will only need username and password to log in.'));
		o.depends('ip_whitelist_enabled', '1');
		o.placeholder = '192.168.1.0/24';

		// Whitelist examples
		o = securitySection.taboption('whitelist', form.DummyValue, '_whitelist_examples', _('Examples'));
		o.depends('ip_whitelist_enabled', '1');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div style="color: #666; font-size: 12px;">' +
				'<strong>' + _('Single IP:') + '</strong> 192.168.1.100<br>' +
				'<strong>' + _('Subnet:') + '</strong> 192.168.1.0/24 (' + _('covers 192.168.1.0-255, usable hosts .1-.254') + ')<br>' +
				'<strong>' + _('Larger network:') + '</strong> 10.0.0.0/8<br>' +
				'<strong>' + _('IPv6:') + '</strong> fd00::/8' +
				'</div>';
		};

		// === Brute Force Protection Tab ===

		o = securitySection.taboption('bruteforce', form.Flag, 'rate_limit_enabled', _('Enable Brute Force Protection'),
			_('Protect against automated attacks by temporarily blocking IPs with too many failed login attempts.'));
		o.rmempty = false;

		o = securitySection.taboption('bruteforce', form.Value, 'rate_limit_max_attempts', _('Max Failed Attempts'),
			_('Number of failed login attempts allowed before an IP is temporarily blocked.'));
		o.depends('rate_limit_enabled', '1');
		o.default = '5';
		o.datatype = 'range(1,100)';
		o.placeholder = '5';

		o = securitySection.taboption('bruteforce', form.Value, 'rate_limit_window', _('Detection Window (seconds)'),
			_('Time period during which failed attempts are counted. After this time, the counter resets.'));
		o.depends('rate_limit_enabled', '1');
		o.default = '60';
		o.datatype = 'range(1,3600)';
		o.placeholder = '60';

		o = securitySection.taboption('bruteforce', form.Value, 'rate_limit_lockout', _('Lockout Duration (seconds)'),
			_('How long an IP remains blocked after exceeding the max attempts. Default: 5 minutes (300 seconds).'));
		o.depends('rate_limit_enabled', '1');
		o.default = '300';
		o.datatype = 'range(1,86400)';
		o.placeholder = '300';

		o = securitySection.taboption('bruteforce', CBIRateLimitStatus, '_rate_limit_status', _('Blocked IPs'),
			_('View currently blocked IP addresses and manage rate limits.'));
		o.depends('rate_limit_enabled', '1');

		return m.render();
	}
});
