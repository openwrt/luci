'use strict';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require tools.widgets as widgets';

/*
	button handling
*/
async function handleAction(ev) {
	if (ev === 'restart') {
		fs.exec_direct('/etc/init.d/travelmate', [ev])
	}
	if (ev === 'setup') {
		var ifaceValue = String(uci.get('travelmate', 'global', 'trm_iface') || '');
		L.ui.showModal(_('Interface Wizard'), [
			E('p', _('To use Travelmate, you have to set up an uplink interface once. This wizard creates an IPv4- and an IPv6 alias network interface with all required network- and firewall settings.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
				E('input', { 'class': 'cbi-input-text', 'id': 'iface', 'placeholder': 'trm_wwan', 'value': ifaceValue, 'maxlength': '15', 'spellcheck': 'false' }, [
				]),
				'\xa0\xa0\xa0',
				_('The uplink interface name')
				]),
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
				E('input', { 'class': 'cbi-input-text', 'id': 'zone', 'placeholder': 'wan', 'maxlength': '15', 'spellcheck': 'false' }),
				'\xa0\xa0\xa0',
				_('The firewall zone name')
				]),
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
				E('input', { 'class': 'cbi-input-text', 'id': 'metric', 'placeholder': '100', 'maxlength': '3', 'spellcheck': 'false' }),
				'\xa0\xa0\xa0',
				_('The interface metric')
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': L.hideModal
				}, _('Dismiss')),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-positive important',
					'click': ui.createHandlerFn(this, function(ev) {
						var iface = document.getElementById('iface').value || 'trm_wwan',
						zone = document.getElementById('zone').value || 'wan',
						metric = document.getElementById('metric').value || '100';
						L.resolveDefault(fs.exec_direct('/etc/init.d/travelmate', ['setup', iface, zone, metric]))
						.then(function(res) {
							if (res) {
								ui.addNotification(null, E('p', res.trim() + '.'), 'error');
							} else {
								ui.addNotification(null, E('p', _('The uplink interface has been updated.')), 'info');
							}
						});
						L.hideModal();
					})
				}, _('Save'))
			])
		]);
		return document.getElementById('iface').focus();
	}

	if (ev === 'qrcode') {
		return Promise.all([
			uci.load('wireless')
		]).then(function() {
			var w_sid, w_device, w_ssid, w_enc, w_key, w_hidden, result,
			w_sections = uci.sections('wireless', 'wifi-iface'),
			optionsAP  = [E('option', { value: '' }, [_('-- AP Selection --')])];
			for (var i = 0; i < w_sections.length; i++) {
				if (w_sections[i].mode === 'ap' && w_sections[i].disabled !== '1') {
					w_sid    = i;
					w_device = w_sections[i].device;
					w_ssid   = w_sections[i].ssid;
					optionsAP.push(E('option', { value: w_sid }, w_device + ', ' + w_ssid));
				}
			}
			var selectAP = E('select', {
				id: 'selectID',
				class: 'cbi-input-select',
				change: function(ev) {
					result = document.getElementById('qrcode');
					if (document.getElementById("selectID").value) {
						w_sid    = document.getElementById("selectID").value;
						w_ssid   = w_sections[w_sid].ssid;
						w_enc    = w_sections[w_sid].encryption;
						w_key    = w_sections[w_sid].key;
						w_hidden = (w_sections[w_sid].hidden == 1 ? 'true' : 'false');
						if (w_enc.startsWith('psk')) {
							w_enc = 'WPA';
						}
						else if (w_enc === 'none') {
							w_enc = 'nopass';
							w_key = 'nokey';
						}
						L.resolveDefault(fs.exec_direct('/usr/bin/qrencode', ['--inline', '--8bit', '--type=SVG', '--output=-', 'WIFI:S:' + w_ssid + ';T:' + w_enc + ';P:' + w_key + ';H:' + w_hidden + ';']), null).then(function(res) {
							if (res) {
								result.innerHTML = res.trim();
							}
							else {
								result.innerHTML = _('The QR-Code could not be generated!');
							}
						});
					}
					else {
						result.innerHTML = '';
					}
				}
			}, optionsAP);
			L.ui.showModal(_('QR-Code Overview'), [
				E('p', _('Render the QR-Code of the selected Access Point to comfortably transfer the WLAN credentials to your mobile devices.')),
				E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
					E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em' }, [
						selectAP,
					])
				]),
				'\xa0',
				E('div', {
					'id': 'qrcode'
				}),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': L.hideModal
					}, _('Dismiss'))
				])
			]);
		});
		return;
	}
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('travelmate')
		]);
	},

	render: function(result) {
		var m, s, o;

		m = new form.Map('travelmate', 'Travelmate', _('Configuration of the travelmate package to to enable travel router functionality. \
			For further information <a href="https://github.com/openwrt/packages/blob/master/net/travelmate/files/README.md" target="_blank" rel="noreferrer noopener" >check the online documentation</a>. <br /> \
			<em>Please note:</em> On first start please call the \'Interface Wizard\' once, to make the necessary network- and firewall settings.'));

		/*
			poll runtime information
		*/
		pollData: poll.add(function() {
			return L.resolveDefault(fs.stat('/tmp/trm_runtime.json'), null).then(function(res) {
				var status = document.getElementById('status');
				if (res) {
					L.resolveDefault(fs.read_direct('/tmp/trm_runtime.json'), null).then(function(res) {
						if (res) {
							var info = JSON.parse(res);
							if (status && info) {
								status.textContent = (info.data.travelmate_status || '-') + ' / ' + (info.data.travelmate_version || '-');
								if (info.data.travelmate_status.startsWith('running')) {
									if (!status.classList.contains("spinning")) {
										status.classList.add("spinning");
									}
								} else {
									if (status.classList.contains("spinning")) {
										status.classList.remove("spinning");
									}
								}
							} else if (status) {
								status.textContent = '-';
								if (status.classList.contains("spinning")) {
									status.classList.remove("spinning");
								}
							}
							var station_id = document.getElementById('station_id');
							if (station_id && info) {
								station_id.textContent = info.data.station_id || '-';
							}
							var station_mac = document.getElementById('station_mac');
							if (station_mac && info) {
								station_mac.textContent = info.data.station_mac || '-';
							}
							var station_interface = document.getElementById('station_interface');
							if (station_interface && info) {
								station_interface.textContent = info.data.station_interface || '-';
							}
							var wpa_flags = document.getElementById('wpa_flags');
							if (wpa_flags && info) {
								wpa_flags.textContent = info.data.wpa_flags || '-';
							}
							var run_flags = document.getElementById('run_flags');
							if (run_flags && info) {
								run_flags.textContent = info.data.run_flags || '-';
							}
							var ext_hooks = document.getElementById('ext_hooks');
							if (ext_hooks && info) {
								ext_hooks.textContent = info.data.ext_hooks || '-';
							}
							var run = document.getElementById('run');
							if (run && info) {
								run.textContent = info.data.last_run || '-';
							}
						}
					});
				}
				else {
					if (status && status.classList.contains("spinning")) {
						status.textContent = '-';
						status.classList.remove("spinning");
					}
				}
			});
		}, 1);

		/*
			runtime information and buttons
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function(view, section_id) {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Information')), 
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Status / Version')),
				E('div', { 'class': 'cbi-value-field', 'id': 'status', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Station ID')),
				E('div', { 'class': 'cbi-value-field', 'id': 'station_id', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Station MAC')),
				E('div', { 'class': 'cbi-value-field', 'id': 'station_mac', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Station Interface')),
				E('div', { 'class': 'cbi-value-field', 'id': 'station_interface', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('WPA Flags')),
				E('div', { 'class': 'cbi-value-field', 'id': 'wpa_flags', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Run Flags')),
				E('div', { 'class': 'cbi-value-field', 'id': 'run_flags', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Ext. Hooks')),
				E('div', { 'class': 'cbi-value-field', 'id': 'ext_hooks', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Last Run')),
				E('div', { 'class': 'cbi-value-field', 'id': 'run', 'style': 'font-weight: bold;margin-bottom:5px;color:#37c' },'-')]),
				E('div', { class: 'right' }, [
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'id': 'btn_suspend',
						'click': ui.createHandlerFn(this, function() {
							L.resolveDefault(fs.stat('/usr/bin/qrencode'), null).then(function(res) {
								if (res) {
									return handleAction('qrcode');
								}
								return ui.addNotification(null, E('p', _('Please install the separate \'qrencode\' package.')), 'info');
							})
						})
					}, [ _('AP QR-Codes...') ]),
					'\xa0',
					E('button', {
						'class': 'cbi-button cbi-button-reset',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('setup');
						})
					}, [ _('Interface Wizard...') ])
				])
			]);
		}, o, this);
		this.pollData;

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'travelmate', _('Settings'));
		s.addremove = false;
		s.tab('general',  _('General Settings'));
		s.tab('additional', _('Additional Settings'));
		s.tab('adv_vpn', _('VPN Settings'), _('Please note: VPN connections require the separate setup of the <em>Wireguard</em> or <em>OpenVPN</em> package.<br /><p>&#xa0;</p>'));
		s.tab('adv_email', _('E-Mail Settings'), _('Please note: E-Mail notifications require the separate setup of the <em>mstmp</em> package.<br /><p>&#xa0;</p>'));

		/*
			general settings tab
		*/
		o = s.taboption('general', form.Flag, 'trm_enabled', _('Enabled'), _('Enable the travelmate service.'));
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_debug', _('Verbose Debug Logging'), _('Enable verbose debug logging in case of any processing errors.'));
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'trm_radio', _('Radio Selection'), _('Restrict travelmate to a single radio or change the overall scanning order (e.g. \'radio1 radio0\').'));
		o.placeholder = 'radio0';
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'trm_captive', _('Captive Portal Detection'), _('Check the internet availability, handle captive portal redirections and keep the uplink connection \'alive\'.'));
		o.default = 1;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_netcheck', _('Net Error Check'), _('Treat missing internet availability as an error.'));
		o.depends('trm_captive', '1');
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_proactive', _('ProActive Uplink Switch'), _('Proactively scan and switch to a higher prioritized uplink, despite of an already existing connection.'));
		o.default = 1;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_autoadd', _('AutoAdd Open Uplinks'), _('Automatically add open uplinks like hotel captive portals to your wireless config.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_randomize', _('Randomize MAC Addresses'), _('Generate a random unicast MAC address for each uplink connection.'));
		o.default = 0;
		o.rmempty = false;

		/*
			additional settings tab
		*/
		o = s.taboption('additional', form.Value, 'trm_triggerdelay', _('Trigger Delay'), _('Additional trigger delay in seconds before travelmate processing begins.'));
		o.placeholder = '2';
		o.datatype = 'range(1,60)';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'trm_maxretry', _('Connection Limit'), _('Retry limit to connect to an uplink.'));
		o.placeholder = '3';
		o.datatype = 'range(1,10)';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'trm_minquality', _('Signal Quality Threshold'), _('Minimum signal quality threshold as percent for conditional uplink (dis-) connections.'));
		o.placeholder = '35';
		o.datatype = 'range(20,80)';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'trm_maxwait', _('Interface Timeout'), _('How long should travelmate wait for a successful wlan uplink connection.'));
		o.placeholder = '30';
		o.datatype = 'range(20,40)';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'trm_timeout', _('Overall Timeout'), _('Overall retry timeout in seconds.'));
		o.placeholder = '60';
		o.datatype = 'range(30,300)';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'trm_scanbuffer', _('Scan Buffer Size'), _('Buffer size in bytes to prepare nearby scan results.'));
		o.placeholder = '1024';
		o.datatype = 'range(256,4096)';
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'trm_captiveurl', _('Captive Portal URL'), _('The selected URL will be used for connectivity- and captive portal checks.'));
		o.value('http://captive.apple.com', 'Apple (default)');
		o.value('http://connectivity-check.ubuntu.com', 'Ubuntu');
		o.value('http://connectivitycheck.android.com/generate_204', 'Google');
		o.value('http://www.msftncsi.com/ncsi.txt', 'Microsoft');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'trm_useragent', _('User Agent'), _('The selected user agent will be used for connectivity- and captive portal checks.'));
		o.value('Mozilla/5.0 (X11; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0', 'Firefox (default)');
		o.value('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36', 'Chromium');
		o.value('Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/85.0.4183.92 Mobile/15E148 Safari/604.1', 'Safari');
		o.value('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36 Edg/85.0.564.44', 'Edge');
		o.value('Mozilla/5.0 (Linux; Android 10; SM-G970F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.81 Mobile Safari/537.36 OPR/59.1.2926.54067', 'Opera');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'trm_nice', _('Service Priority'), _('The selected priority will be used for travelmate processes.'));
		o.value('-20', 'Highest Priority');
		o.value('-10', 'High Priority');
		o.value('0', 'Normal Priority (default)');
		o.value('10', 'Less Priority');
		o.value('19', 'Least Priority');
		o.optional = true;
		o.rmempty = true;

		/*
			advanced vpn settings tab
		*/
		o = s.taboption('adv_vpn', form.Flag, 'trm_vpn', _('VPN Hook'), _('Automatically handle VPN (re-) connections.'));
		o.rmempty = false;

		o = s.taboption('adv_vpn', form.ListValue, 'trm_vpnservice', _('VPN Service'));
		o.depends('trm_vpn', '1');
		o.value('wireguard');
		o.value('openvpn');
		o.rmempty = true;

		o = s.taboption('adv_vpn', widgets.NetworkSelect, 'trm_vpniface', _('VPN Interface'), _('The logical vpn network interface, e.g. \'wg0\' or \'tun0\'.'));
		o.depends('trm_vpn', '1');
		o.unspecified = false;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('adv_vpn', widgets.DeviceSelect, 'trm_landevice', _('LAN Device'), _('The lan network device, e.g. \'br-lan\'.'));
		o.depends('trm_vpn', '1');
		o.unspecified = false;
		o.nocreate = true;
		o.rmempty = true;

		/*
			advanced email settings tab
		*/
		o = s.taboption('adv_email', form.Flag, 'trm_mail', _('E-Mail Hook'), _('Sends notification E-Mails after every succesful uplink connect.'));
		o.rmempty = false;

		o = s.taboption('adv_email', form.Value, 'trm_mailreceiver', _('E-Mail Receiver Address'), _('Receiver address for travelmate notification E-Mails.'));
		o.depends('trm_mail', '1');
		o.placeholder = 'name@example.com';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'trm_mailsender', _('E-Mail Sender Address'), _('Sender address for travelmate notification E-Mails.'));
		o.depends({ 'trm_mailreceiver': '@', '!contains': true });
		o.placeholder = 'no-reply@travelmate';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'trm_mailtopic', _('E-Mail Topic'), _('Topic for travelmate notification E-Mails.'));
		o.depends({ 'trm_mailreceiver': '@', '!contains': true });
		o.placeholder = 'travelmate connection to \'<station>\'';
		o.rmempty = true;

		o = s.taboption('adv_email', form.Value, 'trm_mailprofile', _('E-Mail Profile'), _('Profile used by \'msmtp\' for travelmate notification E-Mails.'));
		o.depends({ 'trm_mailreceiver': '@', '!contains': true });
		o.placeholder = 'trm_notify';
		o.rmempty = true;

		return m.render();
	},
	handleReset: null
});
