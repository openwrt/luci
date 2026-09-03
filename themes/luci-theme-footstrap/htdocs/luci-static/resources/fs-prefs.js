'use strict';
'require baseclass';
'require rpc';
'require fs-fit as fit';

/* The Appearance axes THIS file owns (the controls that present them are fs-appearance.js, which
 * appends a tab to the stock System -> System page — a theme owns no dispatcher node, see that
 * file's header). The twenty-one are exactly the keys in AXIS_KEYS and the fields in
 * snapshotAxes(), which is the list Save-as-default writes — if this number and that list
 * disagree, the list is right.
 * All client-side, instant, persisted in localStorage —
 * no server, no reload — and head.ut's inline script re-applies them before paint, so a reload never
 * flashes the wrong one; tools/axes.mjs holds those two copies to one contract, and it derives that
 * contract from THIS file.
 *
 * ---- three layers, and the browser always wins ----
 * The effective value of every axis is  localStorage ?? router-default ?? built-in.  The router
 * default is Appearance -> Save as default (saveAsDefault below, written to /etc/config/footstrap
 * and read back by the server into window.__fsSD); the built-in is a bare :root. So a NEW browser,
 * incognito, or a cleared cache inherits the router default, but THIS browser's own choice — stored
 * EXPLICITLY, see the next paragraph — overrides it, in either direction.
 *
 * ---- every applier stores its choice EXPLICITLY, and that is load-bearing ----
 * Once a router default exists, "clear the key" no longer means "the built-in default" — it means
 * "inherit whatever the router default is". So an applier that lsDel-ed on the default value could
 * not express "I want the built-in, NOT the router default" (you could not turn a router-defaulted
 * tint back off). Every axis therefore records the chosen value, including the off/default one, the
 * way `layout` always has. lsDel is reserved for resetToSaved(), which drops back to the router
 * default on purpose. */
/* A browser can REFUSE storage outright — "block all cookies" for this address in Chrome/Safari,
 * dom.storage.enabled=false in Firefox, a partitioned WebView — and then every access throws. The
 * three helpers below still swallow it, because an axis that cannot be remembered must still be
 * allowed to APPLY; what they no longer do is keep quiet about it. Without this flag the page told a
 * flat lie: each control took effect, nothing was written, current*() then read null and fell back
 * to the router default, so matchesSavedDefault() was true and the Save button sat there DISABLED
 * reading "Saved as default" while the page was painted in three axes the router default does not
 * carry — and a reload dropped all of them. The Appearance tab asks this and says so once. */
let _lsBroken = false;
function storageBroken() { return _lsBroken; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { _lsBroken = true; return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { _lsBroken = true; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { _lsBroken = true; } }

/* A stored JSON ARRAY, or [] — the shape the two REMEMBERED LISTS use (the search palette's recent
 * paths, the menu's open sections). lsGet above owns the try/catch around localStorage itself; this
 * one is for JSON.parse over a value another tab may have corrupted, and for the Array guard that
 * stops a stored object or string being spread into a list. Both callers had written the identical
 * five lines, comment included; each still applies its own post-step (filter to strings / build a
 * Set), which is the part that genuinely differs. */
function lsGetArr(k) {
	try {
		const a = JSON.parse(lsGet(k) || '[]');
		return Array.isArray(a) ? a : [];
	} catch (e) { return []; }
}

/* the router-wide defaults the server stamped (head.ut). Read at RUNTIME so current*() reports the
 * effective default when this browser has no localStorage — the Appearance tab's controls then show what
 * the page is actually painted as, not a phantom "auto". */
function sd(k) { try { return (window.__fsSD || {})[k]; } catch (e) { return undefined; } }

/* …and the write back. An applier that persists to the router must update the blob the SERVER
 * stamped, or current*() would keep reporting the OLD router default until the next full load —
 * matchesSavedDefault() then lies about whether there is anything left to save. Three appliers did
 * this with the same guarded one-liner; the guard is for a document where `window` is locked down,
 * exactly like sd() above. */
function setSD(field, val) { try { (window.__fsSD = window.__fsSD || {})[field] = val; } catch (e) {} }

/* ---- every axis owns its ROUTER DEFAULT, and nothing else may restate it ----
 * `def()` is the sd() branch of current() alone — what the effective value would be with no
 * localStorage. It is exposed because _resolvedDefault() needs exactly that branch and used to
 * spell each one out a second time: two copies of the SAME validation, and the drift has no
 * symptom. Disagree, and matchesSavedDefault() lies about the one thing the Save button IS —
 * its own status (see there): it greys when there is something to save, or never greys at all,
 * and nothing else in the UI would contradict it. */
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
/* ---- dark mode is announced in three dialects, because apps SNIFF for it ----
 *
 * An app with its own dark styles has to guess whether the page is dark, and there is no standard:
 * apps read `data-theme="dark"` on :root (luci-app-justclash keys 21 rules off it), Bootstrap's
 * `data-bs-theme` (luci-app-ssclash), or, failing both, the LUMINANCE of the body background
 * (ssclash's fallback). Stamp all three for the same fact: before this, every one of justclash's
 * [data-theme="dark"] rules was dead, so a dark page rendered its LIGHT fills.
 *
 * `data-darkmode` is the name the theme's OWN CSS keys off. The other two are OUTBOUND
 * compatibility, like the `--*-color-*` export tier: nothing in `styles/` may read them, and
 * tools/axes.mjs fails the build if it does. */
function stampDark(root, dark) {
	root.setAttribute('data-darkmode', dark ? 'true' : 'false');
	root.setAttribute('data-theme', dark ? 'dark' : 'light');
	root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
}

const _mqDark = window.matchMedia('(prefers-color-scheme: dark)');

/* The one expression for "is this page dark right now", so the applier, the OS listener and the
 * guard below cannot disagree about it — and all three really do call it now. Only the guard did:
 * the other two spelled the same condition out again, which is the drift this exists to prevent,
 * sitting three lines under a comment claiming it could not happen. */
function intendedDark() {
	const m = currentMode();
	return m === 'dark' || (m === 'auto' && _mqDark.matches);
}

function applyMode(val) {
	const root = document.documentElement;
	/* 'auto' is stored EXPLICITLY (not lsDel), so it overrides a router default of dark/light —
	 * otherwise a router defaulted to dark could never be set back to "follow the OS" here. */
	if (val === 'auto') lsSet('fs-darkmode', 'auto');
	else lsSet('fs-darkmode', val === 'dark' ? 'true' : 'false');
	/* AFTER the store, so intendedDark() reads the choice just made — which is what lets the one
	 * expression serve here too, instead of a second copy spelled in terms of `val`. */
	stampDark(root, intendedDark());
}

/* ---- the three dialects are PUBLISHED, so third parties write them too ----
 *
 * Announcing dark mode in a vocabulary apps understand is what makes them follow the page — and it
 * is exactly why an app reaches for the same attribute. `luci-app-openclash` stamps
 * `data-darkmode="true"` straight onto :root from seven of its templates (config_editor.htm:215,306,
 * select_git_cdn.htm:114, config_edit.htm:259, tblsection.htm:479, sub_info_show.htm:52), gated on
 * its own isDarkBackground() (openclash/js/common.js:12) — which consults
 * `matchMedia('(prefers-color-scheme: dark)')` BEFORE it ever looks at the body's real background.
 *
 * So a user who explicitly chose LIGHT here, on an OS set to dark, gets the whole theme flipped to
 * dark by opening an OpenClash page. Reproduced on the router: data-darkmode false -> true, page
 * background rgb(246,248,250) -> rgb(28,33,40). Their explicit choice, lost, silently, to their OS
 * setting, through someone else's package. select_git_cdn.htm:117's removeAttribute is the mirror
 * hazard: it deletes the attribute head.ut writes as 'false'.
 *
 * No cascade trick can answer this — it is a DOM write, not a rule. So watch the attributes we own
 * and restate the truth. Nothing else is guarded: the other axes (data-layout, data-palette,
 * data-accent, data-tint) are PRIVATE to this theme, no app has a reason to know them, and a survey
 * of ten shipping packages found none that writes any of them. The published trio is the surface
 * precisely because it is published.
 *
 * This does not fight the app's intent, it corrects a wrong premise: when the page really is dark,
 * OpenClash's write AGREES with ours and the guard never fires — the compare is what makes it inert
 * in the common case, and what stops it looping on its own restamp. It also cannot ping-pong: our
 * write produces a mutation, the callback re-runs, the values now match, it returns. */
function guardDarkStamp() {
	const root = document.documentElement;
	const check = () => {
		const dark = intendedDark();
		if (root.getAttribute('data-darkmode') === (dark ? 'true' : 'false') &&
			root.getAttribute('data-theme') === (dark ? 'dark' : 'light') &&
			root.getAttribute('data-bs-theme') === (dark ? 'dark' : 'light')) return;
		stampDark(root, dark);
	};
	/* An app's inline <script> runs while its template is still being parsed — long before this
	 * module is fetched — so by now the attribute can already be wrong. Observing alone would never
	 * see that mutation: check first, then watch. */
	check();
	new MutationObserver(check).observe(root, {
		attributes: true,
		attributeFilter: ['data-darkmode', 'data-theme', 'data-bs-theme']
	});
}
/* "Auto" means follow the OS — it only did so at page load, so an OS flipping to dark on its
 * own schedule left the open page in light until a reload. Only follows when the effective mode
 * is auto: an explicit browser choice, or an explicit router default with no browser override. */
_mqDark.addEventListener('change', () => {
	if (currentMode() === 'auto') {
		const root = document.documentElement;
		stampDark(root, intendedDark());
	}
});
/* Corner radius: the card radius (0–20px) as an inline --fs-radius-base on :root; 02-tokens derives
 * every other radius from it, so surfaces round in step. head.ut pre-paints it, and tools/axes.mjs
 * holds JS/CSS/head to this one number — hence the named const. The axis itself is a propAxis (below),
 * the same shape as tint strength. */
const FS_RADIUS_DEFAULT = 12;

/* ---- the four axis SHAPES, each written once ------------------------------------------------
 *
 * Fifteen of the axes are four shapes, so the shape lives in a factory and each instance is one
 * line: enumAxis (pattern ink), colorAxis (tint, accent, good, warn, danger), surfaceAxis (cards,
 * controls, bar, borders), propAxis (rounding, tint strength, photo dim, pattern size, pattern
 * strength). All keep the same
 * contract: `current()` is localStorage ?? def(), `def()` is the router default alone, `apply()`
 * stores the choice EXPLICITLY (see the header — lsDel would mean "inherit the router default", which
 * is not what picking the built-in means). None use `this`: every export below is a DETACHED method
 * reference (`const currentTint = TINT.current`), and a `this` in here would throw the moment one was
 * called.
 *
 * Each factory takes its localStorage key as the FIRST argument, and tools/axes.mjs matches the call
 * by its literal args — that scan is how a key reaches the gate at all, since an axis built by a
 * factory has no lsGet('fs-…') call site to find.
 *
 * The remaining axes stay separate; each has a quirk a shared table would need an option for.
 * `mode` stores a value it does not apply (tri-state → matchMedia) and owns an MQL listener; `layout`
 * reads the ATTRIBUTE (the server-migrated default); `wallpaper` and `density` are three-valued;
 * `palette` outgrew the two-value shape when the third one landed; `autoCollapse` has no :root
 * attribute at all. */

/* A two-value axis: `on` is stamped as the attribute's VALUE, `off` is a bare :root (no attribute).
 * Palette and wallpaper were this shape twice over — current() and apply() agreed line for line
 * down to the stray-value fallthrough, and the two halves of `palette` had already drifted APART in
 * the file (current() at the top, apply() 100 lines below). */
function enumAxis(key, attr, on, off) {
	/* 'fs-pattern-ink' -> 'pattern_ink', the window.__fsSD field. The UNDERSCORE is the whole
	 * point: the localStorage key is hyphenated and the uci option is not, so a bare slice(3)
	 * answered 'pattern-ink' — a field head.ut never emits — and sd() returned undefined forever.
	 * The axis then reports the BUILT-IN default no matter what the router saved: the Ink control
	 * shows Theme while head.ut has already pre-painted Original, matchesSavedDefault() is false
	 * with nothing touched, and pressing Save-as-default writes the built-in over the admin's
	 * value. Nothing catches it — see the same trap named in propAxis below, which is why THAT
	 * factory takes the field name explicitly. */
	const sdKey = key.slice(3).replace(/-/g, '_');
	const def = () => (sd(sdKey) === on ? on : off);
	return {
		def,
		current() {
			const s = lsGet(key);
			if (s === on) return on;
			if (s === off) return off;
			if (s === null) return def();
			return off;		/* a stray value reads as the built-in default */
		},
		apply(val) {
			const root = document.documentElement;
			const isOn = (val === on);
			lsSet(key, isOn ? on : off);
			if (isOn) root.setAttribute(attr, on);
			else root.removeAttribute(attr);
		}
	};
}

/* A COLOUR axis. Five of them — Tint (the canvas), Accent (the UI colour) and the three status
 * colours Good/Warn/Danger — are one axis pointed at five tokens: same validation, same "0 is off",
 * same off path, same load-bearing ORDERING rule (set the custom property BEFORE the attribute, or
 * a fresh load paints one frame in the previous colour). That rule is exactly what gets fixed in one
 * copy and not the other, so it lives here once.
 *
 * A value is one of THREE things, and the attribute's value says which (03-palettes.css matches on
 * it):
 *
 *   0            off — no attribute, the palette exactly as it shipped.
 *   1–360        a HUE, set with the slider: CSS rotates the palette's own colour through
 *                oklch(from … l c H), so lightness and chroma — and therefore every contrast
 *                margin the palette was measured at — are the palette's, not the user's.
 *   '#rrggbb'    a COLOUR, typed or picked in the colour field: stamped inline on :root as the live
 *                token, exactly as entered. The ink over it is derived from its lightness in CSS.
 *
 * Both live in ONE localStorage key rather than a colour key beside a hue key, because they are one
 * question with two ways of answering it: two keys would need a third to say which is in effect, and
 * that third is the one a pre-paint script forgets. `hueProp` carries the degrees for the rotation,
 * `colorProp` is the live token a hex value overwrites; a hue value clears the second and a hex
 * value clears the first, so the two modes can never both be half-applied. */
const FS_HEX_RE = /^#[0-9a-f]{6}$/i;
/* 0 | 1..360 | '#rrggbb', from anything — localStorage (always a string), the router default (a
 * uci string, or a NUMBER from a config written before the axes took colours) or a caller. Anything
 * unrecognised reads as off, which is the built-in default and the one safe answer. */
function normColor(v) {
	if (typeof v === 'number') return (v >= 1 && v <= 360) ? v : 0;
	if (typeof v !== 'string') return 0;
	const s = v.trim();
	if (FS_HEX_RE.test(s)) return s.toLowerCase();
	const h = parseInt(s, 10);
	return (h >= 1 && h <= 360) ? h : 0;
}
function colorAxis(key, attr, hueProp, colorProp) {
	/* 'fs-tint' -> 'tint', the window.__fsSD field. Every colour key happens to be one word, so
	 * the hyphen fold changes nothing today — it is here because the day one is not, the failure
	 * is silent in both directions (see enumAxis above). */
	const sdKey = key.slice(3).replace(/-/g, '_');
	const def = () => normColor(sd(sdKey));
	return {
		def,
		current() {
			const raw = lsGet(key);
			return (raw !== null) ? normColor(raw) : def();
		},
		apply(val) {
			const root = document.documentElement;
			const v = normColor(val);
			/* stored EXPLICITLY, including 0=off, so dragging to off overrides a router default
			 * colour instead of falling back to it. */
			lsSet(key, String(v));
			if (!v) {
				root.removeAttribute(attr);
				root.style.removeProperty(hueProp);
				root.style.removeProperty(colorProp);
			} else if (typeof v === 'number') {
				root.style.removeProperty(colorProp);
				/* the hue FIRST, then the attribute that switches the rotation on — the other
				 * order paints one frame in the previous colour on a fresh load. */
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

/* A numeric slider axis that sets an INLINE custom property and NO attribute: rounding (the card
 * radius) and tint strength are the same shape. Both validate to [min,max], store the choice
 * EXPLICITLY — including the default, so it overrides a router default (see the header; lsDel would
 * mean "inherit") — and remove the property AT the default, so 02-tokens' own value shows through.
 * They differ ONLY in how the number formats onto the property (px vs a 0..2 multiplier), so that is
 * the one argument that varies. The sd() field name is passed in explicitly because ONE instance
 * needs a RENAME rather than a spelling: 'fs-radius' -> rounding. The other four would fall out of
 * the same hyphen fold enumAxis and colorAxis do ('fs-tint-strength' -> tint_strength), but a
 * factory that is right for four keys out of five is the trap those two walked into. */
function propAxis(key, sdKey, prop, min, max, dfl, fmt) {
	const inRange = (n) => (typeof n === 'number' && n >= min && n <= max);
	const def = () => { const d = sd(sdKey); return inRange(d) ? d : dfl; };
	return {
		def,
		current() {
			const raw = lsGet(key);
			if (raw !== null) { const v = parseInt(raw, 10); return inRange(v) ? v : dfl; }
			return def();
		},
		apply(n) {
			const root = document.documentElement;
			const v = Math.max(min, Math.min(max, n | 0));
			lsSet(key, String(v));
			if (v === dfl) root.style.removeProperty(prop);
			else root.style.setProperty(prop, fmt(v));
		}
	};
}

/* Palette: footstrap (GitHub colours) is the default = bare :root; every other colourway is an
 * opt-in data-palette value. Colourway blocks live in styles/03-palettes.css.
 *
 * This was the two-valued enumAxis shape while there were exactly two palettes, and stopped being
 * able to express the set the moment a third arrived — an enumAxis has one `on` name and reads
 * EVERY other stored string, including a real palette, as the default. So it is the
 * wallpaper/density shape now: a list of the non-default values, which is what VALIDATES a stored
 * value. A name added to the CSS and not to this array is one head.ut pre-paints and the live
 * applier then rejects — the page paints it and the first touch of any other control takes it
 * away.
 *
 * Legacy 'rvht'/'roman'/'github' are migrated to explicit values by head.ut before paint, so they
 * never reach currentPalette() on a loaded page; the stray fallthrough covers them anyway. */
const PALETTES = [ 'hicontrast', 'bootstrap', '2020' ];	/* the non-default values; 'footstrap' = bare :root */
function paletteDefault() {
	const d = sd('palette');
	return (PALETTES.indexOf(d) >= 0) ? d : 'footstrap';
}
function currentPalette() {
	const s = lsGet('fs-palette');
	if (PALETTES.indexOf(s) >= 0) return s;
	if (s === 'footstrap') return 'footstrap';
	if (s === null) return paletteDefault();
	return 'footstrap';	/* a stray value reads as the built-in default */
}
function applyPalette(val) {
	const root = document.documentElement;
	const v = (PALETTES.indexOf(val) >= 0) ? val : 'footstrap';
	/* stored explicitly (including 'footstrap'), so it overrides a router default — see the header */
	lsSet('fs-palette', v);
	if (v === 'footstrap') root.removeAttribute('data-palette');
	else root.setAttribute('data-palette', v);
}

/* Wallpaper is a MULTI-value axis and its own concern (composes with either palette): off (bare
 * canvas), pattern (the admin-uploaded SVG, tiled and recoloured — 15-wallpaper.css) or file (the
 * admin-uploaded photo, 16-login-bg.css). It is not the enumAxis shape (that is two-valued) —
 * data-wallpaper carries the VALUE or is absent for 'off'. BOTH images are router-side
 * (currentPattern / currentLoginBg below); this axis only decides whether THIS browser paints one,
 * so a router-wide backdrop comes from Save-as-default, including the pre-login page.
 *
 * The list is what VALIDATES a stored value, so a value added to the CSS and not to this array is
 * one head.ut pre-paints and the live applier then rejects: the page would paint it and the first
 * touch of any other control would take it away. Adding one means this line, the head.ut whitelist,
 * the Wallpaper select in fs-appearance.js and the rules in 15-wallpaper.css.
 *
 * A router upgrading from a version with the downloaded `cats`/`dinos` doodles reads its stored
 * value here, finds it is not in the list, and falls to 'off' — the files those named are not in
 * the package and are no longer fetched, so painting them was never an option. */
const WALLPAPERS = [ 'pattern', 'file' ];		/* the non-off values; 'off' = bare :root */
function wallpaperDefault() {
	const d = sd('wallpaper');
	return (WALLPAPERS.indexOf(d) >= 0) ? d : 'off';
}
function currentWallpaper() {
	const s = lsGet('fs-wallpaper');
	if (WALLPAPERS.indexOf(s) >= 0) return s;
	if (s === 'off') return 'off';
	if (s === null) return wallpaperDefault();
	return 'off';		/* a stray value reads as the built-in default */
}

/* Density: how much AIR the UI uses — Compact / Normal / Large. A three-value axis like wallpaper
 * (data-density carries 'compact'|'large', or is absent for the Normal default), and it is a pure
 * TOKEN axis: 02-tokens.css multiplies the type and space ladders by two numbers and every size in
 * the theme follows, because every size reads one of those ladders. Nothing else changes — no
 * layout switch, no re-render.
 *
 * The one thing it must do beyond stamping the attribute is re-run the MEASURED decisions:
 * `fitChrome` (does the menu still fit beside the brand?), `fitTables` (does this table still fit
 * un-carded?) and `fitShell` (is the content column still readable beside the sidebar?) all
 * measured the OLD metrics. Compact makes more fit and Large less, so without this the bar stays
 * stacked — or worse, stays unstacked and overflows — until the next resize. */
const DENSITIES = [ 'compact', 'large' ];	/* the two non-default values; 'normal' = bare :root */
function densityDefault() {
	const d = sd('density');
	return (DENSITIES.indexOf(d) >= 0) ? d : 'normal';
}
function currentDensity() {
	const s = lsGet('fs-density');
	if (DENSITIES.indexOf(s) >= 0) return s;
	if (s === 'normal') return 'normal';
	if (s === null) return densityDefault();
	return 'normal';	/* a stray value reads as the built-in default */
}
function applyDensity(val) {
	const root = document.documentElement;
	const v = (DENSITIES.indexOf(val) >= 0) ? val : 'normal';
	/* stored explicitly (including 'normal'), so it overrides a router default — see the header */
	lsSet('fs-density', v);
	if (v === 'normal') root.removeAttribute('data-density');
	else root.setAttribute('data-density', v);
	fit.schedule();
}
function applyWallpaper(val) {
	const root = document.documentElement;
	const v = (WALLPAPERS.indexOf(val) >= 0) ? val : 'off';
	/* stored explicitly (including 'off'), so it overrides a router default — see the header */
	lsSet('fs-wallpaper', v);
	if (v === 'off') root.removeAttribute('data-wallpaper');
	else root.setAttribute('data-wallpaper', v);
}

/* Background-tint axis: the CANVAS the cards float on (--fs-bg), so a whole install reads as
 * green/violet/amber and you can tell which router a tab — or a screenshot in a ticket — belongs
 * to. Cards, chrome and the status colours keep the palette's values: the cue colours the paper,
 * not the UI. On a hue it is mixed in CSS (:root[data-tint="hue"] + an inline --fs-tint-h; the TINT
 * block in 03-palettes.css explains why that stays contrast-safe on every hue); on a hex it IS the
 * canvas. 0 IS "OFF", not "red": a hue wheel wraps, so one end of the slider is free for the off
 * state a colour axis otherwise has no room for. head.ut pre-paints it. */
const TINT = colorAxis('fs-tint', 'data-tint', '--fs-tint-h', '--fs-bg');
const currentTint = TINT.current, applyTint = TINT.apply;

/* Accent axis: the UI accent (solid buttons, toggle knobs, range sliders, focus rings, accented
 * links) while canvas, cards and the status colours stay put — the tint colours the paper, this
 * colours the CHROME. On a hue, CSS rotates --fs-accent via oklch(from … l c H), keeping the
 * palette's lightness and chroma so --fs-on-accent stays legible without being recomputed; on a hex
 * the ink IS recomputed, from the entered colour's lightness (03-palettes.css). 0 = off (the
 * palette's designed accent), same rationale as the tint. head.ut pre-paints it. */
const ACCENT = colorAxis('fs-accent', 'data-accent', '--fs-accent-h', '--fs-accent');
const currentAccent = ACCENT.current, applyAccent = ACCENT.apply;

/* The three STATUS colours, the same axis pointed at --fs-good / --fs-warn / --fs-danger. They are
 * separate axes rather than one "status" knob because they carry separate MEANINGS: an admin who
 * wants a calmer red has no reason to move the green with it, and every derived tint
 * (-soft/-fill/-line/-line-hi, the callouts, the diff blocks, the port speeds) is a color-mix() OF
 * the role, so each follows its own axis with nothing else to update.
 *
 * They are exposed to the same recolouring as the accent and are NOT protected from it: a status
 * colour is information, and an admin who paints Danger green has said so deliberately. What the
 * theme owes them is the ink over the fill staying readable, which the hex-mode derivation in
 * 03-palettes.css does, and the contrast readout the Appearance page draws beside each field. */
/* ---- the SURFACE axes: the sheet the UI is drawn ON, rather than the marks on it ----------
 *
 * Accent and the status colours are FIGURES: small, saturated, and each is ink on a surface whose
 * contrast the theme can then derive. These four are the surfaces themselves — the cards, the
 * chrome, the inset controls and the hairlines between them — and they behave differently enough
 * that they are their own factory rather than four more colorAxis instances:
 *
 *   - There is no hue mode. Rotating the hue of a near-white card keeps its chroma, which is
 *     ~0.003: every angle of the wheel produces the same white. The Tint axis is what colours a
 *     surface by hue, and it does it by SETTING a chroma rather than rotating one.
 *   - There is no derived ink. What reads on these is --fs-text, a palette token these axes must
 *     not move; the Appearance page reports the contrast each choice lands at instead.
 *   - They therefore need no attribute at all: an inline custom property on :root is the whole
 *     mechanism, and every derived token follows for free because each is a color-mix() of the
 *     one this sets (--fs-glass and --fs-bar-bg from --fs-panel, the hairline ladder from
 *     --fs-border). That is also why --fs-bar-bg is a surface of its own here: it is derived from
 *     --fs-panel and an admin who wants a dark chrome over light cards has to be able to say so.
 *
 * Off is lsSet('0'), not a deleted key, for the reason every other axis stores its default
 * explicitly: once a router default exists, clearing the key means "inherit it". */
function surfaceAxis(key, sdKey, prop) {
	const norm = (v) => {
		const s = (typeof v === 'string') ? v.trim().toLowerCase() : '';
		return FS_HEX_RE.test(s) ? s : 0;
	};
	const def = () => norm(sd(sdKey));
	return {
		def,
		current() {
			const raw = lsGet(key);
			return (raw !== null) ? norm(raw) : def();
		},
		apply(val) {
			const v = norm(val);
			lsSet(key, String(v));
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

/* Rounding: the propAxis instance (default const + rationale up top). --fs-radius-base in px. */
const RADIUS = propAxis('fs-radius', 'rounding', '--fs-radius-base', 0, 20, FS_RADIUS_DEFAULT, (v) => (v + 'px'));
const currentRadius = RADIUS.current, applyRadius = RADIUS.apply, radiusDefault = RADIUS.def;

/* Layout axis: horizontal top bar (the default) vs vertical sidebar. ONE template, ONE renderer — CSS
 * morphs the chrome off :root[data-layout] (head.ut pre-paints it), and toggling re-renders
 * NOTHING: the DOM serves both, and menu-footstrap.js's MutationObserver on data-layout folds the
 * accordion into dropdowns / restores it.
 *
 * Read the ATTRIBUTE, not localStorage: head.ut stamps it server-side (from the router default) and
 * the pre-paint script overrides it from localStorage, so it always carries an explicit value.
 * localStorage would report 'sidebar' on a router whose default is 'top' until the user first
 * touched the toggle. */
function currentLayout() {
	return document.documentElement.getAttribute('data-layout') === 'top' ? 'top' : 'sidebar';
}
function isTopLayout() {
	return currentLayout() === 'top';
}
function applyLayout(val) {
	const layout = (val === 'top') ? 'top' : 'sidebar';
	/* ALWAYS an explicit value, never a removed attribute: every layout rule matches data-layout
	 * POSITIVELY (='sidebar' / ='top'), and a migrated/defaulted router carries a server default
	 * that lsDel would let re-assert on the next load, so localStorage must record the choice. */
	lsSet('fs-layout', layout);
	document.documentElement.setAttribute('data-layout', layout);
	/* the bar and the column have different room for the menu: re-take the fits-on-one-row
	 * measurement. Nothing else re-renders. */
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
	/* stored explicitly ('false' for off, not lsDel) so it overrides a router default of 'on' */
	lsSet('fs-menu-autocollapse', on ? 'true' : 'false');

	/* Switching it on with several sections unfolded leaves the menu in a state the setting says is
	 * impossible, so somebody must fold them — but not this module. It owns storage; the menu owns
	 * every piece of the open/closed state (the `.open` class, the trigger's aria-expanded, the
	 * remembered "keep open" set), and it opens and closes exclusively through setOpen(), which is
	 * what keeps the class and the aria agreeing. Reaching in from here with a raw classList.remove
	 * satisfied the class and left the aria saying expanded — the exact disagreement setOpen exists
	 * to prevent — and then relied on this event to have the menu repair what we had just broken.
	 * One operation, one owner: say what changed and let the menu apply it. */
	document.dispatchEvent(new CustomEvent('fs-autocollapse', { detail: { on } }));
}

/* The sidebar rail's collapsed flag. The BUTTON that flips it is chrome (fs-chrome.js); only the
 * stored state belongs to the preference layer.
 * NOT part of the router-wide defaults — it is a transient chrome collapse, not an appearance
 * choice, so it is absent from snapshotAxes()/resetToSaved() below. */
function applyRail(on) {
	const root = document.documentElement;
	if (on) { root.setAttribute('data-rail', 'true'); lsSet('fs-rail', 'true'); }
	else { root.removeAttribute('data-rail'); lsDel('fs-rail'); }
}
function currentRail() {
	return document.documentElement.getAttribute('data-rail') === 'true';
}

/* ---- Save as default: write the current EFFECTIVE axes to /etc/config/footstrap ----
 * The scoped rpcd ACL (config 'footstrap' only) lets the logged-in admin's session set + commit
 * those options; rpcd validates the config/section/option names, so no value reaches a shell and
 * there is no injection surface. The server reads them back on the next load and the sanitiser in
 * head.ut clamps every one before it becomes window.__fsSD.
 *
 * snapshotAxes() reads the EFFECTIVE values (currentLayout()/currentMode()/… already fold in this
 * browser's localStorage), so "Save as default" captures exactly what the user sees. It does NOT
 * touch localStorage — this browser keeps overriding, which is the point: the saved default is for
 * OTHER browsers/devices. resetToSaved() is the escape hatch that drops this browser back onto it. */
const AXIS_KEYS = [
	'fs-layout', 'fs-darkmode', 'fs-palette', 'fs-wallpaper',
	'fs-tint', 'fs-accent', 'fs-good', 'fs-warn', 'fs-danger',
	'fs-card', 'fs-control', 'fs-bar', 'fs-line',
	'fs-radius', 'fs-menu-autocollapse', 'fs-tint-strength', 'fs-density',
	'fs-photo-dim', 'fs-pattern-size', 'fs-pattern-strength', 'fs-pattern-ink'
];
/* Tint density: the STRENGTH of the router-identity Tint (the hue washed onto --fs-bg), a per-browser
 * axis paired with the Tint hue — the hue picks the colour, this picks how strong it reads.
 * --fs-tint-strength is a multiplier on the tint chroma (03-palettes.css): 100% = the designed
 * strength, up to 200%. 0 is not quite "no tint": the palette's canvas carries a slight cast of its
 * own and the relative colour that applies the tint replaces chroma outright, so 0 leaves a neutral
 * canvas at the same lightness rather than the untinted one (03-palettes.css measures it). Clearing
 * the Tint hue is the real off. It only bites while a Tint hue is set (data-tint), and it is
 * hidden and moot under the File wallpaper, where the tint resets to neutral (the photo covers the
 * canvas). A normal per-browser axis: localStorage ?? router default ?? built-in; head.ut pre-paints
 * it; stored explicitly (incl. the 100 default) so it can override a router default, like the hues.
 *
 * The axis and its default BOTH live up here, above _resolvedDefault()'s module-init call below: a
 * propAxis instance is a `const`, so declaring it further down (where the slider's other siblings sit)
 * puts it in the TDZ at init and the whole module throws — taking the chrome and the menu with it.
 * That is not hypothetical; it was measured, and the empty sidebar is the only symptom. */
const FS_TSTR_DEFAULT = 100;
const TSTR = propAxis('fs-tint-strength', 'tint_strength', '--fs-tint-strength', 0, 200, FS_TSTR_DEFAULT, (v) => String(v / 100));
const currentTintStrength = TSTR.current, applyTintStrength = TSTR.apply, tintStrengthDefault = TSTR.def;

/* Photo dim: the scrim opacity over the FILE photo (0–100%). An ordinary per-browser axis, the same
 * propAxis shape as the Tint's strength — the photo is shared, how strongly THIS browser dims it is
 * not, and it reaches the router with the others through Save-as-default. It only bites while the
 * wallpaper is 'file'. Distinct from Tint strength (fs-tint-strength), which colours the canvas.
 *
 * Declared up here with the other axis instances, above _resolvedDefault()'s module-init call: a
 * propAxis is a `const`, so declaring it lower down leaves it in the TDZ at init and the whole
 * module throws, taking the chrome with it. */
const FS_PDIM_DEFAULT = 74;
const PDIM = propAxis('fs-photo-dim', 'photo_dim', '--fs-photo-dim', 0, 100, FS_PDIM_DEFAULT, (v) => (v + '%'));
const currentPhotoDim = PDIM.current, applyPhotoDim = PDIM.apply, photoDimDefault = PDIM.def;

/* The PATTERN's two live knobs, and the third that is an enum. All three only bite while the
 * wallpaper is 'pattern'; all three are ordinary per-browser axes that reach the router through
 * Save-as-default with the rest — the FILE is shared, how this browser draws it is not.
 *
 * Size is the tile's edge in px. 440 is where the old cats doodle read as a drawing rather than as
 * texture, and it is a sane middle for line art at any density; the range is wide because "how big
 * is one repeat" is entirely a property of the artwork. Strength is the layer's opacity 0-100 —
 * the doodles baked .20 into the file with an SVG `<g opacity>` and CSS could not reach it, which
 * is exactly the knob this replaces.
 *
 * Declared up here with the other axis instances, above _resolvedDefault()'s module-init call: a
 * propAxis is a `const`, so declaring it lower leaves it in the TDZ at init and the whole module
 * throws, taking the chrome with it. */
const FS_PSIZE_DEFAULT = 440;
const PSIZE = propAxis('fs-pattern-size', 'pattern_size', '--fs-pattern-size', 40, 1600, FS_PSIZE_DEFAULT, (v) => (v + 'px'));
const currentPatternSize = PSIZE.current, applyPatternSize = PSIZE.apply, patternSizeDefault = PSIZE.def;
const FS_PSTR_DEFAULT = 20;
const PSTR = propAxis('fs-pattern-strength', 'pattern_strength', '--fs-pattern-strength', 0, 100, FS_PSTR_DEFAULT, (v) => String(v / 100));
const currentPatternStrength = PSTR.current, applyPatternStrength = PSTR.apply, patternStrengthDefault = PSTR.def;
/* Ink: 'theme' (the default — the file's alpha, the theme's colour) or 'original' (the file's own
 * colours, no mask). Two-valued with the default as the bare :root, which is the enumAxis shape. */
const PINK = enumAxis('fs-pattern-ink', 'data-pattern-ink', 'original', 'theme');
const currentPatternInk = PINK.current, applyPatternInk = PINK.apply;
/* `reject: true` IS THE WHOLE POINT — without it a refused write arrives as SUCCESS.
 *
 * rpc.js only raises on the ubus status code when the declaration asks it to (`raise: options.reject`
 * → `if (req.raise && msg.result[0] !== 0) L.raise(...)`); otherwise it hands the code back as the
 * resolved VALUE. Only an object/method-level denial (JSON-RPC -32002) or an HTTP error rejects on
 * its own. So a per-config ACL refusal — `uci` granted, `footstrap` not — resolved with `6`
 * (UBUS_STATUS_PERMISSION_DENIED) and every `.then()` below ran as if the file had been written.
 *
 * Measured on the router with the theme's own ACL narrowed to a config name that does not exist,
 * and the two wildcard-granting packages installed here moved aside so the denial could actually be
 * reached: the declaration WITHOUT the flag resolved with value 6, the same declaration WITH it
 * rejected `ubus code 6: Permission denied`. Before this flag, Appearance → Save as default greyed
 * the button and printed "Saved as default" for a write that never happened, and the user could not
 * even retry — the button was disabled. */
const _uciSet = rpc.declare({ object: 'uci', method: 'set', params: [ 'config', 'section', 'values' ], reject: true });
const _uciCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ], reject: true });

function snapshotAxes() {
	return {
		layout: currentLayout(),
		darkmode: currentMode(),
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
		autocollapse: currentAutoCollapse() ? 'on' : 'off',
		tint_strength: String(currentTintStrength()),
		density: currentDensity(),
		photo_dim: String(currentPhotoDim()),
		pattern_size: String(currentPatternSize()),
		pattern_strength: String(currentPatternStrength()),
		pattern_ink: currentPatternInk()
	};
}
/* The RESOLVED router default (UCI value if set, else the built-in), in snapshotAxes() string form,
 * so the Appearance tab can grey the Save button out when this browser already shows exactly it. Seeded
 * from window.__fsSD at load and replaced with the just-saved snapshot after saveAsDefault(), so a
 * save flips the match to true without a reload.
 *
 * Every field is the axis's OWN def() — this used to restate each one instead (the 1..360 clamp
 * twice, 0..20 once, and a bare `sd('palette') || 'footstrap'` where current() whitelists), i.e. a
 * second copy of a validation with no symptom when the two disagree: `matchesSavedDefault()` simply
 * lies, and the Save button IS that answer. `layout` is the one exception and cannot be otherwise —
 * currentLayout() reads the ATTRIBUTE, so this is the only place stating the layout router default.
 * Its fallback is TOP and must stay the third copy of one answer: head.ut stamps `top` when uci
 * says nothing and resetToBuiltin() applies `top`. It read 'sidebar' here after the default
 * flipped, and the symptom is silent — on a fresh install matchesSavedDefault() is false before the
 * user has touched anything, so Save-as-default shows dirty and resetToSaved() lands on the wrong
 * layout. */
function _resolvedDefault() {
	return {
		layout: sd('layout') || 'top',
		darkmode: modeDefault(),
		palette: paletteDefault(),
		wallpaper: wallpaperDefault(),
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
		autocollapse: autoCollapseDefault() ? 'on' : 'off',
		tint_strength: String(tintStrengthDefault()),
		density: densityDefault(),
		photo_dim: String(photoDimDefault()),
		pattern_size: String(patternSizeDefault()),
		pattern_strength: String(patternStrengthDefault()),
		pattern_ink: PINK.def()
	};
}
let _savedDefault = _resolvedDefault();
function matchesSavedDefault() {
	const cur = snapshotAxes();
	return Object.keys(cur).every((k) => cur[k] === _savedDefault[k]);
}

/* ---- no AXIS reaches /etc/config/footstrap except through Save-as-default ----------------------
 * EVERY axis is per-browser and reaches the router only through this button. Two of them used to
 * write through the moment they changed — `wallpaper` on every pick, `photo_dim` on every drag —
 * on the argument that the File photo is router-side, so "which wallpaper shows it" and "how dim"
 * belonged beside the image. The argument does not survive the consequence: choosing Cats in ONE
 * browser silently re-pointed the router-wide default for every other device, and because the
 * write also moved the Save baseline, the button did not even light up. A per-browser preference
 * must never mutate shared state with no way to see that it did.
 *
 * The photo FILE stays router-side, because a file cannot live in localStorage — but only its
 * bytes and its cache-bust token do. Whether a given browser paints it is `fs-wallpaper`, and how
 * dim it paints it is `fs-photo-dim`: ordinary axes, saved with the rest or not at all. */
function saveAsDefault() {
	const snap = snapshotAxes();
	return _uciSet('footstrap', 'settings', snap)
		.then(() => _uciCommit('footstrap'))
		.then(() => { _savedDefault = snap; });
}
/* ---- the two resets, and they are NOT the same escape hatch -----------------------------------
 *
 * Both drop this browser's tweaks; they differ in WHAT is underneath, which is the whole point of
 * the three-layer model (localStorage ?? router default ?? built-in):
 *
 *   resetToSaved()    clears the keys, so every axis falls back through the layers — to the ROUTER
 *                     default where Save-as-default set one, to the built-in where it did not. The
 *                     browser goes back to INHERITING: a later Save-as-default from another device
 *                     will show up here too.
 *   resetToBuiltin()  writes the theme's own defaults EXPLICITLY, which is the only way to say
 *                     "the theme as it ships, not what this router was told to look like". Clearing
 *                     the keys cannot express it — that is precisely the sentence that means
 *                     "inherit the router default" (see the header).
 *
 * Both leave /etc/config/footstrap alone: neither is a way to un-save a router default, and an
 * admin who wants that presses Save as default from the look they want.
 *
 * The caller reloads so head.ut re-applies everything in one clean pass — the appliers would each
 * repaint correctly, but the CONTROLS on the page are built from the values they had at render
 * time and would go on showing the old ones. */
function resetToSaved() {
	AXIS_KEYS.forEach(lsDel);
}

/* The built-in defaults, written through the ordinary appliers so each one validates its own value
 * and stamps :root the way it always does. Stated here rather than derived: a "default" is only a
 * default because it is the value a bare :root paints, and the five that already have a named
 * const (rounding, tint strength, photo dim, pattern size, pattern strength) use it, so the numbers
 * cannot drift from the CSS. */
function resetToBuiltin() {
	/* TOP, not sidebar: the bar is what a bare :root paints (head.ut stamps it when uci says
	 * nothing), so it is what "the theme as it ships" means. This said 'sidebar' after the default
	 * flipped and nothing caught it — the button quietly reset to a layout that is no longer the
	 * default, which is the one thing this button must not do. */
	applyLayout('top');
	applyMode('auto');
	applyPalette('footstrap');
	applyDensity('normal');
	applyWallpaper('off');
	applyAutoCollapse('off');
	applyRadius(FS_RADIUS_DEFAULT);
	applyTintStrength(FS_TSTR_DEFAULT);
	applyPhotoDim(FS_PDIM_DEFAULT);
	applyPatternSize(FS_PSIZE_DEFAULT);
	applyPatternStrength(FS_PSTR_DEFAULT);
	applyPatternInk('theme');
	/* every colour and surface axis back to "the palette's own" */
	[ applyTint, applyAccent, applyGood, applyWarn, applyDanger,
		applyCard, applyControl, applyBar, applyLine ].forEach((fn) => fn(0));
}

/* ---- the PATTERN: an SVG the admin uploads, tiled and recoloured -------------------------------
 *
 * The theme used to ship two doodle patterns by downloading them from the project's GitHub on
 * demand. A theme in a package feed has no business reaching a third-party host at run time, and
 * "two drawings somebody else chose" was never the interesting half of the feature — so the bytes
 * now come from the admin, and the theme's job is to make an arbitrary SVG look like it belongs.
 *
 * ROUTER-SIDE, like the login photo and for the same reason: a file cannot live in localStorage,
 * and a pattern is something a router wears, not something one browser does. The path is a FIXED
 * server-side constant matched exactly by the rpcd ACL, so nothing user-controlled reaches a path.
 * It lives under /etc so a package upgrade cannot delete it (and keep.d carries it across a
 * sysupgrade); the served name ENDS IN .svg because uhttpd types a file by extension, and an SVG
 * served as application/octet-stream is one no browser will paint.
 *
 * HOW IT IS MADE TO FIT is 15-wallpaper.css's mask, not anything done to the bytes: the file
 * supplies the alpha, the theme supplies the colour, so one upload reads correctly in light mode,
 * in dark mode and under every palette. The two live knobs — tile size and strength — are ordinary
 * per-browser axes below.
 *
 * WHAT IS REFUSED. An SVG is a document, not a picture: it can carry script, and while a masked or
 * background image never executes it, the same file fetched directly from its URL would. Uploading
 * one already needs an authenticated admin session with uci write rights, so this is defence in
 * depth rather than the only line — but the check is cheap and the failure mode is somebody else's
 * browser. Scripted or externally-referencing markup is rejected client-side, before anything is
 * written. */
const PAT_PATH  = '/etc/footstrap/pattern.svg';			/* cgi-upload target; the ACL grants exactly this */
const PAT_SERVE = '/luci-static/footstrap/pattern.svg';	/* the uhttpd symlink to PAT_PATH (uci-defaults) */
const PAT_MAX   = 512 * 1024;							/* a tile that has to reach a router's flash and then every page load */
/* WHAT MAKES AN UPLOADED SVG UNACCEPTABLE, decided on the PARSED DOCUMENT and not on its text.
 *
 * A regex over the source was the first attempt and it was wrong in the way that matters: `\son\w+=`
 * (meant for `onload=`) also matches `only_selected="false"`, an ordinary Inkscape attribute, so one
 * of this project's own sample drawings was refused by its own gate. Text matching is guessing at a
 * grammar the browser already implements — and it guesses in both directions, since an entity or an
 * odd bit of whitespace hides a real handler from the same regex.
 *
 * DOMParser is the parser the file will actually be read by, and parsing is inert: no script runs, no
 * subresource is fetched, no handler is bound. So the questions become exact ones about nodes:
 *
 *   - is it an SVG at all (a parsererror, or a root that is not <svg>, is not an image)
 *   - does it carry an element that EXECUTES or EMBEDS (script, foreignObject, iframe, …)
 *   - does it carry a real event-handler attribute — `^on[a-z]+$`, which `only_selected` is not
 *   - does any value start a `javascript:` url
 *   - does any href point OFF this router — an SVG that phones home when painted is the exact thing
 *     this feature stopped doing; `#fragment` and `data:` stay allowed, because that is how a tile
 *     refers to its own <defs> and how it embeds a bitmap
 *
 * A masked or backgrounded SVG never executes anything in any current browser. The check is for the
 * OTHER way the file can be reached — its own URL, opened directly, same-origin with the session.
 *
 * `animate`/`set` are on the list for a second reason as well as the first: they can retarget an
 * attribute at run time (the classic `<set attributename="href" to="javascript:…">`), and a tile
 * that animates repaints a full-viewport layer behind every page for as long as LuCI is open. */
const PAT_BAD_TAGS = [ 'script', 'foreignobject', 'iframe', 'embed', 'object', 'audio', 'video', 'animate', 'set' ];

/* null if the parsed document is fine, otherwise the sentence to show. */
function _svgObjection(text) {
	let doc;
	try { doc = new DOMParser().parseFromString(text, 'image/svg+xml'); }
	catch (e) { return _('That file is not an SVG image.', 'footstrap'); }
	const root = doc && doc.documentElement;
	if (!root || doc.querySelector('parsererror') || root.nodeName.toLowerCase() !== 'svg')
		return _('That file is not an SVG image.', 'footstrap');
	const refused = _('That SVG contains script or external references, which this theme will not install.', 'footstrap');
	const els = [ root ].concat([ ...root.querySelectorAll('*') ]);
	for (const el of els) {
		if (PAT_BAD_TAGS.indexOf(el.nodeName.toLowerCase()) >= 0) return refused;
		const attrs = el.attributes || [];
		for (let i = 0; i < attrs.length; i++) {
			const n = attrs[i].name.toLowerCase();
			const v = String(attrs[i].value || '').trim();
			/* a REAL handler is `on` + letters and nothing else; `only_selected` is not one */
			if ((/^on[a-z]+$/).test(n)) return refused;
			if ((/^javascript:/i).test(v)) return refused;
			/* off-router reference. A leading `//` is protocol-relative and just as external. */
			if ((/(?:^|:)href$/).test(n) && (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i).test(v)) return refused;
		}
	}
	return null;
}

/* Read the picked file as text so it can be inspected before it is uploaded — and so the thing that
 * reaches the router is exactly the bytes that were checked. */
function _readText(file) {
	return new Promise((resolve, reject) => {
		const fr = new FileReader();
		fr.onload = () => resolve(String(fr.result || ''));
		fr.onerror = () => reject(new Error(_('That file could not be read.', 'footstrap')));
		fr.readAsText(file);
	});
}

/* the token the server last saved (window.__fsSD.pattern), validated to the same hex charset the
 * head.ut sanitiser and the pre-paint keep their own copies of. '' = nothing uploaded. */
function currentPattern() {
	const t = sd('pattern');
	return (typeof t === 'string' && BG_TOKEN_RE.test(t)) ? t : '';
}
function patternUrl(tok) { return PAT_SERVE + '?v=' + tok; }

/* set / clear the tile URL live, without a reload. This only supplies the url(); whether it PAINTS
 * is the Wallpaper axis (data-wallpaper="pattern"). */
function _applyPattern(tok) {
	const root = document.documentElement;
	if (tok) root.style.setProperty('--fs-pattern-url', 'url("' + patternUrl(tok) + '")');
	else root.style.removeProperty('--fs-pattern-url');
	setSD('pattern', tok || '');
}

/* Upload flow, the login photo's exactly: validate -> multipart POST to cgi-io's cgi-upload -> take
 * the md5 `checksum` from the reply as the cache-bust token -> save that token in uci -> apply live.
 * No canvas step: re-encoding is what strips a photo's EXIF, and an SVG re-drawn to a canvas would
 * come back a raster and lose the one property that makes it a tile. The text check above is what
 * stands in for it. */
function uploadPattern(file) {
	if (!file) return Promise.reject(new Error(_('Please choose an SVG file.', 'footstrap')));
	const isSvg = (/(^image\/svg\+xml$)/i).test(file.type || '') || (/\.svg$/i).test(file.name || '');
	if (!isSvg) return Promise.reject(new Error(_('Please choose an SVG file.', 'footstrap')));
	if (file.size > PAT_MAX) return Promise.reject(new Error(_('That file is too large.', 'footstrap')));
	return _readText(file).then((text) => {
		const objection = _svgObjection(text);
		if (objection) return Promise.reject(new Error(objection));
		const fd = new FormData();
		fd.append('sessionid', rpc.getSessionID());
		fd.append('filename', PAT_PATH);
		fd.append('filedata', new Blob([ text ], { type: 'image/svg+xml' }), 'pattern.svg');
		return fetch(L.env.cgi_base + '/cgi-upload', { method: 'POST', body: fd, credentials: 'same-origin' })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
	}).then((reply) => {
		if (!reply || reply.failure)
			return Promise.reject(new Error((reply && reply.failure && reply.failure[1]) || _('Upload failed.', 'footstrap')));
		const tok = String(reply.checksum || '').toLowerCase();
		if (!BG_TOKEN_RE.test(tok))
			return Promise.reject(new Error(_('Upload failed.', 'footstrap')));
		/* cgi-upload writes 0600 and uhttpd refuses to SERVE a file that is not world-readable
		 * (measured: 0600 -> 403, 0644 -> 200) — and _chmodServeable checks the COMMAND's exit
		 * status, not just the ubus call's. */
		return _chmodServeable(PAT_PATH)
			/* uci gets the TOKEN and nothing else: putting a file on the router is not the same act
			 * as making every other device paint it, which is the wallpaper axis and Save-as-default. */
			.then(() => _uciSet('footstrap', 'settings', { pattern: tok }))
			.then(() => _uciCommit('footstrap'))
			.catch((e) => _rollbackUpload(PAT_PATH, e))
			.then(() => {
				/* switch THIS browser onto it — the ordinary axis path, localStorage only */
				applyWallpaper('pattern');
				_applyPattern(tok);
				return tok;
			});
	});
}

/* Remove: delete the file, blank the token (uci `set` to '', not delete — the scoped ACL grants
 * set/commit only), clear the tile live. */
function removePattern() {
	return _removeServed(PAT_PATH)
		.then(() => _uciSet('footstrap', 'settings', { pattern: '' }))
		.then(() => _uciCommit('footstrap'))
		.then(() => { _applyPattern(''); });
}

/* ---- Login/page background upload: ROUTER-SIDE, and deliberately NOT an axis --------------------
 * The other axes are per-browser (localStorage) with a router default; this one has no browser layer
 * at all. An admin uploads an image once, it becomes the router-wide background for EVERY device and
 * shows pre-login, and there is nothing to override locally — so it is absent from AXIS_KEYS,
 * snapshotAxes() and matchesSavedDefault() (it must not move the Save button), and it needs no
 * enum/hue factory (so tools/axes.mjs never sees it).
 *
 * The image is a SERVED FILE (uhttpd has no gzip — inlining a photo in every page's <head> is out);
 * only its cache-bust token lives in uci -> window.__fsSD -> the url() head.ut stamps. The file path
 * is a FIXED server-side constant, matched exactly by the rpcd ACL, so nothing user-controlled ever
 * reaches a path — no traversal surface. */
const BG_PATH  = '/etc/footstrap/login-bg';		/* cgi-upload target; the ACL grants exactly this */
const BG_SERVE = '/luci-static/footstrap/bg';	/* the uhttpd symlink to BG_PATH (uci-defaults) */
const BG_MAX_SIDE = 1920;						/* cap the longest side — a router serves this off flash with no gzip, and 1080p covers the screens LuCI is actually admin'd from; still crisp full-screen, far fewer flash/wire bytes */
const BG_QUALITY  = 0.9;
const BG_SRC_MAX  = 25 * 1024 * 1024;			/* refuse a source this big before decoding (decode-bomb guard) */
/* NO `reject: true` here, unlike every other declare in this file, and that is the whole point: with
 * it the caller gets an Error whose only account of WHY is a sentence with the ubus code inside it,
 * so "the file was already gone" and "the router refused to delete it" arrive indistinguishable —
 * and both callers below used to swallow the rejection whole and report success. Without it the
 * promise resolves with the ubus status as a NUMBER (rpc.js hands back `msg.result[0]`), which is a
 * signal this code can actually branch on. */
const _fileRemoveStatus = rpc.declare({ object: 'file', method: 'remove', params: [ 'path' ] });

/* Delete, treating "not found" as done. Anything else is a real refusal — a read-only or full
 * overlay, an immutable flag, a path replaced by a non-empty directory — and it must NOT be reported
 * as a removal: the file stays on flash and stays fetchable WITHOUT A SESSION through the /www
 * symlink, which is precisely what an admin removing a background for privacy reasons believes they
 * have just stopped. */
const UBUS_NOT_FOUND = 4;
function _removeServed(path) {
	return _fileRemoveStatus(path).then((res) => {
		const code = (typeof res === 'number') ? res : parseInt(res, 10);
		if (code === 0 || code === UBUS_NOT_FOUND || isNaN(code)) return;
		return Promise.reject(new Error(
			_('The router refused to delete the file (ubus status %d).', 'footstrap').format(code)));
	});
}
/* cgi-upload writes the file mode 0600, and uhttpd refuses to SERVE a file that is not
 * world-readable (measured: 0600 -> 403, 0644 -> 200), so make it 0644 before it can be fetched. The
 * rpcd ACL grants exec on exactly two fixed commands — `/bin/chmod 644 /etc/footstrap/login-bg` and
 * `/bin/chmod 644 /etc/footstrap/pattern.svg`, the two files this module uploads — with no argument
 * the caller controls. */
const _fileExec = rpc.declare({ object: 'file', method: 'exec', params: [ 'command', 'params' ], reject: true });
/* …and the ubus status is only half of it: `file.exec` reports the COMMAND's exit status inside the
 * payload, so a chmod that ran and failed still comes back as a successful call. Unchecked, the
 * chain below went on to commit `wallpaper=file` router-wide for a file uhttpd will 403 (cgi-upload
 * writes it 0600) — the upload reports success and every device, including the pre-login page, gets
 * a scrim over nothing. */
function _chmodServeable(path) {
	return _fileExec('/bin/chmod', [ '644', path ]).then((res) => {
		if (res && res.code)
			throw new Error(_('Upload failed.', 'footstrap') + ' (chmod ' + res.code + ')');
		return res;
	});
}
/* the cache-bust token charset — an md5/sha hex string. ONE copy here (currentLoginBg validates the
 * stored token, uploadLoginBg validates the fresh cgi-upload checksum); head.ut's ucode sanitiser and
 * the pre-paint inline script keep their own identical copies, unavoidably (they run before this
 * module and cannot require it) — see the axes contract in head.ut. */
const BG_TOKEN_RE = /^[a-f0-9]{6,64}$/;

/* the token the server last saved (window.__fsSD.login_bg), validated to the same hex charset the
 * head.ut sanitiser and pre-paint use — so the Appearance tab shows the current background and builds a
 * cache-busted preview src. '' = none. */
function currentLoginBg() {
	const t = sd('login_bg');
	return (typeof t === 'string' && BG_TOKEN_RE.test(t)) ? t : '';
}
function loginBgUrl(tok) { return BG_SERVE + '?v=' + tok; }

/* set / clear the photo URL live, without a reload. This only supplies the url() — whether it PAINTS
 * is the Wallpaper axis (data-wallpaper="file", applyWallpaper above), so an upload while the browser
 * is on file shows at once, and removing the image leaves the file layer with `none`. */
function _applyLoginBg(tok) {
	const root = document.documentElement;
	if (tok) root.style.setProperty('--fs-login-bg-url', "url('" + loginBgUrl(tok) + "')");
	else root.style.removeProperty('--fs-login-bg-url');
	setSD('login_bg', tok || '');
}

/* Re-encode the picked image to a bounded JPEG on a canvas. This is a SECURITY step as much as a
 * size one: the canvas keeps only the decoded pixels, so EXIF and any bytes appended past the image
 * are dropped — the uploaded blob is exactly what the browser drew and nothing else.
 *
 * THE WHOLE BODY IS GUARDED, because a throw inside an event handler does not reject the promise it
 * sits in — it escapes as an uncaught error and leaves the promise pending FOREVER. Two real ways
 * out of `onload`: `getContext('2d')` answers null when the canvas cannot be backed (out of memory
 * on a low-RAM box is the case this decodes a 25 MB source on), and drawImage/toBlob can throw on
 * their own. The caller is the Appearance tab's file picker, which disables "Choose image" and relabels
 * it "Uploading…" before the call and restores both in a `.finally()` — so a pending promise means
 * that button stays disabled and lying until the form is rebuilt, which mount() does only when the
 * stock view re-renders: the next arrival at System -> System, not this one. */
function _downscale(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			try {
				const scale = Math.min(1, BG_MAX_SIDE / Math.max(img.width, img.height));
				const w = Math.max(1, Math.round(img.width * scale));
				const h = Math.max(1, Math.round(img.height * scale));
				const cv = document.createElement('canvas');
				cv.width = w; cv.height = h;
				const ctx = cv.getContext('2d');
				if (!ctx) throw new Error('no 2d context');
				ctx.drawImage(img, 0, 0, w, h);
				cv.toBlob((blob) => blob ? resolve(blob) : reject(new Error(_('Could not process the image.', 'footstrap'))),
					'image/jpeg', BG_QUALITY);
			} catch (e) { reject(new Error(_('Could not process the image.', 'footstrap'))); }
		};
		img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(_('That file is not a readable image.', 'footstrap'))); };
		img.src = url;
	});
}

/* An upload that has landed but could not be RECORDED must not stay on the router. The two paths
 * below write the file first (cgi-upload) and the token second (uci), and the second half can fail
 * on its own: no `settings` section yet, a narrowed uci ACL, ubus busy. The page then showed the
 * rpc error — honest as far as it went — while the image sat in /etc/footstrap at mode 0644 and was
 * served to ANYONE at /luci-static/footstrap/bg, because the /www symlink does not depend on the
 * token. Worse, Remove is hidden exactly when the token is empty, so the page offered no way to
 * delete what it had just published. Roll the file back instead, and report the failure that
 * started it — a rollback that itself fails is appended, because at that point the admin has to
 * know the file is there. */
function _rollbackUpload(path, cause) {
	return _removeServed(path).then(
		() => Promise.reject(cause),
		() => Promise.reject(new Error(String((cause && cause.message) || cause) + ' — '
			+ _('the uploaded file could not be removed either; it is still on the router.', 'footstrap')))
	);
}

/* Upload flow: validate -> canvas re-encode -> multipart POST to cgi-io's cgi-upload (the same
 * endpoint L.ui.uploadFile uses; session carried in the `sessionid` FIELD, path in `filename`, bytes
 * in `filedata`) -> take the md5 `checksum` from the JSON reply as the cache-bust token -> save it in
 * uci -> apply live. cgi-upload authorises the write against the ACL's `file` grant for BG_PATH. */
function uploadLoginBg(file) {
	if (!file || !(/^image\//).test(file.type || ''))
		return Promise.reject(new Error(_('Please choose an image file.', 'footstrap')));
	if (file.size > BG_SRC_MAX)
		return Promise.reject(new Error(_('That image is too large.', 'footstrap')));
	return _downscale(file).then((blob) => {
		const fd = new FormData();
		fd.append('sessionid', rpc.getSessionID());
		fd.append('filename', BG_PATH);
		fd.append('filedata', blob, 'login-bg');
		return fetch(L.env.cgi_base + '/cgi-upload', { method: 'POST', body: fd, credentials: 'same-origin' })
			.then((r) => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)));
	}).then((reply) => {
		/* cgi-upload answers { name, size, checksum, sha256sum } or { failure: [code, msg] } */
		if (!reply || reply.failure)
			return Promise.reject(new Error((reply && reply.failure && reply.failure[1]) || _('Upload failed.', 'footstrap')));
		const tok = String(reply.checksum || '').toLowerCase();
		if (!BG_TOKEN_RE.test(tok))
			return Promise.reject(new Error(_('Upload failed.', 'footstrap')));
		/* make the just-written 0600 file world-readable, or uhttpd 403s it (see _fileExec) */
		return _chmodServeable(BG_PATH)
			/* uci gets the TOKEN and nothing else. Uploading a photo is not the same act as making it
			 * the router-wide background: it puts a file on the router, and which browsers paint it is
			 * the wallpaper axis, saved with the rest through Save-as-default. Writing `wallpaper:file`
			 * here would re-point every other device's default from one admin's upload, silently. */
			.then(() => _uciSet('footstrap', 'settings', { login_bg: tok }))
			.then(() => _uciCommit('footstrap'))
			.catch((e) => _rollbackUpload(BG_PATH, e))
			.then(() => {
				/* switch THIS browser to the photo — the ordinary axis path, localStorage only */
				applyWallpaper('file');
				_applyLoginBg(tok);
				return tok;
			});
	});
}

/* Remove: delete the file, blank the token (uci `set` to '', not delete — the scoped ACL grants
 * set/commit only), clear the background live. */
function removeLoginBg() {
	return _removeServed(BG_PATH)
		.then(() => _uciSet('footstrap', 'settings', { login_bg: '' }))
		.then(() => _uciCommit('footstrap'))
		.then(() => { _applyLoginBg(''); });
}


return baseclass.extend({
	/* the storage helpers */
	lsGet, lsSet, lsDel, lsGetArr, storageBroken,

	currentMode, applyMode, guardDarkStamp,
	currentPalette, applyPalette,
	currentWallpaper, applyWallpaper,
	currentDensity, applyDensity,
	currentRadius, applyRadius,
	currentTint, applyTint,
	currentAccent, applyAccent,
	currentGood, applyGood,
	currentCard, applyCard,
	currentControl, applyControl,
	currentBar, applyBar,
	currentLine, applyLine,
	currentWarn, applyWarn,
	currentDanger, applyDanger,
	currentLayout, isTopLayout, applyLayout,
	currentAutoCollapse, applyAutoCollapse,
	currentRail, applyRail,

	currentLoginBg, loginBgUrl, uploadLoginBg, removeLoginBg,
	currentPattern, patternUrl, uploadPattern, removePattern,
	currentPatternSize, applyPatternSize,
	currentPatternStrength, applyPatternStrength,
	currentPatternInk, applyPatternInk,
	currentTintStrength, applyTintStrength,
	currentPhotoDim, applyPhotoDim,

	saveAsDefault, resetToSaved, resetToBuiltin, matchesSavedDefault
});
