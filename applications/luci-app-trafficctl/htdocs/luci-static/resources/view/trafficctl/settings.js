// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require rpc';
'require ui';

// Settings, moved off the Devices page (#90). The reporter's complaint was
// that the main view had become cluttered; @the-e3n chose one page with
// collapsible sections over sub-tabs, on the grounds that Ctrl-F then finds
// any setting — which was also the better argument.
//
// What stayed behind on Devices is what controls that page rather than the
// package: visible columns, poll and averaging window, the panel toggles, and
// the flow-offload BANNER (as opposed to the panel) — a warning about whether
// the numbers on that page can be believed belongs next to the numbers.
//
// The four sections here were already self-contained: each is lazy-loaded
// into its own container and none of them read any Devices-page state, which
// is why this is a move rather than a rewrite.

(function() {
	if (!document.querySelector('link[href*="trafficctl/status.css"]')) {
		var lnk = document.createElement('link');
		lnk.rel = 'stylesheet';
		lnk.type = 'text/css';
		lnk.href = '/luci-static/resources/view/trafficctl/status.css';
		document.head.appendChild(lnk);
	}
})();

var callTelegramGet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'telegram_config_get'
});

var callTelegramSet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'telegram_config_set',
	params: ['enabled', 'bot_token', 'chat_id', 'poll_interval',
		'notify_new_device', 'notify_known_device', 'control_enabled', 'notify_template',
		'btn_block_inet', 'btn_block_wifi', 'btn_limiter', 'btn_shaper']
});

var callTelegramTest = rpc.declare({
	object: 'luci.trafficctl',
	method: 'telegram_test',
	params: ['bot_token', 'chat_id', 'message']
});

var callLoggingGet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'logging_config_get'
});

var callLoggingSet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'logging_config_set',
	params: ['enabled', 'log_file', 'max_lines', 'syslog',
		'log_blocks', 'log_ratelimits', 'log_shapes', 'log_telegram', 'log_config', 'persist_rules']
});

var callNewDeviceGet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'newdevice_config_get'
});

var callNewDeviceSet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'newdevice_config_set',
	params: ['enabled', 'limit_kbit', 'limit_mode']
});

var callConfigGet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'config_get'
});

var callConfigSet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'config_set',
	params: ['enabled', 'default_mode', 'sw', 'hw', 'poll_interval', 'avg_window']
});

var RATE_PRESETS = [
	{v:'0',      l: _('Off')},
	{v:'1000',   l:_('1 Mbit/s')},
	{v:'2000',   l:_('2 Mbit/s')},
	{v:'5000',   l:_('5 Mbit/s')},
	{v:'10000',  l:_('10 Mbit/s')},
	{v:'25000',  l:_('25 Mbit/s')},
	{v:'50000',  l:_('50 Mbit/s')},
	{v:'100000', l:_('100 Mbit/s')},
	{v:'custom', l: _('Custom…')}
];

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		// Named as it was on the Devices page, so every appendChild below is
		// the line it always was. Not collapsed here: this view IS the panel.
		var settingsBody = E('div', {'class':'tc-settings-body'});

		function mkToggle(id, label, checked, onChange) {
			var cb = E('input', { 'type': 'checkbox', 'id': id, 'class': 'tc-toggle-input' });
			cb.checked = !!checked;
			cb.addEventListener('change', onChange);
			var track = E('label', { 'class': 'tc-toggle', 'for': id });
			return E('div', { 'class': 'tc-toggle-wrap' }, [
				cb, track,
				E('label', { 'for': id, 'style': 'cursor:pointer;font-size:12px;user-select:none;color:currentColor' }, label)
			]);
		}
		function mkLabel(t) {
			return E('span', { 'class': 'tc-inline-label' }, t);
		}


		var sectionLabel = function(t) { return E('div', {'class':'tc-section-label'}, t); };

		function mkChipPick(options, currentValue, onChange) {
			var wrapper = E('span', {'style':'display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center'});
			var selected = currentValue;
			var chips = [];
			options.forEach(function(opt) {
				var chip = E('span', {'class': opt.v === selected ? 'tc-chip tc-chip--active' : 'tc-chip'}, opt.l);
				chip.addEventListener('click', function() {
					selected = opt.v;
					chips.forEach(function(c) { c.className = c._v === selected ? 'tc-chip tc-chip--active' : 'tc-chip'; });
					onChange(opt.v);
				});
				chip._v = opt.v;
				chips.push(chip);
				wrapper.appendChild(chip);
			});
			return { el: wrapper, getValue: function() { return selected; }, setValue: function(v) { selected = v; chips.forEach(function(c) { c.className = c._v === v ? 'tc-chip tc-chip--active' : 'tc-chip'; }); } };
		}

		function mkCollapsible(title, content, startOpen) {
			var body = E('div', {'class': 'tc-collapsible-body' + (startOpen ? '' : ' tc-hidden')});
			if (content) body.appendChild(content);
			var arrow = E('span', {'class':'tc-c-muted', 'style':'font-size:11px'}, startOpen ? ' ▾' : ' ▸');
			var label = sectionLabel(title);
			label.style.cursor = 'pointer';
			label.appendChild(arrow);
			label.addEventListener('click', function() {
				var open = !body.classList.contains('tc-hidden');
				body.classList.toggle('tc-hidden');
				arrow.textContent = open ? ' ▸' : ' ▾';
			});
			return {label: label, body: body, el: E('div', {}, [label, body])};
		}


		var tgSection = mkCollapsible(_('Telegram Bot'), null, false);
		var tgLoaded = false;
		tgSection.label.addEventListener('click', function() {
			if (!tgLoaded && !tgSection.body.classList.contains('tc-hidden')) {
				tgLoaded = true;
				loadTelegramUI(tgSection.body);
			}
		});

		function loadTelegramUI(container) {
			var statusSpan = E('span', {'style':'font-size:12px;margin-left:8px;color:var(--tc-muted)'}, _('Loading…'));
			container.appendChild(statusSpan);

			callTelegramGet().then(function(cfg) {
				while (container.firstChild) container.removeChild(container.firstChild);

				var section = E('div', {'class':'tg-section'});
				container.appendChild(section);

				// ── Auto-save with debounce ──
				var saveTimer = null;
				var setupDone = false;
				var saveStatus = E('span', {'class':'tg-save-status'});
				var doSave = function() {
					if (!setupDone) return;
					if (saveTimer) clearTimeout(saveTimer);
					saveTimer = setTimeout(function() {
						saveStatus.textContent = _('Saving…');
						saveStatus.style.color = 'var(--tc-muted)';
						var tk = tokenInput.value;
						if (tk === '' && cfg.bot_token_set) tk = '***';
						var inetEl = container.querySelector('#tm-tg-inet');
						var wifiEl = container.querySelector('#tm-tg-wifi');
						var limitEl = container.querySelector('#tm-tg-limit');
						var shapeEl = container.querySelector('#tm-tg-shape');
						callTelegramSet(
							container.querySelector('#tm-tg-enabled').checked,
							tk,
							chatInput.value,
							parseInt(cfg.poll_interval) || 3,
							container.querySelector('#tm-tg-new').checked,
							container.querySelector('#tm-tg-known').checked,
							controlMode,
							templateArea.value,
							inetEl ? inetEl.checked : cfg.btn_block_inet,
							wifiEl ? wifiEl.checked : cfg.btn_block_wifi,
							limitEl ? limitEl.checked : cfg.btn_limiter,
							shapeEl ? shapeEl.checked : cfg.btn_shaper
						).then(function(res) {
							if (res && res.ok) {
								saveStatus.textContent = '✓';
								saveStatus.style.color = 'var(--tc-ok)';
								cfg.bot_token_set = !!(tk && tk !== '***') || cfg.bot_token_set;
								if (tk && tk !== '***') {
									tokenInput.value = '';
									tokenInput.type = 'password';
									tokenInput.placeholder = '••••••••  ✓ ' + _('saved');
								}
							} else {
								saveStatus.textContent = '✗ ' + (res && res.msg || 'error');
								saveStatus.style.color = 'var(--tc-err)';
							}
						}).catch(function(e) {
							saveStatus.textContent = '✗ ' + e.message;
							saveStatus.style.color = 'var(--tc-err)';
						});
					}, 600);
				};

				// ── Status dot ──
				var dot = E('span', {
					'class': 'tg-status-dot ' + (cfg.bot_running ? 'tg-status-dot--on' : 'tg-status-dot--off'),
					'title': cfg.bot_running ? _('Bot is running') : _('Bot is stopped')
				});

				// ── Enabled toggle ──
				var tgEnabled = mkToggle('tm-tg-enabled', _('Enabled'), cfg.enabled, doSave);
				section.appendChild(E('div', {'class':'tg-row'}, [tgEnabled, dot, saveStatus]));

				// ── Token + Chat ID ──
				var tokenInput = E('input', {
					'type': 'password',
					'class': 'tg-input tg-input--token',
					'value': '',
					'placeholder': cfg.bot_token_set ? '••••••••  ✓ ' + _('saved') : _('Paste bot token')
				});
				tokenInput.addEventListener('change', doSave);
				var eyeBtn = E('span', {'class':'tg-eye','title':_('Show/hide token')}, '👁');
				eyeBtn.addEventListener('click', function() {
					tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
				});
				var chatInput = E('input', {
					'type': 'text',
					'class': 'tg-input tg-input--chat',
					'value': cfg.chat_id || '',
					'placeholder': _('Chat ID')
				});
				chatInput.addEventListener('change', doSave);
				var testResult = E('span', {'style':'font-size:11px;margin-left:4px'});
				var testBtn = E('button', {'class':'tg-btn'}, _('Test'));
				testBtn.addEventListener('click', function() {
					testBtn.disabled = true;
					testResult.textContent = _('Sending…');
					testResult.style.color = 'var(--tc-muted)';
					var tk = tokenInput.value || '***';
					callTelegramTest(tk, chatInput.value, templateArea.value || '').then(function(res) {
						testResult.textContent = (res && res.ok) ? '✓ ' + (res.msg || 'OK') : '✗ ' + (res && res.msg || 'error');
						testResult.style.color = (res && res.ok) ? 'var(--tc-ok)' : 'var(--tc-err)';
					}).catch(function(e) {
						testResult.textContent = '✗ ' + e.message;
						testResult.style.color = 'var(--tc-err)';
					}).then(function() { testBtn.disabled = false; });
				});
				section.appendChild(E('div', {'class':'tg-row'}, [
					E('span', {'class':'tg-label'}, _('Token:')), tokenInput, eyeBtn,
					E('span', {'style':'width:12px'}),
					E('span', {'class':'tg-label'}, _('Chat ID:')), chatInput,
					testBtn, testResult
				]));

				// ── Mode segmented control ──
				var controlMode = cfg.control_enabled !== false;
				var controlSection = E('div', {});
				var notifySection = E('div', {});
				function setMode(ctrl) {
					controlMode = ctrl;
					segControl.className = 'tg-segmented__item' + (ctrl ? ' tg-segmented__item--active' : '');
					segNotify.className = 'tg-segmented__item' + (!ctrl ? ' tg-segmented__item--active' : '');
					controlSection.classList.toggle('tc-hidden', !ctrl);
					doSave();
				}

				var segNotify = document.createElement('div');
				segNotify.className = 'tg-segmented__item' + (!controlMode ? ' tg-segmented__item--active' : '');
				segNotify.textContent = '🔔 ' + _('Notifications only');
				segNotify.onclick = function() { setMode(false); };

				var segControl = document.createElement('div');
				segControl.className = 'tg-segmented__item' + (controlMode ? ' tg-segmented__item--active' : '');
				segControl.textContent = '🎛 ' + _('Full control');
				segControl.onclick = function() { setMode(true); };

				var segmented = E('div', {'class':'tg-segmented'}, [segNotify, segControl]);

				section.appendChild(E('div', {'class':'tg-row'}, [segmented]));

				// ── Notifications ──
				notifySection.appendChild(E('div', {'class':'tg-divider'}, _('Notifications')));
				var notifyNew = mkToggle('tm-tg-new', _('New devices'), cfg.notify_new_device, doSave);
				var notifyKnown = mkToggle('tm-tg-known', _('Known devices'), cfg.notify_known_device, doSave);
				notifySection.appendChild(E('div', {'class':'tg-row'}, [notifyNew, notifyKnown]));

				// ── Custom template ──
				var templateArea = E('textarea', {
					'class': 'tg-input tg-input--template',
					'placeholder': '🆕 New device\\n{{ name }} ({{ ip }})\\nMAC: {{ mac }}\\nLink: {{ link }}'
				}, cfg.notify_template || '');
				templateArea.addEventListener('input', function() { renderPreview(); doSave(); });

				var previewBubble = E('div', {'class':'tg-bubble'});
				var defaultTpl = '🆕 <b>New device</b>\n{{ name }} ({{ ip }})\nMAC: <code>{{ mac }}</code>\nLink: {{ link }}';
				var renderPreview = function() {
					var tpl = templateArea.value || defaultTpl;
					var txt = tpl
						.replace(/\{\{\s*name\s*\}\}/g, 'MacBookPro')
						.replace(/\{\{\s*ip\s*\}\}/g, '192.168.0.100')
						.replace(/\{\{\s*mac\s*\}\}/g, 'aa:bb:cc:dd:ee:ff')
						.replace(/\{\{\s*link\s*\}\}/g, '5G')
						.replace(/\{\{\s*date\s*\}\}/g, new Date().toISOString().slice(0,10))
						.replace(/\{\{\s*time\s*\}\}/g, new Date().toTimeString().slice(0,5))
						.replace(/\{\{\s*datetime\s*\}\}/g, new Date().toISOString().slice(0,10) + ' ' + new Date().toTimeString().slice(0,5))
						.replace(/\{\{\s*router\s*\}\}/g, 'OpenWrt')
						.replace(/\{\{\s*ssid\s*\}\}/g, 'MyNetwork_5G')
						.replace(/\{\{\s*signal\s*\}\}/g, '-52')
						.replace(/\{\{\s*freq\s*\}\}/g, '5GHz')
						.replace(/\{\{\s*iface\s*\}\}/g, 'wlan1')
						.replace(/\{\{\s*clients\s*\}\}/g, '12')
						.replace(/\{\{\s*uptime\s*\}\}/g, '3d 5h')
						.replace(/\{\{\s*wan_ip\s*\}\}/g, '85.192.48.1')
						.replace(/\{\{\s*load\s*\}\}/g, '0.42')
						.replace(/\{\{\s*conns\s*\}\}/g, '47');
					previewBubble.innerHTML = txt.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
				};
				renderPreview();

				var varRef = E('div', {'style':'font-size:12px;line-height:1.7;color:currentColor'}, [
					E('div', {'style':'font-weight:600;margin-bottom:4px'}, _('Variables')),
					E('div', {}, [E('code', {}, '{{ name }}'), document.createTextNode(' — ' + _('device hostname'))]),
					E('div', {}, [E('code', {}, '{{ ip }}'), document.createTextNode(' — ' + _('IP address'))]),
					E('div', {}, [E('code', {}, '{{ mac }}'), document.createTextNode(' — ' + _('MAC address'))]),
					E('div', {}, [E('code', {}, '{{ link }}'), document.createTextNode(' — ' + _('connection type (5G, LAN)'))]),
					E('div', {}, [E('code', {}, '{{ date }}'), document.createTextNode(' — ' + _('date (2026-05-26)'))]),
					E('div', {}, [E('code', {}, '{{ time }}'), document.createTextNode(' — ' + _('time (14:32)'))]),
					E('div', {}, [E('code', {}, '{{ datetime }}'), document.createTextNode(' — ' + _('date + time'))]),
					E('div', {}, [E('code', {}, '{{ router }}'), document.createTextNode(' — ' + _('router hostname'))]),
					E('div', {}, [E('code', {}, '{{ ssid }}'), document.createTextNode(' — ' + _('WiFi SSID'))]),
					E('div', {}, [E('code', {}, '{{ signal }}'), document.createTextNode(' — ' + _('WiFi signal (dBm)'))]),
					E('div', {}, [E('code', {}, '{{ freq }}'), document.createTextNode(' — ' + _('WiFi band (2.4/5GHz)'))]),
					E('div', {}, [E('code', {}, '{{ iface }}'), document.createTextNode(' — ' + _('network interface'))]),
					E('div', {}, [E('code', {}, '{{ clients }}'), document.createTextNode(' — ' + _('total connected clients'))]),
					E('div', {}, [E('code', {}, '{{ uptime }}'), document.createTextNode(' — ' + _('router uptime'))]),
					E('div', {}, [E('code', {}, '{{ wan_ip }}'), document.createTextNode(' — ' + _('WAN IP'))]),
					E('div', {}, [E('code', {}, '{{ load }}'), document.createTextNode(' — ' + _('CPU load (1 min)'))]),
					E('div', {}, [E('code', {}, '{{ conns }}'), document.createTextNode(' — ' + _('device connections'))]),
					E('div', {'style':'margin-top:6px;color:var(--tc-muted);font-size:11px'}, [
						document.createTextNode(_('HTML:') + ' '),
						E('code', {}, '<b>'), document.createTextNode(' '),
						E('code', {}, '<i>'), document.createTextNode(' '),
						E('code', {}, '<code>'), document.createTextNode(' '),
						E('code', {}, '<a href="">'),
						document.createTextNode('. \\n = ' + _('line break'))
					])
				]);

				var templateToggle = E('span', {
					'style': 'font-size:12px;cursor:pointer;color:var(--tc-muted);user-select:none'
				}, '▸ ' + _('Customize message'));
				var templateBody = E('div', {'class':'tc-hidden','style':'margin-top:6px'});
				templateBody.appendChild(E('div', {'style':'display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap'}, [
					E('div', {'style':'flex:1;min-width:200px'}, [templateArea]),
					varRef
				]));
				templateBody.appendChild(E('div', {'style':'margin-top:8px'}, [
					E('span', {'class':'tg-label','style':'display:block;margin-bottom:4px'}, _('Preview:')),
					previewBubble
				]));
				templateToggle.addEventListener('click', function() {
					var show = templateBody.classList.contains('tc-hidden');
					templateBody.classList.toggle('tc-hidden');
					templateToggle.textContent = (show ? '▾ ' : '▸ ') + _('Customize message');
				});
				notifySection.appendChild(E('div', {'style':'margin-top:8px'}, [templateToggle, templateBody]));

				// ── Control section (conditionally visible) ──
				controlSection.appendChild(E('div', {'class':'tg-divider'}, _('Control')));
				var btnInet = mkToggle('tm-tg-inet', _('Block Internet'), cfg.btn_block_inet, function() { updateKbd(); doSave(); });
				var btnWifi = mkToggle('tm-tg-wifi', _('Block WiFi'), cfg.btn_block_wifi, function() { updateKbd(); doSave(); });
				var btnLimit = mkToggle('tm-tg-limit', _('Limiter'), cfg.btn_limiter, function() { updateKbd(); doSave(); });
				var btnShape = mkToggle('tm-tg-shape', _('Shaper'), cfg.btn_shaper, function() { updateKbd(); doSave(); });
				controlSection.appendChild(E('div', {'class':'tg-row'}, [btnInet, btnWifi, btnLimit, btnShape]));

				// Dynamic keyboard preview
				var kbdBubble = E('div', {'class':'tg-bubble tg-bubble--kbd'});
				var updateKbd = function() {
					while (kbdBubble.firstChild) kbdBubble.removeChild(kbdBubble.firstChild);
					var inetEl = controlSection.querySelector('#tm-tg-inet');
					var wifiEl = controlSection.querySelector('#tm-tg-wifi');
					var limitEl = controlSection.querySelector('#tm-tg-limit');
					var shapeEl = controlSection.querySelector('#tm-tg-shape');
					var inetOn = inetEl ? inetEl.checked : cfg.btn_block_inet;
					var wifiOn = wifiEl ? wifiEl.checked : cfg.btn_block_wifi;
					var limitOn = limitEl ? limitEl.checked : cfg.btn_limiter;
					var shapeOn = shapeEl ? shapeEl.checked : cfg.btn_shaper;
					if (!inetOn && !wifiOn && !limitOn && !shapeOn) {
						kbdBubble.appendChild(E('div', {'style':'font-size:11px;color:var(--tc-faint);padding:4px'}, _('No action buttons enabled')));
						return;
					}
					var row1 = [];
					if (inetOn) row1.push(E('span', {'class':'tg-kbd-btn'}, '⏸ Block Internet'));
					if (wifiOn) row1.push(E('span', {'class':'tg-kbd-btn'}, '📵 Block WiFi'));
					if (row1.length) kbdBubble.appendChild(E('div', {'class':'tg-kbd-row'}, row1));
					if (limitOn) {
						var limitBtns = [];
						RATE_PRESETS.forEach(function(p) {
							if (p.v === '0' || p.v === 'custom') return;
							limitBtns.push(E('span', {'class':'tg-kbd-btn'}, p.l.replace(' Mbit/s','M').replace(/\s/g,'')));
						});
						for (var li = 0; li < limitBtns.length; li += 3) {
							kbdBubble.appendChild(E('div', {'class':'tg-kbd-row'}, limitBtns.slice(li, li + 3)));
						}
					}
					if (shapeOn) {
						var shapeBtns = [];
						RATE_PRESETS.forEach(function(p) {
							if (p.v === '0' || p.v === 'custom') return;
							shapeBtns.push(E('span', {'class':'tg-kbd-btn'}, '🔧 ' + p.l.replace(' Mbit/s','M').replace(/\s/g,'')));
						});
						for (var si = 0; si < shapeBtns.length; si += 3) {
							kbdBubble.appendChild(E('div', {'class':'tg-kbd-row'}, shapeBtns.slice(si, si + 3)));
						}
					}
					kbdBubble.appendChild(E('div', {'class':'tg-kbd-row'}, [
						E('span', {'class':'tg-kbd-btn'}, '⬅️ Back')
					]));
				};
				updateKbd();

				controlSection.appendChild(E('div', {'style':'margin-top:8px'}, [
					E('span', {'class':'tg-label','style':'display:block;margin-bottom:4px'}, _('Inline keyboard preview:')),
					kbdBubble
				]));

				// Commands + flow explanation
				controlSection.appendChild(E('div', {'style':'margin-top:10px'}, [
					E('span', {'class':'tg-label','style':'display:block;margin-bottom:4px'}, _('Bot commands:')),
					E('div', {'class':'tg-commands'}, [
						E('div', {}, [E('code', {}, '/devices'), document.createTextNode(' — ' + _('device list → tap device → action buttons'))]),
						E('div', {}, [E('code', {}, '/status'), document.createTextNode(' — ' + _('all active blocks, limits, and shapes'))]),
						E('div', {}, [E('code', {}, '/help'), document.createTextNode(' — ' + _('command list and bot mode'))])
					]),
					E('div', {'style':'font-size:10px;color:var(--tc-faint);margin-top:4px'},
						_('Flow: /devices → select device → inline keyboard with enabled actions above'))
				]));

				if (!controlMode) controlSection.classList.add('tc-hidden');
				section.appendChild(controlSection);
				section.appendChild(notifySection);
				setupDone = true;
			}).catch(function(e) {
				statusSpan.textContent = '✗ ' + e.message;
				statusSpan.style.color = 'var(--tc-err)';
			});
		}

		// ── Assemble settings sections ─────────────────────────────────────
		settingsBody.appendChild(tgSection.el);

		var loggingSection = mkCollapsible(_('Logging & Persistence'), null, false);
		var loggingLoaded = false;
		loggingSection.label.addEventListener('click', function() {
			if (!loggingLoaded && !loggingSection.body.classList.contains('tc-hidden')) {
				loggingLoaded = true;
				loadLoggingUI(loggingSection.body);
			}
		});

		function loadLoggingUI(container) {
			var statusSpan = E('span', {'style':'font-size:12px;color:var(--tc-muted)'}, _('Loading…'));
			container.appendChild(statusSpan);

			callLoggingGet().then(function(cfg) {
				while (container.firstChild) container.removeChild(container.firstChild);

				var logStatus = E('span', {'class':'tg-save-status'});
				var logTimer = null;
				var doLogSave = function() {
					if (logTimer) clearTimeout(logTimer);
					logTimer = setTimeout(function() {
						logStatus.textContent = _('Saving…');
						logStatus.style.color = 'var(--tc-muted)';
						callLoggingSet(
							container.querySelector('#tm-log-enabled').checked,
							null, null,
							container.querySelector('#tm-log-syslog').checked,
							container.querySelector('#tm-log-blocks').checked,
							container.querySelector('#tm-log-ratelimits').checked,
							container.querySelector('#tm-log-shapes').checked,
							container.querySelector('#tm-log-telegram').checked,
							container.querySelector('#tm-log-config').checked,
							container.querySelector('#tm-persist-rules').checked
						).then(function(res) {
							logStatus.textContent = (res && res.ok) ? '✓' : '✗';
							logStatus.style.color = (res && res.ok) ? 'var(--tc-ok)' : 'var(--tc-err)';
						}).catch(function(e) {
							logStatus.textContent = '✗';
							logStatus.style.color = 'var(--tc-err)';
						});
					}, 400);
				};

				var logEnabled = mkToggle('tm-log-enabled', _('Logging'), cfg.enabled, doLogSave);
				var logSyslog = mkToggle('tm-log-syslog', _('Syslog'), cfg.syslog, doLogSave);
				var persistRules = mkToggle('tm-persist-rules', _('Persist rules'), cfg.persist_rules, doLogSave);

				var logBlocks = mkToggle('tm-log-blocks', _('Blocks'), cfg.log_blocks, doLogSave);
				var logRatelimits = mkToggle('tm-log-ratelimits', _('Ratelimits'), cfg.log_ratelimits, doLogSave);
				var logShapes = mkToggle('tm-log-shapes', _('Shapes'), cfg.log_shapes, doLogSave);
				var logTelegram = mkToggle('tm-log-telegram', _('Telegram'), cfg.log_telegram, doLogSave);
				var logConfig = mkToggle('tm-log-config', _('Config'), cfg.log_config, doLogSave);

				container.appendChild(E('div', {'class':'tc-log-row'}, [logEnabled, logSyslog, persistRules, logStatus]));
				container.appendChild(E('div', {'style':'margin-top:6px'}, [
					E('div', {'style':'font-size:11px;color:var(--tc-muted);margin-bottom:4px'}, _('Log categories')),
					E('div', {'class':'tc-log-row'}, [logBlocks, logRatelimits, logShapes, logTelegram, logConfig])
				]));
			}).catch(function(e) {
				statusSpan.textContent = '✗ ' + e.message;
				statusSpan.style.color = 'var(--tc-err)';
			});
		}
		settingsBody.appendChild(loggingSection.el);

		var newDevSection = mkCollapsible(_('New Device Defaults'), null, false);
		var newDevLoaded = false;
		newDevSection.label.addEventListener('click', function() {
			if (!newDevLoaded && !newDevSection.body.classList.contains('tc-hidden')) {
				newDevLoaded = true;
				loadNewDeviceUI(newDevSection.body);
			}
		});

		function loadNewDeviceUI(container) {
			var statusSpan = E('span', {'style':'font-size:12px;color:var(--tc-muted)'}, _('Loading…'));
			container.appendChild(statusSpan);

			callNewDeviceGet().then(function(cfg) {
				while (container.firstChild) container.removeChild(container.firstChild);

				var saveStatus = E('span', {'class':'tg-save-status'});
				var hint = E('div', {'style':'font-size:11px;color:var(--tc-muted);margin-top:6px'});
				var modePick = null;
				var saveTimer = null;

				// The baseline is what stops the feature limiting the whole
				// LAN, so its size is shown rather than left implicit: an
				// operator can tell a populated ledger from an empty one.
				function renderHint(c) {
					var kbit = parseInt(rateInput.value, 10);
					if (enabledToggle.querySelector('input').checked && (!kbit || kbit <= 0)) {
						hint.textContent = _('Set a rate above 0 — with no rate this does nothing.');
						hint.style.color = 'var(--tc-warn)';
						return;
					}
					hint.style.color = 'var(--tc-muted)';
					if (c && c.seeded) {
						hint.textContent = _('Devices already known:') + ' ' + (c.seen_count || 0) +
							' — ' + _('these are never limited by this setting.');
					} else {
						hint.textContent = _('No baseline recorded yet. It is taken from the current leases when you switch this on.');
					}
				}

				var doSave = function() {
					if (saveTimer) clearTimeout(saveTimer);
					saveTimer = setTimeout(function() {
						saveStatus.textContent = _('Saving…');
						saveStatus.style.color = 'var(--tc-muted)';
						var kbit = parseInt(rateInput.value, 10);
						if (isNaN(kbit) || kbit < 0) kbit = 0;
						callNewDeviceSet(
							enabledToggle.querySelector('input').checked,
							kbit,
							modePick.getValue()
						).then(function(res) {
							saveStatus.textContent = (res && res.ok) ? '✓' : '✗';
							saveStatus.style.color = (res && res.ok) ? 'var(--tc-ok)' : 'var(--tc-err)';
							if (res && res.ok) {
								callNewDeviceGet().then(renderHint).catch(function() {});
							}
						}).catch(function() {
							saveStatus.textContent = '✗';
							saveStatus.style.color = 'var(--tc-err)';
						});
					}, 400);
				};

				var enabledToggle = mkToggle('tm-nd-enabled', _('Limit new devices'), cfg.enabled, function() {
					renderHint(cfg);
					doSave();
				});

				var rateInput = E('input', {
					'type': 'number',
					'min': '0',
					'class': 'tg-input tg-input--chat',
					'value': cfg.limit_kbit || 0,
					'placeholder': _('kbit/s')
				});
				rateInput.addEventListener('change', function() {
					renderHint(cfg);
					doSave();
				});

				modePick = mkChipPick([
					{ v: 'limiter', l: _('Limiter') },
					{ v: 'shaper', l: _('Shaper') }
				], cfg.limit_mode || 'limiter', doSave);

				container.appendChild(E('div', {'class':'tc-log-row'}, [
					enabledToggle, mkLabel(_('Rate')), rateInput, mkLabel(_('kbit/s')),
					modePick.el, saveStatus
				]));
				container.appendChild(hint);
				container.appendChild(E('div', {'style':'font-size:11px;color:var(--tc-muted);margin-top:4px'},
					_('Applied once, the first time a device appears on the network. A device that already has a limit is left alone.')));

				renderHint(cfg);
			}).catch(function(e) {
				statusSpan.textContent = '✗ ' + e.message;
				statusSpan.style.color = 'var(--tc-err)';
			});
		}
		settingsBody.appendChild(newDevSection.el);

		var offloadSection = mkCollapsible(_('Flow Offload'), null, false);
		var offloadLoaded = false;
		offloadSection.label.addEventListener('click', function() {
			if (!offloadLoaded && !offloadSection.body.classList.contains('tc-hidden')) {
				offloadLoaded = true;
				loadOffloadUI(offloadSection.body);
			}
		});

		function loadOffloadUI(container) {
			var statusSpan = E('span', {'style':'font-size:12px;color:var(--tc-muted)'}, _('Loading…'));
			container.appendChild(statusSpan);

			callConfigGet().then(function(cfg) {
				while (container.firstChild) container.removeChild(container.firstChild);

				var saveStatus = E('span', {'class':'tg-save-status'});
				var saveTimer = null;
				var swCb, hwCb;

				function doSave() {
					if (saveTimer) clearTimeout(saveTimer);
					saveTimer = setTimeout(function() {
						saveStatus.textContent = _('Applying…');
						saveStatus.style.color = 'var(--tc-muted)';
						callConfigSet(undefined, undefined, swCb.checked, hwCb.checked).then(function(res) {
							saveStatus.textContent = (res && res.ok) ? '✓ ' + _('Applied — firewall reloading') : '✗';
							saveStatus.style.color = (res && res.ok) ? 'var(--tc-ok)' : 'var(--tc-err)';
						}).catch(function(e) {
							saveStatus.textContent = '✗';
							saveStatus.style.color = 'var(--tc-err)';
						});
					}, 400);
				}

				// Current mode badge
				var modeLabels = {
					'none':              ['⊘', _('No offload'),              'var(--tc-muted)'],
					'software':          ['◑', _('Software offload'),        'var(--tc-speed)'],
					'software-counter':  ['◑', _('Software offload (counter)'), 'var(--tc-speed)'],
					'hardware-counter':  ['●', _('Hardware offload'),        'var(--tc-warn)'],
					'hardware':          ['●', _('Hardware offload'),        'var(--tc-warn)']
				};
				var ml = modeLabels[cfg.offload_mode] || ['?', cfg.offload_mode, 'var(--tc-muted)'];
				var modeBadge = E('div', {'style':'margin-bottom:10px;font-size:12px'}, [
					E('span', {'style':'color:'+ml[2]+';font-size:15px;margin-right:4px'}, ml[0]),
					E('span', {'style':'color:var(--tc-muted)'}, _('Current mode:') + ' '),
					E('b', {}, ml[1])
				]);

				// SW toggle row
				var swToggleEl = mkToggle('tc-offload-sw', _('Software flow offload'), cfg.sw, function() {
					hwCb.disabled = !swCb.checked;
					if (!swCb.checked) { hwCb.checked = false; }
					doSave();
				});
				swCb = swToggleEl.querySelector('input');
				var swDesc = E('div', {'class':'tc-offload-desc'},
					_('Accelerates routing in the kernel via nftables flowtable. Speed monitoring and traffic shaping work normally.'));

				// HW toggle row
				var hwToggleEl = mkToggle('tc-offload-hw', _('Hardware flow offload'), cfg.hw, doSave);
				hwCb = hwToggleEl.querySelector('input');
				if (!cfg.sw) hwCb.disabled = true;
				var hwDesc = E('div', {'class':'tc-offload-desc'},
					_('Offloads routing to the hardware engine (PPE/NPU). Requires software offload. ' +
					  '⚠ On many platforms (e.g. Mediatek Filogic) the driver does not report byte counters back to the kernel — real-time speed monitoring will show zero.'));

				// Qualcomm NSS acceleration (#81). This is NOT one of the
				// flow-offload modes above and is not controlled by the two
				// toggles below it: ECM pushes flow rules into the NSS
				// firmware cores, so an accelerated flow never reaches the
				// Linux stack at all and neither the nftables policer nor
				// Linux HTB can act on it. The apply result says so on every
				// attempt; this is here because the Flow Offload panel is
				// where somebody asking "why is my limit doing nothing" looks.
				if (cfg.nss === 'active') {
					container.appendChild(E('div', {
						'style': 'margin-bottom:10px;padding:8px;border-left:3px solid var(--tc-warn);font-size:12px'
					}, [
						E('b', {'style':'color:var(--tc-warn)'}, '⚠ ' + _('Qualcomm NSS acceleration is active')),
						E('div', {'style':'margin-top:4px;color:var(--tc-muted)'},
							_('Rate limits and traffic shaping cannot be enforced while it is: accelerated flows bypass the Linux network stack, so rules are installed but have no effect. The toggles below do not control this — stop the ECM front end (front_end_ipv4_stop / front_end_ipv6_stop under /sys/kernel/debug/ecm) or set acceleration_engine in /etc/config/ecm, then re-apply the limit.'))
					]));
				}

				container.appendChild(modeBadge);
				container.appendChild(E('div', {'class':'tc-offload-row'}, [swToggleEl, saveStatus]));
				container.appendChild(swDesc);
				container.appendChild(E('div', {'class':'tc-offload-row tc-offload-row--hw'}, [hwToggleEl]));
				container.appendChild(hwDesc);
			}).catch(function(e) {
				statusSpan.textContent = '✗ ' + (e.message || e);
				statusSpan.style.color = 'var(--tc-err)';
			});
		}
		settingsBody.appendChild(offloadSection.el);

		return E('div', {}, [
			E('h2', {}, _('Traffic Control Settings')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Package-wide settings. Controls that only affect what the Devices page shows — visible columns, poll interval, averaging window — stay on that page.')),
			settingsBody
		]);
	}
});

