'use strict';
'require view';
'require poll';
'require fs';
'require dom';
'require ui';
'require uci';
'require form';
'require network';
'require tools.widgets as widgets';

/*
	Cipher helper function
*/
function resolveCipher(cipherRaw) {
	const cipherMap = {
		'2': { name: 'TKIP', aes: false },
		'4': { name: 'CCMP', aes: true },
		'6': { name: 'BIP', aes: false },
		'8': { name: 'GCMP', aes: true },
		'9': { name: 'GCMP-256', aes: true },
		'10': { name: 'CCMP-256', aes: true },
		'11': { name: 'BIP-GMAC-128', aes: false },
		'12': { name: 'BIP-GMAC-256', aes: false },
		'13': { name: 'BIP-CMAC-256', aes: false }
	};
	if (!cipherRaw) return { name: 'unknown', aes: false };

	// lookup by OUI suite id (e.g. "00-0f-ac:4")
	if (cipherRaw.includes(':')) {
		const id = cipherRaw.split(':').pop();
		if (cipherMap[id]) return cipherMap[id];
		return { name: `unknown (${cipherRaw})`, aes: false };
	}

	// fallback: lookup by name (e.g. raw "CCMP" from iwinfo)
	for (const k in cipherMap) {
		if (cipherMap[k].name === cipherRaw) return cipherMap[k];
	}
	return { name: cipherRaw, aes: false };
}

/*
	resolve the cipher list of a scan result, AES capable if any cipher is
*/
function resolveCiphers(list) {
	if (!list.length) return { name: 'unknown', aes: false };

	const res = list.map(c => resolveCipher(c));

	return { name: res.map(c => c.name).join('+'), aes: res.some(c => c.aes) };
}

/*
	cipher suffix of the encryption value for the cipher list of a scan result:
	CCMP if offered, otherwise the other AES cipher or TKIP, no suffix (cipher
	'auto') if none of them is known
*/
function cipherSuffix(list) {
	const names = list.map(c => resolveCipher(c).name);
	const cipher = [
		[ 'CCMP', 'ccmp' ],
		[ 'GCMP-256', 'gcmp256' ],
		[ 'CCMP-256', 'ccmp256' ],
		[ 'GCMP', 'gcmp' ],
		[ 'TKIP', 'tkip' ]
	].find(c => names.includes(c[0]));

	return cipher ? '+' + cipher[1] : '';
}

/*
	label of an encryption value, any value without a fixed label is labeled
	by its mode and cipher suffix, e.g. 'wpa2+gcmp256' or 'psk2' as written
	by the LuCI wireless page for cipher 'auto'
*/
function encryptionLabel(value) {
	const labels = {
		'sae': _('WPA3 PSK (SAE)'),
		'sae-mixed': _('Mixed WPA2/WPA3 PSK (CCMP)'),
		'psk2+ccmp': _('WPA2 PSK (CCMP)'),
		'psk2+tkip': _('WPA2 PSK (TKIP)'),
		'psk+ccmp': _('WPA PSK (CCMP)'),
		'psk+tkip': _('WPA PSK (TKIP)'),
		'psk-mixed+ccmp': _('Mixed WPA/WPA2 PSK (CCMP)'),
		'psk-mixed+tkip': _('Mixed WPA/WPA2 PSK (TKIP)'),
		'wpa3': _('WPA3 802.1X'),
		'wpa3-mixed': _('Mixed WPA2/WPA3 802.1X'),
		'wpa2+ccmp': _('WPA2 802.1X (CCMP)'),
		'wpa2+tkip': _('WPA2 802.1X (TKIP)'),
		'wpa+ccmp': _('WPA 802.1X (CCMP)'),
		'wpa+tkip': _('WPA 802.1X (TKIP)'),
		'wpa-mixed+ccmp': _('Mixed WPA/WPA2 802.1X (CCMP)'),
		'wpa-mixed+tkip': _('Mixed WPA/WPA2 802.1X (TKIP)'),
		'owe': _('WPA3 OWE'),
		'none': _('Open')
	};
	const modes = {
		'sae': _('WPA3 PSK (SAE)'),
		'psk2': _('WPA2 PSK'),
		'psk': _('WPA PSK'),
		'psk-mixed': _('Mixed WPA/WPA2 PSK'),
		'wpa3': _('WPA3 802.1X'),
		'wpa3-mixed': _('Mixed WPA2/WPA3 802.1X'),
		'wpa3-192': _('WPA3 802.1X 192-bit'),
		'wpa2': _('WPA2 802.1X'),
		'wpa': _('WPA 802.1X'),
		'wpa-mixed': _('Mixed WPA/WPA2 802.1X'),
		'wep-open': _('WEP Open System'),
		'wep-shared': _('WEP Shared Key')
	};
	const ciphers = { 'aes': 'CCMP', 'ccmp': 'CCMP', 'ccmp256': 'CCMP-256', 'gcmp': 'GCMP', 'gcmp256': 'GCMP-256', 'tkip': 'TKIP' };
	const [ mode, ...suffix ] = String(value).split('+');

	if (labels[value])
		return labels[value];
	else if (!modes[mode])
		return String(value);
	else if (suffix.length)
		return '%s (%s)'.format(modes[mode], suffix.map(c => ciphers[c] ?? c.toUpperCase()).join('+'));
	else if (/^(psk|wpa)(2|-mixed)?$/.test(mode))
		return '%s (%s)'.format(modes[mode], _('auto'));

	return modes[mode];
}

/*
	encryption values offered in the uplink dialogs
*/
function encryptionValues(o) {
	[
		'sae', 'sae-mixed',
		'psk2', 'psk2+ccmp', 'psk2+tkip',
		'psk', 'psk+ccmp', 'psk+tkip',
		'psk-mixed', 'psk-mixed+ccmp', 'psk-mixed+tkip',
		'wpa3', 'wpa3-mixed', 'wpa3-192',
		'wpa2', 'wpa2+ccmp', 'wpa2+tkip',
		'wpa', 'wpa+ccmp', 'wpa+tkip',
		'wpa-mixed', 'wpa-mixed+ccmp', 'wpa-mixed+tkip',
		'owe', 'none'
	].forEach(value => o.value(value, encryptionLabel(value)));
}

/*
	add an encryption value the list does not offer yet, so that the list
	shows it and saving the dialog keeps it
*/
function encryptionValue(o, value) {
	if (value != null && !(o.keylist || []).includes(value))
		o.value(value, encryptionLabel(value));
}

/*
	normalize a bssid to upper case for case-insensitive comparison
*/
function normBssid(bssid) {
	return (bssid || '').toUpperCase();
}

/*
	identity of all networks already configured as travelmate uplink
*/
function configuredUplinks(iface) {
	const sections = uci.sections('wireless', 'wifi-iface');
	const list = [];

	for (let i = 0; i < sections.length; i++) {
		if (sections[i].network === iface && sections[i].mode === 'sta') {
			list.push({
				device: sections[i].device || '',
				ssid: sections[i].ssid || '',
				bssid: normBssid(sections[i].bssid)
			});
		}
	}
	return list;
}

/*
	check whether a scanned network is already configured, an uplink
	without bssid matches every bssid of the same ssid
*/
function isConfigured(list, radio, ssid, bssid) {
	if (!ssid) {
		return false;
	}
	for (let i = 0; i < list.length; i++) {
		if (list[i].device !== radio || list[i].ssid !== ssid) {
			continue;
		}
		if (!list[i].bssid || list[i].bssid === normBssid(bssid)) {
			return true;
		}
	}
	return false;
}

/*
	scan dialog styles, aligned with the overview page
*/
function scanStyle() {
	return E('style', { 'type': 'text/css' }, [
		'#trm-scan {' +
		'--trm-card-bg: rgba(128,128,128,.07);' +
		'--trm-card-border: rgba(128,128,128,.28);' +
		'--trm-muted: GrayText;' +
		'--trm-ok: #1f8a5f;' +
		'--trm-err: #c0392b;' +
		'--trm-warn: #b7791f;' +
		'}' +
		'@media (prefers-color-scheme: dark) {' +
		'#trm-scan {' +
		'--trm-ok: #63c79b;' +
		'--trm-err: #e8897e;' +
		'--trm-warn: #e0b35c;' +
		'}}' +
		'#trm-scan .trm-list { display: grid; gap: .5em; margin-bottom: .75em; }' +
		'#trm-scan .trm-card { display: grid; gap: .4em; background: var(--trm-card-bg); border: 1px solid var(--trm-card-border); border-radius: 8px; padding: .6em .8em; min-width: 0; }' +
		'#trm-scan .trm-head { display: flex; align-items: baseline; gap: .6em; }' +
		'#trm-scan .trm-ssid { flex: 1 1 auto; min-width: 0; font-size: 1.1em; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
		'#trm-scan .trm-qual { flex: 0 0 auto; font-variant-numeric: tabular-nums; }' +
		'#trm-scan .trm-bar { height: .35em; border-radius: 3px; background: var(--trm-card-border); overflow: hidden; }' +
		'#trm-scan .trm-bar-fill { height: 100%; background: var(--trm-muted); }' +
		'#trm-scan .trm-card[data-signal="good"] .trm-qual { color: var(--trm-ok); }' +
		'#trm-scan .trm-card[data-signal="good"] .trm-bar-fill { background: var(--trm-ok); }' +
		'#trm-scan .trm-card[data-signal="weak"] .trm-qual { color: var(--trm-warn); }' +
		'#trm-scan .trm-card[data-signal="weak"] .trm-bar-fill { background: var(--trm-warn); }' +
		'#trm-scan .trm-card[data-signal="low"] .trm-qual { color: var(--trm-err); }' +
		'#trm-scan .trm-card[data-signal="low"] .trm-bar-fill { background: var(--trm-err); }' +
		'#trm-scan .trm-foot { display: flex; flex-wrap: wrap; align-items: center; gap: .35em .6em; font-size: .85em; color: var(--trm-muted); }' +
		'#trm-scan .trm-mono { font-family: monospace; }' +
		'#trm-scan .trm-chip { padding: .1em .5em; border-radius: 6px; border: 1px solid var(--trm-card-border); }' +
		'#trm-scan .trm-chip-open { color: var(--trm-warn); border-color: var(--trm-warn); }' +
		'#trm-scan .trm-act { margin-left: auto; }' +
		'#trm-scan .trm-known { color: var(--trm-ok); }' +
		'#trm-scan .trm-empty { color: var(--trm-muted); padding: .5em 0; }'
	]);
}

/*
	render a single scan result card
*/
function scanCard(quality, minQuality, ssidNode, channel, bssid, encLabel, encOpen, action) {
	const value = isNaN(quality) ? 0 : Math.max(0, Math.min(100, quality));
	let signal = 'low';

	if (value >= Math.min(100, minQuality + 25)) {
		signal = 'good';
	} else if (value >= minQuality) {
		signal = 'weak';
	}

	return E('div', { 'class': 'trm-card', 'data-signal': signal }, [
		E('div', { 'class': 'trm-head' }, [
			E('div', { 'class': 'trm-ssid' }, [ssidNode]),
			E('span', { 'class': 'trm-qual' }, [value + ' %'])
		]),
		E('div', { 'class': 'trm-bar' }, [
			E('div', { 'class': 'trm-bar-fill', 'style': 'width:' + value + '%' })
		]),
		E('div', { 'class': 'trm-foot' }, [
			E('span', { 'class': 'trm-chip' + (encOpen ? ' trm-chip-open' : '') }, [encLabel]),
			E('span', {}, [_('Channel') + ' ' + channel]),
			E('span', { 'class': 'trm-mono' }, [bssid]),
			E('div', { 'class': 'trm-act' }, [action])
		])
	]);
}

/*
	name of the travelmate 'uplink' section of a wireless station, null if it
	has none, e.g. a station configured on the LuCI wireless page
*/
function uplinkSection(sid) {
	const w_device = uci.get('wireless', sid, 'device');
	const w_ssid = uci.get('wireless', sid, 'ssid');
	const w_bssid = uci.get('wireless', sid, 'bssid');
	const t_sections = uci.sections('travelmate', 'uplink');

	for (let i = 0; i < t_sections.length; i++) {
		if (t_sections[i].device === w_device && t_sections[i].ssid === w_ssid && normBssid(t_sections[i].bssid) === normBssid(w_bssid)) {
			return t_sections[i]['.name'];
		}
	}
	return null;
}

/*
	add the travelmate 'uplink' section of a wireless station, with the
	defaults of a new uplink (enabled, default vpn) if requested
*/
function addUplink(sid, defaults) {
	const vpn_stdiface = uci.get('travelmate', 'global', 'trm_stdvpniface');
	const t_sid = uci.add('travelmate', 'uplink');

	if (defaults) {
		uci.set('travelmate', t_sid, 'enabled', '1');
	}
	uci.set('travelmate', t_sid, 'device', uci.get('wireless', sid, 'device'));
	uci.set('travelmate', t_sid, 'ssid', uci.get('wireless', sid, 'ssid'));
	uci.set('travelmate', t_sid, 'bssid', uci.get('wireless', sid, 'bssid'));
	if (defaults && vpn_stdiface) {
		uci.set('travelmate', t_sid, 'vpn', '1');
		uci.set('travelmate', t_sid, 'vpniface', vpn_stdiface);
	}
	return t_sid;
}

/*
	change the status of travelmate stations
*/
function handleToggle(sid) {
	let t_sid, row, element, value, enabled;

	t_sid = uplinkSection(sid);
	if (t_sid) {
		value = uci.get('travelmate', t_sid, 'enabled');
		value = (value == 0 ? 1 : 0);
		uci.set('travelmate', t_sid, 'enabled', value);
	} else {
		/* a station without uplink section counts as disabled, add it enabled */
		addUplink(sid, true);
		value = 1;
	}
	enabled = (value == 0 ? _('No') : _('Yes'));
	return uci.save().then(function () {
		row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(sid));
		if (row) {
			element = row.querySelector('.cbi-value-field');
			if (element) {
				element.textContent = enabled;
			}
			row.setAttribute('style', 'opacity: 0.5; color: #37c !important;');
		}
	});
}

/*
	remove wireless and stale travelmate sections
*/
function handleRemove(sid) {
	let w_sections, t_sections, match, row, open, count;

	uci.remove('wireless', sid);
	w_sections = uci.sections('wireless', 'wifi-iface');
	t_sections = uci.sections('travelmate', 'uplink');

	for (let i = 0; i < t_sections.length; i++) {
		match = false;
		for (let j = 0; j < w_sections.length; j++) {
			if (t_sections[i].device === w_sections[j].device && t_sections[i].ssid === w_sections[j].ssid && normBssid(t_sections[i].bssid) === normBssid(w_sections[j].bssid)) {
				match = true;
				break;
			}
		}
		if (match === false) {
			open = +t_sections[i].opensta || 0;
			if (open === 1) {
				count = +uci.get('travelmate', 'global', 'trm_autoaddcnt') || 0;
				if (count > 0) {
					count--;
					uci.set('travelmate', 'global', 'trm_autoaddcnt', count);
				}
			}
			uci.remove('travelmate', t_sections[i]['.name']);
		}
	}
	return uci.save().then(function () {
		row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(sid));
		if (row) {
			row.setAttribute('style', 'opacity: 0.5; color: #a22 !important;');
		}
	});
}

/*
	add missing travelmate sections
*/
function handleSectionsAdd(iface) {
	const w_sections = uci.sections('wireless', 'wifi-iface');

	for (let i = 0; i < w_sections.length; i++) {
		if (w_sections[i].mode === 'sta' && w_sections[i].network === iface && !uplinkSection(w_sections[i]['.name'])) {
			addUplink(w_sections[i]['.name'], true);
		}
	}
}

/*
	update travelmate sections
*/
function handleSectionsVal(action, section_id, option, value) {
	let t_sid = uplinkSection(section_id);

	if (action === 'set') {
		/*
			a station without uplink section, e.g. configured on the LuCI
			wireless page, gets it when its dialog is saved, with the values
			of the dialog
		*/
		t_sid ??= addUplink(section_id, false);
		return uci.set('travelmate', t_sid, option, value);
	} else if (t_sid && action === 'get') {
		return uci.get('travelmate', t_sid, option);
	} else if (t_sid && action === 'del') {
		return uci.unset('travelmate', t_sid, option);
	}
}

/*
	update travelmate status
*/
function handleStatus() {
	let parseErrCount = 0;
	poll.add(function () {
		return Promise.all([
			L.resolveDefault(fs.stat('/var/run/travelmate/travelmate.refresh'), null).then(function (stat) {
				if (!stat) return;
				return L.resolveDefault(fs.read('/var/run/travelmate/travelmate.refresh'), null).then(async function (content) {
					await fs.remove('/var/run/travelmate/travelmate.refresh');
					if (content === 'ui_reload') {
						location.reload();
					} else if (content === 'cfg_reload') {
						if (document.readyState === 'complete') {
							uci.unload('wireless');
							uci.unload('travelmate');
						}
						await Promise.all([
							uci.load('wireless'),
							uci.load('travelmate')
						]);
						const rows = document.querySelectorAll('.cbi-section-table-row[data-sid]');
						for (let i = 0; i < rows.length; i++) {
							const item = rows[i].querySelector('.cbi-value-field[data-name="_enabled"]');
							const value = handleSectionsVal('get', rows[i].getAttribute('data-sid'), 'enabled');
							if (item) {
								item.textContent = (value === '1' ? _('Yes') : _('No'));
							}
						}
					}
				});
			}),
			L.resolveDefault(fs.read('/var/run/travelmate/travelmate.runtime.json'), null).then(function (content) {
				if (!content || !content.trim()) return;
				let info = null;
				try {
					info = JSON.parse(content);
					parseErrCount = 0;
				} catch (e) {
					parseErrCount++;
					if (parseErrCount >= 5) {
						ui.addNotification(null, E('p', _('Unable to parse the travelmate runtime information!')), 'error');
						poll.stop();
					}
					return;
				}
				if (!info || !info.data) return;

				const vpnMatch = (info.data.run_flags || '').match(/vpn:\s*(.)/);
				const uplinkId = (info.data.station_id || '').trim().split('/');
				const oldUplinkView = document.getElementsByName('uplinkStation');
				const w_sections = uci.sections('wireless', 'wifi-iface');
				const vpnStatus = vpnMatch ? vpnMatch[1] : '✘';

				let t_device, t_ssid, t_bssid, newUplinkView, uplinkColor;
				t_device = uplinkId[0];
				t_bssid = uplinkId[uplinkId.length - 1];
				for (let i = 1; i < uplinkId.length - 1; i++) {
					if (!t_ssid) {
						t_ssid = uplinkId[i];
					} else {
						t_ssid = t_ssid + '/' + uplinkId[i];
					}
				}
				if (t_ssid === '-') {
					if (oldUplinkView.length > 0) {
						oldUplinkView[0].removeAttribute('style');
						oldUplinkView[0].removeAttribute('name');
					}
				} else {
					uplinkColor = (vpnStatus === '✔' ? 'rgb(68, 170, 68)' : 'rgb(51, 119, 204)');
					for (let i = 0; i < w_sections.length; i++) {
						newUplinkView = document.getElementById('cbi-wireless-' + w_sections[i]['.name']);
						if (t_device === w_sections[i].device && t_ssid === w_sections[i].ssid && normBssid(t_bssid) === normBssid(w_sections[i].bssid || '-')) {
							if (oldUplinkView.length === 0 && newUplinkView) {
								newUplinkView.setAttribute('name', 'uplinkStation');
								newUplinkView.setAttribute('style', 'text-align: left !important; color: ' + uplinkColor + ' !important;font-weight: bold !important;');
							} else if (oldUplinkView.length > 0 && newUplinkView && oldUplinkView[0].getAttribute('id') !== newUplinkView.getAttribute('id')) {
								oldUplinkView[0].removeAttribute('style');
								oldUplinkView[0].removeAttribute('name');
								newUplinkView.setAttribute('name', 'uplinkStation');
								newUplinkView.setAttribute('style', 'text-align: left !important; color: ' + uplinkColor + ' !important;font-weight: bold !important;');
							} else if (newUplinkView && newUplinkView.style.color !== uplinkColor) {
								newUplinkView.setAttribute('style', 'text-align: left !important; color: ' + uplinkColor + ' !important;font-weight: bold !important;');
							}
						}
					}
				}
			})
		]);
	}, 2);
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('wireless').catch(() => 0),
			uci.load('travelmate').catch(() => 0)
		]);
	},

	render: function () {
		/*
			basic config check
		*/
		if (!uci.sections('wireless', 'wifi-device').length) {
			ui.addNotification(null, E('p', _('No wireless config / radio found!')), 'error');
			return;
		} else if (!uci.get('travelmate', 'global')) {
			ui.addNotification(null, E('p', _('No travelmate config found!')), 'error');
			return;
		}

		/*
			main map
		*/
		let m, s, o, count;
		let iface = uci.get('travelmate', 'global', 'trm_iface') || 'trm_wwan';
		m = new form.Map('wireless');
		m.chain('travelmate');
		s = m.section(form.GridSection, 'wifi-iface', null, _('Overview of all configured uplinks for travelmate. \
			You can edit, remove or prioritize existing uplinks by drag &#38; drop and scan for new ones.<br /> \
			The currently used uplink connection is emphasized in <span style="color:rgb(51, 119, 204);font-weight:bold">blue</span>, \
			an encrypted VPN uplink connection is emphasized in <span style="color:rgb(68, 170, 68);font-weight:bold">green</span>.'));
		s.filter = function (section_id) {
			return (uci.get('wireless', section_id, 'network') == iface && uci.get('wireless', section_id, 'mode') == 'sta');
		};
		s.anonymous = true;
		s.sortable = true;

		s.tab('wireless', _('Wireless Settings'));
		s.tab('travelmate', _('Travelmate Settings'));
		s.tab('vpn', _('VPN Settings'));
		s.renderRowActions = function (section_id) {
			const btns = [
				E('button', {
					'class': 'cbi-button drag-handle center',
					'style': 'float:none;margin-right:.4em;cursor:move;',
					'draggable': true,
					'dragstart': L.bind(function (ev) {
						this.handleDragStart(ev, this.handleDrag);
					}, this),
					'dragend': L.bind(function (ev) {
						this.handleDragEnd(ev, this.handleDrag);
					}, this),
					'touchmove': L.bind(function (ev) {
						this.handleTouchMove(ev);
					}, this),
					'touchend': L.bind(function (ev) {
						this.handleTouchEnd(ev);
					}, this),
					'title': _('Drag to reorder'),
					'disabled': this.map.readonly || null
				}, '☰'),
				E('button', {
					'class': 'cbi-button cbi-button-action important',
					'style': 'float:none;margin-right:.4em;',
					'title': _('Edit this network'),
					'click': ui.createHandlerFn(this, 'renderMoreOptionsModal', section_id)
				}, _('Edit')),
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'title': _('Enable/Disable this network'),
					'click': ui.createHandlerFn(this, handleToggle, section_id)
				}, _('On/Off')),
				E('button', {
					'class': 'cbi-button cbi-button-negative remove',
					'title': _('Remove this network'),
					'click': ui.createHandlerFn(this, handleRemove, section_id)
				}, _('Remove'))
			];
			return E('td', { 'class': 'td cbi-section-table-cell nowrap cbi-section-actions' }, E('div', btns));
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
		o.textvalue = function (section_id) {
			const bssid = uci.get('wireless', section_id, 'bssid');
			return bssid ? '%h'.format(normBssid(bssid)) : null;
		};

		o = s.taboption('wireless', form.ListValue, 'encryption', _('Encryption'));
		encryptionValues(o);
		o.default = 'none';
		o.load = function (section_id) {
			const value = form.ListValue.prototype.load.call(this, section_id);

			/*
				keep a value the list does not offer, e.g. 'wpa2' as written by the
				LuCI wireless page for cipher 'auto', otherwise the dialog shows the
				first entry instead and saving it overwrites the uplink settings
			*/
			encryptionValue(this, value);
			return value;
		};
		o.textvalue = function (section_id) {
			const cfgvalue = this.map.data.get('wireless', section_id, 'encryption');
			return (cfgvalue != null) ? '%h'.format(encryptionLabel(cfgvalue)) : null;
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
		/*
			the phase 2 of wifi-scripts without auth: EAP-MSCHAPv2 for PEAP
			and FAST, which only tunnel EAP methods, MSCHAPv2 for TTLS
		*/
		o.defaults = {
			'MSCHAPV2': [{ eap_type: 'ttls' }],
			'EAP-MSCHAPV2': []
		};
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
		o = s.taboption('travelmate', form.Value, '_ssid', _('SSID'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'ssid';
		o.rmempty = false;
		o.readonly = true;
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'ssid') ?? uci.get('wireless', section_id, 'ssid');
		}

		o = s.taboption('travelmate', form.Value, '_bssid', _('BSSID'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'bssid';
		o.rmempty = true;
		o.readonly = true;
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'bssid') ?? uci.get('wireless', section_id, 'bssid');
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
			count = +uci.get('travelmate', 'global', 'trm_autoaddcnt') || 0;
			count++;
			uci.set('travelmate', 'global', 'trm_autoaddcnt', count);
			return handleSectionsVal('set', section_id, 'opensta', value);
		}
		o.remove = function (section_id, value) {
			count = +uci.get('travelmate', 'global', 'trm_autoaddcnt') || 0;
			if (count > 0) {
				count--;
				uci.set('travelmate', 'global', 'trm_autoaddcnt', count);
			}
			return handleSectionsVal('set', section_id, 'opensta', value);
		}

		o = s.taboption('travelmate', form.Value, '_macaddr', _('MAC Address'),
			_('Use the specified MAC address for this uplink.'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'macaddr';
		o.nocreate = false;
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

		o = s.taboption('travelmate', form.ListValue, '_revive', _('Revive Uplink'),
			_('Re-enable this uplink after the selected number of run cycles if it has been disabled by the retry limit, or earlier once it is back in range. The number of revivals is limited by the global retry limit.'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'revive';
		o.nocreate = false;
		o.rmempty = true;
		o.default = '0';
		o.value('0', _('disabled'));
		o.value('10', _('10 run cycles'));
		o.value('30', _('30 run cycles'));
		o.value('60', _('60 run cycles'));
		o.cfgvalue = function (section_id) {
			return handleSectionsVal('get', section_id, 'revive');
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'revive', value);
		}
		o.remove = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'revive', value);
		}

		o = s.taboption('travelmate', form.FileUpload, '_script', _('Auto Login Script'),
			_('External ucode script (/etc/travelmate/*.uc) which will be called for automated captive portal logins.'));
		o.root_directory = '/etc/travelmate';
		o.enable_remove = false;
		o.enable_upload = false;
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'script';
		o.renderWidget = function (section_id, option_index, cfgvalue) {
			let browserEl = new ui.FileUpload((cfgvalue != null) ? cfgvalue : this.default, {
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
						return ((entry.type == 'directory') || (entry.type == 'file' && entry.name.match(/\.uc$/)));
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

		const svc_allowed = L.toArray(uci.get('travelmate', 'global', 'trm_uplinkservices')).map((e) => e.split(':')[0]).filter((n) => n && n !== 'travelmate');
		o = s.taboption('travelmate', form.MultiValue, '_uplink_services', _('Uplink Services'),
			svc_allowed.length ?
				_('Services to take down for a captive portal login on this uplink, brought up again afterwards.') :
				_('No services available, list them first in the global travelmate settings (Uplink Services).'));
		o.modalonly = true;
		o.uciconfig = 'travelmate';
		o.ucisection = 'uplink';
		o.ucioption = 'uplink_services';
		o.rmempty = true;
		o.placeholder = _('none');
		svc_allowed.forEach((n) => o.value(n));
		o.cfgvalue = function (section_id) {
			return L.toArray(handleSectionsVal('get', section_id, 'uplink_services'));
		}
		o.write = function (section_id, value) {
			return handleSectionsVal('set', section_id, 'uplink_services', L.toArray(value));
		}
		o.remove = function (section_id) {
			return handleSectionsVal('del', section_id, 'uplink_services');
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

		o = s.taboption('vpn', widgets.NetworkSelect, '_vpniface', _('VPN Interface'), _('The logical vpn network interface like \'wg0\', the vpn service follows its protocol.'));
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
				let radio, ifname, btns = [];
				for (let i = 0; i < radios.length; i++) {
					radio = radios[i].sid;
					if (radio) {
						btns.push(E('button', {
							'class': 'cbi-button cbi-button-apply',
							'style': 'float:none;margin-right:.4em;',
							'id': radio,
							'click': ui.createHandlerFn(this, 'handleScan', radio)
						}, [_('Scan on %s...').format(radio)]))
					}
				}
				return E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, E('div', { 'class': 'left', 'style': 'padding-top:5px; padding-bottom:5px' }, btns));
			}, this))
		};

		/*
			modal 'scan' dialog
		*/
		s.handleScan = function (radio) {
			poll.stop();
			const minQuality = parseInt(uci.get('travelmate', 'global', 'trm_minquality') || '35', 10);
			const uplinks = configuredUplinks(iface);
			let list = E('div', { 'class': 'trm-list' }, [
				E('em', { 'class': 'spinning' }, _('Starting wireless scan on \'%s\'...').format(radio))
			]);

			let md = ui.showModal(_('Wireless Scan'), [
				E('div', { 'id': 'trm-scan' }, [scanStyle(), list]),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'style': 'float:none;margin-right:.4em;',
						'click': ui.hideModal
					}, _('Dismiss')),
					E('button', {
						'class': 'cbi-button cbi-button-positive important',
						'id': 'scan-btn',
						'disabled': 'disabled',
						'click': L.bind(this.handleScan, this, radio)
					}, _('Repeat Scan'))
				])
			]);

			md.style.maxWidth = '90%';
			md.style.maxHeight = 'none';

			return L.resolveDefault(fs.exec('/etc/init.d/travelmate', ['scan', radio]))
				.then(L.bind(function () {
					return L.resolveDefault(fs.read('/var/run/travelmate/travelmate.scan'), '')
						.then(L.bind(function (res) {
							let scan = [], rows = [];

							try {
								scan = JSON.parse(res || '[]');
							} catch (e) {
								scan = [];
							}

							if (Array.isArray(scan) && scan.length) {
								for (let i = 0; i < scan.length; i++) {
									const r = scan[i];
									const ssid = r.hidden ? '' : (r.ssid || '');
									const bssid = r.bssid || '';
									const channel = r.channel;
									const strength = r.quality;
									const wpa = r.wpa || [];
									const auth = r.auth || [];
									const tbl_ssid = r.hidden ? E('em', {}, [_('hidden')]) : ssid;

									/*
										WPA detection
									*/
									let hasWPA1 = wpa.includes(1);
									let hasWPA2 = wpa.includes(2);
									let hasWPA3 = wpa.includes(3);

									/*
										Auth detection
									*/
									let hasPSK = auth.some(a => a.includes("PSK"));
									let hasSAE = auth.some(a => a.includes("SAE"));
									let has8021x = auth.some(a => a.includes("802.1X"));
									let hasOWE = auth.includes("OWE");
									let hasSuiteB = auth.some(a => a.includes("SUITE-B"));
									let resCipher = resolveCiphers(r.ciphers || []);
									let suffix = cipherSuffix(r.ciphers || []);

									/*
										encryption classification
									*/
									let tbl_encryption = '';
									let encryption = 'none';

									if (!r.encrypted) {
										tbl_encryption = _('Open');
										encryption = 'none';
									} else if (hasOWE) {
										tbl_encryption = `WPA3 OWE (${resCipher.name})`;
										encryption = 'owe';
									} else if (hasSuiteB) {
										tbl_encryption = `WPA3 Enterprise (${resCipher.name})`;
										encryption = 'wpa3';
									} else if (hasWPA2 && hasWPA3 && hasPSK && !has8021x) {
										tbl_encryption = `Mixed WPA2/WPA3 PSK (${resCipher.name})`;
										encryption = 'sae-mixed';
									} else if (hasWPA2 && hasWPA3 && has8021x) {
										tbl_encryption = `Mixed WPA2/WPA3 802.1X (${resCipher.name})`;
										encryption = 'wpa3-mixed';
									} else if (hasWPA3 && hasSAE && !has8021x) {
										tbl_encryption = `WPA3 PSK (SAE)`;
										encryption = 'sae';
									} else if (hasWPA3 && has8021x) {
										tbl_encryption = `WPA3 802.1X (${resCipher.name})`;
										encryption = 'wpa3';
									} else if (hasWPA1 && hasWPA2 && has8021x) {
										tbl_encryption = `Mixed WPA/WPA2 802.1X (${resCipher.name})`;
										encryption = 'wpa-mixed' + suffix;
									} else if (hasWPA2 && has8021x) {
										tbl_encryption = `WPA2 802.1X (${resCipher.name})`;
										encryption = 'wpa2' + suffix;
									} else if (hasWPA1 && has8021x) {
										tbl_encryption = `WPA 802.1X (${resCipher.name})`;
										encryption = 'wpa' + suffix;
									} else if (hasWPA1 && hasWPA2 && hasPSK) {
										tbl_encryption = `Mixed WPA/WPA2 PSK (${resCipher.name})`;
										encryption = 'psk-mixed' + suffix;
									} else if (hasWPA2 && hasPSK) {
										tbl_encryption = `WPA2 PSK (${resCipher.name})`;
										encryption = 'psk2' + suffix;
									} else if (hasWPA1 && hasPSK) {
										tbl_encryption = `WPA PSK (${resCipher.name})`;
										encryption = 'psk' + suffix;
									} else {
										tbl_encryption = _('unknown');
										encryption = 'none';
									}

									/*
										push result card into the list
									*/
									const known = isConfigured(uplinks, radio, ssid, bssid);
									const unsupported = r.encrypted && encryption === 'none';
									const action = known
										? E('span', { 'class': 'trm-known' }, [_('Configured')])
										: unsupported
											? E('span', { 'class': 'trm-known' }, [_('Unsupported')])
											: E('button', {
												'class': 'cbi-button cbi-button-action',
												'click': ui.createHandlerFn(this, 'handleAdd', radio, iface, ssid, bssid, encryption)
											}, _('Add Uplink...'));
									rows.push(scanCard(parseInt(strength, 10), minQuality, tbl_ssid, channel, bssid, tbl_encryption, !r.encrypted, action));
								}
							} else {
								rows.push(E('div', { 'class': 'trm-empty' }, [_('Empty resultset')]));
							}

							dom.content(list, rows);
							document.getElementById('scan-btn').disabled = false;
							poll.start();
						}, this));
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

			if (ssid === "") {
				o2 = s2.option(form.Value, 'ssid', _('SSID (hidden)'));
				o2.placeholder = 'hidden SSID';
			} else {
				o2 = s2.option(form.Value, 'ssid', _('SSID'));
				o2.default = ssid;
			}
			o2.datatype = 'maxlength(32)';
			o2.rmempty = false;

			o2 = s2.option(form.Flag, 'ignore_bssid', _('Ignore BSSID'));
			if (ssid === '') {
				o2.default = '0';
			} else {
				o2.default = '1';
			}

			o2 = s2.option(form.Value, 'bssid', _('BSSID'));
			o2.depends({ ignore_bssid: '0' });
			o2.datatype = 'macaddr';
			o2.rmempty = true;
			o2.default = bssid;

			o2 = s2.option(form.ListValue, 'encryption', _('Encryption'));
			encryptionValues(o2);
			encryptionValue(o2, encryption);
			o2.default = encryption;

			o2 = s2.option(form.Value, 'key', _('Password'));
			o2.depends({ encryption: 'sae', '!contains': true });
			o2.depends({ encryption: 'psk', '!contains': true });
			o2.datatype = 'wpakey';
			o2.rmempty = false;
			o2.password = true;

			o2 = s2.option(form.Value, 'password', _('Password'));
			o2.depends({ encryption: 'wpa', '!contains': true });
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
			/*
				the phase 2 of wifi-scripts without auth: EAP-MSCHAPv2 for PEAP
				and FAST, which only tunnel EAP methods, MSCHAPv2 for TTLS
			*/
			o2.defaults = {
				'MSCHAPV2': [{ eap_type: 'ttls' }],
				'EAP-MSCHAPV2': []
			};

			o2 = s2.option(form.Value, 'identity', _('Identity'));
			o2.depends({ encryption: 'wpa', '!contains': true });

			o2 = s2.option(form.Value, 'anonymous_identity', _('Anonymous Identity'));
			o2.depends({ encryption: 'wpa', '!contains': true });

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
			o2.default = o2.disabled;

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
				ui.showModal(_('Add Uplink "%h"').format(ssid || 'hidden'), [
					elements,
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'style': 'float:none;margin-right:.4em;',
							'click': ui.hideModal
						}, _('Dismiss')),
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
			const w_sections = uci.sections('wireless', 'wifi-iface');
			const option = (name) => L.toArray(map.lookupOption(name, '_add_trm'))[0];
			const value = (name) => option(name).formvalue('_add_trm');

			/*
				the dialog is not saved through the map, so check the visible
				fields here, an invalid one is marked and the dialog stays open
			*/
			let valid = true;
			map.children[0].children.forEach(function (opt) {
				if (opt.isActive('_add_trm')) {
					opt.triggerValidation('_add_trm');
					if (!opt.isValid('_add_trm')) {
						valid = false;
					}
				}
			});
			if (!valid) {
				return;
			}

			const device = value('device');
			const network = value('network');
			const ssid = value('ssid');
			const ignore_bssid = value('ignore_bssid');
			const bssid = value('bssid');
			const encryption = value('encryption');
			const ieee80211w = (encryption !== 'none') ? value('ieee80211w') : null;

			let password = null;
			let eap_type, auth, identity, anonymous_identity, ca_cert_usesystem, ca_cert;
			let client_cert, priv_key, priv_key_pwd;

			if (encryption.includes('wpa')) {
				eap_type = value('eap_type');
				auth = value('auth');
				identity = value('identity');
				anonymous_identity = value('anonymous_identity');
				password = value('password');
				ca_cert_usesystem = value('ca_cert_usesystem');
				ca_cert = value('ca_cert');

				if (eap_type === 'tls') {
					client_cert = value('client_cert');
					priv_key = value('priv_key');
					priv_key_pwd = value('priv_key_pwd');
				}
			}
			else {
				password = value('key');
			}
			/* EAP-TLS authenticates with the client certificate, no password needed */
			if (!ssid || ((encryption.includes('psk') || encryption.includes('sae') || (encryption.includes('wpa') && eap_type !== 'tls')) && !password)) {
				if (!ssid) {
					ui.addNotification(null, E('p', _('Empty SSID, the uplink station could not be saved.')), 'error');
				} else {
					ui.addNotification(null, E('p', _('Empty Password, the uplink station could not be saved.')), 'error');
				}
				return ui.hideModal();
			}
			for (let i = 0; i < w_sections.length; i++) {
				if (w_sections[i].device === device && w_sections[i].ssid === ssid) {
					if (ignore_bssid === '1' || (ignore_bssid === '0' && normBssid(w_sections[i].bssid) === normBssid(bssid))) {
						ui.addNotification(null, E('p', _('Duplicate wireless entry, the uplink station could not be saved.')), 'error');
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
				if (eap_type === 'tls') {
					uci.set('wireless', new_sid, 'client_cert', client_cert);
					uci.set('wireless', new_sid, 'priv_key', priv_key);
					uci.set('wireless', new_sid, 'priv_key_pwd', priv_key_pwd);
				}
			} else {
				uci.set('wireless', new_sid, 'key', password);
			}
			uci.set('wireless', new_sid, 'ieee80211w', ieee80211w);
			uci.set('wireless', new_sid, 'disabled', '1');
			handleSectionsAdd(network);
			uci.save()
				.then(L.bind(this.map.load, this.map))
				.then(L.bind(this.map.reset, this.map))
				.then(function () {
					let row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(new_sid));
					if (row) {
						row.setAttribute('style', 'opacity: 0.5; color: #4a4 !important;');
					}
				})
				.then(ui.hideModal)
				.catch(function (err) {
					ui.hideModal();
					ui.addNotification(null, E('p', [_('Saving the new uplink failed: %s').format(err)]), 'error');
				});
		};
		return m.render();
	},
	handleReset: null
});
