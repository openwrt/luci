'use strict';
'require view';
'require poll';
'require rpc';
'require ui';
'require dom';
'require uci';

const callStatus = rpc.declare({
	object: 'bird-babel',
	method: 'status',
	expect: { }
});

const callHistory = rpc.declare({
	object: 'bird-babel',
	method: 'history',
	params: [ 'range', 'points', 'end', 'since' ],
	expect: { }
});

const callEvents = rpc.declare({
	object: 'bird-babel',
	method: 'events',
	params: [ 'since' ],
	expect: { events: [] }
});

const FULL_EVERY = 300;
const ROLE_SELECTED = 1, ROLE_STANDBY = 0, ROLE_LEAF = -1, ROLE_ABSENT = -4;
const INF = 65535;

const ROLE_LABELS = {
	[ROLE_SELECTED]: _('Default route'),
	[ROLE_STANDBY]: _('Standby default'),
	[ROLE_LEAF]: _('No default route'),
	[ROLE_ABSENT]: _('Not present'),
};

// The range shown: the history the collector has, at most 24 h, rounded up
// to RANGE_STEP so requests (and the polling) stay the same for a while
const RANGE_STEP = 900, RANGE_MAX = 86400;
function autoRange(st) {
	const now = st?.time ?? Date.now() / 1000;
	const have = now - (st?.collector?.oldest ?? now);
	return Math.min(RANGE_MAX, Math.max(RANGE_STEP, Math.ceil(have / RANGE_STEP) * RANGE_STEP));
}

// Link cost scale: log2, with octaves above COST_KNEE squashed by COST_SQUASH,
// so a few very bad links leave room for the usable ones. Maps log2(cost).
const COST_KNEE = 512, COST_SQUASH = 8;
function costPos(e) {
	const k = Math.log2(COST_KNEE);
	return (e <= k) ? e : k + (e - k) / COST_SQUASH;
}

// Distinguishable on light and dark backgrounds
const PALETTE = [ '#2f7ed8', '#e8590c', '#2b8a3e', '#c2255c', '#7048e8', '#0b7285', '#e67700', '#5c940d', '#862e9c', '#495057' ];

const CSS = `
.bb-cards { display: flex; flex-wrap: wrap; gap: .75em; margin-bottom: 1em; }
.bb-card { flex: 1 1 12em; border: 1px solid rgba(128,128,128,.35); border-radius: 6px; padding: .6em .8em; min-width: 11em; }
.bb-card .bb-k { font-size: 85%; opacity: .75; }
.bb-card .bb-v { font-size: 140%; font-weight: bold; line-height: 1.3; word-break: break-word; }
.bb-card .bb-s { font-size: 85%; opacity: .8; }
.bb-route { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; row-gap: .5em; margin: .6em 0; }
.bb-route-fam { font-size: 85%; opacity: .75; margin-right: .8em; }
.bb-hop { box-sizing: border-box; height: 3.4em; min-width: 8em; padding: 0 .8em; display: flex; flex-direction: column;
	justify-content: center; text-align: center; border: 1px solid rgba(128,128,128,.35); border-radius: 6px; }
.bb-hop .bb-hop-name { font-weight: bold; white-space: nowrap; }
.bb-hop.bb-unknown { border-style: dashed; opacity: .7; }
.bb-jump { display: flex; flex-direction: column; align-items: stretch; min-width: 7em; padding: 0 .5em; font-size: 85%; text-align: center; }
.bb-jump span { min-height: 1.4em; white-space: nowrap; opacity: .8; }
.bb-jump span:first-child { margin-bottom: .25em; }
.bb-jump span:last-child { margin-top: .25em; }
.bb-jump .bb-jump-line { position: relative; border-top: 1px solid currentColor; opacity: .55; }
.bb-jump .bb-jump-line::after { content: ''; position: absolute; right: -1px; top: -5px;
	border: 4.5px solid transparent; border-left: 7px solid currentColor; border-right: 0; }
.bb-warn { border-left: 4px solid #e8590c; background: rgba(232,89,12,.08); padding: .6em .9em; margin-bottom: 1em; border-radius: 4px; }
.bb-err { border-left-color: #c92a2a; background: rgba(201,42,42,.08); }
.bb-badge { display: inline-block; padding: .05em .5em; border-radius: 1em; font-size: 85%; white-space: nowrap; color: #fff; }
.bb-cost-good { background: #2b8a3e; }
.bb-cost-ok { background: #74b816; color: #222; }
.bb-cost-meh { background: #e0a800; color: #222; }
.bb-cost-bad { background: #e8590c; }
.bb-cost-dead { background: #c92a2a; }
.bb-hellos { display: inline-flex; gap: 1px; vertical-align: middle; }
.bb-hellos i { display: inline-block; width: 4px; height: 12px; background: rgba(128,128,128,.3); }
.bb-hellos i.on { background: #2b8a3e; }
.bb-sub { font-size: 85%; opacity: .7; }
.bb-nowrap { white-space: nowrap; }
.bb-board { font-style: italic; }
.bb-gone { opacity: .55; }
.bb-loading { opacity: .35; transition: opacity .15s; position: relative; }
.bb-loading::after { content: '…'; position: absolute; top: 40%; left: 50%; font-size: 200%; }
.bb-mono { font-family: monospace; font-size: 90%; }
.bb-toolbar { display: flex; flex-wrap: wrap; gap: .5em; align-items: center; justify-content: center; margin: .5em 0; }
.bb-chart { position: relative; width: 100%; }
.bb-chart svg { display: block; width: 100%; overflow: visible; }
.bb-chart svg text { fill: currentColor; font-size: 11px; }
.bb-chart .bb-grid { stroke: currentColor; stroke-opacity: .12; }
.bb-chart .bb-axis { stroke: currentColor; stroke-opacity: .4; }
.bb-chart .bb-cursor { stroke: currentColor; stroke-opacity: .5; stroke-dasharray: 3 3; pointer-events: none; }
.bb-chart svg.bb-zoomable { cursor: crosshair; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: pan-y pinch-zoom; }
.bb-chart .bb-zoom { fill: currentColor; fill-opacity: .12; stroke: currentColor; stroke-opacity: .4; pointer-events: none; }
.bb-tip { position: absolute; pointer-events: none; z-index: 10; background: rgba(30,30,30,.92); color: #fff; padding: .4em .6em; border-radius: 4px; font-size: 85%; white-space: nowrap; display: none; }
.bb-tip b { color: #fff; }
.bb-tip-wide { white-space: normal; width: 28em; max-width: 90%; line-height: 1.35; background: #222; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,.35); }
.bb-tip-wide, .bb-tip-wide * { color: #fff; }
.bb-tip-wide li { line-height: 1.35; margin: .15em 0; }
.bb-tip-wide .bb-tip-h { font-weight: bold; margin-top: .5em; }
.bb-tip-wide ul { margin: .2em 0 0 1.1em; padding: 0; }
.bb-loop { cursor: help; }
.bb-legend { display: flex; flex-wrap: wrap; gap: .25em 1em; margin-top: .4em; font-size: 90%; }
.bb-legend span.off { opacity: .35; text-decoration: line-through; }
.bb-legend.bb-center { justify-content: center; }
.bb-root .cbi-section { margin-top: 1.75em; }
.bb-root .cbi-section > h3 { margin-bottom: .5em; }
.bb-legend i { display: inline-block; width: .9em; height: .9em; border-radius: 2px; vertical-align: -.1em; margin-right: .3em; }
.bb-scroll { overflow-x: auto; }
.bb-scroll .table { min-width: 40em; }
.bb-events { max-height: 22em; overflow-y: auto; margin-bottom: 1.5em; border-bottom: 1px solid rgba(128,128,128,.25); }
.bb-events .tr .td:first-child { white-space: nowrap; }
@media (max-width: 600px) { .bb-card .bb-v { font-size: 120%; } }
`;

function syncAttrs(o, n) {
	for (const at of Array.from(o.attributes))
		if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
	for (const at of Array.from(n.attributes))
		if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
}

// Bring the children of a live element in line with a freshly rendered one,
// touching only nodes whose type, attributes or text differ. Elements marked
// data-bb-live (e.g. an open tooltip) are owned by their event handlers and
// left alone.
function patchChildren(from, to) {
	const nu = Array.from(to.childNodes);
	for (let i = 0; i < nu.length; i++) {
		const o = from.childNodes[i], n = nu[i];
		if (!o)
			from.appendChild(n);
		else if (o.nodeType != n.nodeType || o.nodeName != n.nodeName || o.namespaceURI != n.namespaceURI)
			from.replaceChild(n, o);
		else if (o.nodeType == Node.TEXT_NODE) {
			if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
		}
		else if (o.nodeType == Node.ELEMENT_NODE) {
			if (o.hasAttribute('data-bb-live')) continue;
			syncAttrs(o, n);
			patchChildren(o, n);
		}
	}
	while (from.childNodes.length > nu.length)
		from.removeChild(from.lastChild);
}

function S(tag, attrs, children) {
	const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const k in attrs ?? {})
		if (attrs[k] != null) el.setAttribute(k, attrs[k]);
	for (const c of [].concat(children ?? []))
		if (c != null) el.appendChild((typeof c == 'object') ? c : document.createTextNode(c));
	return el;
}

// Honour System -> System -> Time Format (clock_hourcycle), 24-hour if unset
function fmtTime(t, withSeconds) {
	const hc = uci.get('system', '@system[0]', 'clock_hourcycle');
	return new Intl.DateTimeFormat(undefined, {
		hour: '2-digit', minute: '2-digit', second: withSeconds ? '2-digit' : undefined,
		hourCycle: (hc && hc != '0') ? hc : undefined,
	}).format(new Date(t * 1000));
}

function fmtDate(t) {
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date(t * 1000));
}

function fmtDuration(s) {
	s = Math.max(0, Math.round(s));
	if (s < 60) return _('%ds').format(s);
	if (s < 3600) return _('%dm').format(Math.floor(s / 60));
	if (s < 86400) return _('%dh %dm').format(Math.floor(s / 3600), Math.floor(s % 3600 / 60));
	return _('%dd %dh').format(Math.floor(s / 86400), Math.floor(s % 86400 / 3600));
}

function costClass(c) {
	if (c == null || c >= INF) return 'dead';
	if (c <= 256) return 'good';
	if (c <= 384) return 'ok';
	if (c <= 768) return 'meh';
	if (c <= 2048) return 'bad';
	return 'dead';
}

function costBadge(c) {
	return E('span', { 'class': 'bb-badge bb-cost-' + costClass(c), 'title': _('Link cost to this neighbour (256 is a perfect link)') },
		(c == null || c >= INF) ? '∞' : String(c));
}

function hellosBar(n) {
	const bar = E('span', { 'class': 'bb-hellos', 'title': _('%d of the last 16 hellos received').format(n) });
	for (let i = 0; i < 16; i++)
		bar.appendChild(E('i', { 'class': (i < n) ? 'on' : '' }));
	return bar;
}

function neighborLabel(nb) {
	return nb?.name ?? nb?.ip4 ?? nb?.addr ?? '?';
}

function sparkline(points, width, height) {
	const svg = S('svg', { width: width, height: height, viewBox: '0 0 %d %d'.format(width, height), style: 'vertical-align: middle' });
	if (!points?.length) return svg;
	const t0 = points[0][0], t1 = points[points.length - 1][0];
	let lo = Infinity, hi = -Infinity;
	for (const p of points) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
	if (hi - lo < 1) { lo -= 1; hi += 1; }
	const x = t => (t1 > t0) ? (t - t0) / (t1 - t0) * (width - 2) + 1 : width / 2;
	const y = v => height - 2 - (v - lo) / (hi - lo) * (height - 4);
	svg.appendChild(S('polyline', {
		points: points.map(p => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' '),
		fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-opacity': .8
	}));
	return svg;
}

// Round axis maximum and step: 1, 2 or 5 times a power of ten
function niceScale(max, count) {
	if (!(max > 0)) max = 1;
	const raw = max / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
	const step = [ 1, 2, 5, 10 ].map(m => m * mag).find(st => st >= raw);
	return { max: Math.ceil(max / step) * step, step: step };
}

function timeTicks(from, to, width) {
	const span = to - from;
	const steps = [ 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600 ];
	const want = Math.max(2, Math.floor(width / 90));
	const step = steps.find(s => span / s <= want) ?? 43200;
	const ticks = [];
	const tz = new Date().getTimezoneOffset() * 60;
	for (let t = Math.ceil((from - tz) / step) * step + tz; t <= to; t += step)
		ticks.push(t);
	ticks.step = step;
	return ticks;
}

function fmtTick(t, ticks) {
	return fmtTime(t, ticks.step < 60);
}

return view.extend({
	zoom: null,		// [ from, to ] while zoomed in by dragging across a chart

	load() {
		return Promise.all([ callStatus().catch(() => null), uci.load('system').catch(() => null) ]).then(([ st ]) => {
			return Promise.all([
				st,
				callHistory(autoRange(st), 360).catch(() => null),
				callEvents(0).catch(() => []),
			]);
		});
	},

	// ---- helpers ------------------------------------------------------

	colorFor(key) {
		const keys = [ ...new Set([ ...Object.keys(this.history?.neighbors ?? {}), ...(this.status?.neighbors ?? []).map(n => n.key) ]) ].sort();
		return PALETTE[Math.max(0, keys.indexOf(key)) % PALETTE.length];
	},

	// The neighbour's name, with its network added when another neighbour
	// shown in the current range or zoom has the same name
	labelFor(key) {
		const meta = this.neighborMeta(key);
		const name = neighborLabel(meta);
		for (const k of this.visibleSet())
			if (k != key && neighborLabel(this.neighborMeta(k)) == name)
				return '%s · %s'.format(name, meta.network ?? meta.iface ?? key.split('|')[0]);
		return name;
	},

	neighborMeta(key) {
		return this.status?.neighbors?.find(n => n.key == key) ?? this.history?.neighbors?.[key]?.meta ?? { key: key };
	},

	// Presence is the same in both families, so roles4 tells it for IPv6 too
	seenInRange(k) {
		return (this.history?.neighbors?.[k]?.roles4 ?? []).some(s => s[2] != ROLE_ABSENT && s[1] > (this.history.from ?? 0));
	},

	// The family the timeline, the order and the counts follow: IPv4, unless
	// there is only an IPv6 default route (now or in the range), as on
	// IPv6-only meshes
	defaultFamily() {
		const has = f => (this.status?.defaults?.['v' + f] ?? []).length > 0 ||
			Object.values(this.history?.neighbors ?? {}).some(n => (n['roles' + f] ?? []).some(s => s[2] >= ROLE_STANDBY));
		return (!has(4) && has(6)) ? 6 : 4;
	},

	// Stretches of the shown range without samples: before the history
	// begins and while the collector was not running
	noData() {
		const h = this.history;
		if (!h) return [];
		const from = this.chartFrom();
		return (h.nodata ?? (((h.oldest ?? h.from) > h.from) ? [ [ h.from, h.oldest ] ] : []))
			.map(g => [ Math.max(g[0], from), g[1] ]).filter(g => g[1] > g[0]);
	},

	// Where the time charts start: the range, which is rounded up, but not
	// before the collector's history begins; a zoom window as it is
	chartFrom() {
		const h = this.history;
		if (!h) return 0;
		if (this.zoom) return h.from;
		return Math.max(h.from, Math.min(h.now - h.bucket, h.oldest ?? h.from));
	},

	inNoData(t) {
		return this.noData().some(g => g[0] <= t && t < g[1]);
	},

	usableInRange(k) {
		return (this.history?.neighbors?.[k]?.metric ?? []).some(p => p[2] < INF);
	},

	// ---- zoom ---------------------------------------------------------

	// What history to show: the selected range up to now, or the zoomed in
	// window. Every time chart shows the same one.
	historyRequest() {
		return this.zoom ? { range: this.zoom[1] - this.zoom[0], end: this.zoom[1] } : { range: autoRange(this.status) };
	},

	// Zoom all time charts to t0..t1 (at least a minute), or back out with null
	setZoom(t0, t1) {
		if (t0 == null) {
			this.zoom = null;
		}
		else {
			const mid = (t0 + t1) / 2, half = Math.max(30, (t1 - t0) / 2);
			this.zoom = [ Math.round(mid - half), Math.round(mid + half) ];
		}
		this.redraw();
		return this.refreshHistory();
	},

	// Dragging across a time chart, with mouse, finger or pen, zooms into the
	// dragged span, a click or tap zooms back out. left/plotW are the plot area
	// in viewBox units, top/bottom the height of the selection band.
	attachZoom(svg, width, height, left, plotW, top, bottom) {
		const h = this.history;
		const band = S('rect', { 'class': 'bb-zoom', x: 0, y: top, width: 0, height: bottom - top, visibility: 'hidden' });
		svg.appendChild(band);
		svg.classList.add('bb-zoomable');
		const px = ev => {
			const r = svg.getBoundingClientRect();
			return Math.max(left, Math.min(left + plotW, (ev.clientX - r.left) / r.width * width));
		};
		const from = this.chartFrom();
		const tAt = x => from + (x - left) / plotW * (h.now - from);
		svg.addEventListener('pointerdown', ev => {
			if (ev.button != 0 || !ev.isPrimary) return;
			// no text selection with a mouse; page scrolling on touch is left to
			// touch-action, vertical swipes and pinches still scroll and zoom
			ev.preventDefault();
			const start = px(ev), id = ev.pointerId;
			// fingers are less precise, allow more movement for a tap
			const slop = (ev.pointerType == 'mouse') ? 5 : 10;
			try { svg.setPointerCapture(id); } catch (e) {}
			const move = e => {
				if (e.pointerId != id) return;
				const x = px(e);
				band.setAttribute('x', Math.min(start, x));
				band.setAttribute('width', Math.abs(x - start));
				band.setAttribute('visibility', 'visible');
			};
			const done = e => {
				if (e.pointerId != id) return;
				svg.removeEventListener('pointermove', move);
				svg.removeEventListener('pointerup', done);
				svg.removeEventListener('pointercancel', done);
				try { svg.releasePointerCapture(id); } catch (err) {}
				band.setAttribute('visibility', 'hidden');
				// the browser took over the gesture (scrolling, pinching)
				if (e.type == 'pointercancel') return;
				const x = px(e);
				if (Math.abs(x - start) * svg.getBoundingClientRect().width / width >= slop)
					this.setZoom(tAt(Math.min(start, x)), tAt(Math.max(start, x)));
				else if (this.zoom)
					this.setZoom(null);
			};
			svg.addEventListener('pointermove', move);
			svg.addEventListener('pointerup', done);
			svg.addEventListener('pointercancel', done);
		});
	},


	// Neighbours present now or at any time in the selected range. Every
	// section shows exactly this set.
	visibleKeys() {
		const keys = this.visibleSet();
		const role = 'role' + this.defaultFamily();
		const rank = k => {
			const nb = this.status?.neighbors?.find(n => n.key == k);
			if (!nb) return 3;
			return (nb[role] == ROLE_SELECTED) ? 0 : 1;
		};
		return [ ...keys ].sort((a, b) => rank(a) - rank(b) || L.naturalCompare(this.labelFor(a), this.labelFor(b)));
	},

	// The same set unsorted, cached until stripSelf() sees new data
	visibleSet() {
		if (this.visible) return this.visible;
		const keys = new Set((this.status?.neighbors ?? []).map(n => n.key));
		for (const k in this.history?.neighbors ?? {})
			if (this.seenInRange(k) && this.usableInRange(k))
				keys.add(k);
		return (this.visible = keys);
	},

	// ---- sections -----------------------------------------------------

	renderWarnings() {
		const st = this.status, out = [];
		if (!st)
			out.push(E('div', { 'class': 'bb-warn bb-err' }, _('The bird-babel collector is not running. Start it with /etc/init.d/bird-babel-collector start.')));
		else if (st.error)
			out.push(E('div', { 'class': 'bb-warn bb-err' }, [ E('strong', _('Cannot read BIRD state: ')), st.error ]));

		return out;
	},

	renderCards() {
		const st = this.status ?? {};
		const nbs = st.neighbors ?? [];
		const card = (k, v, s) => E('div', { 'class': 'bb-card' }, [ E('div', { 'class': 'bb-k' }, k), E('div', { 'class': 'bb-v' }, v), E('div', { 'class': 'bb-s' }, s ?? '') ]);

		const gw = fam => {
			const n = nbs.find(x => x['role' + fam] == ROLE_SELECTED);
			const sel = (st.defaults?.['v' + fam] ?? []).find(d => d.selected);
			if (!sel) return card(_('IPv%d default route').format(fam), _('none'), _('No default route in BIRD'));
			const since = this.events.filter(e => e.type == 'gateway_change' && e.family == 'v' + fam).pop();
			return card(_('IPv%d default route').format(fam),
				n ? neighborLabel(n) : sel.proto,
				[ n ? (n.network ?? n.iface) : (sel.via ?? ''), ' · ', _('metric %d').format(sel.metric ?? 0),
				  since ? ' · ' + _('for %s').format(fmtDuration(st.time - since.time)) : '' ]);
		};

		const day = (st.time ?? 0) - 86400;
		const fam = this.defaultFamily();
		const changes = this.events.filter(e => e.type == 'gateway_change' && e.family == 'v' + fam && e.from && e.time >= day).length;
		const flaps = this.events.filter(e => e.type == 'neighbor_down' && e.time >= day).length;

		return E('div', { 'class': 'bb-cards' }, [
			card(_('Neighbours'), '%d'.format(nbs.length),
				_('%d with a default route').format(nbs.filter(n => n['role' + fam] >= ROLE_STANDBY).length)),
			gw(4),
			gw(6),
			card(_('Changes (24 h)'), '%d'.format(changes), _('IPv%d default route changes · %d neighbour losses').format(fam, flaps)),
		]);
	},

	// The routes of the selected defaults to the router originating them (the
	// gateway): the hops traced by the collector, else what Babel knows, the
	// next hop and the gateway, with the rest to be traced. One route when
	// IPv4 and IPv6 agree, else both. Nothing without a gateway.
	renderRoute() {
		const st = this.status ?? {};
		const routes = [ [ 'IPv4', st.route4 ], [ 'IPv6', st.route6 ] ].filter(r => r[1]?.gateway);
		if (!routes.length) return '';
		const ident = r => JSON.stringify(r.trace?.hops?.length ? r.trace.hops.map(h => h.name ?? h.addr) : [ r.via?.key, r.gateway.router_id ]);
		const same = routes.length == 2 && ident(routes[0][1]) == ident(routes[1][1]);
		const box = (name, addr, cls, title) => E('div', { 'class': 'bb-hop ' + (cls ?? ''), 'title': title ?? '' }, [
			E('div', { 'class': 'bb-hop-name' }, name), E('div', { 'class': 'bb-sub bb-mono' }, addr ?? '—') ]);
		// the empty lines keep the arrow level with the middle of the boxes
		const arrow = (label, title) => E('div', { 'class': 'bb-jump', 'title': title ?? '' },
			[ E('span', label ?? ''), E('div', { 'class': 'bb-jump-line' }), E('span') ]);
		const pending = r => !r.trace_next
			? _('The routers in between are not known')
			: (r.trace_next <= (st.time ?? 0))
				? _('The routers in between are being traced')
				: _('The routers in between will be traced at %s (traces run at most every %d minutes)')
					.format(fmtTime(r.trace_next, true), Math.round((r.trace_cap ?? 300) / 60));
		const row = (fam, r) => {
			const items = same ? [] : [ E('span', { 'class': 'bb-route-fam' }, fam) ];
			const gw = () => box(r.gateway.name ?? _('unnamed'), r.gateway.addr ?? r.gateway.router_id, '',
				_('Originates the default route, router ID %s').format(r.gateway.router_id));
			items.push(box(r.self?.name ?? st.hostname ?? _('This router'), r.trace?.src ?? r.self?.addr));
			if (r.direct) {
				items.push(arrow(), gw());
			}
			else if (r.trace?.hops?.length) {
				for (const h of r.trace.hops)
					items.push(arrow(), h.addr ? box(h.name ?? _('unnamed'), h.addr)
						: box('?', _('no reply'), 'bb-unknown', _('No reply from this hop')));
				if (!r.trace.reached)
					items.push(arrow('⋯', pending(r)), gw());
			}
			else {
				items.push(arrow(), box(r.via?.key ? this.labelFor(r.via.key) : (r.via?.addr ?? '?'), r.via?.addr),
					arrow('⋯', pending(r)), gw());
			}
			return E('div', { 'class': 'bb-route' }, items);
		};
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Gateway Route')),
			...(same ? [ routes[0] ] : routes).map(r => row(r[0], r[1]))
		]);
	},

	renderNeighborTable() {
		const rangeLabel = fmtDuration(this.zoom ? this.zoom[1] - this.zoom[0] : autoRange(this.status));
		const p99 = (k, f) => this.history?.neighbors?.[k]?.p99?.[f];
		const fmtP99 = (v, f) => (v == null) ? '—' : (v >= INF) ? '∞' : (f == 'rtt') ? '%.1f ms'.format(v) : String(v);
		const p99cell = (k, f) => [ p99(k, f) ?? INF + 1, E('span', { 'class': 'bb-sub bb-nowrap', 'title': _('99th percentile over the selected range') }, fmtP99(p99(k, f), f)) ];
		const table = new ui.Table([
			_('Neighbour'), _('Interface'), _('Link cost'), _('Cost P99 (%s)').format(rangeLabel),
			_('RTT'), _('RTT P99 (%s)').format(rangeLabel), _('Hellos'), _('Routes'), _('Cost (%s)').format(rangeLabel)
		], { id: 'bb-neighbors', sortable: [ true, true, true, true, true, true, true, true, false ] },
		E('em', _('No Babel neighbours')));

		const current = this.status?.neighbors ?? [];
		const goneRows = this.visibleKeys().filter(k => !current.some(n => n.key == k)).map(k => {
			const meta = this.neighborMeta(k);
			const last = (this.history?.neighbors?.[k]?.roles4 ?? []).filter(s => s[2] != ROLE_ABSENT).pop();
			const seen = E('div', { 'class': 'bb-sub' }, _('not present, last seen %s').format(last ? fmtTime(last[1], true) : '?'));
			return [
				[ this.labelFor(k), E('div', { 'class': 'bb-gone' }, [ E('strong', this.labelFor(k)), seen,
					E('div', { 'class': 'bb-sub bb-mono' }, [ meta.ip4 ? meta.ip4 + ' · ' : '', meta.addr ?? k.split('|')[1] ]) ]) ],
				[ meta.network ?? meta.iface, E('div', { 'class': 'bb-gone' }, [ meta.network ?? meta.iface ?? '', E('div', { 'class': 'bb-sub bb-mono' }, meta.iface ?? '') ]) ],
				[ INF + 1, '—' ], p99cell(k, 'metric'), [ INF + 1, '—' ], p99cell(k, 'rtt'), [ -1, '—' ], [ -1, '—' ],
				E('span', { 'class': 'bb-gone', 'style': 'color:' + this.colorFor(k) }, sparkline(this.history?.neighbors?.[k]?.metric?.map(p => [ p[0], costPos(Math.log2(Math.max(1, p[1]))) ]), 110, 22)),
			];
		});
		const rows = current.map(nb => {
			const hist = this.history?.neighbors?.[nb.key];
			const name = E('div', [
				E('strong', this.labelFor(nb.key)), ' ',
				nb.name_cached ? E('span', { 'class': 'bb-sub', 'title': _('Name found earlier, the neighbour could not be looked up since') }, _('(last known)')) : '',
				(nb.vendor || nb.model) ? E('div', { 'class': 'bb-sub bb-board', 'title': _('Device model reported by the neighbour') },
					[ nb.vendor ? E('span', nb.vendor) : '', nb.vendor && nb.model ? ' · ' : '', nb.model ?? '' ]) : '',
				E('div', { 'class': 'bb-sub bb-mono' }, [ nb.ip4 ? nb.ip4 + ' · ' : '', nb.addr ]),
			]);
			return [
				[ this.labelFor(nb.key), name ],
				[ nb.network ?? nb.iface, E('div', [ nb.network ?? nb.iface, E('div', { 'class': 'bb-sub bb-mono' }, nb.iface) ]) ],
				[ nb.metric, costBadge(nb.metric) ],
				p99cell(nb.key, 'metric'),
				[ nb.rtt ?? INF, E('span', { 'class': 'bb-nowrap' }, (nb.rtt != null) ? '%.1f ms'.format(nb.rtt) : '—') ],
				p99cell(nb.key, 'rtt'),
				[ nb.hellos, hellosBar(nb.hellos) ],
				[ nb.routes, String(nb.routes) ],
				E('span', { 'style': 'color:' + this.colorFor(nb.key) }, sparkline(hist?.metric?.map(p => [ p[0], costPos(Math.log2(Math.max(1, p[1]))) ]), 110, 22)),
			];
		});
		table.update(rows.concat(goneRows));
		return E('div', { 'class': 'bb-scroll' }, table.render());
	},

	// Order the interfaces of one group (interfaces sharing a node) so each
	// shared node's interfaces are contiguous, and interfaces with nodes of
	// their own sit at the ends of such a run, where their edges cannot cross
	// the edges into the shared node. Small groups try every permutation in
	// name order and keep the first best one, so the result is predictable.
	orderGroup(ifaces, nodes) {
		const own = {};
		for (const nd of nodes)
			if (nd.ifaces.size == 1) own[[ ...nd.ifaces ][0]] = true;
		const score = ord => {
			const pos = {};
			ord.forEach((i, j) => pos[i] = j);
			let sc = 0;
			for (const nd of nodes) {
				const ps = [ ...nd.ifaces ].filter(i => i in pos).map(i => pos[i]);
				if (ps.length < 2) continue;
				const lo = Math.min(...ps), hi = Math.max(...ps);
				if (hi - lo != ps.length - 1) sc += 10;
				for (const i of nd.ifaces)
					if (pos[i] > lo && pos[i] < hi && own[i]) sc += 1;
			}
			return sc;
		};
		if (ifaces.length > 7)
			return ifaces;
		let best = null, bestScore = Infinity;
		const permute = (prefix, rest) => {
			if (bestScore == 0) return;
			if (!rest.length) {
				const sc = score(prefix);
				if (sc < bestScore) { best = prefix; bestScore = sc; }
				return;
			}
			rest.forEach((x, j) => permute(prefix.concat([ x ]), rest.slice(0, j).concat(rest.slice(j + 1))));
		};
		permute([], ifaces);
		return best;
	},

	// What a loop is, why it matters and how to fix it, for one segment that
	// joins several networks of this router (or reflects into one network)
	loopExplainer(seg, radioOf) {
		const st = this.status ?? {};
		const net = dev => (st.interfaces ?? []).find(i => i.iface == dev)?.network ?? dev;
		const host = st.hostname ?? _('This router');
		const macs = [ ...new Set(seg.links.map(n => n.mac_tx).filter(m => m)) ];
		const radios = [ ...seg.ifaces ].map(radioOf).filter(r => r);
		const what = (seg.ifaces.size > 1)
			? _('These networks are joined at layer 2 somewhere outside this router, so frames sent on one arrive on the others.')
			: _('Something outside this router sends the frames of this network back into it.');
		const via = (radios.length > 1)
			? _('Here that is most likely the mesh radios %s, which have formed 802.11s peer links with each other while each is bridged into a different network of this router.').format(radios.join(', '))
			: _('Usually mesh radios that have formed 802.11s peer links with each other while each is bridged into a different network of this router.');
		return [
			E('div', {}, [ E('b', _('Loop')) ]),
			E('div', seg.links.map(n => _('Hellos %s sends on %s come back in on %s%s.').format(host, net(n.self_iface), net(n.iface),
				(n.metric >= INF) ? ' ' + _('(rarely: %d of 16 hellos)').format(n.hellos) : '')).join(' ')),
			E('div', { 'class': 'bb-tip-h' }, _('What it is')),
			E('div', what + ' ' + via),
			E('div', { 'class': 'bb-tip-h' }, _('Why it is a problem')),
			E('ul', [
				E('li', _('Every broadcast and multicast frame (Babel hellos and updates, ARP, IPv6 neighbour discovery) is repeated over the air, wasting airtime.')),
				E('li', _('Switches see this router\'s MAC addresses on more than one port.')),
				E('li', _('The router lists itself as extra neighbours. Babel ignores routes from itself, so routing keeps working.')),
			]),
			E('div', { 'class': 'bb-tip-h' }, _('How to resolve it')),
			E('ul', [
				E('li', _('Keep the mesh peering, but make the APs drop frames from this router\'s MAC addresses (%s) on their mesh interface. Every interface of this router has its own MAC, so a reflection filter that only learns the router MAC seen on its own VLAN misses the others.').format(macs.join(', ') || '?')),
				E('li', _('Or bridge the APs that share a mesh into the same network of this router, so the mesh is one network instead of several joined ones.')),
				E('li', _('Or let the APs route instead of bridge, by running Babel on them.')),
				E('li', _('If no mesh radios are involved, look for a switch port carrying several of these VLANs untagged, or a cable or bridge joining them.')),
			]),
		];
	},

	// Four columns: this router, its Babel interfaces (one network each), the
	// mesh AP bridging each network into its wifi mesh (from the optional mesh
	// hints), and what is heard on each network: neighbour routers and loops.
	// A neighbour heard on several networks is drawn once with an edge from
	// each. Networks joined at layer 2 outside this router (the router hears
	// its own hellos) share one loop node with an edge from each. All edges
	// run left to right between adjacent columns and never through a node.
	renderTopology() {
		const st = this.status;
		const all = st?.interfaces ?? [];
		if (!all.length)
			return E('p', {}, E('em', _('No Babel interfaces')));

		const nbs = st.neighbors ?? [], loops = this.selfLinks ?? [];
		const ifByName = {};
		for (const i of all) ifByName[i.iface] = i;
		const nameOf = iface => ifByName[iface]?.network ?? iface;
		const byName = (a, b) => L.naturalCompare(nameOf(a), nameOf(b));
		const hintOf = iface => st.mesh_hints?.[nameOf(iface)];

		// merge neighbours into nodes by identity
		const nodes = [];
		for (const n of nbs) {
			const id = n.hostname ?? n.node_ip4 ?? n.ip4 ?? n.key;
			let nd = nodes.find(x => x.id == id);
			if (!nd) nodes.push(nd = { id, members: [], ifaces: new Set() });
			nd.members.push(n);
			nd.ifaces.add(n.iface);
		}

		// loops: networks joined by the router hearing its own hellos form one
		// segment each (connected components of heard-on/sent-on pairs)
		const segOf = {};
		for (const n of loops) {
			let a = segOf[n.iface], b = segOf[n.self_iface];
			if (!a && !b) {
				a = { id: 'seg:' + n.iface, segment: true, links: [], ifaces: new Set(), members: [] };
				nodes.push(a);
			}
			else if (a && b && a != b) {
				for (const i of b.ifaces) { a.ifaces.add(i); segOf[i] = a; }
				a.links.push(...b.links);
				nodes.splice(nodes.indexOf(b), 1);
			}
			a ??= b;
			a.links.push(n);
			for (const i of [ n.iface, n.self_iface ]) { a.ifaces.add(i); segOf[i] = a; }
		}
		for (const nd of nodes.filter(x => x.segment)) {
			for (const i of [ ...nd.ifaces ]) if (!ifByName[i]) nd.ifaces.delete(i);
			if (!nd.ifaces.size) nodes.splice(nodes.indexOf(nd), 1);
		}
		// a network is only weakly in a loop if all its own hellos that come
		// back, or all others' hellos it hears, are rarely received (cost ∞)
		const weakIn = (seg, iface) => seg.links.filter(n => n.iface == iface || n.self_iface == iface).every(n => n.metric >= INF);

		// groups of interfaces linked by shared nodes
		const adj = {};
		const link = (a, b) => { (adj[a] ??= new Set()).add(b); (adj[b] ??= new Set()).add(a); };
		for (const nd of nodes) { const l = [ ...nd.ifaces ]; for (let j = 1; j < l.length; j++) link(l[0], l[j]); }
		const seen = new Set(), groups = [];
		for (const iface of all.map(i => i.iface).sort(byName)) {
			if (seen.has(iface)) continue;
			const comp = [], todo = [ iface ];
			while (todo.length) {
				const c = todo.pop();
				if (seen.has(c)) continue;
				seen.add(c); comp.push(c);
				for (const p of adj[c] ?? []) todo.push(p);
			}
			comp.sort(byName);
			const hasNb = comp.some(c => nbs.some(n => n.iface == c));
			groups.push({ ifaces: this.orderGroup(comp, nodes.filter(nd => comp.some(c => nd.ifaces.has(c)))),
				rank: hasNb ? 0 : segOf[comp[0]] ? 1 : 2 });
		}
		groups.sort((a, b) => a.rank - b.rank || byName(a.ifaces[0], b.ifaces[0]));
		const order = groups.flatMap(g => g.ifaces);
		const pos = {};
		order.forEach((i, j) => pos[i] = j);

		// right column: a node shared by several interfaces goes into the block
		// of its middle interface, after that interface's own nodes when it is
		// the first one and before them otherwise
		const rows = {};
		for (const iface of order)
			rows[iface] = nodes.filter(nd => nd.ifaces.size == 1 && nd.ifaces.has(iface));
		for (const nd of nodes) {
			if (nd.ifaces.size < 2) continue;
			const ms = [ ...nd.ifaces ].sort((a, b) => pos[a] - pos[b]);
			const m = Math.floor((ms.length - 1) / 2);
			if (m == 0) rows[ms[0]].push(nd);
			else rows[ms[m]].unshift(nd);
		}

		const width = Math.max(560, this.contentWidth ?? 900);
		const rowH = 46, nodeH = 34, top = 10;
		const hasBr = order.some(i => hintOf(i));
		const xR = 10, wR = Math.min(150, width * 0.13);
		const xI = xR + wR + Math.max(50, width * 0.06), wI = Math.min(160, width * 0.16);
		const xB = xI + wI + Math.max(30, width * 0.03), wB = hasBr ? Math.min(210, width * 0.2) : 0;
		const xP = hasBr ? xB + wB : xI + wI;	// where the edges into the right column start
		const xN = xP + Math.max(110, width * (hasBr ? 0.1 : 0.14)), wN = Math.max(170, Math.min(250, width - xN - 10));
		// on wide screens the columns need less than the full width: centre them
		const offset = Math.max(0, (width - (xN + wN + 10)) / 2);

		let y = top;
		const ifY = {}, ndY = new Map();
		for (const iface of order) {
			const h = Math.max(1, rows[iface].length) * rowH;
			ifY[iface] = y + h / 2;
			rows[iface].forEach((nd, r) => ndY.set(nd, y + r * rowH + rowH / 2));
			y += h;
		}
		const height = y + top;
		const costColor = c => ({ good: '#2b8a3e', ok: '#74b816', meh: '#e0a800', bad: '#e8590c', dead: '#c92a2a' })[costClass(c)];

		const svg = S('svg', { viewBox: '0 0 %d %d'.format(width, height), height: height });
		const box = (x, yc, w, lines, attrs) => {
			const g = S('g', {});
			g.appendChild(S('rect', Object.assign({ x: x, y: yc - nodeH / 2, width: w, height: nodeH, rx: 5,
				fill: 'currentColor', 'fill-opacity': .04, stroke: 'currentColor', 'stroke-opacity': .35 }, attrs ?? {})));
			lines.forEach((l, i) => g.appendChild(S('text', {
				x: x + 8, y: yc + (lines.length == 1 ? 4 : (i == 0 ? -3 : 11)),
				style: i ? 'font-size:10px;opacity:.7' : 'font-weight:bold'
			}, l)));
			return g;
		};
		const clip = (t, w, px) => (t.length * px > w - 16) ? t.slice(0, Math.max(3, Math.floor((w - 16) / px) - 1)) + '…' : t;
		const curve = (x1, y1, x2, y2) => 'M%f,%f C%f,%f %f,%f %f,%f'.format(x1, y1, (x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2);
		// from an interface into the right column: from its mesh AP if it has
		// one, else straight through the AP column (no AP sits on this row)
		const edge = (iface, y1) => {
			const y0 = ifY[iface], mx = (xP + xN) / 2;
			return ((hasBr && !hintOf(iface)) ? 'M%f,%f L%f,%f C'.format(xI + wI, y0, xP, y0) : 'M%f,%f C'.format(xP, y0))
				+ '%f,%f %f,%f %f,%f'.format(mx, y0, mx, y1, xN, y1);
		};
		const fmtCost = c => (c >= INF) ? '∞' : String(c);
		// the graph shows models without anything in parentheses, e.g. "(v1)"
		const modelText = (vendor, model) => [ vendor, model ].filter(x => x).join(' ').replace(/\s*\([^)]*\)/g, '').trim();
		// the mesh radio that puts a network on the air: the AP's mesh
		// interface from the hints, or this router's own wifi interface
		const radioOf = iface => {
			const h = hintOf(iface);
			if (h?.host) return '%s (%s)'.format(h.host, h.ifname ?? '?');
			if (ifByName[iface]?.wireless) return _('%s of %s').format(iface, st.hostname ?? _('this router'));
			return null;
		};
		const active = iface => nbs.some(n => n.iface == iface) || !!segOf[iface];

		// root and interfaces
		const yR = height / 2;
		svg.appendChild(box(xR, yR, wR, [ clip(st.hostname ?? _('this router'), wR, 7) ]));
		for (const iface of order) {
			const i = ifByName[iface], yi = ifY[iface], on = active(iface);
			svg.appendChild(S('path', { d: curve(xR + wR, yR, xI, yi), fill: 'none', stroke: 'currentColor', 'stroke-opacity': on ? .35 : .15 }));
			// the device name only when it differs from the network name
			const sub = [ nameOf(iface) != iface ? iface : null, i?.up === false ? _('down') : null ].filter(x => x).join(' · ');
			const g = box(xI, yi, wI, [ clip(nameOf(iface), wI, 7) ].concat(sub ? [ clip(sub, wI, 5.5) ] : []),
				on ? {} : { 'stroke-dasharray': '3 3', 'stroke-opacity': .25 });
			g.appendChild(S('title', {}, '%s (%s)\n%s'.format(nameOf(iface), iface,
				_('%d neighbour(s)').format(nbs.filter(n => n.iface == iface).length))));
			if (!on) g.setAttribute('opacity', .55);
			svg.appendChild(g);

			// the mesh AP bridging this network into its wifi mesh
			const h = hintOf(iface);
			if (!h) continue;
			svg.appendChild(S('path', { d: 'M%f,%f L%f,%f'.format(xI + wI, yi, xB, yi), fill: 'none', stroke: 'currentColor', 'stroke-opacity': on ? .45 : .15, 'stroke-width': 2 }));
			const b = box(xB, yi, wB, [ clip(h.host ?? _('mesh AP'), wB, 7), clip([ h.ip, modelText(h.vendor, h.model) ].filter(x => x).join(' · '), wB, 5.5) ],
				on ? {} : { 'stroke-dasharray': '3 3', 'stroke-opacity': .25 });
			b.appendChild(S('title', {}, _('%s bridges %s into its %s mesh on %s (configured in /etc/config/bird-babel)').format(
				h.host ?? _('A mesh AP'), nameOf(iface), h.band ?? _('wifi'), h.ifname ?? '?')));
			if (!on) b.setAttribute('opacity', .55);
			svg.appendChild(b);
		}

		// the loop explainer, shown when hovering a loop node or its edges.
		// Refreshes keep the live tooltip and the hovered elements, so the
		// handlers look up the tooltip and the latest text when they run.
		const tipEl = E('div', { 'class': 'bb-tip bb-tip-wide', 'data-bb-live': '' });
		this.loopTips = {};
		const withTip = (g, id, content) => {
			this.loopTips[id] = content;
			g.setAttribute('data-loop', id);
			const tip = () => g.closest('.bb-chart')?.querySelector('.bb-tip-wide');
			g.addEventListener('mouseenter', () => {
				const t = tip(), c = this.loopTips[g.getAttribute('data-loop')];
				if (t && c) dom.content(t, c.map(n => n.cloneNode(true)));
			});
			g.addEventListener('mousemove', ev => {
				const t = tip();
				if (!t) return;
				const w = t.parentNode.getBoundingClientRect();
				t.style.display = 'block';
				t.style.left = Math.max(4, Math.min(ev.clientX - w.left + 14, w.width - t.offsetWidth - 4)) + 'px';
				t.style.top = (ev.clientY - w.top + 14) + 'px';
			});
			g.addEventListener('mouseleave', () => { const t = tip(); if (t) t.style.display = 'none'; });
			return g;
		};

		for (const nd of nodes) {
			const y1 = ndY.get(nd);
			if (nd.segment) {
				// one edge from each joined network, faint when the network is
				// only weakly in the loop
				const g = S('g', { 'class': 'bb-loop' });
				for (const iface of [ ...nd.ifaces ].sort((a, b) => pos[a] - pos[b])) {
					const d = edge(iface, y1), weak = weakIn(nd, iface);
					g.appendChild(S('path', { d, fill: 'none', stroke: '#c92a2a', 'stroke-width': 2, 'stroke-dasharray': '5 3', 'stroke-opacity': weak ? .45 : 1 }));
					g.appendChild(S('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 12 }));
				}
				const nets = [ ...nd.ifaces ].sort((a, b) => pos[a] - pos[b]).map(nameOf);
				const bands = [ ...new Set([ ...nd.ifaces ].map(i => hintOf(i)?.band).filter(b => b)) ];
				g.appendChild(box(xN, y1, wN, [
					clip(bands.length == 1 ? _('loop · %s mesh').format(bands[0]) : _('loop'), wN, 7),
					clip(nets.length > 1 ? _('joins %s').format(nets.join(' + ')) : _('reflects %s back into itself').format(nets[0]), wN, 5.5)
				], { stroke: '#c92a2a', 'stroke-opacity': 1, 'stroke-dasharray': '5 3', 'stroke-width': 1.5 }));
				svg.appendChild(withTip(g, nd.id, this.loopExplainer(nd, radioOf)));
				continue;
			}
			const def = nd.members.some(n => n.role4 == ROLE_SELECTED || n.role6 == ROLE_SELECTED);
			for (const n of nd.members.slice().sort((a, b) => pos[a.iface] - pos[b.iface])) {
				const y0 = ifY[n.iface];
				const sel = n.role4 == ROLE_SELECTED || n.role6 == ROLE_SELECTED;
				const path = S('path', { d: edge(n.iface, y1), fill: 'none', stroke: costColor(n.metric), 'stroke-width': sel ? 3.5 : 2 });
				path.appendChild(S('title', {}, '%s → %s\n%s: %s · %s'.format(nameOf(n.iface), neighborLabel(n), _('Link cost'),
					fmtCost(n.metric), _('%d of 16 hellos').format(n.hellos))));
				svg.appendChild(path);
				// put the label where this edge is apart from its siblings: near the
				// node when the interface fans out, near the interface when the node
				// is shared, in the middle when both
				const fan = rows[n.iface].length > 1, shared = nd.members.length > 1;
				const f = (fan && !shared) ? 0.78 : (shared && !fan) ? 0.22 : 0.5;
				// and keep it clear of the boxes at both ends
				const label = fmtCost(n.metric);
				const half = label.length * 2.9 + 4;
				const lx = Math.max(xP + half, Math.min(xN - half, xP + (xN - xP) * f));
				const fx = (lx - xP) / (xN - xP), t = fx * fx * (3 - 2 * fx);	// the curve's vertical easing
				const ly = y0 + (y1 - y0) * t - 5;
				svg.appendChild(S('text', { x: lx, y: ly, 'text-anchor': 'middle', style: 'font-size:10px' }, label));
			}
			const n0 = nd.members[0];
			const model = modelText(n0.vendor, n0.model);
			const via = (nd.members.length > 1) ? _('via %d interfaces').format(nd.members.length) : null;
			const g = box(xN, y1, wN, [ clip(neighborLabel(n0) + (def ? '  ★ ' + _('default route') : ''), wN, 7),
				clip([ n0.ip4 ?? n0.node_ip4, model, via ].filter(x => x).join(' · '), wN, 5.5) ],
				def ? { stroke: '#2b8a3e', 'stroke-opacity': 1, 'stroke-width': 2 } : {});
			g.appendChild(S('title', {}, [ neighborLabel(n0) ].concat(nd.members.map(n => '%s: %s'.format(nameOf(n.iface), n.addr))).join('\n')));
			svg.appendChild(g);
		}

		const shifted = S('g', { transform: 'translate(%f,0)'.format(offset) });
		while (svg.firstChild) shifted.appendChild(svg.firstChild);
		svg.appendChild(shifted);

		const legend = E('div', { 'class': 'bb-legend bb-center' }, [
			E('span', [ E('i', { 'style': 'border:2px solid #2b8a3e;background:transparent' }), _('default route') ]),
			E('span', [ E('i', { 'style': 'background:#2b8a3e' }), _('good link (cost ≤ 256)') ]),
			E('span', [ E('i', { 'style': 'background:#e0a800' }), _('cost ≤ 768') ]),
			E('span', [ E('i', { 'style': 'background:#e8590c' }), _('cost ≤ 2048') ]),
			E('span', [ E('i', { 'style': 'background:#c92a2a' }), _('worse or unreachable') ]),
			loops.length ? E('span', [ E('i', { 'style': 'width:1.6em;height:3px;border-radius:0;vertical-align:.25em;background:repeating-linear-gradient(90deg,#c92a2a 0 5px,transparent 5px 8px)' }), _('loop') ]) : '',
		]);
		return E('div', { 'class': 'bb-chart' }, [ svg, tipEl, legend ]);
	},

	renderTimeline() {
		const wrap = E('div', { 'class': 'bb-chart' });
		const tip = E('div', { 'class': 'bb-tip' });
		const h = this.history;
		const keys = this.visibleKeys();
		if (!h || !keys.length) {
			wrap.appendChild(E('em', _('No history yet')));
			return wrap;
		}

		// the label column fits the longest label (in the 11px chart font), up to
		// 40% of the width; longer labels are shortened, the tooltip has them whole
		const width = Math.max(320, (this.contentWidth ?? 900));
		const ctx = document.createElement('canvas').getContext('2d');
		ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
		const textW = t => ctx.measureText(t).width;
		const labels = keys.map(k => this.labelFor(k));
		const labelW = Math.ceil(Math.min(width * 0.4, Math.max(60, ...labels.map(textW)) + 12));
		const fit = t => {
			if (textW(t) <= labelW - 12) return t;
			while (t.length > 1 && textW(t + '…') > labelW - 12) t = t.slice(0, -1);
			return t + '…';
		};
		const rowH = 22, pad = 4, top = 4, axisH = 20;
		const height = top + keys.length * (rowH + pad) + axisH;
		const plotW = width - labelW - 8;
		const from = this.chartFrom();
		const x = t => labelW + (t - from) / (h.now - from) * plotW;
		const fam = this.defaultFamily();
		const field = 'roles' + fam;
		const gaps = this.noData();

		const svg = S('svg', { viewBox: '0 0 %d %d'.format(width, height), height: height });
		svg.appendChild(S('defs', {}, S('pattern', { id: 'bb-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
			S('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-width': 2 }))));

		const tticks = timeTicks(from, h.now, plotW);
		for (const t of tticks) {
			svg.appendChild(S('line', { 'class': 'bb-grid', x1: x(t), x2: x(t), y1: top, y2: height - axisH }));
			svg.appendChild(S('text', { x: x(t), y: height - 6, 'text-anchor': 'middle' }, fmtTick(t, tticks)));
		}

		const colors = { [ROLE_SELECTED]: '#2b8a3e', [ROLE_STANDBY]: '#e0a800', [ROLE_LEAF]: '#e8590c' };
		keys.forEach((k, i) => {
			const y = top + i * (rowH + pad);
			const meta = this.neighborMeta(k);
			svg.appendChild(S('text', { x: 0, y: y + rowH / 2 + 4 }, [
				fit(labels[i]),
				S('title', {}, '%s\n%s (%s)'.format(labels[i], meta.addr ?? k, meta.network ?? meta.iface ?? ''))
			]));
			// hatched (not present) where samples were collected, grey where none were
			let at = from;
			for (const g of [ ...gaps, [ h.now, h.now ] ]) {
				if (g[0] > at)
					svg.appendChild(S('rect', { x: x(at), y: y, width: x(g[0]) - x(at), height: rowH, fill: 'url(#bb-hatch)' }));
				if (g[1] > g[0])
					svg.appendChild(S('rect', { x: x(g[0]), y: y, width: Math.max(1, x(g[1]) - x(g[0])), height: rowH, fill: 'currentColor', 'fill-opacity': .06 }));
				at = Math.max(at, g[1]);
			}
			svg.appendChild(S('rect', { x: labelW, y: y, width: plotW, height: rowH, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .15 }));
			for (const seg of h.neighbors[k]?.[field] ?? []) {
				if (seg[2] == ROLE_ABSENT) continue;
				if (seg[1] <= from) continue;
				const x0 = x(Math.max(seg[0], from)), x1 = x(Math.min(seg[1], h.now));
				svg.appendChild(S('rect', {
					x: x0, y: y, width: Math.max(1, x1 - x0), height: rowH, 'shape-rendering': 'crispEdges',
					fill: colors[seg[2]]
				}));
			}
		});

		const cursor = S('line', { 'class': 'bb-cursor', y1: top, y2: height - axisH, x1: 0, x2: 0, visibility: 'hidden' });
		svg.appendChild(cursor);
		const hide = () => { tip.style.display = 'none'; cursor.setAttribute('visibility', 'hidden'); };

		svg.addEventListener('mousemove', ev => {
			const r = svg.getBoundingClientRect();
			const px = (ev.clientX - r.left) / r.width * width, py = (ev.clientY - r.top) / r.height * height;
			// only inside the plot area, not over labels or the time axis
			if (px < labelW || px > labelW + plotW || py < top || py > height - axisH) return hide();
			const t = from + (px - labelW) / plotW * (h.now - from);
			cursor.setAttribute('x1', px); cursor.setAttribute('x2', px); cursor.setAttribute('visibility', 'visible');
			const lines = [ E('div', {}, [ E('b', fmtTime(t, true)) ]) ];
			for (const k of keys) {
				const seg = (h.neighbors[k]?.[field] ?? []).find(s => s[0] <= t && t < s[1]);
				const role = seg ? seg[2] : ROLE_ABSENT;
				lines.push(E('div', '%s: %s'.format(this.labelFor(k), this.inNoData(t) ? _('no data') : ROLE_LABELS[role])));
			}
			dom.content(tip, lines);
			tip.style.display = 'block';
			const left = ev.clientX - wrap.getBoundingClientRect().left;
			tip.style.left = Math.min(left + 12, wrap.clientWidth - tip.offsetWidth - 4) + 'px';
			tip.style.top = (ev.clientY - wrap.getBoundingClientRect().top + 12) + 'px';
		});
		svg.addEventListener('mouseleave', hide);
		this.attachZoom(svg, width, height, labelW, plotW, top, height - axisH);

		wrap.appendChild(svg);
		wrap.appendChild(tip);
		const role = r => E('span', [ E('i', { 'style': 'background:' + colors[r] }), ROLE_LABELS[r] ]);
		wrap.appendChild(E('div', { 'class': 'bb-legend bb-center' }, [
			E('strong', _('IPv%d default route').format(fam)),
			role(ROLE_SELECTED),
			role(ROLE_STANDBY),
			role(ROLE_LEAF),
			E('span', [ E('i', { 'style': 'background: repeating-linear-gradient(45deg, rgba(128,128,128,.35) 0 2px, transparent 2px 5px)' }), ROLE_LABELS[ROLE_ABSENT] ]),
			E('span', [ E('i', { 'style': 'background: rgba(128,128,128,.12)' }), _('No data collected') ]),
		]));
		return wrap;
	},

	renderLineChart(field, unit) {
		const wrap = E('div', { 'class': 'bb-chart' });
		const tip = E('div', { 'class': 'bb-tip' });
		const h = this.history;
		const keys = this.visibleKeys();
		const series = k => h?.neighbors?.[k]?.[field] ?? [];
		if (!h || !keys.some(k => series(k).some(p => p[1] < INF))) {
			wrap.appendChild(E('em', _('No history yet')));
			return wrap;
		}

		const width = Math.max(320, (this.contentWidth ?? 900)), height = 220;
		const left = 48, right = 8, top = 8, bottom = 22;
		const plotW = width - left - right, plotH = height - top - bottom;
		let lo = Infinity, hi = 0;
		for (const k of keys) {
			if (this.hidden[k]) continue;
			for (const p of series(k))
				if (p[1] < INF) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
		}
		const from = this.chartFrom();
		const x = t => left + (t - from) / (h.now - from) * plotW;
		let y, ticks = [], knee = null;
		if (field == 'metric') {
			// costs span orders of magnitude (96 wired, thousands on bad wifi),
			// see costPos()
			const KNEE_COST = COST_KNEE, KNEE = Math.log2(KNEE_COST), f = costPos;
			knee = KNEE_COST;
			const lg = Math.log2(Math.max(1, hi));
			// the axis always reaches the knee's octave, and ends at a power of
			// two, the knee or, above it, two octaves up or more
			const a = Math.min(Math.floor(KNEE), Math.floor(Math.log2(Math.max(1, Math.min(lo, hi)))));
			const b = (lg <= KNEE) ? Math.min(KNEE, Math.max(a + 1, Math.ceil(lg))) : Math.max(Math.ceil(KNEE + 2), Math.ceil(lg));
			// powers of two below the knee, the knee, and every third octave
			// down from the top above it
			const step = Math.max(1, Math.ceil((Math.min(KNEE, b) - a) / 6));
			for (let e = a; e < KNEE && e <= b; e += step) ticks.push(Math.pow(2, e));
			if (b >= KNEE) ticks.push(KNEE_COST);
			const upper = [];
			for (let e = b; e - KNEE >= 2; e -= 3) upper.unshift(Math.pow(2, e));
			ticks.push(...upper);
			y = v => top + plotH - (f(Math.log2(Math.min(Math.max(v, Math.pow(2, a)), Math.pow(2, b)))) - f(a)) / (f(b) - f(a)) * plotH;
			// drop ticks whose labels would overlap the one above
			const kept = [];
			for (const v of ticks.reverse())
				if (!kept.length || y(v) - y(kept[kept.length - 1]) >= 12) kept.push(v);
			ticks = kept;
		} else {
			const scale = niceScale(hi * 1.05, 5);
			for (let v = 0; v <= scale.max + scale.step / 2; v += scale.step) ticks.push(v);
			y = v => top + plotH - Math.min(v, scale.max) / scale.max * plotH;
		}

		const svg = S('svg', { viewBox: '0 0 %d %d'.format(width, height), height: height });
		for (const v of ticks) {
			// the knee of the cost scale is dashed, the scale is squashed above
			svg.appendChild(S('line', { 'class': 'bb-grid', x1: left, x2: width - right, y1: y(v), y2: y(v),
				'stroke-dasharray': (v === knee) ? '4 3' : null, 'stroke-opacity': (v === knee) ? .35 : null }));
			const label = (field == 'metric') ? String(v) : (v >= 1000) ? String(+(v / 1000).toFixed(1)) + 'k' : String(+v.toFixed(2));
			svg.appendChild(S('text', { x: left - 4, y: y(v) + 4, 'text-anchor': 'end' }, label));
		}
		const tticks = timeTicks(from, h.now, plotW);
		for (const t of tticks) {
			svg.appendChild(S('line', { 'class': 'bb-grid', x1: x(t), x2: x(t), y1: top, y2: top + plotH }));
			svg.appendChild(S('text', { x: x(t), y: height - 6, 'text-anchor': 'middle' }, fmtTick(t, tticks)));
		}
		// no data collected
		for (const g of this.noData())
			svg.appendChild(S('rect', { x: x(g[0]), y: top, width: Math.max(1, x(g[1]) - x(g[0])), height: plotH, fill: 'currentColor', 'fill-opacity': .05 }));
		svg.appendChild(S('line', { 'class': 'bb-axis', x1: left, x2: left, y1: top, y2: top + plotH }));
		svg.appendChild(S('text', { x: 2, y: top + 10 }, unit));

		const gap = Math.max(h.bucket, h.interval) * 2.5;
		for (const k of keys) {
			if (this.hidden[k]) continue;
			// a sample with no usable neighbour on either side (a mostly
			// unreachable neighbour) is a single point segment: draw it as a dot,
			// a lone "M" draws nothing
			let path = '', last = null, run = [];
			const dot = () => {
				if (run.length == 1)
					svg.appendChild(S('circle', { cx: run[0][0], cy: run[0][1], r: 2, fill: this.colorFor(k) }));
				run = [];
			};
			for (const p of series(k)) {
				if (p[1] >= INF) { last = null; continue; }
				const cmd = (last == null || p[0] - last > gap) ? 'M' : 'L';
				if (cmd == 'M') dot();
				const px = x(Math.max(p[0], from)).toFixed(1), py = y(p[1]).toFixed(1);
				path += cmd + px + ' ' + py;
				run.push([ px, py ]);
				last = p[0];
			}
			dot();
			svg.appendChild(S('path', { d: path, fill: 'none', stroke: this.colorFor(k), 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
		}

		const cursor = S('line', { 'class': 'bb-cursor', y1: top, y2: top + plotH, x1: 0, x2: 0, visibility: 'hidden' });
		svg.appendChild(cursor);
		const hide = () => { tip.style.display = 'none'; cursor.setAttribute('visibility', 'hidden'); };
		svg.addEventListener('mousemove', ev => {
			const r = svg.getBoundingClientRect();
			const px = (ev.clientX - r.left) / r.width * width, py = (ev.clientY - r.top) / r.height * height;
			// only inside the plot area, not over the axes
			if (px < left || px > left + plotW || py < top || py > top + plotH) return hide();
			const t = from + (px - left) / plotW * (h.now - from);
			cursor.setAttribute('x1', px); cursor.setAttribute('x2', px); cursor.setAttribute('visibility', 'visible');
			const lines = [ E('div', {}, [ E('b', fmtTime(t, true)) ]) ];
			for (const k of keys) {
				if (this.hidden[k]) continue;
				const pts = series(k);
				let best = null;
				for (const p of pts) if (best == null || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
				if (!best || Math.abs(best[0] - t) > gap) continue;
				lines.push(E('div', [ E('span', { 'style': 'color:' + this.colorFor(k) }, '■ '),
					'%s: %s %s'.format(this.labelFor(k), (field == 'rtt') ? best[1].toFixed(1) : Math.round(best[1]), unit),
					(best[3] - best[2] > 0.05 * best[1]) ? E('span', { 'class': 'bb-sub' }, ' (%s–%s)'.format(
						(field == 'rtt') ? best[2].toFixed(1) : best[2], (field == 'rtt') ? best[3].toFixed(1) : best[3])) : '' ]));
			}
			dom.content(tip, lines);
			tip.style.display = 'block';
			const lx = ev.clientX - wrap.getBoundingClientRect().left;
			tip.style.left = Math.min(lx + 12, wrap.clientWidth - tip.offsetWidth - 4) + 'px';
			tip.style.top = (ev.clientY - wrap.getBoundingClientRect().top + 12) + 'px';
		});
		svg.addEventListener('mouseleave', hide);
		this.attachZoom(svg, width, height, left, plotW, top, top + plotH);

		wrap.appendChild(svg);
		wrap.appendChild(tip);

		// legend with min / avg / max / last, click to hide a series
		const legend = new ui.Table([ _('Neighbour'), _('Min'), _('Avg'), _('P99'), _('Max'), _('Last') ], { sortable: false });
		const fmt = v => (v == null) ? '—' : (v >= INF) ? '∞' : (field == 'rtt') ? v.toFixed(1) : String(Math.round(v));
		legend.update(keys.map(k => {
			const all = series(k);
			const pts = all.filter(p => p[1] < INF);
			const p99 = h.neighbors[k]?.p99?.[field];
			const vals = pts.map(p => p[1]);
			const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
			const item = E('span', {
				'class': this.hidden[k] ? 'off' : '',
				'style': 'cursor:pointer',
				'title': _('Click to show or hide'),
				'click': ev => { this.hidden[k] = !this.hidden[k]; this.redraw(); }
			}, [ E('i', { 'style': 'display:inline-block;width:.9em;height:.9em;border-radius:2px;margin-right:.3em;background:' + this.colorFor(k) }), this.labelFor(k) ]);
			// only infinite cost samples: unreachable the whole time
			if (all.length && !pts.length)
				return [ item, '∞', '∞', E('span', { 'title': _('99th percentile of all samples in the range') }, '∞'), '∞', '∞' ];
			return [ item, fmt(pts.length ? Math.min(...pts.map(p => p[2])) : null), fmt(avg),
				E('span', { 'title': _('99th percentile of all samples in the range') }, fmt(p99)),
				fmt(pts.length ? Math.max(...pts.map(p => p[3])) : null), fmt(vals[vals.length - 1]) ];
		}));
		wrap.appendChild(E('div', { 'class': 'bb-legend', 'style': 'display:block' }, legend.render()));
		return wrap;
	},

	renderEvents() {
		const table = new ui.Table([ _('Time'), _('Event') ], { sortable: false }, E('em', _('No events')));
		const name = k => k ? neighborLabel(this.neighborMeta(k)) : _('none');
		const evs = this.events.filter((e, i, a) => !(e.type == 'collector_start' && a[i + 1]?.type == 'collector_start'));
		const rows = evs.slice(-100).reverse().map(e => {
			let text;
			switch (e.type) {
			case 'gateway_change':
				text = e.from
					? _('IPv%s default route moved from %s to %s (metric %s)').format(e.family.slice(1), e.from_name ?? name(e.from), e.to_name ?? name(e.to), e.metric ?? '—')
					: _('IPv%s default route via %s (metric %s)').format(e.family.slice(1), e.to_name ?? name(e.to), e.metric ?? '—');
				break;
			case 'neighbor_up':
				text = _('Neighbour %s appeared on %s').format(e.name, e.iface);
				break;
			case 'neighbor_down':
				text = _('Neighbour %s lost on %s').format(e.name, e.iface);
				break;
			case 'collector_start':
				text = _('Collector started') + (e.restored ? ' ' + _('(history restored)') : '');
				break;
			default:
				text = e.type;
			}
			const day = fmtDate(e.time) != fmtDate(Date.now() / 1000);
			return [ (day ? fmtDate(e.time) + ' ' : '') + fmtTime(e.time, true), text ];
		});
		table.update(rows);
		return E('div', { 'class': 'bb-events' }, table.render());
	},

	renderInterfaces() {
		const table = new ui.Table([ _('Interface'), _('State'), _('RX cost'), _('Neighbours'), _('Next hop (IPv4)'), _('Next hop (IPv6)') ],
			{ id: 'bb-ifaces' }, E('em', _('No Babel interfaces')));
		// BIRD counts the router's own reflected hellos as neighbours, leave them out
		const selfOn = iface => [ ...this.selfKeys ].filter(k => k.split('|')[0] == iface).length;
		table.update((this.status?.interfaces ?? []).map(i => [
			[ i.network ?? i.iface, E('div', [ i.network ?? i.iface, E('div', { 'class': 'bb-sub bb-mono' }, i.iface) ]) ],
			i.up ? _('Up') : _('Down'),
			String(i.rxcost),
			String(Math.max(0, i.neighbors - selfOn(i.iface))),
			E('span', { 'class': 'bb-mono' }, i.nexthop4 ?? ''),
			E('span', { 'class': 'bb-mono' }, i.nexthop6 ?? ''),
		]));
		return table.render();
	},

	// Notes about the charts: zoomed in, or the router turned down a query
	renderToolbar() {
		const notes = [
			this.zoom ? E('span', { 'class': 'bb-sub' }, _('Zoomed in to %s – %s, click or tap a graph to zoom out').format(
				fmtTime(this.zoom[0], true), fmtTime(this.zoom[1], true))) : '',
			this.historyFailed ? E('span', { 'class': 'bb-sub' }, _('The router is busy, the history will be loaded again shortly')) : '',
		].filter(n => n);
		return notes.length ? E('div', { 'class': 'bb-toolbar' }, notes) : '';
	},

	// ---- data and refresh --------------------------------------------

	// The router hearing its own hellos (a layer 2 loop) is not a neighbour:
	// drop those entries everywhere, the graph shows them as a loop instead.
	stripSelf() {
		this.visible = null;
		if (this.status?.neighbors?.some(n => n.self) || !this.selfLinks)
			this.selfLinks = (this.status?.neighbors ?? []).filter(n => n.self);
		for (const n of this.status?.neighbors ?? [])
			if (n.self) this.selfKeys.add(n.key);
		for (const k in this.history?.neighbors ?? {})
			if (this.history.neighbors[k].meta?.self) this.selfKeys.add(k);
		if (this.status?.neighbors)
			this.status.neighbors = this.status.neighbors.filter(n => !this.selfKeys.has(n.key));
		for (const k of this.selfKeys)
			delete this.history?.neighbors?.[k];
		this.events = this.events.filter(e => !this.selfKeys.has(e.key));
	},

	refreshStatus() {
		return callStatus().then(st => {
			const range = autoRange(this.status);
			this.status = st;
			this.stripSelf();
			// the collected history grew by a step: fetch it now, not at the next poll
			if (!this.zoom && this.history && autoRange(st) != range) this.refreshHistory();
			const since = this.events.length ? this.events[this.events.length - 1].time : 0;
			return callEvents(since).then(evs => {
				for (const e of evs)
					if (!this.events.some(x => x.time == e.time && x.type == e.type && x.key == e.key && x.to == e.to))
						this.events.push(e);
				this.stripSelf();
				this.redraw();
			});
		}).catch(() => { this.status = null; this.visible = null; this.redraw(); });
	},

	// Merge a poll for the newest data (inc, from inc.since on) into h: older
	// points up to the cut, minus what fell out of the range, then the new
	// ones. Percentiles, route latencies and meta cover the whole range.
	mergeHistory(h, inc) {
		const cut = inc.since, from = inc.from, gap = 2 * (inc.interval ?? 1);
		const keep = pts => (pts ?? []).filter(p => p[0] >= from && p[0] < cut);
		const clip = list => (list ?? []).map(s => [ Math.max(s[0], from), Math.min(s[1], cut), s[2] ]).filter(s => s[1] > s[0]);
		const join = (old, add) => {
			const res = clip(old);
			for (const s of add ?? []) {
				const l = res[res.length - 1];
				if (l && l[2] === s[2] && s[0] <= l[1] + gap) l[1] = Math.max(l[1], s[1]);
				else res.push([ ...s ]);
			}
			return res;
		};
		const out = { ...inc, neighbors: {}, full_at: h.full_at };
		for (const k of new Set([ ...Object.keys(h.neighbors ?? {}), ...Object.keys(inc.neighbors ?? {}) ])) {
			const o = h.neighbors?.[k] ?? {}, n = inc.neighbors?.[k] ?? {};
			const m = { meta: n.meta ?? o.meta, p99: n.p99 ?? o.p99,
				metric: [ ...keep(o.metric), ...(n.metric ?? []) ], rtt: [ ...keep(o.rtt), ...(n.rtt ?? []) ],
				roles4: join(o.roles4, n.roles4), roles6: join(o.roles6, n.roles6) };
			if (m.metric.length || m.roles4.length || inc.neighbors?.[k]) out.neighbors[k] = m;
		}
		out.nodata = [ ...clip((h.nodata ?? []).map(g => [ g[0], g[1], null ])).map(g => [ g[0], g[1] ]), ...(inc.nodata ?? []) ];
		return out;
	},

	refreshHistory() {
		const points = Math.min(2000, Math.max(120, Math.round((this.contentWidth ?? 900) / 3)));
		const req = this.historyRequest(), key = JSON.stringify(req);
		clearTimeout(this.retryTimer);
		// unchanged range, zoom and width: only ask for what is new, from the
		// last (partly filled) bucket on; a full query, which also brings new
		// percentiles, at least every FULL_EVERY seconds
		const old = this.history;
		const since = (old?.key == key && old.points_req == points && old.bucket && Date.now() / 1000 - old.full_at < FULL_EVERY)
			? old.now - old.bucket : undefined;
		return callHistory(req.range, points, req.end, since).then(res => {
			// a newer range or zoom was selected meanwhile
			if (key != JSON.stringify(this.historyRequest())) return;
			const h = (since && res.since != null && this.history?.key == key) ? this.mergeHistory(this.history, res) : res;
			h.key = key;
			h.points_req = points;
			if (h === res) h.full_at = Date.now() / 1000;
			this.history = h;
			this.historyFailed = false;
			this.stripSelf();
			this.redraw();
		}).catch(() => {
			// the router limits history queries without a login, try again soon
			if (key != JSON.stringify(this.historyRequest())) return;
			this.historyFailed = true;
			this.retryTimer = setTimeout(() => this.refreshHistory(), 10000);
			this.redraw();
		});
	},

	redraw() {
		if (!this.root) return;
		this.contentWidth = this.root.clientWidth || this.contentWidth;
		const sections = this.root.querySelectorAll('[data-bb]');
		// charts carry event handlers bound to their data, so they are
		// replaced as a whole, and only when their inputs changed
		const charts = { timeline: true, metric: true, rtt: true };
		const chartKey = JSON.stringify([ this.history?.now, this.history?.key, this.hidden, this.contentWidth,
			(this.status?.neighbors ?? []).map(n => [ n.key, n.name, n.role4, n.role6 ]) ]);
		const render = {
			warnings: () => this.renderWarnings(),
			cards: () => this.renderCards(),
			route: () => this.renderRoute(),
			toolbar: () => this.renderToolbar(),
			neighbors: () => this.renderNeighborTable(),
			topology: () => this.renderTopology(),
			timeline: () => this.renderTimeline(),
			metric: () => this.renderLineChart('metric', ''),
			rtt: () => this.renderLineChart('rtt', 'ms'),
			events: () => this.renderEvents(),
			interfaces: () => this.renderInterfaces(),
		};
		const loading = this.history && this.history.key != JSON.stringify(this.historyRequest());
		sections.forEach(el => {
			const key = el.getAttribute('data-bb');
			if (charts[key]) {
				el.classList.toggle('bb-loading', !!loading);
				if (loading) return;
				if (el.__bbKey === chartKey) return;
				el.__bbKey = chartKey;
				dom.content(el, render[key]());
				return;
			}
			patchChildren(el, E('div', {}, render[key]()));
		});
	},

	render(data) {
		this.status = data[0];
		this.history = data[1];
		if (this.history) this.history.key = JSON.stringify(this.historyRequest());
		this.events = data[2] ?? [];
		this.hidden = {};		// chart series hidden from the legend
		this.selfKeys = new Set();
		this.selfLinks = null;
		this.stripSelf();

		document.head.appendChild(E('style', {}, CSS));

		const section = (title, key, desc) => E('div', { 'class': 'cbi-section' }, [
			E('h3', title),
			desc ? E('div', { 'class': 'cbi-section-descr' }, desc) : '',
			E('div', { 'data-bb': key })
		]);

		this.root = E('div', { 'class': 'bb-root' }, [
			E('h2', _('Babel')),
			E('div', { 'class': 'cbi-map-descr' }, _('Neighbours and default route selection of the BIRD Babel protocol, with history of up to 24 hours collected on this router.')),
			E('div', { 'data-bb': 'warnings' }),
			E('div', { 'data-bb': 'cards' }),
			E('div', { 'data-bb': 'toolbar' }),
			E('div', { 'data-bb': 'route' }),
			section(_('Graph'), 'topology', _('Babel interfaces of this router, the mesh APs bridging them into wifi meshes, and the neighbours heard on each, coloured by link cost.')),
			section(_('Neighbours'), 'neighbors'),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Default route selection')),
				E('div', { 'data-bb': 'timeline' })
			]),
			section(_('Link cost'), 'metric', _('Babel link cost per neighbour (256 is a perfect wired link, higher is worse). Costs above the dashed line at 512 are drawn compressed.')),
			section(_('Round trip time'), 'rtt', _('Babel hello round trip time per neighbour.')),
			section(_('Events'), 'events'),
			section(_('Interfaces'), 'interfaces'),
		]);

		requestAnimationFrame(() => {
			this.redraw();
			// history was loaded before the width was known
			this.refreshHistory();
		});

		let resizeTimer, lastWidth = 0;
		new ResizeObserver(() => {
			const w = this.root.clientWidth;
			if (!w || Math.abs(w - lastWidth) < 8) return;
			lastWidth = w;
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => this.redraw(), 100);
		}).observe(this.root);

		poll.add(() => this.refreshStatus(), 5);
		// a zoomed in window lies in the past and does not change
		poll.add(() => (this.zoom && !this.historyFailed) ? Promise.resolve() : this.refreshHistory(), 30);

		return this.root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
