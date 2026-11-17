'use strict';
'require fs';
'require ui';
'require uci';
'require view';

/*
 * Screens editor for the built-in LCD renderer (utr-lcd): add, order and edit screens, pick their
 * widgets and sizes, and see each screen rendered by the router's own renderer (luci-preview) while
 * editing, before anything is saved.
 */

var PREVIEW = '/usr/libexec/utr-lcd/luci-preview';
var STATUS = '/usr/libexec/utr-lcd/luci-status';
var SCALE = 1;   /* 1:1 - the real panel is tiny, a bigger picture would mislead */

/* ---- model (pure functions, kept free of the DOM so they can be tested) ---- */

var MAX_WIDGETS = 16;
var GAP = 2;
var ROW = 17;

/* widget types: label, allowed sizes, default size, unit of the size, group */
var TYPES = {
	ssid:        { label: _('Network name'), group: 'general', sizes: [16, 24, 32], def: 24 },
	dbm:         { label: _('Signal strength'), group: 'general', sizes: [16, 24, 32], def: 32 },
	bars:        { label: _('Signal (bars)'), group: 'general', sizes: [16, 24, 32], def: 24 },
	sigbar:      { label: _('Signal (line bar)'), group: 'general', sizes: [12, 16, 24], def: 16 },
	status:      { label: _('Online status'), group: 'general', sizes: [16, 24, 32], def: 16 },
	fan:         { label: _('Signal (Wi-Fi fan)'), group: 'general', sizes: [24, 32, 48], def: 32 },
	segbar:      { label: _('Signal (segment bar)'), group: 'general', sizes: [12, 16, 24], def: 16 },
	clients:     { label: _('Client count'), group: 'general', sizes: [16, 24, 32], def: 24 },
	wanip:       { label: _('WAN IP address'), group: 'general', sizes: [12, 16], def: 16 },
	lanip:       { label: _('LAN IP address'), group: 'general', sizes: [12, 16], def: 16 },
	vpn:         { label: _('VPN'), group: 'general', sizes: [12, 16], def: 16 },
	uptime:      { label: _('Uptime'), group: 'general', sizes: [12, 16], def: 16 },
	rule:        { label: _('Divider line'), group: 'general', sizes: null, def: 2 },
	speed:       { label: _('Speed down / up'), group: 'traffic', sizes: [16, 24], def: 24 },
	speed1:      { label: _('Speed down+up (one line)'), group: 'traffic', sizes: [16], def: 16 },
	speedbar:    { label: _('Client speed, down+up (bar)'), group: 'traffic', sizes: [12, 16, 20, 24], def: 12 },
	speeddn:     { label: _('Client download speed (bar)'), group: 'traffic', sizes: [12, 16, 20, 24], def: 12 },
	speedup:     { label: _('Client upload speed (bar)'), group: 'traffic', sizes: [12, 16, 20, 24], def: 12 },
	usage:       { label: _('Total traffic'), group: 'traffic', sizes: [12, 16], def: 16 },
	usagebar:    { label: _('Client traffic, total (bar)'), group: 'traffic', sizes: [12, 16, 20, 24], def: 12 },
	usagedn:     { label: _('Client downloaded total (bar)'), group: 'traffic', sizes: [12, 16, 20, 24], def: 20 },
	usageup:     { label: _('Client uploaded total (bar)'), group: 'traffic', sizes: [12, 16, 20, 24], def: 20 },
	uplinks:     { label: _('Uplinks (icons, mwan3)'), group: 'traffic', sizes: [16, 24], def: 24 },
	legend:      { label: _('Clients, speed'), group: 'traffic', sizes: [1, 2, 3, 4, 5, 6, 7, 8], def: 4, unit: 'rows' },
	legendtotal: { label: _('Clients, total'), group: 'traffic', sizes: [1, 2, 3, 4, 5, 6, 7, 8], def: 4, unit: 'rows' },
	donut:       { label: _('Speed by client (ring)'), group: 'traffic', sizes: [48, 64, 80, 96], def: 80, unit: 'px' },
	multiwan:    { label: _('Multi-WAN shares'), group: 'traffic', sizes: [12, 16], def: 16 },
	cpu:         { label: _('CPU load'), group: 'resources', sizes: [12, 16], def: 16 },
	cpuram:      { label: _('CPU + memory (one line)'), group: 'resources', sizes: [12, 16], def: 16 },
	ram:         { label: _('Memory'), group: 'resources', sizes: [12, 16], def: 16 },
	flash:       { label: _('Flash storage'), group: 'resources', sizes: [12, 16], def: 16 },
	load:        { label: _('Load average'), group: 'resources', sizes: [12, 16], def: 16 },
	temp:        { label: _('Wi-Fi chip temperature'), group: 'resources', sizes: [12, 16], def: 16 }
};

/* one-line explanations, shown in the widget's Options cell (the details nobody can guess) */
var DESCS = {
	status: _('Globe and words: green ONLINE, amber NO INTERNET (uplink up, check failing), red NO UPLINK. In a shared line only the globe shows.'),
	segbar: _('Wi-Fi signal as the stock-style bar of 10 segments; lit segments = strength. Wi-Fi uplinks only.'),
	bars: _('Wi-Fi signal as five ascending bars; lit bars = strength. Wi-Fi uplinks only.'),
	fan: _('Wi-Fi fan icon; lit arcs = signal strength (4 arcs full, fewer when weak). Wi-Fi uplinks only.'),
	dbm: _('Wi-Fi signal strength in dBm as large text (e.g. -52 dBm; closer to zero is better). Wi-Fi uplinks only.'),
	sigbar: _('Wi-Fi signal as a resource-style bar with a percent value; at 24 px the dBm value sits on top. Wi-Fi uplinks only.'),
	ssid: _('Name of the network the uplink is connected to (SSID, or Ethernet). Wrap puts a long name on two lines, Shrink then steps the font down until it fits.'),
	clients: _('How many clients are connected now (person icon with a count).'),
	wanip: _('The address of the primary uplink (WAN side). Long addresses are shortened in the middle.'),
	lanip: _('The router address on the LAN (br-lan).'),
	vpn: _('VPN state: shield with the interface name when up, hidden when no VPN is configured.'),
	uptime: _('Time since boot, e.g. 2h 32m.'),
	rule: _('A thin horizontal divider line.'),
	speed: _('Current download and upload speed of the primary uplink, two lines.'),
	speed1: _('Current download and upload speed on one line.'),
	speedbar: _('Current speed split by client; colours match the client list. A white segment is traffic no client accounts for (the router itself); the bar is scaled by the real total.'),
	speeddn: _('Download speed split by client. Show speed value writes the total download speed on the bar. White = unattributed (the router itself).'),
	speedup: _('Upload speed split by client. Show speed value writes the total upload speed on the bar. White = unattributed (the router itself).'),
	usage: _('Total traffic since boot as one number (download + upload).'),
	usagebar: _('Downloaded + uploaded bytes split by client, total written inside the bar. White = unattributed (the router itself).'),
	usagedn: _('Downloaded bytes split by client, total inside the bar. White = unattributed (the router itself).'),
	usageup: _('Uploaded bytes split by client, total inside the bar. White = unattributed (the router itself).'),
	legend: _('Clients ranked by current speed: colour chip, name, speed (down+up, e.g. 5.2M = 5.2 Mb/s). Names that are IPs are trimmed from the left (the host end counts). Background: a bar per client, widest = the leader; signal adds a 1 px line under each bar, coloured by that client strength (green/amber/red). Scale by peak: the widest bar is the fastest rate seen so far (forgotten slowly), not the current leader. Split: download bar with a thinner, brighter upload strip on top, one scale for both; the number stays the sum. Fit squeezes more rows into the same height.'),
	legendtotal: _('Clients ranked by total traffic (bytes since boot); the number is the total. Background, peak and split work as in the speed client list (split shows uploaded vs downloaded bytes).'),
	donut: _('Ring of the current speed split by client, with the total speed in the middle.'),
	multiwan: _('One row per uplink with its share of the current traffic. Uses mwan3 when installed; hidden with a single uplink.'),
	uplinks: _('One icon per uplink (Wi-Fi fan / Ethernet port): green online, amber = uplink tracked online but it has no default route (without mwan3: route exists but the internet check fails), red offline, dim = standby or idle. The two 1 px lines under the icons show the observed download (top) and upload split, in the same colours. Without mwan3 the colours fall back to the internet status.'),
	cpu: _('CPU load: a total bar, one segment per core in a single bar, or one strip per core stacked in the row. Green below 60%, amber to 85%, red above.'),
	cpuram: _('CPU and memory on one line. Labels + bars + %, or Graphs: one strip per CPU core and a memory bar, with or without the percent values. Memory is green below 80%, amber to 90%, red above.'),
	ram: _('Memory used, percent. Green below 80%, amber to 90%, red above.'),
	flash: _('Flash storage used, percent. Green below 60%, amber to 85%, red above.'),
	load: _('Load average against the core count: background bar = 1-minute load, numbers are 1 / 5 / 15 minutes.'),
	temp: _('Wi-Fi chip temperature; hidden when the router reports no sensor.')
};

var DEFAULT_SCREENS = [
	{ name: 'Status', dwell: '8', spacing: 'auto', enabled: true, backfill: false,
	  widgets: [ ['status', 16], ['segbar', 24], ['dbm', 32], ['ssid', 32, false, true, true], ['vpn', 16], ['rule', 2], ['clients', 24] ] },
	{ name: 'Traffic', dwell: '8', spacing: '0', enabled: true, backfill: true,
	  widgets: [ ['uplinks', 24, false, false, false, 0, 0, 0, false, false, true], ['cpuram', 16, false, false, false, 0, 0, 0, false, false, false, false, false, false, false, 1],
	    ['speeddn', 20, false, false, false, 0, 0, 0, false, false, false, false, true], ['speedup', 20, false, false, false, 0, 0, 0, false, false, false, false, true],
	    ['usagedn', 20], ['usageup', 20], ['rule', 2], ['legend', 4, false, false, false, 4, 2, 0, false, false, false, false, false, true, true], ['status', 16, false, false, false, 0, 0, 0, false, false, false, false, false, false, false, 0, true] ] },
	{ name: 'Details', dwell: '5', spacing: '1', enabled: true, backfill: true,
	  widgets: [ ['status', 16, true, true, true], ['clients', 24], ['wanip', 12], ['lanip', 16], ['vpn', 16], ['uptime', 16],
	    ['cpu', 16, false, false, false, 0, 0, 2], ['ram', 16], ['flash', 16], ['temp', 16], ['sigbar', 16], ['load', 16] ] }
];

/* Height in pixels a widget needs (the same table as widget_h in lcd-status.c; widgets with nothing to
 * show right now take no room, so this is the worst case). */
function widgetHeight(type, size, wrap, w) {
	size = +size;
	if (type === 'ssid' && wrap) return 2 * size + 2;   /* wrapped name may take a second line */
	if (type === 'uplinks') {   /* mirror uplinks_h in lcd-status.c, worst case 2 uplinks */
		if (w && w[10] && w[11]) return 8;
		if (w && w[8]) return w[11] ? 2 * (size >= 24 ? 20 : 16) + 10 : 2 * size + 10;
		return w && w[11] ? 24 : w && w[10] ? size + 10 : size + 22;
	}
	switch (type) {
	case 'rule': return 6;
	case 'speed': return 2 * (size + 2);
	case 'legend':
	case 'legendtotal': return size * ROW;
	case 'multiwan': return 2 * ((size >= 16 ? 16 : 12) + 2 + (size >= 16 ? 8 : 6) + 4);
	case 'speedbar': case 'speeddn': case 'speedup': case 'usagebar': case 'usagedn': case 'usageup': return size + 1;   /* bars pack tighter */
	default: return size + 2;
	}
}

/* Room for widgets (content now starts at the top margin; the status is a widget). */
function availableHeight() {
	return 233 - 4;
}

/* Heights of the lines: widgets joined with the next one share a line (its height is the max). */
function lineHeights(widgets) {
	var lines = [], cur = 0;
	widgets.forEach(function(w, i) {
		cur = Math.max(cur, widgetHeight(w[0], w[1], w[3], w));
		if (!w[2] || i === widgets.length - 1) { lines.push(cur); cur = 0; }
	});
	return lines;
}

function usedHeight(widgets, spacing) {
	var lines = lineHeights(widgets), sum = 0;
	lines.forEach(function(h) { sum += h; });
	var gap = spacing && spacing !== 'auto' ? +spacing : GAP;
	return sum + (lines.length > 1 ? gap * (lines.length - 1) : 0);
}

/* How many widgets are in the joined line containing index wi (at most 3 fit, see MAX_SUB). */
function groupSize(widgets, wi) {
	var n = 1, i;
	for (i = wi; i > 0 && widgets[i - 1][2]; i--) n++;
	for (i = wi; i < widgets.length - 1 && widgets[i][2]; i++) n++;
	return n;
}

function parseWidget(str) {
	var p = String(str).split(':'), t = TYPES[p[0]];
	if (!t) return null;
	var size = parseInt(p[1], 10);
	if (!size || (t.sizes && t.sizes.indexOf(size) < 0)) size = t.def;
	var o = p[1] || '', bg = /b([0-5])/.exec(o);
	/* [type, size, join, wrap, shrink, bg, fit, cores, inline, generic, noname, noicon, showval, peak, split] - flags
	 * after the size: w wrap, s shrink (ssid), b0..b5 legend bg, f/F fit, c per-core, l/g/n/i uplinks, v speed value,
	 * p legend peak scaling, x legend split up/down bar */
	return [p[0], size, false, /w/.test(o), /s/.test(o), bg ? +bg[1] : 0, /F/.test(o) ? 2 : /f/.test(o) ? 1 : 0,
		/r/.test(o) ? 2 : /c/.test(o) ? 1 : 0, /l/.test(o), /g/.test(o), /n/.test(o), /i/.test(o), /v/.test(o), /p/.test(o), /x/.test(o), /G/.test(o) ? (/H/.test(o) ? 2 : 1) : 0, /B/.test(o)];
}

function widgetSpec(w) {
	return w[0] + ':' + w[1] + (w[3] ? 'w' : '') + (w[4] ? 's' : '') +
		(w[5] ? 'b' + w[5] : '') + (w[6] === 2 ? 'F' : w[6] === 1 ? 'f' : '') + (w[7] === 2 ? 'r' : w[7] ? 'c' : '') + (w[8] ? 'l' : '') + (w[9] ? 'g' : '') +
		(w[10] ? 'n' : '') + (w[11] ? 'i' : '') + (w[12] ? 'v' : '') + (w[13] ? 'p' : '') + (w[14] ? 'x' : '') + (w[15] === 2 ? 'GH' : w[15] === 1 ? 'G' : '') + (w[16] ? 'B' : '');
}

/* One config item: "type:size" or several joined by '+' for one shared line. */
function parseWidgetList(str) {
	var parts = String(str).split('+').map(parseWidget).filter(function(w) { return w; });
	parts.forEach(function(w, i) { w[2] = i < parts.length - 1; });
	return parts;
}

/* The layout in the flat key=value format the renderer reads (same as utr-lcd.init writes). */
function flatten(main, screens) {
	var out = [
		'mode=' + main.screen_mode, 'pin=' + main.screen_pin, 'playlist=' + main.playlist,
		'fill_dim=' + main.fill_dim, 'fill_edge=' + (main.fill_edge ? 1 : 0), 'name_len=' + main.name_len
	];
	screens.forEach(function(s) {
		out.push('screen=' + String(s.name).replace(/[\r\n]/g, ' '), 'dwell=' + s.dwell, 'spacing=' + (s.spacing || 'auto'), 'enabled=' + (s.enabled ? 1 : 0),
			'indicator=none', 'backfill=' + (s.backfill ? 1 : 0), 'debug=' + (s.debug ? 1 : 0));
		var line = [];
		s.widgets.forEach(function(w, i) {
			line.push(widgetSpec(w));
			if (!w[2] || i === s.widgets.length - 1) { out.push('widget=' + line.join('+')); line = []; }
		});
	});
	return out.join('\n');
}

/* "count:rrggbb" runs (see write_rle in lcd-status.c) into [w, h, Uint8 RGBA]. */
function decodeRle(text) {
	var lines = text.split('\n'), wh = lines[0].trim().split(' '), w = +wh[0], h = +wh[1];
	var data = new Uint8ClampedArray(w * h * 4), pos = 0;
	(lines[1] || '').trim().split(' ').forEach(function(run) {
		var p = run.split(':'), n = +p[0], c = parseInt(p[1], 16);
		for (var i = 0; i < n && pos < w * h; i++, pos++) {
			data[pos * 4] = (c >> 16) & 255;
			data[pos * 4 + 1] = (c >> 8) & 255;
			data[pos * 4 + 2] = c & 255;
			data[pos * 4 + 3] = c === 0xff00ff ? 0 : 255;   /* ff00ff = hidden by the bezel: transparent */
		}
	});
	return { w: w, h: h, data: data, filled: pos };
}

/* what-if scenarios: overrides of what the collector reports */
var SCENARIOS = {
	none:       [],
	weak:       [ 'up_signal=-82', 'up0_signal=-82' ],
	longssid:   [ 'up_name=Hotel-Guest-WiFi-Conference-Room-5G', 'up0_name=Hotel-Guest-WiFi-Conference-Room-5G' ],
	ethernet:   [ 'up_type=eth', 'up_name=Ethernet', 'up_speed=1000', 'up_signal=', 'up0_type=eth', 'up0_name=Ethernet', 'up0_speed=1000', 'up0_signal=' ],
	nouplink:   [ 'up_state=down', 'ups=0' ],
	nointernet: [ 'inet=fail' ],
	vpnup:      [ 'vpn_state=up', 'vpn_name=wg0' ],
	vpndown:    [ 'vpn_state=down', 'vpn_name=wg0' ],
	novpn:      [ 'vpn_state=none' ]
};

/* made-up state for the "example data" source */
var EXAMPLE = [
	'up_state=up', 'up_type=wifi', 'up_name=iNomad', 'up_signal=-52', 'up_speed=144', 'wan_ip=192.168.87.221', 'lan_ip=192.168.1.1',
	'inet=ok', 'vpn_state=up', 'vpn_name=wg0', 'clients=3', 'uptime=9163',
	'up0_dev=phy0-sta0', 'up0_type=wifi', 'up0_name=iNomad', 'up0_signal=-52', 'up0_speed=144', 'up0_metric=10',
	'up1_dev=wan', 'up1_type=eth', 'up1_name=Ethernet', 'up1_speed=1000', 'up1_metric=20', 'ups=2'
];

/* ---- end of the model ---- */

function bool(v, def) {
	return v == null || v === '' ? def : (v === '1' || v === 'true' || v === 'yes' || v === 'on' || v === true);
}

function callStatus() {
	return fs.exec_direct(STATUS, [], 'json').catch(function() { return null; });
}

function drawRle(canvas, text) {
	var img = decodeRle(text);
	if (!img.w || !img.h || img.filled < img.w * img.h) throw new Error('bad preview data');
	canvas.width = img.w;
	canvas.height = img.h;
	canvas.style.width = (img.w * SCALE) + 'px';
	canvas.style.height = (img.h * SCALE) + 'px';
	var ctx = canvas.getContext('2d');
	ctx.putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
}

return view.extend({
	load: function() {
		return Promise.all([ uci.load('utr-lcd'), callStatus() ]);
	},

	render: function(data) {
		var self = this, status = data[1] || {};
		var stockActive = status.mode === 'stock';   /* what is running right now */

		/* ---- state from UCI ---- */
		var main = {
			screen_mode: uci.get('utr-lcd', 'main', 'screen_mode') === 'pin' ? 'pin' : 'rotate',
			screen_pin: uci.get('utr-lcd', 'main', 'screen_pin') || '1',
			playlist: uci.get('utr-lcd', 'main', 'playlist') || '',
			fill_dim: uci.get('utr-lcd', 'main', 'fill_dim') || '40',
			fill_edge: bool(uci.get('utr-lcd', 'main', 'fill_edge'), true),
			name_len: uci.get('utr-lcd', 'main', 'name_len') || '8'
		};
		var screens = uci.sections('utr-lcd', 'screen').map(function(s) {
			var list = s.widget || [];
			if (!Array.isArray(list)) list = [ list ];
			return {
				name: s.name || _('Screen'), dwell: s.dwell || '8', enabled: bool(s.enabled, true),
				spacing: (s.spacing === 'auto' || /^[0-9]+$/.test(s.spacing || '')) ? (s.spacing || 'auto') : 'auto',
				backfill: bool(s.backfill, true), debug: bool(s.debug, false),
				widgets: list.reduce(function(acc, item) { return acc.concat(parseWidgetList(item)); }, [])
			};
		});
		if (!screens.length)
			screens = DEFAULT_SCREENS.map(function(s) {
				return { name: s.name, dwell: s.dwell, spacing: s.spacing, enabled: s.enabled, backfill: s.backfill, debug: !!s.debug,
					widgets: s.widgets.map(function(w) { return w.slice(); }) };
			});

		var preview = { source: 'live', scenario: 'none', tsim: 'eth' };
		var canvases = [], notes = [];
		var container = E('div', {});
		var globals = E('div', {});
		var timer = null, seq = 0;

		/* ---- small DOM helpers ---- */
		function select(options, value, onchange, extra) {
			var sel = E('select', Object.assign({ 'class': 'cbi-input-select', 'change': function() { onchange(this.value); } }, extra || {}),
				options.map(function(o) { return E('option', { 'value': o[0], 'selected': String(o[0]) === String(value) ? '' : null }, o[1]); }));
			return sel;
		}
		function text(value, onchange, width, type) {
			return E('input', { 'type': type || 'text', 'class': 'cbi-input-text', 'value': value, 'style': 'width:' + width + 'px',
				'change': function() { onchange(this.value); } });
		}
		function check(value, onchange, label) {
			return E('label', { 'style': 'margin-right:1em; white-space:nowrap' }, [
				E('input', { 'type': 'checkbox', 'checked': value ? '' : null, 'change': function() { onchange(this.checked); } }), ' ', label ]);
		}
		function btn(label, onclick, disabled, title) {
			return E('button', { 'class': 'cbi-button', 'type': 'button', 'click': onclick, 'disabled': disabled ? '' : null, 'title': title || null }, label);
		}
		function sizeLabel(t, s) {
			return t.unit === 'rows' ? s + ' ' + (s === 1 ? _('row') : _('rows')) : t.unit === 'px' ? s + ' px' : s + ' px';
		}

		/* ---- preview ---- */
		function overrides() {
			var o = preview.source === 'example' ? EXAMPLE.slice() : [];
			if (preview.source === 'example') o.push('tsim=' + preview.tsim);
			return o.concat(SCENARIOS[preview.scenario] || []);
		}

		function runPreview() {
			/* lines joined by \x1f, not \n: exec_direct escapes whitespace in arguments (see luci-preview) */
			var my = ++seq, conf = flatten(main, screens).replace(/\n/g, '\x1f'), ov = overrides(), demo = preview.source === 'example' ? '1' : '0';
			var chain = Promise.resolve();
			screens.forEach(function(s, i) {
				chain = chain.then(function() {
					if (my !== seq || !canvases[i]) return;
					return fs.exec_direct(PREVIEW, [ String(i + 1), demo, conf ].concat(ov), 'text').then(function(out) {
						if (my !== seq || !canvases[i]) return;
						drawRle(canvases[i], out);
						notes[i].textContent = '';
					}).catch(function(err) {
						if (notes[i]) notes[i].textContent = _('Preview not available: ') + (err && err.message ? err.message : err);
					});
				});
			});
		}

		function schedulePreview() {
			clearTimeout(timer);
			timer = setTimeout(runPreview, 400);
		}

		/* ---- screens ---- */
		function move(arr, i, d) {
			var j = i + d;
			if (j < 0 || j >= arr.length) return;
			var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
		}

		function optionsCell(sc, wi) {
			var w = sc.widgets[wi];
			var stick = check(!!w[16], function(v) { w[16] = v; redraw(); }, _('Stick to bottom'));
			if (w[0] === 'legend' || w[0] === 'legendtotal')
				return E('td', {}, [
					select([ [ '0', _('Background: none') ], [ '1', _('Background: speed') ], [ '2', _('Background: total') ], [ '3', _('Background: signal') ], [ '4', _('Background: signal + speed') ], [ '5', _('Background: signal + total') ] ], w[5] || 0, function(v) { w[5] = +v; redraw(); }, { 'style': 'width:100%; max-width:11em' }),
					select([ [ '0', _('Fit: off') ], [ '1', _('Fit: gentle') ], [ '2', _('Fit: compact') ] ], w[6] || 0, function(v) { w[6] = +v; redraw(); }, { 'style': 'width:100%; max-width:9em; margin-top:2px' }),
					E('div', { 'style': 'margin-top:2px' }, [
						check(!!w[13], function(v) { w[13] = v; redraw(); }, _('Scale by peak seen')),
						check(!!w[14], function(v) { w[14] = v; redraw(); }, _('Split up/down'))
					]),
					stick
				]);
			if (w[0] === 'cpuram')
				return E('td', {}, [ select([ [ '0', _('Labels + bars + %') ], [ '1', _('Graphs + %') ], [ '2', _('Graphs only') ] ], w[15] || 0, function(v) { w[15] = +v; redraw(); }, { 'style': 'width:100%; max-width:11em' }), stick ]);
			if (w[0] === 'cpu')
				return E('td', {}, [ select([ [ '0', _('Bar: total') ], [ '1', _('Bar: per-core segments') ], [ '2', _('Bar: per-core rows') ] ], w[7] || 0, function(v) { w[7] = +v; redraw(); }, { 'style': 'width:100%; max-width:11em' }), stick ]);
			if (w[0] === 'uplinks')
				return E('td', {}, [
					check(!!w[8], function(v) { w[8] = v; redraw(); }, _('Icon beside name')),
					check(!!w[9], function(v) { w[9] = v; redraw(); }, _('Short names (WiFi/Eth)')),
					check(!!w[10], function(v) { w[10] = v; redraw(); }, _('No names')),
					check(!!w[11], function(v) { w[11] = v; redraw(); }, _('No icons')),
					stick
				]);
			if (w[0] === 'speeddn' || w[0] === 'speedup')
				return E('td', {}, [ check(!!w[12], function(v) { w[12] = v; redraw(); }, _('Show speed value')), stick ]);
			return E('td', {}, stick);
		}

		function widgetRow(sc, wi) {
			var w = sc.widgets[wi], t = TYPES[w[0]];
			var joinFull = !w[2] && groupSize(sc.widgets, wi) >= 3;
			return E('tr', {}, [
				E('td', {}, select(Object.keys(TYPES).map(function(k) { return [ k, TYPES[k].label ]; }), w[0], function(v) {
					w[0] = v; w[1] = TYPES[v].def; w[3] = w[4] = false; w[5] = 0; w[6] = 0; w[7] = 0; w[8] = false; w[9] = false; w[10] = false; w[11] = false; w[12] = false; w[13] = false; w[14] = false; w[15] = 0; w[16] = false; redraw();
				}, { 'style': 'width:100%; max-width:13em' })),
				E('td', { 'style': 'text-align:center' }, E('input', { 'type': 'checkbox', 'title': _('Share one line with the next widget (up to three)'),
					'checked': w[2] ? '' : null, 'disabled': (wi === sc.widgets.length - 1 || joinFull) ? '' : null,
					'change': function() { w[2] = this.checked; redraw(); } })),
				E('td', { 'style': 'text-align:center' }, w[0] === 'ssid' ? E('input', { 'type': 'checkbox', 'title': _('Wrap a long name to a second line instead of cutting it'),
					'checked': w[3] ? '' : null,
					'change': function() { w[3] = this.checked; redraw(); } }) : E('span', { 'style': 'opacity:.6' }, '-')),
				E('td', { 'style': 'text-align:center' }, w[0] === 'ssid' ? E('input', { 'type': 'checkbox', 'title': _('If the name still does not fit (on two lines when wrapping), reduce the font size step by step until it does'),
					'checked': w[4] ? '' : null,
					'change': function() { w[4] = this.checked; redraw(); } }) : E('span', { 'style': 'opacity:.6' }, '-')),
				(function() { var c = optionsCell(sc, wi); if (DESCS[w[0]]) c.appendChild(E('small', { 'style': 'display:block; opacity:.75; margin-top:3px; max-width:24em; white-space:normal' }, DESCS[w[0]])); return c; })(),
				E('td', {}, t.sizes ? select(t.sizes.map(function(s) { return [ s, sizeLabel(t, s) ]; }), w[1], function(v) {
					w[1] = +v; redraw();
				}) : E('span', { 'style': 'opacity:.6' }, '-')),
				E('td', { 'style': 'text-align:right; opacity:.7; white-space:nowrap' }, widgetHeight(w[0], w[1], w[3], w) + ' px'),
				E('td', { 'style': 'white-space:nowrap' }, [
					btn('\u2191', function() { move(sc.widgets, wi, -1); redraw(); }, wi === 0, _('Move up')),
					btn('\u2193', function() { move(sc.widgets, wi, 1); redraw(); }, wi === sc.widgets.length - 1, _('Move down')),
					btn('\u2715', function() { sc.widgets.splice(wi, 1); redraw(); }, false, _('Remove'))
				])
			]);
		}

		function screenCard(sc, si) {
			var avail = availableHeight(), used = usedHeight(sc.widgets, sc.spacing), over = used > avail;
			var remaining = avail - used - (sc.widgets.length ? (sc.spacing && sc.spacing !== 'auto' ? +sc.spacing : GAP) : 0);

			var addOptions = [ [ '', _('Add a widget...') ] ], groups = { general: _('General'), traffic: _('Traffic'), resources: _('Resources') };
			var addSel = E('select', { 'class': 'cbi-input-select', 'change': function() {
				var k = this.value;
				if (!k || sc.widgets.length >= MAX_WIDGETS) return;
				sc.widgets.push([ k, TYPES[k].def ]);
				redraw();
			} }, [ E('option', { 'value': '' }, addOptions[0][1]) ].concat([ 'general', 'traffic', 'resources' ].map(function(g) {
				return E('optgroup', { 'label': groups[g] }, Object.keys(TYPES).filter(function(k) { return TYPES[k].group === g; }).map(function(k) {
					var fits = widgetHeight(k, TYPES[k].def) <= remaining;
					return E('option', { 'value': k, 'disabled': fits ? null : '' }, TYPES[k].label + ' (' + widgetHeight(k, TYPES[k].def) + ' px)');
				}));
			})));
			if (sc.widgets.length >= MAX_WIDGETS) addSel.disabled = true;

			var meter = E('div', { 'style': 'margin:6px 0' }, [
				E('div', { 'style': 'height:8px; background:#ddd; border-radius:4px; overflow:hidden; max-width:360px' },
					E('div', { 'style': 'height:8px; width:' + Math.min(100, used * 100 / avail) + '%; background:' + (over ? '#d33' : used > avail * 0.9 ? '#e90' : '#3a3') })),
				E('small', { 'style': over ? 'color:#d33' : '' }, over
					? _('Too much: %d of %d px used, the widgets do not fit on the screen.').format(used, avail)
					: _('%d of %d px used, %d px free').format(used, avail, avail - used))
			]);

			var canvas = E('canvas', { 'width': 136, 'height': 240, 'style': 'width:' + (136 * SCALE) + 'px; height:' + (240 * SCALE) + 'px; image-rendering:pixelated' });
			var note = E('div', { 'style': 'color:#d33; max-width:' + (136 * SCALE) + 'px' });
			if (!sc._folded) { canvases[si] = canvas; notes[si] = note; }

			var header = E('div', { 'style': 'display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:' + (sc._folded ? '0' : '8px') }, [
					E('strong', {}, _('Screen %d').format(si + 1)),
					text(sc.name, function(v) { sc.name = v; schedulePreview(); }, 130),
					E('span', {}, [ text(sc.dwell, function(v) {
						var n = parseFloat(v);
						sc.dwell = isNaN(n) || n < 0.5 ? '0.5' : String(n);
						redraw();
					}, 50), ' ', _('s on screen') ]),
					check(sc.enabled, function(v) { sc.enabled = v; redraw(); }, _('In rotation')),
					select([ [ 'auto', _('Spacing: auto') ], [ '0', _('Spacing: 0 px') ], [ '1', _('Spacing: 1 px') ], [ '2', _('Spacing: 2 px') ], [ '4', _('Spacing: 4 px') ], [ '6', _('Spacing: 6 px') ], [ '8', _('Spacing: 8 px') ], [ '12', _('Spacing: 12 px') ], [ '18', _('Spacing: 18 px') ] ], sc.spacing, function(v) { sc.spacing = v; redraw(); }),
					check(sc.backfill, function(v) { sc.backfill = v; redraw(); }, _('Signal background')),
					check(sc.debug, function(v) { sc.debug = v; redraw(); }, _('Debug line')),
					btn('\u2191', function() { move(screens, si, -1); redraw(); }, si === 0, _('Move screen up')),
					btn('\u2193', function() { move(screens, si, 1); redraw(); }, si === screens.length - 1, _('Move screen down')),
					btn(_('Remove screen'), function() {
						if (screens.length > 1 && confirm(_('Remove this screen?'))) { screens.splice(si, 1); redraw(); }
					}, screens.length <= 1),
					btn(_('Duplicate'), function() {
						if (screens.length >= 12) return;
						screens.splice(si + 1, 0, {
							name: sc.name + ' ' + _('copy'), dwell: sc.dwell, spacing: sc.spacing, enabled: sc.enabled,
							backfill: sc.backfill, debug: sc.debug, _folded: false,
							widgets: sc.widgets.map(function(w) { return w.slice(); })
						});
						redraw();
					}, screens.length >= 12, _('Copy this screen below')),
					btn(sc._folded ? _('Unfold') : _('Fold'), function() { sc._folded = !sc._folded; redraw(); }, false,
						sc._folded ? _('Show widgets and preview') : _('Hide widgets and preview'))
				]);

			var parts = [ header ];
			if (!sc._folded) parts.push(E('div', { 'style': 'display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start' }, [
					E('div', { 'style': 'flex:1 1 300px; min-width:0' }, [
						sc.widgets.length ? E('div', { 'style': 'overflow-x:auto' }, E('table', { 'class': 'table', 'style': 'width:100%' }, [
							E('tr', { 'class': 'tr table-titles' }, [ E('th', { 'class': 'th' }, _('Widget')), E('th', { 'class': 'th' }, _('Join next')), E('th', { 'class': 'th' }, _('Wrap')), E('th', { 'class': 'th' }, _('Shrink')), E('th', { 'class': 'th' }, _('Options')), E('th', { 'class': 'th' }, _('Size')), E('th', { 'class': 'th' }, _('Height')), E('th', { 'class': 'th' }, '') ])
						].concat(sc.widgets.map(function(_w, wi) { return widgetRow(sc, wi); })))) : E('em', {}, _('Nothing on this screen yet.')),
						E('div', { 'style': 'margin-top:8px' }, addSel),
						meter,
						sc.backfill ? E('small', { 'style': 'opacity:.7; display:block; margin-top:4px' },
							_('The signal background colours the screen from the bottom by the Wi-Fi signal (red when poor, green when full). It is only used for Wi-Fi uplinks; with several Wi-Fi uplinks the screen is split horizontally between them.')) : ''
					]),
					E('div', { 'style': 'flex:none' }, [ canvas, note ])
				]));
			return E('div', { 'class': 'cbi-section', 'style': 'border:1px solid #bbb; border-radius:4px; padding:10px; margin-bottom:14px; opacity:' + (sc.enabled ? 1 : 0.7) }, parts);
		}

		function globalsView() {
			var nscr = screens.length, pinOptions = screens.map(function(s, i) { return [ String(i + 1), (i + 1) + ' - ' + s.name ]; });
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Rotation')),
				E('div', { 'style': 'display:flex; flex-wrap:wrap; gap:14px; align-items:center' }, [
					select([ [ 'rotate', _('Rotate through the screens') ], [ 'pin', _('Show one screen only') ] ], main.screen_mode, function(v) { main.screen_mode = v; redraw(); }),
					main.screen_mode === 'pin'
						? select(pinOptions, Math.min(+main.screen_pin || 1, nscr), function(v) { main.screen_pin = v; schedulePreview(); })
						: E('span', {}, [ _('Order: '), text(main.playlist, function(v) { main.playlist = v.replace(/[^0-9 ,]/g, ''); }, 140),
							' ', E('small', { 'style': 'opacity:.7' }, _('screen numbers, e.g. "1 2 1 3"; empty = all screens in order')) ])
				]),
				E('h3', { 'style': 'margin-top:14px' }, _('Look')),
				E('div', { 'style': 'display:flex; flex-wrap:wrap; gap:14px; align-items:center' }, [
					E('span', {}, [ _('Signal background brightness'), ' ', text(main.fill_dim, function(v) {
						var n = parseInt(v, 10); main.fill_dim = String(isNaN(n) ? 40 : Math.max(5, Math.min(100, n))); redraw();
					}, 50, 'number'), ' %' ]),
					check(main.fill_edge, function(v) { main.fill_edge = v; redraw(); }, _('Bright line at the edge of the fill')),
					E('span', {}, [ _('Client names up to'), ' ', text(main.name_len, function(v) {
						var n = parseInt(v, 10); main.name_len = String(isNaN(n) ? 8 : Math.max(3, Math.min(16, n))); redraw();
					}, 50, 'number'), ' ', _('characters') ])
				]),
				E('h3', { 'style': 'margin-top:14px' }, _('Preview data')),
				E('div', { 'style': 'display:flex; flex-wrap:wrap; gap:14px; align-items:center' }, [
					select([ [ 'live', _('Live data from this router') ], [ 'example', _('Example data (Wi-Fi + Ethernet, VPN, clients)') ] ], preview.source, function(v) { preview.source = v; schedulePreview(); }),
					select([ [ 'none', _('As is') ], [ 'weak', _('What if: weak Wi-Fi') ], [ 'longssid', _('What if: long Wi-Fi name') ], [ 'ethernet', _('What if: wired uplink') ], [ 'nouplink', _('What if: no uplink') ],
						[ 'nointernet', _('What if: no internet') ], [ 'vpnup', _('What if: VPN connected') ], [ 'vpndown', _('What if: VPN down') ], [ 'novpn', _('What if: no VPN') ] ],
						preview.scenario, function(v) { preview.scenario = v; schedulePreview(); }),
					select([ [ 'wifi', _('WAN traffic: Wi-Fi mostly') ], [ 'bal', _('WAN traffic: balanced') ], [ 'eth', _('WAN traffic: Ethernet mostly') ], [ 'wifionly', _('WAN traffic: Wi-Fi only') ], [ 'ethonly', _('WAN traffic: Ethernet only') ] ],
						preview.tsim, function(v) { preview.tsim = v; schedulePreview(); }),
					E('small', { 'style': 'opacity:.7' }, _('The preview is drawn by the router itself with the settings on this page, saved or not. The rounded corners are cut off by the bezel.'))
				])
			]);
		}

		function redraw() {
			canvases = []; notes = [];
			dom_content(globals, globalsView());
			dom_content(container, screens.map(screenCard));
			schedulePreview();
		}

		function dom_content(node, children) {
			while (node.firstChild) node.removeChild(node.firstChild);
			(Array.isArray(children) ? children : [ children ]).forEach(function(c) { node.appendChild(c); });
		}

		this.model = { main: main, screens: screens };

		var wrap = E('div', { 'style': stockActive ? 'opacity:.5; pointer-events:none' : '' }, [
			globals, container,
			E('div', {}, btn(_('Add screen'), function() {
				if (screens.length >= 12) return;
				screens.push({ name: _('Screen') + ' ' + (screens.length + 1), dwell: '8', spacing: 'auto', enabled: true, backfill: true, debug: false, widgets: [] });
				redraw();
			}, false)),
			E('div', { 'class': 'cbi-section', 'style': 'margin-top:16px' }, [
				E('h3', {}, _('Reading the panel')),
				E('ul', { 'style': 'margin:0 0 0 18px; line-height:1.55' }, [
					E('li', {}, _('Client colours are assigned per device and are the same in every bar and in the client list.')),
					E('li', {}, _('White in a traffic bar is traffic no client accounts for — the router itself (updates, DNS, its own services). A fully white bar means no client traffic in that sample.')),
					E('li', {}, _('Uplink icons: green online, amber when the uplink is up but carries no default route (or, without mwan3, when the internet check fails), red offline, dim when on standby.')),
					E('li', {}, _('In the client list, the bright line under a name is that client Wi-Fi signal: length and colour by strength, green / amber / red.')),
					E('li', {}, _('The signal background fills the screen from the bottom by the Wi-Fi signal of the uplink: green and full is strong, red at the bottom is weak. It only applies to Wi-Fi uplinks.')),
					E('li', {}, _('Speeds are bits per second (5.2M = 5.2 Mb/s); totals are bytes. The client list number is download + upload.')),
					E('li', {}, _('Widgets with nothing to show (no VPN, no sensor, a single uplink for Multi-WAN) take no room; the freed space is redistributed by the spacing setting. A widget flagged Stick to bottom pins to the lower edge instead.'))
				])
			])
		]);
		redraw();

		/* LuCI's E() turns an array argument into elements one by one (createElement per item),
		 * so only nodes may go in here - no empty strings or nulls as placeholders. */
		var page = [
			E('h2', {}, _('LCD Screens')),
			E('div', { 'class': 'cbi-map-descr' }, _('Screens of the built-in LCD renderer: the screens rotate on their own dwell times, in the order below or by the playlist. Save & Apply restarts the display service.'))
		];
		if (stockActive)
			page.push(E('div', { 'class': 'alert-message warning' }, _('The display currently uses the stock UniFi look, which has its own screens. Switch the display mode to "Built-in renderer" on the Settings tab to use these.')));
		page.push(wrap);
		return E(page);
	},

	handleSave: function() {
		var m = this.model;
		if (!m) return Promise.resolve();
		uci.set('utr-lcd', 'main', 'screen_mode', m.main.screen_mode);
		uci.set('utr-lcd', 'main', 'screen_pin', m.main.screen_pin);
		uci.set('utr-lcd', 'main', 'playlist', m.main.playlist.replace(/\s+/g, ' ').trim());
		uci.set('utr-lcd', 'main', 'fill_dim', m.main.fill_dim);
		uci.set('utr-lcd', 'main', 'fill_edge', m.main.fill_edge ? '1' : '0');
		uci.set('utr-lcd', 'main', 'name_len', m.main.name_len);

		uci.sections('utr-lcd', 'screen').forEach(function(s) { uci.remove('utr-lcd', s['.name']); });
		m.screens.forEach(function(s) {
			var sid = uci.add('utr-lcd', 'screen');
			uci.set('utr-lcd', sid, 'name', s.name);
			uci.set('utr-lcd', sid, 'dwell', s.dwell);
			uci.set('utr-lcd', sid, 'spacing', s.spacing || 'auto');
			uci.set('utr-lcd', sid, 'enabled', s.enabled ? '1' : '0');
			uci.set('utr-lcd', sid, 'indicator', 'none');
			uci.set('utr-lcd', sid, 'backfill', s.backfill ? '1' : '0');
			uci.set('utr-lcd', sid, 'debug', s.debug ? '1' : '0');
			var wlist = [], line = [];
			s.widgets.forEach(function(w, i) {
				line.push(widgetSpec(w));
				if (!w[2] || i === s.widgets.length - 1) { wlist.push(line.join('+')); line = []; }
			});
			uci.set('utr-lcd', sid, 'widget', wlist);
		});
		return uci.save();
	},

	handleReset: function() {
		window.location.reload();
	}
});
