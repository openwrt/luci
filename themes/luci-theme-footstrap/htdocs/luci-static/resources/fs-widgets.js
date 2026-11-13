'use strict';
'require baseclass';

/* UI primitives shared by the chrome modules. */

/* aria-hidden: each icon sits beside its own label. Only `.fs-ico` and `.fs-chevron` are stroked,
 * by theme/20-shell.css. */
function svgIcon(body, cls) {
	return '<svg class="' + (cls || 'fs-ico') + '" aria-hidden="true" viewBox="0 0 24 24">' + body + '</svg>';
}

/* Idempotent: a poll tick that changes nothing fires no mutation record. null removes the attribute. */
function syncAttr(el, name, value) {
	if (value === null) {
		if (el.hasAttribute(name)) el.removeAttribute(name);
	} else if (el.getAttribute(name) !== value) {
		el.setAttribute(name, value);
	}
}

/* Enter/Space activation for an element with no native key handling; once per press, not per key
 * repeat (~30/s). */
function wireActivate(el, activate) {
	el.addEventListener('keydown', (ev) => {
		if (ev.key !== 'Enter' && ev.key !== ' ') return;
		ev.preventDefault();
		if (!ev.repeat) activate();
	});
}

return baseclass.extend({
	svgIcon,
	syncAttr,
	wireActivate
});
