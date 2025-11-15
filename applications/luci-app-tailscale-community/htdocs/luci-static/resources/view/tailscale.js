'use strict';
'require view';
'require form';
'require rpc';
'require ui';
'require uci';
'require tools.widgets as widgets';

const callGetStatus = rpc.declare({ object: 'tailscale', method: 'get_status' });
const callGetSettings = rpc.declare({ object: 'tailscale', method: 'get_settings' });
const callSetSettings = rpc.declare({ object: 'tailscale', method: 'set_settings', params: ['form_data'] });
const callDoLogin = rpc.declare({ object: 'tailscale', method: 'do_login', params: ['form_data'] });
const callDoLogout = rpc.declare({ object: 'tailscale', method: 'do_logout' });
const callGetSubroutes = rpc.declare({ object: 'tailscale', method: 'get_subroutes' });
const callSetupFirewall = rpc.declare({ object: 'tailscale', method: 'setup_firewall' });
let map;

const tailscaleSettingsConf = [
	[form.ListValue, 'fw_mode', _('Firewall Mode'), _('Select the firewall backend for Tailscale to use. Requires service restart to take effect.'), {values: ['nftables','iptables'],rmempty: false}],
	[form.Flag, 'accept_routes', _('Accept Routes'), _('Allow accepting routes announced by other nodes.'), { rmempty: false }],
	[form.Flag, 'advertise_exit_node', _('Advertise Exit Node'), _('Declare this device as an Exit Node.'), { rmempty: false }],
	[form.Flag, 'exit_node_allow_lan_access', _('Allow LAN Access'), _('When using the exit node, access to the local LAN is allowed.'), { rmempty: false }],
	[form.Flag, 'runwebclient', _('Enable Web Interface'), _('Expose a web interface on port 5252 for managing this node over Tailscale.'), { rmempty: false }],
	[form.Flag, 'nosnat', _('Disable SNAT'), _('Disable Source NAT (SNAT) for traffic to advertised routes. Most users should leave this unchecked.'), { rmempty: false }],
	[form.Flag, 'shields_up', _('Shields Up'), _('When enabled, blocks all inbound connections from the Tailscale network.'), { rmempty: false }],
	[form.Flag, 'ssh', _('Enable Tailscale SSH'), _('Allow connecting to this device through the SSH function of Tailscale.'), { rmempty: false }],
	[form.Flag, 'disable_magic_dns', _('Disable MagicDNS'), _('Use system DNS instead of MagicDNS.'), { rmempty: false }]
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
	return L.resolveDefault(callGetStatus(), { running: false }).then(function (res) {
		return res;
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
		ui.addTimeLimitedNotification(null, [ E('p', _('Error reading cached DERP region map: %s').format(e.message || _('Unknown error'))) ], 7000, 'error');
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
			ui.addTimeLimitedNotification(null, [ E('p', _('Error caching DERP region map: %s').format(e.message || _('Unknown error'))) ], 7000, 'error');
		}
	} catch (error) {
		ui.addTimeLimitedNotification(null, [ E('p', _('Error fetching DERP region map: %s').format(error.message || _('Unknown error'))) ], 7000, 'error');
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

	// --- Part 3: Render the Peers/Network Devices table ---

	const peers = status.peers;
	let peersContent;

	if (!peers || Object.keys(peers).length === 0) {
		// Display a message if no peers are found.
		peersContent = E('p', {}, _('No peer devices found.'));
	} else {
		// Define headers for the peers table.
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

		// Build the peers table.
		peersContent = E('table', { 'class': 'cbi-table' }, [
			// Table Header Row
			E('tr', { 'class': 'cbi-table-header' }, peerTableHeaders.map(header => {
				let th_style = 'padding-right: 20px; text-align: left;';
				if (header.style) {
					th_style += header.style;
				}
				return E('th', { 'class': 'cbi-table-cell', 'style': th_style }, header.text);
			})),

			// Table Body Rows (one for each peer)
			...Object.entries(peers).map(([peerid, peer]) => {
				const td_style = 'padding-right: 20px;';

				return E('tr', { 'class': 'cbi-rowstyle-1' }, [
					E('td', { 'class': 'cbi-value-field', 'style': td_style },
						E('span', {
							'style': `color:${peer.exit_node ? 'blue' : (peer.online ? 'green' : 'gray')};`,
							'title': (peer.exit_node ? _('Exit Node') + ' ' : '') + (peer.online ? _('Online') : _('Offline'))
						}, peer.online ? '●' : '○')
					),
					E('td', { 'class': 'cbi-value-field', 'style': td_style }, E('strong', {}, peer.hostname + (peer.exit_node_option ? ' (ExNode)' : ''))),
					E('td', { 'class': 'cbi-value-field', 'style': td_style }, peer.ip || 'N/A'),
					E('td', { 'class': 'cbi-value-field', 'style': td_style }, peer.ostype || 'N/A'),
					E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatConnectionInfo(peer.linkadress || '-')),
					E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatBytes(peer.rx)),
					E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatBytes(peer.tx)),
					E('td', { 'class': 'cbi-value-field', 'style': td_style }, formatLastSeen(peer.lastseen))
				]);
			})
		]);
	}

	// Combine all parts into a single DocumentFragment.
	// Using E() without a tag name creates a fragment, which is perfect for grouping elements.
	return E([
		statusTable,
		E('div', { 'style': 'margin-top: 25px;' }, [
			E('h4', {}, _('Network Devices')),
			peersContent
		])
	]);
}

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(callGetStatus(), { running: '', peers: [] }),
			L.resolveDefault(callGetSettings(), { accept_routes: false }),
			L.resolveDefault(callGetSubroutes(), { routes: [] })
		])
		.then(function([status, settings_from_rpc, subroutes]) {
			return uci.load('tailscale').then(function() {
				if (uci.get('tailscale', 'settings') === null) {
					// No existing settings found; initialize UCI with RPC settings
					uci.add('tailscale', 'settings', 'settings');
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
					uci.set('tailscale', 'settings', 'disable_magic_dns', ((settings_from_rpc.disable_magic_dns || false) ? '1' : '0'));

					uci.set('tailscale', 'settings', 'daemon_reduce_memory', '0');
					uci.set('tailscale', 'settings', 'daemon_mtu', '');
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
			L.Poll.add(
				function () {
					return getRunningStatus().then(function (res) {
						const view = document.getElementById("service_status_display");
						if (view) {
							const content = renderStatus(res);
							view.replaceChildren(content);
						}

						// login button only available when logged out
						const login_btn=document.getElementsByClassName('cbi-button cbi-button-apply')[0];
						if(login_btn) { login_btn.disabled=(res.status != 'logout'); }
					});
				}, 10);

			return E('div', { 'id': 'service_status_display', 'class': 'cbi-value' },
				_('Collecting data ...')
			);
		}

		// Bind settings to the 'settings' section of uci
		s = map.section(form.NamedSection, 'settings', 'settings', _('Settings'));
		s.dynamic = true;

		// Create the "General Settings" tab and apply tailscaleSettingsConf
		s.tab('general', _('General Settings'));

		defTabOpts(s, 'general', tailscaleSettingsConf, { optional: false });

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
		fwBtn.description = _('Experimental: applies minimal firewall and interface setup for Tailscale. It will create/patch network.tailscale (proto none, device tailscale0), add a firewall zone "tailscale" with ACCEPT/ACCEPT/ACCEPT, masq, mtu_fix, and ensure forwarding tailscale<->lan. It reloads network/firewall only if changes are made.');
		fwBtn.inputstyle = 'action';
		fwBtn.onclick = function() {
			const btn = this;
			btn.disabled = true;
			return callSetupFirewall().then(function(res) {
				const msg = res?.message || _('Firewall configuration applied.');
				ui.addNotification(null, E('p', {}, msg), 'info');
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Failed to configure firewall: %s').format(err?.message || err || 'Unknown error')), 'error');
			}).finally(function() {
				btn.disabled = false;
			});
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
			_('Optional: Specify a custom control server URL (e.g., a Headscale instance, https://example.com).')
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
				ui.addTimeLimitedNotification(null, [ E('p', _('Could not open a new tab. Please check if your browser or an extension blocked the pop-up.')) ], 10000, 'error');
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
					ui.addTimeLimitedNotification(null, [ E('p', _('Failed to get login URL: Invalid response from server.')) ], 7000, 'error');
				}
			}).catch(function(err) {
				ui.hideModal();
				ui.addTimeLimitedNotification(null, [ E('p', _('Failed to get login URL: %s').format(err.message || _('Unknown error'))) ], 7000, 'error');
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
								ui.hideModal();
								ui.addTimeLimitedNotification(null, [ E('p', _('Successfully logged out.')) ], 5000, 'info');
							}).catch(function(err) {
								ui.hideModal();
								ui.addTimeLimitedNotification(null, [ E('p', _('Logout failed: %s').format(err.message || _('Unknown error'))) ], 7000, 'error');
							});
						}
					}, _('Logout'))
				])
			]);
			ui.showModal(_('Confirm Logout'), confirmationContent);
		};

		// Create the "Daemon Settings" tab and apply daemonConf
		//s.tab('daemon', _('Daemon Settings'));
		//defTabOpts(s, 'daemon', daemonConf, { optional: false });

		return map.render();
	},

	// The handleSaveApply function is executed after clicking "Save & Apply"
	handleSaveApply(ev) {
		return map.save().then(function () {
			const data = map.data.get('tailscale', 'settings');

			// fix empty value issue
			if(!data.advertise_exit_node) data.advertise_exit_node = '';
			if(!data.advertise_routes) data.advertise_routes = '';
			if(!data.exit_node) data.exit_node = '';
			if(!data.custom_login_url) data.custom_login_url = '';
			if(!data.custom_login_AuthKey) data.custom_login_AuthKey = '';

			ui.showModal(_('Applying changes...'), E('em', {}, _('Please wait.')));

			return callSetSettings(data).then(function (response) {
				if (response.success) {
					ui.hideModal();
					setTimeout(function() {
							ui.addTimeLimitedNotification(null, [ E('p', _('Tailscale settings applied successfully.')) ], 5000, 'info');
					}, 1000);
					try {
						L.ui.changes.revert();
					} catch (error) {
						ui.addTimeLimitedNotification(null, [ E('p', _('Error saving settings: %s').format(error || _('Unknown error'))) ], 7000, 'error');
					}
				} else {
					ui.hideModal();
					ui.addTimeLimitedNotification(null, [ E('p', _('Error applying settings: %s').format(response.error || _('Unknown error'))) ], 7000, 'error');
				}
			});
		}).catch(function(err) {
			ui.hideModal();
			//console.error('Save failed:', err);
			ui.addTimeLimitedNotification(null, [ E('p', _('Failed to save settings: %s').format(err.message)) ], 7000, 'error');
		});
	},

	handleSave: null,
	handleReset: null
});
