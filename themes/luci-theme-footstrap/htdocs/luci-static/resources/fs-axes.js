'use strict';
'require baseclass';
'require rpc';
'require fs-prefs as prefs';
'require fs-fit as fit';

/* fs-axes — the nineteen Appearance axes and the Save-as-default machinery.
 *
 * Split out of fs-prefs.js for one reason: WHERE it is needed. `fs-prefs` is required by the
 * chrome, the menu and the search palette, so it is fetched on every admin page — and of its
 * sixty-one exports the cold path called eight. Everything here is reached only from
 * `fs-appearance` (the form) and `fs-assets` (the two uploads), both page modules, so the router
 * fetches it on the Appearance page and nowhere else. Measured: 6.6 KB off what every page
 * downloads.
 *
 * What stayed behind in `fs-prefs`, and why:
 *   - the localStorage wrappers and `sd()`, which everything here calls through `prefs.`
 *   - dark mode, because `guardDarkStamp` defends against a third-party app on every page and
 *     `tools/chrome-fence.mjs` holds `stampDark()` to that file by path
 *   - layout, density, rail and auto-collapse, because the chrome and the menu apply them live —
 *     and because `tools/scroll-anchor.mjs` and `tools/scroll-jank.mjs` stamp layout and density
 *     through `L.require('fs-prefs')` to sweep their matrix
 *
 * The pre-paint in head.ut has already stamped every axis before the first frame, so nothing here
 * is needed to PAINT a page correctly — only to change one from the form. tools/axes.mjs reads the
 * whole resources directory rather than a path, precisely so an axis may live in a second file. */

const FS_RADIUS_DEFAULT = 12;

const FS_HEX_RE = /^#[0-9a-f]{6}$/i;
/* 0 | 1..360 | '#rrggbb', from anything: localStorage (always a string), the router default (a uci
 * string, or a number from a config written before the axes took colours) or a caller. Anything
 * unrecognised reads as off, the built-in default. */
function normColor(v) {
	if (typeof v === 'number') return (v >= 1 && v <= 360) ? v : 0;
	if (typeof v !== 'string') return 0;
	const s = v.trim();
	if (FS_HEX_RE.test(s)) return s.toLowerCase();
	const h = parseInt(s, 10);
	return (h >= 1 && h <= 360) ? h : 0;
}
function colorAxis(key, attr, hueProp, colorProp) {
	/* 'fs-tint' -> 'tint', the window.__fsSD field. Every colour key is one word today, so the
	 * hyphen fold changes nothing; it is here because the failure when one is not would be silent
	 * (see enumAxis). */
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
			} else if (typeof v === 'number') {
				root.style.removeProperty(colorProp);
				/* the hue first, then the attribute that switches the rotation on: the other
				 * order paints one frame in the previous colour on a fresh load */
				root.style.setProperty(hueProp, String(v));
				root.setAttribute(attr, 'hue');
			} else {
				root.style.removeProperty(hueProp);
				root.style.setProperty(colorProp, v);
				root.setAttribute(attr, 'hex');
			}
		}
	};
}

/* A numeric slider axis that sets an inline custom property and no attribute. Each validates to
 * [min,max], stores the choice explicitly (including the default, so it overrides a router default)
 * and removes the property AT the default, so 02-tokens' own value shows through; they differ only
 * in how the number formats onto the property, which is the one varying argument. The prefs.sd() field
 * name is passed explicitly because one instance needs a rename rather than a spelling
 * ('fs-radius' -> rounding), and a factory right for four keys out of five is the trap enumAxis and
 * colorAxis name above.
 *
 * `after`, like listAxis's, is optional and runs once the property is set: every propAxis instance
 * but Content width only repaints a rule that reads the token, so none of the other five pass it.
 * Content width moves --fs-content-max, which shellGeometry() (fs-chrome.js) reads to decide
 * data-narrow, so its applier must re-run the fit or the chrome goes on deciding against the width
 * the column had a moment ago. */
function propAxis(key, sdKey, prop, min, max, dfl, fmt, after) {
	const inRange = (n) => (typeof n === 'number' && n >= min && n <= max);
	const def = () => { const d = prefs.sd(sdKey); return inRange(d) ? d : dfl; };
	return {
		def,
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
 * value, defined in styles/03-palettes.css.
 *
 * Not the enumAxis shape, which has one `on` name and reads every other stored string — including a
 * real palette — as the default. The array is what VALIDATES a stored value: a name added to the
 * CSS and not here is one head.ut pre-paints and the live applier then rejects, so the page paints
 * it and the first touch of any other control takes it away.
 *
 * Legacy names ('rvht'/'roman'/'github') are migrated by head.ut before paint, so they never reach
 * currentPalette() on a loaded page; the stray fallthrough covers them anyway. */

const PALETTES = [ 'hicontrast', 'bootstrap', '2020', 'forum' ];	/* the non-default values; 'footstrap' = bare :root */
const PALETTE = prefs.listAxis('fs-palette', 'data-palette', PALETTES, 'footstrap');
const currentPalette = PALETTE.current, applyPalette = PALETTE.apply;

/* Wallpaper is a multi-value axis: off (bare canvas), pattern (the admin-uploaded SVG, tiled and
 * recoloured — 15-wallpaper.css) or file (the admin-uploaded photo, 16-login-bg.css).
 * data-wallpaper carries the value, or is absent for 'off'. Both images are router-side; this axis
 * only decides whether THIS browser paints one, so a router-wide backdrop comes from
 * Save-as-default, including the pre-login page.
 *
 * The list validates a stored value, so adding one means this line, the head.ut whitelist, the
 * Wallpaper select in fs-appearance.js and the rules in 15-wallpaper.css. A value that is no longer
 * in the list falls back to 'off'. */
const WALLPAPERS = [ 'pattern', 'file' ];		/* the non-off values; 'off' = bare :root */
const WALLPAPER = prefs.listAxis('fs-wallpaper', 'data-wallpaper', WALLPAPERS, 'off');
const currentWallpaper = WALLPAPER.current, applyWallpaper = WALLPAPER.apply;

/* Density: how much air the UI uses. A three-value axis like wallpaper, and a pure token axis —
 * 02-tokens.css multiplies the type and space ladders and every size follows, with no layout switch
 * and no re-render.
 *
 * Beyond stamping the attribute it must re-run the measured decisions (fitChrome, fitTables,
 * fitShell), which were taken against the old metrics: Compact makes more fit and Large less, so
 * otherwise the bar stays stacked — or stays unstacked and overflows — until the next resize. */

const TINT = colorAxis('fs-tint', 'data-tint', '--fs-tint-h', '--fs-bg');
const currentTint = TINT.current, applyTint = TINT.apply;

/* Accent axis: the UI accent (solid buttons, toggle knobs, sliders, focus rings, accented links)
 * while canvas, cards and status colours stay put. On a hue, CSS rotates --fs-accent and keeps the
 * palette's lightness and chroma, so --fs-on-accent stays legible unrecomputed; on a hex the ink is
 * recomputed from the entered colour's lightness (03-palettes.css). 0 = off. */
const ACCENT = colorAxis('fs-accent', 'data-accent', '--fs-accent-h', '--fs-accent');
const currentAccent = ACCENT.current, applyAccent = ACCENT.apply;

/* The three status colours are the same axis pointed at --fs-good / --fs-warn / --fs-danger, kept
 * separate because they carry separate meanings and every derived tint is a color-mix() of the
 * role, so each follows its own axis. They are not protected from recolouring: a status colour is
 * information, and an admin who paints Danger green has said so. What the theme owes them is
 * readable ink over the fill (03-palettes.css) and the contrast readout beside each field. */
/* ---- the surface axes: the sheet the UI is drawn on, rather than the marks on it ----
 *
 * The cards, the chrome, the inset controls and the hairlines. Their own factory rather than four
 * more colorAxis instances, because:
 *
 *   - there is no hue mode — rotating the hue of a near-white card keeps its chroma (~0.003), so
 *     every angle produces the same white. The Tint axis colours a surface by SETTING a chroma;
 *   - there is no derived ink — what reads on these is --fs-text, a palette token these axes must
 *     not move, so the Appearance page reports the contrast instead;
 *   - they therefore need no attribute: an inline custom property on :root is the whole mechanism,
 *     and every derived token follows because each is a color-mix() of the one this sets. That is
 *     why --fs-bar-bg is a surface of its own — an admin who wants a dark chrome over light cards
 *     has to be able to say so.
 *
 * Off is prefs.lsSet('0'), not a deleted key: once a router default exists, clearing means "inherit
 * it". */

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
const currentCard = CARD.current, applyCard = CARD.apply;
const CONTROL = surfaceAxis('fs-control', 'control', '--fs-panel2-base');
const currentControl = CONTROL.current, applyControl = CONTROL.apply;
const BAR = surfaceAxis('fs-bar', 'bar', '--fs-bar-bg');
const currentBar = BAR.current, applyBar = BAR.apply;
const LINE = surfaceAxis('fs-line', 'line', '--fs-border-base');
const currentLine = LINE.current, applyLine = LINE.apply;


const GOOD = colorAxis('fs-good', 'data-good', '--fs-good-h', '--fs-good');
const currentGood = GOOD.current, applyGood = GOOD.apply;
const WARN = colorAxis('fs-warn', 'data-warn', '--fs-warn-h', '--fs-warn');
const currentWarn = WARN.current, applyWarn = WARN.apply;
const DANGER = colorAxis('fs-danger', 'data-danger', '--fs-danger-h', '--fs-danger');
const currentDanger = DANGER.current, applyDanger = DANGER.apply;

/* Rounding: the propAxis instance (default const and rationale up top), --fs-radius-base in px. */
const RADIUS = propAxis('fs-radius', 'rounding', '--fs-radius-base', 0, 20, FS_RADIUS_DEFAULT, (v) => (v + 'px'));
const currentRadius = RADIUS.current, applyRadius = RADIUS.apply, radiusDefault = RADIUS.def;

/* Content width (issue #44): how far the reader lets the column grow past --fs-content-max's own
 * 1280px. A propAxis like Rounding, pointed at that one token — the range comment lives in
 * 02-tokens.css, next to the token it bounds, and is not restated here.
 *
 * The one propAxis instance that moves chrome geometry: shellGeometry() (fs-chrome.js) reads
 * --fs-content-max on every fit, so dragging the slider must re-run it through the SAME
 * fit.schedule() every other geometry-affecting axis calls, or the sidebar goes on folding at the
 * width the column had before the drag. */
const FS_CWIDTH_DEFAULT = 1280;
const CWIDTH = propAxis('fs-content-width', 'content_width', '--fs-content-max', 1280, 3840,
	FS_CWIDTH_DEFAULT, (v) => (v + 'px'), () => fit.schedule());
const currentContentWidth = CWIDTH.current, applyContentWidth = CWIDTH.apply, contentWidthDefault = CWIDTH.def;

/* Layout axis: horizontal top bar (the default) vs vertical sidebar. One template, one renderer —
 * CSS morphs the chrome off :root[data-layout] and toggling re-renders nothing; menu-footstrap.js
 * observes the attribute and folds the accordion into dropdowns or restores it.
 *
 * Read the ATTRIBUTE, not localStorage: head.ut stamps it server-side from the router default and
 * the pre-paint script overrides it, so it always carries an explicit value. localStorage would
 * report 'sidebar' on a router defaulting to 'top' until the user first touched the toggle. */

const AXIS_KEYS = [
	'fs-layout', 'fs-darkmode', 'fs-palette', 'fs-wallpaper', 'fs-tint',
	'fs-accent', 'fs-good', 'fs-warn', 'fs-danger', 'fs-card', 'fs-control',
	'fs-bar', 'fs-line', 'fs-radius', 'fs-menu-autocollapse', 'fs-tint-strength',
	'fs-density', 'fs-photo-dim', 'fs-pattern-size', 'fs-pattern-strength',
	'fs-pattern-ink', 'fs-content-width'
];
/* Tint strength: a multiplier on the tint chroma (03-palettes.css), 100% being the designed
 * strength and 200% the cap. 0 is not quite "no tint" — the relative colour that applies the tint
 * replaces chroma outright, so 0 leaves a neutral canvas at the same lightness rather than the
 * untinted one; clearing the Tint hue is the real off. It only bites while a Tint hue is set, and
 * is moot under the File wallpaper, where the photo covers the canvas.
 *
 * This axis and its default live above _resolvedDefault()'s module-init call below: a propAxis
 * instance is a `const`, so declaring it further down leaves it in the TDZ at init and the whole
 * module throws, taking the chrome and the menu with it. */
const FS_TSTR_DEFAULT = 100;
const TSTR = propAxis('fs-tint-strength', 'tint_strength', '--fs-tint-strength', 0, 200, FS_TSTR_DEFAULT, (v) => String(v / 100));
const currentTintStrength = TSTR.current, applyTintStrength = TSTR.apply, tintStrengthDefault = TSTR.def;

/* Photo dim: the scrim opacity over the FILE photo (0–100%). The photo is shared; how strongly
 * this browser dims it is not, and it reaches the router through Save-as-default. Only bites while
 * the wallpaper is 'file'. Declared up here for the TDZ reason above. */
const FS_PDIM_DEFAULT = 74;
const PDIM = propAxis('fs-photo-dim', 'photo_dim', '--fs-photo-dim', 0, 100, FS_PDIM_DEFAULT, (v) => (v + '%'));
const currentPhotoDim = PDIM.current, applyPhotoDim = PDIM.apply, photoDimDefault = PDIM.def;

/* The pattern's two live knobs, and the third that is an enum. All three bite only while the
 * wallpaper is 'pattern'; the FILE is shared, how this browser draws it is not.
 *
 * Size is the tile's edge in px, with a wide range because "how big is one repeat" is a property of
 * the artwork. Strength is the layer's opacity 0-100, which is the knob a `<g opacity>` baked into
 * the file would put out of CSS's reach. Declared up here for the TDZ reason above. */
const FS_PSIZE_DEFAULT = 440;
const PSIZE = propAxis('fs-pattern-size', 'pattern_size', '--fs-pattern-size', 40, 1600, FS_PSIZE_DEFAULT, (v) => (v + 'px'));
const currentPatternSize = PSIZE.current, applyPatternSize = PSIZE.apply, patternSizeDefault = PSIZE.def;
const FS_PSTR_DEFAULT = 20;
const PSTR = propAxis('fs-pattern-strength', 'pattern_strength', '--fs-pattern-strength', 0, 100, FS_PSTR_DEFAULT, (v) => String(v / 100));
const currentPatternStrength = PSTR.current, applyPatternStrength = PSTR.apply, patternStrengthDefault = PSTR.def;
/* Ink: 'theme' (the file's alpha, the theme's colour) or 'original' (the file's own colours, no
 * mask). Two-valued with the default as a bare :root, i.e. the enumAxis shape. */
const PINK = prefs.enumAxis('fs-pattern-ink', 'data-pattern-ink', 'original', 'theme');
const currentPatternInk = PINK.current, applyPatternInk = PINK.apply;
/* `reject: true` is load-bearing: without it a refused write arrives as SUCCESS. rpc.js raises on
 * the ubus status code only when the declaration asks it to, and otherwise hands the code back as
 * the resolved value — measured on the router, a per-config ACL refusal resolves with 6
 * (permission denied) and every `.then()` below runs as if the file had been written, greying the
 * Save button over a write that never happened. */

const _uciSet = rpc.declare({ object: 'uci', method: 'set', params: [ 'config', 'section', 'values' ], reject: true });
const _uciCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ], reject: true });

function snapshotAxes() {
	return {
		layout: prefs.currentLayout(),
		darkmode: prefs.currentMode(),
		palette: currentPalette(),
		wallpaper: currentWallpaper(),
		tint: String(currentTint()),
		accent: String(currentAccent()),
		good: String(currentGood()),
		warn: String(currentWarn()),
		danger: String(currentDanger()),
		card: String(currentCard()),
		control: String(currentControl()),
		bar: String(currentBar()),
		line: String(currentLine()),
		rounding: String(currentRadius()),
		autocollapse: prefs.currentAutoCollapse() ? 'on' : 'off',
		tint_strength: String(currentTintStrength()),
		density: prefs.currentDensity(),
		photo_dim: String(currentPhotoDim()),
		pattern_size: String(currentPatternSize()),
		pattern_strength: String(currentPatternStrength()),
		pattern_ink: currentPatternInk(),
		content_width: String(currentContentWidth())
	};
}
/* The resolved router default (the uci value if set, else the built-in) in snapshotAxes() string
 * form, so the Appearance page can grey the Save button when this browser already shows exactly it.
 * Seeded from window.__fsSD at load and replaced with the just-saved snapshot, so a save flips the
 * match without a reload.
 *
 * Every field is the axis's own def(): a second copy of a validation drifts with no symptom beyond
 * matchesSavedDefault() lying, which is the one thing the Save button is. `layout` is the exception,
 * since prefs.currentLayout() reads the attribute — its fallback must stay `top`, matching head.ut's
 * stamp and resetToBuiltin(), or a fresh install shows dirty before anything is touched and
 * resetToSaved() lands on the wrong layout. */
function _resolvedDefault() {
	return {
		layout: prefs.sd('layout') || 'top',
		darkmode: prefs.modeDefault(),
		palette: PALETTE.def(),
		wallpaper: WALLPAPER.def(),
		tint: String(TINT.def()),
		accent: String(ACCENT.def()),
		good: String(GOOD.def()),
		warn: String(WARN.def()),
		danger: String(DANGER.def()),
		card: String(CARD.def()),
		control: String(CONTROL.def()),
		bar: String(BAR.def()),
		line: String(LINE.def()),
		rounding: String(radiusDefault()),
		autocollapse: (prefs.autoCollapseDefault() ? 'on' : 'off'),
		tint_strength: String(tintStrengthDefault()),
		density: prefs.densityDefault(),
		photo_dim: String(photoDimDefault()),
		pattern_size: String(patternSizeDefault()),
		pattern_strength: String(patternStrengthDefault()),
		pattern_ink: PINK.def(),
		content_width: String(contentWidthDefault())
	};
}
let _savedDefault = _resolvedDefault();
function matchesSavedDefault() {
	const cur = snapshotAxes();
	return Object.keys(cur).every((k) => cur[k] === _savedDefault[k]);
}

/* ---- no axis reaches /etc/config/footstrap except through Save-as-default ----
 * Every axis is per-browser. An axis that wrote through on change — on the argument that the photo
 * it relates to is router-side — re-pointed the router-wide default for every other device from one
 * browser, and moved the Save baseline with it, so the button did not even light up. A per-browser
 * preference must never mutate shared state invisibly.
 *
 * Only the photo's bytes and its cache-bust token are router-side. Whether a browser paints it is
 * `fs-wallpaper` and how dim is `fs-photo-dim`: ordinary axes, saved with the rest or not at
 * all. */
function saveAsDefault() {
	const snap = snapshotAxes();
	return _uciSet('footstrap', 'settings', snap)
		.then(() => _uciCommit('footstrap'))
		.then(() => { _savedDefault = snap; });
}
/* ---- the two resets, which are not the same escape hatch ----
 *
 * Both drop this browser's tweaks and differ in what is underneath:
 *
 *   resetToSaved()    clears the keys, so every axis falls back to the router default where one is
 *                     set and to the built-in where it is not. The browser goes back to inheriting.
 *   resetToBuiltin()  writes the theme's own defaults explicitly, the only way to say "as the theme
 *                     ships" — clearing the keys is the sentence that means "inherit the router
 *                     default".
 *
 * Both leave /etc/config/footstrap alone: neither un-saves a router default.
 *
 * The caller reloads so head.ut re-applies everything in one pass — the appliers repaint correctly,
 * but the controls on the page were built from the values they had at render time. */
function resetToSaved() {
	AXIS_KEYS.forEach(prefs.lsDel);
}

/* The built-in defaults, written through the ordinary appliers so each validates its own value and
 * stamps :root as usual. Stated rather than derived: a default is a default because it is what a
 * bare :root paints, and the five with a named const use it, so the numbers cannot drift from the
 * CSS. */
function resetToBuiltin() {
	/* `top` for layout, not sidebar: the bar is what a bare :root paints (head.ut stamps it when uci
	 * says nothing), so it is what "as the theme ships" means. The colour and surface axes reset to
	 * 0, which is "the palette's own".
	 *
	 * Stated as calls rather than carried in AXES: a fourth column of thunks measured 297 B against
	 * this list, and a wrong value here is what the Save button's "Reset to built-in" shows on the
	 * first click — the one state no static gate can see and the live check does. */
	prefs.applyLayout('top');
	prefs.applyMode('auto');
	applyPalette('footstrap');
	applyWallpaper('off');
	applyTint(0);
	applyAccent(0);
	applyGood(0);
	applyWarn(0);
	applyDanger(0);
	applyCard(0);
	applyControl(0);
	applyBar(0);
	applyLine(0);
	applyRadius(FS_RADIUS_DEFAULT);
	prefs.applyAutoCollapse('off');
	applyTintStrength(FS_TSTR_DEFAULT);
	prefs.applyDensity('normal');
	applyPhotoDim(FS_PDIM_DEFAULT);
	applyPatternSize(FS_PSIZE_DEFAULT);
	applyPatternStrength(FS_PSTR_DEFAULT);
	applyPatternInk('theme');
	applyContentWidth(FS_CWIDTH_DEFAULT);
}

/* ---- the two uploaded wallpapers, browser side ----
 *
 * What the router last saved, what URL that is, and how to paint it. Putting the file THERE is
 * fs-assets.js: a DOMParser pass, a canvas re-encode, a chmod and a rollback, reached only from the
 * Appearance page and so not worth downloading on every admin page. The token accessors stay here
 * because `prefs.sd()` is private to this module and because head.ut's pre-paint reads the same fields.
 *
 * Neither is an axis: an axis is per-browser with a router default, and these have no browser
 * layer — one admin uploads once and every device sees it, pre-login included. So they are absent

 * from AXIS_KEYS, snapshotAxes() and matchesSavedDefault(), and must not move the Save button. */
/* NOT a /www symlink, unlike BG_SERVE below: an SVG served as a plain static file is a same-origin
 * document that runs script opened directly (OpenWrt forum thread 251930). This CGI handler reads
 * the fixed /etc/footstrap/pattern.svg path itself and answers with CSP 'none' + sandbox and
 * nosniff, headers uhttpd cannot attach to a static file — see the uci-default and the handler for
 * the rest of the reasoning. Painting stays exactly as before: a URL is a URL to a mask-image. */
const PAT_SERVE = '/cgi-bin/luci-theme-footstrap-pattern';
function currentPattern() {
	const t = prefs.sd('pattern');
	return (typeof t === 'string' && BG_TOKEN_RE.test(t)) ? t : '';
}
function patternUrl(tok) { return PAT_SERVE + '?v=' + tok; }

/* set/clear the tile URL live. This only supplies the url(); whether it PAINTS is the Wallpaper
 * axis (data-wallpaper="pattern"). Exported because fs-assets.js applies the token it just wrote. */
function applyPattern(tok) {
	const root = document.documentElement;
	if (tok) root.style.setProperty('--fs-pattern-url', 'url("' + patternUrl(tok) + '")');
	else root.style.removeProperty('--fs-pattern-url');
	prefs.setSD('pattern', tok || '');
}

/* Still the plain uhttpd symlink the uci-default makes, unlike PAT_SERVE above: fs-assets.js
 * re-encodes every login-bg upload to a JPEG on a canvas before it is sent, so the stored bytes
 * are pixels only — there is no script grammar left in a raster for a direct hit to run. */
const BG_SERVE = '/luci-static/footstrap/bg';
/* the cache-bust token charset, an md5/sha hex string. One copy here; head.ut's ucode sanitiser
 * and the pre-paint inline script keep their own identical copies unavoidably, running before this
 * module — see the axes contract in head.ut. */
const BG_TOKEN_RE = /^[a-f0-9]{6,64}$/;
/* the same question asked from fs-assets.js, which validates the checksum an upload replies with.
 * A predicate rather than the pattern itself, so the charset stays stated once. */
function tokenOk(t) { return BG_TOKEN_RE.test(t); }

/* the token the server last saved, validated to the same hex charset head.ut's sanitiser and
 * pre-paint use, so the Appearance page can build a cache-busted preview src. '' = none. */
function currentLoginBg() {
	const t = prefs.sd('login_bg');
	return (typeof t === 'string' && BG_TOKEN_RE.test(t)) ? t : '';
}
function loginBgUrl(tok) { return BG_SERVE + '?v=' + tok; }

/* applyPattern's twin for the photo; data-wallpaper="file" decides whether it paints. */
function applyLoginBg(tok) {
	const root = document.documentElement;
	if (tok) root.style.setProperty('--fs-login-bg-url', 'url("' + loginBgUrl(tok) + '")');
	else root.style.removeProperty('--fs-login-bg-url');
	prefs.setSD('login_bg', tok || '');
}

return baseclass.extend({
	currentPalette, applyPalette,
	currentWallpaper, applyWallpaper,
	currentTint, applyTint,
	currentAccent, applyAccent,
	currentGood, applyGood,
	currentWarn, applyWarn,
	currentDanger, applyDanger,
	currentCard, applyCard,
	currentControl, applyControl,
	currentBar, applyBar,
	currentLine, applyLine,
	currentRadius, applyRadius,
	currentTintStrength, applyTintStrength,
	currentPhotoDim, applyPhotoDim,
	currentPatternSize, applyPatternSize,
	currentPatternStrength, applyPatternStrength,
	currentPatternInk, applyPatternInk,
	currentContentWidth, applyContentWidth, contentWidthDefault,

	currentPattern, patternUrl, applyPattern,
	currentLoginBg, loginBgUrl, applyLoginBg,
	tokenOk,

	snapshotAxes, matchesSavedDefault, saveAsDefault, resetToSaved, resetToBuiltin
});
