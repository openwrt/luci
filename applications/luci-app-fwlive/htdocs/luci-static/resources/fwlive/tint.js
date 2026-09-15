'use strict';
'require baseclass';

/**
 * Row-tint paint helpers for luci-app-fwlive.
 * LuCI modules must return baseclass.extend(...) — plain objects fail Class.isSubclass.
 *
 * Modes (fwlive-row-tint localStorage / data-row-tint):
 *   classic    — green/red (default)
 *   accessible — teal/orange (colorblind-safe)
 *   off        — no row background tint
 */
var PAINT_DELTA_MIN = 8;
var CLASSIC_PASS_HEX = '#46a546';
var CLASSIC_DENY_HEX = '#ca3c3c';
var ACCESSIBLE_PASS_HEX = '#0d9488';
var ACCESSIBLE_DENY_HEX = '#c2410c';

/* Back-compat aliases — classic is the default palette. */
var PASS_HEX = CLASSIC_PASS_HEX;
var DENY_HEX = CLASSIC_DENY_HEX;

function normalizeRowTint(mode) {
	if (mode === 'off' || mode === 'accessible' || mode === 'classic')
		return mode;
	return 'classic';
}

function hexPairForMode(mode) {
	if (normalizeRowTint(mode) === 'accessible')
		return { pass: ACCESSIBLE_PASS_HEX, deny: ACCESSIBLE_DENY_HEX };
	return { pass: CLASSIC_PASS_HEX, deny: CLASSIC_DENY_HEX };
}

function parseCssRgbChannels(value) {
	if (!value)
		return null;

	const s = String(value).trim().toLowerCase();
	if (s === 'transparent' || s === 'rgba(0, 0, 0, 0)' || s === 'rgba(0,0,0,0)')
		return null;

	const rgb = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
	if (rgb)
		return [ parseFloat(rgb[1]), parseFloat(rgb[2]), parseFloat(rgb[3]) ];

	/* color-mix() often serializes as color(srgb r g b[/a]) with 0..1 channels. */
	const modern = s.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
	if (modern)
		return [
			parseFloat(modern[1]) * 255,
			parseFloat(modern[2]) * 255,
			parseFloat(modern[3]) * 255
		];

	return null;
}

function cssColorPaintDelta(a, b) {
	const ca = parseCssRgbChannels(a);
	const cb = parseCssRgbChannels(b);
	/* Transparent vs opaque color is a real paint change (common off-state). */
	if (!ca && !cb)
		return 0;
	if (!ca && cb)
		return Math.abs(cb[0]) + Math.abs(cb[1]) + Math.abs(cb[2]);
	if (ca && !cb)
		return Math.abs(ca[0]) + Math.abs(ca[1]) + Math.abs(ca[2]);

	return Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]) + Math.abs(ca[2] - cb[2]);
}

function tintShouldEngageFallback(opts) {
	const o = opts || {};
	const minDelta = (typeof o.minDelta === 'number') ? o.minDelta : PAINT_DELTA_MIN;

	/* Visible paint is the success criterion; token/CSS.supports are only used when
	   paint cannot be measured (no delta sample yet). */
	if (typeof o.paintDelta === 'number')
		return o.paintDelta < minDelta;

	if (o.tokenResolved === false)
		return true;

	return false;
}

return baseclass.extend({
	PAINT_DELTA_MIN: PAINT_DELTA_MIN,
	PASS_HEX: PASS_HEX,
	DENY_HEX: DENY_HEX,
	CLASSIC_PASS_HEX: CLASSIC_PASS_HEX,
	CLASSIC_DENY_HEX: CLASSIC_DENY_HEX,
	ACCESSIBLE_PASS_HEX: ACCESSIBLE_PASS_HEX,
	ACCESSIBLE_DENY_HEX: ACCESSIBLE_DENY_HEX,
	normalizeRowTint: normalizeRowTint,
	hexPairForMode: hexPairForMode,
	parseCssRgbChannels: parseCssRgbChannels,
	cssColorPaintDelta: cssColorPaintDelta,
	tintShouldEngageFallback: tintShouldEngageFallback
});
