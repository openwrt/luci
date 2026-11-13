'use strict';
'require baseclass';
'require rpc';
'require fs-prefs as prefs';
'require fs-fit as fit';

/* fs-axes — the Appearance axes and the Save-as-default machinery.
 *
 * Split out of fs-prefs.js because only `fs-appearance` (the form) and `fs-assets` (the uploads)
 * need it, so the router fetches it on the Appearance page and nowhere else: 5.9 KB off what every
 * page downloads. fs-prefs keeps what the chrome applies live: the localStorage wrappers and sd(),
 * dark mode (guardDarkStamp defends it on every page), layout, rail and auto-collapse.
 *
 * head.ut's pre-paint has already stamped every axis before the first frame, so nothing here is
 * needed to paint a page correctly, only to change one from the form. */

/* An axis whose values are a list, with one of them stamped as nothing.
 *
 * `values` are the names that become `attr="<name>"`; `dflt` is the one that leaves :root bare, and
 * is what a stray or missing value falls back to. `after` runs once the attribute is stamped, for
 * the axis that has to re-take a measurement.
 *
 * The list is the validation: a name added to the stylesheet and not here is one head.ut pre-paints
 * and this rejects, so the page paints it and the first touch of any other control takes it away. */
function listAxis(key, attr, values, dflt, after) {
	/* 'fs-pattern-ink' -> 'pattern_ink', the window.__fsSD field: the localStorage key is hyphenated
	 * and the uci option is not */
	const sdKey = key.slice(3).replace(/-/g, '_');
	const ok = (v) => (values.indexOf(v) >= 0);
	const def = () => (ok(prefs.sd(sdKey)) ? prefs.sd(sdKey) : dflt);
	return {
		def,
		current() {
			const s = prefs.lsGet(key);
			if (ok(s)) return s;
			if (s === null) return def();
			return dflt;	/* a stray value reads as the built-in default */
		},
		apply(val) {
			const root = document.documentElement;
			const v = ok(val) ? val : dflt;
			/* stored explicitly (including the default), so it overrides a router default */
			prefs.lsSet(key, v);
			if (v === dflt) root.removeAttribute(attr);
			else root.setAttribute(attr, v);
			if (after) after();
		}
	};
}

/* A two-value axis: `on` is stamped as the attribute's value, `off` is a bare :root. The list shape
 * with a list of one — kept as its own name because "two-valued" is what most of these
 * axes are. */
function enumAxis(key, attr, on, off) {
	return listAxis(key, attr, [ on ], off);
}

const FS_RADIUS_DEFAULT = 12;

const FS_HEX_RE = /^#[0-9a-f]{6}$/i;
/* 0 | 1..360 | '#rrggbb', from anything: localStorage (always a string), the router default (a uci
 * string, or a number from an older config) */
function normColor(v) {
	if (typeof v === 'number') return (v >= 1 && v <= 360) ? v : 0;
	if (typeof v !== 'string') return 0;
	const s = v.trim();
	if (FS_HEX_RE.test(s)) return s.toLowerCase();
	const h = parseInt(s, 10);
	return (h >= 1 && h <= 360) ? h : 0;
}
/* Black or white ink for a '#rrggbb' fill: OKLab L above .62 reads black, else white (black clears
 * 4.5:1 on #ffcc00, white on #0033aa). Computed here, not in CSS. */
function inkFor(hex) {
	const [ lr, lg, lb ] = [ 1, 3, 5 ].map((i) => {
		const u = parseInt(hex.slice(i, i + 2), 16) / 255;
		return (u <= 0.04045) ? (u / 12.92) : (((u + 0.055) / 1.055) ** 2.4);
	});
	const f = (x, y, z) => Math.cbrt((x * lr) + (y * lg) + (z * lb));
	return (((0.21045 * f(0.41222, 0.53633, 0.05145)) + (0.79362 * f(0.2119, 0.6807, 0.1074)) - (0.00407 * f(0.0883, 0.28172, 0.62998))) > 0.62) ? '#000' : '#fff';
}
function colorAxis(key, attr, hueProp, colorProp, inkProp) {
	const sdKey = key.slice(3).replace(/-/g, '_');
	const def = () => normColor(prefs.sd(sdKey));
	return {
		def,
		current() {
			const raw = prefs.lsGet(key);
			return (raw !== null) ? normColor(raw) : def();
		},
		apply(val) {
			const root = document.documentElement;
			const v = normColor(val);
			prefs.lsSet(key, String(v));
			if (!v) {
				root.removeAttribute(attr);
				root.style.removeProperty(hueProp);
				root.style.removeProperty(colorProp);
				if (inkProp) root.style.removeProperty(inkProp);
			} else if (typeof v === 'number') {
				root.style.removeProperty(colorProp);
				if (inkProp) root.style.removeProperty(inkProp);
				/* the hue first, then the attribute that switches the rotation on: the other
				 * order paints one frame in the previous colour on a fresh load */
				root.style.setProperty(hueProp, String(v));
				root.setAttribute(attr, 'hue');
			} else {
				root.style.removeProperty(hueProp);
				root.style.setProperty(colorProp, v);
				if (inkProp) root.style.setProperty(inkProp, inkFor(v));
				root.setAttribute(attr, 'hex');
			}
		}
	};
}

/* A numeric slider axis that sets an inline custom property and no attribute: it validates to
 * [min,max], stores the choice explicitly and removes the property at the default. */
function propAxis(key, sdKey, prop, min, max, dfl, fmt, after) {
	const inRange = (n) => (typeof n === 'number' && n >= min && n <= max);
	const def = () => { const d = prefs.sd(sdKey); return inRange(d) ? d : dfl; };
	return {
		def, min, max,
		current() {
			const raw = prefs.lsGet(key);
			if (raw !== null) { const v = parseInt(raw, 10); return inRange(v) ? v : dfl; }
			return def();
		},
		apply(n) {
			const root = document.documentElement;
			const v = Math.max(min, Math.min(max, n | 0));
			prefs.lsSet(key, String(v));
			if (v === dfl) root.style.removeProperty(prop);
			else root.style.setProperty(prop, fmt(v));
			if (after) after();
		}
	};
}

/* Palette: footstrap is the default (bare :root); every other colourway is an opt-in data-palette
 * value (styles/03-palettes.css). Not the enumAxis shape. */

const PALETTES = [ 'hicontrast', 'bootstrap', '2020', 'forum' ];	/* the non-default values; 'footstrap' = bare :root */
const PALETTE = listAxis('fs-palette', 'data-palette', PALETTES, 'footstrap');

/* Wallpaper: off (bare canvas), pattern (the admin-uploaded SVG, tiled and recoloured) or file
 * (the admin-uploaded photo). */
const WALLPAPERS = [ 'pattern', 'file' ];		/* the non-off values; 'off' = bare :root */
const WALLPAPER = listAxis('fs-wallpaper', 'data-wallpaper', WALLPAPERS, 'off');

/* Density is a pure token axis; it re-runs the fit because Compact makes more fit and Large less. */
const DENSITIES = [ 'compact', 'large' ];	/* the two non-default values; 'normal' = bare :root */
const DENSITY = listAxis('fs-density', 'data-density', DENSITIES, 'normal', () => fit.schedule());

const TINT = colorAxis('fs-tint', 'data-tint', '--fs-tint-h', '--fs-bg');

/* Accent axis: the UI accent (solid buttons, toggle knobs, sliders, focus rings, accented links)
 * while canvas, cards and status colours stay put. */
const ACCENT = colorAxis('fs-accent', 'data-accent', '--fs-accent-h', '--fs-accent', '--fs-on-accent');

/* The surface axes (cards, chrome, inset controls, hairlines) are their own factory, not four more
 * colorAxis instances: there is no hue mode, as rotating a near-white card keeps it near-white. */
function surfaceAxis(key, sdKey, prop) {
	const norm = (v) => {
		const s = (typeof v === 'string') ? v.trim().toLowerCase() : '';
		return FS_HEX_RE.test(s) ? s : 0;
	};
	const def = () => norm(prefs.sd(sdKey));
	return {
		def,
		current() {
			const raw = prefs.lsGet(key);
			return (raw !== null) ? norm(raw) : def();
		},
		apply(val) {
			const v = norm(val);
			prefs.lsSet(key, String(v));
			if (v) document.documentElement.style.setProperty(prop, v);
			else document.documentElement.style.removeProperty(prop);
		}
	};
}
const CARD = surfaceAxis('fs-card', 'card', '--fs-panel-base');
const CONTROL = surfaceAxis('fs-control', 'control', '--fs-panel2-base');
const BAR = surfaceAxis('fs-bar', 'bar', '--fs-bar-bg');
const LINE = surfaceAxis('fs-line', 'line', '--fs-border-base');

/* The three status colours are colorAxis pointed at --fs-good / --fs-warn / --fs-danger, separate
 * because each derived tint is a color-mix() of its own role. */
const GOOD = colorAxis('fs-good', 'data-good', '--fs-good-h', '--fs-good', '--fs-on-good');
const WARN = colorAxis('fs-warn', 'data-warn', '--fs-warn-h', '--fs-warn', '--fs-on-warn');
const DANGER = colorAxis('fs-danger', 'data-danger', '--fs-danger-h', '--fs-danger', '--fs-on-danger');

/* Rounding: the propAxis instance, --fs-radius-base in px. */
const RADIUS = propAxis('fs-radius', 'rounding', '--fs-radius-base', 0, 20, FS_RADIUS_DEFAULT, (v) => (v + 'px'));

/* Content width: how far the reader lets the column grow past --fs-content-max's own 1280px; the
 * range is bounded in 02-tokens.css. It re-runs the fit. */
const FS_CWIDTH_DEFAULT = 1280;
const CWIDTH = propAxis('fs-content-width', 'content_width', '--fs-content-max', 1280, 3840,
	FS_CWIDTH_DEFAULT, (v) => (v + 'px'), () => fit.schedule());

/* Tint strength: a multiplier on the tint chroma, 100% the designed strength and 200% the cap. 0
 * is not "no tint". */
const FS_TSTR_DEFAULT = 100;
const TSTR = propAxis('fs-tint-strength', 'tint_strength', '--fs-tint-strength', 0, 200, FS_TSTR_DEFAULT, (v) => String(v / 100));

/* Photo dim: the scrim opacity over the file photo (0–100%); how strongly this browser dims the
 * shared photo reaches the router through Save-as-default. */
const FS_PDIM_DEFAULT = 74;
const PDIM = propAxis('fs-photo-dim', 'photo_dim', '--fs-photo-dim', 0, 100, FS_PDIM_DEFAULT, (v) => (v + '%'));

/* The pattern's live knobs bite only while the wallpaper is 'pattern'. */
const FS_PSIZE_DEFAULT = 440;
const PSIZE = propAxis('fs-pattern-size', 'pattern_size', '--fs-pattern-size', 40, 1600, FS_PSIZE_DEFAULT, (v) => (v + 'px'));
const FS_PSTR_DEFAULT = 20;
const PSTR = propAxis('fs-pattern-strength', 'pattern_strength', '--fs-pattern-strength', 0, 100, FS_PSTR_DEFAULT, (v) => String(v / 100));
const PINK = enumAxis('fs-pattern-ink', 'data-pattern-ink', 'original', 'theme');
/* `reject: true` is load-bearing: without it rpc.js hands the ubus status back as the resolved
 * value, so a per-config ACL refusal (6, permission denied) runs every `.then()` as a success. */

const _uciSet = rpc.declare({ object: 'uci', method: 'set', params: [ 'config', 'section', 'values' ], reject: true });
const _uciCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ], reject: true });
const saveSettings = (values) => _uciSet('footstrap', 'settings', values).then(() => _uciCommit('footstrap'));

/* The one list of axes. Its keys are the uci option names Save-as-default writes (and partials/head.ut
 * stamps back into window.__fsSD); `key` is the localStorage key, `ax` the axis object. */
const AXES = {
	layout: { key: 'fs-layout', ax: { current: prefs.currentLayout, def: () => prefs.sd('layout') || 'top', apply: prefs.applyLayout }, builtin: 'top' },
	darkmode: { key: 'fs-darkmode', ax: { current: prefs.currentMode, def: prefs.modeDefault, apply: prefs.applyMode }, builtin: 'auto' },
	palette: { key: 'fs-palette', ax: PALETTE, builtin: 'footstrap' },
	wallpaper: { key: 'fs-wallpaper', ax: WALLPAPER, builtin: 'off' },
	tint: { key: 'fs-tint', ax: TINT, builtin: 0 },
	accent: { key: 'fs-accent', ax: ACCENT, builtin: 0 },
	good: { key: 'fs-good', ax: GOOD, builtin: 0 },
	warn: { key: 'fs-warn', ax: WARN, builtin: 0 },
	danger: { key: 'fs-danger', ax: DANGER, builtin: 0 },
	card: { key: 'fs-card', ax: CARD, builtin: 0 },
	control: { key: 'fs-control', ax: CONTROL, builtin: 0 },
	bar: { key: 'fs-bar', ax: BAR, builtin: 0 },
	line: { key: 'fs-line', ax: LINE, builtin: 0 },
	rounding: { key: 'fs-radius', ax: RADIUS, builtin: FS_RADIUS_DEFAULT },
	autocollapse: { key: 'fs-menu-autocollapse', ax: {
		current: () => (prefs.currentAutoCollapse() ? 'on' : 'off'),
		def: () => (prefs.autoCollapseDefault() ? 'on' : 'off'),
		apply: prefs.applyAutoCollapse }, builtin: 'off' },
	tint_strength: { key: 'fs-tint-strength', ax: TSTR, builtin: FS_TSTR_DEFAULT },
	density: { key: 'fs-density', ax: DENSITY, builtin: 'normal' },
	photo_dim: { key: 'fs-photo-dim', ax: PDIM, builtin: FS_PDIM_DEFAULT },
	pattern_size: { key: 'fs-pattern-size', ax: PSIZE, builtin: FS_PSIZE_DEFAULT },
	pattern_strength: { key: 'fs-pattern-strength', ax: PSTR, builtin: FS_PSTR_DEFAULT },
	pattern_ink: { key: 'fs-pattern-ink', ax: PINK, builtin: 'theme' },
	content_width: { key: 'fs-content-width', ax: CWIDTH, builtin: FS_CWIDTH_DEFAULT }
};
const AXIS_KEYS = Object.values(AXES).map((a) => a.key);
const snapshotAxes = () => Object.fromEntries(Object.entries(AXES).map(([ k, a ]) => [ k, String(a.ax.current()) ]));
/* The resolved router default (the uci value if set, else the built-in) in snapshotAxes() string
 * form, so the Appearance page can grey the Save button when this browser already matches. */
const _resolvedDefault = () => Object.fromEntries(Object.entries(AXES).map(([ k, a ]) => [ k, String(a.ax.def()) ]));
let _savedDefault = _resolvedDefault();
function matchesSavedDefault() {
	const cur = snapshotAxes();
	return Object.keys(cur).every((k) => cur[k] === _savedDefault[k]);
}

/* No axis reaches /etc/config/footstrap except through Save-as-default: an axis that wrote through
 * on change re-pointed the router-wide default for every other device. */
function saveAsDefault() {
	const snap = snapshotAxes();
	return saveSettings(snap)
		.then(() => { _savedDefault = snap; });
}
/* The two resets differ in what is underneath: resetToSaved() clears the keys, so every axis falls
 * back to the router default where one is set and the built-in where not. */
function resetToSaved() {
	AXIS_KEYS.forEach(prefs.lsDel);
}

/* The built-in defaults, written through the ordinary appliers so each validates its own value and
 * stamps :root as usual. */
function resetToBuiltin() {
	Object.values(AXES).forEach((a) => a.ax.apply(a.builtin));
}

/* The two uploaded wallpapers, browser side: what the router last saved, its URL, and how to paint
 * it. The upload itself is fs-assets.js. */
/* the cache-bust token charset, an md5/sha hex string; head.ut's ucode sanitiser keeps its own
 * copy, running before this module */
const BG_TOKEN_RE = /^[a-f0-9]{6,64}$/;
function tokenOk(t) { return BG_TOKEN_RE.test(t); }

/* The pattern and the login-bg photo are the same shape twice: a router-saved cache-bust token,
 * read back through prefs.sd(), that sets or clears one url() custom property. */
function tokenAsset(sdKey, serve, prop) {
	const current = () => {
		const t = prefs.sd(sdKey);
		return (typeof t === 'string' && BG_TOKEN_RE.test(t)) ? t : '';
	};
	const url = (tok) => serve + '?v=' + tok;
	const apply = (tok) => {
		const root = document.documentElement;
		if (tok) root.style.setProperty(prop, 'url("' + url(tok) + '")');
		else root.style.removeProperty(prop);
		prefs.setSD(sdKey, tok || '');
	};
	return { current, url, apply };
}

/* Not a /www symlink, unlike LOGIN_BG: an SVG served as a plain static file is a same-origin
 * document that runs script opened directly. */
const PATTERN = tokenAsset('pattern', '/cgi-bin/luci-theme-footstrap-pattern', '--fs-pattern-url');

/* Plain /www symlink, extension-less, so uhttpd serves it as octet-stream (the uci-default says why). */
const LOGIN_BG = tokenAsset('login_bg', '/luci-static/footstrap/bg', '--fs-login-bg-url');

return baseclass.extend({
	palette: PALETTE,
	wallpaper: WALLPAPER,
	density: DENSITY,
	tint: TINT,
	accent: ACCENT,
	good: GOOD,
	warn: WARN,
	danger: DANGER,
	card: CARD,
	control: CONTROL,
	bar: BAR,
	line: LINE,
	radius: RADIUS,
	tintStrength: TSTR,
	photoDim: PDIM,
	patternSize: PSIZE,
	patternStrength: PSTR,
	patternInk: PINK,
	contentWidth: CWIDTH,
	pattern: PATTERN,
	loginBg: LOGIN_BG,

	tokenOk,

	matchesSavedDefault, saveSettings, saveAsDefault, resetToSaved, resetToBuiltin
});
