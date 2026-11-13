'use strict';
'require baseclass';

/* A view's injected CSS is never deleted; a poisoned document is left to a real load. A view's
 * <style> outlives its page under SPA nav (filemanager's unlayered `display: none !important` hides
 * Save/Reset on every later page). Deleting is one-way: a library importing CSS at module eval never
 * re-runs (ACE's 14 KB sheet came back as a black rectangle). A sheet reaching into the widget
 * universe the theme styles spends the document: invasiveSheet() is the test (universe read from
 * cascade.css, 0.3 ms per nav) and the router falls back to a real load. Exempt: `[data-fs-shell]`
 * and anything in `#view`. */
let _themeNames = null;

const NAME_RE = /[.#][A-Za-z_][\w-]*/g;

function maskStrings(text) {
	let out = '', q = null;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (q === null) {
			out += ch;
			if (ch === '"' || ch === '\'') q = ch;
			continue;
		}
		if (ch === '\\') {
			out += ' ';
			if (i + 1 < text.length) { out += ' '; i++; }
			continue;
		}
		out += (ch === q) ? ch : ' ';
		if (ch === q) q = null;
	}
	return out;
}

const origText = new WeakMap();

function themeNames() {
	if (_themeNames) return _themeNames;
	const names = new Set();	/* every class and id the theme styles */
	const props = new Set();	/* every custom property it declares or reads */
	const walk = (rules) => {
		for (const r of rules) {
			if (r.selectorText)
				(maskStrings(r.selectorText).match(NAME_RE) || []).forEach((n) => names.add(n));
			if (r.cssText)
				(r.cssText.match(/--[A-Za-z_][\w-]*/g) || []).forEach((p) => props.add(p));
			if (r.cssRules) walk(r.cssRules);
		}
	};
	for (const ss of document.styleSheets) {
		if (!ss.href || !(/\/cascade\.css/).test(ss.href)) continue;
		try { walk(ss.cssRules); } catch (e) { return null; }
	}
	_themeNames = names.size ? { names, props } : null;
	return _themeNames;
}

function selectorParts(text) {
	const scan = maskStrings(text);
	const out = [];
	let depth = 0, start = 0;
	for (let i = 0; i < scan.length; i++) {
		const ch = scan[i];
		if (ch === '(') depth++;
		else if (ch === ')') depth--;
		else if (ch === ',' && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
	}
	out.push(text.slice(start).trim());
	return out.filter(Boolean);
}

function stripPseudoArgs(part) {
	const scan = maskStrings(part);
	let out = '', depth = 0;
	for (let i = 0; i < scan.length; i++) {
		const ch = scan[i];
		if (ch === '(' ) { depth++; if (depth === 1) { out += ' '; continue; } }
		if (ch === ')') { depth--; continue; }
		if (!depth) out += ch;
	}
	return out;
}

/* Is this selector part held inside the app's own markup by a name the theme does not know
 * (`#cbi-podkop-section > .cbi-section-remove`)? Such a part can reach neither another page nor
 * our chrome. */
function pinnedToApp(part, names) {
	return (stripPseudoArgs(part).match(NAME_RE) || []).some((n) => !names.has(n));
}

/* A rule with a bare selector (`:root`, `pre`, `*`) cannot touch us if none of its declarations
 * can: a custom property this theme never reads is inert wherever it lands. */
function inertDeclarations(rule, props) {
	const st = rule.style;
	if (!st || !st.length) return false;	/* no declarations to judge -> judge by selector */
	for (let i = 0; i < st.length; i++) {
		const p = st.item(i);
		if (p.slice(0, 2) !== '--') return false;	/* a real property: it paints something */
		if (props.has(p)) return false;			/* a custom property the theme itself reads */
	}
	return true;
}

/* true when this sheet can repaint a page that is not its own; an unreadable one (loading, 404,
 * cross-origin) is invasive by default, so unknown CSS takes the slow path, never the broken one */
function invasiveSheet(el, universe) {
	const sheet = el.sheet;
	if (!sheet) return true;

	const { names, props } = universe;
	let invasive = false;
	const walk = (rules) => {
		for (const r of rules) {
			if (invasive) return;
			if (r.selectorText) {
				for (const p of selectorParts(r.selectorText)) {
					if (pinnedToApp(p, names)) continue;
					if (inertDeclarations(r, props)) continue;
					invasive = true;
					return;
				}
			}
			if (r.cssRules) walk(r.cssRules);
			if (r.styleSheet) {
				let imported;
				try { imported = r.styleSheet.cssRules; } catch (e) { invasive = true; return; }
				if (imported) walk(imported);
			}
		}
	};
	try { walk(sheet.cssRules); } catch (e) { return true; }
	return invasive;
}

const VIEW_SHEETS = 'style:not([data-fs-shell]), link[rel~="stylesheet"]:not([data-fs-shell])';

/* Does this sheet outlive the page it arrived with? One inside the view tree dies with the swap. */
function outlivesPage(el) {
	return !el.closest('#view');
}

/* Is `path` (a menu.d node's `css`) already carried by this document in a form that survives a
 * swap? Whole path, never a suffix: a suffix match would let a third party's `"css": "custom.css"`
 * pass on luci-app-adblock's own. No in-tree node sets `css`. */
function documentCarries(path) {
	const want = L.resource(String(path));
	for (const link of document.querySelectorAll('link[rel~="stylesheet"][href]')) {
		if (!outlivesPage(link))
			continue;
		if ((link.getAttribute('href') || '').split('?')[0] === want)
			return true;
	}
	return false;
}

/* An invasive sheet we own is contained: scopeToCurrentPage() darkens it on the next stamp. One we
 * could not attribute (a pending @import, insertRule()) still spends the document. */
function documentPoisoned() {
	const names = themeNames();
	return Array.from(document.querySelectorAll(VIEW_SHEETS)).some(
		(el) => outlivesPage(el)
			&& (!names || (!_owner.has(el) && !_silenced.has(el) && invasiveSheet(el, names))));
}

/* ---- the fence: the chrome is ours, so make a foreign rule unable to match it ----
 * Re-hosting settles specificity but not `!important` (the pure-CSS answer is ~550 flags).
 * Appending `:where(:not([data-fs-chrome], [data-fs-chrome] *))` to a foreign selector's subject
 * matches everything except us at zero specificity, so the app's rules keep their weight against
 * each other. */
const CHROME_FENCE = ':where(:not([data-fs-chrome],[data-fs-chrome] *))';

function fenceSelector(part) {
	const i = maskStrings(part).indexOf('::');
	return i < 0 ? part + CHROME_FENCE : part.slice(0, i) + CHROME_FENCE + part.slice(i);
}

function fenceRules(rules, names) {
	for (const r of rules) {
		if (r.selectorText) {
			const parts = selectorParts(r.selectorText);
			if (parts.some((p) => !pinnedToApp(p, names))) {
				try {
					r.selectorText = parts
						.map((p) => (pinnedToApp(p, names) ? p : fenceSelector(p))).join(', ');
				} catch (e) { /* left unfenced on purpose: the app keeps its rule */ }
			}
		}
		if (r.cssRules) fenceRules(r.cssRules, names);
		if (r.styleSheet) {
			try { fenceRules(r.styleSheet.cssRules, names); } catch (e) { /* unfenced */ }
		}
	}
}

function fenceImported(styleEl, names) {
	const fence = () => {
		let ready;
		try { ready = !!styleEl.sheet.cssRules[0].styleSheet.cssRules; } catch (e) { ready = false; }
		if (ready) fenceRules(styleEl.sheet.cssRules, names);
		return ready;
	};
	if (fence()) return;
	styleEl.addEventListener('load', () => {
		if (!fence()) {
			console.error('footstrap: the re-hosted @import loaded but could not be read — the sheet '
				+ 'stays unfenced and may repaint the chrome on this page.', styleEl);
		}
	}, { once: true });
}

const serializeRules = (rules) => Array.from(rules, (r) => r.cssText).join('\n');

/* ---- a <style>'s textContent is not its sheet ----
 * Wrapping re-sets textContent, which re-parses, and whatever the parse does not reproduce is
 * deleted (a <style> filled by insertRule() has empty text over live rules): textIsSheet()
 * decides. */
let _probe = null;
function textIsSheet(el, live) {
	try {
		if (!_probe) _probe = new CSSStyleSheet();
		_probe.replaceSync(el.textContent);
		return serializeRules(_probe.cssRules) === serializeRules(live);
	} catch (e) { return false; }
}

const _silenced = new WeakSet();

/* Take a re-hosted <link> out of the cascade: `el.disabled = true` alone does not;
 * `el.sheet.disabled` decides whether the CSS paints, and a still-loading <link> has no .sheet
 * yet. */
function silence(el) {
	_silenced.add(el);
	setEnabled(el, false);
}

/* ---- page ownership: contain an invasive sheet instead of spending the document ----
 * A foreign sheet is injected by one page, and spending the document for each is paid by ordinary
 * pages (filemanager lands two <style>s, ssclash four more). Removal on the way out is wrong
 * (L.require caches, so a revisit renders unstyled); disabling is reversible. Owner =
 * `body[data-page]` when re-hosted. */
const _owner = new WeakMap();
const APP_DEPTH = 3;

let _curKey = null;

function appKey(segs) {
	return (segs || []).slice(0, APP_DEPTH).join('/');
}

/* Who a sheet injected right now belongs to, when that is not the page the chrome shows: click a
 * page whose module injects CSS, click away before it lands, and the <style> appears under the
 * superseding page's data-page. The router names the owner during such a require; of two
 * overlapping cold requires the newer wins. */
let _ownerHint = null;
let _ownerGen = -1;
function attributeTo(segs, gen) {
	/* a stale require letting go of a slot somebody else now holds: leave it alone */
	if (segs == null && gen !== _ownerGen) return;
	_ownerHint = (segs == null) ? null : appKey(segs);
	_ownerGen = (segs == null) ? -1 : gen;
}

function ownerKey() {
	return (_ownerHint !== null) ? _ownerHint : currentKey();
}

function currentKey() {
	if (_curKey !== null) return _curKey;
	return appKey(L.env.dispatchpath);
}

function setEnabled(el, on) {
	el.disabled = !on;
	if (el.sheet) el.sheet.disabled = !on;
	else if (!on) el.addEventListener('load', () => { if (el.sheet) el.sheet.disabled = true; }, { once: true });
}

/* Called by the router right after it stamps data-page, with the resolved segments. Only sheets we
 * own are touched; `keep` is the page still on screen, whose sheets stay lit during staging. */
function scopeToCurrentPage(segs, keep) {
	if (segs) _curKey = appKey(segs);
	const key = currentKey();
	const spared = (keep && keep.length) ? appKey(keep) : null;
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (!outlivesPage(el) || !_owner.has(el)) return;
		const owner = _owner.get(el);
		if (spared !== null && owner === spared && owner !== key) return;
		setEnabled(el, owner === key);
	});
}

function claimOwner(el) {
	const key = ownerKey();
	_owner.set(el, key);
	if (outlivesPage(el)) setEnabled(el, key === currentKey());
}

/* Re-host an invasive sheet into the existing `theme` layer so it still renders its page: an
 * unlayered declaration beats every layered one, so an app's `* { margin: 0 }` would own the
 * chrome. Measured: unlayered = chrome broken, app OK; `@layer theme` = both OK; a layer before
 * theme = app broken. Never delete the sheet: an app's "already imported?" check must find it. */
function rehostIntoThemeLayer(el, universe) {
	if (el.dataset.fsLayered) return;

	if (el.tagName === 'LINK') {
		/* A link the app marked alternate or disabled paints nothing and is left unmarked and watched:
		 * enabling it adds no node, so only an attribute observer sees it. */
		if ((/\balternate\b/i).test(el.rel) || el.hasAttribute('disabled')) {
			enableWatch().observe(el, { attributes: true, attributeFilter: [ 'disabled', 'rel' ] });
			return;
		}
		const s = document.createElement('style');
		s.dataset.fsLayered = '1';
		s.textContent = '@import url("' + el.href.replace(/["\\]/g, '\\$&') + '") layer(theme)'
			+ (el.media ? ' ' + el.media : '') + ';';
		el.dataset.fsLayered = '1';
		el.after(s);		/* keep source order: ties inside the layer still resolve as they did */
		silence(el);
		claimOwner(s);
		fenceImported(s, universe.names);
		return;
	}

	const rules = el.sheet && el.sheet.cssRules;
	if (!rules || !rules.length) return;

	/* Handled, and never twice: fenceRules() is not idempotent, since an already-fenced selector reads
	 * as unpinned again. */
	el.dataset.fsLayered = '1';

	/* Wrap only if the text still is the sheet; otherwise the sheet stays unlayered rather than lose
	 * rules, and is still fenced below (pure CSSOM, the half that answers `!important`). */
	if (textIsSheet(el, rules)) {
		origText.set(el, el.textContent);	/* dedupeViewSheets keys on this — see there */
		el.textContent = '@layer theme {\n' + el.textContent + '\n}';
	}
	try { if (el.sheet) fenceRules(el.sheet.cssRules, universe.names); } catch (e) { /* unfenced, not broken */ }
	claimOwner(el);	/* a <style> is re-hosted in place, so it paints itself */
}

function rehostInvasiveSheets() {
	const universe = themeNames();		/* {names, props} — not a bare Set; the fence wants .names */
	if (!universe) return;
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (el.dataset.fsLayered) return;
		/* `insertRule()` produces no mutation record, so an empty <style> filled later is never looked at
		 * again: a sheet with no rules yet is not an innocent one. */
		let rules = null;
		try { rules = el.sheet && el.sheet.cssRules; } catch (e) { /* cross-origin: judged below */ }
		if (rules && !rules.length && !el.__fsRecheck) {
			el.__fsRecheck = true;
			window.setTimeout(() => {
				let now;
				try { now = el.isConnected && el.sheet && el.sheet.cssRules; } catch (e) { return; }
				if (now && now.length) rehostInvasiveSheets();
			}, 2000);
		}
		if (invasiveSheet(el, universe)) rehostIntoThemeLayer(el, universe);
	});
}

/* ---- the one thing that is safe to remove: a byte-identical second copy ----
 * `luci-app-podkop` injects 4 KB from render() with no guard and `luci-app-mosdns` re-appends three
 * CodeMirror <link>s, so every SPA re-visit adds a copy parsed forever. The first copy keeps the
 * rules and any app handle. Re-hosting runs before this, or "keep the first" would keep the raw
 * copy and strand the shim. A duplicate needs the same owner. */
function sheetKey(el) {
	if (el.tagName === 'LINK') return 'LINK|' + el.href;
	const t = origText.get(el);
	if (t !== undefined) return 'STYLE|' + t;
	/* Not wrapped, so the textContent may not be the sheet: insertRule-built <style>s all have an
	 * empty one, and keying on the text would remove the second. */
	const rules = el.sheet && el.sheet.cssRules;
	if (!rules || !rules.length) return null;
	return 'STYLE|' + serializeRules(rules);
}

function dedupeViewSheets() {
	const seen = new Set();
	document.querySelectorAll(VIEW_SHEETS).forEach((el) => {
		if (!outlivesPage(el)) return;
		const key = sheetKey(el);
		if (key === null) return;
		/* owner first: a page key never holds '\n', so the first one always ends the owner part */
		const k = (_owner.get(el) || '') + '\n' + key;
		if (seen.has(k)) el.remove();
		else seen.add(k);
	});
}

/* ---- the layer order is a document-wide fact, and a sheet inserted first can rewrite it ----
 * `@layer tokens, base, theme, page;` holds only while cascade.css is the first sheet to name a
 * layer: Ace inserts its <style> first in <head>, and an earlier sheet naming `theme` makes it the
 * weakest layer. Inserting a new sheet re-runs the ordering while moving one does not (measured),
 * so the order is re-declared from a fresh <style> placed first. */
const LAYER_ORDER = '@layer tokens, base, theme, page;';
let _layerStmt = null;

function reassertLayerOrder() {
	const head = document.head;
	if (!head) return;
	const own = [...document.querySelectorAll('link[rel~="stylesheet"]')]
		.find((l) => (/\/cascade\.css/).test(l.href || ''));
	if (!own) return;
	const anchor = _layerStmt && _layerStmt.isConnected ? _layerStmt : own;
	const ahead = [...document.querySelectorAll('style, link[rel~="stylesheet"]')]
		.some((el) => el !== anchor && el !== own &&
			(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING));
	if (!ahead) return;

	if (_layerStmt) _layerStmt.remove();
	_layerStmt = document.createElement('style');
	_layerStmt.textContent = LAYER_ORDER;
	/* before the first sheet, not into <head>: a document_start script (an extension) appends its
	 * <style> to <html> ahead of <head>, and Firefox then laid Overview out 2125px short at 390px */
	const first = document.querySelector('style, link[rel~="stylesheet"]');
	first.parentNode.insertBefore(_layerStmt, first);
}

function sweepViewSheets() {
	rehostInvasiveSheets();
	dedupeViewSheets();
	reassertLayerOrder();
}

let _enableWatch = null;
function enableWatch() {
	return _enableWatch || (_enableWatch = new MutationObserver(sweepViewSheets));
}

function watchViewSheets() {
	sweepViewSheets();
	const mo = new MutationObserver((muts) => {
		for (const m of muts)
			for (const n of m.addedNodes)
				if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') {
					/* `continue`, not `return`: our own statement can share a batch with the sheet
					 * that made it necessary */
					if (n === _layerStmt) continue;
					sweepViewSheets();
					return;
				}
	});
	mo.observe(document.head, { childList: true });
	/* …and <body>: a <style> appended there after chrome init is seen by nothing otherwise. */
	mo.observe(document.body, { childList: true });
}

return baseclass.extend({
	attributeTo,
	documentCarries,
	documentPoisoned,
	scopeToCurrentPage,
	watchViewSheets,
});
