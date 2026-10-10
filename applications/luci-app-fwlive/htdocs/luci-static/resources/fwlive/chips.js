'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
'require baseclass'; /* LuCI require() needs Class.isSubclass — plain return {} fails */
'require fwlive.log as log';

/**
 * Filter-chip DOM renderer for luci-app-fwlive.
 *
 * renderFilterChips(host, state, callbacks) → void
 *   host      - stable container element; unchanged strips keep their nodes
 *   state     - shallow copy: { filters, chipFields }
 *   callbacks - { onInvert(field, ev), onClear(field, ev), onClearAll(ev), onFocusFallback(field, action) }
 *
 * Chips use the labels presentation (include: "is"/"contains", exclude: "not"/"does not contain" + light ≠).
 * Modules must not mutate state. Changed strips are replaced; chip focus follows
 * the same field/action or moves to Clear all/the associated filter (a null
 * field means the strip became empty and should use the view's main input).
 */

function chipFieldLabel(spec) {
	const mapped = log.filterFieldLabel(spec.key);
	if (mapped !== spec.key) return mapped;
	return spec.label || spec.key;
}

function chipValueNodes(spec, val) {
	const contains = log.isSubstringFilterField(spec.key);
	const label = chipFieldLabel(spec);
	const p = log.parseFilterValue(val);
	if (!p.value) return [''];

	const valueNode = p.negate ? E('span', { 'class': 'fwlive-chip-strike' }, [p.value]) : p.value;

	if (!p.negate) {
		if (contains)
			return [
				E('span', { 'class': 'fwlive-chip-polarity' }, [_('contains')]),
				' ',
				log.formatFilterChipLabel(label, val)
			];
		return [
			E('span', { 'class': 'fwlive-chip-polarity' }, [_('is')]),
			' ',
			log.formatFilterChipLabel(label, val)
		];
	}

	if (contains)
		return [
			label + ': ',
			E('strong', { 'class': 'fwlive-chip-not' }, [_('does not contain')]),
			' ',
			valueNode
		];

	return [label + ': ', E('strong', { 'class': 'fwlive-chip-not' }, [_('not')]), ' ', valueNode];
}

function chipLeadingSym(negated) {
	if (!negated) return null;
	return E(
		'span',
		{
			'class': 'fwlive-chip-sym fwlive-chip-sym-light',
			'aria-hidden': 'true'
		},
		['≠']
	);
}

function renderSignature(state, callbacks) {
	const filters = state.filters || {};
	const chipFields = state.chipFields || [];
	const fields = [];
	let visible = false;

	for (let i = 0; i < chipFields.length; i++) {
		const spec = chipFields[i];
		const value = String(filters[spec.key] || '');
		fields.push([
			String(spec.key),
			String(chipFieldLabel(spec)),
			value,
			log.isSubstringFilterField(spec.key)
		]);
		if (value && log.parseFilterValue(value).value) visible = true;
	}

	const labels = [
		String(_('Exclude instead')),
		String(_('Include instead')),
		String(_('Remove filter')),
		String(_('Clear all'))
	];

	return {
		value: JSON.stringify([fields, labels]),
		visible: visible,
		onInvert: callbacks && callbacks.onInvert,
		onClear: callbacks && callbacks.onClear,
		onClearAll: callbacks && callbacks.onClearAll,
		onFocusFallback: callbacks && callbacks.onFocusFallback
	};
}

function signatureMatches(host, signature) {
	const previous = host._fwliveChipRenderState;
	return !!(
		previous &&
		previous.value === signature.value &&
		previous.onInvert === signature.onInvert &&
		previous.onClear === signature.onClear &&
		previous.onClearAll === signature.onClearAll &&
		previous.onFocusFallback === signature.onFocusFallback &&
		host.className === 'fwlive-chips fwlive-chips-labels' &&
		host.style &&
		host.style.display === (signature.visible ? 'flex' : 'none')
	);
}

function focusedChipControl(host) {
	if (typeof document === 'undefined' || !document.activeElement) return null;
	const active = document.activeElement;
	let node = active;
	while (node && node !== host) node = node.parentNode;
	if (node !== host || typeof active.getAttribute !== 'function') return null;

	const action = active.getAttribute('data-fwlive-chip-action');
	if (!action) return null;
	return {
		action: action,
		field: active.getAttribute('data-fwlive-chip-field')
	};
}

function findChipControl(root, action, field) {
	const pending = [root];
	while (pending.length) {
		const node = pending.pop();
		if (!node || node.nodeType !== 1) continue;
		if (
			node.getAttribute &&
			node.getAttribute('data-fwlive-chip-action') === action &&
			(field == null || node.getAttribute('data-fwlive-chip-field') === field)
		)
			return node;

		const children = node.childNodes || [];
		for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
	}
	return null;
}

function restoreChipFocus(host, focused, callbacks) {
	if (!focused) return;

	let target = findChipControl(host, focused.action, focused.field);
	if (!target && focused.action !== 'clear-all')
		target = findChipControl(host, 'clear-all', null);

	if (target && typeof target.focus === 'function') {
		target.focus();
		return;
	}

	if (callbacks && typeof callbacks.onFocusFallback === 'function')
		callbacks.onFocusFallback(
			focused.action === 'clear-all' ? null : focused.field,
			focused.action
		);
}

function renderFilterChips(host, state, callbacks) {
	const filters = state.filters || {};
	const chipFields = state.chipFields || [];
	const signature = renderSignature(state, callbacks);
	if (signatureMatches(host, signature)) return;
	const focused = focusedChipControl(host);
	const chips = [];

	for (let i = 0; i < chipFields.length; i++) {
		const spec = chipFields[i];
		const val = filters[spec.key];
		if (!val) continue;

		const parsed = log.parseFilterValue(val);
		if (!parsed.value) continue;
		const negated = parsed.negate;
		const invertLabel = String(negated ? _('Include instead') : _('Exclude instead'));
		const kids = [];
		const lead = chipLeadingSym(negated);
		if (lead) kids.push(lead);

		kids.push(E('span', { 'class': 'fwlive-chip-label' }, chipValueNodes(spec, val)));
		kids.push(
			E(
				'span',
				{
					'class': 'fwlive-chip-invert-wrap',
					'data-tip': invertLabel
				},
				[
					E(
						'button',
						{
							'type': 'button',
							'class': 'fwlive-chip-invert',
							'data-fwlive-chip-field': String(spec.key),
							'data-fwlive-chip-action': 'invert',
							'aria-label': invertLabel,
							'click': function (ev) {
								callbacks.onInvert(spec.key, ev);
							}
						},
						['≠']
					)
				]
			)
		);
		kids.push(
			E(
				'a',
				{
					'href': '#',
					'class': 'fwlive-chip-remove',
					'data-fwlive-chip-field': String(spec.key),
					'data-fwlive-chip-action': 'remove',
					'aria-label': String(_('Remove filter')),
					'title': _('Remove filter'),
					'click': function (ev) {
						callbacks.onClear(spec.key, ev);
					}
				},
				['×']
			)
		);

		chips.push(
			E(
				'span',
				{
					'class':
						'fwlive-chip' + (negated ? ' fwlive-chip-negated' : ' fwlive-chip-include')
				},
				kids
			)
		);
	}

	host.className = 'fwlive-chips fwlive-chips-labels';
	host.innerHTML = '';
	if (!chips.length) {
		host.style.display = 'none';
		host._fwliveChipRenderState = signature;
		restoreChipFocus(host, focused, callbacks);
		return;
	}

	host.style.display = 'flex';
	for (let i = 0; i < chips.length; i++) host.appendChild(chips[i]);

	host.appendChild(
		E(
			'a',
			{
				'href': '#',
				'class': 'fwlive-chip-clear',
				'data-fwlive-chip-action': 'clear-all',
				'click': function (ev) {
					callbacks.onClearAll(ev);
				}
			},
			[_('Clear all')]
		)
	);
	host._fwliveChipRenderState = signature;
	restoreChipFocus(host, focused, callbacks);
}

return baseclass.extend({
	renderFilterChips: renderFilterChips
});
