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
const callDoLogin = rpc.declare({ object: 'tailscale', method: 'do_login' });
const callGetSubroutes = rpc.declare({ object: 'tailscale', method: 'get_subroutes' });
let map;

const tailscaleSettingsConf = [
    [form.ListValue, 'fw_mode', _('Firewall Mode'), _('Select the firewall backend for Tailscale to use. Requires service restart to take effect.'), {values: ['nftables','iptables'],rmempty: false}],
    [form.Flag, 'accept_routes', _('Accept Routes'), _('Allow accepting routes announced by other nodes.'), { rmempty: false }],
    [form.Flag, 'advertise_exit_node', _('Advertise Exit Node'), _('Declare this device as an Exit Node.'), { rmempty: false }],
    [form.Value, 'exit_node', _('Exit Node'), _('Specify an exit node. Leave it blank and it will not be used.'), { rmempty: true }],
    [form.Flag, 'exit_node_allow_lan_access', _('Allow LAN Access'), _('When using the exit node, access to the local LAN is allowed.'), { rmempty: false }],
    [form.Flag, 'shields_up', _('Shields Up'), _('When enabled, blocks all inbound connections from the Tailscale network.'), { rmempty: false }],
    [form.Flag, 'ssh', _('Enable Tailscale SSH'), _('Allow connecting to this device through the SSH function of Tailscale.'), { rmempty: false }]
];

const daemonConf = [
    //[form.Value, 'daemon_mtu', _('Daemon MTU'), _('Set a custom MTU for the Tailscale daemon. Leave blank to use the default value.'), { datatype: 'uinteger', placeholder: '1280' }, { rmempty: false }],
    [form.Flag, 'daemon_reduce_memory', _('Reduce Memory Usage'), _('Enabling this option can reduce memory usage, but it may sacrifice some performance (set GOGC=10).'), { rmempty: false }]
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

function formatLastSeen(dateString) {
    if (!dateString) return 'N/A';
    if (dateString === '0001-01-01T00:00:00Z') {
        return 'Now';
    }
    const lastSeenDate = new Date(dateString);
    // Check for a valid date.
    if (isNaN(lastSeenDate.getTime())) {
        return 'Invalid Date';
    }
    const now = new Date();
    const diffSeconds = Math.round((now - lastSeenDate) / 1000);
    if (diffSeconds < 0) {
        return lastSeenDate.toLocaleString();
    }
    if (diffSeconds < 60) {
        return 'Just now';
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    const year = lastSeenDate.getFullYear();
    const month = String(lastSeenDate.getMonth() + 1).padStart(2, '0');
    const day = String(lastSeenDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function initializeRegionMap() {
    try {
        const response = await fetch(derpMapUrl);
        if (!response.ok) {
            console.error('Failed to fetch region map:', response.statusText);
            return;
        }
        const data = await response.json();
        for (const regionId in data.Regions) {
            const region = data.Regions[regionId];
            const code = region.RegionCode.toLowerCase();
            const name = region.RegionName;
            regionCodeMap[code] = name;
        }
        console.log('Region map initialized successfully.');
    } catch (error) {
        console.error('Error initializing region map:', error);
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
    }else{try{ notificationElement.parentNode.parentNode.remove(); }catch(e){}}

    if (Object.keys(regionCodeMap).length === 0) {
        initializeRegionMap();
    }

    // --- Part 1: Handle non-running states ---

    // State: Tailscale binary not found.
    if (status.status == 'not_installed') {
        return E('dl', { 'class': 'cbi-value' }, [
            E('dt', {}, _('Service Status')),
            E('dd', {}, E('span', { 'style': 'color:red;' }, E('strong', {}, _('NO FOUND TAILSCALE'))))
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
                            'style': `color:${peer.online ? 'green' : 'gray'};`,
                            'title': peer.online ? _('Online') : _('Offline')
                        }, peer.online ? '●' : '○')
                    ),
                    E('td', { 'class': 'cbi-value-field', 'style': td_style }, E('strong', {}, peer.hostname)),
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
                    uci.set('tailscale', 'settings', 'fw_mode', settings_from_rpc.fw_mode);
                    uci.set('tailscale', 'settings', 'accept_routes', (settings_from_rpc.accept_routes ? '1' : '0'));
                    uci.set('tailscale', 'settings', 'advertise_exit_node', ((settings_from_rpc.advertise_exit_node || false) ? '1' : '0'));
                    uci.set('tailscale', 'settings', 'advertise_routes', (settings_from_rpc.advertise_routes || []).join(', '));
                    uci.set('tailscale', 'settings', 'exit_node', settings_from_rpc.exit_node || '');
                    uci.set('tailscale', 'settings', 'exit_node_allow_lan_access', ((settings_from_rpc.exit_node_allow_lan_access || false) ? '1' : '0'));
                    uci.set('tailscale', 'settings', 'ssh', ((settings_from_rpc.ssh || false) ? '1' : '0'));
                    uci.set('tailscale', 'settings', 'shields_up', ((settings_from_rpc.shields_up || false) ? '1' : '0'));
                    uci.set('tailscale', 'settings', 'snat_subnet_routes', ((settings_from_rpc.snat_subnet_routes || false) ? '1' : '0'));

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
                        if (res.status != 'logout') {
                            document.getElementsByClassName('cbi-button cbi-button-apply')[0].disabled = true;
                        }

                        const view = document.getElementById("service_status_display");
                        if (view) {
                            const content = renderStatus(res);
                            view.replaceChildren(content);
                        }

                        const btn = document.getElementById('tailscale_login_btn');
                        if (btn) {
                            btn.disabled = (res.status != 'logout');
                        }
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

        const loginBtn = s.taboption('general', form.Button, '_login', _('Login'), _('Click to get a login URL for this device.'));
        loginBtn.inputstyle = 'apply';
        loginBtn.id = 'tailscale_login_btn';
        // Set initial state based on loaded data
        loginBtn.disabled = (status.status != 'logout');

        loginBtn.onclick = function() {
            const loginWindow = window.open('', '_blank');
            if (!loginWindow) {
                ui.addNotification(null, E('p', _('Could not open a new tab. Please disable your pop-up blocker for this site and try again.')), 'error');
                return;
            }
            // Display a prompt message in the new window
            loginWindow.document.write(_('Requesting Tailscale login URL... Please wait...<br>The looggest time to get the URL is about 30 seconds.'));

            // Show a "loading" modal and execute the asynchronous RPC call
            ui.showModal(_('Requesting Login URL...'), E('em', {}, _('Please wait.')));
            return callDoLogin().then(function(res) {
                ui.hideModal();
                if (res && res.url) {
                    // After successfully obtaining the URL, redirect the previously opened tab
                    loginWindow.location.href = res.url;
                } else {
                    // If it fails, inform the user and they can close the new tab
                    loginWindow.document.write(_('<br>Failed to get login URL. You may close this tab.'));
                    ui.addNotification(null, E('p', _('>Failed to get login URL: Invalid response from server.')), 'error');
                }
            }).catch(function(err) {
                ui.hideModal();
                ui.addNotification(null, E('p', _('Failed to get login URL: %s').format(err.message || 'Unknown error')), 'error');
            });
        };

        defTabOpts(s, 'general', tailscaleSettingsConf, { optional: false });
        const o = s.taboption('general', form.DynamicList, 'advertise_routes', _('Advertise Routes'),_('Advertise subnet routes behind this device. Select from the detected subnets below or enter custom routes (comma-separated).'));
        if (subroutes.length > 0) {
            subroutes.forEach(function(subnet) {
                o.value(subnet, subnet);
            });
        }
		o.rmempty = true;

        // Create the "Daemon Settings" tab and apply daemonConf
        s.tab('daemon', _('Daemon Settings'));
        defTabOpts(s, 'daemon', daemonConf, { optional: false });

        // Workaround to ensure the fw_mode dropdown reflects the correct value after rendering
        const renderedMap = map.render();
        return renderedMap.then(function(node) {
            const correctFwMode = (settings.fw_mode || 'nftables').split(' ')[0];
            setTimeout(function() {
                const fwModeSelect = node.querySelector('#widget\\.cbid\\.tailscale\\.settings\\.fw_mode');
                if (fwModeSelect) {
                    console.log(`[Workaround] Forcing dropdown value to: '${correctFwMode}' after view has rendered.`);
                    fwModeSelect.value = correctFwMode;
                    fwModeSelect.dispatchEvent(new Event('change'));
                } else {
                    console.error('[Workaround] Could not find the fw_mode dropdown to apply fix.');
                }
            }, 0);
        return node;
        });
    },

    // The handleSaveApply function is executed after clicking "Save & Apply"
    handleSaveApply(ev) {
        return map.save().then(function () {
            const data = map.data.get('tailscale', 'settings');
            ui.showModal(_('Applying changes...'), E('em', {}, _('Please wait.')));

            return callSetSettings(data).then(function (response) {
                if (response.success) {
                    ui.hideModal();
                setTimeout(function() {
                        ui.addNotification(null, E('p', _('Tailscale settings applied successfully.')), 'info');
                }, 1000);
        try {
            const indicator = document.querySelector('span[data-indicator="uci-changes"][data-clickable="true"]');
            if (indicator) {
                indicator.click();
                setTimeout(function() {
                    const discardButton = document.querySelector('.cbi-button.cbi-button-reset');
                    if (discardButton) {
                        console.log('Found the "Discard" button in the modal. Clicking it...');
                        discardButton.click();
                    } else {
                        console.error('Could not find the "Discard" button in the modal!');
                    }
                }, 100);
            }
        } catch (error) {
            ui.addNotification(null, E('p', _('Error saving settings: %s').format(error || 'Unknown error')), 'error');
        }
                // Reload the page to display the latest status
                setTimeout(function () { window.location.reload(); }, 2000);
                } else {
                    ui.hideModal();
                    ui.addNotification(null, E('p', _('Error applying settings: %s').format(response.error || 'Unknown error')), 'error');
                }
            });
        }).catch(function(err) {
            ui.hideModal(); 
            console.error('Save failed:', err); 
            ui.addNotification(null, E('p', _('Failed to save settings: %s').format(err.message)), 'error');
        });
    },

    handleSave: null,
    handleReset: null
});
