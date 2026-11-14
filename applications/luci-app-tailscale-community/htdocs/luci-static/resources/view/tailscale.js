'use strict';
'require view';
'require form';
'require rpc';
'require ui';
'require uci';
'require tools.widgets as widgets';

const callGetStatus = rpc.declare({ object: 'tailscale', method: 'get_status' });
const callGetSettings = rpc.declare({ object: 'tailscale', method: 'get_settings' });
const callDoLogin = rpc.declare({ object: 'tailscale', method: 'do_login', params: ['form_data'] });
const callDoLogout = rpc.declare({ object: 'tailscale', method: 'do_logout' });
const callGetSubroutes = rpc.declare({ object: 'tailscale', method: 'get_subroutes' });
const callSetupFirewall = rpc.declare({ object: 'tailscale', method: 'setup_firewall' });
const callGetLogs = rpc.declare({ object: 'tailscale', method: 'get_logs' });
const callSetServiceEnabled = rpc.declare({ object: 'tailscale', method: 'set_service_enabled', params: ['enabled'] });
const callGetFirewallStatus = rpc.declare({ object: 'tailscale', method: 'get_firewall_status' });
let map;
let lastDevicesStatus;

// ui.addTimeLimitedNotification only exists since OpenWrt 24.10. Older
// releases, 23.05 included, only have addNotification and would throw on every
// call, so fade the notice out ourselves there.
function notifyTimed(title, children, timeout, ...classes) {
	if (typeof ui.addTimeLimitedNotification == 'function')
		return ui.addTimeLimitedNotification(title, children, timeout, ...classes);

	const msg = ui.addNotification(title, children, ...classes);

	if (typeof timeout == 'number' && timeout > 0 && msg) {
		window.setTimeout(function() {
			msg.classList.add('fade-out');
			msg.classList.remove('fade-in');
			window.setTimeout(function() {
				if (msg.parentNode)
					msg.parentNode.removeChild(msg);
			}, 250);
		}, timeout);
	}

	return msg;
}

// uci.changes() returns an object keyed by config name; count the entries so
// the firewall button can warn about unsaved work.
function countPending(changes) {
	if (changes == null)
		return 0;
	if (Array.isArray(changes))
		return changes.length;
	let count = 0;
	for (const key in changes)
		count += Array.isArray(changes[key]) ? changes[key].length : 1;
	return count;
}

// The ucode methods report business failures as { error: ... } in a *successful*
// ubus reply, so rpc.declare's rejection never fires for them. Every consumer of
// a write operation has to unwrap the reply itself; without this the UI happily
// shows "applied" for a reply that only says { error: '...' }.
function unwrapRpc(res, action) {
	const what = action || _('Operation');
	if (res == null)
		throw new Error(_('Empty reply from server'));
	if (res.error)
		throw new Error(String(res.error));
	if (res.success === false || res.ok === false) {
		if (res.message)
			throw new Error(String(res.message));
		throw new Error(_('%s failed').format(what));
	}
	return res;
}

const tailscaleSettingsConf = [
	[form.Flag, 'service_enabled', _('Enable Tailscale Service'), _('Enable or disable the Tailscale service. When disabled, the service will be stopped and the process will be killed.'), { rmempty: false }],
	[form.ListValue, 'fw_mode', _('Firewall Mode'), _('Select the firewall backend for Tailscale to use. Requires service restart to take effect.'), {values: ['nftables','iptables'],rmempty: false}],
	[form.Flag, 'accept_routes', _('Accept Routes'), _('Allow accepting routes announced by other nodes.'), { rmempty: false }],
	[form.Flag, 'advertise_exit_node', _('Advertise Exit Node'), _('Declare this device as an Exit Node.'), { rmempty: false }],
	[form.Flag, 'exit_node_allow_lan_access', _('Allow LAN Access'), _('When using the exit node, access to the local LAN is allowed.'), { rmempty: false }],
	[form.Flag, 'runwebclient', _('Enable Web Interface'), _('Expose a web interface on port 5252 for managing this node over Tailscale.'), { rmempty: false }],
	[form.Flag, 'nosnat', _('Disable SNAT'), _('Disable Source NAT (SNAT) for traffic to advertised routes. Most users should leave this unchecked.'), { rmempty: false }],
	[form.Flag, 'shields_up', _('Shields Up'), _('When enabled, blocks all inbound connections from the Tailscale network.'), { rmempty: false }],
	[form.Flag, 'ssh', _('Enable Tailscale SSH'), _('Allow connecting to this device through the SSH function of Tailscale.'), { rmempty: false }],
	[form.ListValue, 'dns_mode', _('DNS Mode'), _('Controls how Tailscale DNS is handled.')+'<br>'+_('Disabled: system DNS only.')+'<br>'+_('MagicDNS: Tailscale overrides resolv.conf.')+'<br>'+_('OpenWrt Forward: MagicDNS via dnsmasq forwarding.(Only support ts.net)'), { values: [['disabled', _('Disabled')], ['magicdns', 'MagicDNS'], ['openwrt_forward', _('OpenWrt Forward')]], rmempty: false }],
	[form.Flag, 'disable_fw_config', _('Disable Firewall Configuration'), _('Disable Tailscale netfilter auto-configuration (--netfilter-mode=off).'), { rmempty: false }],
	[form.Flag, 'enable_relay', _('Enable Peer Relay'), _('Enable this device as a Peer Relay server. Requires a public IP and an UDP port open on the router.'), { rmempty: false }]
];

const accountConf = [];	// dynamic created in render function

const daemonConf = [
	//[form.Value, 'daemon_mtu', _('Daemon MTU'), _('Set a custom MTU for the Tailscale daemon. Leave blank to use the default value.'), { datatype: 'uinteger', placeholder: '1280' }, { rmempty: false }],
	[form.Flag, 'daemon_reduce_memory', _('(Experimental) Reduce Memory Usage'), _('Enabling this option can reduce memory usage, but it may sacrifice some performance (set GOGC=10).'), { rmempty: false }]
];

const derpMapUrl = 'https://controlplane.tailscale.com/derpmap/default';
let regionCodeMap = {};

// this function copy from luci-app-frpc. thx
function setParams(o, params) {
	if (!params) return;

	for (const [key, val] of Object.entries(params)) {
		if (key === 'values') {
			[].concat(val).forEach(v =>
				o.value.apply(o, Array.isArray(v) ? v : [v])
			);
		} else if (key === 'depends') {
			const arr = Array.isArray(val) ? val : [val];
			o.deps = arr.map(dep => Object.assign({}, ...o.deps, dep));
		} else {
			o[key] = val;
		}
	}

	if (params.datatype === 'bool')
		Object.assign(o, { enabled: 'true', disabled: 'false' });
}

// this function copy from luci-app-frpc. thx
function defTabOpts(s, t, opts, params) {
	for (let i = 0; i < opts.length; i++) {
		const opt = opts[i];
		const o = s.taboption(t, opt[0], opt[1], opt[2], opt[3]);
		setParams(o, opt[4]);
		setParams(o, params);
	}
}

function getRunningStatus() {
	return L.resolveDefault(callGetStatus(), { status: 'stopped', peers: {} }).then(function (res) {
		return res;
	});
}

// Map.save() re-renders the form after every save, so registering the status
// poller from s.render would add another 10 second get_status loop per save and
// never remove the previous ones. The poller is therefore module level and
// guarded by a flag; the flag is the only dedup mechanism on purpose, the
// poller function reference is never compared.
let statusPollerRegistered = false;

function pollRunningStatus() {
	return getRunningStatus().then(function (res) {
		const view = document.getElementById("service_status_display");
		if (view) {
			const content = renderStatus(res);
			view.replaceChildren(content);
		}

		lastDevicesStatus = res;
		const devicesTbody = document.getElementById("tailscale_devices_tbody");
		if (devicesTbody) {
			const filterInput = document.getElementById("tailscale_devices_filter");
			const currentQuery = filterInput ? filterInput.value : '';
			devicesTbody.replaceChildren(...renderPeerRows(res, currentQuery));
		}

		// login button only available when logged out
		const login_btn=document.getElementsByClassName('cbi-button cbi-button-apply')[0];
		if(login_btn) { login_btn.disabled=(res.status != 'logout'); }
	});
}

function ensureStatusPoller() {
	if (statusPollerRegistered)
		return;

	statusPollerRegistered = true;
	L.Poll.add(function () { return pollRunningStatus(); }, 10);
}

// Poll the background firewall job until it finishes. A poll that fails
// (network reloading, the connection dropped for a moment) is expected and is
// simply retried on the next tick instead of being reported as an error.
function pollFirewallJob(runId, timeoutSec) {
	const deadline = Date.now() + (timeoutSec || 30) * 1000;

	return new Promise(function(resolve, reject) {
		let lastState = '';
		let finished = false;

		function stop() {
			if (finished)
				return false;
			finished = true;
			clearTimeout(timer);
			L.Poll.remove(poll);
			return true;
		}

		function giveUp(message) {
			if (stop())
				reject(new Error(message));
		}

		function check() {
			if (finished)
				return Promise.resolve();

			if (Date.now() > deadline) {
				giveUp(_('Timed out waiting for the firewall reload'));
				return Promise.resolve();
			}

			return callGetFirewallStatus().then(function(res) {
				if (finished)
					return;

				// a result from an earlier run is not this run's answer
				if (runId && res?.run_id && res.run_id !== runId)
					return;

				const state = res?.state || 'unknown';

				if (state === 'done') {
					if (stop())
						notifyTimed(null, [ E('p', _('Firewall configuration applied.')) ], 5000, 'info');
					resolve(res);
					return;
				}

				if (state === 'failed') {
					giveUp(res?.message || _('Firewall reload failed'));
					return;
				}

				if (state === 'busy') {
					giveUp(res?.message || _('Another firewall reload is already running'));
					return;
				}

				if (state !== lastState) {
					lastState = state;
					if (state === 'running' && res?.step === 'firewall')
						notifyTimed(null, [ E('p', _('Reloading firewall...')) ], 3000, 'info');
				}
			});
		}

		function poll() {
			if (finished)
				return Promise.resolve();
			// a dropped connection during the reload is expected: leave it to
			// the next tick, the timer below still guarantees termination
			return check().catch(function() {});
		}

		// L.Poll skips a tick while the previous call is still pending, so a
		// request that never settles would stop the polling loop entirely.
		// The timer is what actually ends the wait.
		const timer = setTimeout(function() {
			giveUp(_('Timed out waiting for the firewall reload'));
		}, (timeoutSec || 30) * 1000);

		L.Poll.add(poll, 2);
		poll();
	});
}

function formatBytes(bytes) {
	const bytes_num = parseInt(bytes, 10);
	if (isNaN(bytes_num) || bytes_num === 0) return '-';
	const k = 1000;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes_num) / Math.log(k));
	return parseFloat((bytes_num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatLastSeen(d) {
	if (!d) return _('N/A');
	if (d === '0001-01-01T00:00:00Z') return _('Now');
	const t = new Date(d);
	if (isNaN(t)) return _('Invalid Date');
	const diff = (Date.now() - t) / 1000;
	if (diff < 0) return t.toLocaleString();
	if (diff < 60) return _('Just now');

	const mins = diff / 60, hrs = mins / 60, days = hrs / 24;
	const fmt = (n, s, p) => `${Math.floor(n)} ${Math.floor(n) === 1 ? _(s) : _(p)} ${_('ago')}`;

	if (mins < 60) return fmt(mins, 'minute', 'minutes');
	if (hrs < 24) return fmt(hrs, 'hour', 'hours');
	if (days < 30) return fmt(days, 'day', 'days');

	return t.toISOString().slice(0, 10);
}

async function initializeRegionMap() {
	const cacheKey = 'tailscale_derp_map_cache';
	const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

	try {
		const cachedItem = localStorage.getItem(cacheKey);
		if (cachedItem) {
			const cached = JSON.parse(cachedItem);
			// Check if the cached data is still valid (not expired)
			if (Date.now() - cached.timestamp < ttl) {
				regionCodeMap = cached.data;
				return;
			}
		}
	} catch (e) {
		notifyTimed(null, [ E('p', _('Error reading cached DERP region map: %s').format(e.message || _('Unknown error'))) ], 7000, 'error');
	}

	// If no valid cache, fetch from the network
	try {
		const response = await fetch(derpMapUrl);
		if (!response.ok) {
			return;
		}
		const data = await response.json();
		const newRegionMap = {};
		for (const regionId in data.Regions) {
			const region = data.Regions[regionId];
			const code = (region.RegionCode || '').toLowerCase();
			const name = region.RegionName || region.RegionCode || `Region ${regionId}`;
			newRegionMap[code] = name;
		}
		regionCodeMap = newRegionMap;

		// Save the newly fetched data to the cache
		try {
			const itemToCache = {
				timestamp: Date.now(),
				data: regionCodeMap
			};
			localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
		} catch (e) {
			notifyTimed(null, [ E('p', _('Error caching DERP region map: %s').format(e.message || _('Unknown error'))) ], 7000, 'error');
		}
	} catch (error) {
		notifyTimed(null, [ E('p', _('Error fetching DERP region map: %s').format(error.message || _('Unknown error'))) ], 7000, 'error');
	}
}

function formatConnectionInfo(info) {
	if (!info) { return '-'; }
	if (typeof info === 'string' && info.length === 3) {
		const lowerCaseInfo = info.toLowerCase();
		return regionCodeMap[lowerCaseInfo] || info;
	}
	return info;
}

function renderStatus(status) {
	// If status object is not yet available, show a loading message.
	if (!status || !status.hasOwnProperty('status')) {
		return E('em', {}, _('Collecting data ...'));
	}

	const notificationId = 'tailscale_health_notification';
	let notificationElement = document.getElementById(notificationId);
	if (status.health != '') {
		const message = _('Tailscale Health Check: %s').format(status.health);
		if (notificationElement) {
			notificationElement.textContent = message;
		}
		else {
			let newNotificationContent = E('p', { 'id': notificationId }, message);
			ui.addNotification(null, newNotificationContent, 'info');
		}
	}else{
		try{
			notificationElement.parentNode.parentNode.remove();
		}catch(e){}
	}

	if (Object.keys(regionCodeMap).length === 0) {
		initializeRegionMap();
	}

	// --- Part 1: Handle non-running states ---

	// State: Tailscale binary not found.
	if (status.status == 'not_installed') {
		return E('dl', { 'class': 'cbi-value' }, [
			E('dt', {}, _('Service Status')),
			E('dd', {}, E('span', { 'style': 'color:red;' }, E('strong', {}, _('TAILSCALE NOT FOUND'))))
		]);
	}

	// State: Logged out, requires user action.
	if (status.status == 'logout') {
		return E('dl', { 'class': 'cbi-value' }, [
			E('dt', {}, _('Service Status')),
			E('dd', {}, [
				E('span', { 'style': 'color:orange;' }, E('strong', {}, _('LOGGED OUT'))),
				E('br'),
				E('span', {}, _('Please use the login button in the settings below to authenticate.'))
			])
		]);
	}

	// State: Service is installed but not running.
	if (status.status != 'running') {
		return E('dl', { 'class': 'cbi-value' }, [
			E('dt', {}, _('Service Status')),
			E('dd', {}, E('span', { 'style': 'color:red;' }, E('strong', {}, _('NOT RUNNING'))))
		]);
	}

	// --- Part 2: Render the full status display for a running service ---

	// A helper array to define the data for the main status table.
	const statusData = [
		{ label: _('Service Status'), value: E('span', { 'style': 'color:green;' }, E('strong', {}, _('RUNNING'))) },
		{ label: _('Version'), value: status.version || 'N/A' },
		{ label: _('TUN Mode'), value: status.TUNMode ? _('Enabled') : _('Disabled') },
		{ label: _('Tailscale IPv4'), value: status.ipv4 || 'N/A' },
		{ label: _('Tailscale IPv6'), value: status.ipv6 || 'N/A' },
		{ label: _('Tailnet Name'), value: status.domain_name || 'N/A' }
	];

	// Build the horizontal status table using the data array.
	const statusTable = E('table', { 'style': 'width: 100%; border-spacing: 0 5px;' }, [
		E('tr', {}, statusData.map(item => E('td', { 'style': 'padding-right: 20px;' }, E('strong', {}, item.label)))),
		E('tr', {}, statusData.map(item => E('td', { 'style': 'padding-right: 20px;' }, item.value)))
	]);

	return statusTable;
}

function renderLogs(logs_data) {
	if (!logs_data || !logs_data.logs || logs_data.logs.length === 0) {
		return E('em', {}, _('No tailscale-related logs found.'));
	}

	const lines = logs_data.logs.map(function(line) {
		return E('div', { 'style': 'white-space: pre; font-family: monospace; font-size: 13px; line-height: 1.5;' }, line);
	});

	return E('div', {
		'style': 'max-height: 500px; overflow-y: auto; background: #f5f5f5; border: 1px solid #ccc; padding: 8px; border-radius: 3px;'
	}, lines);
}

function renderPeerRows(status, query) {
	if (!status || !status.hasOwnProperty('status')) {
		return [E('tr', { 'class': 'cbi-section-table-row' }, [
			E('td', { 'class': 'cbi-value-field', 'colspan': 8 }, E('em', {}, _('Collecting data ...')))
		])];
	}

	if (status.status != 'running') {
		return [E('tr', { 'class': 'cbi-section-table-row' }, [
			E('td', { 'class': 'cbi-value-field', 'colspan': 8 }, E('em', {}, _('Tailscale status error')))
		])];
	}

	if (Object.keys(regionCodeMap).length === 0) {
		initializeRegionMap();
	}

	const peers = status.peers;
	if (!peers || Object.keys(peers).length === 0) {
		return [E('tr', { 'class': 'cbi-section-table-row' }, [
			E('td', { 'class': 'cbi-value-field', 'colspan': 8 }, E('p', {}, _('No peer devices found.')))
		])];
	}

	const q = (query || '').toLowerCase().trim();
	const td_style = 'padding-right: 20px;';
	const rows = [];

	for (const id in peers) {
		const peer = peers[id];
		const hostname = peer.hostname || '';
		const ip = peer.ip || '';
		const ostype = peer.ostype || '';

		if (q && !hostname.toLowerCase().includes(q) &&
			!ip.toLowerCase().includes(q) &&
			!ostype.toLowerCase().includes(q)) {
			continue;
		}

		rows.push(E('tr', { 'class': 'cbi-rowstyle-1' }, [
			E('td', { 'class': 'cbi-value-field', 'style': td_style },
				E('span', {
					'style': `color:${peer.exit_node ? 'blue' : (peer.online ? 'green' : 'gray')};`,
					'title': (peer.exit_node ? _('Exit Node') + ' ' : '') + (peer.online ? _('Online') : _('Offline'))
				}, peer.online ? '●' : '○')
			),
			E('td', { 'class': 'cbi-value-field', 'style': td_style }, E('strong', {}, hostname + (peer.exit_node_option ? ' (ExNode)' : ''))),
			E('td', { 'class': 'cbi-value-field', 'style': td_style }, ip || 'N/A'),
			E('td', { 'class': 'cbi-value-field', 'style': td_style }, ostype || 'N/A'),
			E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatConnectionInfo(peer.linkadress || '-')),
			E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatBytes(peer.rx)),
			E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatBytes(peer.tx)),
			E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatLastSeen(peer.lastseen))
		]));
	}

	if (rows.length === 0) {
		return [E('tr', { 'class': 'cbi-section-table-row' }, [
			E('td', { 'class': 'cbi-value-field', 'colspan': 8 }, E('p', {}, _('No matching peer devices found.')))
		])];
	}

	return rows;
}

function renderDevices(status) {
	const peerTableHeaders = [
		{ text: _('Status'), style: 'width: 80px;' },
		{ text: _('Hostname') },
		{ text: _('Tailscale IP') },
		{ text: _('OS') },
		{ text: _('Connection Info') },
		{ text: _('RX') },
		{ text: _('TX') },
		{ text: _('Last Seen') }
	];

	const thead = E('thead', {}, [
		E('tr', {
			'class': 'tr cbi-section-table-titles',
			'style': 'position: sticky; top: 0; z-index: 10; background-color: var(--background-color, #fff);'
		}, peerTableHeaders.map(function(header) {
			let th_style = 'padding-right: 20px; text-align: left;';
			if (header.style) {
				th_style += header.style;
			}
			return E('th', { 'class': 'th cbi-table-cell', 'style': th_style }, header.text);
		}))
	]);

	const tbody = E('tbody', { 'id': 'tailscale_devices_tbody' }, renderPeerRows(status, ''));

	const table = E('table', { 'class': 'table cbi-table' }, [
		thead,
		tbody
	]);

	const tableContainer = E('div', {
		'id': 'tailscale_devices_table_container',
		'style': 'max-height: 480px; overflow-y: auto; overflow-x: auto;'
	}, [table]);

	const searchInput = E('input', {
		'id': 'tailscale_devices_filter',
		'type': 'text',
		'class': 'cbi-input-text',
		'placeholder': _('Filter peers by name, IP, or OS...'),
		'style': 'width: 100%; box-sizing: border-box;'
	});

	searchInput.addEventListener('input', function() {
		const targetBody = document.getElementById('tailscale_devices_tbody');
		if (targetBody && lastDevicesStatus) {
			targetBody.replaceChildren(...renderPeerRows(lastDevicesStatus, this.value));
		}
	});

	const filterContainer = E('div', {
		'style': 'display: flex; align-items: center; gap: 0.5em; margin-bottom: 0.5em;'
	}, [
		E('label', {
			'for': 'tailscale_devices_filter',
			'style': 'white-space: nowrap; font-weight: bold;'
		}, _('Filter:')),
		E('div', { 'style': 'flex: 1;' }, [searchInput])
	]);

	return E('div', { 'style': 'width: 100%;' }, [
		filterContainer,
		tableContainer
	]);
}

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(callGetStatus(), { status: 'stopped', peers: {} }),
			L.resolveDefault(callGetSettings(), { accept_routes: false }),
			L.resolveDefault(callGetSubroutes(), { routes: [] })
		])
		.then(function([status, settings_from_rpc, subroutes]) {
			return uci.load('tailscale').then(function() {
				if (uci.get('tailscale', 'settings') === null) {
					// No existing settings found; initialize UCI with RPC settings
					uci.add('tailscale', 'settings', 'settings');
					uci.set('tailscale', 'settings', 'service_enabled', '1');
					uci.set('tailscale', 'settings', 'fw_mode', 'nftables');
					uci.set('tailscale', 'settings', 'accept_routes', (settings_from_rpc.accept_routes ? '1' : '0'));
					uci.set('tailscale', 'settings', 'advertise_exit_node', ((settings_from_rpc.advertise_exit_node || false) ? '1' : '0'));
					uci.set('tailscale', 'settings', 'advertise_routes', (settings_from_rpc.advertise_routes || []).join(', '));
					uci.set('tailscale', 'settings', 'exit_node', settings_from_rpc.exit_node || '');
					uci.set('tailscale', 'settings', 'exit_node_allow_lan_access', ((settings_from_rpc.exit_node_allow_lan_access || false) ? '1' : '0'));
					uci.set('tailscale', 'settings', 'ssh', ((settings_from_rpc.ssh || false) ? '1' : '0'));
					uci.set('tailscale', 'settings', 'shields_up', ((settings_from_rpc.shields_up || false) ? '1' : '0'));
					uci.set('tailscale', 'settings', 'runwebclient', ((settings_from_rpc.runwebclient || false) ? '1' : '0'));
					uci.set('tailscale', 'settings', 'nosnat', ((settings_from_rpc.nosnat || false) ? '1' : '0'));
					uci.set('tailscale', 'settings', 'dns_mode', 'disabled');
					uci.set('tailscale', 'settings', 'disable_fw_config', '0');

					uci.set('tailscale', 'settings', 'daemon_reduce_memory', '0');
					uci.set('tailscale', 'settings', 'daemon_mtu', '');
					return uci.save();
				}
			}).then(function() {
				// Migrate from old disable_magic_dns to dns_mode if needed
				if (uci.get('tailscale', 'settings', 'dns_mode') === null) {
					var oldMagicDns = uci.get('tailscale', 'settings', 'disable_magic_dns');
					uci.set('tailscale', 'settings', 'dns_mode', oldMagicDns === '1' ? 'disabled' : 'magicdns');
					uci.unset('tailscale', 'settings', 'disable_magic_dns');
					return uci.save();
				}
			}).then(function() {
				return [status, settings_from_rpc, subroutes];
			});
		});
	},

	render ([status = {}, settings = {}, subroutes_obj]) {
		const subroutes = (subroutes_obj && subroutes_obj.routes) ? subroutes_obj.routes : [];

		let s;
		map = new form.Map('tailscale', _('Tailscale'), _('Tailscale is a mesh VPN solution that makes it easy to connect your devices securely. This configuration page allows you to manage Tailscale settings on your OpenWrt device.'));

		s = map.section(form.NamedSection, '_status');
		s.anonymous = true;
		s.render = function (section_id) {
			// Registering is idempotent and must not affect what is rendered.
			ensureStatusPoller();

			return E('div', { 'id': 'service_status_display', 'class': 'cbi-value' },
				_('Collecting data ...')
			);
		}

		// Bind settings to the 'settings' section of uci
		s = map.section(form.NamedSection, 'settings', 'settings', null);
		s.dynamic = true;

		// Create the "General Settings" tab and apply tailscaleSettingsConf
		s.tab('general', _('General Settings'));

		defTabOpts(s, 'general', tailscaleSettingsConf, { optional: false });

		const relayPort = s.taboption('general', form.Value, 'relay_server_port', _('Peer Relay Port'),
			_('UDP port for the Peer Relay service. Open this port on your router firewall/NAT.')
		);
		relayPort.datatype = 'port';
		relayPort.placeholder = '40000';
		relayPort.rmempty = false;
		relayPort.depends('enable_relay', '1');

		const en = s.taboption('general', form.ListValue, 'exit_node', _('Exit Node'), _('Select an exit node from the list. If enabled, Allow LAN Access is enabled implicitly.'));
		en.value('', _('None'));
		if (status.peers) {
			Object.values(status.peers).forEach(function(peer) {
				if (peer.exit_node_option) {
					const primaryIp = peer.ip.split('<br>')[0];
					const label = peer.hostname ? `${peer.hostname} (${primaryIp})` : primaryIp;
					en.value(primaryIp, label);
				}
			});
		}
		en.rmempty = true;
		en.cfgvalue = function(section_id) {
			if (status && status.status === 'running' && status.peers) {
				for (const id in status.peers) {
					if (status.peers[id].exit_node) {
						return status.peers[id].ip.split('<br>')[0];
					}
				}
				return '';
			}
			return uci.get('tailscale', 'settings', 'exit_node') || '';
		};

		const o = s.taboption('general', form.DynamicList, 'advertise_routes', _('Advertise Routes'),_('Advertise subnet routes behind this device. Select from the detected subnets below or enter custom routes (comma-separated).'));
		if (subroutes.length > 0) {
			subroutes.forEach(function(subnet) {
				o.value(subnet, subnet);
			});
		}
		o.rmempty = true;

		const fwBtn = s.taboption('general', form.Button, '_setup_firewall', _('Auto Configure Firewall'));
		fwBtn.description = _('Essential configuration for Subnet Routing (Site-to-Site) and Exit Node features.')
		+'<br>'+_('It creates the tailscale interface, adds it to a firewall zone, and sets up forwarding between LAN and Tailscale, plus Tailscale to WAN.')
		+'<br>'+_('The Tailscale to WAN forwarding is what lets clients send their internet traffic through this device as an Exit Node.')
		+'<br>'+_('Masquerading and MSS Clamping (MTU fix) are enabled to keep connections stable.');
		fwBtn.inputstyle = 'action';
		fwBtn.onclick = function() {
			// The button writes network/firewall UCI directly, so staged changes
			// in the form above would be left unapplied and the user would be
			// comparing the firewall against an old config. Ask at click time
			// rather than trusting a snapshot: uci.changes() is an RPC and the
			// answer goes stale as soon as the page is saved once.
			// This only warns; blocking would misfire whenever the answer is
			// stale, and the apply below is harmless either way.
			return L.resolveDefault(uci.changes(), {}).then(function(changes) {
				if (countPending(changes) > 0) {
					ui.addNotification(null, E('p', {}, _('You have unapplied changes. Save & Apply them first so the firewall matches the form.')), 'warning');
				}
				return runSetupFirewall();
			}).catch(function() {
				return runSetupFirewall();
			});
		};

		// The reload runs in the background and can briefly interrupt the
		// connection carrying this page, so the reply only confirms the commit;
		// the outcome is polled separately.
		function runSetupFirewall() {
			return callSetupFirewall().then(function(res) {
				unwrapRpc(res, _('Configuring firewall'));

				if (!res.changed_network && !res.changed_firewall) {
					ui.addNotification(null, E('p', {}, _('Firewall configuration already applied.')), 'info');
					return null;
				}

				notifyTimed(null, [ E('p', _('Configuration committed, reloading network and firewall. This can take a moment.')) ], 5000, 'info');
				return pollFirewallJob(res.run_id);
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Failed to configure firewall: %s').format(err?.message || err?.error || err || _('Unknown error'))), 'error');
			});
		}

		const helpTitle = s.taboption('general', form.DummyValue, '_help_title');
		helpTitle.title = _('How to enable Site-to-Site?');
		helpTitle.render = function() {
			return E('div', { 'class': 'cbi-value', 'style': 'margin-top: 1em; border-top: 1px font-weight: bold;' }, [
				E('label', { 'class': 'cbi-value-title' }, this.title),
				E('div', { 'class': 'cbi-value-field', 'style': 'line-height: 1.6em; font-size: 95%; color: #555;' }, [
					_('1. Select "Accept Routes" (to access remote devices).'), E('br'),
					_('2. In "Advertise Routes", select your local subnet (to allow remote devices to access this LAN).'), E('br'),
					_('3. Click "Auto Configure Firewall" (to allow traffic forwarding).'), E('br'),
					E('strong', { 'style': 'color: #d9534f;' }, _('[Important] Log in to the Tailscale admin console and manually enable "Subnet Routes" for this device.'))
				])
			]);
		};

		// Exit Node is a different feature with a different step that LuCI cannot
		// complete on its own: the admin console approval happens in the user's
		// Tailscale account. Without it a client reaches the LAN but gets no
		// internet, which reads as "the firewall button did not work".
		const exitHelp = s.taboption('general', form.DummyValue, '_exit_node_help');
		exitHelp.title = _('How to enable Exit Node?');
		exitHelp.render = function() {
			return E('div', { 'class': 'cbi-value', 'style': 'margin-top: 1em; border-top: 1px font-weight: bold;' }, [
				E('label', { 'class': 'cbi-value-title' }, this.title),
				E('div', { 'class': 'cbi-value-field', 'style': 'line-height: 1.6em; font-size: 95%; color: #555;' }, [
					_('1. Enable "Advertise Exit Node".'), E('br'),
					_('2. Click "Auto Configure Firewall" (it forwards Tailscale traffic to WAN).'), E('br'),
					_('3. In the Tailscale admin console, edit this device under the route settings and approve it as an Exit Node.'), E('br'),
					// No quotes around the client's control on purpose: "Exit node"
					// is a menu in the Tailscale client, not a field on this page,
					// and quoting it would send the reader to the dropdown above,
					// which selects the opposite direction.
					_('4. On the client, set this device as its exit node.'), E('br'),
					E('strong', { 'style': 'color: #d9534f;' }, _('[Important] Step 3 cannot be done here: it needs your Tailscale account.'))
				])
			]);
		};

		// Create the account settings
		s.tab('account', _('Account Settings'));
		defTabOpts(s, 'account', accountConf, { optional: false });

		const loginBtn = s.taboption('account', form.Button, '_login', _('Login'),
		_('Click to get a login URL for this device.')
		+'<br>'+_('If the timeout is displayed, you can refresh the page and click Login again.'));
		loginBtn.inputstyle = 'apply';

		const customLoginUrl = s.taboption('account', form.Value, 'custom_login_url',
			_('Custom Login Server'),
			_('Optional: Specify a custom control server URL (e.g., a Headscale instance, %s).'.format('https://example.com'))
			+'<br>'+_('Leave blank for default Tailscale control plane.')
		);
		customLoginUrl.placeholder = '';
		customLoginUrl.rmempty = true;

		const customLoginAuthKey = s.taboption('account', form.Value, 'custom_login_AuthKey',
			_('Custom Login Server Auth Key'),
			_('Optional: Specify an authentication key for the custom control server. Leave blank if not required.')
			+'<br>'+_('If you are using custom login server but not providing an Auth Key, will redirect to the login page without pre-filling the key.')
		);
		customLoginAuthKey.placeholder = '';
		customLoginAuthKey.rmempty = true;

		const logoutBtn = s.taboption('account', form.Button, '_logout', _('Logout'),
		_('Click to Log out account on this device.')
		+'<br>'+_('Disconnect from Tailscale and expire current node key.'));
		logoutBtn.inputstyle = 'apply';
		logoutBtn.id = 'tailscale_logout_btn';

		loginBtn.onclick = function() {
			const customServerInput = document.getElementById('widget.cbid.tailscale.settings.custom_login_url');
			const customServer = customServerInput ? customServerInput.value : '';
			const customserverAuthInput = document.getElementById('widget.cbid.tailscale.settings.custom_login_AuthKey');
			const customServerAuth = customserverAuthInput ? customserverAuthInput.value : '';
			const loginWindow = window.open('', '_blank');
			if (!loginWindow) {
				notifyTimed(null, [ E('p', _('Could not open a new tab. Please check if your browser or an extension blocked the pop-up.')) ], 10000, 'error');
				return;
			}
			// Display a prompt message in the new window
			const doc = loginWindow.document;
			doc.body.innerHTML =
				'<h2>' + _('Tailscale Login') + '</h2>' +
				'<p>' + _('Requesting Tailscale login URL... Please wait.') + '</p>' +
				'<p>' + _('This can take up to 30 seconds.') + '</p>';

			ui.showModal(_('Requesting Login URL...'), E('em', {}, _('Please wait.')));
			const payload = {
				loginserver: customServer || '',
				loginserver_authkey: customServerAuth || ''
			};
			// Show a "loading" modal and execute the asynchronous RPC call
			ui.showModal(_('Requesting Login URL...'), E('em', {}, _('Please wait.')));
			return callDoLogin(payload).then(function(res) {
				ui.hideModal();
				if (res && res.url) {
					// After successfully obtaining the URL, redirect the previously opened tab
					loginWindow.location.href = res.url;
				} else {
					// If it fails, inform the user and they can close the new tab
					doc.body.innerHTML =
						'<h2>' + _('Error') + '</h2>' +
						'<p>' + _('Failed to get login URL. You may close this tab.') + '</p>';
					notifyTimed(null, [ E('p', _('Failed to get login URL: %s').format(res?.error || _('Invalid response from server.'))) ], 7000, 'error');
				}
			}).catch(function(err) {
				ui.hideModal();
				notifyTimed(null, [ E('p', _('Failed to get login URL: %s').format(err.message || _('Unknown error'))) ], 7000, 'error');
			});
		};

		logoutBtn.onclick = function() {
			const confirmationContent = E([
				E('p', {}, _('Are you sure you want to log out?')
					+'<br>'+_('This will disconnect this device from your Tailnet and require you to re-authenticate.')),

				E('div', { 'style': 'text-align: right; margin-top: 1em;' }, [
					E('button', {
						'class': 'cbi-button',
						'click': ui.hideModal
					}, _('Cancel')),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-negative',
						'click': function() {
							ui.hideModal();
							ui.showModal(_('Logging out...'), E('em', {}, _('Please wait.')));

							return callDoLogout().then(function(res) {
								unwrapRpc(res, _('Logout'));
								ui.hideModal();
								notifyTimed(null, [ E('p', _('Successfully logged out.')) ], 5000, 'info');
							}).catch(function(err) {
								ui.hideModal();
								notifyTimed(null, [ E('p', _('Logout failed: %s').format(err.message || _('Unknown error'))) ], 7000, 'error');
							});
						}
					}, _('Logout'))
				])
			]);
			ui.showModal(_('Confirm Logout'), confirmationContent);
		};

		s.tab('devices', _('Devices List'));
		const devicesSection = s.taboption('devices', form.DummyValue, '_devices');
		devicesSection.render = function () {
			lastDevicesStatus = status;
			return E('div', { 'id': 'tailscale_devices_display', 'class': 'cbi-value' }, renderDevices(status));
		};

		s.tab('logs', _('Logs'));
		const logsSection = s.taboption('logs', form.DummyValue, '_logs');
		logsSection.render = function () {
			const container = E('div', { 'id': 'tailscale_logs_display', 'class': 'cbi-value' },
				_('No tailscale-related logs found.')
			);
			return container;
		};

		const refreshLogsBtn = s.taboption('logs', form.Button, '_refresh_logs', _('Refresh'));
		refreshLogsBtn.inputstyle = 'action';
		refreshLogsBtn.onclick = function() {
			const display = document.getElementById('tailscale_logs_display');
			if (display) {
				display.replaceChildren(E('em', {}, _('Collecting data ...')));
			}
			return callGetLogs().then(function(res) {
				unwrapRpc(res, _('Loading logs'));
				if (display) {
					display.replaceChildren(renderLogs(res));
				}
			}).catch(function(err) {
				if (display) {
					display.replaceChildren(E('em', {}, _('Failed to load logs: %s').format(err.message || _('Unknown error'))));
				}
			});
		};

		// Create the "Daemon Settings" tab and apply daemonConf
		//s.tab('daemon', _('Daemon Settings'));
		//defTabOpts(s, 'daemon', daemonConf, { optional: false });

		return map.render();
	},

	// The handleSaveApply function saves UCI changes then applies them via the
	// standard OpenWrt apply mechanism, which triggers /etc/init.d/tailscale-settings
	// and provides automatic rollback protection if the device becomes unreachable.
	handleSaveApply(ev, mode) {
		// The submitted value only reaches the uci model while map.save() parses
		// the form, so reading it before map.save() returns the previously saved
		// value: switching the service off then passed '1' and never armed the
		// stop request. Read it in the save callback, which runs right after the
		// form was parsed and before the staged changes are sent to the device.
		let wantEnabled;

		return map.save(function () {
			wantEnabled = uci.get('tailscale', 'settings', 'service_enabled');
		}).then(function () {
			// Only records the disable request; the reload handler performs
			// the stop after the commit, so a LuCI rollback still finds a
			// running daemon. One concurrency slot on purpose: an overlapping
			// apply could let the trigger read a half-written request file.
			// Fail-open on purpose: an install whose rpcd ACL cache predates
			// this method would otherwise be unable to apply anything. The
			// worst case is that the stop is skipped for this apply.
			// The declaration maps positional arguments to its params, so pass
			// the value itself: { enabled: ... } reached ubus as the value of
			// enabled and was rejected as an invalid argument.
			return callSetServiceEnabled(wantEnabled === '0' ? '0' : '1')
				.catch(function(err) {
					console.warn('set_service_enabled failed: %s', err);
					return null;
				});
		}).then(function () {
			return ui.changes.apply(mode == '0');
		});
	},

	handleSave: null,
	handleReset: null
});
