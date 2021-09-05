'use strict';
'require view';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require network';
'require tools.widgets as widgets';

/*
	change the status of travelmate stations
*/
function handleToggle(sid) {
	var w_device, w_ssid, w_bssid, t_sections, row, element, value, enabled;

	w_device = uci.get('wireless', sid, 'device');
	w_ssid = uci.get('wireless', sid, 'ssid');
	w_bssid = uci.get('wireless', sid, 'bssid');
	t_sections = uci.sections('travelmate', 'uplink');

	for (var i = 0; i < t_sections.length; i++) {
		if (t_sections[i].device === w_device && t_sections[i].ssid === w_ssid && t_sections[i].bssid === w_bssid) {
			value = t_sections[i]['enabled'];
			value = (value == 0 ? 1 : 0);
			enabled = (value == 0 ? 'No' : 'Yes');
			uci.set('travelmate', t_sections[i]['.name'], 'enabled', value);
			uci.save().then(function () {
				row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(sid));
				element = row.querySelector('.cbi-value-field');
				element.textContent = enabled;
				row.setAttribute('style', 'opacity: 0.5; color: #37c !important;');
			});
		}
	}
}

/*
	remove wireless and stale travelmate sections
*/
function handleRemove(sid) {
	var w_sections, t_sections, match, row;

	uci.remove('wireless', sid);
	w_sections = uci.sections('wireless', 'wifi-iface');
	t_sections = uci.sections('travelmate', 'uplink');
	for (var i = 0; i < t_sections.length; i++) {
		match = false;
		for (var j = 0; j < w_sections.length; j++) {
			if (t_sections[i].device === w_sections[j].device && t_sections[i].ssid === w_sections[j].ssid && t_sections[i].bssid === w_sections[j].bssid) {
				match = true;
				break;
			}
		}
		if (match === false) {
			uci.remove('travelmate', t_sections[i]['.name']);
		}
	}
	return uci.save().then(function () {
		row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(sid));
		row.setAttribute('style', 'opacity: 0.5; color: #a22 !important;');
	});
}

/*
	add missing travelmate sections
*/
function handleSectionsAdd(iface) {
	var w_sections, t_sections, match;

	w_sections = uci.sections('wireless', 'wifi-iface');
	t_sections = uci.sections('travelmate', 'uplink');
	for (var i = 0; i < w_sections.length; i++) {
		if (w_sections[i].mode !== 'sta' || w_sections[i].network !== iface) {
			continue;
		}
		match = false;
		for (var j = 0; j < t_sections.length; j++) {
			if (w_sections[i].device === t_sections[j].device && w_sections[i].ssid === t_sections[j].ssid && w_sections[i].bssid === t_sections[j].bssid) {
				match = true;
				break;
			}
		}
		if (match === false) {
			var sid = uci.add('travelmate', 'uplink');
			uci.set('travelmate', sid, 'enabled', '1');
			uci.set('travelmate', sid, 'device', w_sections[i].device);
			uci.set('travelmate', sid, 'ssid', w_sections[i].ssid);
			uci.set('travelmate', sid, 'bssid', w_sections[i].bssid);
			uci.set('travelmate', sid, 'con_start_expiry', '0');
			uci.set('travelmate', sid, 'con_end_expiry', '0');
		}
	}
}

/*
	update travelmate sections
*/
function handleSectionsVal(action, section_id, option, value) {
	var date, oldValue, w_device, w_ssid, w_bssid, t_sections;

	w_device = uci.get('wireless', section_id, 'device');
	w_ssid = uci.get('wireless', section_id, 'ssid');
	w_bssid = uci.get('wireless', section_id, 'bssid');
	t_sections = uci.sections('travelmate', 'uplink');

	for (var i = 0; i < t_sections.length; i++) {
		if (t_sections[i].device === w_device && t_sections[i].ssid === w_ssid && t_sections[i].bssid === w_bssid) {
			if (action === 'get') {
				return t_sections[i][option];
			}
			else if (action === 'set') {
				if (option === 'enabled') {
					oldValue = t_sections[i][option];
					if (oldValue !== value && value === '0') {
						date = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60 * 1000).toISOString().substr(0, 19).replace(/-/g, '.').replace('T', '-');
						uci.set('travelmate', t_sections[i]['.name'], 'con_end', date);
					}
					else if (oldValue !== value && value === '1') {
						uci.unset('travelmate', t_sections[i]['.name'], 'con_end');
					}
				}
				return uci.set('travelmate', t_sections[i]['.name'], option, value);
			}
			else if (action === 'del') {
				return uci.unset('travelmate', t_sections[i]['.name'], option);
			}
		}
	}
}

/*
	update travelmate status
*/
function handleStatus() {
	poll.add(function () {
		L.resolveDefault(fs.stat('/var/state/travelmate.refresh'), null).then(function (res) {
			if (res) {
				L.resolveDefault(fs.read_direct('/var/state/travelmate.refresh'), null).then(async function (res) {
					fs.remove('/var/state/travelmate.refresh');
					if (res && res === 'ui_reload') {
						location.reload();
					}
					else if (res && res === 'cfg_reload') {
						if (document.readyState === 'complete') {
							uci.unload('wireless');
							uci.unload('travelmate');
						}
						await Promise.all([
							uci.load('wireless'),
							uci.load('travelmate')
						]);
						var rows, item, value;
						rows = document.querySelectorAll('.cbi-section-table-row[data-sid]');
						for (var i = 0; i < rows.length; i++) {
							item = rows[i].querySelector('.cbi-value-field[data-title="Enabled"]');
							value = handleSectionsVal('get', rows[i].getAttribute('data-sid'), 'enabled');
							item.textContent = (value == 0 ? 'No' : 'Yes');
						}
					}
				});
			}
		});
		return L.resolveDefault(fs.stat('/tmp/trm_runtime.json'), null).then(function (res) {
			if (res) {
				L.resolveDefault(fs.read_direct('/tmp/trm_runtime.json'), null).then(function (res) {
					if (res) {
						var info = JSON.parse(res);
						if (info) {
							var t_device, t_ssid, t_bssid, oldUplinkView, newUplinkView, uplinkColor,
								uplinkId = info.data.station_id.trim().split('/'),
								oldUplinkView = document.getElementsByName('uplinkStation'),
								w_sections = uci.sections('wireless', 'wifi-iface'),
								vpnStatus = info.data.ext_hooks.substr(13, 1);
							t_device = uplinkId[0];
							t_bssid = uplinkId[uplinkId.length - 1];
							for (var i = 1; i < uplinkId.length - 1; i++) {
								if (!t_ssid) {
									t_ssid = uplinkId[i];
								}
								else {
									t_ssid = t_ssid + '/' + uplinkId[i];
								}
							}
							if (t_ssid === '-') {
								if (oldUplinkView.length > 0) {
									oldUplinkView[0].removeAttribute('style');
									oldUplinkView[0].removeAttribute('name', 'uplinkStation');
								}
							}
							else {
								uplinkColor = (vpnStatus === "✔" ? 'rgb(68, 170, 68)' : 'rgb(51, 119, 204)');
								for (var i = 0; i < w_sections.length; i++) {
									newUplinkView = document.getElementById('cbi-wireless-' + w_sections[i]['.name']);
									if (t_device === w_sections[i].device && t_ssid === w_sections[i].ssid && t_bssid === (w_sections[i].bssid || '-')) {
										if (oldUplinkView.length === 0 && newUplinkView) {
											newUplinkView.setAttribute('name', 'uplinkStation');
											newUplinkView.setAttribute('style', 'text-align: left !important; color: ' + uplinkColor + ' !important;font-weight: bold !important;');
										}
										else if (oldUplinkView.length > 0 && newUplinkView && oldUplinkView[0].getAttribute('id') !== newUplinkView.getAttribute('id')) {
											oldUplinkView[0].removeAttribute('style');
											oldUplinkView[0].removeAttribute('name', 'uplinkStation');
											newUplinkView.setAttribute('name', 'uplinkStation');
											newUplinkView.setAttribute('style', 'text-align: left !important; color: ' + uplinkColor + ' !important;font-weight: bold !important;');
										}
										else if (newUplinkView && newUplinkView.style.color != uplinkColor) {
											newUplinkView.setAttribute('style', 'text-align: left !important; color: ' + uplinkColor + ' !important;font-weight: bold !important;');
										}
									}
								}
							}
						}
					}
				});
			}
		});
	}, 1);
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/travelmate', ['assoc']), {}),
			uci.load('wireless'),
			uci.load('travelmate')
		]);
	},

	render: function (result) {
		var m, s, o,
			iface = uci.get('travelmate', 'global', 'trm_iface') || 'trm_wwan';

		m = new form.Map('wireless');
		m.chain('travelmate');
		s = m.section(form.GridSection, 'wifi-iface', null, _('Overview of all configured uplinks for travelmate. \
			You can edit, remove or prioritize existing uplinks by drag \&#38; drop and scan for new ones.<br /> \
			The currently used uplink connection is emphasized in <span style="color:rgb(51, 119, 204);font-weight:bold">blue</span>, \
			an encrypted VPN uplink connection is emphasized in <span style="color:rgb(68, 170, 68);font-weight:bold">green</span>.'));
		s.anonymous = true;
		s.sortable = true;
		s.filter = function (section_id) {
			return (uci.get('wireless', section_id, 'network') == iface && uci.get('wireless', section_id, 'mode') == 'sta');
		};
		s.tab('wireless', _('Wireless Settings'));
		s.tab('travelmate', _('Travelmate Settings'));
		s.tab('vpn', _('VPN Settings'));
		s.renderRowActions = function (section_id) {
			var btns;
			btns = [
				E('button', {
					'class': 'btn cbi-button drag-handle center',
					'title': _('Drag to reorder'),
					'style': 'cursor:move',
					'disabled': this.map.readonly || null
				}, '☰'),
				E('button', {
					'class': 'cbi-button cbi-button-action important',
					'title': _('Edit this network'),
					'click': ui.createHandlerFn(this, 'renderMoreOptionsModal', section_id)
				}, _('Edit')),
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'title': _('Enable/Disable this network'),
					'click': ui.createHandlerFn(this, handleToggle, section_id)
				}, _('On/Off')),
				E('button', {
					'class': 'cbi-button cbi-button-negative remove',
					'title': _('Remove this network'),
					'click': ui.createHandlerFn(this, handleRemove, section_id)
				}, _('Remove'))
			];
			return E('td', { 'class': 'td middle cbi-section-actions' }, E('div', btns));
		};

		o = s.taboption('travelmate', form.Flag, '_enabled', _('Enabled'));
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'enabled';
		o.rmempty = false;
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'enabled');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'enabled', value);
		}

		o = s.taboption('wireless', form.Value, 'device', _('Device'));
		o.readonly = true;

		o = s.taboption('wireless', form.Value, 'ssid', _('SSID'));
		o.datatype = 'maxlength(32)';
		o.readonly = true;

		o = s.taboption('wireless', form.Value, 'bssid', _('BSSID'));
		o.datatype = 'macaddr';
		o.readonly = true;

		o = s.taboption('wireless', form.ListValue, 'encryption', _('Encryption'));
		o.value('sae', _('WPA3 Pers. (SAE)'));
		o.value('sae-mixed', _('WPA2/WPA3 Pers. (CCMP)'));
		o.value('psk2', _('WPA2 Pers.'));
		o.value('psk2+ccmp', _('WPA2 Pers. (CCMP)'));
		o.value('psk2+tkip', _('WPA2 Pers. (TKIP)'));
		o.value('psk', _('WPA Pers.'));
		o.value('psk+ccmp', _('WPA Pers. (CCMP)'));
		o.value('psk+tkip', _('WPA Pers. (TKIP)'));
		o.value('psk-mixed+ccmp', _('WPA/WPA2 Pers. (CCMP)'));
		o.value('psk-mixed+tkip', _('WPA/WPA2 Pers. (TKIP)'));
		o.value('wpa3', _('WPA3 Ent. (CCMP)'));
		o.value('wpa3-mixed', _('WPA2/WPA3 Ent. (CCMP)'));
		o.value('wpa2', _('WPA2 Ent.'));
		o.value('wpa2+ccmp', _('WPA2 Ent. (CCMP)'));
		o.value('wpa2+tkip', _('WPA2 Ent. (TKIP)'));
		o.value('wpa+ccmp', _('WPA Ent. (CCMP)'));
		o.value('wpa+tkip', _('WPA Ent. (TKIP)'));
		o.value('wpa-mixed+ccmp', _('WPA/WPA2 Ent. (CCMP)'));
		o.value('wpa-mixed+tkip', _('WPA/WPA2 Ent. (TKIP)'));
		o.value('owe', _('OWE'));
		o.value('none', _('none'));
		o.default = 'none';
		o.textvalue = function (section_id) {
			var cfgvalue = this.map.data.get('wireless', section_id, 'encryption');
			switch (cfgvalue) {
				case 'sae':
					cfgvalue = 'WPA3 Pers. (SAE)';
					break;
				case 'sae-mixed':
					cfgvalue = 'WPA2/WPA3 Pers. (CCMP)';
					break;
				case 'psk2':
					cfgvalue = 'WPA2 Pers.';
					break;
				case 'psk2+ccmp':
					cfgvalue = 'WPA2 Pers. (CCMP)';
					break;
				case 'psk2+tkip':
					cfgvalue = 'WPA2 Ent. (TKIP)';
					break;
				case 'psk':
					cfgvalue = 'WPA Pers.';
					break;
				case 'psk-mixed+ccmp':
					cfgvalue = 'WPA/WPA2 Pers. (CCMP)';
					break;
				case 'psk-mixed+tkip':
					cfgvalue = 'WPA/WPA2 Pers. (TKIP)';
					break;
				case 'wpa3':
					cfgvalue = 'WPA3 Ent. (CCMP)';
					break;
				case 'wpa3-mixed':
					cfgvalue = 'WPA2/WPA3 Ent. (CCMP)';
					break;
				case 'wpa2':
					cfgvalue = 'WPA2 Ent.';
					break;
				case 'wpa2+ccmp':
					cfgvalue = 'WPA2 Ent. (CCMP)';
					break;
				case 'wpa2+tkip':
					cfgvalue = 'WPA2 Ent. (TKIP)';
					break;
				case 'wpa+ccmp':
					cfgvalue = 'WPA Ent. (CCMP)';
					break;
				case 'wpa+tkip':
					cfgvalue = 'WPA Ent. (TKIP)';
					break;
				case 'wpa-mixed+ccmp':
					cfgvalue = 'WPA/WPA2 Ent. (CCMP)';
					break;
				case 'wpa-mixed+tkip':
					cfgvalue = 'WPA/WPA2 Ent. (TKIP)';
					break;
				case 'owe':
					cfgvalue = 'WPA3 OWE (CCMP)';
					break;
				case 'none':
					cfgvalue = 'none';
					break;
			}
			return cfgvalue;
		};
		handleStatus();

		/*
			modal wireless tab
		*/
		o = s.taboption('wireless', form.Value, 'key', _('Password'));
		o.datatype = 'wpakey';
		o.depends({ encryption: 'sae', '!contains': true });
		o.depends({ encryption: 'psk', '!contains': true });
		o.modalonly = true;
		o.password = true;

		o = s.taboption('wireless', form.Value, 'password', _('Password'));
		o.datatype = 'wpakey';
		o.depends({ encryption: 'wpa', '!contains': true });
		o.modalonly = true;
		o.password = true;

		o = s.taboption('wireless', form.ListValue, 'eap_type', _('EAP-Method'));
		o.depends({ encryption: 'wpa', '!contains': true });
		o.value('tls', _('TLS'));
		o.value('ttls', _('TTLS'));
		o.value('peap', _('PEAP'));
		o.value('fast', _('FAST'));
		o.default = 'peap';
		o.modalonly = true;

		o = s.taboption('wireless', form.ListValue, 'auth', _('Authentication'));
		o.value('PAP', _('PAP'));
		o.value('CHAP', _('CHAP'));
		o.value('MSCHAP', _('MSCHAP'));
		o.value('MSCHAPV2', _('MSCHAPV2'));
		o.value('EAP-GTC', _('EAP-GTC'));
		o.value('EAP-MD5', _('EAP-MD5'));
		o.value('EAP-MSCHAPV2', _('EAP-MSCHAPV2'));
		o.value('EAP-TLS', _('EAP-TLS'));
		o.value('auth=PAP', _('auth=PAP'));
		o.value('auth=MSCHAPV2', _('auth=MSCHAPV2'));
		o.default = 'EAP-MSCHAPV2';
		o.depends({ encryption: 'wpa', '!contains': true });
		o.modalonly = true;

		o = s.taboption('wireless', form.Value, 'identity', _('Identity'));
		o.depends({ encryption: 'wpa', '!contains': true });
		o.modalonly = true;

		o = s.taboption('wireless', form.Value, 'anonymous_identity', _('Anonymous Identity'));
		o.depends({ encryption: 'wpa', '!contains': true });
		o.modalonly = true;

		o = s.taboption('wireless', form.ListValue, 'ieee80211w', _('Mgmt. Frame Protection'));
		o.depends({ encryption: 'sae', '!contains': true });
		o.depends({ encryption: 'owe', '!contains': true });
		o.depends({ encryption: 'wpa', '!contains': true });
		o.depends({ encryption: 'psk', '!contains': true });
		o.value('', _('Disabled'));
		o.value('1', _('Optional'));
		o.value('2', _('Required'));
		o.modalonly = true;
		o.defaults = {
			'2': [{ encryption: 'sae' }, { encryption: 'owe' }, { encryption: 'wpa3' }, { encryption: 'wpa3-mixed' }],
			'1': [{ encryption: 'sae-mixed' }],
			'': []
		};

		o = s.taboption('wireless', form.Flag, 'ca_cert_usesystem', _('Use system certificates'), _("Validate server certificate using built-in system CA bundle"));
		o.depends({ encryption: 'wpa', '!contains': true });
		o.enabled = '1';
		o.disabled = '0';
		o.modalonly = true;
		o.default = o.disabled;

		o = s.taboption('wireless', form.Value, 'ca_cert', _('Path to CA-Certificate'));
		o.depends({ encryption: 'wpa', '!contains': true });
		o.depends({ ca_cert_usesystem: '0' });
		o.modalonly = true;
		o.rmempty = true;

		o = s.taboption('wireless', form.Value, 'client_cert', _('Path to Client-Certificate'));
		o.depends({ eap_type: 'tls' });
		o.modalonly = true;
		o.rmempty = true;

		o = s.taboption('wireless', form.Value, 'priv_key', _('Path to Private Key'));
		o.depends({ eap_type: 'tls' });
		o.modalonly = true;
		o.rmempty = true;

		o = s.taboption('wireless', form.Value, 'priv_key_pwd', _('Password of Private Key'));
		o.depends({ eap_type: 'tls' });
		o.modalonly = true;
		o.password = true;
		o.rmempty = true;

		/*
			modal travelmate tab
		*/
		var mac, mac_array = [];
		if (result[0]) {
			mac_array = result[0].trim().split('\n');
		}

		o = s.taboption('travelmate', form.Value, '_ssid', _('SSID'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'ssid';
		o.rmempty = false;
		o.readonly = true;
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'ssid');
		}

		o = s.taboption('travelmate', form.Value, '_bssid', _('BSSID'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'bssid';
		o.rmempty = true;
		o.readonly = true;
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'bssid');
		}

		o = s.taboption('travelmate', form.Value, '_con_start', _('Connection Start'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'con_start';
		o.rmempty = true;
		o.readonly = true;
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'con_start');
		}

		o = s.taboption('travelmate', form.Value, '_con_end', _('Connection End'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'con_end';
		o.rmempty = true;
		o.readonly = true;
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'con_end');
		}

		o = s.taboption('travelmate', form.Flag, '_opensta', _('Auto Added Open Uplink'),
			_('This option is selected by default if this uplink was added automatically and counts as \'Open Uplink\'.'));
		o.rmempty = true;
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'opensta';
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'opensta');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'opensta', value);
		}
		o.remove = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'opensta', value);
		}

		o = s.taboption('travelmate', form.Value, '_macaddr', _('MAC Address'),
			_('Use the specified MAC address for this uplink.'));
		for (var i = 0; i < mac_array.length; i++) {
			if (mac_array[i].match(/^\s+([0-9A-Fa-f]{2}[:]?){5}[0-9A-Fa-f]{2}/)) {
				mac = mac_array[i].slice(4).trim();
				o.value(mac);
			}
		}
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'macaddr';
		o.nocreate = false;
		o.unspecified = true;
		o.rmempty = true;
		o.datatype = 'macaddr';
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'macaddr');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'macaddr', value);
		}
		o.remove = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'macaddr', value);
		}

		o = s.taboption('travelmate', form.Value, '_con_start_expiry', _('Connection Start Expiry'),
			_('Automatically disable the uplink after <em>n</em> minutes, e.g. for timed connections.<br /> \
			The default of \'0\' disables this feature.'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'con_start_expiry';
		o.rmempty = false;
		o.placeholder = '0';
		o.default = '0';
		o.datatype = 'range(0,720)';
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'con_start_expiry');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'con_start_expiry', value);
		}

		o = s.taboption('travelmate', form.Value, '_con_end_expiry', _('Connection End Expiry'),
			_('Automatically (re-)enable the uplink after <em>n</em> minutes, e.g. after failed login attempts.<br /> \
			The default of \'0\' disables this feature.'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'con_end_expiry';
		o.rmempty = false;
		o.placeholder = '0';
		o.default = '0';
		o.datatype = 'range(0,720)';
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'con_end_expiry');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'con_end_expiry', value);
		}

		o = s.taboption('travelmate', form.FileUpload, '_script', _('Auto Login Script'),
			_('External script reference which will be called for automated captive portal logins.'));
		o.root_directory = '/etc/travelmate';
		o.enable_remove = false;
		o.enable_upload = false;
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'script';
		o.renderWidget = function (section_id, option_index, cfgvalue) {
			var browserEl = new ui.FileUpload((cfgvalue != null) ? cfgvalue : this.default, {
				id: this.cbid(section_id),
				name: this.cbid(section_id),
				show_hidden: this.show_hidden,
				enable_upload: this.enable_upload,
				enable_remove: this.enable_remove,
				root_directory: this.root_directory,
				disabled: (this.readonly != null) ? this.readonly : this.map.readonly
			});
			browserEl.renderListing = function (container, path, list) {
				return ui.FileUpload.prototype.renderListing.apply(this, [
					container, path,
					list.filter(function (entry) {
						return ((entry.type == 'directory') || (entry.type == 'file' && entry.name.match(/\.login$/)));
					})
				]);
			};
			return browserEl.render();
		};
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'script');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'script', value);
		}
		o.remove = function (section_id) {
			return handleSectionsVal('del', section_id, 'script');
		}

		o = s.taboption('travelmate', form.Value, '_args', _('Script Arguments'),
			_('Space separated list of additional arguments passed to the Auto Login Script, i.e. username and password'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'script_args';
		o.rmempty = true;
		o.depends({ _script: '/etc/travelmate', '!contains': true });
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'script_args');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'script_args', value);
		}
		o.remove = function (section_id) {
			return handleSectionsVal('del', section_id, 'script_args');
		}

		/*
			modal vpn tab
		*/
		o = s.taboption('vpn', form.Flag, '_vpn', _('VPN Hook'), _('Automatically handle VPN connections.<br /> \
			Please note: This feature requires the additional configuration of <em>Wireguard</em> or <em>OpenVPN</em>.'));
		o.rmempty = true;
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'vpn';
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'vpn');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'vpn', value);
		}
		o.remove = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'vpn', value);
		}

		o = s.taboption('vpn', form.ListValue, '_vpnservice', _('VPN Service'));
		o.value('wireguard');
		o.value('openvpn');
		o.optional = true;
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'vpnservice';
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'vpnservice');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'vpnservice', value);
		}

		o = s.taboption('vpn', widgets.NetworkSelect, '_vpniface', _('VPN Interface'), _('The logical vpn network interface, e.g. \'wg0\' or \'tun0\'.'));
		o.unspecified = false;
		o.nocreate = true;
		o.optional = true;
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'vpniface';
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'vpniface');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'vpniface', value);
		}

		/*
			scan buttons
		*/
		s = m.section(form.GridSection, 'wifi-device');
		s.anonymous = true;
		s.addremove = false;
		s.render = function () {
			return network.getWifiDevices().then(L.bind(function (radios) {
				var radio, ifname, btns = [];
				for (var i = 0; i < radios.length; i++) {
					radio = radios[i].sid;
					if (radio) {
						btns.push(E('button', {
							'class': 'cbi-button cbi-button-apply',
							'id': radio,
							'click': ui.createHandlerFn(this, 'handleScan', radio)
						}, [_('Scan on ' + radio + '...')]),
							'\xa0')
					}
				}
				return E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, E('div', { 'class': 'left', 'style': 'padding-top:5px; padding-bottom:5px' }, btns));
			}, this))
		};

		/*
			modal 'scan' dialog
		*/
		s.handleScan = function (radio) {
			var table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th col-1 middle left' }, _('Strength')),
					E('th', { 'class': 'th col-1 middle left hide-xs' }, _('Channel')),
					E('th', { 'class': 'th col-2 middle left' }, _('SSID')),
					E('th', { 'class': 'th col-2 middle left' }, _('BSSID')),
					E('th', { 'class': 'th col-3 middle left' }, _('Encryption')),
					E('th', { 'class': 'th cbi-section-actions right' }, '\xa0')
				])
			]);
			cbi_update_table(table, [], E('em', { class: 'spinning' }, _('Starting wireless scan on \'' + radio + '\'...')));

			var md = ui.showModal(_('Wireless Scan'), [
				table,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.hideModal
					}, _('Dismiss')),
					'\xa0',
					E('button', {
						'class': 'cbi-button cbi-button-positive important',
						'click': L.bind(this.handleScan, this, radio)
					}, _('Repeat Scan'))
				])
			]);

			md.style.maxWidth = '90%';
			md.style.maxHeight = 'none';

			return L.resolveDefault(fs.exec_direct('/etc/init.d/travelmate', ['scan', radio]), null)
				.then(L.bind(function (res) {
					var lines, strength, channel, encryption, tbl_encryption, bssid, ssid, tbl_ssid, rows = [];
					if (res) {
						lines = res.trim().split('\n');
						for (var i = 0; i < lines.length; i++) {
							if (lines[i].match(/^\s+[0-9]/)) {
								encryption = lines[i].slice(80).trim();
								if (!encryption.includes('WEP')) {
									strength = lines[i].slice(4, 7).trim();
									channel = lines[i].slice(15, 18).trim();
									bssid = lines[i].slice(60, 77).trim();
									ssid = lines[i].slice(25, 59).trim();
									if (ssid.startsWith('"')) {
										ssid = ssid.slice(1, ssid.length - 1);
										tbl_ssid = ssid;
									}
									else {
										ssid = "hidden";
										tbl_ssid = "<em>hidden</em>";
									}
									switch (encryption) {
										case 'WPA3 PSK (SAE)':
											encryption = 'sae';
											tbl_encryption = 'WPA3 Pers. (SAE)';
											break;
										case 'mixed WPA2/WPA3 PSK/SAE (CCMP)':
											encryption = 'sae-mixed';
											tbl_encryption = 'WPA2/WPA3 Pers. (CCMP)';
											break;
										case 'WPA2 PSK (CCMP)':
											encryption = 'psk2+ccmp';
											tbl_encryption = 'WPA2 Pers. (CCMP)';
											break;
										case 'WPA2 PSK (TKIP)':
											encryption = 'psk2+tkip';
											tbl_encryption = 'WPA2 Pers. (TKIP)';
											break;
										case 'mixed WPA/WPA2 PSK (TKIP, CCMP)':
											encryption = 'psk-mixed+ccmp';
											tbl_encryption = 'WPA/WPA2 Pers. (CCMP)';
											break;
										case 'WPA PSK (CCMP)':
											encryption = 'psk2+ccmp';
											tbl_encryption = 'WPA Pers. (CCMP)';
											break;
										case 'WPA PSK (TKIP)':
											encryption = 'psk2+tkip';
											tbl_encryption = 'WPA Pers. (TKIP)';
											break;
										case 'WPA3 802.1X (CCMP)':
											encryption = 'wpa3';
											tbl_encryption = 'WPA3 Ent. (CCMP)';
											break;
										case 'mixed WPA2/WPA3 802.1X (CCMP)':
											encryption = 'wpa3-mixed';
											tbl_encryption = 'WPA2/WPA3 Ent. (CCMP)';
											break;
										case 'WPA2 802.1X':
											encryption = 'wpa2';
											tbl_encryption = 'WPA2 Ent.';
											break;
										case 'WPA2 802.1X (CCMP)':
											encryption = 'wpa2+ccmp';
											tbl_encryption = 'WPA2 Ent. (CCMP)';
											break;
										case 'WPA3 OWE (CCMP)':
											encryption = 'owe';
											tbl_encryption = 'WPA3 OWE (CCMP)';
											break;
										case 'none':
											encryption = 'none';
											tbl_encryption = 'none';
											break;
									}
									rows.push([
										strength,
										channel,
										tbl_ssid,
										bssid,
										tbl_encryption,
										E('div', { 'class': 'right' }, E('button', {
											'class': 'cbi-button cbi-button-action',
											'click': ui.createHandlerFn(this, 'handleAdd', radio, iface, ssid, bssid, encryption)
										}, _('Add Uplink...')))
									]);
								}
							}
							else if (lines[i] === '::: Empty resultset') {
								rows.push([
									'No scan results (empty resultset)'
								]);
							}
						}
					}
					else {
						rows.push([
							'No scan results (timeout)'
						]);
					}
					cbi_update_table(table, rows);
				}, this));
		};

		/*
			modal 'add' dialog
		*/
		s.handleAdd = function (radio, iface, ssid, bssid, encryption, ev) {
			var m2, s2, o2;

			m2 = new form.Map('wireless'),
				s2 = m2.section(form.NamedSection, '_add_trm');

			s2.render = function () {
				return Promise.all([
					{},
					this.renderUCISection('_add_trm')
				]).then(this.renderContents.bind(this));
			};

			o2 = s2.option(form.Value, 'device', _('Device Name'));
			o2.default = radio;
			o2.readonly = true;

			o2 = s2.option(form.Value, 'network', _('Interface Name'));
			o2.default = iface;
			o2.readonly = true;

			if (ssid === "hidden") {
				o2 = s2.option(form.Value, 'ssid', _('SSID (hidden)'));
				o2.placeholder = 'hidden SSID';
			}
			else {
				o2 = s2.option(form.Value, 'ssid', _('SSID'));
				o2.default = ssid;
			}
			o2.datatype = 'maxlength(32)';
			o2.rmempty = false;

			o2 = s2.option(form.Flag, 'ignore_bssid', _('Ignore BSSID'));
			if (ssid === "hidden") {
				o2.default = '0';
			}
			else {
				o2.default = '1';
			}

			o2 = s2.option(form.Value, 'bssid', _('BSSID'));
			o2.depends({ ignore_bssid: '0' });
			o2.datatype = 'macaddr';
			o2.rmempty = true;
			o2.default = bssid;

			o2 = s2.option(form.ListValue, 'encryption', _('Encryption'));
			o2.value('sae', _('WPA3 Pers. (SAE)'));
			o2.value('sae-mixed', _('WPA2/WPA3 Pers. (CCMP)'));
			o2.value('psk2', _('WPA2 Pers.'));
			o2.value('psk2+ccmp', _('WPA2 Pers. (CCMP)'));
			o2.value('psk2+tkip', _('WPA2 Pers. (TKIP)'));
			o2.value('psk', _('WPA Pers.'));
			o2.value('psk+ccmp', _('WPA Pers. (CCMP)'));
			o2.value('psk+tkip', _('WPA Pers. (TKIP)'));
			o2.value('psk-mixed+ccmp', _('WPA/WPA2 Pers. (CCMP)'));
			o2.value('psk-mixed+tkip', _('WPA/WPA2 Pers. (TKIP)'));
			o2.value('wpa3', _('WPA3 Ent.'));
			o2.value('wpa3-mixed', _('WPA2/WPA3 Ent.'));
			o2.value('wpa2', _('WPA2 Ent.'));
			o2.value('wpa2+ccmp', _('WPA2 Ent. (CCMP)'));
			o2.value('wpa2+tkip', _('WPA2 Ent. (TKIP)'));
			o2.value('wpa+ccmp', _('WPA Ent. (CCMP)'));
			o2.value('wpa+tkip', _('WPA Ent. (TKIP)'));
			o2.value('wpa-mixed+ccmp', _('WPA/WPA2 Ent. (CCMP)'));
			o2.value('wpa-mixed+tkip', _('WPA/WPA2 Ent. (TKIP)'));
			o2.value('owe', _('WPA3 OWE (CCMP)'));
			o2.value('none', _('none'));
			o2.default = encryption;

			o2 = s2.option(form.Value, 'key', _('Password'));
			o2.depends({ encryption: 'sae', '!contains': true });
			o2.depends({ encryption: 'psk', '!contains': true });
			o2.datatype = 'wpakey';
			o2.password = true;

			o2 = s2.option(form.Value, 'password', _('Password'));
			o2.depends({ encryption: 'wpa', '!contains': true });
			o2.datatype = 'wpakey';
			o2.password = true;

			o2 = s2.option(form.ListValue, 'eap_type', _('EAP-Method'));
			o2.depends({ encryption: 'wpa', '!contains': true });
			o2.value('tls', _('TLS'));
			o2.value('ttls', _('TTLS'));
			o2.value('peap', _('PEAP'));
			o2.value('fast', _('FAST'));
			o2.default = 'peap';

			o2 = s2.option(form.ListValue, 'auth', _('Authentication'));
			o2.depends({ encryption: 'wpa', '!contains': true });
			o2.value('PAP', _('PAP'));
			o2.value('CHAP', _('CHAP'));
			o2.value('MSCHAP', _('MSCHAP'));
			o2.value('MSCHAPV2', _('MSCHAPV2'));
			o2.value('EAP-GTC', _('EAP-GTC'));
			o2.value('EAP-MD5', _('EAP-MD5'));
			o2.value('EAP-MSCHAPV2', _('EAP-MSCHAPV2'));
			o2.value('EAP-TLS', _('EAP-TLS'));
			o2.value('auth=PAP', _('auth=PAP'));
			o2.value('auth=MSCHAPV2', _('auth=MSCHAPV2'));
			o2.default = 'EAP-MSCHAPV2';

			o2 = s2.option(form.Value, 'identity', _('Identity'));
			o2.depends({ encryption: 'wpa', '!contains': true });

			o2 = s2.option(form.Value, 'anonymous_identity', _('Anonymous Identity'));
			o2.depends({ encryption: 'wpa', '!contains': true });
			o2.rmempty = true;

			o2 = s2.option(form.ListValue, 'ieee80211w', _('Mgmt. Frame Protection'));
			o2.depends({ encryption: 'sae', '!contains': true });
			o2.depends({ encryption: 'owe', '!contains': true });
			o2.depends({ encryption: 'wpa', '!contains': true });
			o2.depends({ encryption: 'psk', '!contains': true });	
			o2.value('', _('Disabled'));
			o2.value('1', _('Optional'));
			o2.value('2', _('Required'));
			o2.defaults = {
				'2': [{ encryption: 'sae' }, { encryption: 'owe' }, { encryption: 'wpa3' }, { encryption: 'wpa3-mixed' }],
				'1': [{ encryption: 'sae-mixed' }],
				'': []
			};

			o2 = s2.option(form.Flag, 'ca_cert_usesystem', _('Use system certificates'), _("Validate server certificate using built-in system CA bundle"));
			o2.depends({ encryption: 'wpa', '!contains': true });
			o2.enabled = '1';
			o2.disabled = '0';
			o2.default = o.disabled;

			o2 = s2.option(form.Value, 'ca_cert', _('Path to CA-Certificate'));
			o2.depends({ encryption: 'wpa', '!contains': true });
			o2.depends({ ca_cert_usesystem: '0' });
			o2.rmempty = true;

			o2 = s2.option(form.Value, 'client_cert', _('Path to Client-Certificate'));
			o2.depends({ eap_type: 'tls' });
			o2.rmempty = true;

			o2 = s2.option(form.Value, 'priv_key', _('Path to Private Key'));
			o2.depends({ eap_type: 'tls' });
			o2.rmempty = true;

			o2 = s2.option(form.Value, 'priv_key_pwd', _('Password of Private Key'));
			o2.depends({ eap_type: 'tls' });
			o2.password = true;
			o2.rmempty = true;

			return m2.render().then(L.bind(function (elements) {
				ui.showModal(_('Add Uplink %q').replace(/%q/, '"%h"'.format(ssid)), [
					elements,
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Dismiss')),
						'\xa0',
						E('button', {
							'class': 'cbi-button cbi-button-positive important',
							'click': ui.createHandlerFn(this, 'handleCommit', m2)
						}, _('Save'))
					])
				]);
			}, this));
		};

		/*
			save new uplink
		*/
		s.handleCommit = function (map, ev) {
			var w_sections = uci.sections('wireless', 'wifi-iface'),
				device = L.toArray(map.lookupOption('device', '_add_trm'))[0].formvalue('_add_trm'),
				network = L.toArray(map.lookupOption('network', '_add_trm'))[0].formvalue('_add_trm'),
				ssid = L.toArray(map.lookupOption('ssid', '_add_trm'))[0].formvalue('_add_trm'),
				ignore_bssid = L.toArray(map.lookupOption('ignore_bssid', '_add_trm'))[0].formvalue('_add_trm'),
				bssid = L.toArray(map.lookupOption('bssid', '_add_trm'))[0].formvalue('_add_trm'),
				encryption = L.toArray(map.lookupOption('encryption', '_add_trm'))[0].formvalue('_add_trm');
			if (encryption.includes('wpa')) {
				var eap_type = L.toArray(map.lookupOption('eap_type', '_add_trm'))[0].formvalue('_add_trm'),
					auth = L.toArray(map.lookupOption('auth', '_add_trm'))[0].formvalue('_add_trm'),
					identity = L.toArray(map.lookupOption('identity', '_add_trm'))[0].formvalue('_add_trm'),
					anonymous_identity = L.toArray(map.lookupOption('anonymous_identity', '_add_trm'))[0].formvalue('_add_trm'),
					password = L.toArray(map.lookupOption('password', '_add_trm'))[0].formvalue('_add_trm'),
					ca_cert_usesystem = L.toArray(map.lookupOption('ca_cert_usesystem', '_add_trm'))[0].formvalue('_add_trm'),
					ca_cert = L.toArray(map.lookupOption('ca_cert', '_add_trm'))[0].formvalue('_add_trm'),
					ieee80211w = L.toArray(map.lookupOption('ieee80211w', '_add_trm'))[0].formvalue('_add_trm');
				if (eap_type.includes('tls')) {
					var client_cert = L.toArray(map.lookupOption('client_cert', '_add_trm'))[0].formvalue('_add_trm'),
						priv_key = L.toArray(map.lookupOption('priv_key', '_add_trm'))[0].formvalue('_add_trm'),
						priv_key_pwd = L.toArray(map.lookupOption('priv_key_pwd', '_add_trm'))[0].formvalue('_add_trm');
				}
			} else {
				var password = L.toArray(map.lookupOption('key', '_add_trm'))[0].formvalue('_add_trm');
			}
			if (!ssid || ((encryption.includes('psk') || encryption.includes('wpa') || encryption.includes('sae')) && !password)) {
				if (!ssid) {
					ui.addNotification(null, E('p', 'Empty SSID, the uplink station could not be saved.'), 'error');
				}
				else {
					ui.addNotification(null, E('p', 'Empty Password, the uplink station could not be saved.'), 'error');
				}
				return ui.hideModal();
			}
			for (var i = 0; i < w_sections.length; i++) {
				if (w_sections[i].device === device && w_sections[i].ssid === ssid) {
					if (ignore_bssid === '1' || (ignore_bssid === '0' && w_sections[i].bssid === bssid)) {
						ui.addNotification(null, E('p', 'Duplicate wireless entry, the uplink station could not be saved.'), 'error');
						return ui.hideModal();
					}
				}
			}

			var offset = w_sections.length,
				new_sid = 'trm_uplink' + (++offset);
			while (uci.get('wireless', new_sid)) {
				new_sid = 'trm_uplink' + (++offset);
			}
			uci.add('wireless', 'wifi-iface', new_sid);
			uci.set('wireless', new_sid, 'device', device);
			uci.set('wireless', new_sid, 'mode', 'sta');
			uci.set('wireless', new_sid, 'network', network);
			uci.set('wireless', new_sid, 'ssid', ssid);
			if (ignore_bssid === '0') {
				uci.set('wireless', new_sid, 'bssid', bssid);
			}
			uci.set('wireless', new_sid, 'encryption', encryption);
			if (encryption.includes('wpa')) {
				uci.set('wireless', new_sid, 'eap_type', eap_type);
				uci.set('wireless', new_sid, 'auth', auth);
				uci.set('wireless', new_sid, 'identity', identity);
				uci.set('wireless', new_sid, 'anonymous_identity', anonymous_identity);
				uci.set('wireless', new_sid, 'password', password);
				uci.set('wireless', new_sid, 'ca_cert_usesystem', ca_cert_usesystem);
				uci.set('wireless', new_sid, 'ca_cert', ca_cert);
				uci.set('wireless', new_sid, 'ieee80211w', ieee80211w);
				if (eap_type.includes('tls')) {
					uci.set('wireless', new_sid, 'client_cert', client_cert);
					uci.set('wireless', new_sid, 'priv_key', priv_key);
					uci.set('wireless', new_sid, 'priv_key_pwd', priv_key_pwd);
				}
			} else {
				uci.set('wireless', new_sid, 'key', password);
			}
			uci.set('wireless', new_sid, 'disabled', '1');
			handleSectionsAdd(network);
			uci.save()
				.then(L.bind(this.map.load, this.map))
				.then(L.bind(this.map.reset, this.map))
				.then(function () {
					var row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(new_sid));
					row.setAttribute('style', 'opacity: 0.5; color: #4a4 !important;');
				})
				.then(ui.hideModal)
		};
		return m.render();
	},
	handleReset: null
});
