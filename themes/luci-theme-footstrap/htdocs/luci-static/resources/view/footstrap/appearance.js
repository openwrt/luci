'use strict';
'require view';
'require fs-appearance as appearance';

/* The real Footstrap page. `menu.d/luci-theme-footstrap.json` dispatches
 * admin/system/footstrap here — an ordinary `view`, built by the menu like any other page, with
 * none of the compensating machinery a theme once needed to staple a panel onto someone else's
 * form (docs/architecture.md: a MutationObserver on #maincontent, a 5 s deadline,
 * `body[data-page]` tracking, a stale-group WeakSet, a sessionStorage return key — one lost tab on
 * a real router, after a Save & Apply, never reproduced on either stand, is what those four
 * compensating mechanisms were standing in for). The tab itself is gone too: `fs-appearance.js` no
 * longer mounts one on System -> System, and this view is the only caller of `renderStandalone()`.
 *
 * fs-appearance.js still builds the form: `renderStandalone()` wraps the same `build()` the tab
 * used to call, minus every one of those mechanisms — a dispatched page needs none of them, the
 * menu already did the mounting.
 *
 * Wrapped in a bare `.cbi-section` for the same reason the tab's content looked like a card:
 * theme/30-tables.css's `.cbi-section` (background, border, `--fs-card-pad`) is the only
 * source of that look — a view with no CBI map of its own draws no card unless something asks for
 * one, and `.cbi-value`/`.cbi-value-title`/`.cbi-value-field` (what every row inside is built
 * from) do not depend on the wrapper to lay out correctly, only to look like a page instead of
 * bare rows on the canvas. */
return view.extend({
	render: () => appearance.renderStandalone().then((form) => E('div', { 'class': 'cbi-section' }, [ form ])),

	/* Measured, not assumed (docs/devkit.src.html "handleSaveApply = null instead of hiding stock
	 * buttons"): a view that leaves these unset still gets view.js's default Save & Apply | Apply
	 * unchecked | Save | Reset footer, wired to apply_rollback — a live bar on the real page, not a
	 * dead one, and every click reports "no changes to apply" because nothing here is uci form
	 * state. Every axis applies immediately (fs-appearance.js's `render()` doc comment); nulling all
	 * three is what actually drops the bar, and what makes that comment true. */
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
