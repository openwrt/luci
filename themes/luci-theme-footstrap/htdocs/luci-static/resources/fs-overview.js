'use strict';
'require baseclass';
'require dom';
'require network';
'require fs-fit as fit';
'require fs-widgets as widgets';

/* Overview layout and meters: re-arranges the stock System / Memory / Storage sections into a grid,
 * marks the meters up (aria, and data-fs-level warn/danger at the FS_METER_* thresholds), turns
 * card headings into disclosure buttons and draws progressively through a wrapped poll_status.
 * Content and data stay luci-mod-status's. */

/* the data-page value this module acts on; the loader's PAGE_MODULES map must name the same page */
const PAGE = 'admin-status-overview';
const onPage = () => document.body.getAttribute('data-page') === PAGE;
const ROLES = { [_('System')]: 'sys', [_('Memory')]: 'mem', [_('Storage')]: 'sto' };

/* warn/danger split for the meter fill (theme/25-progressbar.css): a decision, not a measurement —
 * 20% of an 84 MiB overlay and 20% of an 8 GiB disk are different news at the same reading. */
const FS_METER_WARN = 80;
const FS_METER_DANGER = 92;
/* Row labels this theme has seen misread, matched like `ROLES`: `_(msgid)` against
 * luci-mod-status's own msgids, no msgctxt. */
const FS_METER_INVERTED = new Set([ _('Total Available'), _('Swap free') ]);
const FS_METER_NEUTRAL = new Set([ _('Buffered'), _('Cached') ]);

/* The meter's name, if the markup already states one — never invented: a `.cbi-value` row's own
 * label or a key/value table row's first cell. */
function findProgressbarLabel(pg) {
	const row = pg.closest('.cbi-value');
	let label = row ? row.querySelector('.cbi-value-title') : null;
	if (!label) {
		const tr = pg.closest('.tr');
		if (tr) {
			const own = pg.closest('.td, td');
			const cell = tr.querySelector('.td, td');
			if (cell && cell !== own) label = cell;
		}
	}
	return label;
}

/* The percentage inside a meter's `title`: `'X / Y (Z%)'` or a bare `'97%'`, both end-anchored so
 * a stray "%" earlier in a localised reading is ignored. */
function parseMeterPercent(title) {
	if (title == null) return null;
	const m = (/\((-?\d+)%\)\s*$/).exec(title) || (/(-?\d+)%\s*$/).exec(title);
	return m ? parseInt(m[1], 10) : null;
}

/* The attribute work for one `.cbi-progressbar`: Overview's 20_memory.js, 25_storage.js and
 * 30_network.js declare and call their own local `progressbar()`, so the theme's
 * window.progressbar never stamps them. */
function annotateMeter(pg) {
	const title = pg.getAttribute('title');
	const pc = parseMeterPercent(title);
	if (pc == null) return;
	const level = pc < 0 ? 0 : (pc > 100 ? 100 : pc);
	widgets.syncAttr(pg, 'role', 'progressbar');
	widgets.syncAttr(pg, 'aria-valuemin', '0');
	widgets.syncAttr(pg, 'aria-valuemax', '100');
	widgets.syncAttr(pg, 'aria-valuenow', String(level));
	widgets.syncAttr(pg, 'aria-valuetext', title);
	const label = findProgressbarLabel(pg);
	const name = label ? label.textContent.trim() : '';
	widgets.syncAttr(pg, 'aria-label', label ? name : null);
	/* Polarity: an unrecognised bar keeps the plain fill-based rule, on purpose: a wrong red is worse
	 * than a missing colour. */
	let dataLevel = null;
	if (!FS_METER_NEUTRAL.has(name)) {
		const v = FS_METER_INVERTED.has(name) ? 100 - level : level;
		dataLevel = v >= FS_METER_DANGER ? 'danger' : (v >= FS_METER_WARN ? 'warn' : null);
	}
	widgets.syncAttr(pg, 'data-fs-level', dataLevel);
}

function annotateMeters(root) {
	root.querySelectorAll('.cbi-progressbar[title]').forEach(annotateMeter);
}

function headerEl(sec) {
	return sec.querySelector('.cbi-title h3, :scope > h3');
}

function sectionTitle(sec) {
	const h = headerEl(sec);
	if (!h) return '';
	for (const n of h.childNodes) {
		if (n.nodeType !== 3) continue;
		const t = String(n.nodeValue || '').trim();
		if (t) return t;
	}
	return '';
}

/* ---- keyboard disclosure: the card header becomes the toggle, the pill becomes its glyph ----
 * On 25.12 Status -> Overview carries 14 `[data-clickable]` bare <span>s (the topbar poll pill plus
 * one Hide/Show pill per card), clickable by mouse only. */

function pillExpanded(label) {
	return label.getAttribute('data-style') !== 'active';
}

function panelFor(h) {
	const holder = h.closest('.cbi-title');
	return holder ? holder.nextElementSibling : null;
}

let _panelSeq = 0;

/* Promote one card's header to a disclosure control. Idempotent: a tick that finds it wired
 * touches only aria-expanded. */
function wireDisclosure(sec) {
	const h = headerEl(sec);
	const label = h && h.querySelector('.label[data-indicator="poll-status"]');
	if (!h || !label) return;	/* not this card's shape — left alone rather than guessed at */

	const panel = panelFor(h);
	if (panel && !panel.id) panel.id = 'fs-ovl-panel-' + (_panelSeq++);

	widgets.syncAttr(h, 'role', 'button');
	widgets.syncAttr(h, 'tabindex', '0');
	widgets.syncAttr(h, 'aria-controls', panel ? panel.id : null);
	widgets.syncAttr(h, 'aria-expanded', pillExpanded(label) ? 'true' : 'false');
	widgets.syncAttr(label, 'aria-hidden', 'true');

	if (h.dataset.fsWired) return;
	h.dataset.fsWired = '1';

	h.addEventListener('click', (ev) => {
		if (ev.target.closest?.('[data-indicator="poll-status"]') !== label) label.click();
		widgets.syncAttr(h, 'aria-expanded', pillExpanded(label) ? 'true' : 'false');
	});
	widgets.wireActivate(h, () => label.click());
}

/* A `.cbi-section` LuCI still renders when a stock include has nothing to show this tick: title
 * "-", the poll pill its only content, 72px tall on the live Overview. */
function hideEmptyCard(sec) {
	if (sectionTitle(sec) === '-') sec.classList.add('fs-ovl-empty');
}

function tidyCards(view) {
	view.querySelectorAll('.cbi-section').forEach((sec) => {
		hideEmptyCard(sec);
		wireDisclosure(sec);
	});
}

/* the wrapper we built, so the poll-tick fast path costs one property read */
let _wrapEl = null;

/* A port name the card had to cut stays readable on hover: the stylesheet ellipses it at one line,
 * and the name cannot be guessed from the rest of the card. */
function nameTooltips(view) {
	for (const icon of view.querySelectorAll('img[src*="/port_"]')) {
		const head = icon.closest('.ifacebox')?.firstElementChild;
		const name = head ? head.textContent.trim() : '';
		/* `!==`: a mutation inside the tree we observe is not cheap, even when the write is */
		if (name && head.title !== name)
			head.title = name;
	}
}

function arrange() {
	if (!onPage()) {
		stopWatch();
		return;
	}
	const view = document.getElementById('view');
	if (!view) return;

	nameTooltips(view);
	/* 20_memory.js, 25_storage.js and 30_network.js each call their own local progressbar(), not the
	 * theme's, so the reading and colour those bars need are stamped here. */
	annotateMeters(view);
	tidyCards(view);

	/* Fast path: the poll lands here on every tick, and the stock poll never rebuilds the .cbi-section
	 * wrappers, so the grid survives. Deliberately not a disconnect(). */
	if (_wrapEl && _wrapEl.isConnected && _wrapEl.parentElement === view && _wrapEl.children.length === 3)
		return;

	const found = {};
	view.querySelectorAll(':scope > .cbi-section').forEach((sec) => {
		const r = ROLES[sectionTitle(sec)];
		if (r && !found[r]) found[r] = sec;
	});
	/* wait until all three stock sections exist */
	if (!(found.sys && found.mem && found.sto)) return;
	/* already wrapped? (first tick after a rebuild re-finds the existing grid) */
	if (found.sys.parentElement && found.sys.parentElement.classList.contains('fs-ovl')) {
		_wrapEl = found.sys.parentElement;
		return;
	}
	const wrap = document.createElement('div');
	wrap.className = 'fs-ovl';
	found.sys.parentNode.insertBefore(wrap, found.sys);
	found.sys.classList.add('fs-ovl-sys'); wrap.appendChild(found.sys);
	found.mem.classList.add('fs-ovl-mem'); wrap.appendChild(found.mem);
	found.sto.classList.add('fs-ovl-sto'); wrap.appendChild(found.sto);
	_wrapEl = wrap;
}

/* Stock sections render async and repaint every poll, so watch #maincontent and re-run arrange(),
 * coalesced. #maincontent outlives every SPA swap, so one observer is attached once. */
let _observer = null;
function stopWatch() {
	if (_observer) _observer.disconnect();
	_observer = null;
	_wrapEl = null;	/* the grid belongs to the #view we are leaving */
}
function watch() {
	const view = document.getElementById('view');
	/* `#maincontent`, not `#view`: a client navigation builds a fresh `#view` before it is in the
	 * document and swaps it in afterwards, so an observer on it would watch a detached node. */
	const root = document.getElementById('maincontent');
	arrange();
	if (_observer || !view)
		return;
	_observer = new MutationObserver(fit.frame(arrange));
	_observer.observe(root, { childList: true, subtree: true });
}

/* Called by the loader on every arrival at the overview, full load or SPA navigation;
 * patchOverview() and watch() are idempotent. */
function wire() {
	if (!onPage()) {
		stopWatch();
		return;
	}
	patchOverview();
	watch();
}

/* ---- progressive paint ----
 * Stock `view.status.index` calls poll_status(first_load=true), which Promise.all's over every
 * include's load(): #view stays empty until the slowest is in (182 ms, most sections). */
function fillSection(inc, container, res) {
	if (inc.failed)
		return;
	let content = null;
	if (typeof inc.render === 'function')
		content = inc.render(res);
	else if (inc.content != null)
		content = inc.content;
	if (typeof inc.oneshot === 'function') {
		inc.oneshot(res);
		inc.oneshot = null;
	}
	if (content != null) {
		container.parentNode.style.display = '';
		container.parentNode.classList.add('fade-in');
		if (!inc.hide)
			dom.content(container, content);
	}
}

let _inflight = null;
let _inflightFor = null;

function pollProgressive(includes, containers, first_load) {
	if (_inflight && _inflightFor === containers)
		return first_load ? Promise.resolve() : _inflight;

	const run = network.flushCache().then(() => Promise.all(
		includes.map((inc, i) => {
			if (inc.hide && !first_load)
				return null;
			const loaded = (typeof inc.load === 'function')
				? Promise.resolve(inc.load()).catch(() => { inc.failed = true; })
				: Promise.resolve(null);
			return loaded.then((res) => {
				try { fillSection(inc, containers[i], res); }
				catch (e) { console.error('footstrap: overview section failed', e); }
			});
		}).filter(Boolean)
	)).then(() => {
		const ssi = document.querySelector('div.includes');
		if (ssi) { ssi.style.display = ''; ssi.classList.add('fade-in'); }
	});

	_inflight = run.finally(() => {
		/* only if still ours: a newer render may have replaced it mid-run */
		if (_inflightFor === containers) { _inflight = null; _inflightFor = null; }
	});
	_inflightFor = containers;
	/* Nobody awaits this on the first load, so a rejection would surface as an unhandled one; `run`
	 * rejects for one ordinary reason: flushCache() on an expired session. */
	_inflight.catch(() => {});

	/* first load resolves now, so index.render() returns its tree while the sections fill themselves;
	 * a poll tick resolves when its data is in, as the poller expects */
	return first_load ? Promise.resolve() : _inflight;
}

/* Patch the stock overview view: replace poll_status so each section paints when its own data
 * lands. Called from wire(), not at module eval, which would pull the whole status view in on
 * every page. */
function patchOverview() {
	/* `window.L`, never the bare `L` this factory was handed: index.js loads its own includes with the
	 * `L` require() passes the loaded module (the two-L trap). */
	window.L.require('view.status.index').then((idx) => {
		const proto = idx ? Object.getPrototypeOf(idx) : null;
		if (!proto || proto.__fsProgressive || typeof proto.poll_status !== 'function')
			return;
		proto.__fsProgressive = true;
		proto.poll_status = function(includes, containers, first_load) {
			return pollProgressive(includes, containers, first_load);
		};
	}).catch((e) => console.error('footstrap: overview progressive paint not applied', e));
}

/* `progressbar`, `renderBox` and `renderBadge` are defined in menu-footstrap-common.js: a stock
 * include calls them bare from its own render(), so they must exist before the view class does. */

return baseclass.extend({
	/* called by menu-footstrap-common's loader on every data-page stamp that maps here */
	wire,
});
