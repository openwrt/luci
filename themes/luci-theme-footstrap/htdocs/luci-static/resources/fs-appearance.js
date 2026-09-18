'use strict';
'require baseclass';
'require ui';
'require dom';
'require fs-prefs as prefs';
'require fs-axes as axes';
'require fs-assets as assets';
'require fs-version as ver';

/* The Appearance controls: the DOM that presents the axes. It owns no preference — fs-prefs.js
 * holds the axes and fs-version.js the version string; this file is the form they are shown in.
 *
 * Built once, for the dispatched page: `view/footstrap/appearance.js` — a menu entry, an ordinary
 * route — calls `renderStandalone()` below, the whole surface this file exposes. Before the page
 * existed the same form was stapled onto a tab on System -> System instead, watching for the stock
 * form's own tab strip with a MutationObserver, a 5 s deadline, a `body[data-page]` tracker, a
 * stale-group WeakSet disqualifying the outgoing page's own DOM from a false match, and a
 * sessionStorage flag so a reset's reload landed back on the tab rather than whichever one LuCI
 * remembered. A Save & Apply on a real router once lost that tab outright, never reproduced on
 * either stand — a mount stapled onto another app's own render is a timing dependency on that
 * render, by construction, and the most likely account of a user report that could never be
 * reproduced either way. All of it is gone now that the page owns a route of its own. Twenty-one
 * axes, nine of them with a colour field, a swatch and a contrast readout, do not fit a floating
 * popover that has to trap Tab and stay inside a 320px column, and keeping both containers would
 * render every axis twice.
 *
 * The version line makes no request and must not grow one: which version is INSTALLED is what this
 * page answers, and which is available is the package manager's question. */

/* ---- colour: reading what the page is actually painted ----
 *
 * This lived in fs-widgets.js, which the menu and the search palette also require — so the whole
 * colour engine was downloaded on every admin page to be used on this one. It is 3 KB of probe,
 * canvas and WCAG arithmetic that nothing outside this form has ever called: `colorControl` was
 * fs-widgets' only colour export and this file its only consumer. */

/* ---- colour: reading what the page is actually painted ----
 *
 * Two questions no stored value answers: what colour a role is right now (the palette's own while
 * the axis is off — there is deliberately no copy of the palette in JS), and what contrast the
 * user's colour lands at. Both are about the computed cascade, so both are asked of the browser.
 *
 * `getComputedStyle(root).getPropertyValue('--fs-accent')` answers neither: a custom property
 * computes to the token stream after var() substitution, so `oklch(from … l c H)` comes back
 * unevaluated. Setting the expression as a real `color` and reading it back makes the browser
 * resolve it — relative colour, color-mix() and the tint's calc() are what the theme is made of.
 * One hidden probe is reused; an element per query would thrash layout on every slider drag. */
let _probe = null;
function probeColor(expr) {
	if (!_probe) {
		/* Off-screen rather than display:none, so the reading does not depend on a display:none
		 * element computing `color` in every engine. It has no text and no size, so it paints
		 * nothing.
		 *
		 * Every declaration is !important (issue #19): this is an unmarked element in a document
		 * shared with `luci-app-*`, and an app's unlayered `span { color: … !important }` outranks
		 * a layer and a plain inline style alike. A probe that loses its own colour reports the
		 * app's, which then becomes the admin's saved axis on the next confirm. */
		_probe = E('span', { 'aria-hidden': 'true' });
		_probe.style.cssText = 'position:fixed!important;left:-9999px!important;top:0!important;'
			+ 'width:0!important;height:0!important;overflow:hidden!important;'
			+ 'pointer-events:none!important;';
		document.body.appendChild(_probe);
	}
	/* cleared first: an expression the engine rejects leaves the previous colour standing, which
	 * would report a stale answer as a fresh one */
	_probe.style.setProperty('color', '');
	_probe.style.setProperty('color', expr, 'important');
	return getComputedStyle(_probe).color;
}

/* A computed colour -> [r,g,b] 0..255, or null. Rasterised, not parsed: a computed `color` keeps
 * the space it was authored in, so `oklch(0.54 0.19 300)` would parse as three numbers in the
 * wrong units and produce a colour nobody chose — measured: #010078, graded "Too faint to read",
 * in the hex field, the swatch and the contrast readout alike. Painting one pixel makes the engine
 * convert instead (tools/export-tier.mjs uses the same method). The string parse remains only as
 * the fallback for an engine with no 2D context, where only the legacy `rgb()`/`color(srgb …)`
 * forms can appear. */
let _cx = null;
function rasterCtx() {
	if (_cx !== null) return _cx;
	try {
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		_cx = cv.getContext('2d', { willReadFrequently: true }) || false;
	} catch (e) { _cx = false; }
	return _cx;
}
function parseColor(s) {
	const str = String(s || '');
	const cx = rasterCtx();
	if (cx) {
		/* fillStyle keeps the last value it could parse, so a colour this engine rejects would
		 * report the previous one as a fresh reading — the trap probeColor() clears for */
		cx.fillStyle = '#000';
		cx.fillStyle = str;
		cx.clearRect(0, 0, 1, 1);
		cx.fillRect(0, 0, 1, 1);
		const d = cx.getImageData(0, 0, 1, 1).data;
		if (d[3] === 255) return [ d[0], d[1], d[2] ];
		/* translucent: composite over nothing is meaningless for a readout, so fall through */
	}
	const nums = str.match(/[\d.]+/g);
	if (!nums || nums.length < 3) return null;
	const unit = (/^color\(/i).test(str) ? 255 : 1;
	return nums.slice(0, 3).map((n) => Math.max(0, Math.min(255, parseFloat(n) * unit)));
}

/* WCAG 2.x relative luminance and contrast ratio, on sRGB. Used only to report: the theme states
 * what a colour costs and leaves the choice with the user, never correcting it (03-palettes.css
 * derives the ink over a fill, which is a different question). */
function luminance(rgb) {
	const c = rgb.map((v) => {
		const x = v / 255;
		return (x <= .03928) ? (x / 12.92) : Math.pow((x + .055) / 1.055, 2.4);
	});
	return (.2126 * c[0]) + (.7152 * c[1]) + (.0722 * c[2]);
}
function contrastRatio(fgExpr, bgExpr) {
	const fg = parseColor(probeColor(fgExpr)), bg = parseColor(probeColor(bgExpr));
	if (!fg || !bg) return null;
	const a = luminance(fg), b = luminance(bg);
	return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/* #rrggbb, because <input type="color"> accepts nothing else. An unparseable colour becomes black
 * rather than throwing: the text field beside the swatch is the authoritative one. */
function toHex(s) {
	const rgb = parseColor(s) || [ 0, 0, 0 ];
	return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/* One colour axis: a native swatch, a hex field and a button back to the palette's own colour.
 * Reports through onPick as a hex string, or 0 for "back to the palette", either of which the
 * caller hands straight to fs-prefs.js's colorAxis.
 *
 * There is no hue slider and one is not coming back: rotating a hue keeps the palette's chroma,
 * so no angle of it reaches a grey. The axis still accepts a stored hue (1–360) and the stylesheet
 * still rotates the palette by one, so a saved value goes on working.
 *
 * `opts.probe` is the live token the effective colour is read back from, so the field shows the
 * palette's colour while the axis is off without a copy of the palette in JS. `opts.contrast` is
 * the pair whose ratio is reported under the row. */
function colorControl(current, onPick, label, opts) {
	const o = opts || {};

	/* type=color leaves the picker to the browser: accessible without reimplementing a colour
	 * wheel, and native on a phone. The text field beside it takes a pasted hex and is the
	 * fallback where the browser draws no picker. */
	const swatch = E('input', { 'type': 'color', 'class': 'fs-color-swatch', 'aria-label': label || '' });
	const field = E('input', {
		'type': 'text', 'class': 'fs-color-hex', 'spellcheck': 'false', 'autocomplete': 'off',
		'inputmode': 'text', 'maxlength': '7', 'aria-label': label || ''
	});
	const clear = E('button', { 'class': 'btn fs-color-clear', 'type': 'button' }, [ _('Palette', 'footstrap') ]);
	const ratio = o.contrast ? E('div', { 'class': 'cbi-value-description fs-color-contrast' }) : null;

	/* what the axis holds right now: the page can change it behind this control (a preset, Reset
	 * to default), so a private copy would go stale. `current` is only the build-time value. */
	const currentOf = o.read || (() => current);

	/* Repaint everything that mirrors the axis. Called after every edit, and through the returned
	 * refresh() after a preset, palette switch or dark-mode flip — each changes what the palette's
	 * own colour is while this axis stays off. */
	function reflect(v) {
		const live = probeColor(o.probe);
		const hex = (typeof v === 'string') ? v : toHex(live);
		swatch.value = hex;
		/* do not fight the user mid-edit: `#0` is a legal prefix, and overwriting the field on
		 * every keystroke made the input impossible to type into */
		if (document.activeElement !== field) field.value = hex;
		/* the button back to the palette doubles as the axis state readout: enabled means the axis
		 * holds a colour of its own, disabled means the field shows the palette's */
		clear.disabled = !v;
		if (!ratio) return;
		const r = contrastRatio(o.contrast.fg, o.contrast.bg);
		if (r === null) { ratio.textContent = ''; ratio.removeAttribute('title'); return; }
		/* The readout states what the ratio means; the number itself stays in the title.
		 * Thresholds are WCAG AA: 4.5:1 for body text, 3:1 for large text and for a UI shape, so a
		 * hairline is graded on the second (`kind: 'shape'`) and warns rather than fails — a faint
		 * border is a legitimate choice.
		 *
		 * Class names are written out whole: tools/fs-orphans.mjs sweeps dead CSS by matching
		 * fs-* tokens in the source, and a concatenated name is invisible to it. */
		const where = o.contrast.label;
		const grade = (o.contrast.kind === 'shape')
			? ((r >= 3)
				? { cls: 'fs-contrast-aa', text: _('Clearly visible %s', 'footstrap').format(where) }
				: { cls: 'fs-contrast-aa-large', text: _('Barely visible %s', 'footstrap').format(where) })
			: (r >= 4.5)
				? { cls: 'fs-contrast-aa', text: _('Easy to read %s', 'footstrap').format(where) }
				: (r >= 3)
					? { cls: 'fs-contrast-aa-large', text: _('Hard to read %s — large text only', 'footstrap').format(where) }
					: { cls: 'fs-contrast-low', text: _('Too faint to read %s', 'footstrap').format(where) };
		ratio.className = 'fs-color-contrast ' + grade.cls;
		ratio.textContent = grade.text;
		ratio.title = _('Contrast %s:1 (WCAG AA wants %s:1 here)', 'footstrap')
			.format(r.toFixed(1), (o.contrast.kind === 'shape') ? '3' : '4.5');
	}

	const pick = (v) => { onPick(v); reflect(v); };

	swatch.addEventListener('input', () => pick(swatch.value.toLowerCase()));
	/* commit on blur and Enter, not per keystroke: a half-typed `#0096` would repaint the page
	 * under the cursor. An unparseable value snaps back to what the axis holds, so the field
	 * cannot claim a colour the page is not painted in. */
	const commit = () => {
		const v = field.value.trim().toLowerCase();
		if ((/^#[0-9a-f]{6}$/).test(v)) pick(v);
		else reflect(currentOf());
	};
	field.addEventListener('blur', commit);
	field.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } });
	clear.addEventListener('click', () => pick(0));

	const wrap = E('div', { 'class': 'fs-colorctl' + (o.cls ? ' ' + o.cls : '') }, [
		E('div', { 'class': 'fs-color-row' }, [ swatch, field, clear ])
	].concat(ratio ? [ ratio ] : []));
	/* the caller decides when this runs: probeColor() needs the document, and this control is not
	 * in it yet */
	wrap.fsRefresh = () => reflect(currentOf());
	return wrap;
}

/* Build the whole form. Returns the root element, for renderStandalone() below to hand to the
 * page's own render().
 *
 * Everything applies immediately and there is nothing to save: every axis is this browser's, in
 * localStorage, and the page repaints under the control as it moves. Only "Save to router" writes
 * anything, pushing the current look to the ROUTER for other browsers. That distinction is the
 * model (docs/design-system.md), and why this page has no Save/Reset footer of LuCI's own —
 * view/footstrap/appearance.js nulls handleSave/handleSaveApply/handleReset, which is what actually
 * drops it: view.js's own default footer (Save & Apply | Apply unchecked | Save | Reset, wired to
 * apply_rollback) renders and runs otherwise, POSTing on a form with nothing staged (measured,
 * live, before that null). */
function build() {
	/* every saved axis re-checks the Save button after applying, so it greys the moment this
	 * browser matches the saved default and un-greys when it diverges. Wrapped around the appliers
	 * because the controls call them directly and have no other seam back here. */
	const bump = (fn) => (v) => { fn(v); refreshSave(); };

	/* Every colour control mirrors something it does not own: the palette's colour while its own
	 * axis is off, and the contrast that colour lands at. A palette switch or dark-mode flip moves
	 * all of it under controls nobody touched, so they refresh together. */
	const colourCtls = [];
	const refreshColours = () => colourCtls.forEach((c) => c.fsRefresh());
	/* wrap an applier so the colour readouts follow it: mode and palette change what every axis is
	 * measured against */
	const repaint = (fn) => (v) => { fn(v); refreshColours(); };

	/* One captioned row in LuCI's own shape: `.cbi-value` > `label.cbi-value-title` +
	 * `.cbi-value-field`. Nothing here styles those class names — base/30-forms.css and
	 * theme/60-inputs.css already lay them out — so this page inherits every future fix to the form
	 * layout instead of keeping a private copy. It also puts the row on a shared surface (zone 2,
	 * where an app may win on specificity), which is right for a page inside #view.
	 *
	 * `make` is handed the same label string the caption renders, because every control needs it a
	 * second time as its aria-label; stating it twice is how the visible caption and what a screen
	 * reader announces drift apart. `extra` carries rows with more than a control, `opts.cls` marks
	 * the rows CSS has to single out. */
	const group = (label, make, opts) => {
		const o = opts || {};
		return E('div', { 'class': 'cbi-value' + (o.cls ? ' ' + o.cls : '') }, [
			E('label', { 'class': 'cbi-value-title' }, [ label ]),
			E('div', { 'class': 'cbi-value-field' }, [ make(label) ].concat(o.extra || []))
		]);
	};

	/* the three literals every colour row repeats; a string literal survives minification intact */
	const CARD_BG = 'var(--fs-panel)', INK = 'var(--fs-text)', ON_CARD = _('on a card', 'footstrap');

	/* ---- the controls are LuCI's own ----
	 *
	 * Every enum axis is a `ui.Select` and every number a `ui.RangeSlider`: the widgets the other
	 * tabs are built from, already dressed by this stylesheet (`select` in base/30-forms.css,
	 * `.cbi-range-slider` in theme/60-inputs.css). Both exist on every release this theme supports
	 * — checked against openwrt-24.10, since `ui.RangeSlider` is the one that did not exist further
	 * back.
	 *
	 * Listen for `widget-change` from UIElement, not for an event on the inner element: that is the
	 * seam the widget publishes, and reaching past it ties this to how the widget happens to be
	 * built. RangeSlider also emits `widget-update` while the handle moves, which is what resizes
	 * the page under the drag; the appliers are idempotent, so wiring both costs nothing. */
	const selectCtl = (current, choices, apply, label) => {
		const w = new ui.Select(String(current), choices, { widget: 'select', sort: Object.keys(choices) });
		const node = w.render();
		node.setAttribute('aria-label', label);
		node.addEventListener('widget-change', () => apply(w.getValue()));
		return node;
	};

	const sliderCtl = (current, min, max, apply, label, opts) => {
		const o = opts || {};
		const w = new ui.RangeSlider(String(current), {
			min: min, max: max, step: o.step || 1
		});
		const node = w.render();
		node.setAttribute('aria-label', label);
		const push = () => apply(parseInt(w.getValue(), 10));
		/* `live: false` for an axis whose value moves THIS CONTROL. Content width widens the column
		 * the Appearance page is drawn in, so applying mid-drag slides the handle out from under
		 * the pointer, the pointer catches up, and one small drag runs the value to the maximum —
		 * reported from a router, and not a thing any other slider here can do: rounding and the
		 * tint sliders repaint around a control that stays where it is. On release the page still
		 * follows, and a keyboard user is unaffected either way: an arrow key on a range input
		 * fires `change` as well as `input`, so the value applies at once. */
		if (o.live !== false) node.addEventListener('widget-update', push);
		node.addEventListener('widget-change', push);
		return node;
	};

	/* one colour axis: `probe` is the live token the control reads the effective colour back from,
	 * `contrast` the pair it reports */
	const colourGroup = (label, axis, probe, contrast, opts) => group(label, (lbl) => {
		const ctl = colorControl(axis.current(), bump(axis.apply), lbl, {
			probe: probe,
			read: axis.current,
			contrast: contrast,
			cls: (opts && opts.cls) || ''
		});
		colourCtls.push(ctl);
		return ctl;
	}, opts);

	/* Every label here carries the 'footstrap' context (`_(str, ctx)`, key `ctx\1str`). LuCI serves
	 * one merged catalogue — load_catalog() loads every *.<lang>.lmo and a lookup returns the first
	 * archive holding the hash — so a bare msgid is a global name any luci-app may take, and
	 * readdir order picks the winner: the layout toggle rendered "Максимум" on a Russian router
	 * because another catalogue translates "Top" as "maximum" (issue #6). Contexting cannot be
	 * selective. The chrome, the login/notice sentences and the System/Memory/Storage headings are
	 * deliberately bare — inheriting luci-base's translation covers the ~40 languages this theme
	 * has no catalogue for. */

	/* ---- section 1: the shell ---- */
	const shell = [
		group(_('Layout', 'footstrap'), (label) => selectCtl(prefs.currentLayout(), {
			sidebar: _('Sidebar', 'footstrap'),
			top:     _('Top', 'footstrap')
		}, bump(prefs.applyLayout), label)),

		group(_('Theme', 'footstrap'), (label) => selectCtl(prefs.currentMode(), {
			auto:  _('Auto', 'footstrap'),
			light: _('Light', 'footstrap'),
			dark:  _('Dark', 'footstrap')
		}, bump(repaint(prefs.applyMode)), label)),

		group(_('Palette', 'footstrap'), (label) => selectCtl(axes.currentPalette(), {
			footstrap:  'Footstrap',
			hicontrast: 'Hi-Contrast',
			/* names the OTHER package, luci-theme-bootstrap, whose colours this palette is —
			 * so it is a proper noun and stays untranslated, like the two above it */
			bootstrap:  'Bootstrap',
			/* names the OTHER package again, luci-theme-openwrt-2020, whose colourway this is */
			'2020':     'OpenWrt 2020',
			/* names the OpenWrt forum (forum.openwrt.org), whose Discourse colourway this is —
			 * a proper noun like the three above it, not the English common noun "forum" */
			forum:      'Forum'
		}, bump(repaint(axes.applyPalette)), label)),

		group(_('Density', 'footstrap'), (label) => selectCtl(prefs.currentDensity(), {
			compact: _('Compact', 'footstrap'),
			normal:  _('Normal', 'footstrap'),
			large:   _('Large', 'footstrap')
		}, bump(prefs.applyDensity), label)),

		/* issue #44: the content column's own cap, separate from Density (which moves type and
		 * air, not the column's ceiling). The slider STARTS at the 1280px the theme has always
		 * shipped and only ever widens — there is no reason to offer a column narrower than the
		 * one every page was designed against, and keeping 1280 as the left end also keeps
		 * --fs-content-min (500px, what the sidebar-to-bar fold is measured against) out of reach
		 * by construction rather than by a rule someone has to remember. */
		group(_('Content width', 'footstrap'),
			(label) => sliderCtl(axes.currentContentWidth(), 1280, 3840,
				bump(axes.applyContentWidth), label, { step: 40, live: false })),

		group(_('Rounding', 'footstrap'),
			(label) => sliderCtl(axes.currentRadius(), 0, 20, bump(axes.applyRadius), label)),

		/* The top layout has no accordion, so this switch is meaningless there: always built,
		 * hidden by CSS (:root[data-layout="top"] .fs-ap-submenus). Do not wrap it in an
		 * `if (currentLayout() !== 'top')` — the page is built once, so the branch would freeze
		 * the control to the layout the page loaded in while CSS morphs the chrome live. */
		group(_('Submenus', 'footstrap'), (label) => selectCtl(
			prefs.currentAutoCollapse() ? 'on' : 'off', {
				off: _('Keep open', 'footstrap'),
				on:  _('Auto-collapse', 'footstrap')
			}, bump(prefs.applyAutoCollapse), label),
		{ cls: 'fs-ap-submenus' })
	];

	/* ---- section 2: colours ---- */
	const colours = [
		/* the caption says what the axis is for: "Tint" alone reads as decoration, and nobody
		 * would look for the router-identity cue under it */
		colourGroup(_('Tint (router identification)', 'footstrap'), {
			current: axes.currentTint, apply: axes.applyTint
		}, 'var(--fs-bg)', {
			/* the canvas is the one axis with no derived ink: its text is --fs-text, a palette
			 * token this axis must not move, so the ratio is reported instead of corrected */
			fg: 'var(--fs-text)', bg: 'var(--fs-bg)', label: _('on the canvas', 'footstrap')
		}, { cls: 'fs-ap-tint' }),

		/* The strength half of the Tint, meaningful only in hue mode: a hex canvas is the colour
		 * asked for, with no chroma of ours to scale. CSS hides it in the other two states.
		 *
		 * Not called "Density": that is the select above, and this string is both the caption and
		 * the aria-label, so a screen reader would announce two rows under one name. */
		group(_('Tint strength', 'footstrap'),
			(label) => sliderCtl(axes.currentTintStrength(), 0, 200, bump(repaint(axes.applyTintStrength)), label, {
				step: 5
			}), { cls: 'fs-ap-tint fs-ap-tintstr' }),

		/* recolours the accented controls (buttons/toggles/sliders/focus rings), not the canvas.
		 * Measured as text on a card, the use that fails first: as a fill it carries derived ink,
		 * as a link or status label it carries only itself. It is also what answers #20 ("sometimes
		 * you want grey or black"), taking any #rrggbb — the colour-chip presets that once sat here
		 * are not coming back. */
		/* Four status roles, one shape: the role's own colour read against a card. Written out
		 * eight times between here and the surfaces below, they cost their repeated literals in
		 * full — a string is not mangled — so the rows are data and the row is stated once. */
		...[
			[ _('Accent', 'footstrap'),  axes.currentAccent, axes.applyAccent, 'var(--fs-accent)' ],
			[ _('Good', 'footstrap'),    axes.currentGood,   axes.applyGood,   'var(--fs-good)' ],
			[ _('Warning', 'footstrap'), axes.currentWarn,   axes.applyWarn,   'var(--fs-warn)' ],
			[ _('Danger', 'footstrap'),  axes.currentDanger, axes.applyDanger, 'var(--fs-danger)' ]
		].map(([ label, current, apply, ink ]) =>
			colourGroup(label, { current, apply }, ink, { fg: ink, bg: CARD_BG, label: ON_CARD }))
	];

	/* ---- the surfaces: the sheet the UI is drawn on ----
	 * Cards, inset controls, the chrome bar and the hairlines between them. Body text is read on
	 * each, so each reports --fs-text against itself. No ink is derived here: --fs-text is the
	 * palette's, and moving it would recolour the very thing being measured against.
	 *
	 * The hairline takes the 3:1 UI-component threshold instead — a border is a shape, not a label
	 * — and below that it is decoration, which a hairline is entitled to be, so the readout states
	 * the number and leaves the call to the admin. */
	const surfaces = [
		/* Same rows, one column wider: a surface reports the ink read ON it, which is --fs-text
		 * for the three that carry body text and the hairline itself for the border. */
		...[
			[ _('Cards', 'footstrap'),           axes.currentCard,    axes.applyCard,    CARD_BG,             INK,                  CARD_BG,             ON_CARD ],
			[ _('Controls', 'footstrap'),        axes.currentControl, axes.applyControl, 'var(--fs-panel2)',  INK,                  'var(--fs-panel2)',  _('on a control', 'footstrap') ],
			[ _('Sidebar and bar', 'footstrap'), axes.currentBar,     axes.applyBar,     'var(--fs-bar-bg)',  INK,                  'var(--fs-bar-bg)',  _('in the sidebar', 'footstrap') ],
			[ _('Borders', 'footstrap'),         axes.currentLine,    axes.applyLine,    'var(--fs-border)',  'var(--fs-border)',   CARD_BG,             ON_CARD, 'shape' ]
		].map(([ label, current, apply, probe, fg, bg, where, kind ]) =>
			colourGroup(label, { current, apply }, probe, { fg, bg, label: where, kind }))
	];

	/* ---- section 3: the wallpaper and the rows each value brings ----
	 *
	 * Wallpaper is three-valued: Off, Pattern (an uploaded SVG, tiled and recoloured) and File (an
	 * uploaded photo). The rows a value brings are SIBLINGS of the Wallpaper row, not children of
	 * its field: nesting a `.cbi-value` inside a `.cbi-value-field` puts a second caption column
	 * inside the first, and those controls started 216px right of every other one on the page,
	 * measured on the router. Flat rows hidden as a group is what the stock pages do with a
	 * dependent field.
	 *
	 * The select is the per-browser switch deciding whether to paint an image, so it is what keeps
	 * the Save button honest; Choose/Remove only swap the picture and never touch the axis. The
	 * native file inputs stay hidden — the styled buttons trigger them. */
	const wallpaper = (() => {
		const err = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });
		const preview = E('img', { 'class': 'fs-ap-bgprev', 'alt': '', 'hidden': '' });
		/* display:none, not `hidden`: a bare `hidden=""` still renders the native
		 * "Choose File / No file chosen" control */
		const fileInput = E('input', { 'type': 'file', 'accept': 'image/*', 'style': 'display:none' });
		const chooseLabel = _('Choose image', 'footstrap');
		const chooseBtn = E('button', { 'class': 'btn cbi-button', 'type': 'button' }, [ chooseLabel ]);
		const removeBtn = E('button', { 'class': 'btn cbi-button-remove', 'type': 'button', 'hidden': '' }, [ _('Remove', 'footstrap') ]);

		const patErr = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });
		const patPreview = E('img', { 'class': 'fs-ap-bgprev', 'alt': '', 'hidden': '' });
		const patInput = E('input', { 'type': 'file', 'accept': 'image/svg+xml,.svg', 'style': 'display:none' });
		const patChooseLabel = _('Choose SVG', 'footstrap');
		const patChoose = E('button', { 'class': 'btn cbi-button', 'type': 'button' }, [ patChooseLabel ]);
		const patRemove = E('button', { 'class': 'btn cbi-button-remove', 'type': 'button', 'hidden': '' }, [ _('Remove', 'footstrap') ]);

		/* Dim: the scrim opacity over the photo. An ordinary per-browser axis — it is in AXIS_KEYS
		 * and snapshotAxes(), so it moves this browser toward or away from the router default and
		 * must be bump()-ed like every other saved axis, or the Save button misreports its own
		 * status. Separate from the Tint strength above. */
		const dimLabel = _('Dim', 'footstrap');
		const scaleLabel = _('Scale', 'footstrap');
		const strengthLabel = _('Strength', 'footstrap');
		const inkLabel = _('Colours', 'footstrap');

		/* The rows the pattern brings. Scale and Strength are live: the appliers write a custom
		 * property, so the tile resizes and fades under the drag. Colours decides whether the
		 * file's own palette is kept or replaced by the theme's — a mask uses the alpha only,
		 * which is right for line art and wrong for artwork that carries its own colours. */
		const patRows = [
			group(_('Pattern', 'footstrap'),
				() => E('div', { 'class': 'fs-ap-bgrow' }, [ patChoose, patRemove ]),
				{ extra: [ patInput, patPreview, patErr ] }),
			group(scaleLabel, (lbl) => sliderCtl(axes.currentPatternSize(), 40, 1600,
				bump(axes.applyPatternSize), lbl, { step: 20 })),
			group(strengthLabel, (lbl) => sliderCtl(axes.currentPatternStrength(), 0, 100,
				bump(axes.applyPatternStrength), lbl, { step: 5 })),
			group(inkLabel, (lbl) => selectCtl(axes.currentPatternInk(), {
				theme:    _('Theme', 'footstrap'),
				original: _('As in file', 'footstrap')
			}, bump(axes.applyPatternInk), lbl))
		];
		/* …and the rows the FILE photo brings. */
		const fileRows = [
			group(_('File', 'footstrap'),
				() => E('div', { 'class': 'fs-ap-bgrow' }, [ chooseBtn, removeBtn ]),
				{ extra: [ fileInput, preview, err ] }),
			group(dimLabel, (lbl) => sliderCtl(axes.currentPhotoDim(), 0, 100,
				bump(axes.applyPhotoDim), lbl, { step: 5 }))
		];

		function reflect(tok) {
			if (tok) { preview.src = axes.loginBgUrl(tok); preview.hidden = false; removeBtn.hidden = false; }
			else { preview.removeAttribute('src'); preview.hidden = true; removeBtn.hidden = true; }
		}
		function reflectPattern(tok) {
			if (tok) { patPreview.src = axes.patternUrl(tok); patPreview.hidden = false; patRemove.hidden = false; }
			else { patPreview.removeAttribute('src'); patPreview.hidden = true; patRemove.hidden = true; }
		}
		/* `hidden` on the row, which 80-appearance.css restates at a specificity beating
		 * `.cbi-value`'s own display (the UA's bare `[hidden]` rule loses to it). Hidden, not
		 * removed: each row holds a live control, so rebuilding on every switch would freeze it to
		 * the state it was constructed in. */
		function togglePanel(v) {
			patRows.forEach((r) => { r.hidden = (v !== 'pattern'); });
			fileRows.forEach((r) => { r.hidden = (v !== 'file'); });
		}
		reflect(axes.currentLoginBg());
		reflectPattern(axes.currentPattern());
		togglePanel(axes.currentWallpaper());

		const setWallpaper = (v) => { axes.applyWallpaper(v); refreshSave(); togglePanel(v); refreshColours(); };

		/* Both uploads present the same three controls and the same four states — pick, upload,
		 * report, remove — so the wiring is stated once. What differs is `after`: the pattern also
		 * has to move the Wallpaper dropdown, because the upload switched this browser onto the
		 * tile and the page would otherwise paint it while the control still read Off.
		 *
		 * The file input is cleared on every change so re-picking the SAME file fires `change`
		 * again, and the button carries its own busy state: the label is restored in `finally`, or
		 * a failed upload leaves "Uploading…" standing for the life of the form. */
		const wireUploader = (u) => {
			const fail = (e) => { u.err.textContent = String((e && e.message) || e); u.err.hidden = false; };
			u.choose.addEventListener('click', () => { u.err.hidden = true; u.input.click(); });
			u.input.addEventListener('change', () => {
				const f = u.input.files && u.input.files[0];
				u.input.value = '';
				if (!f) return;
				u.err.hidden = true; u.choose.disabled = true;
				u.choose.textContent = _('Uploading…', 'footstrap');
				u.upload(f)
					.then((tok) => { u.reflect(tok); if (u.after) u.after(tok); })
					.catch(fail)
					.finally(() => { u.choose.disabled = false; u.choose.textContent = u.label; });
			});
			u.remove.addEventListener('click', () => {
				u.err.hidden = true; u.remove.disabled = true;
				u.drop().then(() => u.reflect('')).catch(fail)
					.finally(() => { u.remove.disabled = false; });
			});
		};

		wireUploader({
			choose: patChoose, remove: patRemove, input: patInput, err: patErr,
			label: patChooseLabel, reflect: reflectPattern,
			upload: assets.uploadPattern, drop: assets.removePattern,
			/* `dom.callClassMethod` is how LuCI moves its own widgets from outside; setWallpaper is
			 * then called directly, because a programmatic setValue emits no `widget-change`. */
			after: () => { dom.callClassMethod(seg, 'setValue', 'pattern'); setWallpaper('pattern'); }
		});

		wireUploader({
			choose: chooseBtn, remove: removeBtn, input: fileInput, err: err,
			label: chooseLabel, reflect: reflect,
			upload: assets.uploadLoginBg, drop: assets.removeLoginBg
		});

		let seg;
		const wallRow = group(_('Wallpaper', 'footstrap'), (label) => {
			seg = selectCtl(axes.currentWallpaper(), {
				off:     _('Off', 'footstrap'),
				pattern: _('Pattern', 'footstrap'),
				file:    _('File', 'footstrap')
			}, setWallpaper, label);
			return seg;
		});

		return [ wallRow ].concat(patRows, fileRows);
	})();

	/* ---- section 4: the router default and the version ----
	 *
	 * Save the current look as the router-wide default (fs-prefs writes /etc/config/footstrap over
	 * the scoped uci ACL). It does not change this browser — localStorage keeps overriding — so the
	 * saved default only shows on a fresh browser. The two Reset buttons below are the escape
	 * hatches, and they do not land in the same place. */
	/* the button/status label said three times below, inside this one build() call — hoisting the
	 * RESULT, not the msgid, so update-po.sh still sees the literal `_()` argument elsewhere
	 * (measured: 22 B x3 -> 27 B, 39 B saved) */
	const SAVE_TO_ROUTER = _('Save to router', 'footstrap');
	/* said twice below, same build() call (measured: 24 B x2 -> 30 B, 18 B saved) */
	const RESET_TO_ROUTER = _('Reset to router', 'footstrap');
	const saveBtn = E('button', { 'class': 'btn cbi-button-action', 'type': 'button' }, [ SAVE_TO_ROUTER ]);
	/* Two resets, because two things sit underneath a browser's tweaks (fs-prefs.js): "Reset to
	 * router" clears them and lets every axis fall back to whatever the router holds, while "Reset
	 * to built-in" writes the theme's built-ins explicitly — the only way to say "as the theme
	 * ships" on a router that has a look of its own. Neither touches /etc/config/footstrap.
	 *
	 * ONE word per state, and "default" is not one of them: it used to name the router's look in
	 * "Save as default" and the theme's in "Reset to default", while the router's look also
	 * answered to "saved" — three names for two states, asked about on the forum (topic 251930,
	 * post 92). The row now reads as one save and two resets, over `router` and `built-in`. */
	const resetSavedBtn = E('button', { 'class': 'btn', 'type': 'button' }, [ RESET_TO_ROUTER ]);
	/* the stock destructive class, so the button discarding every local tweak is the red one
	 * (theme/55-buttons.css). "Reset to router" stays neutral: it steps back to the shared state
	 * rather than discarding. */
	const resetBtn = E('button', { 'class': 'btn cbi-button-negative', 'type': 'button' }, [ _('Reset to built-in', 'footstrap') ]);
	/* Save's only visible failure surface. The realistic failure is the rpc rejecting — an expired
	 * session (403), a missing ACL, ubus down. A DELETED config is not caught: rpcd stages the set
	 * in the session and commit then no-ops without writing the file, returning success (measured
	 * on the router). The package owns that file and the read side falls back to built-in
	 * defaults. */
	const saveErr = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });

	/* The Save button is the status: matching disables it, diverging enables it. Called after every
	 * axis change (via bump).
	 *
	 * Unless the browser refuses storage, where the comparison would always be true — nothing was
	 * written, so every current*() reads the router default back however far the page has been
	 * dragged from it. Say so instead, and leave the button enabled: pushing this browser's look to
	 * the router is the one thing that still works. */
	function refreshSave() {
		if (prefs.storageBroken()) {
			saveBtn.disabled = false;
			saveBtn.textContent = SAVE_TO_ROUTER;
			saveErr.textContent = _('This browser is not storing preferences (site data is blocked), so a change here lasts until you reload. Saving as default still works and applies to every browser.', 'footstrap');
			saveErr.hidden = false;
			return;
		}
		const saved = axes.matchesSavedDefault();
		saveBtn.disabled = saved;
		saveBtn.textContent = saved ? _('Saved to router', 'footstrap') : SAVE_TO_ROUTER;
	}
	saveBtn.addEventListener('click', () => {
		saveBtn.disabled = true;
		saveErr.hidden = true;
		axes.saveAsDefault()
			.then(() => { saveErr.hidden = true; })
			/* on failure refreshSave re-enables the button so the user can retry; the usual cause
			 * is a stale session, which a reload fixes. The raw rpc error stays in a title
			 * tooltip. */
			.catch((e) => {
				saveErr.textContent = _('Could not save the default. Reload the page and try again.', 'footstrap');
				saveErr.title = String((e && e.message) || e);
				saveErr.hidden = false;
			})
			.finally(refreshSave);
	});
	/* Two-click confirm on both: discarding local tweaks is destructive and a native confirm() is
	 * banned in this UI. Arming one disarms the other, so a primed button cannot be fired by a
	 * click meant for its neighbour. Each reload lands back on this same page — an ordinary route,
	 * unlike the tab this once needed a sessionStorage flag to return to. */
	const armed = new Map();
	function disarm(btn, label) {
		armed.delete(btn);
		btn.textContent = label;
		btn.classList.remove('fs-ap-armed');
	}
	function twoClick(btn, label, run) {
		btn.addEventListener('click', () => {
			if (!armed.has(btn)) {
				[ ...armed.keys() ].forEach((other) => disarm(other, armed.get(other)));
				armed.set(btn, label);
				btn.textContent = _('Confirm reset', 'footstrap');
				btn.classList.add('fs-ap-armed');
				return;
			}
			disarm(btn, label);
			run();
			location.reload();
		});
	}
	twoClick(resetSavedBtn, RESET_TO_ROUTER, axes.resetToSaved);
	twoClick(resetBtn, _('Reset to built-in', 'footstrap'), axes.resetToBuiltin);
	refreshSave();	/* correct label and enabled state before the first paint */

	const versionLink = E('a', {
		'class': 'fs-ap-version',
		'href': ver.REPO_URL,
		'target': '_blank',
		/* `noreferrer` alone: it implies noopener, and the theme's other outward links spell it
		 * that way */
		'rel': 'noreferrer'
	}, [ ver.label() ]);

	/* One clause per button, in LuCI's own help-sentence idiom and under the buttons themselves,
	 * because that is where the question is asked: with all three named "save"/"reset" and two of
	 * them resets, the row does not say which state each lands in (forum topic 251930, post 90 —
	 * "what is the difference on 'reset to saved' and 'reset to default'?"). Three lines rather
	 * than a paragraph: three parts want a list, and each is read on its own.
	 *
	 * Text nodes separated by <br>, NOT a child per line: `.cbi-value-field *` in
	 * theme/60-inputs.css hands mono to every descendant and excludes `.cbi-value-description`
	 * itself, so a wrapped line becomes a descendant that the exclusion does not reach — measured,
	 * all three lines came out monospace. Text nodes inherit the sans face from the container, and
	 * one container also means one `?` glyph with every line aligned under it. */
	const buttonHelp = E('div', { 'class': 'cbi-value-description' }, [
		_('Save to router — store this look on the router. Browsers with a look of their own keep it.', 'footstrap'),
		E('br'),
		_('Reset to router — drop this browser\'s changes and follow the router.', 'footstrap'),
		E('br'),
		_('Reset to built-in — go back to the look the theme ships with.', 'footstrap')
	]);

	const defaults = [
		/* the one row whose control is a pair of buttons, each named by its own text, so `make`
		 * ignores the caption rather than re-using it as an aria-label */
		group(_('Saved look', 'footstrap'),
			() => E('div', { 'class': 'fs-ap-actrow' }, [ saveBtn, E('span', { 'class': 'fs-ap-actgap', 'aria-hidden': 'true' }), resetSavedBtn, resetBtn ]),
			{ extra: [ buttonHelp, saveErr ] })
	];


	/* ---- the catalogue this router has not got ----
	 *
	 * The theme's translations are their own packages since 0.14.4, the way every `luci-app-*`
	 * ships them, and nothing in a package manager can read `uci luci.main.lang` to fetch the right
	 * one: apk learns it from `install-if` against `luci-i18n-base-<lang>` (owfeed.yml), opkg has no
	 * conditional form of that at all, and a router upgraded from 0.14.3 through the feed simply
	 * loses the catalogue that used to ride inside the theme (issue #41). `install.sh` covers its
	 * own path; this covers the one nobody ran a script on.
	 *
	 * ASKED OF THE PAGE, not of the package list: the theme has no ubus call of its own and must not
	 * grow one for this. `_()` returns its argument unchanged when no catalogue answers, so asking
	 * for a string the catalogue certainly carries is the whole test.
	 *
	 * `Layout` is that string — a caption this very form renders, present in every catalogue under `po/`. A word
	 * that only LOOKS certain is worse than no check: `Appearance` is in the source but obsolete in
	 * the catalogues (`#~ msgid`), so testing it reported "not translated" on a router whose
	 * Russian catalogue was installed and working.
	 *
	 * The language comes from the document, not from `L.env`, which carries no language field at
	 * all — the dispatcher stamps `<html lang>` and that is what the page knows.
	 *
	 * Nothing is shown on an English or `auto` router, where there is no catalogue to miss. */
	const lang = (document.documentElement.getAttribute('lang') || '').trim();
	const untranslated = lang && lang !== 'en' && lang !== 'auto' &&
		_('Layout', 'footstrap') === 'Layout';
	const missing = untranslated ? E('div', { 'class': 'fs-ap-verrow fs-ap-i18n' }, [
		E('span', {}, [ _('This theme is not translated on this router yet.', 'footstrap') + ' ' ]),
		E('code', {}, [ 'luci-i18n-footstrap-' + lang ])
	]) : '';

	defaults.push(E('div', { 'class': 'fs-ap-footer' }, [
		E('div', { 'class': 'fs-ap-verrow' }, [ versionLink ]),
		missing
	]));

	/* not .cbi-section: inside a tab pane that is a card within a card, and the stock tabs put
	 * their rows straight into the pane. These are grouping headings within one pane, styled by
	 * pages/80-appearance.css. */
	const section = (title, rows) => E('div', { 'class': 'fs-ap-section' }, [
		E('div', { 'class': 'fs-ap-head' }, [ E('h4', {}, [ title ]) ])
	].concat(rows));

	/* ---- the folded groups ----
	 * Nine colour fields and an uploader are the widest rows on the page and most admins never
	 * touch them, so each group is a disclosure, closed by default.
	 *
	 * A disclosure and not a switch: a switch answers "is this feature on", and turning it off
	 * would either revert nine colours or change nothing at all. Opening or closing a fold applies,
	 * un-applies and disables nothing.
	 *
	 * W3C APG disclosure pattern, as the menu's sections use: a <button> owning the region,
	 * `aria-expanded` on it and `aria-controls` pointing at the panel. `hidden` on the panel rather
	 * than a class, so a closed group leaves the tab order and the accessibility tree for free.
	 *
	 * The open/closed state is remembered per browser but is not an axis — it changes nothing about
	 * how the page looks — so it is absent from AXIS_KEYS, snapshotAxes() and the pre-paint. */
	let foldSeq = 0;
	function foldable(title, rows, key) {
		const id = 'fs-ap-fold-' + (++foldSeq);
		let open = (prefs.lsGet(key) === 'on');
		/* id only: `aria-controls` needs one, and no rule has ever styled the panel itself */
		const body = E('div', { 'id': id }, rows);
		const btn = E('button', {
			'type': 'button', 'class': 'fs-ap-fold', 'aria-expanded': String(open), 'aria-controls': id
		}, [
			E('h4', {}, [ title ]),
			/* the same chevron the overview's card toggles draw: an empty box whose ::after is two
			 * borders rotated 45° (pages/20-overview.css), not a second <svg> to keep in step.
			 * Empty and aria-hidden — the state is the button's aria-expanded, which is also what
			 * CSS rotates it off. */
			E('span', { 'class': 'fs-ap-chev', 'aria-hidden': 'true' })
		]);
		const paint = () => {
			body.hidden = !open;
			btn.setAttribute('aria-expanded', String(open));
		};
		btn.addEventListener('click', () => {
			open = !open;
			prefs.lsSet(key, open ? 'on' : 'off');
			paint();
			/* refreshed on open because the axes below may have moved while it was collapsed;
			 * skipped while closed, where nothing is on screen to be wrong */
			if (open) refreshColours();
		});
		paint();
		return E('div', { 'class': 'fs-ap-section' }, [
			E('div', { 'class': 'fs-ap-head' }, [ btn ]), body
		]);
	}

	/* Above the first section, because the misreading this once caused (the tab sat inside the stock
	 * System form, so LuCI's own Save & Apply footer sat under a page it did not save — forum topic
	 * 251930) happened before anyone scrolled to Defaults. The dispatched page has no such footer to
	 * misread: view/footstrap/appearance.js nulls handleSave/handleSaveApply/handleReset, so
	 * view.js's addFooter() renders nothing here, and the caveat sentence that once named it is
	 * gone with the tab. A bare `.alert-message`: theme/35-alerts.css keeps the tinted variants for
	 * a STATUS and a flat panel for a note. */
	const note = E('div', { 'class': 'alert-message fs-ap-note' }, [
		E('p', {}, [ _('Footstrap theme settings apply at once and are stored permanently in this browser.', 'footstrap') ])
	]);

	/* Colours and Surfaces are one fold: the same job, split into two headings only because a
	 * figure and the sheet it sits on are read differently */
	const page = E('div', { 'class': 'fs-ap' }, [
		note,
		section(_('Interface', 'footstrap'), shell),
		foldable(_('Colours', 'footstrap'),
			colours.concat([ E('div', { 'class': 'fs-ap-head fs-ap-sub' }, [ E('h4', {}, [ _('Surfaces', 'footstrap') ]) ]) ], surfaces),
			'fs-ui-colours'),
		foldable(_('Background', 'footstrap'), wallpaper, 'fs-ui-background'),
		section(_('Saving', 'footstrap'), defaults)
	]);

	/* The first fill, deferred one microtask so the tree above is finished. It does not wait for
	 * the form to be in the document: every readout resolves inside fs-widgets against a hidden
	 * probe attached to <body>, so a detached form still reads the live palette. */
	Promise.resolve().then(refreshColours);
	return page;
}

return baseclass.extend({
	/* the dispatched page's whole render(): view/footstrap/appearance.js calls this and nothing
	 * else in this file — no mount, no observer, no deadline, no tab. A menu entry and a route did
	 * that job instead; see the file's own header comment for what used to live here. */
	renderStandalone: () => Promise.resolve().then(build)
});
