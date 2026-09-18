'use strict';
'require baseclass';

/* The theme's UI primitives: the inline-SVG wrapper, the disclosure pair the menu is built on, and
 * the colour control behind the Appearance page's colour axes. Nothing here knows what it is used
 * for, so the menu and the Appearance page share it without requiring each other. */

/* The one inline-SVG wrapper: every theme icon is a 24x24 stroked outline differing only in path
 * data, so stroke width and linecaps are stated once and cannot drift between call sites.
 * aria-hidden, because each icon sits beside its own label — an unlabelled <svg> is otherwise
 * announced as a graphic in its own right. */
function svgIcon(body, cls) {
	return '<svg class="' + (cls || 'fs-ico') + '" aria-hidden="true" viewBox="0 0 24 24" fill="none" '
		+ 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
		+ body + '</svg>';
}

/* ---- disclosure primitives, shared by the menu ----
 * A section header is a W3C-APG disclosure control: an <a role="button"> owning a panel it shows
 * and hides. The trigger selector stays a parameter. */

/* Every open and close goes through here so `.open` and aria-expanded cannot disagree: `.open`
 * alone tells a sighted user everything and a screen-reader user nothing. `linkSel` is the
 * layout's trigger (the menu's `:scope > a`). */
function setOpen(li, on, linkSel) {
	li.classList.toggle('open', on);
	li.querySelector(linkSel)?.setAttribute('aria-expanded', on ? 'true' : 'false');
}

/* An <a role="button"> is given Enter by the browser but not Space, and a disclosure control has
 * to answer both. */
function wireSpaceKey(link) {
	link.addEventListener('keydown', (ev) => {
		if (ev.key !== ' ' && ev.key !== 'Spacebar') return;
		ev.preventDefault();
		link.click();
	});
}

/* A click outside closes; WCAG 2.2 SC 1.4.13 also requires a hover/focus panel to be dismissible
 * from the keyboard, with focus handed back to the trigger. `when` restricts both to flyout mode,
 * where `.open` means "popup panel" — an unfolded accordion must not close on an outside click. */
function wireDismiss(opts) {
	const active = () => (opts.when ? opts.when() : true);

	document.addEventListener('click', (ev) => {
		/* `closest?.`: a document-level listener sees any dispatched click, including one whose
		 * target is not an Element and has no closest(). The throw would kill this listener for
		 * the rest of the session. */
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

/* The Appearance page draws enums with `ui.Select` and numbers with `ui.RangeSlider`: LuCI widgets
 * are present on every supported release, already dressed by this stylesheet (`select` in
 * base/30-forms.css, `.cbi-range-slider` in theme/60-inputs.css), and cannot be got wrong here.
 * Do not re-add a segmented control or range wrapper of our own. */

return baseclass.extend({
	svgIcon,
	setOpen,
	wireSpaceKey,
	wireDismiss
});
