'use strict';
'require view';
'require dom';
'require form';
'require fs';
'require ui';
'require uci';
'require rpc';
'require poll';

const KEY_PUB = '/etc/rustdesk/id_ed25519.pub';
const KEY_PRIV = '/etc/rustdesk/id_ed25519';
const FLEX = 'display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:8px 0';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { 'rustdesk-server': {} }
});

const callRcList = rpc.declare({
	object: 'rc',
	method: 'list',
	params: ['name'],
	expect: { 'rustdesk-server': {} }
});

function init(action) {
	return fs.exec('/etc/init.d/rustdesk-server', [action]).then(res => {
		if (res.code !== 0)
			throw new Error(_('Action %s failed with exit code %d').format(action, res.code));
		return res;
	});
}

function notify(err) {
	ui.addNotification(null, E('p', _('RustDesk Server: %s').format(err.message)), 'error');
}

function ctlButton(view, action, label, style) {
	return E('button', {
		'class': 'btn cbi-button cbi-button-' + style,
		'click': ui.createHandlerFn(view, () => init(action).catch(notify))
	}, label);
}

function validateURL(section_id, value) {
	if (!value || value.length === 0)
		return true;
	if (!/^https?:\/\//.test(value))
		return _('URL must start with http:// or https://');
	return true;
}

function setStatus(node, instance) {
	const running = !!(instance && instance.running);
	dom.content(node, [
		E('span', { 'style': 'color:' + (running ? 'green' : 'red') },
			running ? _('Running') : _('Stopped')),
		running && instance.pid ? ' (PID: ' + instance.pid + ')' : ''
	]);
}

return view.extend({
	load() {
		return Promise.all([
			uci.load('rustdesk-server'),
			L.resolveDefault(fs.exec('/usr/bin/hbbs', ['--version']), {})
		]);
	},

	render(data) {
		let m, s, o, publicKey = '';

		const version = (data[1].stdout || '').trim();
		const hbbsStatus = E('td', { 'class': 'td' }, '-');
		const hbbrStatus = E('td', { 'class': 'td' }, '-');
		const hbbsEnabled = E('td', { 'class': 'td' }, '-');
		const hbbrEnabled = E('td', { 'class': 'td' }, '-');
		const bootStatus = E('span', {}, '-');
		let bootEnabled = false;

		const bootBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': ui.createHandlerFn(this,
				() => init(bootEnabled ? 'disable' : 'enable').catch(notify))
		}, '-');

		const keyNode = E('span', { 'style': 'word-break:break-all' }, '-');

		const copyBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'disabled': true,
			'click': () => navigator.clipboard.writeText(publicKey)
		}, _('Copy'));

		const regenBtn = E('button', {
			'class': 'btn cbi-button cbi-button-negative',
			'disabled': true,
			'click': ui.createHandlerFn(this, () => {
				if (!confirm(_('This will regenerate the key pair and restart the service.') + ' ' +
					_('All existing clients will need to be reconfigured.') + ' ' + _('Continue?')))
					return;

				return init('stop').then(() => Promise.all([
					L.resolveDefault(fs.remove(KEY_PRIV)),
					L.resolveDefault(fs.remove(KEY_PUB))
				])).then(() => init('start')).catch(notify);
			})
		}, _('Regenerate Key'));

		const status = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Status')),
			version ? E('div', { 'class': 'cbi-section-descr' }, version) : null,
			E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Component')),
					E('th', { 'class': 'th' }, _('Service Status')),
					E('th', { 'class': 'th' }, _('Enabled'))
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, _('HBBS (ID Server)')), hbbsStatus, hbbsEnabled
				]),
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, _('HBBR (Relay Server)')), hbbrStatus, hbbrEnabled
				])
			])
		]);

		const control = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Service Control')),
			E('div', { 'style': FLEX }, [
				ctlButton(this, 'start', _('Start'), 'apply'),
				ctlButton(this, 'stop', _('Stop'), 'remove'),
				ctlButton(this, 'restart', _('Restart'), 'action'),
				E('span', { 'style': 'margin-left:16px' }, _('Start at Boot') + ':'),
				bootStatus, bootBtn
			])
		]);

		const key = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Public Key')),
			E('div', { 'class': 'cbi-section-descr' },
				_('Clients need this key together with the ID server address.')),
			E('div', { 'style': FLEX }, [
				keyNode, navigator.clipboard ? copyBtn : null, regenBtn
			])
		]);

		poll.add(() => Promise.all([
			L.resolveDefault(callServiceList('rustdesk-server'), {}),
			L.resolveDefault(callRcList('rustdesk-server'), {}),
			L.resolveDefault(fs.read(KEY_PUB), ''),
			uci.load('rustdesk-server')
		]).then(([service, rc, key]) => {
			const instances = service.instances || {};
			const cfg = uci.sections('rustdesk-server', 'rustdesk-server')[0] || {};

			setStatus(hbbsStatus, instances.hbbs);
			setStatus(hbbrStatus, instances.hbbr);

			hbbsEnabled.textContent = cfg.enabled == '1' ? _('Yes') : _('No');
			hbbrEnabled.textContent = cfg.enabled_relay == '1' ? _('Yes') : _('No');

			bootEnabled = !!rc.enabled;
			bootStatus.textContent = bootEnabled ? _('Enabled') : _('Disabled');
			bootBtn.textContent = bootEnabled ? _('Disable') : _('Enable');

			publicKey = key.trim();
			dom.content(keyNode, publicKey
				? E('code', {}, publicKey)
				: E('em', {}, _('Not generated yet - start the service')));
			copyBtn.disabled = !publicKey;
			regenBtn.disabled = !publicKey;
		}), 5);

		m = new form.Map('rustdesk-server', _('RustDesk Server'),
			_('Remote Desktop Software Server configuration.') +
			' <a href="https://github.com/rustdesk/rustdesk-server" target="_blank">' + _('Server') + '</a> | ' +
			'<a href="https://github.com/rustdesk/rustdesk" target="_blank">' + _('Client') + '</a>');

		s = m.section(form.NamedSection, 'global');
		s.render = () => E([], [status, control, key]);

		s = m.section(form.TypedSection, 'rustdesk-server', _('Configuration'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General'));
		s.tab('hbbs', _('ID Server (hbbs)'));
		s.tab('hbbr', _('Relay Server (hbbr)'));

		/* General Settings */
		o = s.taboption('general', form.Flag, 'open_firewall', _('Open firewall ports'));
		o.description = _('Open the ports of the ID server and of the relay server (TCP and UDP) as configured on the other two tabs, in every firewall zone. fw4 is reloaded when the service starts and stops.');

		/* HBBS Settings */
		o = s.taboption('hbbs', form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.taboption('hbbs', form.Value, 'server_port', _('Port (-p, --port)'));
		o.datatype = 'port';
		o.placeholder = '21116';
		o.description = _('Sets the listening port for the ID/Rendezvous server');

		o = s.taboption('hbbs', form.Value, 'server_key', _('Key (-k, --key)'));
		o.description = _('Only allow clients with the same key. If empty, uses auto-generated key');

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
		o.placeholder = '21117';
		o.description = _('Sets the listening port for the relay server');

		o = s.taboption('hbbr', form.Value, 'relay_key', _('Key (-k, --key)'));
		o.description = _('Only allow clients with the same key. If empty, uses auto-generated key');

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
