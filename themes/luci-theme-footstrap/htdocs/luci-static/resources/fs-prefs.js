'use strict';
'require baseclass';
'require fs-fit as fit';

/* The live appliers every page needs (dark mode, layout, auto-collapse, rail) and the localStorage
 * wrappers under them. The other axes, the snapshot and the resets live in fs-axes.js. */

/* A browser can refuse storage (blocked cookies, a partitioned WebView, a full quota) and then
 * reads or writes throw: every access is wrapped, and an unreadable preference is a default, not
 * an error. */
const _mem = new Map();
let _lsBroken = false;
function storageBroken() { return _lsBroken; }
function lsGet(k) { if (_mem.has(k)) return _mem.get(k); try { return localStorage.getItem(k); } catch (e) { _lsBroken = true; return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); _mem.delete(k); } catch (e) { _lsBroken = true; _mem.set(k, String(v)); } }
function lsDel(k) { _mem.delete(k); try { localStorage.removeItem(k); } catch (e) { _lsBroken = true; } }

/* A stored JSON array, or [] — the shape of the two remembered lists (the search palette's recent
 * paths, the menu's open sections). */
function lsGetArr(k) {
	try {
		const a = JSON.parse(lsGet(k) || '[]');
		return Array.isArray(a) ? a : [];
	} catch (e) { return []; }
}

const RECENT_KEY = 'fs-recent';
const RECENT_MAX = 8;
function recentPaths() {
	return lsGetArr(RECENT_KEY).filter((x) => typeof x === 'string').slice(0, RECENT_MAX);
}

/* the router-wide defaults the server stamped (head.ut), read at runtime so current*() reports the
 * effective default when this browser has no localStorage value */
function sd(k) { return (window.__fsSD || {})[k]; }

function setSD(field, val) { (window.__fsSD = window.__fsSD || {})[field] = val; }

function modeDefault() {
	const d = sd('darkmode');
	return (d === 'dark' || d === 'light') ? d : 'auto';
}
function currentMode() {
	const s = lsGet('fs-darkmode');
	if (s === 'true') return 'dark';
	if (s === 'false') return 'light';
	if (s === null) return modeDefault();
	return 'auto';
}
/* Dark mode is announced in three dialects because apps sniff for it: `data-theme="dark"`
 * (luci-app-justclash keys 21 rules off it), Bootstrap's `data-bs-theme` and `data-darkmode`. */
function stampDark(root, dark) {
	/* the names stay literal: a gate reads this function's source, and a hoisted const would
	 * look like no attribute at all */
	root.setAttribute('data-darkmode', dark ? 'true' : 'false');
	root.setAttribute('data-theme', dark ? 'dark' : 'light');
	root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
}

const _mqDark = window.matchMedia('(prefers-color-scheme: dark)');

function intendedDark() {
	const m = currentMode();
	return m === 'dark' || (m === 'auto' && _mqDark.matches);
}

function applyMode(val) {
	const root = document.documentElement;
	/* 'auto' is stored explicitly, so it overrides a router default of dark/light */
	if (val === 'auto') lsSet('fs-darkmode', 'auto');
	else lsSet('fs-darkmode', val === 'dark' ? 'true' : 'false');
	stampDark(root, intendedDark());
}

/* Third parties write the dialects too: luci-app-openclash stamps `data-darkmode="true"` onto
 * :root from seven templates, so the guard re-asserts the stamp. */
function guardDarkStamp() {
	const root = document.documentElement;
	const check = () => {
		const dark = intendedDark();
		if (root.getAttribute('data-darkmode') === (dark ? 'true' : 'false') &&
			root.getAttribute('data-theme') === (dark ? 'dark' : 'light') &&
			root.getAttribute('data-bs-theme') === (dark ? 'dark' : 'light')) return;
		stampDark(root, dark);
	};
	check();
	new MutationObserver(check).observe(root, {
		attributes: true,
		attributeFilter: [ 'data-darkmode', 'data-theme', 'data-bs-theme' ]
	});
}

/* `<meta name="theme-color">` colours a mobile address bar and an installed PWA's title bar;
 * head.ut ships the default palette's page colour and this tracks the live one. */
function paintThemeColor() {
	const meta = document.querySelector('meta[name="theme-color"]');
	if (!meta || !document.body) return;
	const bg = getComputedStyle(document.body).backgroundColor;
	/* a transparent body means the sheet has not applied yet; keep the server's value */
	if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') meta.setAttribute('content', bg);
}

function watchThemeColor() {
	paintThemeColor();
	new MutationObserver(fit.frame(paintThemeColor)).observe(document.documentElement,
		{ attributes: true, attributeFilter: [ 'style', 'class', 'data-darkmode', 'data-palette', 'data-wallpaper' ] });
}

function currentLayout() {
	return document.documentElement.getAttribute('data-layout') === 'top' ? 'top' : 'sidebar';
}
function isTopLayout() {
	return currentLayout() === 'top';
}
function applyLayout(val) {
	const layout = (val === 'top') ? 'top' : 'sidebar';
	/* always an explicit value, never a removed attribute: every layout rule matches data-layout
	 * positively */
	lsSet('fs-layout', layout);
	document.documentElement.setAttribute('data-layout', layout);
	/* the bar and the column leave the menu different room: re-take the fits-on-one-row
	 * measurement */
	fit.schedule();
}

/* Sidebar accordion: auto-collapse on = one section open at a time; off (default) they stack. Only
 * meaningful for the expanded sidebar. */
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
	 * impossible, so the open ones are folded. */
	document.dispatchEvent(new CustomEvent('fs-autocollapse', { detail: { on } }));
}

/* The sidebar rail's collapsed flag, flipped by fs-chrome.js: a transient chrome collapse, not an
 * axis, so snapshotAxes() and resetToSaved() skip it. */
function applyRail(on) {
	const root = document.documentElement;
	if (on) { root.setAttribute('data-rail', 'true'); lsSet('fs-rail', 'true'); }
	else { root.removeAttribute('data-rail'); lsDel('fs-rail'); }
}
function currentRail() {
	return document.documentElement.getAttribute('data-rail') === 'true';
}

return baseclass.extend({
	/* the storage wrappers and the router-default reader: fs-axes.js is built on these */
	lsGet, lsSet, lsDel, lsGetArr, RECENT_KEY, RECENT_MAX, recentPaths, storageBroken, sd, setSD,
	currentMode, applyMode, modeDefault, guardDarkStamp, watchThemeColor,
	currentLayout, applyLayout, isTopLayout,
	currentAutoCollapse, applyAutoCollapse, autoCollapseDefault,
	currentRail, applyRail
});
