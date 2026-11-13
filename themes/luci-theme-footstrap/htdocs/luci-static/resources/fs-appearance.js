'use strict';
'require baseclass';
'require ui';
'require fs-prefs as prefs';
'require fs-axes as axes';
'require fs-router as router';
'require fs-assets as assets';
'require fs-version as ver';

/* The Appearance controls: the DOM that presents the axes. It owns no preference: fs-prefs.js and
 * fs-axes.js hold the axes and fs-version.js the version string. `view/footstrap/appearance.js`
 * calls `renderStandalone()`, the whole surface this file ships.
 *
 * The version line makes no request and must not grow one: which version is installed is what this
 * page answers, and which is available is the package manager's question. */

/* Colour readout. Two questions no stored value answers: what colour a role is right now (the
 * palette's own while the axis is off) and what contrast it lands at. */
let _probe = null;
function probeColor(expr) {
	if (!_probe) {
		/* Off-screen rather than display:none, so the reading does not depend on a display:none element
		 * computing `color` in every engine. Every declaration is !important: an app's CSS can style a
		 * plain <div>. */
		_probe = E('span', { 'id': 'fs-appearance-probe', 'aria-hidden': 'true' });
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

/* A computed colour -> [r,g,b] 0..255, or null. Rasterised, not parsed: a computed `color` keeps the
 * space it was authored in, so `oklch(0.54 0.19 300)` parses as three numbers in the wrong units
 * (measured: #010078, graded "Too faint to read"). Painting one pixel makes the engine convert. */
let _cx = null;
function rasterCtx() {
	if (!_cx) {
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		_cx = cv.getContext('2d', { willReadFrequently: true });
	}
	return _cx;
}
function parseColor(s) {
	const cx = rasterCtx();
	/* fillStyle keeps the last value it could parse, so a colour this engine rejects would
	 * report the previous one as a fresh reading — the trap probeColor() clears for */
	cx.fillStyle = '#000';
	cx.fillStyle = String(s || '');
	cx.clearRect(0, 0, 1, 1);
	cx.fillRect(0, 0, 1, 1);
	const d = cx.getImageData(0, 0, 1, 1).data;
	/* translucent: composite over nothing is meaningless for a readout */
	return d[3] === 255 ? [ d[0], d[1], d[2] ] : null;
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

function toHex(s) {
	const rgb = parseColor(s) || [ 0, 0, 0 ];
	return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/* One colour axis: a native swatch, a hex field and a button back to the palette's own colour.
 * Reports through onPick as a hex string, or 0 for "back to the palette". */
function colorControl(onPick, label, o) {
	const swatch = E('input', { 'type': 'color', 'class': 'fs-color-swatch', 'aria-label': label });
	const field = E('input', {
		'type': 'text', 'class': 'fs-color-hex', 'spellcheck': 'false', 'autocomplete': 'off',
		'inputmode': 'text', 'maxlength': '7', 'aria-label': label
	});
	const clear = E('button', { 'class': 'btn fs-color-clear', 'type': 'button' }, [ _('Palette', 'footstrap') ]);
	const ratio = o.contrast ? E('div', { 'class': 'cbi-value-description fs-color-contrast' }) : null;

	let typed = false;

	/* Repaint everything that mirrors the axis. Called after every edit, and through the returned
	 * refresh() after a preset, palette switch or dark-mode flip — each changes what the palette's
	 * own colour is while this axis stays off. */
	function reflect(v) {
		const live = probeColor(o.probe);
		const hex = (typeof v === 'string') ? v : toHex(live);
		swatch.value = hex;
		/* do not fight the user mid-edit: `#0` is a legal prefix, and overwriting the field on
		 * every keystroke made the input impossible to type into */
		if (document.activeElement !== field) { field.value = hex; typed = false; }
		/* the button back to the palette doubles as the axis state readout: enabled means the axis
		 * holds a colour of its own, disabled means the field shows the palette's */
		clear.disabled = !v;
		if (!ratio) return;
		const r = contrastRatio(o.contrast.fg, o.contrast.bg);
		if (r === null) { ratio.hidden = true; ratio.removeAttribute('title'); return; }
		/* The readout states what the ratio means; the number itself stays in the title. Thresholds are
		 * WCAG AA: 4.5:1 for body text, 3:1 for large text and for a UI shape. */
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
		/* a pass says nothing: nine "easy to read" lines buried the one that was not */
		ratio.hidden = (grade.cls === 'fs-contrast-aa');
		ratio.title = _('Contrast %s:1 (WCAG AA wants %s:1 here)', 'footstrap')
			.format(r.toFixed(1), (o.contrast.kind === 'shape') ? '3' : '4.5');
	}

	const pick = (v) => { onPick(v); reflect(v); };

	swatch.addEventListener('input', () => pick(swatch.value.toLowerCase()));
	/* commit on blur and Enter, not per keystroke: a half-typed `#0096` would repaint the page
	 * under the cursor. An unparseable value snaps back to what the axis holds, so the field
	 * cannot claim a colour the page is not painted in. An untouched field returns first, so a
	 * bare Tab-through never pins the shown palette colour on any of the 9 axes. */
	const commit = () => {
		if (!typed) return;
		const v = field.value.trim().toLowerCase();
		if ((/^#[0-9a-f]{6}$/).test(v)) pick(v);
		/* re-read rather than a cached copy: the page can change what the axis holds behind this
		 * control (a preset, Reset to built-in), which a snapshot taken at build time would miss */
		else reflect(o.read());
	};
	field.addEventListener('input', () => { typed = true; });
	field.addEventListener('blur', commit);
	field.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } });
	clear.addEventListener('click', () => pick(0));

	const wrap = E('div', { 'class': 'fs-colorctl' }, [
		E('div', { 'class': 'fs-color-row' }, [ swatch, field, clear ])
	].concat(ratio ? [ ratio ] : []));
	/* the caller decides when this runs: probeColor() needs the document, and this control is not
	 * in it yet */
	wrap.fsRefresh = () => reflect(o.read());
	return wrap;
}

/* Every stamp that moves a colour lands on :root, including head.ut's OS listener and an app
 * rewriting data-darkmode, neither of which calls back here. */
let _watch = null;
function unwatchColours() {
	if (_watch) _watch.disconnect();
	_watch = null;
}
router.onNavigate(unwatchColours);
function watchColours(refresh) {
	unwatchColours();
	_watch = new MutationObserver(refresh);
	_watch.observe(document.documentElement, {
		attributes: true, attributeFilter: [ 'data-darkmode', 'data-palette', 'data-wallpaper' ]
	});
}

/* Build the page; renderStandalone() hands it over. Four tabs, most-used first: the colour scheme,
 * the interface, the background with its glass and the colours nobody touches twice; Saving sits
 * under them. Everything applies at once and is this browser's, in localStorage; only "Save to
 * router" writes anything, pushing the current look to the router for other browsers. */
function build() {
	/* 24.10.0-24.10.2 have no ui.RangeSlider and a package from the feed still installs there (opkg does
	 * not version luci-base); one readable line beats the raw "not a constructor" TypeError. */
	if (!ui.RangeSlider)
		return E('p', { 'class': 'alert-message warning' }, [ _('Footstrap needs OpenWrt 24.10.3 or newer.', 'footstrap') ]);

	/* every saved axis re-checks the Save button after applying, so it greys the moment this
	 * browser matches the saved default and un-greys when it diverges. Wrapped around the appliers
	 * because the controls call them directly and have no other seam back here. */
	const bump = (fn) => (v) => { fn(v); refreshSave(); };

	/* Every colour control mirrors something it does not own: the palette's colour while its own
	 * axis is off, and the contrast that colour lands at. A palette switch or dark-mode flip moves
	 * all of it under controls nobody touched, so they refresh together. */
	const colourCtls = [];
	const refreshColours = () => colourCtls.forEach((c) => c.fsRefresh());
	const repaint = (fn) => (v) => { fn(v); refreshColours(); };

	/* One captioned row in LuCI's own shape: `.cbi-value` > `label.cbi-value-title` +
	 * `.cbi-value-field`, which base/30-forms.css and theme/60-inputs.css already lay out. `make` is
	 * handed the caption because each control needs it again as the aria-label of its inner
	 * input/select (a stock widget's wrapper div cannot carry a name). `o.desc` is a help line under
	 * the control, `o.extra` the rows with more than a control, `o.cls` marks the rows CSS singles out. */
	const group = (label, make, opts) => {
		const o = opts || {};
		const desc = o.desc ? [ E('div', { 'class': 'cbi-value-description' }, [ o.desc ]) ] : [];
		return E('div', { 'class': 'cbi-value' + (o.cls ? ' ' + o.cls : '') }, [
			E('label', { 'class': 'cbi-value-title' }, [ label ]),
			E('div', { 'class': 'cbi-value-field' }, [ make(label) ].concat(desc, o.extra || []))
		]);
	};

	/* the three literals every colour row repeats; a string literal survives minification intact */
	const CARD_BG = 'var(--fs-panel)', INK = 'var(--fs-text)', ON_CARD = _('on a card', 'footstrap');

	/* A list of more than five, the palette, is a `ui.Select`; every number a `ui.RangeSlider`, already
	 * dressed by base/30-forms.css and theme/60-inputs.css (`ui.RangeSlider` reached openwrt-24.10 in
	 * 24.10.3). Listen for `widget-change`, the seam UIElement publishes, not an event on the inner
	 * element. RangeSlider also emits `widget-update` while the handle moves, which resizes the page
	 * under the drag; the appliers are idempotent, so wiring both costs nothing. */
	const selectCtl = (current, choices, apply, label) => {
		/* an array of [value, label] pairs when a key is integer-like: Object.keys hoists it ahead of
		 * the authored order ('2020' rendered above Footstrap, the default); `sort` pins the order */
		const pairs = Array.isArray(choices) ? choices : Object.entries(choices);
		const w = new ui.Select(String(current), Object.fromEntries(pairs), { widget: 'select', sort: pairs.map((p) => p[0]) });
		const node = w.render();
		node.querySelector('select, input').setAttribute('aria-label', label);
		node.addEventListener('widget-change', () => apply(w.getValue()));
		return node;
	};

	/* Two to three short choices are one row of pills, every choice in sight: native radios under one
	 * name, so the arrow keys move between them and a screen reader counts them; 80-appearance.css
	 * draws the pills. */
	let segSeq = 0;
	const segCtl = (current, choices, apply, label) => {
		const name = 'fs-ap-seg-' + (++segSeq);
		const pairs = Array.isArray(choices) ? choices : Object.entries(choices);
		return E('div', { 'class': 'fs-seg', 'role': 'radiogroup', 'aria-label': label }, pairs.map(([ v, text ]) => {
			const input = E('input', { 'type': 'radio', 'name': name, 'value': v });
			input.checked = (String(current) === v);
			input.addEventListener('change', () => { if (input.checked) apply(v); });
			return E('label', {}, [ input, E('span', {}, [ text ]) ]);
		}));
	};

	const sliderCtl = (axis, apply, label, opts) => {
		const o = opts || {};
		const w = new ui.RangeSlider(String(axis.current()), {
			min: axis.min, max: axis.max, step: o.step || 1
		});
		const node = w.render();
		node.querySelector('select, input').setAttribute('aria-label', label);
		const push = () => apply(parseInt(w.getValue(), 10));
		/* `live: false` for an axis whose value moves this control: Content width widens the column the
		 * page is drawn in, so applying mid-drag slides the handle from under the pointer and one small
		 * drag runs to the maximum. A keyboard user still applies at once (an arrow key fires `change`). */
		if (o.live !== false) node.addEventListener('widget-update', push);
		node.addEventListener('widget-change', push);
		return node;
	};

	const colourGroup = (label, axis, probe, contrast, opts = {}) => group(label, (lbl) => {
		const ctl = colorControl(bump(axis.apply), lbl, {
			probe: probe,
			read: axis.current,
			contrast: contrast
		});
		colourCtls.push(ctl);
		return ctl;
	}, opts);

	/* a card is a stock `.cbi-section` under its own title; a tab pane is one whose title is its tab
	 * (ui.tabs reads data-tab-title); a subheading splits either in two */
	const card = (title, rows) => E('div', { 'class': 'cbi-section fs-ap-card' }, [ E('h3', {}, [ title ]) ].concat(rows));
	const pane = (name, title, rows) => E('div', { 'class': 'cbi-section fs-ap-card', 'data-tab': name, 'data-tab-title': title }, rows);
	const sub = (title, cls) => E('div', { 'class': 'fs-ap-sub' + (cls ? ' ' + cls : '') }, [ E('h4', {}, [ title ]) ]);

	/* Every label here carries the 'footstrap' context: LuCI serves one merged catalogue and the first
	 * archive holding the hash wins, so a bare msgid is a global name any luci-app can win. */

	/* ---- the colour scheme: what most visits come to change ---- */
	const scheme = pane('scheme', _('Colour scheme', 'footstrap'), [
		group(_('Mode', 'footstrap'), (label) => segCtl(prefs.currentMode(), [
			[ 'auto',  _('Auto', 'footstrap') ],
			[ 'light', _('Light', 'footstrap') ],
			[ 'dark',  _('Dark', 'footstrap') ]
		], bump(prefs.applyMode), label)),

		group(_('Palette', 'footstrap'), (label) => selectCtl(axes.palette.current(), [
			[ 'footstrap', 'Footstrap' ],
			[ 'hicontrast', 'Hi-Contrast' ],
			[ 'bootstrap', 'Bootstrap' ],
			/* names another package, luci-theme-openwrt-2020, whose colourway this is */
			[ '2020', 'OpenWrt 2020' ],
			[ 'forum', 'Forum' ]
		], bump(axes.palette.apply), label)),

		/* Accent recolours the accented controls (buttons, toggles, sliders, focus rings), not the
		 * canvas; any #rrggbb is taken. Read as text on a card, the use that fails first (as a fill it
		 * carries derived ink). */
		colourGroup(_('Accent', 'footstrap'), axes.accent, 'var(--fs-accent)',
			{ fg: 'var(--fs-accent)', bg: CARD_BG, label: ON_CARD })
	]);

	/* ---- the interface ---- */
	const iface = pane('interface', _('Interface', 'footstrap'), [
		group(_('Layout', 'footstrap'), (label) => segCtl(prefs.currentLayout(), [
			[ 'sidebar', _('Sidebar', 'footstrap') ],
			[ 'top',     _('Top', 'footstrap') ]
		], bump(prefs.applyLayout), label)),

		/* always built and hidden by CSS in the top layout (:root[data-layout="top"] .fs-ap-submenus):
		 * the page is built once, so a currentLayout() branch would freeze it to the layout the page
		 * loaded in while CSS morphs the chrome live */
		group(_('Submenus', 'footstrap'), (label) => segCtl(prefs.currentAutoCollapse() ? 'on' : 'off', [
			[ 'off', _('Keep open', 'footstrap') ],
			[ 'on',  _('Auto-collapse', 'footstrap') ]
		], bump(prefs.applyAutoCollapse), label), { cls: 'fs-ap-submenus' }),

		group(_('Density', 'footstrap'), (label) => segCtl(axes.density.current(), [
			[ 'compact', _('Compact', 'footstrap') ],
			[ 'normal',  _('Normal', 'footstrap') ],
			[ 'large',   _('Large', 'footstrap') ]
		], bump(axes.density.apply), label)),

		/* the content column's own cap, separate from Density. The slider starts at the 1280px every
		 * page was designed against and only widens, which also keeps --fs-content-min (500px, what
		 * the sidebar-to-bar fold is measured against) out of reach by construction. */
		group(_('Content width', 'footstrap'),
			(label) => sliderCtl(axes.contentWidth, bump(axes.contentWidth.apply), label, { step: 40, live: false })),

		group(_('Rounding', 'footstrap'),
			(label) => sliderCtl(axes.radius, bump(axes.radius.apply), label))
	]);

	/* ---- the background: the canvas, the wallpaper and the glass over it ----
	 * The rows a value brings are siblings of the Wallpaper row: nested in its `.cbi-value-field`
	 * they started 216px right of every other control (measured on the router). They are hidden as
	 * a group, as stock pages do with a dependent field. The pills are the per-browser switch that
	 * keeps the Save button honest; Choose/Remove only swap the picture and never touch the axis. */
	const REMOVE = _('Remove', 'footstrap');
	const background = (() => {
		const err = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });
		const preview = E('img', { 'class': 'fs-ap-bgprev', 'alt': '', 'hidden': '' });
		const fileInput = E('input', { 'type': 'file', 'accept': 'image/*', 'style': 'display:none' });
		const chooseLabel = _('Choose image', 'footstrap');
		const chooseBtn = E('button', { 'class': 'btn cbi-button', 'type': 'button' }, [ chooseLabel ]);
		const removeBtn = E('button', { 'class': 'btn cbi-button-remove', 'type': 'button', 'hidden': '' }, [ REMOVE ]);

		const patErr = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });
		const patPreview = E('img', { 'class': 'fs-ap-bgprev', 'alt': '', 'hidden': '' });
		const patInput = E('input', { 'type': 'file', 'accept': 'image/svg+xml,.svg', 'style': 'display:none' });
		const patChooseLabel = _('Choose SVG', 'footstrap');
		const patChoose = E('button', { 'class': 'btn cbi-button', 'type': 'button' }, [ patChooseLabel ]);
		const patRemove = E('button', { 'class': 'btn cbi-button-remove', 'type': 'button', 'hidden': '' }, [ REMOVE ]);

		/* Colours decides whether the file's own palette is kept or replaced by the theme's: a mask
		 * uses the alpha only, right for line art and wrong for artwork with its own colours. */
		const patRows = [
			group(_('Pattern', 'footstrap'),
				() => E('div', { 'class': 'fs-ap-bgrow' }, [ patChoose, patRemove ]),
				{ extra: [ patInput, patPreview, patErr ] }),
			group(_('Scale', 'footstrap'), (lbl) => sliderCtl(axes.patternSize, bump(axes.patternSize.apply), lbl, { step: 20 })),
			group(_('Strength', 'footstrap'), (lbl) => sliderCtl(axes.patternStrength, bump(axes.patternStrength.apply), lbl, { step: 5 })),
			group(_('Colours', 'footstrap'), (lbl) => segCtl(axes.patternInk.current(), [
				[ 'theme',    _('Theme', 'footstrap') ],
				[ 'original', _('As in file', 'footstrap') ]
			], bump(axes.patternInk.apply), lbl))
		];
		/* Dim is an ordinary saved axis, so it is bump()-ed or the Save button misreports its status */
		const fileRows = [
			group(_('File', 'footstrap'),
				() => E('div', { 'class': 'fs-ap-bgrow' }, [ chooseBtn, removeBtn ]),
				{ extra: [ fileInput, preview, err ] }),
			group(_('Dim', 'footstrap'), (lbl) => sliderCtl(axes.photoDim, bump(axes.photoDim.apply), lbl, { step: 5 }))
		];

		function reflect(tok) {
			if (tok) { preview.src = axes.loginBg.url(tok); preview.hidden = false; removeBtn.hidden = false; }
			else { preview.removeAttribute('src'); preview.hidden = true; removeBtn.hidden = true; }
		}
		function reflectPattern(tok) {
			if (tok) { patPreview.src = axes.pattern.url(tok); patPreview.hidden = false; patRemove.hidden = false; }
			else { patPreview.removeAttribute('src'); patPreview.hidden = true; patRemove.hidden = true; }
		}
		/* `hidden` on the row, which base/10-reset.css restates with !important (the UA's bare
		 * `[hidden]` loses to `.cbi-value`'s display). Hidden, not removed: each row holds a live
		 * control that a rebuild would freeze to its construction-time state. */
		function togglePanel(v) {
			patRows.forEach((r) => { r.hidden = (v !== 'pattern'); });
			fileRows.forEach((r) => { r.hidden = (v !== 'file'); });
		}
		reflect(axes.loginBg.current());
		reflectPattern(axes.pattern.current());
		togglePanel(axes.wallpaper.current());

		const setWallpaper = (v) => { axes.wallpaper.apply(v); refreshSave(); togglePanel(v); };

		/* Both uploads share one wiring (pick, upload, report, remove) and never move the Wallpaper
		 * pills, which the user may change mid-upload. The input is cleared on every change so
		 * re-picking the same file fires `change`; the label is restored in `finally`, or a failed
		 * upload leaves "Uploading…" standing. */
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
					.then(u.reflect)
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
			upload: assets.uploadPattern, drop: assets.removePattern
		});

		wireUploader({
			choose: chooseBtn, remove: removeBtn, input: fileInput, err: err,
			label: chooseLabel, reflect: reflect,
			upload: assets.uploadLoginBg, drop: assets.removeLoginBg
		});

		/* The glass rows show only over a wallpaper (CSS: .fs-ap-glass), Material only while a
		 * surface is glass at all, Blur only for a material that blurs. An OS asking for less
		 * transparency or more contrast keeps the surfaces solid whatever the sliders say, and the
		 * page says so. */
		const glassRows = [
			sub(_('Transparency', 'footstrap'), 'fs-ap-glass'),
			group(_('Card opacity', 'footstrap'),
				(lbl) => sliderCtl(axes.cardOpacity, bump(axes.cardOpacity.apply), lbl, { step: 5 }), {
					cls: 'fs-ap-glass',
					desc: axes.glassBlocked() ? _('The system asks for less transparency or more contrast, so surfaces stay solid.', 'footstrap') : null
				}),
			group(_('Menu opacity', 'footstrap'),
				(lbl) => sliderCtl(axes.barOpacity, bump(axes.barOpacity.apply), lbl, { step: 5 }), { cls: 'fs-ap-glass' }),
			group(_('Material', 'footstrap'), (lbl) => segCtl(axes.material.current(), [
				[ 'flat',    _('Flat', 'footstrap') ],
				[ 'frosted', _('Frosted', 'footstrap') ],
				[ 'acrylic', _('Acrylic', 'footstrap') ]
			], bump(axes.material.apply), lbl), { cls: 'fs-ap-glass fs-ap-material' }),
			group(_('Blur', 'footstrap'),
				(lbl) => sliderCtl(axes.blur, bump(axes.blur.apply), lbl, { step: 10 }), { cls: 'fs-ap-glass fs-ap-material fs-ap-blur' })
		];

		return pane('background', _('Background', 'footstrap'), [
			/* the canvas colour that tells routers apart; CSS hides it under a photo, which covers it */
			colourGroup(_('Tint', 'footstrap'), axes.tint, 'var(--fs-bg)', {
				fg: 'var(--fs-text)', bg: 'var(--fs-bg)', label: _('on the canvas', 'footstrap')
			}, { cls: 'fs-ap-tint', desc: _('Colours the page so you can tell routers apart.', 'footstrap') }),

			/* the strength half of the Tint, meaningful only in hue mode (a hex canvas has no chroma of
			 * ours to scale); CSS hides it otherwise. Not named "Density": the string is also the
			 * aria-label, so a screen reader would announce two rows under one name. */
			group(_('Tint strength', 'footstrap'),
				(label) => sliderCtl(axes.tintStrength, bump(repaint(axes.tintStrength.apply)), label, {
					step: 5
				}), { cls: 'fs-ap-tint fs-ap-tintstr' }),

			group(_('Wallpaper', 'footstrap'), (label) => segCtl(axes.wallpaper.current(), [
				[ 'off',     _('Off', 'footstrap') ],
				[ 'pattern', _('Pattern', 'footstrap') ],
				[ 'file',    _('File', 'footstrap') ]
			], setWallpaper, label))
		].concat(patRows, fileRows, glassRows));
	})();

	/* ---- the colours nobody touches twice: the last tab ----
	 * The three status colours, then the surfaces: the sheet the UI is drawn on. Body text is read on
	 * each surface, so each reports --fs-text against itself; no ink is derived, since moving
	 * --fs-text would recolour what is measured against. The hairline takes the 3:1 UI-component
	 * threshold (a border is a shape). The rows are data because a string literal repeated eight
	 * times is not mangled by the minifier. */
	const colourRows = [
		...[
			[ _('Good', 'footstrap'),    axes.good,   'var(--fs-good)' ],
			[ _('Warning', 'footstrap'), axes.warn,   'var(--fs-warn)' ],
			[ _('Danger', 'footstrap'),  axes.danger, 'var(--fs-danger)' ]
		].map(([ label, axis, ink ]) =>
			colourGroup(label, axis, ink, { fg: ink, bg: CARD_BG, label: ON_CARD })),
		sub(_('Surfaces', 'footstrap')),
		...[
			[ _('Cards', 'footstrap'),           axes.card,    CARD_BG,             INK,                  CARD_BG,             ON_CARD ],
			[ _('Controls', 'footstrap'),        axes.control, 'var(--fs-panel2)',  INK,                  'var(--fs-panel2)',  _('on a control', 'footstrap') ],
			[ _('Sidebar and bar', 'footstrap'), axes.bar,     'var(--fs-bar-bg)',  INK,                  'var(--fs-bar-bg)',  _('in the sidebar', 'footstrap') ],
			[ _('Borders', 'footstrap'),         axes.line,    'var(--fs-border)',  'var(--fs-border)',   CARD_BG,             ON_CARD, 'shape' ]
		].map(([ label, axis, probe, fg, bg, where, kind ]) =>
			colourGroup(label, axis, probe, { fg, bg, label: where, kind }))
	];

	/* ---- saving: the router default and the version ----
	 * Save writes the current look to /etc/config/footstrap over the scoped uci ACL. It does not
	 * change this browser (localStorage keeps overriding), so it only shows on a fresh browser. */
	/* each label is said twice in build(); hoisted, a msgid is paid once (24 B x2 -> 30 B) */
	const SAVE_TO_ROUTER = _('Save to router', 'footstrap');
	const RESET_TO_ROUTER = _('Reset to router', 'footstrap');
	const RESET_TO_BUILTIN = _('Reset to built-in', 'footstrap');
	const saveBtn = E('button', { 'class': 'btn cbi-button-action', 'type': 'button' }, [ SAVE_TO_ROUTER ]);
	/* Two resets, because two things sit underneath a browser's tweaks: "Reset to router" clears them
	 * and lets every axis fall back to the router, "Reset to built-in" writes the theme's defaults
	 * explicitly. Neither touches /etc/config/footstrap. "Default" is not a label: it named the
	 * router's look in "Save as default" and the theme's in "Reset to default", three names for two
	 * states (forum topic 251930, post 92). */
	const resetSavedBtn = E('button', { 'class': 'btn', 'type': 'button' }, [ RESET_TO_ROUTER ]);
	const resetBtn = E('button', { 'class': 'btn cbi-button-negative', 'type': 'button' }, [ RESET_TO_BUILTIN ]);
	/* Save's only visible failure surface: the rpc rejecting (expired session 403, missing ACL, ubus
	 * down). A deleted config is not caught: commit no-ops and returns success (measured on the
	 * router); the package owns that file and the read side falls back to built-in defaults. */
	const saveErr = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });

	/* The Save button is the status: matching disables it, diverging enables it. A browser that
	 * refuses storage keeps its choices in fs-prefs's in-memory map, so the comparison stays honest;
	 * the note waits while a failed Save's error shows, or the .finally below would overwrite it. */
	function refreshSave() {
		if (prefs.storageBroken() && saveErr.hidden) {
			saveErr.textContent = _('This browser is not storing preferences (site data is blocked), so a change here lasts until you reload. Saving to the router still works and applies to every browser.', 'footstrap');
			saveErr.hidden = false;
		}
		const saved = axes.matchesSavedDefault();
		saveBtn.disabled = saved;
		saveBtn.textContent = saved ? _('Saved to router', 'footstrap') : SAVE_TO_ROUTER;
	}
	saveBtn.addEventListener('click', () => {
		saveBtn.disabled = true;
		saveErr.hidden = true;
		saveErr.title = '';	/* a stale rpc error would tooltip the storage note (measured: 'ubus code 6' over it) */
		axes.saveAsDefault()
			/* on failure refreshSave re-enables the button so the user can retry; the usual cause
			 * is a stale session, which a reload fixes. The raw rpc error stays in a title
			 * tooltip. */
			.catch((e) => {
				saveErr.textContent = _('Could not save to the router. Reload the page and try again.', 'footstrap');
				saveErr.title = String((e && e.message) || e);
				saveErr.hidden = false;
			})
			.finally(refreshSave);
	});
	/* Two-click confirm on both: discarding local tweaks is destructive and a native confirm() is
	 * banned in this UI. Arming one disarms the other, so a primed button cannot be fired by a
	 * click meant for its neighbour. */
	let armed = null;
	function disarm() {
		if (!armed) return;
		armed.btn.textContent = armed.label;
		armed.btn.classList.remove('fs-ap-armed');
		armed = null;
	}
	function twoClick(btn, label, run) {
		btn.addEventListener('click', () => {
			if (armed && armed.btn === btn) {
				disarm();
				run();
				location.reload();
				return;
			}
			disarm();
			armed = { btn: btn, label: label };
			btn.textContent = _('Confirm reset', 'footstrap');
			btn.classList.add('fs-ap-armed');
		});
	}
	twoClick(resetSavedBtn, RESET_TO_ROUTER, axes.resetToSaved);
	twoClick(resetBtn, RESET_TO_BUILTIN, axes.resetToBuiltin);
	refreshSave();	/* correct label and enabled state before the first paint */

	const versionLink = E('a', {
		'class': 'fs-ap-version',
		'href': ver.REPO_URL,
		'target': '_blank',
		/* `noreferrer` alone: it implies noopener, and the theme's other outward links spell it
		 * that way */
		'rel': 'noreferrer'
	}, [ ver.label() ]);

	/* The theme's translations are their own packages, and nothing in a package manager can read `uci
	 * luci.main.lang` to fetch the right one. */
	const lang = (document.documentElement.getAttribute('lang') || '').trim();
	const untranslated = lang && lang !== 'en' && lang !== 'auto' &&
		_('Layout', 'footstrap') === 'Layout';
	const missing = untranslated ? E('div', { 'class': 'fs-ap-verrow fs-ap-i18n' }, [
		E('span', {}, [ _('This theme is not translated on this router yet.', 'footstrap') + ' ' ]),
		E('code', {}, [ 'luci-i18n-footstrap-' + lang ])
	]) : '';

	const saving = card(_('Saving', 'footstrap'), [
		E('p', { 'class': 'fs-ap-lead' }, [ _('Footstrap theme settings apply at once and are stored permanently in this browser.', 'footstrap') ]),
		E('div', { 'class': 'fs-ap-actrow' }, [ saveBtn, E('span', { 'class': 'fs-ap-actgap', 'aria-hidden': 'true' }), resetSavedBtn, resetBtn ]),
		saveErr,
		E('ul', { 'class': 'fs-ap-help' }, [
			E('li', {}, [ _('Save to router — store this look on the router. Browsers with a look of their own keep it.', 'footstrap') ]),
			E('li', {}, [ _('Reset to router — drop this browser\'s changes and follow the router.', 'footstrap') ]),
			E('li', {}, [ _('Reset to built-in — go back to the look the theme ships with.', 'footstrap') ])
		]),
		E('div', { 'class': 'fs-ap-footer' }, [
			E('div', { 'class': 'fs-ap-verrow' }, [ versionLink ]),
			missing
		])
	]);

	/* LuCI's own tab group, as on every tabbed form: it puts the strip before the panes and keeps
	 * the open tab for the session. A pane shown again re-reads its colours, which a palette or
	 * dark-mode change may have moved while it was hidden. */
	const panes = E('div', { 'class': 'fs-ap-panes' }, [
		scheme,
		iface,
		background,
		pane('colours', _('Colours', 'footstrap'), colourRows)
	]);
	const page = E('div', { 'class': 'fs-ap' }, [ panes, saving ]);
	ui.tabs.initTabGroup(panes.childNodes);
	panes.addEventListener('cbi-tab-active', refreshColours);

	Promise.resolve().then(refreshColours);

	watchColours(refreshColours);
	return page;
}

return baseclass.extend({
	/* the dispatched page's whole render(), called by view/footstrap/appearance.js */
	renderStandalone: () => Promise.resolve().then(build),
});
