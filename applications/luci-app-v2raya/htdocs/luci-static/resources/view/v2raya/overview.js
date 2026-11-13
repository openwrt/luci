// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require fs';
'require poll';
'require rpc';
'require uci';
'require ui';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

function serviceRunning() {
	return L.resolveDefault(callServiceList('v2raya'), {}).then(function (res) {
		var inst = res && res.v2raya && res.v2raya.instances && res.v2raya.instances.v2raya;
		return !!(inst && inst.running);
	});
}

function commandVersion(command, args) {
	return L.resolveDefault(fs.exec(command, args || []), null).then(function (res) {
		if (!res || res.code !== 0 || !res.stdout)
			return null;

		var line = res.stdout.trim().split('\n')[0].trim();
		return line || null;
	});
}

function detectBackends() {
	return L.resolveDefault(fs.exec('/usr/libexec/v2raya-detect', []), null).then(function (res) {
		var info = {};

		if (!res || res.code !== 0)
			return info;

		(res.stdout || '').split('\n').forEach(function (line) {
			var pos = line.indexOf('=');
			if (pos > 0)
				info[line.substring(0, pos)] = line.substring(pos + 1);
		});

		return info;
	});
}

function backendRow(label, path, version, packageFlag, note) {
	var field = [];

	if (path) {
		field.push(E('strong', {}, _('Detected')));
		field.push(' — ', E('code', {}, path));
		if (version)
			field.push(E('div', { class: 'cbi-section-descr' }, version));
	}
	else {
		field.push(E('span', { style: 'color:#777' }, _('Not installed')));
	}

	if (packageFlag === '1')
		field.push(E('div', { class: 'cbi-section-descr' }, _('Package installed')));

	if (note)
		field.push(E('div', { class: 'cbi-section-descr' }, note));

	return E('div', { class: 'cbi-value' }, [
		E('label', { class: 'cbi-value-title' }, label),
		E('div', { class: 'cbi-value-field' }, field)
	]);
}

function parseListenAddress(address) {
	var match = String(address || '').match(/^\[?([^\]]*)\]?:(\d+)$/);
	var host = match ? match[1] : '';
	var port = match ? match[2] : '2017';

	if (!host || host === '0.0.0.0' || host === '::')
		host = window.location.hostname;

	if (host.indexOf(':') !== -1)
		host = '[' + host + ']';

	return { host: host, port: port };
}

function renderStatus(running) {
	var el = document.getElementById('v2raya-status');
	if (!el)
		return;

	el.textContent = running ? _('Running') : _('Stopped');
	el.style.color = running ? '#2e7d32' : '#c62828';
}

function setBusy(button, busy) {
	if (!button)
		return;
	button.disabled = busy;
}

function runAction(action, button) {
	setBusy(button, true);

	return L.resolveDefault(fs.exec('/etc/init.d/v2raya', [ action ]), null).then(function (res) {
		setBusy(button, false);

		if (!res || res.code !== 0) {
			ui.addNotification(null, E('p', {},
				(res && (res.stderr || res.stdout)) || _('The service command failed.')), 'danger');
			return;
		}

		ui.addNotification(null, E('p', {}, _('Service action "%s" completed.').format(action)), 'info');
		return serviceRunning().then(renderStatus);
	}).catch(function (err) {
		setBusy(button, false);
		ui.addNotification(null, E('p', {}, _('Unable to run the service command: %s').format(err)), 'danger');
	});
}

function startService(button) {
	setBusy(button, true);

	return fs.exec('/usr/libexec/luci-app-v2raya/enable', []).then(function (res) {
		if (!res || res.code !== 0) {
			setBusy(button, false);
			ui.addNotification(null, E('p', {},
				(res && (res.stderr || res.stdout)) || _('Could not enable the service.')), 'danger');
			return;
		}

		uci.unload('v2raya');
		return uci.load('v2raya').then(function () {
			return runAction('start', button);
		});
	}).catch(function (err) {
		setBusy(button, false);
		ui.addNotification(null, E('p', {}, _('Could not enable the service: %s').format(err)), 'danger');
	});
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('v2raya'),
			commandVersion('/usr/bin/v2raya', [ '--version' ]),
			commandVersion('/usr/bin/v2raya_core', [ 'version' ]),
			detectBackends()
		]);
	},

	render: function (data) {
		var address = uci.get('v2raya', 'config', 'address') || '0.0.0.0:2017';
		var baseurl = uci.get('v2raya', 'config', 'baseurl') || '/';
		if (baseurl === '')
			baseurl = '/';
		var listen = parseListenAddress(address);
		var weburl = 'http://' + listen.host + ':' + listen.port +
			(baseurl === '/' ? '/' : '/' + baseurl.replace(/^\/+|\/+$/g, '') + '/');

		var serviceVersion = data[1] || _('not detected');
		var coreVersion = data[2] || _('not detected');
		var backends = data[3] || {};
		var detectAvailable = Object.keys(backends).length > 0;
		var enabledServices = (backends.services_enabled || '').split(',').filter(function (name) {
			return name && name !== 'v2raya';
		});

		var backendChildren = [
			E('h3', {}, _('Detected cores and proxy services')),
			E('p', { class: 'cbi-section-descr' },
				_('v2rayA 2.5.x runs only its bundled v2raya_core. Existing Xray-core, v2ray and sing-box installations are detected here so they are not duplicated or replaced; they are never used as the v2rayA backend.'))
		];

		if (detectAvailable) {
			backendChildren.push(
				backendRow(_('v2raya_core (required)'), backends.core_path, backends.core_version, null,
					_('This is the only core v2rayA 2.5.x supports.')),
				backendRow(_('Xray-core'), backends.xray_path, backends.xray_version, backends.xray_package,
					_('Left untouched. Do not point the core binary setting at this.')),
				backendRow(_('v2ray-core'), backends.v2ray_path, backends.v2ray_version, backends.v2ray_package,
					_('Left untouched. Do not point the core binary setting at this.')),
				backendRow(_('sing-box'), backends.singbox_path, backends.singbox_version, backends.singbox_package,
					_('Left untouched. sing-box uses a different configuration format and cannot run v2rayA configs.')),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('Rule data')),
					E('div', { class: 'cbi-value-field' },
						(backends.geoip_present === '1' && backends.geosite_present === '1')
							? _('geoip.dat and geosite.dat are installed')
							: _('Missing. v2rayA downloads the data on first start and needs internet access; install v2ray-geoip and v2ray-geosite for offline use.'))
				]),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('Other proxy services')),
					E('div', { class: 'cbi-value-field' },
						backends.services_present ? backends.services_present.split(',').join(', ') : _('None detected'))
				])
			);
		}
		else {
			backendChildren.push(E('p', { class: 'cbi-section-descr' },
				_('Core and service detection is unavailable. The installed v2raya package does not provide the detection helper; version 2.5.x and later install it.')));
		}

		if (detectAvailable && !backends.core_path)
			backendChildren.push(E('div', { class: 'alert-message warning' },
				_('v2raya_core is missing. Install the v2raya-core package.')));

		if (detectAvailable && backends.old_v2raya_package === '1')
			backendChildren.push(E('div', { class: 'alert-message warning' },
				_('An older v2raya package is still installed. Remove it to avoid duplicate services.')));

		if (detectAvailable && enabledServices.length)
			backendChildren.push(E('div', { class: 'alert-message warning' },
				_('These proxy services are enabled at boot: %s. Run only one transparent-proxy stack, otherwise duplicate firewall rules will conflict.').format(enabledServices.join(', '))));

		var status = E('span', { id: 'v2raya-status', style: 'font-weight:bold' }, _('Checking…'));

		var startBtn = E('button', { class: 'btn cbi-button cbi-button-apply' }, _('Start'));
		var stopBtn = E('button', { class: 'btn cbi-button cbi-button-reset' }, _('Stop'));
		var restartBtn = E('button', { class: 'btn cbi-button cbi-button-action' }, _('Restart'));

		startBtn.addEventListener('click', function () { startService(startBtn); });
		stopBtn.addEventListener('click', function () { runAction('stop', stopBtn); });
		restartBtn.addEventListener('click', function () { runAction('restart', restartBtn); });

		var refresh = function () {
			return serviceRunning().then(renderStatus);
		};

		refresh();
		poll.add(refresh, 5);

		return E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('v2rayA')),
			E('div', { class: 'cbi-map-descr' }, [
				_('A web client for its bundled v2raya_core, with transparent proxy support.'),
				' ',
				E('a', { href: weburl, target: '_blank', rel: 'noreferrer noopener' }, weburl)
			]),
			E('div', { class: 'cbi-section' }, [
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('Service')),
					E('div', { class: 'cbi-value-field' }, status)
				]),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('v2rayA version')),
					E('div', { class: 'cbi-value-field' }, serviceVersion)
				]),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('v2raya_core version')),
					E('div', { class: 'cbi-value-field' }, coreVersion)
				]),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('Listening address')),
					E('div', { class: 'cbi-value-field' }, address)
				]),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('Web interface')),
					E('div', { class: 'cbi-value-field' },
						E('a', { href: weburl, target: '_blank', rel: 'noreferrer noopener' }, _('Open v2rayA')))
				])
			]),
			E('div', { class: 'cbi-section' }, backendChildren),
			E('div', { class: 'cbi-section' }, [
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, _('Actions')),
					E('div', { class: 'cbi-value-field' }, [ startBtn, ' ', stopBtn, ' ', restartBtn ])
				]),
				E('p', { class: 'cbi-section-descr' },
					_('These buttons control the background service. Connecting the proxy is done in the v2rayA web UI with the Connect button.'))
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
