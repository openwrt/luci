// SPDX-License-Identifier: GPL-3.0-only
//
// Copyright (C) 2024-2026 Alexey Cluster <cluster@cluster.wtf>

'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require rpc';
'require ui';
'require uci';
'require validation';

// Written by wg-obfuscator-config.sh on every service start, hence tmpfs.
const configFile = '/var/etc/wg-obfuscator.conf';
const initScript = '/etc/init.d/wg-obfuscator';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

// The init script does not name its procd instance, so match on any of them
// rather than hardcoding the generated name.
function getServiceStatus() {
	return L.resolveDefault(callServiceList('wg-obfuscator'), {}).then(res => {
		const service = L.isObject(res) ? res['wg-obfuscator'] : null;
		const instances = L.isObject(service) ? service.instances : null;

		for (const name in instances)
			if (instances[name].running)
				return true;

		return false;
	});
}

function getConfigPresent() {
	return L.resolveDefault(fs.stat(configFile), null).then(stat => stat != null);
}

function countEnabledInstances() {
	return uci.sections('wg-obfuscator', 'wg_obfuscator')
		.filter(section => section.enabled == '1').length;
}

function renderStatus(isRunning, configPresent, enabledCount) {
	const span = '<span style="color:%s"><strong>%s</strong></span>';

	return [
		'%s: %s'.format(_('Service Status'), isRunning
			? span.format('green', _('Running'))
			: span.format('red', _('Stopped'))),
		'%s: %s'.format(_('Configuration'), configPresent
			? span.format('green', _('Exists'))
			: span.format('red', _('Not found'))),
		'%s: %d'.format(_('Enabled instances'), enabledCount)
	].join('&#160;&#160;|&#160;&#160;');
}

function updateStatus() {
	return Promise.all([
		getServiceStatus(),
		getConfigPresent()
	]).then(res => {
		const view = document.getElementById('service_status');

		if (view)
			view.innerHTML = renderStatus(res[0], res[1], countEnabledInstances());
	});
}

function handleRestart() {
	return fs.exec(initScript, ['restart']).then(res => {
		if (res.code === 0)
			ui.addNotification(null, E('p', _('Action completed successfully')), 'info');
		else
			ui.addNotification(null, E('p', _('Action failed')), 'error');
	}).catch(err => {
		ui.addNotification(null, E('p', err.message), 'error');
	});
}

const stubValidator = {
	factory: validation,
	apply(type, value, args) {
		if (value != null)
			this.value = value;

		return validation.types[type].apply(this, args);
	},
	assert(condition) {
		return !!condition;
	}
};

return view.extend({
	load() {
		return uci.load('wg-obfuscator');
	},

	render() {
		let m, s, o;

		// Registered here rather than from the section: Map.save() re-runs the
		// section render, and poll.add() only dedupes on function identity, so
		// every Save & Apply would add another poller.
		poll.add(updateStatus);

		m = new form.Map('wg-obfuscator', _('WireGuard Obfuscator Configuration'),
			_('Configure WireGuard Obfuscator instances to obfuscate WireGuard traffic.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function () {
			return E('div', { class: 'cbi-section', id: 'status_bar' }, [
				E('p', { id: 'service_status' }, _('Collecting data...')),
				E('p', {}, E('button', {
					class: 'cbi-button cbi-button-apply',
					click: ui.createHandlerFn(this, handleRestart)
				}, _('Restart Service')))
			]);
		};

		s = m.section(form.TypedSection, 'wg_obfuscator', _('Instances'),
			_('Configure individual obfuscator instances. Each instance can have different settings.'));
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add instance');

		o = s.option(form.Flag, 'enabled', _('Enable'), _('Enable this instance'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'source_lport', _('Source Port'),
			_('Local port to listen for incoming connections'));
		o.datatype = 'port';
		o.default = '13255';
		o.rmempty = false;

		o = s.option(form.Value, 'target', _('Target'),
			_('Target server in format host:port'));
		o.datatype = 'hostport';
		o.placeholder = 'example.com:13255';
		o.rmempty = false;

		// No default on purpose: a prefilled key would be a shared secret
		// everyone already knows.
		o = s.option(form.Value, 'key', _('Obfuscation Key'),
			_('Key used for obfuscation (must be the same on both sides)'));
		o.password = true;
		o.rmempty = false;

		o = s.option(form.Value, 'source_if', _('Source Interface'),
			_('Interface to bind to (0.0.0.0 for all interfaces)'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';

		o = s.option(form.ListValue, 'masking', _('Masking Type'),
			_('Protocol masking for DPI evasion'));
		o.value('NONE', _('None'));
		o.value('AUTO', _('Auto-detect'));
		o.value('STUN', _('STUN'));
		o.default = 'AUTO';

		o = s.option(form.ListValue, 'verbose', _('Log Level'),
			_('Verbosity level for logging'));
		o.value('ERRORS', _('Errors only'));
		o.value('WARNINGS', _('Warnings'));
		o.value('INFO', _('Info'));
		o.value('DEBUG', _('Debug'));
		o.value('TRACE', _('Trace'));
		o.default = 'INFO';

		o = s.option(form.Value, 'log_file', _('Log File'),
			_('Write the log to this file instead of the system log. Leave empty to keep using the system log (logread). Avoid writing to the router flash memory, use /tmp or an external drive instead.'));
		o.placeholder = '/tmp/wg-obfuscator.log';
		o.validate = function (section_id, value) {
			if (value && !value.startsWith('/'))
				return _('Log file path must be absolute');

			return true;
		};

		o = s.option(form.ListValue, 'log_timestamps', _('Log Timestamps'),
			_('Prefix log lines with a timestamp. Automatic means timestamps are added only when a log file is used, since the system log adds its own.'));
		o.value('AUTO', _('Automatic'));
		o.value('TRUE', _('Always'));
		o.value('FALSE', _('Never'));
		o.default = 'AUTO';

		o = s.option(form.Value, 'max_clients', _('Max Clients'),
			_('Maximum number of concurrent clients'));
		o.datatype = 'range(1,65535)';
		o.default = '1024';

		o = s.option(form.Value, 'idle_timeout', _('Idle Timeout'),
			_('Idle timeout in seconds'));
		o.datatype = 'uinteger';
		o.default = '300';

		o = s.option(form.Value, 'in_timeout', _('Incoming Timeout'),
			_('Same as Idle Timeout, but only counts data received from the target (0 = disabled). Intended for clients: detects a dead or silently blocked server. If the client is still active and static bindings are not used, a new session is created with a fresh outbound UDP port. Useful when DPI bans a particular IP:port pair.'));
		o.datatype = 'uinteger';
		o.default = '0';

		o = s.option(form.Value, 'resolve_interval', _('Resolve Interval'),
			_('Re-resolve the target hostname and hostnames in static bindings every N seconds (0 = only at start and on service reload). A non-zero value also retries a failed resolve at startup instead of exiting. Lookups run in the background and do not stall traffic.'));
		o.datatype = 'uinteger';
		o.default = '0';

		o = s.option(form.Value, 'max_dummy', _('Max Dummy Data'),
			_('Maximum dummy data length for packets (0-255)'));
		o.datatype = 'range(0,255)';
		o.default = '4';

		o = s.option(form.Value, 'fwmark', _('Firewall Mark'),
			_('Mark (SO_MARK) applied to the packets the obfuscator sends, 0 = disabled. Useful together with a routing rule that keeps traffic to the VPN server outside of the tunnel.'));
		o.placeholder = '0xdead';
		o.default = '0';
		o.validate = function (section_id, value) {
			if (!value)
				return true;

			// Same range the daemon accepts: decimal or 0x-prefixed hex, 16 bit.
			if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value))
				return _('Firewall mark must be 0-65535, decimal or 0x hex');

			const parsed = value.slice(0, 2).toLowerCase() === '0x'
				? parseInt(value, 16)
				: parseInt(value, 10);

			if (parsed > 65535)
				return _('Firewall mark must be 0-65535, decimal or 0x hex');

			return true;
		};

		o = s.option(form.Flag, 'allow_clean', _('Allow Non-Obfuscated Clients'),
			_('For servers only: accept clients that send plain (non-obfuscated) WireGuard traffic and forward it as is, in both directions. Disables automatic obfuscation direction detection, so do not enable it on the client side. Not compatible with static bindings.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.TextValue, 'static_bindings', _('Static Bindings'),
			_('Static bindings for two-way mode. Enter each binding as ip:port:localport, one per line.'));
		o.rows = 3;
		o.monospace = true;
		o.placeholder = '1.2.3.4:12883:6670\n5.6.7.8:12083:6679';
		o.validate = function (section_id, value) {
			if (!value)
				return true;

			// The daemon takes a comma separated list and also resolves
			// hostnames here, so accept both separators and any host.
			const bindings = value.split(/[\r\n,]+/)
				.map(binding => binding.trim())
				.filter(binding => binding.length);

			for (const binding of bindings) {
				const parts = binding.split(':');

				if (parts.length != 3)
					return _('Invalid format. Expected: ip:port:localport');

				if (!stubValidator.apply('host', parts[0]))
					return _('Invalid host: %s').format(parts[0]);

				if (!stubValidator.apply('port', parts[1]))
					return _('Invalid remote port: %s').format(parts[1]);

				if (!stubValidator.apply('port', parts[2]))
					return _('Invalid local port: %s').format(parts[2]);
			}

			return true;
		};

		return m.render();
	}
});
