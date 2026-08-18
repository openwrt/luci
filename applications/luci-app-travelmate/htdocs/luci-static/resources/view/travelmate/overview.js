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
	QR-Code escape helper
*/
function qrEscape(s) {
	if (s == null)
		return '';
	return String(s).replace(/([\\;,:"])/g, '\\$1');
}

/*
	network interface helper
*/
function waitForIface(ifaceName, timeoutMs) {
	const deadline = Date.now() + (timeoutMs || 20000);
	function tick() {
		return network.flushCache().then(function () {
			return network.getNetwork(ifaceName);
		}).then(function (net) {
			if (net && net.isUp())
				return true;
			if (Date.now() >= deadline)
				return false;
			return new Promise(function (resolve) {
				window.setTimeout(resolve, 500);
			}).then(tick);
		});
	}
	return tick();
}


/*
	button handling
*/
function handleAction(ev) {
	let ifaceValue;
	if (ev === 'restartInterface') {
		ifaceValue = String(uci.get('travelmate', 'global', 'trm_iface') || 'trm_wwan');
		return fs.exec('/etc/init.d/travelmate', ['stop'])
			.then(() => L.resolveDefault(fs.exec('/sbin/ifup', [ifaceValue])))
			.then(() => waitForIface(ifaceValue, 20000))
			.then(() => fs.exec('/etc/init.d/travelmate', ['start']))
	}
	if (ev === 'stopService') {
		return fs.exec('/etc/init.d/travelmate', ['stop'])
			.then(function () {
				if (!poll.active())
					poll.start();
			})
			.catch(function (err) {
				ui.addNotification(null, E('p', _('Unable to stop the travelmate service: %s').format(err)), 'error');
			})
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
		ui.showModal(_('Interface Wizard'), [
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
					'click': ui.hideModal
				}, _('Dismiss')),
				E('button', {
					'class': 'cbi-button cbi-button-positive important',
					'style': 'float:none',
					'click': ui.createHandlerFn(this, function (ev) {
						const iface = (document.getElementById('iface').value || 'trm_wwan').toLowerCase();
						const zone = (document.getElementById('zone').value || 'wan').toLowerCase();
						const metric = document.getElementById('metric').value.replace(/\D/g, '') || '100';
						return fs.exec('/etc/init.d/travelmate', ['setup', iface, zone, metric])
							.then(function (rc) {
								ui.hideModal();
								switch (rc.code) {
									case 1:
										ui.addNotification(null, E('p', _('The interface already exists!')), 'info');
										break;
									default:
										location.reload();
										break;
								}
							})
							.catch(function (err) {
								ui.hideModal();
								ui.addNotification(null, E('p', _('Interface setup failed: %s').format(err)), 'error');
							})
					})
				}, _('Save'))
			])
		]);
		document.getElementById('iface').focus();
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
							w_enc = w_sections[w_sid].encryption || '';
							w_key = w_sections[w_sid].key;
							w_hidden = (w_sections[w_sid].hidden === '1' ? 'true' : 'false');
							if (w_enc === 'none') {
								w_enc = 'nopass';
								w_key = 'nokey';
							} else if (w_enc.indexOf('sae') !== -1) {
								w_enc = 'SAE';
							} else {
								w_enc = 'WPA';
							}
							const data = `WIFI:S:${qrEscape(w_ssid)};T:${qrEscape(w_enc)};P:${qrEscape(w_key)};H:${w_hidden};;`;
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
				ui.showModal(_('QR-Code Overview'), [
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
							'click': ui.hideModal
						}, _('Dismiss'))
					])
				]);
			});
	}
}

/*
	runtime string helpers

	f_genstatus() packs several runtime fields into display strings, split them
	up again so they can be rendered as chips and labelled key/value rows.
*/
function parsePairs(text) {
	const pairs = [];
	(text || '').split(', ').forEach(function (item) {
		const idx = item.indexOf(': ');
		if (idx > 0) {
			pairs.push([item.substring(0, idx), item.substring(idx + 2)]);
		} else if (item.trim()) {
			pairs.push([null, item.trim()]);
		}
	});
	return pairs;
}

function pickValue(pairs, key) {
	for (let i = 0; i < pairs.length; i++) {
		if (pairs[i][0] === key) {
			return pairs[i][1];
		}
	}
	return '-';
}

/*
	system_info is "cores: n, fetch: cmd, model, target, distribution version".
	Keep the named entries and the board model, drop target and release.
*/
function sysPairs(text) {
	let plain = 0;
	return parsePairs(text).filter(function (pair) {
		return pair[0] || ++plain === 1;
	});
}

/*
	The container is a two column grid, so the nodes are emitted flat rather
	than wrapped per row - that is what keeps the values aligned across rows.
	Entries without a key span both columns. The trailing space in the key is
	invisible but keeps the text copyable as "key value".
*/
function stackNodes(pairs) {
	const nodes = [];
	pairs.forEach(function (pair) {
		if (pair[0]) {
			nodes.push(E('span', { 'class': 'trm-key' }, [pair[0], ' ']));
			nodes.push(E('span', {}, [pair[1]]));
		} else {
			nodes.push(E('span', { 'class': 'trm-full' }, [pair[1]]));
		}
	});
	return nodes.length ? nodes : ['-'];
}

function flagChips(text) {
	return parsePairs(text).filter(function (pair) {
		return pair[0];
	}).sort(function (a, b) {
		return a[0].localeCompare(b[0]);
	}).map(function (flag) {
		const on = flag[1] === '\u2714';
		return E('span', { 'class': 'trm-chip ' + (on ? 'trm-chip-on' : 'trm-chip-off') }, [
			E('span', { 'class': 'trm-mark' }, [on ? '\u2714' : '\u2718']),
			flag[0]
		]);
	});
}

/*
	station_id is "radio/essid/bssid". An essid may itself contain a slash,
	while the radio name and the bssid cannot, so the field is cut at the
	first and the last separator rather than split on every one.
*/
function splitStationId(text) {
	const value = text || '';
	const first = value.indexOf('/');
	const last = value.lastIndexOf('/');
	if (first < 0 || last === first) {
		return { 'radio': '-', 'essid': value || '-', 'bssid': '-' };
	}
	return {
		'radio': value.substring(0, first) || '-',
		'essid': value.substring(first + 1, last) || '-',
		'bssid': value.substring(last + 1) || '-'
	};
}

/* station_interfaces is "uplink, vpn" without keys, the order is fixed */
function splitInterfaces(text) {
	const parts = (text || '').split(', ');
	return { 'uplink': parts[0] || '-', 'vpn': parts[1] || '-' };
}

/*
	travelmate_status is either "connected, <detail>", "processing",
	"not connected" or "program error". The backend only reports "processing"
	while a run cycle is actually in progress, an idle daemon without uplink
	reports "not connected". The state key drives the dot colour and decides
	whether the action buttons are temporarily locked.
*/
function splitStatus(text) {
	const value = text || '';
	if (value === 'processing') {
		return { 'state': 'processing', 'label': _('processing'), 'detail': '-' };
	}
	if (value === 'not connected') {
		return { 'state': 'idle', 'label': _('not connected'), 'detail': '-' };
	}
	if (value === 'program error') {
		return { 'state': 'error', 'label': _('program error'), 'detail': '-' };
	}
	if (value.indexOf('connected') === 0) {
		const idx = value.indexOf(', ');
		return { 'state': 'connected', 'label': _('connected'), 'detail': idx > 0 ? value.substring(idx + 2) : '-' };
	}
	return { 'state': '', 'label': value || '-', 'detail': '-' };
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('travelmate').catch(() => 0),
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
		/*
			basic result check
		*/
		if (!result[0] || result[0].length === 0) {
			ui.addNotification(null, E('p', _('No travelmate config found!')), 'error');
			return;
		} else if (!result[1] || result[1].length === 0) {
			ui.addNotification(null, E('p', _('No wireless config / radio found!')), 'error');
			return;
		}

		/*
			main map
		*/
		let m, s, o;
		m = new form.Map('travelmate', 'Travelmate', _('Configuration of the travelmate package to enable travel router functionality. \
			For further information %s.'.format(`<a href="https://github.com/openwrt/packages/blob/master/net/travelmate/files/README.md" target="_blank" rel="noreferrer noopener" >${_('check the online documentation')}</a>`)) + '<br />' +
			_('<b><em>Please note:</em></b> On first start please call the \'Interface Wizard\' once, to make the necessary network- and firewall settings.'));

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
			set element content helper function
		*/
		const setNodes = (id, nodes) => {
			const el = document.getElementById(id);
			if (el) {
				dom.content(el, nodes);
			}
		};

		/*
			action button helper

			Only lock the buttons while a run cycle is actually in progress. The
			service button is never locked, it is the escape hatch out of a long
			running or stuck cycle.
		*/
		const setButtons = (locked) => {
			document.querySelectorAll('.cbi-page-actions button:not(#btn_stop)').forEach(function (btn) {
				btn.disabled = locked;
				if (locked) {
					btn.blur();
				}
			});
		};

		/*
			stop button helper

			The backend truncates the runtime file on service stop, so an empty
			or missing file means 'not running'. The button is only greyed out
			in that state, 'Save & Restart' brings the service back up.
		*/
		const setStop = (running) => {
			const btn = document.getElementById('btn_stop');
			if (btn) {
				btn.disabled = !running;
			}
		};

		/*
			poll runtime information
		*/
		let parseErrCount = 0;
		poll.add(function () {
			return L.resolveDefault(fs.stat('/var/run/travelmate/travelmate.runtime.json'), null).then(function (stat) {
				const status = document.getElementById('status');
				if (!stat || !stat.size) {
					parseErrCount = 0;
					setStop(false);
					setButtons(false);
					if (status) {
						status.classList.remove('spinning');
						status.setAttribute('data-state', 'stopped');
						setText('state', _('stopped'));
						setText('connection', '-');
					}
					return;
				}
				return L.resolveDefault(fs.read_direct('/var/run/travelmate/travelmate.runtime.json'), null).then(function (res) {
					let info = null;
					try {
						info = JSON.parse(res);
						parseErrCount = 0;
						if (!poll.active()) {
							poll.start();
						}
					} catch (e) {
						info = null;
						parseErrCount++;
						setStop(true);
						setButtons(false);
						if (status) {
							status.setAttribute('data-state', '');
							setText('state', '-');
							status.classList.remove('spinning');
							if (parseErrCount >= 5) {
								ui.addNotification(null, E('p', _('Unable to parse the travelmate runtime information!')), 'error');
								poll.stop();
							}
						}
						return;
					}
					setStop(true);
					if (status && info) {
						const state = splitStatus(info.data.travelmate_status);
						status.setAttribute('data-state', state.state);
						setText('state', state.label);
						setText('connection', state.detail);
						setText('versions', `${info.data.frontend_ver || '-'} / ${info.data.backend_ver || '-'}`);
						setButtons(state.state === 'processing');
						status.classList.toggle('spinning', state.state === 'processing');
					} else if (status) {
						status.setAttribute('data-state', '');
						setText('state', '-');
						status.classList.remove('spinning');
						setButtons(false);
					}
					if (info) {
						const station = splitStationId(info.data.station_id);
						const ifaces = splitInterfaces(info.data.station_interfaces);
						setText('essid', station.essid);
						setText('radio', station.radio);
						setText('station_bssid', station.bssid);
						setText('station_mac', info.data.station_mac);
						setText('iface_uplink', ifaces.uplink);
						setText('iface_vpn', ifaces.vpn);
						setText('station_subnet', info.data.station_subnet);
						const runPairs = parsePairs(info.data.last_run);
						setNodes('run_flags', flagChips(info.data.run_flags));
						setText('run', pickValue(runPairs, 'date / time'));
						setText('run_sub', [pickValue(runPairs, 'mode'), pickValue(runPairs, 'duration'),
							pickValue(runPairs, 'memory')].filter(v => v !== '-').join(', '));
						setNodes('sys', stackNodes(sysPairs(info.data.system_info)));
					}
				});
			});
		}, 2);

		/*
			runtime information and buttons
		*/
		s = m.section(form.NamedSection, 'global');
		s.render = function (section_id) {
			/*
				scoped theme palette

				Neutral surfaces are derived from translucent grey so they work on
				top of any LuCI theme background. Only the semantic colors are
				switched per color scheme, and both variants are chosen to stay
				readable either way.
			*/
			const style = E('style', { 'type': 'text/css' }, [
				'#trm-status {' +
				'--trm-card-bg: rgba(128,128,128,.07);' +
				'--trm-card-border: rgba(128,128,128,.28);' +
				'--trm-muted: GrayText;' +
				'--trm-ok: #1f8a5f;' +
				'--trm-err: #c0392b;' +
				'--trm-info: #2f6fb0;' +
				'--trm-warn: #b7791f;' +
				'--trm-ok-bg: rgba(31,138,95,.14);' +
				'}' +
				'@media (prefers-color-scheme: dark) {' +
				'#trm-status {' +
				'--trm-ok: #63c79b;' +
				'--trm-err: #e8897e;' +
				'--trm-info: #7fb3e8;' +
				'--trm-warn: #e0b35c;' +
				'}}' +
				'#trm-status .trm-grid { display: grid; gap: .75em; grid-template-columns: repeat(auto-fit, minmax(min(12em, 100%), 1fr)); margin-bottom: .75em; }' +
				'#trm-status .trm-card { background: var(--trm-card-bg); border: 1px solid var(--trm-card-border); border-radius: 8px; padding: .7em .9em; min-width: 0; overflow-wrap: break-word; }' +
				'#trm-status .trm-block { margin-bottom: .75em; }' +
				'#trm-status .trm-label { font-size: .85em; color: var(--trm-muted); margin-bottom: .3em; }' +
				'#trm-status .trm-sub { font-size: .8em; color: var(--trm-muted); margin-top: .3em; }' +
				'#trm-status .trm-value { font-size: 1.5em; line-height: 1.3; }' +
				'#trm-status .trm-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
				'#trm-status .trm-state { display: flex; align-items: center; gap: .5em; }' +
				'#trm-status .trm-dot { width: .6em; height: .6em; border-radius: 50%; background: var(--trm-muted); flex: 0 0 auto; }' +
				'#trm-status .trm-state[data-state="connected"] .trm-dot { background: var(--trm-ok); }' +
				'#trm-status .trm-state[data-state="processing"] .trm-dot { background: var(--trm-info); }' +
				'#trm-status .trm-state[data-state="idle"] .trm-dot { background: var(--trm-warn); }' +
				'#trm-status .trm-state[data-state="stopped"] .trm-dot { background: var(--trm-muted); }' +
				'#trm-status .trm-state[data-state="error"] .trm-dot { background: var(--trm-err); }' +
				'#trm-status .trm-title { font-weight: bold; margin-bottom: .6em; }' +
				'#trm-status .trm-chips { display: flex; flex-wrap: wrap; gap: .35em; }' +
				'#trm-status .trm-chip { font-size: .85em; padding: .15em .6em; border-radius: 6px; border: 1px solid transparent; }' +
				'#trm-status .trm-chip-on { background: var(--trm-ok-bg); color: var(--trm-ok); }' +
				'#trm-status .trm-chip-off { color: var(--trm-muted); border-color: var(--trm-card-border); }' +
				'#trm-status .trm-mark { margin-right: .35em; }' +
				'#trm-status .trm-stack { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .25em .6em; font-size: .9em; }' +
				'#trm-status .trm-key { color: var(--trm-muted); }' +
				'#trm-status .trm-stack .trm-full { grid-column: 1 / -1; }' +
				'#trm-status .trm-mono { font-family: monospace; word-break: break-all; }'
			]);

			/* static labels, only the value nodes are updated by the poll */
			function kvRow(label, id, mono) {
				return [
					E('span', { 'class': 'trm-key' }, [label, ' ']),
					E('span', { 'class': mono ? 'trm-mono' : '', 'id': id }, ['-'])
				];
			}

			return E('div', { 'class': 'cbi-section', 'id': 'trm-status' }, [
				style,
				E('div', { 'class': 'trm-grid' }, [
					E('div', { 'class': 'trm-card' }, [
						E('div', { 'class': 'trm-label' }, [_('Status')]),
						E('div', { 'class': 'trm-state spinning', 'id': 'status', 'data-state': '' }, [
							E('span', { 'class': 'trm-dot' }),
							E('span', { 'class': 'trm-value', 'id': 'state' }, ['-'])
						]),
						E('div', { 'class': 'trm-sub', 'id': 'connection' }, ['-']),
						E('div', { 'class': 'trm-sub trm-mono', 'id': 'versions' }, ['-'])
					]),
					E('div', { 'class': 'trm-card' }, [
						E('div', { 'class': 'trm-label' }, [_('Uplink')]),
						E('div', { 'class': 'trm-value trm-ellipsis', 'id': 'essid' }, ['-']),
						E('div', { 'class': 'trm-sub', 'id': 'radio' }, ['-'])
					]),
					E('div', { 'class': 'trm-card' }, [
						E('div', { 'class': 'trm-label' }, [_('Last Run')]),
						E('div', { 'class': 'trm-value', 'id': 'run' }, ['-']),
						E('div', { 'class': 'trm-sub', 'id': 'run_sub' }, ['-'])
					])
				]),
				E('div', { 'class': 'trm-grid' }, [
					E('div', { 'class': 'trm-card' }, [
						E('div', { 'class': 'trm-title' }, [_('Station')]),
						E('div', { 'class': 'trm-stack' }, [].concat(
							kvRow(_('bssid'), 'station_bssid', true),
							kvRow(_('mac'), 'station_mac', true)
						))
					]),
					E('div', { 'class': 'trm-card' }, [
						E('div', { 'class': 'trm-title' }, [_('Network')]),
						E('div', { 'class': 'trm-stack' }, [].concat(
							kvRow(_('uplink'), 'iface_uplink', true),
							kvRow(_('vpn'), 'iface_vpn', true),
							kvRow(_('subnet'), 'station_subnet', true)
						))
					]),
					E('div', { 'class': 'trm-card' }, [
						E('div', { 'class': 'trm-title' }, [_('System Info')]),
						E('div', { 'class': 'trm-stack', 'id': 'sys' }, ['-'])
					])
				]),
				E('div', { 'class': 'trm-card trm-block' }, [
					E('div', { 'class': 'trm-title' }, [_('Run Flags')]),
					E('div', { 'class': 'trm-chips', 'id': 'run_flags' }, ['-'])
				])
			]);
		};

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

		o = s.taboption('general', form.MultiValue, 'trm_radio', _('Radio Selection'), _('Restrict travelmate to certain radio(s).'));
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

		o = s.taboption('general', form.Flag, 'trm_netcheck', _('Net Error Check'), _('Treat missing internet availability as an error. A detected captive portal does not count as an error.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_proactive', _('ProActive Uplink Switch'), _('Proactively scan and switch to a higher prioritized uplink, despite of an already existing connection.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_randomize', _('Randomize MAC Addresses'), _('Generate a random unicast MAC address for each uplink connection.'));
		o.default = 0;
		o.rmempty = false;

		o = s.taboption('general', form.Flag, 'trm_eviltwin', _('Evil Twin Protection'), _('Detect and skip access points with locally administered (LAA) BSSIDs to mitigate evil twin attacks.'));
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
		o.placeholder = '5';
		o.datatype = 'range(1,60)';
		o.rmempty = true;

		o = s.taboption('additional', form.Value, 'trm_maxretry', _('Connection Limit'), _('Retry limit to connect to an uplink. Use \'0\' for unlimited retries.'));
		o.placeholder = '3';
		o.datatype = 'range(0,10)';
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
		s.render = function () {
			return E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-reset important',
					'style': 'float:none;margin-right:.4em;',
					'title': _('Stop the travelmate service'),
					'id': 'btn_stop',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('stopService');
					})
				}, [_('Stop')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'title': _('Interface Setup'),
					'click': ui.createHandlerFn(this, function () {
						return handleAction('setup');
					})
				}, [_('Interface Wizard...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-negative important',
					'style': 'float:none;margin-right:.4em;',
					'title': _('Restart Interface'),
					'click': ui.createHandlerFn(this, function () {
						return handleAction('restartInterface');
					})
				}, [_('Interface Restart')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply important',
					'style': 'float:none;margin-right:.4em;',
					'title': _('QR-Code'),
					'id': 'btn_qrcode',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('qrcode');
					})
				}, [_('AP QR-Codes...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none;margin-right:.4em;',
					'title': _('Save & Restart'),
					'click': ui.createHandlerFn(this, function () {
						return handleAction('restartTravelmate');
					})
				}, [_('Save & Restart')])
			])
		};
		return m.render();
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
