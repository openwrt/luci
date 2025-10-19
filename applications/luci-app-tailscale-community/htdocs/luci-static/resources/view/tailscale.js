'use strict';
'require view';
'require form';
'require rpc';
'require ui';
'require uci';
'require tools.widgets as widgets';

var callGetStatus = rpc.declare({ object: 'tailscale', method: 'get_status' });
var callGetSettings = rpc.declare({ object: 'tailscale', method: 'get_settings' });
var callSetSettings = rpc.declare({ object: 'tailscale', method: 'set_settings', params: ['form_data'] });
var callDoLogin = rpc.declare({ object: 'tailscale', method: 'do_login' });
var callGetSubroutes = rpc.declare({ object: 'tailscale', method: 'get_subroutes' });
var map;

var tailscaleSettingsConf = [
    [form.Flag, 'accept_routes', _('Accept Routes'), _('Allow accepting routes announced by other nodes.'), { rmempty: false }],
    [form.Flag, 'advertise_exit_node', _('Advertise Exit Node'), _('Declare this device as an Exit Node.'), { rmempty: false }],
    [form.Value, 'exit_node', _('Exit Node'), _('Specify an exit node. Leave it blank and it will not be used.'), { rmempty: true }],
    [form.Flag, 'exit_node_allow_lan_access', _('Allow LAN Access'), _('When using the exit node, access to the local LAN is allowed.'), { rmempty: false }],
    [form.Flag, 'shields_up', _('Shields Up'), _('When enabled, blocks all inbound connections from the Tailscale network.'), { rmempty: false }],
    [form.Flag, 'ssh', _('Enable Tailscale SSH'), _('Allow connecting to this device through the SSH function of Tailscale.'), { rmempty: false }]
];

var daemonConf = [
    [form.Value, 'daemon_mtu', _('Daemon MTU'), _('Set a custom MTU for the Tailscale daemon. Leave blank to use the default value.'), { datatype: 'uinteger', placeholder: '1280' }, { rmempty: false }],
    [form.Flag, 'daemon_reduce_memory', _('Reduce Memory Usage'), _('Enabling this option can reduce memory usage, but it may sacrifice some performance (set GOGC=10).'), { rmempty: false }]
];
function setParams(o, params) {
    if (!params) return; for (var key in params) {
        var val = params[key]; if (key === 'values') {
            for (var j = 0; j < val.length; j++) {
                var args = val[j]; if (!Array.isArray(args))
                    args = [args]; o.value.apply(o, args);
            }
        } else if (key === 'depends') {
            if (!Array.isArray(val))
                val = [val]; var deps = []; for (var j = 0; j < val.length; j++) {
                    var d = {}; for (var vkey in val[j])
                        d[vkey] = val[j][vkey]; for (var k = 0; k < o.deps.length; k++) { for (var dkey in o.deps[k]) { d[dkey] = o.deps[k][dkey]; } }
                    deps.push(d);
                }
            o.deps = deps;
        } else { o[key] = params[key]; }
    }
    if (params['datatype'] === 'bool') { o.enabled = 'true'; o.disabled = 'false'; }
}
function defTabOpts(s, t, opts, params) { for (var i = 0; i < opts.length; i++) { var opt = opts[i]; var o = s.taboption(t, opt[0], opt[1], opt[2], opt[3]); setParams(o, opt[4]); setParams(o, params); } }

function getRunningStatus() {
    return L.resolveDefault(callGetStatus(), { running: false }).then(function (res) {
        return res;
    });
}

// NEW: Helper function to format bytes into a human-readable string.
function formatBytes(bytes) {
    var bytes_num = parseInt(bytes, 10);
    if (isNaN(bytes_num) || bytes_num === 0) return '-';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes_num) / Math.log(k));
    return parseFloat((bytes_num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


function renderStatus(status) {
    // 如果 status 对象为空或没有 running 属性，则显示加载中
    if (!status || !status.hasOwnProperty('status')) {
        return _('Collecting data ...');
    }

    var finalHtml = [];

    // --- Part 1: 渲染水平状态表格 ---
    if (status.status == 'not_installed') {
        finalHtml.push('<dl class="cbi-value"><dt>' + _('Service Status') + '</dt>');
        finalHtml.push('<dd><span style="color:red;"><strong>' + _('NO FOUND TAILSCALE') + '</strong></span></dd></dl>');
        return finalHtml.join('');
    }
    if (status.status == 'logout') {
        finalHtml.push('<dl class="cbi-value"><dt>' + _('Service Status') + '</dt>');
        finalHtml.push('<dd><span style="color:orange;"><strong>' + _('LOGGED OUT') + '</strong></span></br><span>' + _('Please use the login button in the settings below to authenticate.') + '</span></dd></dl>');
        return finalHtml.join('');
    }
    // ** MODIFICATION END **
    if (status.status != 'running') {
        finalHtml.push('<dl class="cbi-value"><dt>' + _('Service Status') + '</dt>');
        finalHtml.push('<dd><span style="color:red;"><strong>' + _('NOT RUNNING') + '</strong></span></dd></dl>');
        return finalHtml.join('');
    }
    
    var labels = [];
    var values = [];
    labels.push('<strong>' + _('Service Status') + '</strong>');
    values.push('<span style="color:green;"><strong>' + _('RUNNING') + '</strong></span>');
    labels.push('<strong>' + _('Version') + '</strong>');
    values.push(status.version || 'N/A');
    labels.push('<strong>' + _('TUN Mode') + '</strong>');
    values.push(status.TUNMode ? _('Enabled') : _('Disabled'));
    labels.push('<strong>' + _('Tailscale IPv4') + '</strong>');
    values.push(status.ipv4 || 'N/A');
    labels.push('<strong>' + _('Tailscale IPv6') + '</strong>');
    values.push(status.ipv6 || 'N/A');
    labels.push('<strong>' + _('Tailnet Name') + '</strong>');
    values.push(status.domain_name || 'N/A');

    var statusTable = '<table style="width: 100%; border-spacing: 0 5px;">';
    statusTable += '<tr>';
    for (var i = 0; i < labels.length; i++) {
        statusTable += '<td style="padding-right: 20px;">' + labels[i] + '</td>';
    }
    statusTable += '</tr><tr>';
    for (var i = 0; i < values.length; i++) {
        statusTable += '<td style="padding-right: 20px;">' + values[i] + '</td>';
    }
    statusTable += '</tr></table>';
    finalHtml.push(statusTable);


    // --- Part 2: 渲染 Peers 设备表格 ---
    finalHtml.push('<div style="margin-top: 25px;">');
    finalHtml.push('<h4>' + _('Network Devices') + '</h4>');

    var peers = status.peers;
    if (!peers || Object.keys(peers).length === 0) {
        finalHtml.push('<p>' + _('No peer devices found.') + '</p>');
    } else {
        var peersTable = '<table class="cbi-table">';
        peersTable += '<tr class="cbi-table-header">';
        var th_style = 'padding-right: 20px; text-align: left;';
        peersTable += '<th class="cbi-table-cell" style="' + th_style + 'width: 80px;">' + _('Status') + '</th>';
        peersTable += '<th class="cbi-table-cell" style="' + th_style + '">' + _('Hostname') + '</th>';
        peersTable += '<th class="cbi-table-cell" style="' + th_style + '">' + _('Tailscale IP') + '</th>';
        peersTable += '<th class="cbi-table-cell" style="' + th_style + '">' + _('OS') + '</th>';
        peersTable += '<th class="cbi-table-cell" style="' + th_style + '">' + _('Connection Info') + '</th>';
        peersTable += '<th class="cbi-table-cell" style="' + th_style + '">' + _('RX') + '</th>';
        peersTable += '<th class="cbi-table-cell" style="' + th_style + '">' + _('TX') + '</th>';
        peersTable += '</tr>';

        for (var hostname in peers) {
            if (peers.hasOwnProperty(hostname)) {
                var peer = peers[hostname];
                peersTable += '<tr class="cbi-rowstyle-1">';
                var status_indicator = (peer.status != 'offline')
                    ? '<span style="color:green;" title="' + _("Online") + '">●</span>'
                    : '<span style="color:gray;" title="' + _("Offline") + '">○</span>';
                var td_style = 'padding-right: 20px;';
                peersTable += '<td class="cbi-value-field" style="' + td_style + '">' + status_indicator + '</td>';
                peersTable += '<td class="cbi-value-field" style="' + td_style + '"><strong>' + hostname + '</strong></td>';
                peersTable += '<td class="cbi-value-field" style="' + td_style + '">' + (peer.ip || 'N/A') + '</td>';
                peersTable += '<td class="cbi-value-field" style="' + td_style + '">' + (peer.ostype || 'N/A') + '</td>';
                peersTable += '<td class="cbi-value-field" style="' + td_style + '">' + (peer.linkadress || '-') + '</td>';
                peersTable += '<td class="cbi-value-field" style="' + td_style + '">' + formatBytes(peer.rx) + '</td>';
                peersTable += '<td class="cbi-value-field" style="' + td_style + '">' + formatBytes(peer.tx) + '</td>';
                peersTable += '</tr>';
            }
        }
        peersTable += '</table>';
        finalHtml.push(peersTable);
    }

    finalHtml.push('</div>');

    return finalHtml.join('');
}

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(callGetStatus(), { running: '', peers: [] }),
            L.resolveDefault(callGetSettings(), { accept_routes: false }),
            L.resolveDefault(callGetSubroutes(), { routes: [] })
        ])
        .then(function(rpc_data) {
            // rpc_data 是数组: [status_result, settings_result, subroutes_result]
            var settings_from_rpc = rpc_data[1];

            return uci.load('tailscale').then(function() {
                if (uci.get('tailscale', 'settings') === null) {
                    uci.add('tailscale', 'settings', 'settings');

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
                return rpc_data;
            });
        });
    },

    render: function (data) {
        var status = data[0] || {};
        var settings = data[1] || {};
        var subroutes = (data[2] && data[2].routes) ? data[2].routes : [];
        
        var s, o, loginBtn, loginUrl;
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

                        var view = document.getElementById("service_status_display");
                        if (view) {
                            view.innerHTML = renderStatus(res);
                        }
                        
                        var btn = document.getElementById('tailscale_login_btn');
                        if (btn) {
                            btn.disabled = (res.status != 'logout');
                        }
                    });
                }, 10);

            // 初始的容器，ID 用于被轮询更新
            return E('div', { 'id': 'service_status_display', 'class': 'cbi-value' }, 
                _('Collecting data ...')
            );
        }

        // 将设置绑定到 uci 的 'settings' section
        s = map.section(form.NamedSection, 'settings', 'settings', _('Settings'));
        s.dynamic = true;

        // 创建 "常规设置" 标签页，并应用 tailscaleSettingsConf
        s.tab('general', _('General Settings'));

        loginBtn = s.taboption('general', form.Button, '_login', _('Login'), _('Click to get a login URL for this device.'));
        loginBtn.inputstyle = 'apply';
        loginBtn.id = 'tailscale_login_btn';
        // Set initial state based on loaded data
        loginBtn.disabled = (status.status != 'logout');

        loginBtn.onclick = function() {
            var loginWindow = window.open('', '_blank');
            if (!loginWindow) {
                ui.addNotification(null, E('p', _('Could not open a new tab. Please disable your pop-up blocker for this site and try again.')), 'error');
                return;
            }
            // 在新窗口显示提示信息
            loginWindow.document.write(_('Requesting Tailscale login URL... Please wait...<br>The looggest time to get the URL is about 30 seconds.'));

            // 显示“加载中”的模态框，并执行异步的RPC调用
            ui.showModal(_('Requesting Login URL...'), E('em', {}, _('Please wait.')));
            return callDoLogin().then(function(res) {
                ui.hideModal();
                if (res && res.url) {
                    // 成功获取URL后，重定向之前已打开的标签页
                    loginWindow.location.href = res.url;
                } else {
                    // 如果失败，告知用户并可以关闭新标签页
                    loginWindow.document.write(_('<br>Failed to get login URL. You may close this tab.'));
                    ui.addNotification(null, E('p', _('>Failed to get login URL: Invalid response from server.')), 'error');
                }
            }).catch(function(err) {
                ui.hideModal();
                ui.addNotification(null, E('p', _('Failed to get login URL: %s').format(err.message || 'Unknown error')), 'error');
            });
        };

        defTabOpts(s, 'general', tailscaleSettingsConf, { optional: false });
        o = s.taboption('general', form.DynamicList, 'advertise_routes', _('Advertise Routes'),_('Advertise subnet routes behind this device. Select from the detected subnets below or enter custom routes (comma-separated).'));
        if (subroutes.length > 0) {
            subroutes.forEach(function(subnet) {
                o.value(subnet, subnet);
            });
        }
		o.rmempty = true;

        // 创建 "守护设置" 标签页，并应用 daemonConf
        s.tab('daemon', _('Daemon Settings'));
        defTabOpts(s, 'daemon', daemonConf, { optional: false });

        return map.render();
    },

    // handleSaveApply 函数在点击 "Save & Apply" 后执行
    handleSaveApply: function (ev) {
        return map.save().then(function () {
            var data = map.data.get('tailscale', 'settings');
            ui.showModal(_('Applying changes...'), E('em', {}, _('Please wait.')));

            return callSetSettings(data).then(function (response) {
                if (response.success) {
                    ui.hideModal();
        setTimeout(function() {
                ui.addNotification(null, E('p', _('Tailscale settings applied successfully.')), 'info');
        }, 1000);
        try {
        const indicator = document.querySelector('span[data-indicator="uci-changes"][data-clickable="true"]');
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
            
        } catch (error) {   
        }
                    // 重新加载页面以显示最新状态
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