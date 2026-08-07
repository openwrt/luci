'use strict';
'require baseclass';
'require fs-prefs as prefs';

/* The theme's own UI primitives: the disclosure pair the menu is built on, the two controls the
 * Appearance popover is built on, and the popup placement both hand-placed popups share. Nothing
 * here knows what it is being used FOR — that is the point, and it is why the menu and the popover
 * can each take what they need without either requiring the other. */

/* The chrome's ONE inline-SVG wrapper. Every icon this theme draws is the same 24x24 stroked
 * outline and differs only in its path data, but the wrapper was written out per call site — in the
 * menu, in the search box, and again in four .ut partials — so `stroke-width` and the two linecap
 * attributes were free to drift between icons that are meant to look like one set. Body in, markup
 * out; the caller supplies only the shape.
 *
 * aria-hidden: every icon here sits beside its own label (or inside a control that has one), and an
 * unlabelled <svg> is otherwise announced as a graphic in its own right. */
function svgIcon(body, cls) {
	return '<svg class="' + (cls || 'fs-ico') + '" aria-hidden="true" viewBox="0 0 24 24" fill="none" '
		+ 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
		+ body + '</svg>';
}

/* ---- disclosure primitives, shared by the menu ----
 * A section header is a W3C-APG disclosure control: an <a role="button"> owning a panel it shows and
 * hides. These lived once per menu file back when there were two, and the copies had already drifted
 * (only one Escape handler learnt to check flyout mode). The trigger SELECTOR stays a parameter. */

/* `.open` and aria-expanded must never disagree — `.open` alone told a sighted user everything and
 * a screen-reader user nothing — so every open and close goes through this one function.
 * `linkSel` is the layout's trigger (the menu's `:scope > a`). */
function setOpen(li, on, linkSel) {
	li.classList.toggle('open', on);
	li.querySelector(linkSel)?.setAttribute('aria-expanded', on ? 'true' : 'false');
}

/* An <a role="button"> is given Enter by the browser but NOT Space, and a
 * disclosure control has to answer both. */
function wireSpaceKey(link) {
	link.addEventListener('keydown', (ev) => {
		if (ev.key !== ' ' && ev.key !== 'Spacebar') return;
		ev.preventDefault();
		link.click();
	});
}

/* Dismissal both ways: a click outside closes; and WCAG 2.2 SC 1.4.13 (Content on Hover or Focus)
 * requires a hover/focus panel to be dismissible from the KEYBOARD, with focus handed back to the
 * trigger. `when` restricts both to flyout mode, where `.open` means "popup panel" — closing an
 * unfolded ACCORDION because the user clicked elsewhere on the page would be wrong. */
function wireDismiss(opts) {
	const active = () => (opts.when ? opts.when() : true);

	document.addEventListener('click', (ev) => {
		/* `closest?.` — a document-level listener sees whatever anyone dispatches, and a click
		 * whose target is not an Element (document itself, a text node from a synthetic dispatch)
		 * has no closest(). The throw would come out of THIS listener, i.e. the menu would stop
		 * closing its flyouts for the rest of the session. Every other document-level handler in
		 * the theme already guards it (fs-router's link router, fs-search's shortcuts,
		 * fs-select's typeahead); this one was the odd one out. */
		if (active() && !ev.target.closest?.(opts.inside))
			opts.close();
	});

	document.addEventListener('keydown', (ev) => {
		if (ev.key !== 'Escape' || !active()) return;
		const open = document.querySelector(opts.open);
		if (!open) return;
		const trigger = open.querySelector(opts.trigger);
		opts.close();
		trigger?.focus();
	});
}

/* THE SEGMENTED CONTROL AND THE RANGE WRAPPER WERE HERE, and they are not coming back: the
 * Appearance page draws its enums with `ui.Select` and its numbers with `ui.RangeSlider` — LuCI's
 * own widgets, present on every release this theme supports and already dressed by this theme's
 * stylesheet (`select` in base/30-forms.css, `.cbi-range-slider` in theme/60-inputs.css).
 *
 * They were written for the floating popover this page used to be, where a native <select> read as
 * a hole in the card. On a page there is no such argument, and a control LuCI maintains is one this
 * theme cannot get wrong on its own — the roving tabindex here was itself a bug fix for a
 * radiogroup that announced one control and offered N tab stops. */

/* ---- colour: reading what the page is ACTUALLY painted, and what that costs in contrast --------
 *
 * The Appearance page has to answer two questions no stored value can: what colour is a role right
 * now (the palette's own, when the axis is off — and there is no copy of the palette in JS, on
 * purpose), and what contrast does the user's colour land at. Both are questions about the computed
 * cascade, so both are asked of the browser.
 *
 * `getComputedStyle(root).getPropertyValue('--fs-accent')` cannot answer either: a custom property's
 * computed value is the token stream after var() substitution, so a palette hex comes back as a hex
 * but `oklch(from … l c H)` comes back as that function, unevaluated. Setting the expression as a
 * real `color` on a real element and reading it back gets the browser to resolve it — which is the
 * whole point, since relative colour, color-mix() and the tint's calc() are exactly the values the
 * theme is made of. One hidden probe, reused: an element per query would be a layout thrash on
 * every drag of the hue slider. */
let _probe = null;
function probeColor(expr) {
	if (!_probe) {
		/* off-screen rather than display:none — a display:none element still computes `color`, but
		 * keeping it laid out avoids depending on that being true of every engine. It carries no
		 * text and no size, so it paints nothing. */
		_probe = E('span', { 'style': 'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none', 'aria-hidden': 'true' });
		document.body.appendChild(_probe);
	}
	/* cleared first: an expression the engine rejects leaves the PREVIOUS colour standing, which
	 * would report a stale answer as a fresh one. */
	_probe.style.color = '';
	_probe.style.color = expr;
	return getComputedStyle(_probe).color;
}

/* A computed colour string -> [r,g,b] 0..255, or null. Engines do not agree on the notation: both
 * `rgb(9, 105, 218)` and the space-separated `rgb(9 105 218 / .5)` are current, and a colour outside
 * sRGB (which oklch() readily produces) comes back from some engines as `color(srgb .03 .41 .85)`,
 * i.e. 0..1 floats. Take the first three numbers and scale by whether the form is the 0..1 one —
 * the alpha after the slash is deliberately ignored, since every token this reads is opaque. */
function parseColor(s) {
	const nums = String(s || '').match(/[\d.]+/g);
	if (!nums || nums.length < 3) return null;
	const unit = (/^color\(/i).test(String(s)) ? 255 : 1;
	return nums.slice(0, 3).map((n) => Math.max(0, Math.min(255, parseFloat(n) * unit)));
}

/* WCAG 2.x relative luminance and contrast ratio, on sRGB. Used only to REPORT: the theme never
 * corrects a colour behind the user's back, it says what the colour costs and leaves the choice
 * with them (03-palettes.css derives the ink over a fill, which is a different question — that one
 * has a right answer). */
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

/* #rrggbb from whatever probeColor returned, because <input type="color"> accepts nothing else —
 * not a name, not an rgb() string, not a short hex. An unparseable colour becomes black rather than
 * throwing: the swatch is a convenience beside the text field, and the text field is authoritative. */
function toHex(s) {
	const rgb = parseColor(s) || [ 0, 0, 0 ];
	return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/* One COLOUR axis: a native swatch, the hex field beside it, and a button back to the palette's own
 * colour. It reports through onPick as a hex STRING, or 0 for "back to the palette" — the caller
 * hands either straight to fs-prefs.js's colorAxis.
 *
 * THERE IS NO HUE SLIDER, and it was here. The axis still stores a hue (1–360) and the stylesheet
 * still rotates the palette by one — a value saved before this, or a router default written then,
 * goes on working — but nothing in the UI produces one any more. Two controls for one value read as
 * two settings however carefully they mirrored each other, and the slider was the half that could
 * not do the job the axes exist for: rotating a hue keeps the palette's chroma, so no angle of it
 * reaches a grey. A field that takes the colour you want is the whole control.
 *
 * `opts.probe` is the live token to read the effective colour back from (so the field shows the
 * PALETTE's colour while the axis is off, with no copy of the palette in JS), and `opts.contrast`
 * is the pair whose ratio is reported under the row. */
function colorControl(current, onPick, label, opts) {
	const o = opts || {};

	/* type=color is the one control here that is NOT ours: the browser draws the picker, which is
	 * the right call — it is the picker the user already knows, it is keyboard- and
	 * screen-reader-accessible without us reimplementing a colour wheel, and on a phone it is the
	 * native one. The text field beside it is what makes a value shareable (an admin pastes a hex
	 * from a brand guide), and what a browser without a real picker falls back to. */
	const swatch = E('input', { 'type': 'color', 'class': 'fs-color-swatch', 'aria-label': label || '' });
	const field = E('input', {
		'type': 'text', 'class': 'fs-color-hex', 'spellcheck': 'false', 'autocomplete': 'off',
		'inputmode': 'text', 'maxlength': '7', 'aria-label': label || ''
	});
	const clear = E('button', { 'class': 'btn fs-color-clear', 'type': 'button' }, [ _('Palette', 'footstrap') ]);
	const ratio = o.contrast ? E('div', { 'class': 'cbi-value-description fs-color-contrast' }) : null;

	/* what the axis holds RIGHT NOW — the control keeps no copy of its own, because the page it
	 * lives on can change the axis behind it (a preset, Reset to default) and a private copy would
	 * then be the stale one. `current` is only the value at build time. */
	const currentOf = o.read || (() => current);

	/* Repaint everything that MIRRORS the axis rather than sets it. Called after every edit — and
	 * after a preset, a palette switch or a dark-mode flip, through the returned refresh() — because
	 * all three change what "the palette's own colour" is while this axis stays off. */
	function reflect(v) {
		const live = probeColor(o.probe);
		const hex = (typeof v === 'string') ? v : toHex(live);
		swatch.value = hex;
		/* Do not fight the user mid-edit: `#0` is a legal thing to have typed so far, and
		 * overwriting the field on every keystroke made the input impossible to type into. */
		if (document.activeElement !== field) field.value = hex;
		/* the button back to the palette is also the axis's STATE readout: enabled means this axis
		 * is holding a colour of its own, disabled means what the field shows is the palette's. */
		clear.disabled = !v;
		if (!ratio) return;
		const r = contrastRatio(o.contrast.fg, o.contrast.bg);
		if (r === null) { ratio.textContent = ''; ratio.removeAttribute('title'); return; }
		/* SAY WHAT IT MEANS, NOT WHAT IT MEASURES. This used to read "On a card 5.4:1 · AA", which is
		 * three pieces of jargon for one plain fact: whether the colour you just picked can be read.
		 * The ratio and the WCAG level are what a designer checks, and an admin recolouring a router
		 * is not one — the number stays, in the title, where it costs nothing and is there for
		 * anyone who does want it.
		 *
		 * The thresholds are still WCAG AA: 4.5:1 for body text, 3:1 for large text and for a UI
		 * SHAPE, which is why a hairline is graded on the second one (`kind: 'shape'`). A border
		 * below 3:1 is not a failure the way unreadable text is — a faint hairline is a legitimate
		 * thing to want — so it says "faint" and warns rather than "not enough" and alarms.
		 *
		 * The class names are written out WHOLE rather than built from a suffix: the theme's own
		 * namespace is swept for dead CSS by matching fs-* tokens in the source (tools/
		 * fs-orphans.mjs), and a name assembled by concatenation is invisible to that sweep — the
		 * three rules would read as dead CSS and the fragment as an unstyled class. */
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
		/* the measurement itself, for whoever wants it: the ratio and the threshold it was judged by */
		ratio.title = _('Contrast %s:1 (WCAG AA wants %s:1 here)', 'footstrap')
			.format(r.toFixed(1), (o.contrast.kind === 'shape') ? '3' : '4.5');
	}

	const pick = (v) => { onPick(v); reflect(v); };

	swatch.addEventListener('input', () => pick(swatch.value.toLowerCase()));
	/* commit on blur and on Enter, NOT on every keystroke: a half-typed `#0096` is a valid prefix of
	 * two different colours and applying it would repaint the page under the cursor. An unparseable
	 * value on blur snaps back to what the axis actually holds, so the field can never claim a
	 * colour the page is not painted in. */
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
	/* the caller owns when this runs again; it cannot be done here, because probeColor() needs the
	 * document and this control is not in it yet */
	wrap.fsRefresh = () => reflect(currentOf());
	return wrap;
}

/* How close a popup may come to the viewport edge before it is nudged back in. Read by BOTH popups
 * the theme places by hand — the Appearance popover (fs-appearance.js) and the menu's dropdown
 * edge-clamp (menu-footstrap.js) — which had each written their own `8`. */
const EDGE_GAP = 8;

/* Place the popover next to its trigger and keep it inside the viewport. It is position:fixed on
 * <body> because the sidebar is `overflow-y: auto` (which computes overflow-x to `auto` too), so
 * an absolutely-positioned popover parented to the Appearance row was clipped off the sidebar
 * edge. The top bar opens downward from the button's right edge, the sidebar sideways out of the
 * rail; both are then clamped. */
function placePopover(btn, pop) {
	const gap = EDGE_GAP, r = btn.getBoundingClientRect();
	const w = pop.offsetWidth, h = pop.offsetHeight;
	const vw = document.documentElement.clientWidth;
	const vh = document.documentElement.clientHeight;
	const top_layout = prefs.isTopLayout();

	let left = top_layout ? (r.right - w) : (r.right + gap);
	let top  = top_layout ? (r.bottom + gap) : (r.bottom - h);

	/* sidebar: if there is no room to the right, fall back above the trigger */
	if (!top_layout && left + w > vw - gap) {
		left = r.left;
		top = r.top - h - gap;
	}

	pop.style.left = Math.max(gap, Math.min(left, vw - w - gap)) + 'px';
	pop.style.top  = Math.max(gap, Math.min(top,  vh - h - gap)) + 'px';
}

return baseclass.extend({
	svgIcon,
	setOpen,
	wireSpaceKey,
	wireDismiss,
	colorControl,
	probeColor,
	toHex,
	EDGE_GAP,
	placePopover
});
