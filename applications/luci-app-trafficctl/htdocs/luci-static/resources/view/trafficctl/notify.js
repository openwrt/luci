// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require rpc';
'require ui';

// Notifications: the events of trafficctl.notify and the senders that deliver
// them. Every event also goes out on ubus (trafficctl.notify) and to the
// scripts in /etc/hotplug.d/trafficctl whatever is set here; this page only
// chooses which senders get which events. The Telegram sender uses the bot's
// token and chat from Settings unless it sets its own.

(function() {
	if (!document.querySelector('link[href*="trafficctl/status.css"]')) {
		var lnk = document.createElement('link');
		lnk.rel = 'stylesheet';
		lnk.type = 'text/css';
		lnk.href = '/luci-static/resources/view/trafficctl/status.css';
		document.head.appendChild(lnk);
	}
})();

var callNotifyGet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'notify_config_get'
});

var callNotifySet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'notify_config_set',
	params: ['sender', 'enabled', 'events', 'scan', 'scan_interval', 'bot_token', 'chat_id', 'template',
		'server', 'topic', 'token', 'priority', 'url', 'auth', 'to', 'from', 'account']
});

var callNotifyTest = rpc.declare({
	object: 'luci.trafficctl',
	method: 'notify_test',
	params: ['sender']
});

var EVENT_LABELS = {
	new_device: _('New device'),
	known_device: _('Known device online'),
	limit_applied: _('Limit applied'),
	block_applied: _('Block applied'),
	cut_engaged: _('Internet cut')
};

var SENDER_TITLES = {
	telegram: _('Telegram'),
	ntfy: _('ntfy'),
	webhook: _('Webhook'),
	mail: _('Email')
};

var TEMPLATE_VARS = [
	['name', _('device hostname')], ['ip', _('IP address')], ['mac', _('MAC address')],
	['link', _('connection type (5G, LAN)')], ['date', _('date (2026-05-26)')], ['time', _('time (14:32)')],
	['datetime', _('date + time')], ['router', _('router hostname')], ['ssid', _('WiFi SSID')],
	['signal', _('WiFi signal (dBm)')], ['freq', _('WiFi band (2.4/5GHz)')], ['iface', _('network interface')],
	['clients', _('total connected clients')], ['uptime', _('router uptime')], ['wan_ip', _('WAN IP')],
	['load', _('CPU load (1 min)')], ['conns', _('device connections')]
];

var TEMPLATE_SAMPLE = {
	name: 'MacBookPro', ip: '192.168.0.100', mac: 'aa:bb:cc:dd:ee:ff', link: '5G', router: 'OpenWrt',
	ssid: 'MyNetwork_5G', signal: '-52', freq: '5GHz', iface: 'wlan1', clients: '12', uptime: '3d 5h',
	wan_ip: '85.192.48.1', load: '0.42', conns: '47'
};

function mkToggle(id, label, checked) {
	var cb = E('input', { 'type': 'checkbox', 'id': id, 'class': 'tc-toggle-input' });
	cb.checked = !!checked;
	return { input: cb, el: E('div', { 'class': 'tc-toggle-wrap' }, [
		cb, E('label', { 'class': 'tc-toggle', 'for': id }),
		E('label', { 'for': id, 'style': 'cursor:pointer;font-size:12px;user-select:none;color:currentColor' }, label)
	]) };
}

// Several values at once (the events a sender takes).
function mkChipSet(options, selected) {
	var on = {};
	selected.forEach(function(v) { on[v] = true; });
	var wrap = E('span', { 'style': 'display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center' });
	options.forEach(function(opt) {
		var chip = E('span', { 'class': on[opt.v] ? 'tc-chip tc-chip--active' : 'tc-chip' }, opt.l);
		chip.addEventListener('click', function() {
			on[opt.v] = !on[opt.v];
			chip.className = on[opt.v] ? 'tc-chip tc-chip--active' : 'tc-chip';
		});
		wrap.appendChild(chip);
	});
	return { el: wrap, values: function() {
		return options.filter(function(o) { return on[o.v]; }).map(function(o) { return o.v; });
	} };
}

// One value (scan mode, priority).
function mkChipPick(options, current) {
	var selected = current;
	var chips = [];
	var wrap = E('span', { 'style': 'display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center' });
	options.forEach(function(opt) {
		var chip = E('span', { 'class': opt.v === selected ? 'tc-chip tc-chip--active' : 'tc-chip' }, opt.l);
		chip._v = opt.v;
		chip.addEventListener('click', function() {
			selected = opt.v;
			chips.forEach(function(c) { c.className = c._v === selected ? 'tc-chip tc-chip--active' : 'tc-chip'; });
		});
		chips.push(chip);
		wrap.appendChild(chip);
	});
	return { el: wrap, value: function() { return selected; } };
}

function mkCard(title, body) {
	return E('div', { 'class': 'tg-section', 'style': 'margin-bottom:16px' }, [
		E('div', { 'class': 'tc-section-label' }, title), body
	]);
}

function mkStatus() {
	var el = E('span', { 'class': 'tg-save-status' });
	return {
		el: el,
		set: function(ok, msg) {
			el.textContent = (ok === null) ? msg : (ok ? '✓ ' : '✗ ') + (msg || '');
			el.style.color = (ok === null) ? 'var(--tc-muted)' : (ok ? 'var(--tc-ok)' : 'var(--tc-err)');
		}
	};
}

// rpcd refuses a whole call whose int param is NaN (sent as JSON null), so a
// field that does not parse goes out as a value the backend rejects with its
// own message (`invalid scan_interval`).
function intOr(v, dflt) {
	var n = parseInt(v, 10);
	return isNaN(n) ? dflt : n;
}

function reply(st, p) {
	return p.then(function(res) {
		st.set(!!(res && res.ok), (res && res.msg) || (res && res.ok ? _('Saved') : _('error')));
		return res;
	}).catch(function(e) {
		st.set(false, e.message);
	});
}

function textInput(value, placeholder, cls, secret) {
	return E('input', {
		'type': secret ? 'password' : 'text',
		'class': 'tg-input' + (cls ? ' ' + cls : ''),
		'value': value || '',
		'placeholder': placeholder || ''
	});
}

function renderPreview(bubble, tpl) {
	var now = new Date();
	var date = now.toISOString().slice(0, 10), time = now.toTimeString().slice(0, 5);
	var txt = tpl || '🆕 <b>New device</b>\n{{ name }} ({{ ip }})\nMAC: <code>{{ mac }}</code>\nLink: {{ link }}';
	var esc = function(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
	txt = esc(txt).replace(/&lt;(\/?)(b|i|code)&gt;/g, '<$1$2>');
	txt = txt.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, function(m, k) {
		if (k === 'date') return date;
		if (k === 'time') return time;
		if (k === 'datetime') return date + ' ' + time;
		return TEMPLATE_SAMPLE.hasOwnProperty(k) ? TEMPLATE_SAMPLE[k] : m;
	});
	bubble.innerHTML = txt.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
}

function templateEditor(value) {
	var area = E('textarea', {
		'class': 'tg-input tg-input--template',
		'placeholder': '🆕 New device\\n{{ name }} ({{ ip }})\\nMAC: {{ mac }}\\nLink: {{ link }}'
	}, value || '');
	var bubble = E('div', { 'class': 'tg-bubble' });
	area.addEventListener('input', function() { renderPreview(bubble, area.value); });
	renderPreview(bubble, value);
	var vars = E('div', { 'style': 'font-size:12px;line-height:1.7;color:currentColor' },
		[E('div', { 'style': 'font-weight:600;margin-bottom:4px' }, _('Variables'))].concat(
			TEMPLATE_VARS.map(function(v) {
				return E('div', {}, [E('code', {}, '{{ ' + v[0] + ' }}'), document.createTextNode(' — ' + v[1])]);
			})));
	var body = E('div', { 'class': 'tc-hidden', 'style': 'margin-top:6px' }, [
		E('div', { 'style': 'display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap' }, [
			E('div', { 'style': 'flex:1;min-width:200px' }, [area]), vars
		]),
		E('div', { 'style': 'margin-top:8px' }, [
			E('span', { 'class': 'tg-label', 'style': 'display:block;margin-bottom:4px' }, _('Preview:')), bubble
		])
	]);
	var toggle = E('span', { 'style': 'font-size:12px;cursor:pointer;color:var(--tc-muted);user-select:none' },
		'▸ ' + _('Customize the new device message'));
	toggle.addEventListener('click', function() {
		var show = body.classList.contains('tc-hidden');
		body.classList.toggle('tc-hidden');
		toggle.textContent = (show ? '▾ ' : '▸ ') + _('Customize the new device message');
	});
	return { area: area, el: E('div', { 'style': 'margin-top:8px' }, [toggle, body]) };
}

// The fields of one sender type: [ option, label, placeholder, secret ].
function senderFields(type, cfg) {
	switch (type) {
	case 'telegram':
		return [
			['bot_token', _('Token:'), cfg.bot_token_set ? _('the bot token from Settings') : _('Paste bot token'), true],
			['chat_id', _('Chat ID:'), cfg.bot_chat_id || _('Chat ID'), false]
		];
	case 'ntfy':
		return [
			['server', _('Server:'), 'https://ntfy.sh', false],
			['topic', _('Topic:'), 'my-router', false],
			['token', _('Access token:'), _('optional'), true]
		];
	case 'webhook':
		return [
			['url', _('URL:'), 'https://example.com/hook', false],
			['auth', _('Authorization header:'), _('optional'), true]
		];
	case 'mail':
		return [
			['to', _('To:'), 'me@example.com', false],
			['from', _('From:'), _('optional'), false],
			['account', _('msmtp account:'), _('default'), false]
		];
	}
	return [];
}

function senderCard(type, cfg) {
	var s = cfg.senders.filter(function(x) { return x.type === type; })[0] ||
		{ type: type, enabled: false, events: ['new_device'] };
	var body = E('div', {});
	var en = mkToggle('tc-n-' + type, _('Enabled'), s.enabled);
	var st = mkStatus();
	body.appendChild(E('div', { 'class': 'tg-row' }, [en.el, st.el]));

	var evs = mkChipSet(cfg.events.map(function(e) { return { v: e, l: EVENT_LABELS[e] || e }; }), s.events || []);
	body.appendChild(E('div', { 'class': 'tg-row' }, [E('span', { 'class': 'tg-label' }, _('Events:')), evs.el]));

	var inputs = {};
	senderFields(type, cfg).forEach(function(f) {
		var secret = f[3];
		var ph = (secret && s[f[0] + '_set']) ? '••••••••  ✓ ' + _('saved') : f[2];
		inputs[f[0]] = textInput(secret ? '' : s[f[0]], ph, null, secret);
		inputs[f[0]]._secret = secret;
		body.appendChild(E('div', { 'class': 'tg-row' }, [E('span', { 'class': 'tg-label' }, f[1]), inputs[f[0]]]));
	});

	var prio = null;
	if (type === 'ntfy') {
		prio = mkChipPick([{ v: 0, l: _('default') }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' },
			{ v: 4, l: '4' }, { v: 5, l: '5' }], parseInt(s.priority, 10) || 0);
		body.appendChild(E('div', { 'class': 'tg-row' }, [E('span', { 'class': 'tg-label' }, _('Priority:')), prio.el]));
	}
	if (type === 'mail' && !cfg.msmtp) {
		body.appendChild(E('div', { 'class': 'tg-row', 'style': 'font-size:12px;color:var(--tc-warn)' },
			_('Email needs msmtp: opkg install msmtp, then set up /etc/msmtprc.')));
	}

	var tpl = null;
	if (type === 'telegram') {
		tpl = templateEditor(s.template);
		body.appendChild(tpl.el);
	}

	var save = E('button', { 'class': 'tg-btn tg-btn--primary' }, _('Save'));
	var test = E('button', { 'class': 'tg-btn' }, _('Send test'));
	save.addEventListener('click', function() {
		var v = {};
		Object.keys(inputs).forEach(function(k) {
			var val = inputs[k].value;
			v[k] = (inputs[k]._secret && val === '' && s[k + '_set']) ? '***' : val;
		});
		st.set(null, _('Saving…'));
		reply(st, callNotifySet(type, en.input.checked, evs.values().join(' '), undefined, undefined,
			v.bot_token, v.chat_id, tpl ? tpl.area.value : undefined, v.server, v.topic, v.token,
			prio ? prio.value() : undefined, v.url, v.auth, v.to, v.from, v.account)).then(function(res) {
			if (res && res.ok) {
				Object.keys(inputs).forEach(function(k) {
					if (inputs[k]._secret && inputs[k].value !== '') {
						s[k + '_set'] = true;
						inputs[k].value = '';
						inputs[k].placeholder = '••••••••  ✓ ' + _('saved');
					}
				});
			}
		});
	});
	test.addEventListener('click', function() {
		test.disabled = true;
		st.set(null, _('Sending…'));
		reply(st, callNotifyTest(type)).then(function() { test.disabled = false; });
	});
	body.appendChild(E('div', { 'class': 'tg-row' }, [save, test]));
	return mkCard(SENDER_TITLES[type] || type, body);
}

function generalCard(cfg) {
	var body = E('div', {});
	var en = mkToggle('tc-n-enabled', _('Send notifications'), cfg.enabled);
	var st = mkStatus();
	body.appendChild(E('div', { 'class': 'tg-row' }, [en.el, st.el]));
	var scan = mkChipPick([{ v: 'auto', l: _('When needed') }, { v: '1', l: _('Always') }, { v: '0', l: _('Off') }],
		cfg.scan);
	var interval = textInput(String(cfg.scan_interval), '30', 'tg-input--chat');
	body.appendChild(E('div', { 'class': 'tg-row' }, [
		E('span', { 'class': 'tg-label' }, _('Device scan:')), scan.el,
		E('span', { 'class': 'tg-label' }, _('every')), interval, E('span', {}, _('s'))
	]));
	body.appendChild(E('div', { 'class': 'tg-row', 'style': 'font-size:12px;color:var(--tc-muted)' },
		cfg.scan_wanted ? _('The scan for new and known devices is running.')
			: _('The scan for new and known devices is not running: no sender takes those events.')));
	var save = E('button', { 'class': 'tg-btn tg-btn--primary' }, _('Save'));
	save.addEventListener('click', function() {
		st.set(null, _('Saving…'));
		reply(st, callNotifySet('', en.input.checked, undefined, scan.value(), intOr(interval.value, -1)));
	});
	body.appendChild(E('div', { 'class': 'tg-row' }, [save]));
	return mkCard(_('General'), body);
}

function hooksCard(cfg) {
	return mkCard(_('Scripts and ubus'), E('div', { 'style': 'font-size:12px;line-height:1.6' }, [
		E('div', {}, [
			document.createTextNode(_('Every event is also sent as a ubus event:') + ' '),
			E('code', {}, 'ubus listen trafficctl.notify')
		]),
		E('div', {}, [
			document.createTextNode(_('and runs the scripts in') + ' '),
			E('code', {}, '/etc/hotplug.d/trafficctl/'),
			document.createTextNode(' ' + _('with ACTION set to the event and the fields in upper case (IP, MAC, NAME, ...).'))
		]),
		E('div', { 'style': 'color:var(--tc-muted)' },
			_('Scripts installed: %d').format(cfg.hotplug_scripts || 0))
	]));
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return callNotifyGet();
	},

	render: function(cfg) {
		cfg = cfg || {};
		cfg.senders = cfg.senders || [];
		cfg.events = cfg.events || Object.keys(EVENT_LABELS);
		var types = cfg.types || ['telegram', 'ntfy', 'webhook', 'mail'];
		var body = E('div', { 'class': 'tc-settings-body' }, [generalCard(cfg)]);
		types.forEach(function(t) { body.appendChild(senderCard(t, cfg)); });
		body.appendChild(hooksCard(cfg));
		return E('div', {}, [E('h2', {}, _('Notifications')), body]);
	}
});
