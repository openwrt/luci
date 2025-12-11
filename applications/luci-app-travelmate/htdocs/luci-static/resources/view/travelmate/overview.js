'use strict';
'require dom';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require network';
'require tools.widgets as widgets';
'require uqr';

/*
	button handling
*/
function handleAction(ev) {
	let ifaceValue;
	if (ev === 'restartInterface') {
		ifaceValue = String(uci.get('travelmate', 'global', 'trm_iface') || 'trm_wwan');
		return fs.exec('/etc/init.d/travelmate', ['stop'])
			.then(fs.exec('/sbin/ifup', [ifaceValue]))
			.then(fs.exec('/etc/init.d/travelmate', ['start']))
	}
	if (ev === 'restartTravelmate') {
		const map = document.querySelector('.cbi-map');
		return dom.callClassMethod(map, 'save')
			.then(L.bind(ui.changes.apply, ui.changes))
			.then(function () {
				return fs.exec_direct('/etc/init.d/travelmate', ['restart']);
			})
	}
	if (ev === 'setup') {
		ifaceValue = String(uci.get('travelmate', 'global', 'trm_iface') || '');
		L.ui.showModal(_('Interface Wizard'), [
			E('p', _('To use Travelmate, you have to set up an uplink interface once. This wizard creates an IPv4- and an IPv6 alias network interface with all required network- and firewall settings.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em;' }, [
					E('input', { 'class': 'cbi-input-text', 'id': 'iface', 'placeholder': 'trm_wwan', 'value': ifaceValue, 'maxlength': '15', 'spellcheck': 'false', style: 'margin-right:.5em;' }),
					_('The uplink interface name')
				]),
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em;' }, [
					E('input', { 'class': 'cbi-input-text', 'id': 'zone', 'placeholder': 'wan', 'maxlength': '15', 'spellcheck': 'false', style: 'margin-right:.5em;' }),
					_('The firewall zone name')
				]),
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em;' }, [
					E('input', { 'class': 'cbi-input-text', 'id': 'metric', 'placeholder': '100', 'maxlength': '3', 'spellcheck': 'false', style: 'margin-right:.5em;' }),
					_('The interface metric')
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'cbi-button',
					'style': 'float:none;margin-right:.4em;',
					'click': L.hideModal
				}, _('Dismiss')),
				E('button', {
					'class': 'cbi-button cbi-button-positive important',
					'style': 'float:none',
					'click': ui.createHandlerFn(this, function (ev) {
						const iface = (document.getElementById('iface').value || 'trm_wwan').toLowerCase();
						const zone = (document.getElementById('zone').value || 'wan').toLowerCase();
						const metric = document.getElementById('metric').value.replace(/\D/g, '') || '100';
						fs.exec('/etc/init.d/travelmate', ['setup', iface, zone, metric])
							.then(function (rc) {
								L.hideModal();
								switch (rc.code) {
									case 1:
										ui.addNotification(null, E('p', _('The interface already exists!')), 'info');
										break;
									default:
										location.reload();
										break;
								}
							})
					})
				}, _('Save'))
			])
		]);
		return document.getElementById('iface').focus();
	}

	if (ev === 'qrcode') {
		return Promise.all([
			uci.load('wireless')])
			.then(function () {
				let w_sid, w_device, w_ssid, w_enc, w_key, w_hidden, result;
				const w_sections = uci.sections('wireless', 'wifi-iface');
				const optionsAP = [E('option', { value: '' }, [_('-- AP Selection --')])];
				for (let i = 0; i < w_sections.length; i++) {
					if (w_sections[i].mode === 'ap' && w_sections[i].disabled !== '1') {
						w_sid = i;
						w_device = w_sections[i].device;
						w_ssid = w_sections[i].ssid;
						optionsAP.push(E('option', { value: w_sid }, w_device + ', ' + w_ssid));
					}
				}
				let selectAP = E('select', {
				id: 'selectID',
				class: 'cbi-input-select',
				change: function (ev) {
					result = document.getElementById('qrcode');
					if (document.getElementById("selectID").value) {
						w_sid = document.getElementById("selectID").value;
						w_ssid = w_sections[w_sid].ssid;
						w_enc = w_sections[w_sid].encryption;
						w_key = w_sections[w_sid].key;
						w_hidden = (w_sections[w_sid].hidden == 1 ? 'true' : 'false');
						if (w_enc === 'none') {
							w_enc = 'nopass';
							w_key = 'nokey';
						} else {
							w_enc = 'WPA';
						}
						const data = `WIFI:S:${w_ssid};T:${w_enc};P:${w_key};H:${w_hidden};;`;
						const options = {
							pixelSize: 12,
							margin: 1,
							ecLevel: 'M',
							whiteColor: 'white',
							blackColor: 'black'
						};
						const svg = uqr.renderSVG(data, options);
						result.innerHTML = svg.trim();
					} else {
						result.textContent = '';
					}
				}
			}, optionsAP);
			L.ui.showModal(_('QR-Code Overview'), [
				E('p', _('Render the QR-Code of the selected Access Point to transfer the WLAN credentials to your mobile devices comfortably.')),
				E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
					E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em' }, [selectAP,])
				]),
				E('div', {
					'id': 'qrcode'
				}),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'cbi-button',
					'click': L.hideModal
					}, _('Dismiss'))
				])
			]);
		});
	}
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('travelmate'),
			network.getWifiDevices().then(function (res) {
				const radios = [];
				for (let i = 0; i < res.length; i++) {
					radios.push(res[i].sid);
				}
				return radios;
			})
		]);
	},

	render: function (result) {
		let m, s, o;

		/*
			main map
		*/
		m = new form.Map('travelmate', 'Travelmate', _('Configuration of the travelmate package to enable travel router functionality. \
			For further information <a href="https://github.com/openwrt/packages/blob/master/net/travelmate/files/README.md" target="_blank" rel="noreferrer noopener" >check the online documentation</a>. <br /> \
			<b><em>Please note:</em></b> On first start please call the \'Interface Wizard\' once, to make the necessary network- and firewall settings.'));

		/*
			set text content helper function
		*/
		const setText = (id, value) => {
			const el = document.getElementById(id);
			if (el) {
				el.textContent = value || '-';
			}
		};

		/*
			poll runtime information
		*/
		pollData: poll.add(function () {
			return L.resolveDefault(fs.stat('/tmp/trm_runtime.json'), null).then(function (res) {
				const status = document.getElementById('status');
				if (res && res.size > 0) {
					L.resolveDefault(fs.read_direct('/tmp/trm_runtime.json'), null).then(function (res) {
						if (res) {
							let info = JSON.parse(res);
							if (status && info) {
								status.textContent = `${info.data.travelmate_status || '-'} (frontend: ${info.data.frontend_ver || '-'} / backend: ${info.data.backend_ver || '-'})`;
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
							if (info) {
								setText('station_id', info.data.station_id);
								setText('station_mac', info.data.station_mac);
								setText('station_interfaces', info.data.station_interfaces);
								setText('station_subnet', info.data.station_subnet);
								setText('run_flags', info.data.run_flags);
								setText('ext_hooks', info.data.ext_hooks);
								setText('run', info.data.last_run);
								setText('sys', info.data.system);
							}
						}
					});
				} else if (status) {
					status.textContent = '-';
					if (status.classList.contains("spinning")) {
						status.classList.remove("spinning");
					}
				}
			});
		}, 1);

		/*
			runtime information and buttons
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function (view, section_id) {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Information')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Status / Version')),
					E('div', { 'class': 'cbi-value-field spinning', 'id': 'status', 'style': 'margin-bottom:-5px;color:#37c;' }, '\xa0')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Station ID')),
					E('div', { 'class': 'cbi-value-field', 'id': 'station_id', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Station MAC')),
					E('div', { 'class': 'cbi-value-field', 'id': 'station_mac', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Station Interfaces')),
					E('div', { 'class': 'cbi-value-field', 'id': 'station_interfaces', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Station Subnet')),
					E('div', { 'class': 'cbi-value-field', 'id': 'station_subnet', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Run Flags')),
					E('div', { 'class': 'cbi-value-field', 'id': 'run_flags', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Ext. Hooks')),
					E('div', { 'class': 'cbi-value-field', 'id': 'ext_hooks', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('Last Run')),
					E('div', { 'class': 'cbi-value-field', 'id': 'run', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;padding-top:0rem;' }, _('System Info')),
					E('div', { 'class': 'cbi-value-field', 'id': 'sys', 'style': 'margin-bottom:-5px;color:#37c;' }, '-')
				])
			]);
		}, o, this);
		this.pollData;

		/*
			tabbed config section
		*/
		s = m.section(form.NamedSection, 'global', 'travelmate', _('Settings'));
		s.addremove = false;
		s.tab('general', _('General Settings'));
		s.tab('additional', _('Additional Settings'));
		s.tab('adv_email', _('E-Mail Settings'));

		/*
			general settings tab
		*/
		o = s.taboption('general', form.Flag, 'trm_enabled', _('Enabled'), _('Enable the travelmate service.'));
		o.rmempty = false;

		o = s.taboption('general', widgets.NetworkSelect, 'trm_iface', _('WWAN Interface'), _('Select an existing wireless WAN network interface or create a new one with the \'Interface Wizard\'.'));
		o.multiple = false;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('general', form.MultiValue, 'trm_radio', _('Radio Selection'), _('Restrict travelmate to certain radio\(s\).'));
		for (let i = 0; i < result[1].length; i++) {
			o.value(result[1][i]);
		}
		o.placeholder = _('-- default --');
		o.optional = true;
		o.rmempty = true;
		o.write = function (section_id, value) {
			uci.set('travelmate', section_id, 'trm_radio', value.join(' '));
		};

		o = s.taboption('general', form.Flag, 'trm_revradio', _('Reverse Radio Order'), _('Reverse the radio processing order.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'trm_scanmode', _('WLAN Scan Mode'), _('Send active probe requests or passively listen for beacon frames that are regularly sent by access points.'));
		o.value('active', _('active'));
		o.value('passive', _('passive'));
		o.placeholder = _('-- default --');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'trm_captive', _('Captive Portal Detection'), _('Check the internet availability, handle captive portal redirections and keep the uplink connection \'alive\'.'));
		o.default = 1;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_vpn', _('VPN processing'), _('VPN connections will be managed by travelmate.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', widgets.NetworkSelect, 'trm_vpnifacelist', _('Limit VPN processing'), _('Limit VPN processing to certain interfaces.'));
		o.depends('trm_vpn', '1');
		o.multiple = true;
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.Value, 'trm_stdvpnservice', _('Standard VPN Service'), _('Standard VPN service which will be automatically added to new STA profiles.'));
		o.depends('trm_vpn', '1');
		o.value('wireguard');
		o.value('openvpn');
		o.rmempty = true;

		o = s.taboption('general', widgets.NetworkSelect, 'trm_stdvpniface', _('Standard VPN interface'), _('Standard VPN interface which will be automatically added to new STA profiles.'));
		o.depends('trm_vpn', '1');
		o.nocreate = true;
		o.rmempty = true;

		o = s.taboption('general', form.Flag, 'trm_netcheck', _('Net Error Check'), _('Treat missing internet availability as an error.'));
		o.depends('trm_captive', '1');
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_proactive', _('ProActive Uplink Switch'), _('Proactively scan and switch to a higher prioritized uplink, despite of an already existing connection.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_randomize', _('Randomize MAC Addresses'), _('Generate a random unicast MAC address for each uplink connection.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_autoadd', _('AutoAdd Open Uplinks'), _('Automatically add open uplinks like hotel captive portals to your wireless config.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'trm_maxautoadd', _('Limit AutoAdd'), _('Limit the maximum number of automatically added open uplinks. To disable this limitation set it to \'0\'.'));
		o.depends('trm_autoadd', '1');
		o.placeholder = '5';
		o.datatype = 'range(0,30)';
		o.rmempty = true;

		o = s.taboption('general', form.DynamicList, 'trm_ssidfilter', _('Filter AutoAdd SSIDs'), _('List of SSID patterns for filtering/skipping specific open uplinks, e.g. \'Chromecast*\''));
		o.depends('trm_autoadd', '1');
		o.multiple = true;
		o.nocreate = false;
		o.rmempty = true;

		/*
			additional settings tab
		*/
		o = s.taboption('additional', form.Flag, 'trm_debug', _('Verbose Debug Logging'), _('Enable verbose debug logging in case of any processing errors.'));
		o.rmempty = false;

		o = s.taboption('additional', widgets.NetworkSelect, 'trm_laniface', _('LAN Interface'), _('Select the logical LAN network interface, default is \'lan\'.'));
		o.multiple = false;
		o.nocreate = true;
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.ListValue, 'trm_nice', _('Service Priority'), _('The selected priority will be used for travelmate processes.'));
		o.value('-20', _('Highest Priority'));
		o.value('-10', _('High Priority'));
		o.value('0', _('Normal Priority'));
		o.value('10', _('Less Priority'));
		o.value('19', _('Least Priority'));
		o.placeholder = _('-- default --');
		o.optional = true;
		o.rmempty = true;

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

		o = s.taboption('additional', form.Value, 'trm_captiveurl', _('Captive Portal URL'), _('The selected URL will be used for connectivity- and captive portal checks.'));
		o.value('http://detectportal.firefox.com', 'Firefox');
		o.value('http://connectivity-check.ubuntu.com', 'Ubuntu');
		o.value('http://captive.apple.com', 'Apple');
		o.value('http://connectivitycheck.android.com/generate_204', 'Google');
		o.value('http://www.msftncsi.com/ncsi.txt', 'Microsoft');
		o.placeholder = _('-- default --');
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'trm_useragent', _('User Agent'), _('The selected user agent will be used for connectivity- and captive portal checks.'));
		o.value('Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0', 'Firefox');
		o.value('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 'Chromium');
		o.value('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 'Safari');
		o.value('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.3537.71', 'Edge');
		o.value('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/122.0.0.0', 'Opera');
		o.placeholder = _('-- default --');
		o.optional = true;
		o.rmempty = true;

		/*
			advanced email settings tab
		*/
		o = s.taboption('adv_email', form.DummyValue, '_sub');
		o.rawhtml = true;
		o.default = '<em style="color:#37c;font-weight:bold;">' + _('Changes on this tab needs a travelmate service restart to take effect.') + '</em>'
			+ '<hr style="width: 200px; height: 1px;" />';

		o = s.taboption('adv_email', form.Flag, 'trm_mail', _('E-Mail Notification'), _('Sends notification E-Mails after every succesful uplink connect.'));
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

		s = m.section(form.NamedSection, 'global');
		s.render = L.bind(function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Interface Setup',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('setup');
					})
				}, [_('Interface Wizard...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Restart Interface',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('restartInterface');
					})
				}, [_('Interface Restart')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply important',
					'style': 'float:none;margin-right:.4em;',
					'title': 'QRCode',
					'id': 'btn_suspend',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('qrcode');
					})
				}, [_('AP QR-Codes...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Save & Restart',
					'click': function () {
						return handleAction('restartTravelmate');
					}
				}, [_('Save & Restart')])
			])
		});
		return m.render();
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
