'use strict';
'require baseclass';

/* The theme's UI primitives: the inline-SVG wrapper and two small idioms every module that draws a
 * control on its own repeats — an idempotent attribute write and Enter/Space activation for an
 * element with no native key handling. Nothing here knows what it is used for, so the menu, the
 * chrome and the Overview grid share it without requiring each other. */

/* The one inline-SVG wrapper: every theme icon is a 24x24 stroked outline differing only in path
 * data, so stroke width and linecaps are stated once and cannot drift between call sites.
 * aria-hidden, because each icon sits beside its own label — an unlabelled <svg> is otherwise
 * announced as a graphic in its own right. */
function svgIcon(body, cls) {
	return '<svg class="' + (cls || 'fs-ico') + '" aria-hidden="true" viewBox="0 0 24 24" fill="none" '
		+ 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
		+ body + '</svg>';
}

/* Idempotent attribute write, so a poll tick that finds nothing changed touches no DOM and fires
 * no mutation record. `value === null` removes the attribute instead of writing the string
 * "null". Three call sites (menu-footstrap-common.js's meter annotator, fs-chrome.js's indicator
 * pills, fs-overview.js's card disclosure) carried this same body separately; held here once. */
function syncAttr(el, name, value) {
	if (value === null) {
		if (el.hasAttribute(name)) el.removeAttribute(name);
	} else if (el.getAttribute(name) !== value) {
		el.setAttribute(name, value);
	}
}

/* Enter/Space activation for an element with no native key handling of its own — a `<span>`
 * `role="button"`, unlike an `<a role="button">`, gets neither key for free. Calling `activate()`
 * rather than `el.click()` directly lets a caller forward the activation to a different element
 * (fs-overview.js's card header activates the pill it labels). */
function wireActivate(el, activate) {
	el.addEventListener('keydown', (ev) => {
		if (ev.key !== 'Enter' && ev.key !== ' ') return;
		ev.preventDefault();
		activate();
	});
}

/* The Appearance page draws enums with `ui.Select` and numbers with `ui.RangeSlider`: LuCI widgets
 * are present on every supported release, already dressed by this stylesheet (`select` in
 * base/30-forms.css, `.cbi-range-slider` in theme/60-inputs.css), and cannot be got wrong here.
 * Do not re-add a segmented control or range wrapper of our own. */

return baseclass.extend({
	svgIcon,
	syncAttr,
	wireActivate
});
