'use strict';
'require baseclass';
'require ui';
'require dom';
'require fs-prefs as prefs';
'require fs-widgets as widgets';
'require fs-version as ver';

/* The Appearance CONTROLS: the DOM that presents the axes. It owns no preference — fs-prefs.js
 * holds the axes, fs-version.js the version string; this file is the form they are shown in.
 *
 * WHERE IT LIVES. It used to be a popover hanging off a button in the chrome; it is now a TAB on
 * System -> System (admin/system/system), beside General Settings / Logging / Time Synchronization
 * / Language and Style — the page an admin already opens to set the things that are not network. The axes had outgrown a floating panel — twenty-one of
 * them, nine carrying a colour field, a swatch and a contrast readout — and a dialog that has to trap Tab,
 * place itself against a viewport edge and stay inside a 320px column is the wrong container for
 * that. Keeping BOTH would have meant every axis rendered twice, which is the failure this file's
 * own history is made of.
 *
 * It is appended by a MutationObserver rather than by a route of its own, and that is the same
 * boundary fs-overview.js sits on: a THEME may not own a dispatcher node, because a node outlives
 * the theme that registered it — switch to another theme and the menu keeps an entry whose view is
 * gone. So the theme owns no menu.d and no view; it watches for the stock page and adds one
 * section to it, additively, and removes nothing. Off the footstrap theme, or on any other page,
 * nothing runs at all.
 *
 * THE VERSION LINE MAKES NO REQUEST and must not grow one. Which version is INSTALLED is what this
 * page answers; which version is available is the package manager's question, and a theme polling a
 * release API to re-answer it from a settings page is the wrong shape twice over — it reaches the
 * network from a page that has no business doing so, and it reimplements `apk upgrade`. */

/* THE COLOUR PRESETS WERE HERE — eight chips that wrote the Accent axis, each painted in the
 * colour it would set. They are gone, and what they were for is not: the request behind them
 * (#20, "the blue theme is cool but sometimes you want grey or black") is answered by the Accent
 * row itself, which takes any #rrggbb and sits three rows below where the chips used to be. A
 * preset only ever wrote that one axis, so the chips were a second, prettier way to do the thing
 * the field already does — and they were the one control on this page that looked like nothing
 * else in LuCI: a bare row of coloured pills starting at the card's edge rather than at the field
 * column, which is what made the tab read as ragged. */

/* Build the whole form. Returns a promise for one element wire() appends to the stock page.
 *
 * Everything applies IMMEDIATELY — there is no Save button for the axes themselves, because there
 * is nothing to save: every axis is this browser's, in localStorage, and the page repaints under
 * the control as it moves. The one button that writes anything is "Save as default", which pushes
 * the current look to the ROUTER for other browsers. That distinction is the whole model
 * (docs/design-system.md) and it is why this page has no Save/Reset footer of LuCI's own. */
function render() {
	/* A promise, and the build runs INSIDE it rather than as its argument: `Promise.resolve(build())`
	 * evaluates build() synchronously, so a throw in it unwound out of render() before mount() could
	 * attach .catch/.finally — leaving mount()'s _building flag set for the life of the document. The
	 * tab then never built again on that page and nothing was logged, which is both channels silent
	 * at once. Deferred like this, the same throw lands in the .catch that exists for it. */
	return Promise.resolve().then(build);
}

function build() {
	/* every saved axis re-checks the Save button after it applies, so the button greys the moment
	 * this browser matches the saved default again and un-greys the moment it diverges. Wrapped
	 * around the appliers because the seg/slider/colour controls call them directly and have no
	 * other seam back to here. refreshSave is a hoisted function declaration; saveBtn it reads is
	 * assigned below, before any of these fire (all are user events). */
	const bump = (fn) => (v) => { fn(v); refreshSave(); };

	/* Every colour control mirrors something it does not own — the PALETTE's colour, while its own
	 * axis is off, and the contrast that colour lands at. A palette switch, a dark-mode flip or a
	 * preset changes all of that under controls nobody touched, so they are refreshed together
	 * rather than each listening for what might have moved. */
	const colourCtls = [];
	const refreshColours = () => colourCtls.forEach((c) => c.fsRefresh());
	/* wrap an applier so the colour readouts follow it: mode and palette change what every axis is
	 * measured against, and a preset changes the axes themselves */
	const repaint = (fn) => (v) => { fn(v); refreshColours(); };

	/* One captioned row, in LuCI's OWN row shape: `.cbi-value` > `label.cbi-value-title` +
	 * `.cbi-value-field`. This tab used to draw its own two-column grid of stacked cards — an
	 * uppercase eyebrow above each control — which made the theme's settings the one page in LuCI
	 * that did not look like LuCI. Sitting beside General Settings / Logging / Time Synchronization /
	 * Language and Style, the odd one out was ours.
	 *
	 * Nothing here styles those class names: `.cbi-value` is stock, base/30-forms.css and
	 * theme/60-inputs.css already lay it out (title column, field column, hairline under each row),
	 * so this page now inherits every future fix to the form layout instead of keeping a private
	 * copy of it. That also means the row lives on a SHARED surface — Zone 2, where a third-party
	 * app is entitled to win on specificity — which is exactly right for a page rendered inside
	 * #view rather than for chrome.
	 *
	 * `make` is handed the SAME label string the caption renders, because every control in here
	 * needs it a second time as its aria-label (segControl/sliderControl/colorControl take it as
	 * their last argument) — and stating it twice is how the visible caption and what a screen
	 * reader announces drift apart. One literal per axis, used by both, with nothing to keep in
	 * sync. `extra` is for the rows that carry more than a control (the Save row's error line),
	 * `opts.cls` for the rows CSS has to be able to single out. */
	const group = (label, make, opts) => {
		const o = opts || {};
		return E('div', { 'class': 'cbi-value' + (o.cls ? ' ' + o.cls : '') }, [
			E('label', { 'class': 'cbi-value-title' }, [ label ]),
			E('div', { 'class': 'cbi-value-field' }, [ make(label) ].concat(o.extra || []))
		]);
	};

	/* ---- the CONTROLS are LuCI's own, not this theme's ------------------------------------------
	 *
	 * Every enum axis is a `ui.Select` and every number is a `ui.RangeSlider` — the same widgets the
	 * form on the other tabs is built from, so a dropdown here is the dropdown an admin already knows
	 * and the theme's own stylesheet already dresses (`select` in base/30-forms.css,
	 * `.cbi-range-slider` in theme/60-inputs.css). Both classes exist on every release this theme
	 * supports — checked against luci's own openwrt-24.10 branch, not only against master, because
	 * `ui.RangeSlider` is exactly the widget that did not exist further back.
	 *
	 * What this replaces is two primitives of ours: a segmented radiogroup with a roving tabindex and
	 * a range wrapper with a live readout. They were written when this page was a floating popover
	 * and a `<select>` inside it read as a hole in the card. On a page there is no such argument, and
	 * a control LuCI maintains is one this theme cannot get wrong on its own.
	 *
	 * THE EVENT IS `widget-change`, dispatched by UIElement, not a listener on the inner element —
	 * that is the seam the widget publishes, and reaching past it to the `<select>` would tie us to
	 * how it happens to be built today. RangeSlider also emits `widget-update` while the handle
	 * moves, which is what makes the tile resize UNDER the drag rather than on release; both are
	 * wired, and the appliers are idempotent so the pair costs nothing. */
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
		node.addEventListener('widget-update', push);
		node.addEventListener('widget-change', push);
		return node;
	};

	/* one colour axis: the shared shape of the rows below. `probe` is the live token the control
	 * reads the effective colour back from, `contrast` the pair it reports. */
	const colourGroup = (label, axis, probe, contrast, opts) => group(label, (lbl) => {
		const ctl = widgets.colorControl(axis.current(), bump(axis.apply), lbl, {
			probe: probe,
			read: axis.current,
			contrast: contrast,
			cls: (opts && opts.cls) || ''
		});
		colourCtls.push(ctl);
		return ctl;
	}, opts);

	/* EVERY LABEL IN HERE CARRIES THE 'footstrap' CONTEXT (`_(str, ctx)`, key `ctx\1str`). LuCI
	 * serves ONE MERGED catalogue — load_catalog() loads every *.<lang>.lmo in
	 * /usr/lib/lua/luci/i18n and a lookup returns the first archive holding the hash — so a msgid is
	 * a GLOBAL name shared with every luci-app, and readdir order picks the winner: the layout
	 * toggle rendered "Максимум" on a Russian router (issue #6), because another catalogue
	 * translates the msgid "Top" as "maximum". Contexting cannot be selective — whatever we leave
	 * bare is a name anyone may take. The chrome and the login/notice sentences are deliberately
	 * bare (inheriting luci-base's translation is a feature in the ~40 languages we have no
	 * catalogue for), as are System/Memory/Storage in fs-overview.js, which MATCH the stock
	 * headings. */

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

		group(_('Palette', 'footstrap'), (label) => selectCtl(prefs.currentPalette(), {
			footstrap:  'Footstrap',
			hicontrast: 'Hi-Contrast',
			/* names the OTHER package, luci-theme-bootstrap, whose colours this palette is —
			 * so it is a proper noun and stays untranslated, like the two above it */
			bootstrap:  'Bootstrap',
			/* names the OTHER package again, luci-theme-openwrt-2020, whose colourway this is */
			'2020':     'OpenWrt 2020'
		}, bump(repaint(prefs.applyPalette)), label)),

		/* Density: how much air the UI uses. Pure token axis — 02-tokens.css multiplies the type and
		 * space ladders, so every size, gap and padding in the theme follows at once. */
		group(_('Density', 'footstrap'), (label) => selectCtl(prefs.currentDensity(), {
			compact: _('Compact', 'footstrap'),
			normal:  _('Normal', 'footstrap'),
			large:   _('Large', 'footstrap')
		}, bump(prefs.applyDensity), label)),

		group(_('Rounding', 'footstrap'),
			(label) => sliderCtl(prefs.currentRadius(), 0, 20, bump(prefs.applyRadius), label)),

		/* The top layout has no accordion (its sections are hover dropdowns, already exclusive), so
		 * this switch is meaningless there. ALWAYS BUILT, HIDDEN BY CSS (:root[data-layout="top"]
		 * .fs-ap-submenus). Do NOT put an `if (currentLayout() !== 'top')` around it: the page is
		 * built once, so the branch would freeze the control to the layout the page LOADED in — it
		 * would stay on screen after a switch to the bar and never appear after a switch away from
		 * it. Toggling the layout re-renders nothing; CSS morphs the chrome. */
		group(_('Submenus', 'footstrap'), (label) => selectCtl(
			prefs.currentAutoCollapse() ? 'on' : 'off', {
				off: _('Keep open', 'footstrap'),
				on:  _('Auto-collapse', 'footstrap')
			}, bump(prefs.applyAutoCollapse), label),
		{ cls: 'fs-ap-submenus' })
	];

	/* ---- section 2: colours ---- */
	const colours = [
		/* the caption says what the axis is FOR: "Tint" alone reads as decoration and nobody would
		 * look for the router-identity cue under it. */
		colourGroup(_('Tint (router identification)', 'footstrap'), {
			current: prefs.currentTint, apply: prefs.applyTint
		}, 'var(--fs-bg)', {
			/* the canvas is the one axis with no derived ink: its text is --fs-text, a palette token
			 * this axis must not move, so the ratio is reported instead of corrected */
			fg: 'var(--fs-text)', bg: 'var(--fs-bg)', label: _('on the canvas', 'footstrap')
		}, { cls: 'fs-ap-tint' }),

		/* the STRENGTH half of the Tint — how strong the hue reads. Only meaningful in hue mode: a
		 * hex canvas IS the colour asked for, with no chroma of ours to scale. CSS hides it in the
		 * other two states (no tint at all, or a hex one). */
		/* NOT "Density": that is the UI-density select above, and this string is both the visible
		 * caption AND the control's aria-label, so two rows would read "Density" and a screen reader
		 * would announce "Density, combo box" and "Density, slider" with nothing to tell them
		 * apart. */
		group(_('Tint strength', 'footstrap'),
			(label) => sliderCtl(prefs.currentTintStrength(), 0, 200, bump(repaint(prefs.applyTintStrength)), label, {
				step: 5
			}), { cls: 'fs-ap-tint fs-ap-tintstr' }),

		/* recolours the accented CONTROLS (buttons/toggles/sliders/focus rings), not the canvas the
		 * way Tint does. Measured as TEXT on a card, which is the use that fails first: as a fill it
		 * carries derived ink, as a link or a status label it carries only itself. */
		colourGroup(_('Accent', 'footstrap'), {
			current: prefs.currentAccent, apply: prefs.applyAccent
		}, 'var(--fs-accent)', {
			fg: 'var(--fs-accent)', bg: 'var(--fs-panel)', label: _('on a card', 'footstrap')
		}),

		colourGroup(_('Good', 'footstrap'), {
			current: prefs.currentGood, apply: prefs.applyGood
		}, 'var(--fs-good)', {
			fg: 'var(--fs-good)', bg: 'var(--fs-panel)', label: _('on a card', 'footstrap')
		}),

		colourGroup(_('Warning', 'footstrap'), {
			current: prefs.currentWarn, apply: prefs.applyWarn
		}, 'var(--fs-warn)', {
			fg: 'var(--fs-warn)', bg: 'var(--fs-panel)', label: _('on a card', 'footstrap')
		}),

		colourGroup(_('Danger', 'footstrap'), {
			current: prefs.currentDanger, apply: prefs.applyDanger
		}, 'var(--fs-danger)', {
			fg: 'var(--fs-danger)', bg: 'var(--fs-panel)', label: _('on a card', 'footstrap')
		})
	];

	/* ---- the SURFACES: the sheet the UI is drawn on ----
	 * Cards, inset controls, the chrome bar and the hairlines between them. Every one of these is a
	 * surface that body text is read ON, so what each reports is --fs-text against itself — the one
	 * measurement that says whether the page is still readable. There is no ink to derive here and
	 * none is: --fs-text is the palette's, and an axis that silently moved it would be recolouring
	 * the very thing it is being measured against.
	 *
	 * The hairline is the exception and takes the 3:1 UI-component threshold rather than the text
	 * one, which is what its readout comparing --fs-border to --fs-panel means: a border is a shape,
	 * not a label, and AA asks 3:1 of it. Below that it is decoration — which a hairline is entitled
	 * to be, so the readout says the number and leaves the call to the admin. */
	const surfaces = [
		colourGroup(_('Cards', 'footstrap'), {
			current: prefs.currentCard, apply: prefs.applyCard
		}, 'var(--fs-panel)', {
			fg: 'var(--fs-text)', bg: 'var(--fs-panel)', label: _('on a card', 'footstrap')
		}),

		colourGroup(_('Controls', 'footstrap'), {
			current: prefs.currentControl, apply: prefs.applyControl
		}, 'var(--fs-panel2)', {
			fg: 'var(--fs-text)', bg: 'var(--fs-panel2)', label: _('on a control', 'footstrap')
		}),

		colourGroup(_('Sidebar and bar', 'footstrap'), {
			current: prefs.currentBar, apply: prefs.applyBar
		}, 'var(--fs-bar-bg)', {
			fg: 'var(--fs-text)', bg: 'var(--fs-bar-bg)', label: _('in the sidebar', 'footstrap')
		}),


		colourGroup(_('Borders', 'footstrap'), {
			current: prefs.currentLine, apply: prefs.applyLine
		}, 'var(--fs-border)', {
			fg: 'var(--fs-border)', bg: 'var(--fs-panel)', label: _('on a card', 'footstrap'), kind: 'shape'
		})
	];

	/* ---- section 3: the wallpaper and everything that depends on which one is picked ----
	 *
	 * Wallpaper is THREE-valued: Off, Pattern (an uploaded SVG, tiled and recoloured) and File (an
	 * uploaded photo). Each value brings rows with it — the SVG plus Scale/Strength/Colours, or the
	 * photo plus Dim — and those rows are SIBLINGS of the Wallpaper row, not children of its field.
	 *
	 * That is the whole point of this shape. They were nested inside the field at first, which put a
	 * second `.cbi-value` inside a `.cbi-value-field` and therefore a second 180px caption column
	 * inside the first: measured on the router, Scale and Strength started 216px right of every
	 * other control on the page. LuCI has no such construct anywhere, and the eye reads it as two
	 * forms interleaved. Flat rows, hidden as a group, is what the stock pages do with a dependent
	 * field — one caption column, one field column, top to bottom.
	 *
	 * The select is the per-browser switch that decides whether to paint an image, so it is what
	 * keeps the Save button honest (refreshSave); Choose/Remove only swap the picture behind
	 * whoever is in that mode and never touch the axis. Both native file inputs stay hidden — the
	 * styled buttons trigger them. */
	const wallpaper = (() => {
		const err = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });
		const preview = E('img', { 'class': 'fs-ap-bgprev', 'alt': '', 'hidden': '' });
		/* display:none, not the `hidden` attribute — a bare `hidden=""` still rendered the native
		 * "Choose File / No file chosen" control; only the styled button below should be visible. */
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

		/* Dim: the scrim opacity over the photo. An ORDINARY per-browser axis — it is in AXIS_KEYS
		 * and in snapshotAxes(), so it moves this browser toward or away from the router default and
		 * must therefore be bump()-ed like every other saved axis. It was not, on the strength of a
		 * comment that said it wrote straight to uci: true until "keep every axis per-browser until
		 * Save as default" made it a propAxis and did not reach this file. The symptom is the one
		 * thing the Save button IS — its own status. Separate from the Tint's strength above. */
		const dimLabel = _('Dim', 'footstrap');
		const scaleLabel = _('Scale', 'footstrap');
		const strengthLabel = _('Strength', 'footstrap');
		const inkLabel = _('Colours', 'footstrap');

		/* The rows the PATTERN brings. Scale and Strength are live: the appliers write a custom
		 * property, so the tile behind the page resizes and fades under the drag with nothing to
		 * reload. Colours decides whether the file's own palette is kept or thrown away for the
		 * theme's — a mask uses the alpha only, which is right for line art and wrong for artwork
		 * that carries its own colours, and only whoever picked the file knows which it is. */
		const patRows = [
			group(_('Pattern', 'footstrap'),
				() => E('div', { 'class': 'fs-ap-bgrow' }, [ patChoose, patRemove ]),
				{ extra: [ patInput, patPreview, patErr ] }),
			group(scaleLabel, (lbl) => sliderCtl(prefs.currentPatternSize(), 40, 1600,
				bump(prefs.applyPatternSize), lbl, { step: 20 })),
			group(strengthLabel, (lbl) => sliderCtl(prefs.currentPatternStrength(), 0, 100,
				bump(prefs.applyPatternStrength), lbl, { step: 5 })),
			group(inkLabel, (lbl) => selectCtl(prefs.currentPatternInk(), {
				theme:    _('Theme', 'footstrap'),
				original: _('As in file', 'footstrap')
			}, bump(prefs.applyPatternInk), lbl))
		];
		/* …and the rows the FILE photo brings. */
		const fileRows = [
			group(_('File', 'footstrap'),
				() => E('div', { 'class': 'fs-ap-bgrow' }, [ chooseBtn, removeBtn ]),
				{ extra: [ fileInput, preview, err ] }),
			group(dimLabel, (lbl) => sliderCtl(prefs.currentPhotoDim(), 0, 100,
				bump(prefs.applyPhotoDim), lbl, { step: 5 }))
		];

		function reflect(tok) {
			if (tok) { preview.src = prefs.loginBgUrl(tok); preview.hidden = false; removeBtn.hidden = false; }
			else { preview.removeAttribute('src'); preview.hidden = true; removeBtn.hidden = true; }
		}
		function reflectPattern(tok) {
			if (tok) { patPreview.src = prefs.patternUrl(tok); patPreview.hidden = false; patRemove.hidden = false; }
			else { patPreview.removeAttribute('src'); patPreview.hidden = true; patRemove.hidden = true; }
		}
		/* `hidden` on the ROW, which is why 80-appearance.css restates it at a specificity that beats
		 * `.cbi-value`'s own display — the UA's bare `[hidden]` rule loses to it. Hidden and not
		 * removed: the rows are built once and each holds a live control whose value is this
		 * browser's, so rebuilding them on every switch would be the popover's old bug (a control
		 * frozen to the state it was constructed in) in a new place. */
		function togglePanel(v) {
			patRows.forEach((r) => { r.hidden = (v !== 'pattern'); });
			fileRows.forEach((r) => { r.hidden = (v !== 'file'); });
		}
		reflect(prefs.currentLoginBg());
		reflectPattern(prefs.currentPattern());
		togglePanel(prefs.currentWallpaper());

		const setWallpaper = (v) => { prefs.applyWallpaper(v); refreshSave(); togglePanel(v); refreshColours(); };

		patChoose.addEventListener('click', () => { patErr.hidden = true; patInput.click(); });
		patInput.addEventListener('change', () => {
			const f = patInput.files && patInput.files[0];
			patInput.value = '';	/* so re-picking the same file fires change again */
			if (!f) return;
			patErr.hidden = true; patChoose.disabled = true;
			patChoose.textContent = _('Uploading…', 'footstrap');
			prefs.uploadPattern(f)
				.then((tok) => {
					reflectPattern(tok);
					/* uploadPattern already switched THIS browser onto the pattern, so the control has
					 * to catch up or the page paints the tile while the dropdown still reads Off.
					 * `dom.callClassMethod` is how LuCI moves one of its own widgets from the outside;
					 * setWallpaper is then called directly, because a programmatic setValue does NOT
					 * emit `widget-change` — the event is the user's, and relying on it here would
					 * leave the rows and the Save button behind. */
					dom.callClassMethod(seg, 'setValue', 'pattern');
					setWallpaper('pattern');
				})
				.catch((e) => { patErr.textContent = String((e && e.message) || e); patErr.hidden = false; })
				.finally(() => { patChoose.disabled = false; patChoose.textContent = patChooseLabel; });
		});
		patRemove.addEventListener('click', () => {
			patErr.hidden = true; patRemove.disabled = true;
			prefs.removePattern()
				.then(() => reflectPattern(''))
				.catch((e) => { patErr.textContent = String((e && e.message) || e); patErr.hidden = false; })
				.finally(() => { patRemove.disabled = false; });
		});

		chooseBtn.addEventListener('click', () => { err.hidden = true; fileInput.click(); });
		fileInput.addEventListener('change', () => {
			const f = fileInput.files && fileInput.files[0];
			fileInput.value = '';	/* so re-picking the same file fires change again */
			if (!f) return;
			err.hidden = true; chooseBtn.disabled = true;
			chooseBtn.textContent = _('Uploading…', 'footstrap');
			prefs.uploadLoginBg(f)
				.then(reflect)
				.catch((e) => { err.textContent = String((e && e.message) || e); err.hidden = false; })
				.finally(() => { chooseBtn.disabled = false; chooseBtn.textContent = chooseLabel; });
		});
		removeBtn.addEventListener('click', () => {
			err.hidden = true; removeBtn.disabled = true;
			prefs.removeLoginBg()
				.then(() => reflect(''))
				.catch((e) => { err.textContent = String((e && e.message) || e); err.hidden = false; })
				.finally(() => { removeBtn.disabled = false; });
		});

		let seg;
		const wallRow = group(_('Wallpaper', 'footstrap'), (label) => {
			seg = selectCtl(prefs.currentWallpaper(), {
				off:     _('Off', 'footstrap'),
				pattern: _('Pattern', 'footstrap'),
				file:    _('File', 'footstrap')
			}, setWallpaper, label);
			return seg;
		});

		return [ wallRow ].concat(patRows, fileRows);
	})();

	/* ---- section 4: the router default and the version ---- */
	/* the version line: read from fs-version.js, which the Makefile stamps at package time. No
	 * request, no check — `apk upgrade` is what tells this router about a new one. */

	/* Save the current look as the ROUTER-WIDE default (fs-prefs writes it to /etc/config/footstrap
	 * via the scoped uci ACL). It does NOT change this browser — localStorage keeps overriding, so
	 * the saved default only shows on a fresh browser/device. "Reset" is the escape hatch: it clears
	 * this browser's overrides and reloads onto the saved default (a two-click confirm, since it
	 * discards local tweaks).
	 *
	 * No status text — the Save BUTTON itself is the status: enabled "Save as default" when this
	 * browser diverges from the saved default, disabled "Saved as default" when it already matches
	 * (nothing to save). refreshSave() below drives that from prefs.matchesSavedDefault(). */
	const saveBtn = E('button', { 'class': 'btn cbi-button-action', 'type': 'button' }, [ _('Save as default', 'footstrap') ]);
	/* TWO resets, because there are two things underneath a browser's tweaks (fs-prefs.js):
	 * "Reset to saved" clears them and lets every axis fall back through the layers — to whatever
	 * Save as default put on the ROUTER; "Reset to default" writes the THEME's own built-ins
	 * explicitly, which is the only way to say "as the theme ships" on a router that has a saved
	 * default of its own. Neither touches /etc/config/footstrap. */
	const resetSavedBtn = E('button', { 'class': 'btn', 'type': 'button' }, [ _('Reset to saved', 'footstrap') ]);
	/* The stock destructive class, so the button that throws away every local tweak is the red one
	 * on the page — LuCI paints .cbi-button-negative/.cbi-button-remove from --fs-danger
	 * (theme/55-buttons.css). "Reset to saved" stays neutral on purpose: it drops this browser back
	 * onto whatever the router says, which is a step BACK to a shared state rather than a discard. */
	const resetBtn = E('button', { 'class': 'btn cbi-button-negative', 'type': 'button' }, [ _('Reset to default', 'footstrap') ]);
	/* Save's only visible failure surface. saveAsDefault() writes /etc/config/footstrap over the
	 * scoped uci ACL; the realistic failure is the rpc REJECTING — an expired session (403), a
	 * missing ACL, ubus down — which the old code buried in a title tooltip nobody sees. (A DELETED
	 * config is NOT caught here: rpcd stages the set in the session and commit then silently no-ops
	 * without writing the file, returning success — measured on the router. The package owns that
	 * file and the read side falls back to built-in defaults, so that edge is left to the package.) */
	const saveErr = E('div', { 'class': 'fs-ap-err', 'role': 'alert', 'hidden': '' });

	/* the Save button IS the status: match -> disabled "Saved as default", diverged -> enabled
	 * "Save as default". Called after every axis change (via bump).
	 *
	 * Unless this browser refuses storage, in which case the status would be a lie in both halves:
	 * nothing was written, so every current*() reads the ROUTER default back and the comparison is
	 * true however far the page has been dragged from it. Say what is actually true instead — the
	 * axes apply and are forgotten on reload — and leave the button enabled, because pushing this
	 * browser's look to the router is the one thing that still works here. */
	function refreshSave() {
		if (prefs.storageBroken()) {
			saveBtn.disabled = false;
			saveBtn.textContent = _('Save as default', 'footstrap');
			saveErr.textContent = _('This browser is not storing preferences (site data is blocked), so a change here lasts until you reload. Saving as default still works and applies to every browser.', 'footstrap');
			saveErr.hidden = false;
			return;
		}
		const saved = prefs.matchesSavedDefault();
		saveBtn.disabled = saved;
		saveBtn.textContent = saved ? _('Saved as default', 'footstrap') : _('Save as default', 'footstrap');
	}
	saveBtn.addEventListener('click', () => {
		saveBtn.disabled = true;
		saveErr.hidden = true;
		prefs.saveAsDefault()
			.then(() => { saveErr.hidden = true; })
			/* On failure re-enable (refreshSave, below) so the user can retry. The usual cause is a
			 * stale session, which a reload fixes — so say that. The raw rpc error — the one string
			 * here neither the theme nor LuCI composed — stays in a title tooltip for debugging. */
			.catch((e) => {
				saveErr.textContent = _('Could not save the default. Reload the page and try again.', 'footstrap');
				saveErr.title = String((e && e.message) || e);
				saveErr.hidden = false;
			})
			.finally(refreshSave);
	});
	/* two-click confirm on BOTH: the first click arms, the second resets — discarding this browser's
	 * tweaks is destructive of local work, and a native confirm() is banned in this UI. Arming one
	 * disarms the other, so a primed button can never be fired by a click meant for its neighbour.
	 *
	 * Each reload lands on this tab rather than back on General Settings: a reset is a change to
	 * what is on THIS tab, and being thrown to the top of the page to find it again is the kind of
	 * small rudeness that makes a setting feel unfinished. See armReturn() / the mount() flag. */
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
			armReturn();
			location.reload();
		});
	}
	twoClick(resetSavedBtn, _('Reset to saved', 'footstrap'), prefs.resetToSaved);
	twoClick(resetBtn, _('Reset to default', 'footstrap'), prefs.resetToBuiltin);
	refreshSave();	/* correct label/enabled state before the first paint */

	const versionLink = E('a', {
		'class': 'fs-ap-version',
		'href': ver.REPO_URL,
		'target': '_blank',
		/* `noreferrer` alone: it implies noopener wherever it is honoured at all, and the theme's
		 * other outward links — footer.ut's two and the footer's own — spell it that way. Two
		 * spellings of one rule is how they drift. */
		'rel': 'noreferrer'
	}, [ ver.label() ]);

	const defaults = [
		/* the one row whose "control" is a pair of buttons, each already named by its own text — so
		 * the caption is not re-used as an aria-label here and `make` ignores it */
		group(_('Router default', 'footstrap'),
			() => E('div', { 'class': 'fs-ap-actrow' }, [ saveBtn, resetSavedBtn, resetBtn ]),
			{ extra: saveErr })
	];


	defaults.push(E('div', { 'class': 'fs-ap-footer' }, [
		E('div', { 'class': 'fs-ap-verrow' }, [ versionLink ])
	]));

	/* NOT .cbi-section: inside a tab pane that class is a card drawn within a card, and the stock
	 * tabs (General Settings, Logging, …) put their rows straight into the pane. These are grouping
	 * headings within one pane, so they are the theme's own class and take their rule from
	 * styles/pages/80-appearance.css. */
	const section = (title, rows) => E('div', { 'class': 'fs-ap-section' }, [
		E('div', { 'class': 'fs-ap-head' }, [ E('h4', {}, [ title ]) ])
	].concat(rows));

	/* ---- the folded groups ------------------------------------------------------------------
	 * Recolouring is a thing most admins never do, and these are the widest rows on the page —
	 * nine colour fields and an uploader, which used to sit permanently open in front of someone
	 * who came here to change the layout. Each is a DISCLOSURE now: the heading is the control,
	 * and both start closed.
	 *
	 * A disclosure and not a switch, which is what these were first. A switch answers "is this
	 * feature on", and that is the wrong question — turning it off would either revert nine colours
	 * (destructive, from a control that looks like a disclosure) or change nothing at all, which is
	 * a switch that lies. Folding answers the question that is actually being asked: am I looking
	 * at this right now. Nothing is applied, un-applied or disabled by opening or closing one.
	 *
	 * It is the W3C APG disclosure pattern, the same one the menu's sections use: a <button> owning
	 * the region it shows, `aria-expanded` on the button and `aria-controls` pointing at the panel.
	 * `hidden` on the panel rather than a class, so a closed group is out of the tab order and out
	 * of the accessibility tree for free.
	 *
	 * The open/closed state is remembered per browser but is NOT an axis: it changes nothing about
	 * how the page looks, so it is absent from AXIS_KEYS, from snapshotAxes() and from the
	 * pre-paint. Closed is the default, including on a router that already has colours set — the
	 * fold says where things are, not whether they are in use. */
	let foldSeq = 0;
	function foldable(title, rows, key) {
		const id = 'fs-ap-fold-' + (++foldSeq);
		let open = (prefs.lsGet(key) === 'on');
		const body = E('div', { 'class': 'fs-ap-body', 'id': id }, rows);
		const btn = E('button', {
			'type': 'button', 'class': 'fs-ap-fold', 'aria-expanded': String(open), 'aria-controls': id
		}, [
			E('h4', {}, [ title ]),
			/* The chevron is the affordance, and it is the SAME one the overview's card toggles
			 * draw: an empty box whose ::after is two borders rotated 45° (styles/pages/
			 * 20-overview.css). Not an <svg> — this theme has one chevron for "this panel opens",
			 * and a second drawing of it would be a second thing to keep looking like the first.
			 * Empty and aria-hidden: the STATE is on the button's aria-expanded, which is also what
			 * CSS rotates it off, so what a screen reader is told and what the eye sees cannot
			 * disagree. */
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
			/* Refreshed on OPEN because the axes below it may have moved while it was collapsed —
			 * a palette switch or a preset changes what every readout says. Cheap and skipped
			 * while closed: nothing in that fold is on screen to be wrong. */
			if (open) refreshColours();
		});
		paint();
		return E('div', { 'class': 'fs-ap-section' }, [
			E('div', { 'class': 'fs-ap-head' }, [ btn ]), body
		]);
	}

	/* Colours and Surfaces are ONE fold: they are the same job — "make this router a different
	 * colour" — split into two headings only because a figure and the sheet it sits on are read
	 * differently. Two folds for one decision would be two things to open. */
	const page = E('div', { 'class': 'fs-ap' }, [
		section(_('Interface', 'footstrap'), shell),
		foldable(_('Colours', 'footstrap'),
			colours.concat([ E('div', { 'class': 'fs-ap-head fs-ap-sub' }, [ E('h4', {}, [ _('Surfaces', 'footstrap') ]) ]) ], surfaces),
			'fs-ui-colours'),
		foldable(_('Background', 'footstrap'), wallpaper, 'fs-ui-background'),
		section(_('Defaults', 'footstrap'), defaults)
	]);

	/* The first fill, deferred one microtask so the tree above is finished being assembled. It does
	 * NOT wait for the form to be in the document, and does not need to: every value a readout shows
	 * comes back through widgets.probeColor(), which keeps its own hidden probe attached to <body>
	 * and resolves the cascade there — so this runs while the form is still detached (mount() appends
	 * it a microtask later) and still reads the live palette. */
	Promise.resolve().then(refreshColours);
	return page;
}

/* ---- mounting it on the stock System page ---------------------------------------------------
 *
 * The same shape as fs-overview.js's, and for the same reason: a chrome module is instantiated once
 * per PAGE LOAD, so it has to notice SPA navigation itself. `body[data-page]` is the signal — both
 * the server template and fs-router stamp it with the dispatch path — so one attribute observer
 * covers arriving at System, leaving it, and coming back. */
const PAGE = 'admin-system-system';
/* A reset reloads the page, and a reload opens the stock page on the tab LuCI remembers — which is
 * never this one, because ui.tabs only knows the tabs it built itself. So the reset says where it
 * came from and mount() puts the user back. sessionStorage and not a URL fragment: the fragment is
 * the stock page's own business, and a stale one would keep re-opening this tab on every later
 * visit. The key is read once and removed, so it survives exactly one reload. */
const RETURN_KEY = 'fs-ap-return';
function armReturn() { try { sessionStorage.setItem(RETURN_KEY, '1'); } catch (e) {} }
function takeReturn() {
	try {
		if (sessionStorage.getItem(RETURN_KEY) === null) return false;
		sessionStorage.removeItem(RETURN_KEY);
		return true;
	} catch (e) { return false; }
}
const MARK = 'fs-ap';	/* the built form's own class; also how mount() knows it is already there */
/* how long the stock view gets to render its tabs before a missing group counts as a failure */
const TAB_DEADLINE = 5000;
const TAB = 'fs-appearance';	/* the pane's data-tab, which ui.tabs' click handler matches on */

let _routeObserver = null, _viewObserver = null, _observedView = null, _building = false;

function onPage() { return (document.body.getAttribute('data-page') || '') === PAGE; }

function stopWatch() {
	if (_viewObserver) _viewObserver.disconnect();
	_viewObserver = null;
	_observedView = null;
}

/* Append the form once the stock view has rendered. LuCI's system.js resolves its own promises
 * before it puts anything in #view, so there is nothing to hook but the DOM — hence the observer,
 * which also covers the view being re-rendered under us (a Save & Apply redraws the map).
 *
 * Idempotent through the marker: an observer fires for every mutation, and the form's own
 * construction is a mutation. Without the check it would append itself for as long as it kept
 * noticing itself. */
/* The stock tab GROUP: the element whose children are the panes, which ui.tabs marks
 * data-initialized when it builds the menu — and the menu it inserted is that element's previous
 * sibling. Both are read from the DOM rather than assumed, because a group that is not initialised
 * yet is a page still rendering, not a page without tabs.
 *
 * The flag and the sibling are the whole test, deliberately: the panes themselves are NOT required
 * to be found here, and a check for them by CLASS is what failed. A modern pane carries no class at
 * all — form.js gives it `data-tab` and `data-tab-title` and nothing else, and `.cbi-tabcontainer`
 * is luci-compat vocabulary from the Lua CBI — so `:scope > .cbi-tabcontainer` matched nothing on a
 * page that plainly has tabs, and the tab was never added, silently. ui.tabs itself marks
 * `panes[0].parentNode`, so the panes ARE this element's children; they are simply not identifiable
 * that way. */
/* Tab groups that belong to the page we just LEFT. The router stamps body[data-page] before the
 * incoming view renders, and on a warm route #view still holds the outgoing page's DOM at that
 * moment — so mount() found ITS tab strip and appended the whole Appearance form, plus a live,
 * clickable "Footstrap" <li>, to another page's tabs. Measured arriving at System -> System from
 * Network -> DHCP: two builds for one arrival, and for 66 ms on localhost (an RTT or more on a real
 * router, since the window is the incoming view's load()) the tab sat on the DHCP strip and opened
 * all 24 Appearance rows when clicked. Every group present at the moment of the stamp is therefore
 * disqualified; the incoming view's own group is a fresh element and is not in this set. */
const _staleGroups = new WeakSet();
function disqualifyCurrentGroups() {
	const view = document.getElementById('view');
	if (!view) return;
	for (const g of view.querySelectorAll('[data-initialized="true"]'))
		_staleGroups.add(g);
}

function tabGroup(view) {
	for (const g of view.querySelectorAll('[data-initialized="true"]')) {
		if (_staleGroups.has(g)) continue;
		const menu = g.previousElementSibling;
		if (menu?.classList.contains('cbi-tabmenu'))
			return { group: g, menu };
	}
	return null;
}

/* Append the pane and its tab once the stock view has rendered. LuCI's system.js resolves its own
 * promises before it puts anything in #view, so there is nothing to hook but the DOM — hence the
 * observer, which also covers the view being re-rendered under us (a Save & Apply redraws the map).
 *
 * The tab is added BY HAND rather than by calling ui.tabs.initTabGroup again: that function returns
 * immediately when the group carries data-initialized, and clearing the flag to re-run it would
 * build a SECOND menu beside the first (it inserts one unconditionally) and drop the stock tabs'
 * own click bindings. One <li>, the same click handler ui.tabs binds to every other tab, and the
 * pane the handler expects to find.
 *
 * Idempotent through the marker: an observer fires for every mutation, and the form's own
 * construction is a mutation. Without the check it would append itself for as long as it kept
 * noticing itself. */
/* WHAT WAKES THIS UP WHEN NOTHING ELSE WILL.
 *
 * The observer below fires on mutations, and the tab group's readiness is not always one: a map
 * redraw (Save, without Apply) takes the pane and the tab away with the old group and builds a new
 * one, and `ui.tabs` stamps `data-initialized` on it as an ATTRIBUTE change that can land after the
 * last childList change. mount() then found no group, returned, and nothing mutated #view again —
 * the tab was simply missing until the next navigation. Reported from the field on 25.12.5, on
 * Chrome and on iOS, as "sometimes it disappears after Save" (openwrt/luci#8903).
 *
 * Two answers, because the attribute alone would still depend on ui.tabs stamping it that way: the
 * observer now watches that attribute, AND a miss schedules a few retries on a widening delay. The
 * retries stop as soon as the tab is up, and they cost nothing on the path where the first attempt
 * works — which is every path measured before this. */
const RETRIES = [ 0, 60, 150, 300, 600, 1200 ];
let _retryTimer = 0, _retryAt = 0;
function retryMount() {
	if (_retryTimer) return;
	if (_retryAt >= RETRIES.length) return;
	const delay = RETRIES[_retryAt++];
	_retryTimer = window.setTimeout(() => { _retryTimer = 0; mount(); }, delay);
}

function mount() {
	const view = document.getElementById('view');
	if (!view || !onPage()) return;
	if (view.querySelector('.' + MARK)) { _retryAt = 0; return; }
	if (_building) return;
	const tabs = tabGroup(view);
	if (!tabs) { retryMount(); return; }
	_building = true;
	render()
		.then((form) => {
			/* re-check: render() resolves on a microtask and the view can have been replaced, or
			 * navigated away from, in the meantime */
			const v = document.getElementById('view');
			if (!onPage() || !v || v.querySelector('.' + MARK)) return;
			const t = tabGroup(v);
			if (!t) return;
			/* The tab is named after the THEME, not after what it does: it sits between four stock
			 * tabs that are all "what this page configures" (General Settings, Logging, …), and a
			 * fifth called Appearance reads as another facet of the router rather than as one
			 * package's settings. "Footstrap" says whose these are — and it is a proper noun, so it
			 * is deliberately NOT translated, like the palette name in the form below. */
			const title = 'Footstrap';
			/* data-tab-active is deliberately absent: the stock page opens on whichever tab it
			 * opened on before, and a theme has no business taking that over. */
			/* The same shape a stock pane has, which is `data-tab` + `data-tab-title` and no class:
			 * ui.tabs.switchTab reads the attributes, and the `cbi-tabcontainer` class this used to
			 * carry is luci-compat's, styled by no rule this theme ships. */
			t.group.appendChild(E('div', {
				'data-tab': TAB,
				'data-tab-title': title
			}, [ form ]));
			const link = E('a', { 'href': '#' }, [ title ]);
			link.addEventListener('click', ui.tabs.switchTab.bind(ui.tabs));
			t.menu.appendChild(E('li', { 'class': 'cbi-tab-disabled', 'data-tab': TAB }, [ link ]));
			/* …and if this load is the one a reset asked for, open on it. Clicking the link we just
			 * built goes through ui.tabs' own switchTab, so the stock panes are hidden exactly the
			 * way they are for any other tab — nothing here reimplements the switch. */
			if (takeReturn()) link.click();
		})
		.catch((e) => console.error('footstrap: the Appearance tab failed to build', e))
		.finally(() => { _building = false; });
}

function watch() {
	const view = document.getElementById('view');
	if (_viewObserver && _observedView !== view) stopWatch();
	if (_viewObserver || !view || !onPage()) return;
	_observedView = view;
	_viewObserver = new MutationObserver(mount);
	/* `data-initialized` is in the filter because it is the moment the group becomes usable, and it
	 * is not always accompanied by a childList change (see retryMount above). */
	_viewObserver.observe(view, {
		childList: true, subtree: true,
		attributes: true, attributeFilter: [ 'data-initialized' ],
	});
	mount();
	/* A DEADLINE on the one failure that is otherwise perfectly silent. tabGroup() reads three
	 * private ui.tabs facts — the `data-initialized` marker, the `cbi-tabmenu` class on the menu it
	 * inserts, and `cbi-tab-disabled` on the items — and one of those has already moved between
	 * 24.10 and 25.12 (`data-tab-group` was dropped with no announcement). If any of the three we do
	 * read goes the same way, mount() simply returns early on every mutation: the stock page renders
	 * perfectly, nothing throws, and every Appearance axis becomes unreachable. Say it once, after
	 * the page has had time to render. */
	window.setTimeout(() => {
		const v = document.getElementById('view');
		if (!onPage() || !v || v.querySelector('.' + MARK) || _building) return;
		/* one last attempt before saying it cannot be done: the complaint below is about ui.tabs
		 * having changed shape, and that is only true if a fresh look still finds no group */
		_retryAt = 0;
		mount();
		if (v.querySelector('.' + MARK) || _building || tabGroup(v)) return;
		console.error('footstrap: the Appearance tab could not be attached — this page has tabs, but '
			+ 'ui.tabs no longer marks them the way fs-appearance.js looks for. Every Appearance axis '
			+ 'is unreachable until that is updated.');
	}, TAB_DEADLINE);
}

/* Called by menu-footstrap-common's init, once. Everything route-dependent hangs off the data-page
 * observer inside. */
function wire() {
	if (_routeObserver || !document.body) return;
	_routeObserver = new MutationObserver(() => {
		/* BEFORE deciding anything: whatever is in #view at the moment data-page changes belongs to
		 * the page being left (see _staleGroups). */
		disqualifyCurrentGroups();
		return onPage() ? watch() : stopWatch();
	});
	_routeObserver.observe(document.body, { attributes: true, attributeFilter: [ 'data-page' ] });
	if (onPage()) watch();
}

return baseclass.extend({
	wire,
	render
});
