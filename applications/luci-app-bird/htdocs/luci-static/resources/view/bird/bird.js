// SPDX-License-Identifier: MIT
'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

const status = rpc.declare({ object: 'luci.ospf', method: 'status', reject: true });
const apply = rpc.declare({
	object: 'luci.ospf', method: 'apply', params: [ 'revision', 'payload' ], reject: true
});
const nativeRead = rpc.declare({ object: 'luci.ospf', method: 'native_read', reject: true });
const nativeApply = rpc.declare({
	object: 'luci.ospf', method: 'native_apply', params: [ 'revision', 'contents' ], reject: true
});

function replyError(reply, fallback) {
	const message = reply.error ? _(reply.error) : fallback;
	return new Error(reply.error_args?.length ? message.format(...reply.error_args) : message);
}

async function editNative() {
	try {
		const draft = await nativeRead();
		if (draft.error) throw replyError(draft);
		const editor = E('textarea', {
			id: 'ospf-bird-source', rows: 22, wrap: 'off', spellcheck: 'false',
			autocomplete: 'off', style: 'width:100%;font-family:monospace'
		});
		editor.value = draft.contents;
		const feedback = E('p', { role: 'alert', hidden: '' });
		const save = E('button', { type: 'submit', class: 'btn cbi-button-apply' }, _('Validate & Apply'));
		const form = E('form', {}, [
			E('p', {}, _('Edit the complete BIRD file, including virtual links, additional instances, authentication keys, and route filters. Applying switches this file to native management.')),
			E('label', { for: editor.id }, _('BIRD configuration (may contain keys)')), editor, feedback,
			E('div', { class: 'right' }, [
				E('button', { type: 'button', class: 'btn', click: () => ui.hideModal() }, _('Cancel')), ' ', save
			])
		]);
		form.addEventListener('submit', async event => {
			event.preventDefault();
			feedback.hidden = true;
			feedback.className = '';
			form.inert = true;
			try {
				const result = await nativeApply(draft.revision, editor.value);
				if (!result.ok) throw replyError(result, _('Unable to apply BIRD configuration.'));
				editor.value = '';
				ui.hideModal();
				window.location.reload();
			} catch (error) {
				feedback.className = 'cbi-section-error';
				dom.content(feedback, error.message);
				feedback.hidden = false;
			} finally {
				form.inert = false;
			}
		});
		ui.showModal(_('Native BIRD configuration'), [ form ]);
	} catch (error) {
		ui.addNotification(null, E('p', {}, error.message), 'error');
	}
}
const numbers = [
	[ 'cost', _('Interface cost'), 10, 1, 65535 ],
	[ 'priority', _('Router priority'), 1, 0, 255 ],
	[ 'hello', _('Hello interval (seconds)'), 10, 1, 65535 ],
	[ 'dead', _('Dead interval (seconds)'), 40, 2, 65535 ],
	[ 'retransmit', _('Retransmit interval (0 = default)'), 0, 0, 65535 ],
	[ 'wait', _('DR election wait (0 = default)'), 0, 0, 65535 ],
	[ 'poll', _('NBMA poll interval (0 = default)'), 0, 0, 65535 ],
	[ 'weight', _('ECMP weight'), 1, 1, 256 ],
	[ 'bfd_interval', _('BFD interval (milliseconds)'), 300, 50, 10000 ],
	[ 'bfd_multiplier', _('BFD detection multiplier'), 3, 2, 255 ]
];
const modes = [
	[ 'broadcast', _('Broadcast') ], [ 'ptp', _('Point-to-point') ], [ 'nbma', 'NBMA' ],
	[ 'ptmp', _('Point-to-multipoint') ], [ 'passive', _('Passive') ]
];
const authentication = [
	[ 'none', _('None') ], [ 'sha256', 'HMAC-SHA-256' ]
];
const families = [
	[ 'ipv4', _('IPv4 (OSPFv2)') ], [ 'ipv6', _('IPv6 (OSPFv3)') ], [ 'dual', _('IPv4 and IPv6') ]
];

function tabs(form, general, advanced) {
	const panels = [ E('div', {}, general), E('div', {}, advanced) ];
	const entries = [ _('General Settings'), _('Advanced Settings') ].map((label, index) =>
		E('li', {}, E('a', { href: '#', click: event => { event.preventDefault(); activate(index); } }, label)));
	function activate(index) {
		panels.forEach((panel, i) => {
			panel.hidden = i !== index;
			entries[i].className = i === index ? 'cbi-tab' : 'cbi-tab-disabled';
		});
	}
	activate(0);
	form.addEventListener('invalid', event => {
		const index = panels.findIndex(panel => panel.contains(event.target));
		if (index >= 0 && panels[index].hidden) activate(index);
		for (let parent = event.target.parentElement; parent && parent !== form; parent = parent.parentElement)
			if (parent.tagName === 'DETAILS') parent.open = true;
	}, true);
	return [ E('ul', { class: 'cbi-tabmenu' }, entries), ...panels ];
}

function row(label, control) {
	return E('div', { class: 'cbi-value' }, [
		E('label', { class: 'cbi-value-title', for: control.id }, label),
		E('div', { class: 'cbi-value-field' }, control)
	]);
}

function disclosure(title, children) {
	return E('details', { class: 'cbi-section' }, [ E('summary', {}, title), ...children ]);
}

function select(id, options, value) {
	const element = E('select', { id, class: 'cbi-input-select' },
		options.map(([ key, label ]) => E('option', { value: key }, label)));
	element.value = value;
	return element;
}

function input(id, value, attrs) {
	const element = E('input', { id, class: 'cbi-input-text', ...attrs });
	element.value = value ?? '';
	return element;
}

function checkbox(id, checked) {
	const element = input(id, '', { type: 'checkbox' });
	element.checked = !!checked;
	return element;
}

function listValues(value) {
	return value.trim().split(/\s+/).filter(Boolean);
}

function areaTable(settings) {
	const types = [ [ 'normal', _('Normal') ], [ 'stub', 'Stub' ], [ 'nssa', 'NSSA' ] ];
	const columns = [ _('Area ID'), _('Area type'), _('IPv4 summaries'), _('IPv6 summaries'), _('Actions') ];
	const areas = settings.slice();
	const body = E('tbody');
	const add = E('button', { class: 'btn cbi-button-add', type: 'button', click: () => edit(areas.length) }, _('Add area'));
	const table = E('table', { class: 'table' }, [
		E('thead', {}, E('tr', { class: 'tr table-titles' },
			columns.map(label => E('th', { class: 'th', scope: 'col' }, label)))), body
	]);

	function edit(index) {
		const current = areas[index] ?? {};
		const area = input('ospf-area-id', current.area, { required: '' });
		const type = select('ospf-area-type', types, current.type ?? 'normal');
		const summary4 = input('ospf-area-summary4', (current.summary4 ?? []).join(' '));
		const summary6 = input('ospf-area-summary6', (current.summary6 ?? []).join(' '));
		const cost = input('ospf-area-cost', current.default_cost ?? 0, { type: 'number', min: 0, max: 16777214, required: '' });
		const noSummary = checkbox('ospf-area-no-summary', current.no_summary);
		const defaultNssa = checkbox('ospf-area-default-nssa', current.default_nssa);
		const cost2 = input('ospf-area-cost2', current.default_cost2 ?? 0, { type: 'number', min: 0, max: 16777214, required: '' });
		const translator = checkbox('ospf-area-translator', current.translator);
		const stability = input('ospf-area-stability', current.translator_stability ?? 0,
			{ type: 'number', min: 0, max: 65535, required: '' });
		const feedback = E('p', { role: 'alert', hidden: '' });
		const form = E('form');
		const stubOptions = E('div', {}, [
			row(_('Stub / NSSA default cost (0 = default)'), cost),
			row(_('Suppress inter-area summaries into Stub / NSSA'), noSummary)
		]);
		const nssaOptions = E('div', {}, [
			row(_('Originate an NSSA default route'), defaultNssa),
			row(_('NSSA external type 2 default cost (0 = unset)'), cost2),
			row(_('Always translate NSSA external LSAs'), translator),
			row(_('NSSA translator stability (seconds, 0 = default)'), stability)
		]);
		const noOptions = E('p', {}, _('This area type has no additional settings.'));
		dom.content(form, [
			...tabs(form, [
				row(_('Area ID'), area), row(_('Area type'), type),
				row(_('IPv4 summaries'), summary4), row(_('IPv6 summaries'), summary6)
			], [ noOptions, stubOptions, nssaOptions ]), feedback,
			E('div', { class: 'right' }, [
				E('button', { class: 'btn cbi-button-neutral', type: 'button', click: () => ui.hideModal() }, _('Cancel')), ' ',
				E('button', { class: 'btn cbi-button-positive', type: 'submit' }, _('Save'))
			])
		]);
		function updateType() {
			cost.disabled = noSummary.disabled = type.value === 'normal';
			defaultNssa.disabled = cost2.disabled = translator.disabled = stability.disabled = type.value !== 'nssa';
			stubOptions.hidden = cost.disabled;
			nssaOptions.hidden = defaultNssa.disabled;
			noOptions.hidden = !stubOptions.hidden;
		}
		type.addEventListener('change', updateType);
		updateType();
		form.addEventListener('submit', event => {
			event.preventDefault();
			feedback.hidden = true;
			const value = area.value.trim();
			const parts = value.split('.');
			const id = parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255 && String(Number(part)) === part)
				? String(parts.reduce((sum, part) => sum * 256 + Number(part), 0)) : value;
			if (!/^(0|[1-9]\d{0,9})$/.test(id) || Number(id) > 4294967295 ||
			    (id === '0' && type.value !== 'normal') || areas.some((entry, i) => i !== index && entry.area === id)) {
				feedback.className = 'cbi-section-error';
				dom.content(feedback, _('Enter a unique, valid area ID. Area 0 must be normal.'));
				feedback.hidden = false;
				return;
			}
			if (type.value === 'nssa' && defaultNssa.checked && noSummary.checked) {
				feedback.className = 'cbi-section-error';
				dom.content(feedback, _('NSSA default route origination requires summary propagation.'));
				feedback.hidden = false;
				return;
			}
			areas[index] = { area: id, type: type.value, summary4: listValues(summary4.value),
				summary6: listValues(summary6.value), default_cost: cost.disabled ? 0 : Number(cost.value),
				no_summary: !noSummary.disabled && noSummary.checked,
				default_nssa: !defaultNssa.disabled && defaultNssa.checked,
				default_cost2: cost2.disabled ? 0 : Number(cost2.value),
				translator: !translator.disabled && translator.checked,
				translator_stability: stability.disabled ? 0 : Number(stability.value) };
			render();
			ui.hideModal();
		});
		ui.showModal(current.area == null ? _('Add area') : _('Edit area'), [ form ]);
	}

	function render() {
		add.disabled = areas.length >= 32;
		dom.content(body, areas.length ? areas.map((entry, index) => E('tr', { class: 'tr' }, [
			...[ entry.area, types.find(([ type ]) => type === entry.type)?.[1],
				entry.summary4?.join(' '), entry.summary6?.join(' ') ].map(value => E('td', { class: 'td' }, value || '—')),
			E('td', { class: 'td cbi-section-actions' }, [
				E('button', { class: 'btn cbi-button-edit', type: 'button', click: () => edit(index) }, _('Edit')), ' ',
				E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
					areas.splice(index, 1);
					render();
				} }, _('Delete'))
			])
		])) : [ E('tr', { class: 'tr' }, [
			E('td', { class: 'td', colspan: columns.length }, _('No area settings configured.'))
		]) ]);
	}
	render();
	return { table, add, areas };
}

function additionalSettings(schema, devices, links, initial) {
	const names = Object.keys(schema);
	const entries = initial.slice();
	const body = E('tbody');
	const columns = [ _('Setting'), _('IP family'), _('Target'), _('Actions') ];
	const add = E('button', { class: 'btn cbi-button-add', type: 'button',
		click: () => edit(entries.length) }, _('Add advanced setting'));
	const table = E('table', { class: 'table' }, [
		E('thead', {}, E('tr', { class: 'tr table-titles' },
			columns.map(label => E('th', { class: 'th', scope: 'col' }, label)))), body
	]);
	function edit(index) {
		const existing = entries[index];
		const option = select('bird-detail-name', names.map(name => [ name, _(name) ]), existing?.name ?? names[0]);
		const family = select('bird-detail-family', [ [ '4', 'IPv4' ], [ '6', 'IPv6' ] ], String(existing?.family ?? 4));
		const fields = E('div');
		const feedback = E('p', { class: 'cbi-section-error', role: 'alert', hidden: '' });
		const save = E('button', { class: 'btn cbi-button-positive', type: 'submit' }, _('Save'));
		let target, controls;
		function update() {
			const [ scope, , metadata ] = schema[option.value];
			const current = existing?.name === option.value ? existing : null;
			family.disabled = [ 'bfd', 'bfd-auth', 'transport' ].includes(scope);
			if (family.disabled) family.value = '4';
			const rows = [];
			feedback.hidden = true;
			save.disabled = false;
			target = null;
			if ([ 'link', 'bfd', 'bfd-auth', 'peer', 'key' ].includes(scope)) {
				const bfd = scope === 'bfd' || scope === 'bfd-auth';
				const candidates = bfd ? links.filter(link => link.bfd && link.mode !== 'passive').map(link => link.device) :
					Array.from(new Set([ ...devices, ...(current?.target ? [ current.target ] : []) ]));
				const selected = current ? (candidates.includes(current.target) ? current.target : '') : candidates[0];
				target = select('bird-detail-target', [[ '', _('Select a device') ],
					...candidates.map(device => [ device, device ])], selected ?? '');
				target.required = true;
				rows.push(row(_('Device'), target));
				if (bfd && !candidates.length) {
					dom.content(feedback, _('Enable BFD on an OSPF interface before adding BFD options.'));
					feedback.hidden = false;
					save.disabled = true;
				}
			} else if ([ 'virtual', 'virtual-key', 'hidden', 'external', 'stubnet' ].includes(scope)) {
				target = input('bird-detail-target', current?.target, { required: '' });
				rows.push(row(_('Area ID'), target));
			}
			controls = metadata.map(([ label, kind, max ], i) => {
				const id = 'bird-detail-value-' + i;
				const value = current?.values[i];
				let field;
				if (Array.isArray(kind))
					field = select(id, kind.map(key => [ key, _(key) ]), value ?? kind[0]);
				else if (kind === 'switch')
					field = checkbox(id, value);
				else if (kind === 'uint' || kind === 'optional_uint') {
					field = input(id, value, { type: 'number', min: 0, max });
					field.required = kind === 'uint';
				} else {
					field = input(id, value, kind === 'secret' ?
						{ type: 'password', autocomplete: 'new-password', maxlength: 64 } :
						kind === 'date' ? { placeholder: 'YYYY-MM-DD HH:MM:SS' } : { required: '' });
					if (kind === 'secret') field.required = !current;
				}
				rows.push(row(_(label), field));
				return field;
			});
			dom.content(fields, rows);
		}
		option.addEventListener('change', update);
		update();
		const form = E('form', {}, [
			row(_('Setting'), option), row(_('IP family'), family), fields, feedback,
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', type: 'button', click: () => ui.hideModal() }, _('Cancel')), ' ',
				save
			])
		]);
		form.addEventListener('submit', event => {
			event.preventDefault();
			const values = controls.map(field => field.type === 'checkbox' ? field.checked :
				field.type === 'number' && field.value !== '' ? Number(field.value) : field.value.trim());
			entries[index] = { name: option.value, family: Number(family.value), target: target?.value.trim() ?? '', values };
			render();
			ui.hideModal();
		});
		ui.showModal(existing ? _('Edit advanced setting') : _('Add advanced setting'), [ form ]);
	}
	function render() {
		add.disabled = entries.length >= 96 || names.length === 0;
		dom.content(body, entries.length ? entries.map((entry, index) => E('tr', { class: 'tr' }, [
			...[ _(entry.name), [ 'bfd', 'bfd-auth' ].includes(schema[entry.name]?.[0]) ? _('Shared') : 'IPv' + entry.family,
				entry.target || '—' ].map(value => E('td', { class: 'td' }, value)),
			E('td', { class: 'td cbi-section-actions' }, [
				E('button', { class: 'btn cbi-button-edit', type: 'button', click: () => edit(index) }, _('Edit')), ' ',
				E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
					entries.splice(index, 1);
					render();
				} }, _('Delete'))
			])
		])) : [ E('tr', { class: 'tr' }, [
			E('td', { class: 'td', colspan: columns.length }, _('No additional settings configured.'))
		]) ]);
	}
	render();
	return { table, add, entries, refresh(rows) {
		entries.splice(0, entries.length, ...rows);
		render();
	} };
}

function advancedForm(settings, schema, devices, links) {
	const ipv6 = checkbox('ospf-v3', settings.ipv6);
	const install6 = checkbox('ospf-install6', settings.install6);
	const prefixes6 = input('ospf-prefixes6', (settings.prefixes6 ?? []).join(' '));
	const instance4 = input('ospf-instance4', settings.instance4 ?? -1, { type: 'number', min: -1, max: 255, required: '' });
	const instance6 = input('ospf-instance6', settings.instance6 ?? -1, { type: 'number', min: -1, max: 255, required: '' });
	const ecmp = input('ospf-ecmp', settings.ecmp ?? 0, { type: 'number', min: 0, max: 64, required: '' });
	const graceful = select('ospf-graceful', [
		[ 'default', _('BIRD default') ], [ 'off', _('Disabled') ],
		[ 'aware', _('Helper only') ], [ 'on', _('Enabled') ]
	], settings.graceful ?? 'default');
	const graceTime = input('ospf-grace-time', settings.grace_time ?? 120,
		{ type: 'number', min: 1, max: 3600, required: '' });
	const stubRouter = checkbox('ospf-stub-router', settings.stub_router);
	const mergeExternal = checkbox('ospf-merge-external', settings.merge_external);
	const compatibility = checkbox('ospf-rfc1583', settings.rfc1583);
	const tick = input('ospf-tick', settings.tick ?? 0, { type: 'number', min: 0, max: 60, required: '' });
	const export4 = input('ospf-redistribute4', (settings.redistribute4 ?? []).join(' '));
	const export6 = input('ospf-redistribute6', (settings.redistribute6 ?? []).join(' '));
	const areas = areaTable(settings.areas ?? []);
	const extra = additionalSettings(schema, devices, links, settings.details ?? []);
	const install6Row = row(_('Install IPv6 OSPF routes'), install6);
	const prefixes6Row = row(_('Exact IPv6 prefixes (empty = all except default)'), prefixes6);
	const graceTimeRow = row(_('Grace period (seconds)'), graceTime);
	function updateVisibility() {
		install6Row.hidden = !ipv6.checked;
		prefixes6Row.hidden = !ipv6.checked || !install6.checked;
		graceTimeRow.hidden = graceful.value !== 'on';
		graceTime.disabled = graceTimeRow.hidden;
	}
	ipv6.addEventListener('change', updateVisibility);
	install6.addEventListener('change', updateVisibility);
	graceful.addEventListener('change', updateVisibility);
	updateVisibility();
	return {
		general: [ row(_('Enable OSPFv3 (IPv6)'), ipv6), install6Row, prefixes6Row ],
		fields: [
			row(_('ECMP paths (0 = BIRD default, 1 = disabled)'), ecmp),
			row(_('Graceful restart'), graceful), graceTimeRow,
			E('h3', {}, _('Route redistribution')),
			E('p', {}, _('Enter exact prefixes, separated by spaces, to advertise from the Linux routing table. An empty list disables redistribution.')),
			row(_('IPv4 redistribution prefixes'), export4), row(_('IPv6 redistribution prefixes'), export6),
			E('h3', {}, _('Area types and summaries')),
			E('p', {}, _('Area 0 must be normal. Enter summary prefixes separated by spaces. An area takes effect when assigned to an interface.')),
			areas.table, areas.add,
			disclosure(_('Protocol tuning and compatibility'), [
				row(_('OSPFv2 instance ID (-1 = default)'), instance4),
				row(_('OSPFv3 instance ID (-1 = default)'), instance6),
				row(_('Avoid transit traffic (stub router)'), stubRouter),
				row(_('Merge equal-cost external routes'), mergeExternal),
				row(_('RFC 1583 compatibility (OSPFv2)'), compatibility),
				row(_('SPF calculation interval (seconds, 0 = default)'), tick)
			]),
			disclosure(_('Additional protocol, area and interface settings'), [
				E('p', {}, _('Each row applies to the selected address family. Enable BFD on an interface before adding BFD options. Route rules are evaluated in table order.')),
				extra.table, extra.add
			])
		],
		value() {
			return { ipv6: ipv6.checked, install6: install6.checked, ecmp: Number(ecmp.value),
				prefixes6: listValues(prefixes6.value), instance4: Number(instance4.value), instance6: Number(instance6.value),
				graceful: graceful.value, grace_time: Number(graceTime.value),
				stub_router: stubRouter.checked, merge_external: mergeExternal.checked,
				rfc1583: compatibility.checked, tick: Number(tick.value),
				redistribute4: listValues(export4.value), redistribute6: listValues(export6.value),
				areas: areas.areas, details: extra.entries };
		},
		refresh(value) { extra.refresh(value?.details ?? []); }
	};
}

function report(data) {
	const sections = [
		[ _('OSPF routes'), data.routes ],
		[ _('Interface status'), data.interfaces ]
	];
	if (data.settings?.advanced?.ipv6) sections.push([ _('OSPFv3 routes'), data.routes6 ]);
	if (data.protocols) sections.push([ _('BIRD protocols'), data.protocols ]);
	if (data.settings?.links?.some(link => link.bfd)) sections.push([ _('BFD sessions'), data.bfd ]);
	return [
		E('h3', {}, _('Neighbors')), E('pre', { style: 'overflow-x:auto' }, data.neighbors || '—'),
		disclosure(_('Detailed routing status'), sections.map(([ label, value ]) => E('div', { class: 'cbi-section' }, [
			E('h4', {}, label), E('pre', { style: 'overflow-x:auto' }, value || '—')
		])))
	];
}

function editInterface(devices, settings, otherLinks, save) {
	const id = 'ospf-interface-edit';
	const control = {
		device: select(id + '-device', [[ '', _('Select a device') ],
			...devices.map(name => [ name, name ])], settings.device ?? ''),
		area: input(id + '-area', settings.area ?? '0', { required: '' }),
		mode: select(id + '-mode', modes, settings.mode ?? 'broadcast'),
		family: select(id + '-family', families, settings.family ?? 'ipv4'),
		bfd: checkbox(id + '-bfd', settings.bfd),
		ttl_security: checkbox(id + '-ttl-security', settings.ttl_security),
		strict_nbma: checkbox(id + '-strict-nbma', settings.strict_nbma),
		ignore_carrier: checkbox(id + '-ignore-carrier', settings.ignore_carrier),
		neighbors: input(id + '-neighbors', (settings.neighbors ?? []).join(' ')),
		auth: select(id + '-auth', authentication, settings.auth ?? 'none'),
		key: input(id + '-key', settings.key, { type: 'password', autocomplete: 'new-password', maxlength: 64 })
	};
	control.device.required = true;
	const authRow = row(_('Authentication'), control.auth);
	const keyRow = row(_('Key (leave blank to keep existing)'), control.key);
	const general = [
		row(_('Device'), control.device), row(_('Area'), control.area), row(_('Mode'), control.mode),
		row(_('IP family'), control.family), authRow, keyRow
	];
	const bfdRows = E('div');
	const neighborRows = E('div', {}, [
		row(_('Only accept configured neighbors (NBMA / point-to-multipoint)'), control.strict_nbma),
		row(_('Manual neighbors (addresses separated by spaces)'), control.neighbors)
	]);
	const advanced = [
		row(_('Enable BFD'), control.bfd), bfdRows
	];
	const tuning = [
		row(_('TTL security'), control.ttl_security), row(_('Ignore link carrier state'), control.ignore_carrier), neighborRows
	];
	for (const [ name, label, initial, min, max ] of numbers) {
		control[name] = input(id + '-' + name, settings[name] ?? initial, { type: 'number', min, max, required: '' });
		const rows = name.startsWith('bfd_') ? bfdRows : name === 'poll' ? neighborRows : null;
		if (rows) rows.appendChild(row(label, control[name]));
		else (['cost', 'hello', 'dead'].includes(name) ? advanced : tuning).push(row(label, control[name]));
	}
	advanced.push(disclosure(_('Interface tuning'), tuning));
	const feedback = E('p', { class: 'cbi-section-error', role: 'alert', hidden: '' });
	const form = E('form');
	dom.content(form, [
		...tabs(form, general, advanced), feedback,
		E('div', { class: 'right' }, [
			E('button', { class: 'btn cbi-button-neutral', type: 'button', click: () => ui.hideModal() }, _('Cancel')),
			' ',
			E('button', { class: 'btn cbi-button-positive', type: 'submit' }, _('Save'))
		])
	]);
	const updateMode = () => {
		control.auth.disabled = control.mode.value === 'passive';
		control.bfd.disabled = control.auth.disabled;
		control.key.disabled = control.auth.disabled || control.auth.value !== 'sha256';
		control.neighbors.disabled = ![ 'nbma', 'ptmp' ].includes(control.mode.value);
		control.strict_nbma.disabled = control.neighbors.disabled;
		authRow.hidden = control.auth.disabled;
		keyRow.hidden = control.key.disabled;
		bfdRows.hidden = control.bfd.disabled || !control.bfd.checked;
		control.bfd_interval.disabled = control.bfd_multiplier.disabled = bfdRows.hidden;
		neighborRows.hidden = control.neighbors.disabled;
		control.poll.disabled = neighborRows.hidden;
	};
	control.mode.addEventListener('change', updateMode);
	control.auth.addEventListener('change', updateMode);
	control.bfd.addEventListener('change', updateMode);
	updateMode();
	form.addEventListener('submit', event => {
		event.preventDefault();
		const result = {};
		for (const [ name, field ] of Object.entries(control))
			result[name] = field.type === 'checkbox' ? field.checked && !field.disabled :
				field.type === 'number' ? Number(field.value) : field.value.trim();
		result.neighbors = control.neighbors.disabled ? [] : listValues(result.neighbors);
		if (otherLinks.some(link => link.device === result.device)) {
			dom.content(feedback, _('This device is already in the interface list.'));
		} else if (result.dead <= result.hello) {
			dom.content(feedback, _('Dead interval must exceed hello interval.'));
		} else {
			if (control.auth.disabled)
				result.auth = 'none';
			if (control.key.disabled)
				result.key = '';
			save(result);
			ui.hideModal();
			return;
		}
		feedback.hidden = false;
	});
	ui.showModal(settings.device ? _('Edit interface') : _('Add interface'), [ form ]);
}

return view.extend({
	load() { return status(); },
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	render(data) {
		const panel = E('div', {}, report(data));
		const refresh = E('button', { class: 'btn', type: 'button', click: () =>
			status().then(next => dom.content(panel, report(next))).catch(error =>
				ui.addNotification(null, E('p', {}, error.message), 'error'))
		}, _('Refresh status'));
		const native = E('button', { class: 'btn', type: 'button', click: editNative }, _('Edit native BIRD configuration'));
		const page = E('div', {}, [ E('h2', {}, 'Bird'), refresh, ' ', native, panel ]);
		if (!data.settings) {
			page.appendChild(E('p', {}, data.mode === 'native' ?
				_('BIRD is managed in the native configuration editor.') :
				_('The saved BIRD configuration could not be loaded into the form.')));
			return page;
		}

		const settings = data.settings;
		const enabled = input('ospf-enabled', '', { type: 'checkbox' });
		enabled.checked = settings.enabled;
		const router = input('ospf-router', settings.router_id, { required: '' });
		const policy = select('ospf-policy', [
			[ 'none', _('Do not install routes') ],
			[ 'selected', _('Install exact prefixes listed below') ],
			[ 'all', _('Install all OSPF routes except the default route') ]
		], settings.policy);
		const prefixes = E('textarea', { id: 'ospf-prefixes', class: 'cbi-input-textarea', rows: 3 });
		prefixes.value = settings.prefixes.join('\n');
		const prefixRow = row(_('IPv4 prefixes (one per line)'), prefixes);
		const updatePolicy = () => { prefixRow.hidden = policy.value !== 'selected'; };
		policy.addEventListener('change', updatePolicy);
		updatePolicy();
		const takeover = input('ospf-takeover', '', { type: 'checkbox' });
		const interfaces = settings.links.slice();
		const list = E('tbody');
		const columns = [ _('Device'), _('Area'), _('Mode'), _('IP family'), _('Interface cost'), _('Authentication'), _('Actions') ];
		const edit = index => editInterface(data.devices, interfaces[index] ?? {},
			interfaces.filter((_, position) => position !== index), entry => {
				interfaces[index] = entry;
				renderInterfaces();
			});
		const add = E('button', { class: 'btn cbi-button-add', type: 'button',
			click: () => edit(interfaces.length) }, _('Add interface'));
		const renderInterfaces = () => {
			add.disabled = interfaces.length >= 32;
			dom.content(list, interfaces.length ? interfaces.map((entry, index) => E('tr', { class: 'tr' }, [
				...[ entry.device, entry.area, modes.find(([ value ]) => value === entry.mode)?.[1],
					families.find(([ value ]) => value === (entry.family ?? 'ipv4'))?.[1],
					String(entry.cost), authentication.find(([ value ]) => value === entry.auth)?.[1] ]
					.map(value => E('td', { class: 'td' }, value ?? '—')),
				E('td', { class: 'td cbi-section-actions' }, [
					E('button', { class: 'btn cbi-button-edit', type: 'button', click: () => edit(index) }, _('Edit')),
					' ',
					E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
						interfaces.splice(index, 1);
						renderInterfaces();
					} }, _('Delete'))
				])
			])) : [ E('tr', { class: 'tr' }, [
				E('td', { class: 'td', colspan: columns.length }, _('No OSPF interfaces configured.'))
			]) ]);
		};
		renderInterfaces();
		const table = E('table', { class: 'table' }, [
			E('thead', {}, E('tr', { class: 'tr table-titles' },
				columns.map(label => E('th', { class: 'th', scope: 'col' }, label)))),
			list
		]);

		const form = E('form', { class: 'cbi-section' });
		const advanced = advancedForm(settings.advanced ?? {}, data.detail_schema ?? {}, data.devices, interfaces);
		const general = [
			row(_('Enable OSPF'), enabled), row(_('Router ID'), router),
			row(_('System routing table'), policy), prefixRow,
			...advanced.general,
			E('p', {}, _('A passive interface advertises its subnet without forming neighbors. On an active link, area, timers and authentication must match the peer.')),
			E('h3', {}, _('OSPF interfaces')), table, add
		];
		dom.content(form, [ E('h3', {}, _('OSPF configuration')), ...tabs(form, general, advanced.fields) ]);
		const migration = E('div', {}, data.mode === 'external' ? [
			E('p', {}, _('The first save replaces the existing BIRD configuration and keeps a backup. Other BIRD protocols in that configuration will stop.')),
			row(_('Replace existing BIRD configuration'), takeover)
		] : data.mode === 'legacy' ? [
			E('p', {}, _('Existing settings were imported. The original BIRD file is backed up on first save.'))
		] : []);
		form.appendChild(migration);
		const save = E('button', { class: 'btn cbi-button cbi-button-apply', type: 'submit' }, _('Save & Apply'));
		form.appendChild(save);
		form.addEventListener('submit', async event => {
			event.preventDefault();
			save.disabled = true;
			form.inert = true;
			try {
				const values = {
					enabled: enabled.checked, router_id: router.value.trim(), policy: policy.value,
					prefixes: policy.value === 'selected' ? prefixes.value.split(/\s+/).filter(Boolean) : [],
					links: interfaces, advanced: advanced.value(), takeover: takeover.checked
				};
				const result = await apply(data.revision, JSON.stringify(values));
				if (!result.ok)
					throw replyError(result, _('Unable to apply OSPF configuration.'));
				const next = await status();
				data.revision = next.revision;
				dom.content(panel, report(next));
				migration.remove();
				interfaces.splice(0, interfaces.length, ...next.settings.links);
				advanced.refresh(next.settings.advanced);
				renderInterfaces();
				ui.addNotification(null, E('p', {}, result.boot_enabled ? _('OSPF configuration applied.') :
					_('Configuration applied, but BIRD could not be enabled at boot.')), result.boot_enabled ? 'info' : 'warning');
			} catch (error) {
				ui.addNotification(null, E('p', {}, error.message), 'error');
			} finally {
				save.disabled = false;
				form.inert = false;
			}
		});
		page.appendChild(form);
		return page;
	}
});
