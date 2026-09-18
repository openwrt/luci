'use strict';
'require baseclass';
'require rpc';
'require fs-fit as fit';

/* The Appearance axes this file owns; the controls that present them are fs-appearance.js. The
 * axis list is AXIS_KEYS, which is exactly the fields of snapshotAxes() — what Save-as-default
 * writes.
 * All client-side, instant and persisted in localStorage, with head.ut's inline script re-applying
 * them before paint so a reload never flashes the wrong one; tools/axes.mjs derives the contract
 * from this file and holds the two copies to it.
 *
 * ---- three layers, and the browser always wins ----
 * Every axis resolves as localStorage ?? router-default ?? built-in. The router default is
 * Appearance -> Save to router (written to /etc/config/footstrap, read back into window.__fsSD);
 * the built-in is a bare :root. A new browser inherits the router default; this browser's own
 * choice overrides it in either direction.
 *
 * ---- every applier stores its choice EXPLICITLY ----
 * Once a router default exists, clearing a key means "inherit the router default", not "the
 * built-in" — so an applier that lsDel'd on the default value could not express "the built-in, not
 * the router's" (a router-defaulted tint could never be turned back off). Every axis records the
 * chosen value, including the off/default one. lsDel is reserved for resetToSaved(). */
/* A browser can refuse storage outright (blocked cookies, dom.storage.enabled=false, a partitioned
 * WebView) and then every access throws. The helpers below swallow it, because an axis that cannot
 * be remembered must still APPLY, but they record it: otherwise current*() reads null, falls back
 * to the router's look, and the Save button sits disabled reading "Saved to router" over a page
 * painted in axes the router default does not carry. */
let _lsBroken = false;
function storageBroken() { return _lsBroken; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { _lsBroken = true; return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { _lsBroken = true; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { _lsBroken = true; } }

/* A stored JSON array, or [] — the shape the two remembered lists use (the search palette's recent
 * paths, the menu's open sections). lsGet owns the try/catch around localStorage; this one covers
 * JSON.parse over a value another tab may have corrupted, and the Array guard that stops a stored
 * object being spread into a list. */
function lsGetArr(k) {
	try {
		const a = JSON.parse(lsGet(k) || '[]');
		return Array.isArray(a) ? a : [];
	} catch (e) { return []; }
}

/* the router-wide defaults the server stamped (head.ut), read at runtime so current*() reports the
 * effective default when this browser has no localStorage */
function sd(k) { try { return (window.__fsSD || {})[k]; } catch (e) { return undefined; } }

/* …and the write back: an applier that persists to the router must update the blob the server
 * stamped, or current*() keeps reporting the old router default until the next full load and
 * matchesSavedDefault() lies about whether anything is left to save */
function setSD(field, val) { try { (window.__fsSD = window.__fsSD || {})[field] = val; } catch (e) {} }

/* ---- every axis owns its ROUTER DEFAULT, and nothing else may restate it ----
 * `def()` is the sd() branch of current() alone: the effective value with no localStorage. Exposed
 * because _resolvedDefault() needs exactly that branch, and a second copy of the same validation
 * drifts without a symptom — matchesSavedDefault() then lies about the one thing the Save button
 * is, its own status. */
function modeDefault() {
	const d = sd('darkmode');
	return (d === 'dark' || d === 'light') ? d : 'auto';
}
function currentMode() {
	const s = lsGet('fs-darkmode');
	if (s === 'true') return 'dark';
	if (s === 'false') return 'light';
	if (s === 'auto') return 'auto';
	if (s === null) return modeDefault();
	return 'auto';
}
/* ---- dark mode is announced in three dialects, because apps sniff for it ----
 *
 * An app with its own dark styles has to guess whether the page is dark and there is no standard:
 * apps read `data-theme="dark"` on :root (luci-app-justclash keys 21 rules off it), Bootstrap's
 * `data-bs-theme` (luci-app-ssclash), or, failing both, the luminance of the body background. All
 * three are stamped for the same fact: before that, every one of justclash's [data-theme="dark"]
 * rules was dead and a dark page rendered its light fills.
 *
 * `data-darkmode` is the name the theme's own CSS keys off. The other two are outbound
 * compatibility, like the `--*-color-*` export tier: nothing in `styles/` may read them, and
 * tools/axes.mjs fails the build if it does. */
/* the attribute name reused below by the writer, the guard's reader and both MutationObserver
 * filters (measured: 15 B x4 -> 28 B, 32 B saved) */
function stampDark(root, dark) {
	/* the literal stays spelled out HERE: tools/axes.mjs reads the attribute names out of
	 * this function's SOURCE, so a hoisted const reads as no attribute at all and the gate
	 * reports the pre-paint and the live applier as drifted. The 45 B a const would save are
	 * not worth teaching a gate to resolve them. */
	root.setAttribute('data-darkmode', dark ? 'true' : 'false');
	root.setAttribute('data-theme', dark ? 'dark' : 'light');
	root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
}

const _mqDark = window.matchMedia('(prefers-color-scheme: dark)');

/* the one expression for "is this page dark right now", so the applier, the OS listener and the
 * guard below cannot disagree about it */
function intendedDark() {
	const m = currentMode();
	return m === 'dark' || (m === 'auto' && _mqDark.matches);
}

function applyMode(val) {
	const root = document.documentElement;
	/* 'auto' is stored explicitly, so it overrides a router default of dark/light — otherwise a
	 * router defaulted to dark could never be set back to "follow the OS" */
	if (val === 'auto') lsSet('fs-darkmode', 'auto');
	else lsSet('fs-darkmode', val === 'dark' ? 'true' : 'false');
	/* after the store, so intendedDark() reads the choice just made and no second copy of the
	 * condition is needed in terms of `val` */
	stampDark(root, intendedDark());
}

/* ---- the three dialects are published, so third parties write them too ----
 *
 * Announcing dark mode in a vocabulary apps understand is what makes them follow the page, and it
 * is why an app reaches for the same attribute: `luci-app-openclash` stamps `data-darkmode="true"`
 * onto :root from seven of its templates, gated on an isDarkBackground() that consults
 * `matchMedia('(prefers-color-scheme: dark)')` before it looks at the real background. So a user
 * who chose LIGHT here, on an OS set to dark, has the theme flipped by opening an OpenClash page —
 * and one of those templates removes the attribute head.ut writes as 'false'.
 *
 * No cascade trick answers a DOM write, so watch the attributes we own and restate the truth.
 * Nothing else is guarded: the other axes are private to this theme, no app has a reason to know
 * them, and a survey of ten shipping packages found none that writes one. The published trio is
 * the surface precisely because it is published.
 *
 * This corrects a wrong premise rather than fighting the app's intent: when the page really is
 * dark, the app's write agrees with ours and the guard never fires. It cannot ping-pong either —
 * our write produces a mutation, the callback re-runs, the values match, it returns. */
function guardDarkStamp() {
	const root = document.documentElement;
	const check = () => {
		const dark = intendedDark();
		if (root.getAttribute('data-darkmode') === (dark ? 'true' : 'false') &&
			root.getAttribute('data-theme') === (dark ? 'dark' : 'light') &&
			root.getAttribute('data-bs-theme') === (dark ? 'dark' : 'light')) return;
		stampDark(root, dark);
	};
	/* an app's inline <script> runs while its template is parsed, long before this module is
	 * fetched, so the attribute can already be wrong and observing alone would never see it */
	check();
	new MutationObserver(check).observe(root, {
		attributes: true,
		attributeFilter: [ 'data-darkmode', 'data-theme', 'data-bs-theme' ]
	});
}
/* ---- the browser's own chrome follows the page ----
 *
 * `<meta name="theme-color">` is what colours a mobile address bar, the Android task-switcher card
 * and an installed PWA's title bar. head.ut ships it at the default palette's page colour, which is
 * all a static template can know; from here it tracks the live one.
 *
 * Read from the BODY's computed background, not from `--fs-bg`: a custom property returns its token
 * stream, so a palette whose page colour is a color-mix() would put `color-mix(in srgb, …)` in the
 * attribute, and 21 of the axes reach the canvas through one mix or another.
 *
 * One observer rather than a call in each applier: the colour is a function of :root's attributes
 * and inline properties — mode, palette, tint, its strength — and every axis already writes exactly
 * those. Adding an axis therefore needs nothing here. Coalesced into a frame because the tint and
 * strength sliders write on every input event, and getComputedStyle forces style resolution. */
function paintThemeColor() {
	const meta = document.querySelector('meta[name="theme-color"]');
	if (!meta || !document.body) return;
	const bg = getComputedStyle(document.body).backgroundColor;
	/* a transparent body means the sheet has not applied yet; keep the server's value */
	if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') meta.setAttribute('content', bg);
}

function watchThemeColor() {
	let queued = false;
	const paint = () => {
		queued = false;
		paintThemeColor();
	};
	const schedule = () => {
		if (queued) return;
		queued = true;
		window.requestAnimationFrame(paint);
	};
	paintThemeColor();
	new MutationObserver(schedule).observe(document.documentElement,
		{ attributes: true, attributeFilter: [ 'style', 'class', 'data-darkmode', 'data-palette', 'data-wallpaper' ] });
}

/* "Auto" means follow the OS continuously, not only at page load. Only while the effective mode is
 * auto: an explicit browser choice, or an explicit router default with no browser override. */
_mqDark.addEventListener('change', () => {
	if (currentMode() === 'auto') {
		const root = document.documentElement;
		stampDark(root, intendedDark());
	}
});
/* Corner radius: the card radius (0–20px) as an inline --fs-radius-base on :root, from which
 * 02-tokens derives every other radius. head.ut pre-paints it and tools/axes.mjs holds JS/CSS/head
 * to this one number, hence the named const. */

/* ---- the four axis shapes, each written once ----
 *
 * Sixteen axes are four shapes, so the shape lives in a factory and each instance is one line:
 * enumAxis (pattern ink), colorAxis (tint, accent, good, warn, danger), surfaceAxis (cards,
 * controls, bar, borders), propAxis (rounding, tint strength, photo dim, pattern size, pattern
 * strength, content width). Same contract throughout: `current()` is localStorage ?? def(), `def()` is the router
 * default alone, `apply()` stores the choice explicitly. None use `this` — every export is a
 * detached method reference, so a `this` here would throw on the first call.
 *
 * Each factory takes its localStorage key as the first argument, and tools/axes.mjs matches the
 * call by its literal args: an axis built by a factory has no lsGet('fs-…') call site for the gate
 * to find.
 *
 * The remaining axes stay separate, each with a quirk a shared table would need an option for:
 * `mode` stores a value it does not apply and owns an MQL listener, `layout` reads the attribute,
 * `wallpaper` and `density` are three-valued, `palette` outgrew the two-value shape when the third
 * one landed, `autoCollapse` has no :root attribute. */

/* An axis whose values are a list, with one of them stamped as nothing.
 *
 * `values` are the names that become `attr="<name>"`; `dflt` is the one that leaves :root bare, and
 * is what a stray or missing value falls back to. `after` runs once the attribute is stamped, for
 * the axis that has to re-take a measurement.
 *
 * The list IS the validation: a name added to the stylesheet and not here is one head.ut pre-paints
 * and this rejects, so the page paints it and the first touch of any other control takes it away. */
function listAxis(key, attr, values, dflt, after) {
	/* 'fs-pattern-ink' -> 'pattern_ink', the window.__fsSD field. The underscore is the point: the
	 * localStorage key is hyphenated and the uci option is not, so a bare slice(3) names a field
	 * head.ut never emits, sd() returns undefined forever, and the axis reports the built-in
	 * default however the router is set — Save-as-default then writes it over the admin's value. */
	const sdKey = key.slice(3).replace(/-/g, '_');
	const ok = (v) => (values.indexOf(v) >= 0);
	const def = () => (ok(sd(sdKey)) ? sd(sdKey) : dflt);
	return {
		def,
		current() {
			const s = lsGet(key);
			if (ok(s)) return s;
			if (s === dflt) return dflt;
			if (s === null) return def();
			return dflt;	/* a stray value reads as the built-in default */
		},
		apply(val) {
			const root = document.documentElement;
			const v = ok(val) ? val : dflt;
			/* stored explicitly (including the default), so it overrides a router default */
			lsSet(key, v);
			if (v === dflt) root.removeAttribute(attr);
			else root.setAttribute(attr, v);
			if (after) after();
		}
	};
}

/* A two-value axis: `on` is stamped as the attribute's value, `off` is a bare :root. The list shape
 * with a list of one — kept as its own name because tools/axes.mjs matches the call, and because
 * "two-valued" is what most of these axes are. */
function enumAxis(key, attr, on, off) {
	return listAxis(key, attr, [ on ], off);
}

/* A colour axis — Tint, Accent and the three status colours are one axis pointed at five tokens:
 * same validation, same "0 is off", same ordering rule (set the custom property BEFORE the
 * attribute, or a fresh load paints one frame in the previous colour).
 *
 * A value is one of three things, and the attribute says which (03-palettes.css matches on it):
 *
 *   0            off — no attribute, the palette as it shipped
 *   1–360        a HUE: CSS rotates the palette's own colour through oklch(from … l c H), so
 *                lightness, chroma and every contrast margin stay the palette's
 *   '#rrggbb'    a COLOUR, stamped inline on :root as the live token; the ink over it is derived
 *                from its lightness in CSS
 *
 * Both live in one localStorage key rather than a colour key beside a hue key: two keys would need
 * a third to say which is in effect, and that third is the one a pre-paint script forgets.
 * `hueProp` carries the degrees, `colorProp` the live token a hex value overwrites; each mode
 * clears the other's property, so the two can never both be half-applied. */
const DENSITIES = [ 'compact', 'large' ];	/* the two non-default values; 'normal' = bare :root */
const DENSITY = listAxis('fs-density', 'data-density', DENSITIES, 'normal', () => fit.schedule());
const currentDensity = DENSITY.current, applyDensity = DENSITY.apply,
	densityDefault = DENSITY.def;

/* Content width lives entirely in fs-axes.js now (a propAxis like Rounding, issue #44): unlike
 * Density it sets no attribute, so nothing here or in fs-chrome.js needs to read one, and
 * currentContentWidth()/applyContentWidth() have no caller outside the Appearance page — the one
 * thing that kept Density's shape in this cold-path file. */
/* Background-tint axis: the canvas the cards float on (--fs-bg), so a whole install reads as one
 * colour and a tab or a screenshot says which router it belongs to. Cards, chrome and the status
 * colours keep the palette's values — the cue colours the paper, not the UI. On a hue it is mixed
 * in CSS (03-palettes.css explains why that stays contrast-safe at every angle); on a hex it IS the
 * canvas. 0 is off rather than red, a hue wheel wrapping, so one end of the range is free. */
function currentLayout() {
	return document.documentElement.getAttribute('data-layout') === 'top' ? 'top' : 'sidebar';
}
function isTopLayout() {
	return currentLayout() === 'top';
}
function applyLayout(val) {
	const layout = (val === 'top') ? 'top' : 'sidebar';
	/* always an explicit value, never a removed attribute: every layout rule matches data-layout
	 * positively, and lsDel would let the server default re-assert on the next load */
	lsSet('fs-layout', layout);
	document.documentElement.setAttribute('data-layout', layout);
	/* the bar and the column leave the menu different room: re-take the fits-on-one-row
	 * measurement */
	fit.schedule();
}

/* Sidebar accordion: auto-collapse on = one section open at a time; off (default) they stack.
 * Only meaningful for the expanded sidebar — rail flyouts and the mobile bar are always
 * exclusive. Read by menu-footstrap.js. */
function autoCollapseDefault() {
	return sd('autocollapse') === 'on';
}
function currentAutoCollapse() {
	const s = lsGet('fs-menu-autocollapse');
	if (s === 'true') return true;
	if (s === 'false') return false;
	if (s === null) return autoCollapseDefault();
	return false;
}
function applyAutoCollapse(val) {
	const on = (val === 'on');
	lsSet('fs-menu-autocollapse', on ? 'true' : 'false');

	/* Switching it on with several sections unfolded leaves the menu in a state the setting says is
	 * impossible, so somebody must fold them — but not this module, which owns storage while the
	 * menu owns every piece of the open/closed state and opens and closes only through setOpen().
	 * Reaching in with a raw classList.remove satisfies the class and leaves the aria saying
	 * expanded. Say what changed and let the menu apply it. */
	document.dispatchEvent(new CustomEvent('fs-autocollapse', { detail: { on } }));
}

/* The sidebar rail's collapsed flag; the button that flips it is chrome (fs-chrome.js). Not part
 * of the router-wide defaults — a transient chrome collapse, not an appearance choice — so it is
 * absent from snapshotAxes() and resetToSaved(). */
function applyRail(on) {
	const root = document.documentElement;
	if (on) { root.setAttribute('data-rail', 'true'); lsSet('fs-rail', 'true'); }
	else { root.removeAttribute('data-rail'); lsDel('fs-rail'); }
}
function currentRail() {
	return document.documentElement.getAttribute('data-rail') === 'true';
}

/* ---- Save to router: write the current effective axes to /etc/config/footstrap ----
 * The scoped rpcd ACL (config 'footstrap' only) lets the admin's session set and commit those
 * options; rpcd validates the config/section/option names, so no value reaches a shell. The server
 * reads them back on the next load and head.ut's sanitiser clamps each before it becomes
 * window.__fsSD.
 *
 * snapshotAxes() reads the effective values, which already fold in this browser's localStorage, so
 * Save captures what the user sees. It does not touch localStorage: this browser keeps overriding,
 * and the saved default is for other devices. resetToSaved() drops this browser back onto it. */
/* Every saved axis's localStorage key: what Save-as-default clears and what a reset walks.
 *
 * Tried as one table of [key, field, def] with the resolved defaults derived from it: correct,
 * and 188 B larger after minification — three lists of short literals compress better than
 * twenty-one rows of data, because a function name is mangled and a row is not. The copies are
 * held together by tools/axes.mjs instead, which reads snapshotAxes()'s body and holds every
 * field against header.ut's FS_AXES. */

return baseclass.extend({
	/* the storage wrappers and the router-default reader: fs-axes.js is built on these */
	lsGet, lsSet, lsDel, lsGetArr, storageBroken, sd, setSD,
	/* the two axis shapes, so the nineteen axes in fs-axes.js can be built from them */
	listAxis, enumAxis,

	currentMode, applyMode, modeDefault, guardDarkStamp, watchThemeColor,
	currentDensity, applyDensity, densityDefault,
	currentLayout, applyLayout, isTopLayout,
	currentAutoCollapse, applyAutoCollapse, autoCollapseDefault,
	currentRail, applyRail
});
