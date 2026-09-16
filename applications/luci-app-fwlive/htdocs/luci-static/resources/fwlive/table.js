'use strict';
'require baseclass';
'require fwlive.log as log';
'require fwlive.links as links';

/**
 * Table thead/rows DOM renderer for luci-app-fwlive.
 *
 * renderThead(host, state, callbacks) → void
 *   host      - <table id="fwlive-table"> (colgroup + thead tr cleared/rebuilt)
 *   state     - shallow copy: { columns: [...] }
 *   callbacks - {} (unused; present for API consistency)
 *
 * renderRows(host, state, callbacks) → void
 *   host      - <tbody> element (cleared and rebuilt; element itself is kept)
 *   state     - shallow copy: { rows, columns, viewMode, messageLayout,
 *                               expandedRowId, rowTint, showHostnames,
 *                               hostnameCache, firewallBackend }
 *   callbacks - { onRowClick(rowId, ev), onFilterClick(field, value, ev),
 *                 actionRowTintClass(action) }
 *
 * Internals (not a second public contract): columnLabel, columnCellClass,
 * flowCell, buildColumnCell.
 *
 * Modules must not mutate state. host contents are cleared then rebuilt
 * (idempotent replace). Does not touch #fwlive-scroll or #fwlive-empty.
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

function columnCellClass(col) {
	switch (col) {
	case 'time': return 'fwlive-time';
	case 'action': return 'fwlive-action';
	case 'rule': return 'fwlive-rule';
	case 'iface':
	case 'iface_in':
	case 'iface_out': return 'fwlive-iface';
	case 'dir': return 'fwlive-dir';
	case 'proto': return 'fwlive-proto';
	case 'src':
	case 'dst': return 'fwlive-addr';
	case 'sport':
	case 'dport': return 'fwlive-port';
	case 'flags': return 'fwlive-flags';
	case 'len': return 'fwlive-len';
	case 'flow': return 'fwlive-flow-cell';
	case 'message': return 'fwlive-message fwlive-th-message';
	default: return '';
	}
}

function flowCell(row, state, callbacks) {
	const parts = [];
	const onFilterClick = callbacks.onFilterClick;
	const pushAddr = (addr, port, addrField, portField) => {
		if (!addr && !port)
			return;

		if (addr)
			parts.push(links.addrFilterLink(addrField, addr,
				!!state.showHostnames, state.hostnameCache, onFilterClick));
		if (port) {
			if (addr)
				parts.push(':');
			parts.push(links.filterLink(portField, port, port, onFilterClick));
		}
	};

	pushAddr(row.src, row.sport, 'src', 'sport');
	if (parts.length && (row.dst || row.dport))
		parts.push(E('span', { 'class': 'fwlive-flow-arrow' }, [ ' → ' ]));
	pushAddr(row.dst, row.dport, 'dst', 'dport');

	if (!parts.length)
		return '—';

	return E('span', { 'class': 'fwlive-flow' }, parts);
}

function buildColumnCell(col, row, state, callbacks) {
	const onFilterClick = callbacks.onFilterClick;
	const msgDisplay = log.formatMessageDisplay(row.message, state.messageLayout);
	const actionCell = row.action && row.action !== 'unknown'
		? links.filterLink('action', row.action, log.formatActionLabel(row.action), onFilterClick)
		: log.formatActionLabel(row.action);

	switch (col) {
	case 'time': {
		const timeAttrs = { 'class': columnCellClass(col) };
		if (state.viewMode === 'simple')
			timeAttrs.title = _('Click a row for the full message');
		return E('td', timeAttrs,
			[ state.viewMode === 'simple'
				? log.formatTimestampCompact(row.timestamp)
				: log.formatTimestampLocal(row.timestamp) ]);
	}
	case 'action':
		return E('td', { 'class': log.actionRowClass(row.action) }, [ actionCell ]);
	case 'rule':
		return E('td', { 'class': columnCellClass(col) },
			[ links.ruleAdminLink(row.rule_hint, row.rule_label, state.firewallBackend, onFilterClick) ]);
	case 'iface':
		return E('td', { 'class': columnCellClass(col) },
			[ links.ifaceLink(row.interface_in, onFilterClick) ]);
	case 'iface_in':
	case 'iface_out':
		return E('td', { 'class': columnCellClass(col) }, [ links.ifaceLink(
			col === 'iface_in' ? row.interface_in : row.interface_out, onFilterClick) ]);
	case 'dir':
		return E('td', { 'class': columnCellClass(col) }, [ log.formatCell(row.direction) ]);
	case 'proto':
		return E('td', { 'class': columnCellClass(col) },
			[ links.filterLink('proto', row.proto, null, onFilterClick) ]);
	case 'src':
		return E('td', { 'class': columnCellClass(col) },
			[ links.addrFilterLink('src', row.src, !!state.showHostnames, state.hostnameCache, onFilterClick) ]);
	case 'sport':
		return E('td', { 'class': columnCellClass(col) },
			[ links.filterLink('sport', row.sport, null, onFilterClick) ]);
	case 'dst':
		return E('td', { 'class': columnCellClass(col) },
			[ links.addrFilterLink('dst', row.dst, !!state.showHostnames, state.hostnameCache, onFilterClick) ]);
	case 'dport':
		return E('td', { 'class': columnCellClass(col) },
			[ links.filterLink('dport', row.dport, null, onFilterClick) ]);
	case 'flags':
		return E('td', { 'class': columnCellClass(col) }, [ log.formatCell(row.flags) ]);
	case 'len':
		return E('td', { 'class': columnCellClass(col) }, [ row.length != null ? String(row.length) : '' ]);
	case 'flow':
		return E('td', { 'class': columnCellClass(col) }, [ flowCell(row, state, callbacks) ]);
	case 'message':
		if (state.messageLayout === 'wrap') {
			return E('td', {
				'class': 'fwlive-message',
				'title': msgDisplay || ''
			}, E('div', { 'class': 'fwlive-message-wrap' }, [ msgDisplay || '—' ]));
		}
		return E('td', {
			'class': 'fwlive-message',
			'title': msgDisplay || ''
		}, [ msgDisplay || '—' ]);
	default:
		return E('td', {}, [ '' ]);
	}
}

function renderThead(host, state, _callbacks) {
	const columns = state.columns || [];
	const tr = host.querySelector('thead tr');
	if (!tr)
		return;

	let colgroup = host.querySelector('colgroup');

	if (!colgroup) {
		colgroup = E('colgroup', {});
		host.insertBefore(colgroup, host.firstChild);
	}

	colgroup.innerHTML = '';
	tr.innerHTML = '';

	for (let i = 0; i < columns.length; i++) {
		const col = columns[i];
		colgroup.appendChild(E('col', { 'class': 'fwlive-col fwlive-col-' + col.replace(/_/g, '-') }));
		tr.appendChild(E('th', { 'class': columnCellClass(col) }, [ columnLabel(col) ]));
	}
}

function renderRows(host, state, callbacks) {
	const rows = state.rows || [];
	const columns = state.columns || [];

	host.innerHTML = '';

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		const rowClass = [
			i % 2 ? 'fwlive-row-alt' : '',
			state.viewMode === 'simple' ? 'fwlive-row-clickable' : '',
			state.expandedRowId === r.id ? 'fwlive-row-expanded' : '',
			state.rowTint ? callbacks.actionRowTintClass(r.action) : ''
		].filter(Boolean).join(' ');
		const cells = [];
		for (let c = 0; c < columns.length; c++)
			cells.push(buildColumnCell(columns[c], r, state, callbacks));

		const tr = E('tr', {
			'class': rowClass,
			'click': state.viewMode === 'simple'
				? (ev) => callbacks.onRowClick(r.id, ev) : null
		}, cells);
		host.appendChild(tr);

		if (state.viewMode === 'simple' && state.expandedRowId === r.id) {
			host.appendChild(E('tr', { 'class': 'fwlive-msg-expand' }, [
				E('td', { 'colspan': String(columns.length) }, [
					E('div', { 'class': 'fwlive-msg-expand-label' }, [ _('Message') ]),
					E('pre', { 'class': 'fwlive-msg-expand-body' },
						[ log.formatMessageDisplay(r.message, 'wrap') || '—' ])
				])
			]));
		}
	}
}

return baseclass.extend({
	renderThead: renderThead,
	renderRows: renderRows
});
