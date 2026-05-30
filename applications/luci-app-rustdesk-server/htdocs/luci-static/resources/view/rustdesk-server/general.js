'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';
'require rpc';
'require poll';

/*
 * Constants - only frontend-relevant values
 */
const CONSTANTS = {
	// Default ports (used in placeholders)
	HBBS_DEFAULT_PORT: '21116',
	HBBR_DEFAULT_PORT: '21117',

	// Polling interval (seconds)
	POLL_INTERVAL: 3,

	// Colors for status display
	COLORS: {
		SUCCESS: 'green',
		ERROR: 'red',
		MUTED: 'gray',
		INFO: '#888'
	}
};

/*
 * RPC declarations
 */
const callGetStatus = rpc.declare({
	object: 'luci.rustdesk-server',
	method: 'get_status'
});

const callGetPublicKey = rpc.declare({
	object: 'luci.rustdesk-server',
	method: 'get_public_key'
});

const callGetVersion = rpc.declare({
	object: 'luci.rustdesk-server',
	method: 'get_version'
});

const callRegenerateKey = rpc.declare({
	object: 'luci.rustdesk-server',
	method: 'regenerate_key'
});

const callServiceAction = rpc.declare({
	object: 'luci.rustdesk-server',
	method: 'service_action',
	params: ['action']
});

/*
 * Helper functions
 */
function handleAction(action) {
	return fs.exec_direct('/etc/init.d/rustdesk-server', [action]);
}


/**
 * Shell metacharacters regex - prevents command injection
 */
const SHELL_METACHARS = /[;&|$`(){}[\]<>'"\\!]/;

/**
 * Validates a safe string value (no shell metacharacters)
 * Used for URL and path validation
 * @param {string} value - The value to check
 * @returns {boolean|string} True if safe, error message if not
 */
function containsShellMetachars(value) {
	if (SHELL_METACHARS.test(value))
		return _('Invalid characters detected');
	return true;
}

/**
 * Validates a key string (alphanumeric and base64 characters only)
 * @param {string} section_id - The section ID
 * @param {string} value - The key value
 * @returns {boolean|string} True if valid, error message if invalid
 */
function validateKey(section_id, value) {
	if (!value || value.length === 0)
		return true;
	if (/[^A-Za-z0-9+/=]/.test(value))
		return _('Invalid characters.') + ' ' + _('Only alphanumeric and base64 characters (+/=) allowed.');
	return true;
}

/**
 * Validates a URL (must start with http:// or https://)
 * @param {string} section_id - The section ID
 * @param {string} value - The URL value
 * @returns {boolean|string} True if valid, error message if invalid
 */
function validateURL(section_id, value) {
	if (!value || value.length === 0)
		return true;
	const shellCheck = containsShellMetachars(value);
	if (shellCheck !== true)
		return shellCheck;
	if (!/^https?:\/\//.test(value))
		return _('URL must start with http:// or https://');
	return true;
}


/**
 * Creates a status indicator HTML string
 * @param {boolean} isActive - Whether the status is active/good
 * @param {string} activeText - Text to show when active
 * @param {string} inactiveText - Text to show when inactive
 * @param {string} [suffix] - Optional suffix to append
 * @returns {string} HTML string
 */
function createStatusIndicator(isActive, activeText, inactiveText, suffix) {
	const color = isActive ? CONSTANTS.COLORS.SUCCESS : CONSTANTS.COLORS.ERROR;
	const symbol = isActive ? '●' : '○';
	const text = isActive ? activeText : inactiveText;
	let html = '<span style="color:' + color + '">' + symbol + ' ' + text + '</span>';

	if (suffix) {
		html += ' <small style="color:' + CONSTANTS.COLORS.INFO + '">' + suffix + '</small>';
	}

	return html;
}

/**
 * Creates a checkmark status indicator
 * @param {boolean} isActive - Whether the status is active/good
 * @param {string} activeText - Text to show when active
 * @param {string} inactiveText - Text to show when inactive
 * @returns {string} HTML string
 */
function createCheckIndicator(isActive, activeText, inactiveText) {
	const color = isActive ? CONSTANTS.COLORS.SUCCESS : CONSTANTS.COLORS.MUTED;
	const symbol = isActive ? '✓' : '✗';
	const text = isActive ? activeText : inactiveText;
	return '<span style="color:' + color + '">' + symbol + ' ' + text + '</span>';
}

// Track if key exists globally for button state
let keyExistsGlobal = false;
// Track if any server is enabled in config
let anyServerEnabledGlobal = false;
// Track boot enabled state
let bootEnabledGlobal = false;

return view.extend({
	render() {
		let m, s, o;

		m = new form.Map('rustdesk-server', _('RustDesk Server'),
			_('Remote Desktop Software Server configuration.') +
			' <a href="https://github.com/rustdesk/rustdesk-server" target="_blank">' + _('Server') + '</a> | ' +
			'<a href="https://github.com/rustdesk/rustdesk" target="_blank">' + _('Client') + '</a>');

		/*
			Firewall Notice
		*/
		s = m.section(form.NamedSection, 'firewall_info');
		s.render = () => E('div', { 'class': 'alert-message notice' }, [
			E('h4', {}, _('Firewall Configuration Required')),
			E('p', {}, _('Required ports (when using default settings): TCP 21115-21119, UDP 21116.')),
			E('p', {}, _('Configure in Network → Firewall → Traffic Rules.'))
		]);

		/*
			Status Section (custom render)
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = L.bind((view, section_id) => {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Service Status')),

				// Status Table for HBBS and HBBR
				E('table', { 'class': 'table cbi-section-table', 'id': 'status_table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Component')),
						E('th', { 'class': 'th' }, _('Service Status')),
						E('th', { 'class': 'th' }, _('Binary')),
						E('th', { 'class': 'th' }, _('Enabled'))
					]),
					E('tr', { 'class': 'tr', 'id': 'hbbs_row' }, [
						E('td', { 'class': 'td' }, _('HBBS (ID Server)')),
						E('td', { 'class': 'td', 'id': 'hbbs_status' }, '-'),
						E('td', { 'class': 'td', 'id': 'hbbs_binary' }, '-'),
						E('td', { 'class': 'td', 'id': 'hbbs_enabled' }, '-')
					]),
					E('tr', { 'class': 'tr', 'id': 'hbbr_row' }, [
						E('td', { 'class': 'td' }, _('HBBR (Relay Server)')),
						E('td', { 'class': 'td', 'id': 'hbbr_status' }, '-'),
						E('td', { 'class': 'td', 'id': 'hbbr_binary' }, '-'),
						E('td', { 'class': 'td', 'id': 'hbbr_enabled' }, '-')
					])
				]),

				// Public Key with Regenerate button inline
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Public Key')),
					E('div', { 'class': 'cbi-value-field', 'style': 'display: flex; align-items: center; flex-wrap: wrap; gap: 8px;' }, [
						E('span', { 'id': 'public_key', 'style': 'word-break: break-all; flex: 1; min-width: 200px;' }, '-'),
						E('button', {
							'class': 'btn cbi-button cbi-button-negative',
							'id': 'regenerate_key_btn',
							'disabled': true,
							'title': _('Regenerate the key pair (requires existing key)'),
							'click': (ev) => {
								if (!keyExistsGlobal) {
									ui.addTimeLimitedNotification(null, E('p', _('Cannot regenerate: No public key exists yet.') + ' ' + _('Start the service first to generate the initial key.')), 5000, 'warning');
									return;
								}
								if (!confirm(_('This will regenerate the key pair and restart the service.') + ' ' + _('All existing clients will need to be reconfigured.') + ' ' + _('Continue?'))) {
									return;
								}
								ev.target.disabled = true;
								ev.target.textContent = _('Regenerating...');

								L.resolveDefault(callRegenerateKey(), {}).then((res) => {
									if (res && res.success) {
										ui.addTimeLimitedNotification(null, E('p', _('Keys deleted. Starting service to generate new keys...')), 5000, 'notice');
										// Use RPC to start service for reliable execution
										// Add small delay to ensure service has fully stopped
										return new Promise((resolve) => {
											setTimeout(resolve, 1000);
										}).then(() => L.resolveDefault(callServiceAction('start'), {}));
									} else {
										ui.addTimeLimitedNotification(null, E('p', _('Key regeneration failed: ') + (res.message || 'Could not delete keys')), 5000, 'error');
										throw new Error('Regeneration failed');
									}
								}).then((startRes) => {
									if (startRes && startRes.success) {
										ui.addTimeLimitedNotification(null, E('p', _('Service started with new key')), 5000, 'notice');
									} else if (startRes) {
										ui.addTimeLimitedNotification(null, E('p', _('Service start may have failed. Check status above.')), 5000, 'warning');
									}
								}).catch((err) => {
									if (err.message !== 'Regeneration failed') {
										ui.addTimeLimitedNotification(null, E('p', _('Error: ') + err.message), 5000, 'error');
									}
								}).finally(() => {
									const btn = document.getElementById('regenerate_key_btn');
									if (btn) {
										btn.disabled = !keyExistsGlobal;
										btn.textContent = _('Regenerate Key');
									}
								});
							}
						}, _('Regenerate Key'))
					])
				]),

				// Boot at startup toggle
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Start at Boot')),
					E('div', { 'class': 'cbi-value-field', 'style': 'display: flex; align-items: center; gap: 12px;' }, [
						E('span', { 'id': 'boot_status' }, '-'),
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'id': 'enable_boot_btn',
							'click': (ev) => {
								const action = bootEnabledGlobal ? 'disable' : 'enable';
								ev.target.disabled = true;
								ev.target.textContent = _('Processing...');

								L.resolveDefault(callServiceAction(action), {}).then((res) => {
									if (res && res.success) {
										bootEnabledGlobal = !bootEnabledGlobal;
										ui.addTimeLimitedNotification(null, E('p',
											bootEnabledGlobal ? _('Service enabled at boot') : _('Service disabled at boot')
										), 5000, 'notice');
									} else {
										const errMsg = res.error || res.message || (res.exit_code !== undefined ? 'Exit code: ' + res.exit_code : JSON.stringify(res));
										ui.addTimeLimitedNotification(null, E('p', _('Failed: ') + errMsg), 5000, 'error');
									}
								}).catch((err) => {
									ui.addTimeLimitedNotification(null, E('p', _('Error: ') + err.message), 5000, 'error');
								}).finally(() => {
									const btn = document.getElementById('enable_boot_btn');
									const statusEl = document.getElementById('boot_status');
									if (btn) {
										btn.disabled = false;
										btn.textContent = bootEnabledGlobal ? _('Disable') : _('Enable');
									}
									if (statusEl) {
										statusEl.innerHTML = createCheckIndicator(bootEnabledGlobal, _('Enabled'), _('Disabled'));
									}
								});
							}
						}, _('Loading...'))
					])
				]),

				// Service Control section
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Service Control')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('div', { 'style': 'margin-bottom: 8px;' }, [
							E('button', {
								'class': 'btn cbi-button cbi-button-apply',
								'id': 'start_btn',
								'disabled': true,
								'title': _('Enable ID Server or Relay Server first'),
								'click': (ev) => {
									if (!anyServerEnabledGlobal) {
										ui.addTimeLimitedNotification(null, E('p', _('Cannot start service: Enable the ID Server or Relay Server in the configuration first.') + ' ' + _('Check "Enable ID Server" or "Enable Relay Server" below and click "Save & Apply".')), 5000, 'error');
										return;
									}

									ev.target.disabled = true;
									handleAction('start').then(() => {
										ev.target.disabled = !anyServerEnabledGlobal;
									}).catch((err) => {
										ui.addTimeLimitedNotification(null, E('p', _('Failed to start service: ') + err.message), 5000, 'error');
										ev.target.disabled = !anyServerEnabledGlobal;
									});
								}
							}, _('Start')),
							' ',
							E('button', {
								'class': 'btn cbi-button cbi-button-remove',
								'click': (ev) => {
									ev.target.disabled = true;
									handleAction('stop').then(() => {
										ev.target.disabled = false;
									}).catch((err) => {
										ui.addTimeLimitedNotification(null, E('p', _('Failed to stop service: ') + err.message), 5000, 'error');
										ev.target.disabled = false;
									});
								}
							}, _('Stop')),
							' ',
							E('button', {
								'class': 'btn cbi-button cbi-button-action',
								'click': (ev) => {
									ev.target.disabled = true;
									handleAction('restart').then(() => {
										ev.target.disabled = false;
									}).catch((err) => {
										ui.addTimeLimitedNotification(null, E('p', _('Failed to restart service: ') + err.message), 5000, 'error');
										ev.target.disabled = false;
									});
								}
							}, _('Restart'))
						]),
						// Info message about Start requirement
						E('div', {
							'class': 'cbi-value-description',
							'style': 'color: #666; font-size: 0.9em; margin-top: 4px;'
						}, [
							E('em', {}, [
								_('Start will only work if at least "Enable ID Server" or "Enable Relay Server" is checked in the Configuration section below.')
							])
						])
					])
				])
			]);
		}, o, this);

		/*
			Polling for status updates
		*/
		poll.add(() => {
			return Promise.all([
				L.resolveDefault(callGetStatus(), {}),
				L.resolveDefault(callGetPublicKey(), {}),
				L.resolveDefault(callGetVersion(), {}),
				uci.load('rustdesk-server')
			]).then(([status = {}, keyInfo = {}, verInfo = {}]) => {

				// Get enabled status from UCI
				const sections = uci.sections('rustdesk-server', 'rustdesk-server');
				let hbbsEnabled = false;
				let hbbrEnabled = false;
				if (sections && sections.length > 0) {
					hbbsEnabled = (sections[0].enabled == '1');
					hbbrEnabled = (sections[0].enabled_relay == '1');
				}

				// HBBS Status (Service Status column)
				const hbbsStatusEl = document.getElementById('hbbs_status');
				if (hbbsStatusEl) {
					let suffix = '';
					if (status.hbbs_pid) {
						suffix = '(PID: ' + status.hbbs_pid + ')';
						if (verInfo.hbbs_version) suffix += ' [' + verInfo.hbbs_version + ']';
					}
					hbbsStatusEl.innerHTML = createStatusIndicator(
						!!status.hbbs_pid, _('Running'), _('Stopped'), suffix
					);
				}

				// HBBS Binary column
				const hbbsBinaryEl = document.getElementById('hbbs_binary');
				if (hbbsBinaryEl) {
					hbbsBinaryEl.innerHTML = createCheckIndicator(status.hbbs_exists, _('Found'), _('Not Found'));
				}

				// HBBS Enabled column
				const hbbsEnabledEl = document.getElementById('hbbs_enabled');
				if (hbbsEnabledEl) {
					hbbsEnabledEl.innerHTML = createCheckIndicator(hbbsEnabled, _('Yes'), _('No'));
				}

				// HBBR Status (Service Status column)
				const hbbrStatusEl = document.getElementById('hbbr_status');
				if (hbbrStatusEl) {
					let suffix = '';
					if (status.hbbr_pid) {
						suffix = '(PID: ' + status.hbbr_pid + ')';
						if (verInfo.hbbr_version) suffix += ' [' + verInfo.hbbr_version + ']';
					}
					hbbrStatusEl.innerHTML = createStatusIndicator(
						!!status.hbbr_pid, _('Running'), _('Stopped'), suffix
					);
				}

				// HBBR Binary column
				const hbbrBinaryEl = document.getElementById('hbbr_binary');
				if (hbbrBinaryEl) {
					hbbrBinaryEl.innerHTML = createCheckIndicator(status.hbbr_exists, _('Found'), _('Not Found'));
				}

				// HBBR Enabled column
				const hbbrEnabledEl = document.getElementById('hbbr_enabled');
				if (hbbrEnabledEl) {
					hbbrEnabledEl.innerHTML = createCheckIndicator(hbbrEnabled, _('Yes'), _('No'));
				}

				// Public Key - update global state
				keyExistsGlobal = !!(keyInfo.key_exists && keyInfo.public_key);

				const keyEl = document.getElementById('public_key');
				const regenBtn = document.getElementById('regenerate_key_btn');

				if (keyEl) {
					if (keyInfo.key_exists && keyInfo.public_key) {
						keyEl.innerHTML = '<code style="font-size:0.9em">' + keyInfo.public_key + '</code>' +
							' <button class="btn cbi-button cbi-button-action" onclick="navigator.clipboard.writeText(\'' +
							keyInfo.public_key + '\');this.textContent=\'✓\';setTimeout(()=>this.textContent=\'' + _('Copy') + '\',1000)">' + _('Copy') + '</button>';
					} else {
						keyEl.innerHTML = '<em style="color:' + CONSTANTS.COLORS.MUTED + '">' + _('Not generated yet - start the service') + '</em>';
					}
				}

				// Update regenerate button state
				if (regenBtn) {
					regenBtn.disabled = !keyExistsGlobal;
					if (!keyExistsGlobal) {
						regenBtn.title = _('Start the service first to generate the initial key');
					} else {
						regenBtn.title = _('Regenerate the key pair (will restart service)');
					}
				}

				// Update Start button state based on config
				anyServerEnabledGlobal = hbbsEnabled || hbbrEnabled;
				const startBtn = document.getElementById('start_btn');
				if (startBtn) {
					startBtn.disabled = !anyServerEnabledGlobal;
					if (!anyServerEnabledGlobal) {
						startBtn.title = _('Enable ID Server or Relay Server in Configuration first');
					} else {
						startBtn.title = _('Start the service');
					}
				}

				// Update boot enabled status
				bootEnabledGlobal = status.boot_enabled || false;
				const bootStatusEl = document.getElementById('boot_status');
				const bootBtn = document.getElementById('enable_boot_btn');
				if (bootStatusEl) {
					bootStatusEl.innerHTML = createCheckIndicator(bootEnabledGlobal, _('Enabled'), _('Disabled'));
				}
				if (bootBtn) {
					bootBtn.textContent = bootEnabledGlobal ? _('Disable') : _('Enable');
				}
			});
		}, CONSTANTS.POLL_INTERVAL);

		/*
			Configuration Section
		*/
		s = m.section(form.TypedSection, 'rustdesk-server', _('Configuration'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('hbbs', _('ID Server (hbbs)'));
		s.tab('hbbr', _('Relay Server (hbbr)'));

		/* HBBS Settings */
		o = s.taboption('hbbs', form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.taboption('hbbs', form.Value, 'server_port', _('Port (-p, --port)'));
		o.datatype = 'port';
		o.placeholder = CONSTANTS.HBBS_DEFAULT_PORT;
		o.description = _('Sets the listening port for the ID/Rendezvous server');

		o = s.taboption('hbbs', form.Value, 'server_key', _('Key (-k, --key)'));
		o.description = _('Only allow clients with the same key. If empty, uses auto-generated key');
		o.validate = validateKey;

		o = s.taboption('hbbs', form.DynamicList, 'server_relay_servers', _('Relay Servers (-r, --relay-servers)'));
		o.description = _('Default relay servers. Add one server per entry (hostname or hostname:port)');
		o.datatype = 'or(host,hostport)';

		o = s.taboption('hbbs', form.DynamicList, 'server_rendezvous_servers', _('Rendezvous Servers (-R, --rendezvous-servers)'));
		o.description = _('Additional rendezvous servers. Add one server per entry (hostname or hostname:port)');
		o.datatype = 'or(host,hostport)';

		o = s.taboption('hbbs', form.Value, 'server_mask', _('LAN Mask (--mask)'));
		o.description = _('Determine if the connection comes from LAN. Use CIDR notation.');
		o.placeholder = '192.168.0.0/16';
		o.datatype = 'cidr4';

		o = s.taboption('hbbs', form.Value, 'server_rmem', _('UDP Recv Buffer (-M, --rmem)'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.description = _('Sets UDP receive buffer size (0 = system default)');

		o = s.taboption('hbbs', form.Value, 'server_serial', _('Serial Number (-s, --serial)'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.description = _('Sets configure update serial number');

		o = s.taboption('hbbs', form.Value, 'server_software_url', _('Software Download URL (-u, --software-url)'));
		o.description = _('Sets the download URL of RustDesk software for clients');
		o.validate = validateURL;

		/* HBBS Settings - Environment Variables */
		o = s.taboption('hbbs', form.Flag, 'server_env_always_use_relay', _('ALWAYS_USE_RELAY'));
		o.description = _('Force all connections to use relay servers');
		o.default = o.disabled;

		o = s.taboption('hbbs', form.ListValue, 'server_env_rust_log', _('RUST_LOG'));
		o.description = _('Logging level for the ID server');
		o.value('', _('Default'));
		o.value('error', _('Error'));
		o.value('warn', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.value('trace', _('Trace'));
		o.default = '';

		/* HBBR Settings */
		o = s.taboption('hbbr', form.Flag, 'enabled_relay', _('Enable'));
		o.rmempty = false;

		o = s.taboption('hbbr', form.Value, 'relay_port', _('Port (-p, --port)'));
		o.datatype = 'port';
		o.placeholder = CONSTANTS.HBBR_DEFAULT_PORT;
		o.description = _('Sets the listening port for the relay server');

		o = s.taboption('hbbr', form.Value, 'relay_key', _('Key (-k, --key)'));
		o.description = _('Only allow clients with the same key. If empty, uses auto-generated key');
		o.validate = validateKey;

		/* HBBR Settings - Environment Variables */
		o = s.taboption('hbbr', form.ListValue, 'relay_env_rust_log', _('RUST_LOG'));
		o.description = _('Logging level for the relay server');
		o.value('', _('Default'));
		o.value('error', _('Error'));
		o.value('warn', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.value('trace', _('Trace'));
		o.default = '';

		o = s.taboption('hbbr', form.Value, 'relay_env_limit_speed', _('LIMIT_SPEED'));
		o.datatype = 'uinteger';
		o.description = _('Speed limit per connection in Mb/s (0 = default)');
		o.placeholder = '0';

		o = s.taboption('hbbr', form.Value, 'relay_env_single_bandwidth', _('SINGLE_BANDWIDTH'));
		o.datatype = 'uinteger';
		o.description = _('Bandwidth limit per single connection in MB/s (0 = default)');
		o.placeholder = '0';

		o = s.taboption('hbbr', form.Value, 'relay_env_total_bandwidth', _('TOTAL_BANDWIDTH'));
		o.datatype = 'uinteger';
		o.description = _('Total bandwidth limit in MB/s (0 = default)');
		o.placeholder = '0';

		o = s.taboption('hbbr', form.Value, 'relay_env_downgrade_threshold', _('DOWNGRADE_THRESHOLD'));
		o.datatype = 'uinteger';
		o.description = _('Threshold for connection downgrade');

		o = s.taboption('hbbr', form.Value, 'relay_env_downgrade_start_check', _('DOWNGRADE_START_CHECK'));
		o.datatype = 'uinteger';
		o.description = _('Start check time for connection downgrade');

		return m.render();
	}
});
