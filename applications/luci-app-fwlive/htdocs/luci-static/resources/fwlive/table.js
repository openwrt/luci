'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
'require baseclass';
'require fwlive.log as log';
'require fwlive.links as links';
'require fwlive.hostname as hostname';

/**
 * Table thead/rows DOM renderer for luci-app-fwlive.
 *
 * renderThead(host, state, callbacks) → void
 *   host      - <table id="fwlive-table"> (colgroup + thead tr cleared/rebuilt)
 *   state     - shallow copy: { columns: [...] }
 *   callbacks - {} (unused; present for API consistency)
 *
 * renderRows(host, state, callbacks) → void
 *   host      - <tbody> element (kept; normal polls reuse keyed rows)
 *   state     - shallow copy: { rows, columns, viewMode, messageLayout,
 *                               expandedRowId, rowTint, showHostnames,
 *                               hostnameCache }
 *   callbacks - { onRowClick(rowId, ev), onFilterClick(field, value, ev),
 *                 actionRowTintClass(action) }
 *
 * Internals (not a second public contract): columnLabel, columnCellClass,
 * flowCell, buildColumnCell.
 *
 * Modules must not mutate state. Forced renders clear and rebuild the host;
 * normal polls reuse unchanged keyed rows and only build changed rows.
 * rowRenderKey must include every painted field (including resolved hostnames)
 * so a non-forced paint can refresh display-only changes. Does not touch
 * #fwlive-scroll or #fwlive-empty.
 */

function columnLabel(col) {
	const labels = {
		time: _('Time'),
		action: _('Action'),
		rule: _('Rule'),
		iface: _('Interface'),
		iface_in: _('IN'),
		iface_out: _('OUT'),
		dir: _('Dir'),
		proto: _('Proto'),
		src: _('Source'),
		dst: _('Destination'),
		sport: _('SPort'),
		dport: _('DPort'),
		flags: _('Flags'),
		len: _('Len'),
		flow: _('Flow'),
		message: _('Message')
	};

	return labels[col] || col;
}

const EXPANSION_PANEL_ID = 'fwlive-expanded-message';

function dirLabel(dir) {
	const labels = {
		'in': _('Inbound'),
		'out': _('Outbound'),
		'forward': _('Forwarded'),
		'unknown': _('unknown')
	};

	return labels[dir] || log.formatCell(dir);
}

function actionLabel(action) {
	const labels = {
		'pass': _('pass'),
		'block': _('block'),
		'drop': _('drop'),
		'reject': _('reject')
	};

	return labels[action] || log.formatActionLabel(action);
}

function columnCellClass(col) {
	switch (col) {
		case 'time':
			return 'fwlive-time';
		case 'action':
			return 'fwlive-action';
		case 'rule':
			return 'fwlive-rule';
		case 'iface':
		case 'iface_in':
		case 'iface_out':
			return 'fwlive-iface';
		case 'dir':
			return 'fwlive-dir';
		case 'proto':
			return 'fwlive-proto';
		case 'src':
		case 'dst':
			return 'fwlive-addr';
		case 'sport':
		case 'dport':
			return 'fwlive-port';
		case 'flags':
			return 'fwlive-flags';
		case 'len':
			return 'fwlive-len';
		case 'flow':
			return 'fwlive-flow-cell';
		case 'message':
			return 'fwlive-message fwlive-th-message';
		default:
			return '';
	}
}

function flowCell(row, state, callbacks) {
	const parts = [];
	const onFilterClick = callbacks.onFilterClick;
	const pushAddr = (addr, port, addrField, portField) => {
		if (!addr && !port) return;

		if (addr)
			parts.push(
				links.addrFilterLink(
					addrField,
					addr,
					!!state.showHostnames,
					state.hostnameCache,
					onFilterClick
				)
			);
		if (port) {
			if (addr) parts.push(':');
			parts.push(links.filterLink(portField, port, port, onFilterClick));
		}
	};

	pushAddr(row.src, row.sport, 'src', 'sport');
	if (parts.length && (row.dst || row.dport))
		parts.push(E('span', { 'class': 'fwlive-flow-arrow' }, [' → ']));
	pushAddr(row.dst, row.dport, 'dst', 'dport');

	if (!parts.length) return '—';

	return E('span', { 'class': 'fwlive-flow' }, parts);
}

function rowExpandButton(row, state, callbacks) {
	const expanded = state.expandedRowId === row.id;
	const action = expanded ? _('Hide full message') : _('Show full message');
	const button = E(
		'button',
		{
			'type': 'button',
			'class': 'fwlive-row-expand',
			'aria-label': String(action),
			'aria-expanded': expanded ? 'true' : 'false',
			'aria-controls': expanded ? EXPANSION_PANEL_ID : null,
			'click': function (ev) {
				if (ev && ev.stopPropagation) ev.stopPropagation();
				callbacks.onRowClick(row.id, ev);
			}
		},
		[expanded ? '▾' : '▸']
	);
	button._fwliveRowId = String(row.id);
	return button;
}

function buildColumnCell(col, row, state, callbacks) {
	const onFilterClick = callbacks.onFilterClick;
	const msgDisplay = log.formatMessageDisplay(row.message, state.messageLayout);
	const actionCell =
		row.action && row.action !== 'unknown'
			? links.filterLink('action', row.action, actionLabel(row.action), onFilterClick)
			: log.formatActionLabel(row.action);

	switch (col) {
		case 'time': {
			const timeAttrs = { 'class': columnCellClass(col) };
			if (state.viewMode === 'simple')
				timeAttrs.title = _(
					'Activate the message button or click a row to show or hide the full message'
				);
			return E('td', timeAttrs, [
				state.viewMode === 'simple'
					? log.formatTimestampCompact(row.timestamp)
					: log.formatTimestampLocal(row.timestamp)
			]);
		}
		case 'action': {
			const actionChildren = [actionCell];
			if (state.viewMode === 'simple')
				actionChildren.push(' ', rowExpandButton(row, state, callbacks));
			return E('td', { 'class': log.actionRowClass(row.action) }, actionChildren);
		}
		case 'rule':
			return E('td', { 'class': columnCellClass(col) }, [
				links.ruleAdminLink(row.rule_hint, row.rule_label, onFilterClick)
			]);
		case 'iface':
			return E('td', { 'class': columnCellClass(col) }, [
				links.ifaceLink(row.interface, onFilterClick)
			]);
		case 'iface_in':
		case 'iface_out':
			return E('td', { 'class': columnCellClass(col) }, [
				links.ifaceLink(
					col === 'iface_in' ? row.interface_in : row.interface_out,
					onFilterClick
				)
			]);
		case 'dir':
			return E('td', { 'class': columnCellClass(col) }, [dirLabel(row.direction)]);
		case 'proto':
			return E('td', { 'class': columnCellClass(col) }, [
				links.filterLink('proto', row.proto, null, onFilterClick)
			]);
		case 'src':
			return E('td', { 'class': columnCellClass(col) }, [
				links.addrFilterLink(
					'src',
					row.src,
					!!state.showHostnames,
					state.hostnameCache,
					onFilterClick
				)
			]);
		case 'sport':
			return E('td', { 'class': columnCellClass(col) }, [
				links.filterLink('sport', row.sport, null, onFilterClick)
			]);
		case 'dst':
			return E('td', { 'class': columnCellClass(col) }, [
				links.addrFilterLink(
					'dst',
					row.dst,
					!!state.showHostnames,
					state.hostnameCache,
					onFilterClick
				)
			]);
		case 'dport':
			return E('td', { 'class': columnCellClass(col) }, [
				links.filterLink('dport', row.dport, null, onFilterClick)
			]);
		case 'flags':
			return E('td', { 'class': columnCellClass(col) }, [log.formatCell(row.flags)]);
		case 'len':
			return E('td', { 'class': columnCellClass(col) }, [
				row.length != null ? String(row.length) : ''
			]);
		case 'flow':
			return E('td', { 'class': columnCellClass(col) }, [flowCell(row, state, callbacks)]);
		case 'message':
			if (state.messageLayout === 'wrap') {
				return E(
					'td',
					{
						'class': 'fwlive-message',
						'title': msgDisplay || ''
					},
					E('div', { 'class': 'fwlive-message-wrap' }, [msgDisplay || '—'])
				);
			}
			return E(
				'td',
				{
					'class': 'fwlive-message',
					'title': msgDisplay || ''
				},
				[msgDisplay || '—']
			);
		default:
			return E('td', {}, ['']);
	}
}

function renderThead(host, state, _callbacks) {
	const columns = state.columns || [];
	const tr = host.querySelector('thead tr');
	if (!tr) return;

	let colgroup = host.querySelector('colgroup');

	if (!colgroup) {
		colgroup = E('colgroup', {});
		host.insertBefore(colgroup, host.firstChild);
	}

	colgroup.innerHTML = '';
	tr.innerHTML = '';

	for (let i = 0; i < columns.length; i++) {
		const col = columns[i];
		colgroup.appendChild(
			E('col', { 'class': 'fwlive-col fwlive-col-' + col.replace(/_/g, '-') })
		);
		tr.appendChild(E('th', { 'class': columnCellClass(col) }, [columnLabel(col)]));
	}
}

function hostnameCacheValue(ip, state) {
	if (!state.showHostnames) return '';
	return hostname.cachedName(state.hostnameCache, ip) || '';
}

function rowRenderKey(row, state, columns) {
	return JSON.stringify([
		row.id,
		row.timestamp,
		row.action,
		row.rule_hint,
		row.rule_label,
		row.interface_in,
		row.interface_out,
		row.direction,
		row.proto,
		row.src,
		row.sport,
		row.dst,
		row.dport,
		row.flags,
		row.length,
		row.message,
		columns,
		state.viewMode,
		state.messageLayout,
		state.expandedRowId === row.id,
		!!state.rowTint,
		!!state.showHostnames,
		hostnameCacheValue(row.src, state),
		hostnameCacheValue(row.dst, state)
	]);
}

function rowClass(index, row, state, callbacks) {
	return [
		index % 2 ? 'fwlive-row-alt' : '',
		state.viewMode === 'simple' ? 'fwlive-row-clickable' : '',
		state.expandedRowId === row.id ? 'fwlive-row-expanded' : '',
		state.rowTint ? callbacks.actionRowTintClass(row.action) : ''
	]
		.filter(Boolean)
		.join(' ');
}

function buildRow(row, index, state, columns, callbacks, key) {
	const cells = [];
	for (let c = 0; c < columns.length; c++)
		cells.push(buildColumnCell(columns[c], row, state, callbacks));

	const tr = E(
		'tr',
		{
			'class': rowClass(index, row, state, callbacks),
			'click': state.viewMode === 'simple' ? (ev) => callbacks.onRowClick(row.id, ev) : null
		},
		cells
	);
	tr._fwliveRowId = String(row.id);
	tr._fwliveRowKey = key === undefined ? rowRenderKey(row, state, columns) : key;
	return tr;
}

function buildExpansionRow(row, state, columns) {
	const expansion = E('tr', { 'class': 'fwlive-msg-expand' }, [
		E('td', { 'colspan': String(columns.length) }, [
			E('div', { 'class': 'fwlive-msg-expand-label' }, [_('Message')]),
			E('pre', { 'id': EXPANSION_PANEL_ID, 'class': 'fwlive-msg-expand-body' }, [
				/* oneline is uncapped; wrap ellipsizes at 240 */
				log.formatMessageDisplay(row.message, 'oneline') || '—'
			])
		])
	]);
	expansion._fwliveExpansionFor = String(row.id);
	expansion._fwliveExpansionKey = rowRenderKey(row, state, columns);
	return expansion;
}

function renderAllRows(host, rows, state, columns, callbacks) {
	host.innerHTML = '';
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		host.appendChild(buildRow(row, i, state, columns, callbacks));
		if (state.viewMode === 'simple' && state.expandedRowId === row.id)
			host.appendChild(buildExpansionRow(row, state, columns));
	}
}

function renderRows(host, state, callbacks) {
	const rows = state.rows || [];
	const columns = state.columns || [];

	if (state.forceRender) {
		renderAllRows(host, rows, state, columns, callbacks);
		return;
	}

	const existingRows = new Map();
	const existingExpansions = new Map();
	const oldChildren = Array.prototype.slice.call(host.childNodes);
	for (let i = 0; i < oldChildren.length; i++) {
		const child = oldChildren[i];
		if (child._fwliveRowId != null) existingRows.set(child._fwliveRowId, child);
		else if (child._fwliveExpansionFor != null)
			existingExpansions.set(child._fwliveExpansionFor, child);
	}

	const desired = [];
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const id = String(row.id);
		const key = rowRenderKey(row, state, columns);
		let tr = existingRows.get(id);
		if (!tr || tr._fwliveRowKey !== key) tr = buildRow(row, i, state, columns, callbacks, key);
		else tr.setAttribute('class', rowClass(i, row, state, callbacks));
		tr._fwliveRowId = id;
		tr._fwliveRowKey = key;
		desired.push(tr);

		if (state.viewMode === 'simple' && state.expandedRowId === row.id) {
			let expansion = existingExpansions.get(id);
			if (!expansion || expansion._fwliveExpansionKey !== key)
				expansion = buildExpansionRow(row, state, columns);
			desired.push(expansion);
		}
	}

	for (let i = 0; i < desired.length; i++) {
		const current = host.childNodes[i] || null;
		if (current !== desired[i]) host.insertBefore(desired[i], current);
	}

	const used = new Set(desired);
	const currentChildren = Array.prototype.slice.call(host.childNodes);
	for (let i = 0; i < currentChildren.length; i++) {
		if (!used.has(currentChildren[i])) host.removeChild(currentChildren[i]);
	}
}

return baseclass.extend({
	renderThead: renderThead,
	renderRows: renderRows
});
