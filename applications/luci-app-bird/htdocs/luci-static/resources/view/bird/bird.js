// SPDX-License-Identifier: MIT
'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require validation';

const status = rpc.declare({ object: 'luci.ospf', method: 'status', reject: true });
const apply = rpc.declare({
	object: 'luci.ospf', method: 'apply', params: [ 'revision', 'payload' ], reject: true
});
const nativeRead = rpc.declare({ object: 'luci.ospf', method: 'native_read', reject: true });
const nativeApply = rpc.declare({
	object: 'luci.ospf', method: 'native_apply', params: [ 'revision', 'contents' ], reject: true
});

// The backend supplies these message IDs. Literal calls let LuCI extract them.
const backendMessages = new Map([
	[ "A rule already exists for this address family, direction and prefix. Edit the existing rule.", _("A rule already exists for this address family, direction and prefix. Edit the existing rule.") ],
	[ "Enter the OSPF receive buffer size.", _("Enter the OSPF receive buffer size.") ],
	[ "Enter a metric for the selected route metric type.", _("Enter a metric for the selected route metric type.") ],
	[ "BFD authentication keys must match the selected interface mode.", _("BFD authentication keys must match the selected interface mode.") ],
	[ "Invalid dead interval or multiplier on %s.", _("Invalid dead interval or multiplier on %s.") ],
	[ "Select a valid BFD authentication mode.", _("Select a valid BFD authentication mode.") ],
	[ "Size mode", _("Size mode") ],
	[ "bytes", _("bytes") ],
	[ "Interface dead interval", _("Interface dead interval") ],
	[ "seconds", _("seconds") ],
	[ "multiplier", _("multiplier") ],
	[ "Value", _("Value") ],
	[ "BFD authentication key", _("BFD authentication key") ],
	[ "Metric type", _("Metric type") ],
	[ "none", _("none") ],
	[ "e1", _("e1") ],
	[ "e2", _("e2") ],
	[ "Metric", _("Metric") ],
	[ "Area settings do not apply to the selected area type.", _("Area settings do not apply to the selected area type.") ],
	[ "RFC 1583 compatibility requires OSPFv2 for IPv4.", _("RFC 1583 compatibility requires OSPFv2 for IPv4.") ],
	[ "Choose either an E1 or an E2 default metric for NSSA default origination.", _("Choose either an E1 or an E2 default metric for NSSA default origination.") ],
	[ "Multiple route rules match the same family, direction and prefix.", _("Multiple route rules match the same family, direction and prefix.") ],
	[ "Route metrics and tags require an accepted redistribution rule.", _("Route metrics and tags require an accepted redistribution rule.") ],
	[ "Choose either an E1 or an E2 metric for a route rule.", _("Choose either an E1 or an E2 metric for a route rule.") ],
	[ "BFD uses one authentication mode per interface and one password in simple mode.", _("BFD uses one authentication mode per interface and one password in simple mode.") ],
	[ "An area prefix cannot be both advertised as a summary and hidden.", _("An area prefix cannot be both advertised as a summary and hidden.") ],
	[ "A hidden NSSA external summary cannot have a route tag.", _("A hidden NSSA external summary cannot have a route tag.") ],
	[ "Set the area type to NSSA before adding an external summary.", _("Set the area type to NSSA before adding an external summary.") ],
	[ "A manual neighbor can only be listed once for each address family and interface.", _("A manual neighbor can only be listed once for each address family and interface.") ],
	[ "The IPv4 channel can only use RFC 5838 when running OSPFv3 with RFC 5838 enabled.", _("The IPv4 channel can only use RFC 5838 when running OSPFv3 with RFC 5838 enabled.") ],
	[ "An additional OSPF instance must use a different ID from the primary interface instance.", _("An additional OSPF instance must use a different ID from the primary interface instance.") ],
	[ "The dead interval multiplier must be greater than one.", _("The dead interval multiplier must be greater than one.") ],
	[ "Simple authentication requires one OSPFv2 password of at most eight characters and no key timing.", _("Simple authentication requires one OSPFv2 password of at most eight characters and no key timing.") ],
	[ "%s is not applicable to interface %s in the selected address family.", _("%s is not applicable to interface %s in the selected address family.") ],
	[ "accept", _("accept") ],
	[ "Accept from", _("Accept from") ],
	[ "Accept to", _("Accept to") ],
	[ "Action", _("Action") ],
	[ "Add an OSPF interface for IPv%s before adding %s.", _("Add an OSPF interface for IPv%s before adding %s.") ],
	[ "Add the matching virtual link before adding its authentication key.", _("Add the matching virtual link before adding its authentication key.") ],
	[ "Additional OSPF interface instance", _("Additional OSPF interface instance") ],
	[ "Algorithm", _("Algorithm") ],
	[ "Area ID", _("Area ID") ],
	[ "Assign area %s to the selected address family before adding area options.", _("Assign area %s to the selected address family before adding area options.") ],
	[ "Authentication mode", _("Authentication mode") ],
	[ "BFD authentication", _("BFD authentication") ],
	[ "BFD idle transmit interval", _("BFD idle transmit interval") ],
	[ "BFD minimum receive interval", _("BFD minimum receive interval") ],
	[ "BFD minimum transmit interval", _("BFD minimum transmit interval") ],
	[ "BFD passive mode", _("BFD passive mode") ],
	[ "BIRD could not apply the configuration. The previous file and service state were restored.", _("BIRD could not apply the configuration. The previous file and service state were restored.") ],
	[ "BIRD could not apply the configuration. The previous file was restored, but the service could not be verified.", _("BIRD could not apply the configuration. The previous file was restored, but the service could not be verified.") ],
	[ "BIRD does not support virtual links for the OSPFv3 IPv4 address family.", _("BIRD does not support virtual links for the OSPFv3 IPv4 address family.") ],
	[ "BIRD rejected the configuration. Check areas and export prefixes.", _("BIRD rejected the configuration. Check areas and export prefixes.") ],
	[ "broadcast", _("broadcast") ],
	[ "Bytes", _("Bytes") ],
	[ "Configuration changed or request too large. Reload the page.", _("Configuration changed or request too large. Reload the page.") ],
	[ "Configuration changed. Open the editor again.", _("Configuration changed. Open the editor again.") ],
	[ "Configuration changed. Reload the page.", _("Configuration changed. Reload the page.") ],
	[ "Configure up to 32 areas.", _("Configure up to 32 areas.") ],
	[ "Configure up to 96 additional settings.", _("Configure up to 96 additional settings.") ],
	[ "Confirm replacing the existing BIRD configuration.", _("Confirm replacing the existing BIRD configuration.") ],
	[ "Cost", _("Cost") ],
	[ "Could not allocate configuration files.", _("Could not allocate configuration files.") ],
	[ "Could not back up the existing BIRD configuration.", _("Could not back up the existing BIRD configuration.") ],
	[ "Could not replace the BIRD configuration.", _("Could not replace the BIRD configuration.") ],
	[ "Could not restore the original configuration. Backup: %s", _("Could not restore the original configuration. Backup: %s") ],
	[ "Could not write configuration files.", _("Could not write configuration files.") ],
	[ "Custom stub network", _("Custom stub network") ],
	[ "Dead interval (seconds)", _("Dead interval (seconds)") ],
	[ "Dead interval multiplier", _("Dead interval multiplier") ],
	[ "Dead interval must exceed hello interval on %s.", _("Dead interval must exceed hello interval on %s.") ],
	[ "Direction", _("Direction") ],
	[ "DR election wait", _("DR election wait") ],
	[ "DSCP", _("DSCP") ],
	[ "Duplicate additional setting.", _("Duplicate additional setting.") ],
	[ "E1 metric", _("E1 metric") ],
	[ "E2 metric", _("E2 metric") ],
	[ "Each interface must have a unique, valid device name.", _("Each interface must have a unique, valid device name.") ],
	[ "Eligible", _("Eligible") ],
	[ "Enable BFD on %s before adding BFD options.", _("Enable BFD on %s before adding BFD options.") ],
	[ "Enable OSPFv3 or select an IPv4 interface.", _("Enable OSPFv3 or select an IPv4 interface.") ],
	[ "Enabled", _("Enabled") ],
	[ "Enter a 16–64 character key on %s.", _("Enter a 16–64 character key on %s.") ],
	[ "Enter a BIRD configuration of up to 64 KiB.", _("Enter a BIRD configuration of up to 64 KiB.") ],
	[ "Enter a valid area and mode for %s.", _("Enter a valid area and mode for %s.") ],
	[ "Enter a valid, nonzero router ID.", _("Enter a valid, nonzero router ID.") ],
	[ "Enter up to 64 IPv4 prefixes for the selected route policy.", _("Enter up to 64 IPv4 prefixes for the selected route policy.") ],
	[ "Enter up to 64 neighbors on %s.", _("Enter up to 64 neighbors on %s.") ],
	[ "Exact prefix", _("Exact prefix") ],
	[ "Generate from", _("Generate from") ],
	[ "Generate to", _("Generate to") ],
	[ "Hello interval (seconds)", _("Hello interval (seconds)") ],
	[ "Hidden", _("Hidden") ],
	[ "Hide area prefix", _("Hide area prefix") ],
	[ "hmac sha1", _("hmac sha1") ],
	[ "hmac sha256", _("hmac sha256") ],
	[ "hmac sha384", _("hmac sha384") ],
	[ "hmac sha512", _("hmac sha512") ],
	[ "install", _("install") ],
	[ "Instance ID", _("Instance ID") ],
	[ "Invalid %s on %s.", _("Invalid %s on %s.") ],
	[ "Invalid additional setting target.", _("Invalid additional setting target.") ],
	[ "Invalid additional setting.", _("Invalid additional setting.") ],
	[ "Invalid advanced settings.", _("Invalid advanced settings.") ],
	[ "Invalid configuration request.", _("Invalid configuration request.") ],
	[ "Invalid ECMP or graceful restart setting.", _("Invalid ECMP or graceful restart setting.") ],
	[ "Invalid IPv4 prefix.", _("Invalid IPv4 prefix.") ],
	[ "Invalid neighbor address on %s.", _("Invalid neighbor address on %s.") ],
	[ "Invalid or duplicate area. Area 0 must be normal.", _("Invalid or duplicate area. Area 0 must be normal.") ],
	[ "Invalid route prefix.", _("Invalid route prefix.") ],
	[ "Invalid value for %s in %s.", _("Invalid value for %s in %s.") ],
	[ "Key ID", _("Key ID") ],
	[ "keyed md5", _("keyed md5") ],
	[ "keyed sha1", _("keyed sha1") ],
	[ "large", _("large") ],
	[ "meticulous keyed md5", _("meticulous keyed md5") ],
	[ "meticulous keyed sha1", _("meticulous keyed sha1") ],
	[ "Milliseconds", _("Milliseconds") ],
	[ "Mode", _("Mode") ],
	[ "Multiplier", _("Multiplier") ],
	[ "nbma", _("nbma") ],
	[ "NBMA neighbor election eligibility", _("NBMA neighbor election eligibility") ],
	[ "Neighbor address", _("Neighbor address") ],
	[ "Neighbor address does not match the selected OSPF transport.", _("Neighbor address does not match the selected OSPF transport.") ],
	[ "no", _("no") ],
	[ "normal", _("normal") ],
	[ "NSSA default route origination requires summary propagation.", _("NSSA default route origination requires summary propagation.") ],
	[ "NSSA external summary", _("NSSA external summary") ],
	[ "OSPF authentication key", _("OSPF authentication key") ],
	[ "OSPF instance ID must be between 0 and 255, or -1 for default.", _("OSPF instance ID must be between 0 and 255, or -1 for default.") ],
	[ "OSPF interface instance ID", _("OSPF interface instance ID") ],
	[ "OSPF packet DSCP", _("OSPF packet DSCP") ],
	[ "OSPF packet priority", _("OSPF packet priority") ],
	[ "OSPF receive buffer", _("OSPF receive buffer") ],
	[ "OSPF receive buffer preset", _("OSPF receive buffer preset") ],
	[ "OSPF send length", _("OSPF send length") ],
	[ "OSPF transmit delay", _("OSPF transmit delay") ],
	[ "OSPF virtual link", _("OSPF virtual link") ],
	[ "OSPF virtual-link authentication key", _("OSPF virtual-link authentication key") ],
	[ "OSPFv3 IPv4 address family", _("OSPFv3 IPv4 address family") ],
	[ "passive", _("passive") ],
	[ "Peer router ID", _("Peer router ID") ],
	[ "Point-to-point address", _("Point-to-point address") ],
	[ "Point-to-point netmask", _("Point-to-point netmask") ],
	[ "Prefix", _("Prefix") ],
	[ "Priority", _("Priority") ],
	[ "ptmp", _("ptmp") ],
	[ "ptp", _("ptp") ],
	[ "Real broadcast", _("Real broadcast") ],
	[ "redistribute", _("redistribute") ],
	[ "reject", _("reject") ],
	[ "Retransmit interval", _("Retransmit interval") ],
	[ "RFC 5838", _("RFC 5838") ],
	[ "Route filter rule", _("Route filter rule") ],
	[ "Route tag", _("Route tag") ],
	[ "Secondary interface", _("Secondary interface") ],
	[ "Seconds", _("Seconds") ],
	[ "Secret key", _("Secret key") ],
	[ "Select a valid authentication mode.", _("Select a valid authentication mode.") ],
	[ "Select a valid IP family on %s.", _("Select a valid IP family on %s.") ],
	[ "Select a valid system route policy.", _("Select a valid system route policy.") ],
	[ "Select at least one interface when enabling OSPF.", _("Select at least one interface when enabling OSPF.") ],
	[ "Select at least one IPv6 or dual-stack interface for OSPFv3.", _("Select at least one IPv6 or dual-stack interface for OSPFv3.") ],
	[ "simple", _("simple") ],
	[ "Size", _("Size") ],
	[ "Summary", _("Summary") ],
	[ "Suppress link LSA", _("Suppress link LSA") ],
	[ "The saved BIRD configuration metadata is invalid.", _("The saved BIRD configuration metadata is invalid.") ],
	[ "This configuration is managed in the BIRD native editor.", _("This configuration is managed in the BIRD native editor.") ],
	[ "This setting must use the IPv4 or shared scope.", _("This setting must use the IPv4 or shared scope.") ],
	[ "TTL security mode", _("TTL security mode") ],
	[ "tx only", _("tx only") ],
	[ "yes", _("yes") ]
]);

function backendLabel(key) {
	return backendMessages.get(key) ?? key;
}

function replyError(reply, fallback) {
	const message = reply.error ? backendLabel(reply.error) : fallback;
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
	[ 'retransmit', _('Retransmit interval (0 = default)'), 0, 0, 65535 ],
	[ 'wait', _('DR election wait (0 = default)'), 0, 0, 65535 ],
	[ 'poll', _('NBMA poll interval (0 = default)'), 0, 0, 65535 ],
	[ 'weight', _('ECMP weight'), 1, 1, 256 ],
	[ 'bfd_multiplier', _('BFD detection multiplier'), 3, 2, 255 ]
];
const modes = [
	[ 'broadcast', _('Broadcast') ], [ 'ptp', _('Point-to-point') ], [ 'nbma', 'NBMA' ],
	[ 'ptmp', _('Point-to-multipoint') ], [ 'passive', _('Passive') ]
];
const authentication = [
	[ 'hmac sha256', 'HMAC-SHA-256' ], [ 'hmac sha384', 'HMAC-SHA-384' ],
	[ 'hmac sha512', 'HMAC-SHA-512' ], [ 'hmac sha1', 'HMAC-SHA-1' ],
	[ 'keyed sha1', 'Keyed SHA-1' ], [ 'keyed md5', 'Keyed MD5' ],
	[ 'simple', _('Plaintext password (OSPFv2 only)') ]
];
const interfaceKey = 'OSPF authentication key';
const bfdKey = 'BFD authentication key';
const interfaceOptions = new Set([ interfaceKey, 'TTL security mode', 'Interface dead interval',
	'BFD minimum receive interval', 'BFD minimum transmit interval', 'NBMA neighbor election eligibility', bfdKey ]);
const routeOption = 'Route filter rule';
const interfaceScopes = [ 'link', 'bfd', 'bfd-key', 'peer', 'key' ];
const areaScopes = [ 'virtual', 'virtual-key', 'external', 'stubnet' ];
const families = [
	[ 'ipv4', _('IPv4 (OSPFv2)') ], [ 'ipv6', _('IPv6 (OSPFv3)') ], [ 'dual', _('IPv4 and IPv6') ]
];

function tabs(form, sections) {
	const panels = sections.map(item => E('div', { class: 'ospf-tab-panel' }, item.content));
	const entries = sections.map((item, index) =>
		E('li', {}, E('a', { href: '#', click: event => { event.preventDefault(); activate(index); } }, item.label)));
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
	return [ E('ul', { class: 'cbi-tabmenu ospf-tabs' }, entries), ...panels ];
}

function section(title, description, children) {
	return E('div', { class: 'cbi-section ospf-section' }, [
		E('h3', {}, title),
		...(description ? [ E('p', { class: 'cbi-section-descr' }, description) ] : []),
		...children
	]);
}

function dataTable(headers, body, className = '') {
	return E('div', { class: 'ospf-table-wrap' }, E('table', { class: 'table ' + className }, [
		E('thead', {}, E('tr', { class: 'tr table-titles' },
			headers.map(label => E('th', { class: 'th', scope: 'col' }, label)))),
		body
	]));
}

function emptyTableRow(columns, message) {
	return E('td', { class: 'td ospf-empty', colspan: columns }, message);
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

function areaNetworks(initial) {
	const entries = [];
	const body = E('tbody');
	let sequence = 0;
	function add(network = { family: 4, prefix: '', hidden: false }) {
		const id = 'ospf-area-network-' + (++sequence);
		const family = select(id + '-family', [[ '4', 'IPv4' ], [ '6', 'IPv6' ]], String(network.family));
		const prefix = input(id + '-prefix', network.prefix, { required: '' });
		const action = select(id + '-action', [[ 'announce', _('Advertise summary') ], [ 'hide', _('Hide prefix') ]],
			network.hidden ? 'hide' : 'announce');
		const entry = { family, prefix, action };
		const element = E('tr', { class: 'tr' }, [
			...[family, prefix, action].map(field => E('td', { class: 'td' }, field)),
			E('td', { class: 'td' }, E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
				entries.splice(entries.indexOf(entry), 1);
				element.remove();
			} }, _('Delete')))
		]);
		entries.push(entry);
		body.appendChild(element);
	}
	for (const network of initial) add(network);
	return {
		fields: [
			E('h4', {}, _('Area prefixes')),
			dataTable([ _('IP family'), _('Prefix'), _('Action'), _('Actions') ], body),
			E('button', { class: 'btn cbi-button-add', type: 'button', click: () => add() }, _('Add prefix'))
		],
		value() {
			return entries.map(entry => ({ family: Number(entry.family.value), prefix: entry.prefix.value.trim(),
				hidden: entry.action.value === 'hide' }));
		}
	};
}

function areaTable(settings, onChange) {
	const types = [ [ 'normal', _('Normal') ], [ 'stub', 'Stub' ], [ 'nssa', 'NSSA' ] ];
	const columns = [ _('Area ID'), _('Area type'), _('IPv4 summaries'), _('IPv6 summaries'), _('Actions') ];
	const areas = settings.slice();
	const body = E('tbody');
	const add = E('button', { class: 'btn cbi-button-add', type: 'button', click: () => edit(areas.length) }, _('Add area'));
	const table = dataTable(columns, body);

	function edit(index) {
		const current = areas[index] ?? {};
		const area = input('ospf-area-id', current.area, { required: '' });
		const type = select('ospf-area-type', types, current.type ?? 'normal');
		const networks = areaNetworks(current.networks ?? []);
		const cost = input('ospf-area-cost', current.default_cost ?? 0, { type: 'number', min: 0, max: 16777214, required: '' });
		const noSummary = checkbox('ospf-area-no-summary', current.no_summary);
		const defaultNssa = checkbox('ospf-area-default-nssa', current.default_nssa);
		const metric = select('ospf-area-metric', [[ 'e1', 'E1' ], [ 'e2', 'E2' ]], current.default_metric ?? 'e1');
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
			row(_('NSSA default metric type'), metric),
			row(_('Always translate NSSA external LSAs'), translator),
			row(_('NSSA translator stability (seconds, 0 = default)'), stability)
		]);
		const noOptions = E('p', {}, _('This area type has no additional settings.'));
		dom.content(form, [
			...tabs(form, [
				{ label: _('General Settings'), content: [
					row(_('Area ID'), area), row(_('Area type'), type), ...networks.fields
				] },
				{ label: _('Advanced Settings'), content: [ noOptions, stubOptions, nssaOptions ] }
			]), feedback,
			E('div', { class: 'right' }, [
				E('button', { class: 'btn cbi-button-neutral', type: 'button', click: () => ui.hideModal() }, _('Cancel')), ' ',
				E('button', { class: 'btn cbi-button-positive', type: 'submit' }, _('Save'))
			])
		]);
		function updateType() {
			cost.disabled = noSummary.disabled = type.value === 'normal';
			defaultNssa.disabled = metric.disabled = translator.disabled = stability.disabled = type.value !== 'nssa';
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
			const id = areaIdentity(value);
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
			areas[index] = { area: id, type: type.value, networks: networks.value(),
				default_cost: cost.disabled ? 0 : Number(cost.value),
				no_summary: !noSummary.disabled && noSummary.checked,
				default_nssa: !defaultNssa.disabled && defaultNssa.checked,
				default_metric: metric.disabled ? 'e1' : metric.value,
				translator: !translator.disabled && translator.checked,
				translator_stability: stability.disabled ? 0 : Number(stability.value) };
			render();
			ui.hideModal();
			onChange();
		});
		ui.showModal(current.area == null ? _('Add area') : _('Edit area'), [ form ]);
	}

	function render() {
		add.disabled = areas.length >= 32;
		dom.content(body, areas.length ? areas.map((entry, index) => E('tr', { class: 'tr' }, [
			...[ entry.area, types.find(([ type ]) => type === entry.type)?.[1],
				...[4, 6].map(family => (entry.networks ?? []).filter(prefix => prefix.family === family)
					.map(prefix => prefix.prefix + (prefix.hidden ? ' (' + _('Hidden') + ')' : '')).join(' '))
			].map(value => E('td', { class: 'td' }, value || '—')),
			E('td', { class: 'td cbi-section-actions' }, [
				E('button', { class: 'btn cbi-button-edit', type: 'button', click: () => edit(index) }, _('Edit')), ' ',
				E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
					areas.splice(index, 1);
					render();
					onChange();
				} }, _('Delete'))
			])
		])) : [ E('tr', { class: 'tr' }, [ emptyTableRow(columns.length, _('No area settings configured.')) ]) ]);
	}
	render();
	return { table, add, areas };
}

function areaIdentity(value) {
	const address = validation.parseIPv4(value);
	return address?.join('.') === value ? String(address.reduce((sum, part) => sum * 256 + part, 0)) : value;
}

function detailValue(entry, metadata = []) {
	const values = (entry.values ?? []).flatMap((value, index) => {
		const [ label, kind ] = metadata[index] ?? [];
		const title = label ? backendLabel(label) : '';
		const format = text => title && text !== '' ? title + ': ' + text : text;
		if (kind === 'secret')
			return value ? [ format('••••••') ] : [];
		if (kind === 'switch' || typeof value === 'boolean')
			return [ format(backendLabel(value ? 'yes' : 'no')) ];
		if (Array.isArray(kind))
			return value === '' ? [] : [ format(backendLabel(value)) ];
		return value === '' || value == null ? [] : [ format(String(value)) ];
	});
	return values.length ? values.join(' · ') : '—';
}

function routePrefixIdentity(prefix, family) {
	const [ address, length, extra ] = prefix.split('/');
	const max = family === 6 ? 128 : 32;
	if (extra !== undefined || !/^(0|[1-9]\d{0,2})$/.test(length ?? '') || Number(length) > max)
		return null;
	const words = family === 6 ? validation.parseIPv6(address) : validation.parseIPv4(address);
	return words ? words.join(',') + '/' + length : null;
}

function additionalSettings(schema, devices, links, initial, options = {}) {
	const names = Object.keys(schema);
	const entries = initial.slice();
	const body = E('tbody');
	const columns = [ _('Setting'), _('IP family'), _('Target'), _('Value'), _('Actions') ];
	const add = E('button', { class: 'btn cbi-button-add', type: 'button',
		click: () => edit(entries.length) }, options.addLabel ?? _('Add advanced setting'));
	const table = dataTable(columns, body);
	function edit(index) {
		const existing = entries[index];
		const option = select('bird-detail-name', names.map(name => [ name, backendLabel(name) ]), existing?.name ?? names[0]);
		const family = select('bird-detail-family', [ [ '4', 'IPv4' ], [ '6', 'IPv6' ] ], String(existing?.family ?? 4));
		const fields = E('div');
		const feedback = E('p', { class: 'cbi-section-error', role: 'alert', hidden: '' });
		const save = E('button', { class: 'btn cbi-button-positive', type: 'submit' }, _('Save'));
		let target, controls;
		function update() {
			const [ scope, , metadata ] = schema[option.value];
			const current = existing?.name === option.value ? existing : null;
			family.disabled = [ 'bfd', 'bfd-key', 'transport' ].includes(scope);
			if (family.disabled) family.value = '4';
			const rows = [];
			feedback.hidden = true;
			save.disabled = false;
			target = null;
			if (interfaceScopes.includes(scope)) {
				const bfd = scope === 'bfd' || scope === 'bfd-key';
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
					field = select(id, kind.map(key => [ key, backendLabel(key) ]), value ?? kind[0]);
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
				rows.push(row(backendLabel(label), field));
				return field;
			});
			if (option.value === routeOption) {
				const dependencies = () => {
					const metrics = controls[0].value === 'redistribute' && controls[1].value === 'accept';
					controls[3].disabled = controls[5].disabled = !metrics;
					controls[4].disabled = !metrics || controls[3].value === 'none';
				};
				controls[0].addEventListener('change', dependencies);
				controls[1].addEventListener('change', dependencies);
				controls[3].addEventListener('change', dependencies);
				dependencies();
			} else if (option.value === 'OSPF receive buffer') {
				const dependencies = () => {
					controls[1].disabled = controls[0].value !== 'bytes';
					controls[1].required = !controls[1].disabled;
				};
				controls[0].addEventListener('change', dependencies);
				dependencies();
			}
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
			feedback.hidden = true;
			const values = controls.map(field => field.disabled ? '' : field.type === 'checkbox' ? field.checked :
				field.type === 'number' && field.value !== '' ? Number(field.value) : field.value.trim());
			const updated = { name: option.value, family: Number(family.value), target: target?.value.trim() ?? '', values };
			if (updated.name === routeOption) {
				if (!values[3]) values[3] = 'none';
				const identity = routePrefixIdentity(values[2], updated.family);
				let message;
				if (identity === null)
					message = _('Enter a valid prefix for the selected address family.');
				else if (entries.some((entry, position) => position !== index && entry.family === updated.family &&
					entry.values[0] === values[0] && routePrefixIdentity(entry.values[2], entry.family) === identity))
					message = backendLabel('A rule already exists for this address family, direction and prefix. Edit the existing rule.');
				if (message) {
					dom.content(feedback, message);
					feedback.hidden = false;
					controls[2].focus();
					return;
				}
			}
			entries[index] = updated;
			render();
			ui.hideModal();
			options.onChange?.();
		});
		ui.showModal(existing ? _('Edit advanced setting') : (options.addLabel ?? _('Add advanced setting')), [ form ]);
	}
	function render() {
		add.disabled = entries.length >= 96 || names.length === 0;
		dom.content(body, entries.length ? entries.map((entry, index) => E('tr', { class: 'tr' }, [
			...[ backendLabel(entry.name), [ 'bfd', 'bfd-key' ].includes(schema[entry.name]?.[0]) ? _('Shared') : 'IPv' + entry.family,
				entry.target || '—',
				detailValue(entry, schema[entry.name]?.[2]) ].map((value, column) =>
					E('td', { class: 'td' + (column === 3 ? ' ospf-detail-value' : '') }, value)),
			E('td', { class: 'td cbi-section-actions' }, [
				E('button', { class: 'btn cbi-button-edit', type: 'button', click: () => edit(index) }, _('Edit')), ' ',
				E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
					entries.splice(index, 1);
					render();
					options.onChange?.();
				} }, _('Delete'))
			])
		])) : [ E('tr', { class: 'tr' },
			[ emptyTableRow(columns.length, options.empty ?? _('No additional settings configured.')) ]) ]);
	}
	render();
	return { table, add, names, entries, refresh(rows) {
		entries.splice(0, entries.length, ...rows);
		render();
	} };
}

function advancedForm(settings) {
	const ipv6 = checkbox('ospf-v3', settings.ipv6);
	const install6 = checkbox('ospf-install6', settings.install6);
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
	const install6Row = row(_('Install IPv6 OSPF routes by default'), install6);
	const graceTimeRow = row(_('Grace period (seconds)'), graceTime);
	function updateVisibility() {
		install6Row.hidden = !ipv6.checked;
		graceTimeRow.hidden = graceful.value !== 'on';
		graceTime.disabled = graceTimeRow.hidden;
	}
	ipv6.addEventListener('change', updateVisibility);
	install6.addEventListener('change', updateVisibility);
	graceful.addEventListener('change', updateVisibility);
	updateVisibility();
	return {
		ipv6,
		general: [ row(_('Enable OSPFv3 (IPv6)'), ipv6), install6Row ],
		fields: [
			row(_('ECMP paths (0 = BIRD default, 1 = disabled)'), ecmp),
			row(_('Graceful restart'), graceful), graceTimeRow,
			row(_('OSPFv2 instance ID (-1 = default)'), instance4),
			row(_('OSPFv3 instance ID (-1 = default)'), instance6),
			row(_('Avoid transit traffic (stub router)'), stubRouter),
			row(_('Merge equal-cost external routes'), mergeExternal),
			row(_('RFC 1583 compatibility (OSPFv2)'), compatibility),
			row(_('SPF calculation interval (seconds, 0 = default)'), tick)
		],
		value() {
			return { ipv6: ipv6.checked, install6: install6.checked, ecmp: Number(ecmp.value),
				instance4: Number(instance4.value), instance6: Number(instance6.value),
				graceful: graceful.value, grace_time: Number(graceTime.value),
				stub_router: stubRouter.checked, merge_external: mergeExternal.checked,
				rfc1583: compatibility.checked, tick: Number(tick.value),
				details: [] };
		}
	};
}

function detailSections(schema, devices, links, initial, onChange) {
	const namesFor = predicate => Object.keys(schema).filter(name => predicate(name, schema[name]));
	const rowsFor = names => initial.filter(entry => names.includes(entry.name));
	const tables = [];
	function addGroup(title, description, names, addLabel, empty) {
		if (!names.length)
			return;
		const subset = Object.fromEntries(names.map(name => [ name, schema[name] ]));
		const table = additionalSettings(subset, devices, links, rowsFor(names),
			{ addLabel, empty, onChange });
		tables.push({ names, table, title, description, addLabel, empty });
	}

	addGroup(_('Protocol compatibility'),
		_('Protocol-wide features that affect how BIRD advertises and reads OSPF address families.'),
		namesFor((name, meta) => [ 'protocol', 'transport' ].includes(meta[0])),
		_('Add protocol option'), _('No protocol options configured.'));

	const additionalInstance = 'Additional OSPF interface instance';
	addGroup(_('Extended interface options'),
		_('Additional per-interface BIRD directives. The main timer and authentication fields remain in the interface editor.'),
		namesFor((name, meta) => meta[0] === 'link' && name !== additionalInstance && !interfaceOptions.has(name)),
		_('Add interface option'), _('No extended interface options configured.'));

	addGroup(_('Additional OSPF instances'),
		_('Run another OSPF instance on an existing interface with an instance ID different from the primary one.'),
		namesFor(name => name === additionalInstance),
		_('Add OSPF instance'), _('No additional OSPF instances configured.'));

	addGroup(_('BFD protocol options'),
		_('BFD options not shown in the interface editor. Enable BFD on an interface before adding its options.'),
		namesFor((name, meta) => meta[0] === 'bfd' && !interfaceOptions.has(name)),
		_('Add BFD option'), _('No BFD protocol options configured.'));

	addGroup(_('Virtual links'),
		_('Virtual links and their authentication keys are matched by area and peer router ID.'),
		namesFor((name, meta) => [ 'virtual', 'virtual-key' ].includes(meta[0])),
		_('Add virtual link'), _('No virtual links configured.'));

	addGroup(_('Area-specific routes'),
		_('NSSA external summaries and custom stub networks belong to a specific area.'),
		namesFor((name, meta) => [ 'external', 'stubnet' ].includes(meta[0])),
		_('Add area route'), _('No area-specific routes configured.'));

	return {
		fields: tables.map(item => section(item.title, item.description, [
			item.table.table,
			item.table.add
		])),
		entries() {
			return tables.flatMap(item => item.table.entries);
		},
		losingInterface(device) {
			const entries = this.entries();
			const hasArea = (area, family, present) => links.some(link => present(link) &&
				keyFamilies(link.family ?? 'ipv4').includes(family) && (
					areaIdentity(link.area) === area || entries.some(row => row.name === additionalInstance &&
						row.target === link.device && row.family === family && areaIdentity(row.values[1]) === area)));
			return entries.filter(entry => {
				const scope = schema[entry.name]?.[0];
				if (interfaceScopes.includes(scope))
					return entry.target === device;
				if (!areaScopes.includes(scope))
					return false;
				const area = areaIdentity(entry.target);
				return hasArea(area, entry.family, link => link.device === device) &&
					!hasArea(area, entry.family, link => link.device !== device);
			});
		},
		remove(entries) {
			const removed = new Set(entries);
			this.refresh(this.entries().filter(entry => !removed.has(entry)));
		},
		refresh(rows) {
			for (const item of tables)
				item.table.refresh(rows.filter(entry => item.names.includes(entry.name)));
		}
	};
}

function report(data) {
	const settings = data.settings;
	const links = settings?.links ?? [];
	const details = settings?.advanced?.details ?? [];
	const passive = links.filter(link => link.mode === 'passive').length;
	const bfd = links.filter(link => link.bfd).length;
	const summaryBody = E('tbody');
	const summaryRows = [[ _('BIRD daemon'), data.bird_running === true ? _('Running') :
		data.bird_running === false ? _('Unavailable') : _('Unknown') ]];
	if (settings && data.mode === 'managed') summaryRows.push(
		[ _('OSPF configuration'), settings.enabled ? _('Enabled') : _('Disabled') ],
		[ _('Router ID'), settings.router_id || '—' ],
		[ _('Configured address families'), [
			...(links.some(link => link.family !== 'ipv6') ? [ 'IPv4' ] : []),
			...(settings.advanced?.ipv6 && links.some(link => link.family !== 'ipv4') ? [ 'IPv6' ] : [])
		].join(' + ') || '—' ],
		[ _('Interfaces'), links.length ? _('%s total, %s passive').format(links.length, passive) : _('None') ],
		[ _('Areas'), String(settings.advanced?.areas?.length ?? 0) ],
		[ _('BFD interfaces'), String(bfd) ],
		[ _('Exact-prefix rules'), String(details.filter(entry => entry.name === routeOption).length) ]
	);
	dom.content(summaryBody, summaryRows.map(([ label, value ]) => E('tr', { class: 'tr' }, [
		E('th', { class: 'th', scope: 'row' }, label),
		E('td', { class: 'td' }, value)
	])));

	const sections = [
		[ _('OSPF routes'), data.routes ],
		[ _('Interface status'), data.interfaces ]
	];
	if (data.settings?.advanced?.ipv6) sections.push([ _('OSPFv3 routes'), data.routes6 ]);
	if (data.protocols) sections.push([ _('BIRD protocols'), data.protocols ]);
	if (data.settings?.links?.some(link => link.bfd)) sections.push([ _('BFD sessions'), data.bfd ]);
	return [
		section(_('Current OSPF state'),
			_('BIRD runtime status and saved OSPF settings.'), [
				dataTable([ _('Item'), _('Current value') ], summaryBody, 'ospf-table-summary')
			]),
		section(_('OSPF neighbors'),
			_('Raw BIRD neighbor output is shown without interpretation.'), [
				E('pre', { class: 'ospf-output' }, data.neighbors || '—')
			]),
		disclosure(_('Detailed routing status'), sections.map(([ label, value ]) =>
			E('div', { class: 'ospf-output-group' }, [
				E('h4', {}, label), E('pre', { class: 'ospf-output' }, value || '—')
			])))
	];
}

function keyFamilies(family) {
	return family === 'dual' ? [ 4, 6 ] : [ family === 'ipv6' ? 6 : 4 ];
}

function interfaceKeys(settings, details) {
	return details.filter(entry => entry.target === settings.device);
}

function authenticationSummary(settings, details) {
	const keys = interfaceKeys(settings, details.filter(entry => entry.name === interfaceKey));
	const summaries = [ 4, 6 ].flatMap(family => {
		const familyKeys = keys.filter(key => key.family === family);
		if (!familyKeys.length)
			return [];
		const algorithms = Array.from(new Set(familyKeys.map(key =>
			authentication.find(([ value ]) => value === key.values[1])?.[1] ?? key.values[1])));
		return [ 'IPv' + family + ': ' + algorithms.join(' / ') ];
	});
	return summaries.join(' · ') || _('None');
}

function authEditor(initial, mode, version) {
	const entries = initial.filter(key => Number(key.family) === version).map(key => ({
		family: version,
		id: Number(key.values[0]),
		algorithm: key.values[1],
		secret: key.values[2] ?? '',
		time: key.values.slice(3, 7).map(value => value ?? '')
	}));
	const algorithms = version === 6 ?
		authentication.filter(([ value ]) => value !== 'simple') : authentication;
	const body = E('tbody');
	const section = E('div', { class: 'cbi-section' });
	const authMode = select('ospf-auth-mode-' + version, [
		[ 'none', _('No password (no authentication)') ],
		[ 'keyed', _('Authentication keys') ]
	], entries.length ? 'keyed' : 'none');
	const hint = E('p', { class: 'cbi-section-descr' });
	const table = dataTable([
		_('Key ID'), _('Algorithm'), _('Key state'), _('Rotation'), _('Actions')
	], body, 'ospf-table-auth');
	let sequence = 0;
	let enabledState = true;
	function nextKeyId() {
		const used = new Set(entries.map(entry => entry.id));
		return Array.from({ length: 256 }, (_, value) => (value + 1) % 256)
			.find(value => !used.has(value)) ?? 0;
	}
	const add = E('button', { type: 'button', class: 'btn cbi-button-add', click: () => {
		edit(entries.length, {
			family: version,
			id: nextKeyId(),
			algorithm: 'hmac sha256',
			secret: '',
			time: [ '', '', '', '' ]
		});
	} }, _('Add authentication key'));
	let parentForm = null;
	let parentTitle = null;
	function restoreParent() {
		if (parentForm)
			ui.showModal(parentTitle, [ parentForm ]);
		else
			ui.hideModal();
	}

	function edit(index, key = entries[index]) {
		const prefix = 'ospf-key-' + (++sequence);
		const originalId = index < entries.length ? entries[index].id : null;
		const control = {
			algorithm: select(prefix + '-algorithm', algorithms, key.algorithm),
			id: input(prefix + '-id', key.id, { type: 'number', min: 0, max: 255, required: '' }),
			secret: input(prefix + '-secret', key.secret,
				{ type: 'password', autocomplete: 'new-password', maxlength: 64 }),
			time: [ _('Generate from'), _('Generate to'), _('Accept from'), _('Accept to') ].map((label, timeIndex) =>
				[ label, input(prefix + '-time-' + timeIndex, key.time[timeIndex],
					{ placeholder: 'YYYY-MM-DD HH:MM:SS' }) ])
		};
		const idRow = row(_('Key ID'), control.id);
		const schedule = disclosure(_('Key rotation schedule'),
			control.time.map(([ label, field ]) => row(label, field)));
		const feedback = E('p', { class: 'cbi-section-error', role: 'alert', hidden: '' });
		function updateAlgorithm() {
			const simple = control.algorithm.value === 'simple';
			if (simple && originalId != null)
				control.id.value = originalId;
			idRow.hidden = control.id.disabled = simple;
			schedule.hidden = simple;
			for (const [, field ] of control.time) field.disabled = simple;
			control.secret.maxLength = simple ? 8 : 64;
			control.secret.required = index >= entries.length;
		}
		const form = E('form', {}, [
			row(_('IP family'), E('span', { class: 'ospf-readonly-value' }, 'IPv' + version)),
			row(_('Algorithm'), control.algorithm), idRow,
			row(_('Key (leave blank to keep existing)'), control.secret), schedule, feedback,
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', type: 'button', click: restoreParent }, _('Cancel')), ' ',
				E('button', { class: 'btn cbi-button-positive', type: 'submit' }, _('Save'))
			])
		]);
		control.algorithm.addEventListener('change', updateAlgorithm);
		updateAlgorithm();
		form.addEventListener('submit', event => {
			event.preventDefault();
			const algorithm = control.algorithm.value;
			if (algorithm !== 'simple' && entries.some((entry, position) => position !== index &&
				entry.id === Number(control.id.value))) {
				feedback.hidden = false;
				dom.content(feedback, _('A key ID can only be used once per address family.'));
				return;
			}
			if (algorithm === 'simple' && entries.some((entry, position) => position !== index)) {
				feedback.hidden = false;
				dom.content(feedback, _('Plaintext authentication cannot be combined with other keys.'));
				return;
			}
			if (algorithm !== 'simple' && originalId != null &&
			    Number(control.id.value) !== originalId && !control.secret.value.trim()) {
				feedback.hidden = false;
				dom.content(feedback, _('Enter a new key when changing the Key ID.'));
				return;
			}
			entries[index] = {
				family: version,
				id: Number(control.id.value),
				algorithm,
				secret: control.secret.value.trim(),
				time: control.time.map(([, field ]) => field.disabled ? '' : field.value.trim())
			};
			authMode.value = 'keyed';
			render();
			restoreParent();
		});
		ui.showModal(index < entries.length ? _('Edit authentication key') : _('Add authentication key'), [ form ]);
	}

	function updateVisibility() {
		const keyed = authMode.value === 'keyed';
		const plaintext = entries.some(entry => entry.algorithm === 'simple');
		table.hidden = !keyed || !entries.length;
		add.hidden = false;
		add.disabled = mode.value === 'passive' || !enabledState || entries.length >= 96 || plaintext;
		hint.hidden = keyed && entries.length > 0 && !plaintext;
		if (!keyed)
			dom.content(hint, _('No authentication is configured.'));
		else if (!entries.length)
			dom.content(hint, _('No authentication keys configured.'));
		else if (plaintext)
			dom.content(hint, _('Plaintext authentication supports only one key.'));
		dom.content(body, entries.map((entry, index) => E('tr', { class: 'tr' }, [
			E('td', { class: 'td' }, entry.algorithm === 'simple' ? '—' : String(entry.id)),
			E('td', { class: 'td' }, authentication.find(([ value ]) => value === entry.algorithm)?.[1] ?? entry.algorithm),
			E('td', { class: 'td' }, [
				entry.secret ? _('Pending update') : _('Existing key retained'),
				...(entry.time.some(Boolean) ? [ ' · ', _('Rotation configured') ] : [])
			]),
			E('td', { class: 'td' }, entry.time.some(Boolean) ? _('Configured') : '—'),
			E('td', { class: 'td cbi-section-actions' }, [
				E('button', { class: 'btn cbi-button-edit', type: 'button', click: () => edit(index) }, _('Edit')), ' ',
				E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
					entries.splice(index, 1);
					render();
				} }, _('Delete'))
			])
		])));
	}

	function render(enabled = enabledState) {
		enabledState = enabled;
		section.hidden = (mode.value === 'passive' || !enabled) && !entries.length;
		updateVisibility();
	}
	authMode.addEventListener('change', updateVisibility);
	dom.content(section, [ E('h3', {}, _('Authentication')), row(_('Authentication mode'), authMode),
		hint, table, add ]);
	render();
	return { section, update: render, setParent(form, title) {
		parentForm = form;
		parentTitle = title;
	}, value(device) {
		if (authMode.value !== 'keyed')
			return [];
		return entries.map(entry => ({ name: interfaceKey, target: device, family: version,
			values: [ entry.id, entry.algorithm, entry.secret, ...entry.time ] }));
	}, needsKey() { return authMode.value === 'keyed' && !entries.length; } };
}

function interfaceProtocolOptions(initial, family, mode, bfd) {
	const find = (name, family) => initial.find(entry => entry.name === name && entry.family === family);
	const ttlModes = [ [ 'no', _('Disabled') ], [ 'yes', _('Enabled') ], [ 'tx only', _('Send only') ] ];
	const bfdFields = [ 'BFD minimum receive interval', 'BFD minimum transmit interval' ].map((name, i) =>
		[ name, input('ospf-bfd-direction-' + i, find(name, 4)?.values[0] ?? 300,
			{ type: 'number', min: 0, max: 60000, required: '' }) ]);
	const bfdRows = E('div', {}, bfdFields.map(([ name, control ]) => row(backendLabel(name), control)));
	const groups = [ 4, 6 ].map(version => {
		const id = 'ospf-options-' + version;
		const ttl = select(id + '-ttl', ttlModes, find('TTL security mode', version)?.values[0] ?? 'no');
		const dead = find('Interface dead interval', version)?.values ?? ['seconds', 40];
		const deadMode = select(id + '-dead-mode', [
			[ 'seconds', _('Fixed seconds') ], [ 'multiplier', _('Hello interval multiplier') ]
		], dead[0]);
		const deadValue = input(id + '-dead-value', dead[1], { type: 'number', min: 2, max: 65535, required: '' });
		const syncDeadMode = () => { deadValue.max = deadMode.value === 'multiplier' ? 255 : 65535; };
		deadMode.addEventListener('change', syncDeadMode);
		syncDeadMode();
		const explicit = initial.filter(entry => entry.name === 'NBMA neighbor election eligibility' && entry.family === version);
		const entries = [];
		const peerBody = E('tbody');
		let peerIndex = 0;
		const addPeer = (values = [ '', false ]) => {
			const key = id + '-neighbor-' + (++peerIndex);
			const address = input(key, values[0], { required: '' });
			const eligible = checkbox(key + '-dr', values[1]);
			const entry = { address, eligible };
			const line = E('tr', { class: 'tr' }, [
				E('td', { class: 'td' }, address), E('td', { class: 'td' }, eligible),
				E('td', { class: 'td' }, E('button', { class: 'btn cbi-button-remove', type: 'button',
					click: () => { entries.splice(entries.indexOf(entry), 1); line.remove(); } }, _('Delete')))
			]);
			address.addEventListener('change', () => {
				const match = entries.find(peer => peer !== entry && peer.address.value.trim() &&
					peer.address.value.trim().toLowerCase() === address.value.trim().toLowerCase());
				if (match) {
					match.eligible.checked = eligible.checked;
					entries.splice(entries.indexOf(entry), 1);
					line.remove();
				}
			});
			eligible.disabled = mode.value !== 'nbma';
			entries.push(entry);
			peerBody.appendChild(line);
		};
		for (const peer of explicit) addPeer(peer.values);
		const peers = E('div', {}, [
			dataTable([ _('Neighbor address'), _('Eligible'), _('Actions') ], peerBody),
			E('button', { class: 'btn cbi-button-add', type: 'button', click: () => addPeer() }, _('Add manual neighbor'))
		]);
		return { version, ttl, deadMode, deadValue, entries, peers, section: E('div', {}, [
			E('h4', {}, 'IPv' + version), row(_('TTL security mode'), ttl),
			row(_('Dead interval mode'), deadMode), row(_('Dead interval value'), deadValue), peers
		]) };
	});
	const section = E('div', {}, groups.map(group => group.section));
	function update() {
		for (const group of groups) {
			group.section.hidden = mode.value === 'passive' || !keyFamilies(family.value).includes(group.version);
			group.peers.hidden = !['nbma', 'ptmp'].includes(mode.value);
			for (const entry of group.entries) {
				entry.address.disabled = group.peers.hidden || group.section.hidden;
				entry.eligible.disabled = entry.address.disabled || mode.value !== 'nbma';
			}
			for (const field of [group.ttl, group.deadMode, group.deadValue]) field.disabled = group.section.hidden;
		}
		bfdRows.hidden = !bfd.checked || mode.value === 'passive';
		for (const [, control ] of bfdFields) control.disabled = bfdRows.hidden;
	}
	update();
	return { section, bfdRows, groups, update,
		value(device) {
			const entries = [];
			const add = (name, family, values) => entries.push({ name, family, target: device, values });
			for (const group of groups.filter(value => !value.section.hidden)) {
				if (group.ttl.value !== 'no') add('TTL security mode', group.version, [group.ttl.value]);
				add('Interface dead interval', group.version, [group.deadMode.value, Number(group.deadValue.value)]);
				if (!group.peers.hidden)
					for (const entry of group.entries)
						add('NBMA neighbor election eligibility', group.version,
							[entry.address.value.trim(), mode.value === 'nbma' && entry.eligible.checked]);
			}
			if (!bfdRows.hidden)
				for (const [name, field] of bfdFields) add(name, 4, [Number(field.value)]);
			return entries;
		}
	};
}

function bfdAuthEditor(settings, initial) {
	const mode = select('ospf-bfd-auth-mode', [ [ 'none', _('None') ], [ 'simple', _('Simple authentication') ],
		...['keyed md5', 'meticulous keyed md5', 'keyed sha1', 'meticulous keyed sha1'].map(value => [ value, value ])
	], settings.bfd_mode ?? 'none');
	const keys = [];
	const rows = E('div');
	let keyIndex = 0;
	const add = E('button', { class: 'btn cbi-button-add', type: 'button', click: () => {
		let next = 1;
		while (keys.some(key => Number(key.id.value) === next)) next++;
		if (next <= 255) addKey([next, '']);
	} }, _('Add BFD authentication key'));
	function addKey(values) {
		const id = 'ospf-bfd-auth-key-' + (++keyIndex);
		const key = {
			id: input(id, values[0], { type: 'number', min: 0, max: 255, required: '' }),
			secret: input(id + '-secret', values[1], { type: 'password', maxlength: 64, autocomplete: 'new-password' })
		};
		key.idRow = row(_('Key ID'), key.id);
		const element = E('div', { class: 'cbi-section' }, [
			key.idRow, row(_('Key (leave blank to keep existing)'), key.secret),
			E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
				keys.splice(keys.indexOf(key), 1);
				element.remove();
				update();
			} }, _('Delete'))
		]);
		keys.push(key);
		rows.appendChild(element);
		update();
	}
	function update() {
		const simple = mode.value === 'simple';
		const inactive = mode.value === 'none';
		rows.hidden = add.hidden = inactive;
		add.disabled = simple && keys.length > 0;
		for (const key of keys) {
			key.idRow.hidden = simple;
			key.id.disabled = inactive || simple;
			key.secret.disabled = inactive;
		}
	}
	for (const item of initial) addKey(item.values);
	mode.addEventListener('change', update);
	update();
	return { section: E('div', {}, [row(_('BFD authentication'), mode), rows, add]),
		error(enabled) {
			const selected = enabled ? mode.value : 'none';
			if (selected === 'none')
				return null;
			if (!keys.length)
				return _('Add at least one BFD authentication key or select none.');
			if (selected === 'simple' && keys.length !== 1)
				return _('BFD plaintext authentication requires exactly one key.');
			return null;
		},
		value(device, enabled) {
			const selected = enabled ? mode.value : 'none';
			return { mode: selected, rows: selected === 'none' ? [] : keys.map(key => ({
				name: bfdKey, target: device, family: 4, values: [Number(key.id.value), key.secret.value.trim()]
			})) };
		}
	};
}

function editInterface(devices, settings, otherLinks, options, ipv6Enabled, save) {
	const id = 'ospf-interface-edit';
	const control = {
		device: select(id + '-device', [[ '', _('Select a device') ],
			...devices.map(name => [ name, name ])], settings.device ?? ''),
		area: input(id + '-area', settings.area ?? '0', { required: '' }),
		mode: select(id + '-mode', modes, settings.mode ?? 'broadcast'),
		family: select(id + '-family', families, settings.family ?? 'ipv4'),
		bfd: checkbox(id + '-bfd', settings.bfd),
		strict_nbma: checkbox(id + '-strict-nbma', settings.strict_nbma),
		ignore_carrier: checkbox(id + '-ignore-carrier', settings.ignore_carrier),
	};
	control.device.required = true;
	const authInitial = interfaceKeys(settings, options.filter(entry => entry.name === interfaceKey));
	const auth4 = authEditor(authInitial, control.mode, 4);
	const auth6 = authEditor(authInitial, control.mode, 6);
	const protocol = interfaceProtocolOptions(options, control.family, control.mode, control.bfd);
	const bfdAuth = bfdAuthEditor(settings, options.filter(entry => entry.name === bfdKey));
	protocol.bfdRows.appendChild(bfdAuth.section);
	const general = [
		row(_('Device'), control.device), row(_('Area'), control.area), row(_('Mode'), control.mode),
		row(_('IP family'), control.family)
	];
	const ipv6Notice = E('p', { class: 'cbi-section-descr', role: 'status' },
		_('OSPFv3 is disabled in Basic settings. IPv6 settings are saved but inactive until OSPFv3 is enabled.'));
	general.push(ipv6Notice);
	const familyNotices = [ 4, 6 ].map(version => E('p', { class: 'cbi-section-descr', hidden: '' },
		_('This address family has no editable OSPF options in the current mode.')));
	const neighborRows = E('div', {}, [
		row(_('Only accept configured neighbors (NBMA / point-to-multipoint)'), control.strict_nbma)
	]);
	const advanced = [
		row(_('Enable BFD'), control.bfd), protocol.bfdRows
	];
	const tuning = [];
	for (const [ name, label, initial, min, max ] of numbers) {
		control[name] = input(id + '-' + name, settings[name] ?? initial, { type: 'number', min, max, required: '' });
		const rows = name.startsWith('bfd_') ? protocol.bfdRows : name === 'poll' ? neighborRows : null;
		if (rows) rows.appendChild(row(label, control[name]));
		else tuning.push(row(label, control[name]));
	}
	advanced.push(
		E('h4', {}, _('Interface tuning')),
		...tuning,
		row(_('Ignore link carrier state'), control.ignore_carrier),
		neighborRows
	);
	const addressFamilyPanels = [ 4, 6 ].map((version, index) => [
		familyNotices[index],
		protocol.groups.find(group => group.version === version).section,
		(version === 4 ? auth4 : auth6).section
	]);
	const feedback = E('p', { class: 'cbi-section-error', role: 'alert', hidden: '' });
	const form = E('form');
	dom.content(form, [
		...tabs(form, [
			{ label: _('General'), content: general },
			{ label: 'IPv4', content: addressFamilyPanels[0] },
			{ label: 'IPv6', content: addressFamilyPanels[1] },
			{ label: _('Advanced'), content: advanced }
		]), feedback,
		E('div', { class: 'right' }, [
			E('button', { class: 'btn cbi-button-neutral', type: 'button', click: () => ui.hideModal() }, _('Cancel')),
			' ',
			E('button', { class: 'btn cbi-button-positive', type: 'submit' }, _('Save'))
		])
	]);
	const updateMode = () => {
		ipv6Notice.hidden = ipv6Enabled || control.family.value === 'ipv4';
		control.bfd.disabled = control.mode.value === 'passive';
		control.strict_nbma.disabled = ![ 'nbma', 'ptmp' ].includes(control.mode.value);
		auth4.update(keyFamilies(control.family.value).includes(4));
		auth6.update(keyFamilies(control.family.value).includes(6));
		protocol.update();
		for (const [ index, version ] of [ 4, 6 ].entries())
			familyNotices[index].hidden = !protocol.groups.find(group => group.version === version).section.hidden;
		control.bfd_multiplier.disabled = protocol.bfdRows.hidden;
		neighborRows.hidden = control.strict_nbma.disabled;
		control.poll.disabled = neighborRows.hidden;
	};
	control.mode.addEventListener('change', updateMode);
	control.bfd.addEventListener('change', updateMode);
	control.family.addEventListener('change', updateMode);
	updateMode();
	form.addEventListener('submit', event => {
		event.preventDefault();
		const result = {};
		for (const [ name, field ] of Object.entries(control))
			result[name] = field.type === 'checkbox' ? field.checked && !field.disabled :
				field.type === 'number' ? Number(field.value) : field.value.trim();
		const authKeys = [ ...auth4.value(result.device), ...auth6.value(result.device) ];
		const options = protocol.value(result.device);
		const bfdKeys = bfdAuth.value(result.device, result.bfd);
		const bfdError = bfdAuth.error(result.bfd);
		if (otherLinks.some(link => link.device === result.device)) {
			dom.content(feedback, _('This device is already in the interface list.'));
		} else if (options.some(option => option.name === 'Interface dead interval' &&
			option.values[0] === 'seconds' && option.values[1] <= result.hello)) {
			dom.content(feedback, _('Dead interval must exceed hello interval.'));
		} else if (result.mode === 'passive' && authKeys.length) {
			dom.content(feedback, _('Remove authentication keys before setting the interface to passive.'));
		} else if (result.mode !== 'passive' &&
		    ((keyFamilies(result.family).includes(4) && auth4.needsKey()) ||
		     (keyFamilies(result.family).includes(6) && auth6.needsKey()))) {
			dom.content(feedback, _('Add at least one authentication key or select no password.'));
		} else if (authKeys.some(key => !keyFamilies(result.family).includes(key.family))) {
			dom.content(feedback, _('An authentication key uses an address family not enabled on this interface.'));
		} else if (bfdError) {
			dom.content(feedback, bfdError);
		} else {
			result.bfd_mode = bfdKeys.mode;
			save(result, [...authKeys, ...options, ...bfdKeys.rows]);
			ui.hideModal();
			return;
		}
		feedback.hidden = false;
	});
	const modalTitle = settings.device ? _('Edit interface') : _('Add interface');
	auth4.setParent(form, modalTitle);
	auth6.setParent(form, modalTitle);
	ui.showModal(modalTitle, [ form ]);
}

return view.extend({
	load() { return status(); },
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	render(data) {
		const panel = E('div', { class: 'ospf-status-stack' }, report(data));
		const refresh = E('button', { class: 'btn', type: 'button', click: () =>
			status().then(next => dom.content(panel, report(next))).catch(error =>
				ui.addNotification(null, E('p', {}, error.message), 'error'))
		}, _('Refresh status'));
		const nativeButton = () => E('button', { class: 'btn cbi-button-neutral', type: 'button', click: editNative },
			_('Edit native BIRD configuration'));
		const page = E('div', { class: 'ospf-page' }, [
			E('link', { rel: 'stylesheet', href: L.resource('view/bird/bird.css') }),
			E('div', { class: 'ospf-page-header' }, [
				E('div', {}, [
					E('h2', {}, 'Bird OSPF'),
					E('p', { class: 'cbi-section-descr' },
						_('Configure OSPF interfaces, areas and route policy, then apply the complete page at once.'))
				]),
				E('div', { class: 'ospf-page-actions' }, [ refresh ])
			])
		]);
		if (!data.settings) {
			page.appendChild(section(_('Configuration unavailable'),
				data.mode === 'native' ?
					_('BIRD is managed in the native configuration editor.') :
					_('The saved BIRD configuration could not be loaded into the form.'), [
					data.mode === 'native' ? nativeButton() : E('span')
				]));
			page.appendChild(panel);
			return page;
		}

		const settings = data.settings;
		const enabled = input('ospf-enabled', '', { type: 'checkbox' });
		enabled.checked = settings.enabled;
		const router = input('ospf-router', settings.router_id, { required: '' });
		const policy = select('ospf-policy', [
			[ 'none', _('Do not install unmatched routes') ],
			[ 'all', _('Install all OSPF routes except the default route') ]
		], settings.policy);
		const takeover = input('ospf-takeover', '', { type: 'checkbox' });
		const interfaces = settings.links.slice();
		const pending = E('p', { class: 'cbi-section-descr', role: 'status', hidden: '' },
			_('There are unapplied changes. Click Save & Apply to update BIRD.'));
		const markPending = () => { pending.hidden = false; };
		let interfaceRows = (settings.advanced?.details ?? []).filter(entry => interfaceOptions.has(entry.name));
		const list = E('tbody');
		const columns = [ _('Device'), _('Area'), _('Mode'), _('IP family'), _('Interface cost'), _('Authentication'), _('Actions') ];
		const edit = index => editInterface(data.devices, interfaces[index] ?? {},
			interfaces.filter((_, position) => position !== index),
			interfaceRows.filter(entry => entry.target === interfaces[index]?.device),
			advanced.ipv6.checked,
			(entry, rows) => {
				const before = interfaces[index]?.device;
				interfaceRows = interfaceRows.filter(option => option.target !== before);
				interfaceRows.push(...rows);
				interfaces[index] = entry;
				renderInterfaces();
				markPending();
			});
		const removeInterface = (entry, index) => {
			const affected = details.losingInterface(entry.device);
			const count = interfaceRows.filter(row => row.target === entry.device).length + affected.length;
			ui.showModal(_('Delete OSPF interface'), [
				E('p', {}, count ? _('Remove %s and its associated OSPF settings from this draft?').format(entry.device) :
					_('Remove %s from this draft?').format(entry.device)),
				E('div', { class: 'right' }, [
					E('button', { class: 'btn cbi-button-neutral', type: 'button', click: () => ui.hideModal() }, _('Cancel')), ' ',
					E('button', { class: 'btn cbi-button-remove', type: 'button', click: () => {
						interfaceRows = interfaceRows.filter(row => row.target !== entry.device);
						details.remove(affected);
						interfaces.splice(index, 1);
						renderInterfaces();
						markPending();
						ui.hideModal();
					} }, _('Delete'))
				])
			]);
		};
		const add = E('button', { class: 'btn cbi-button-add', type: 'button',
			click: () => edit(interfaces.length) }, _('Add interface'));
		const familyLabel = entry => {
			const family = entry.family ?? 'ipv4';
			const label = families.find(([ value ]) => value === family)?.[1] ?? family;
			return family !== 'ipv4' && !advanced.ipv6.checked ? _('%s (OSPFv3 disabled)').format(label) : label;
		};
		const renderInterfaces = () => {
			add.disabled = interfaces.length >= 32;
			dom.content(list, interfaces.length ? interfaces.map((entry, index) => E('tr', { class: 'tr' }, [
				...[ entry.device, entry.area, modes.find(([ value ]) => value === entry.mode)?.[1],
					familyLabel(entry),
					String(entry.cost), authenticationSummary(entry, interfaceRows) ]
					.map((value, i) => E('td', { class: 'td', 'data-title': columns[i] }, value ?? '—')),
				E('td', { class: 'td cbi-section-actions' }, [
					E('button', { class: 'btn cbi-button-edit', type: 'button', click: () => edit(index) }, _('Edit')),
					' ',
					E('button', { class: 'btn cbi-button-remove', type: 'button',
						click: () => removeInterface(entry, index) }, _('Delete'))
				])
			])) : [ E('tr', { class: 'tr' },
				[ emptyTableRow(columns.length, _('No OSPF interfaces configured.')) ]) ]);
		};
		const table = dataTable(columns, list, 'ospf-table-interfaces');

		const form = E('form', { class: 'ospf-form' });
		form.addEventListener('input', markPending);
		const schema = Object.fromEntries(Object.entries(data.detail_schema ?? {})
			.filter(([ name ]) => !interfaceOptions.has(name) && name !== routeOption));
		const extraRows = (settings.advanced?.details ?? [])
			.filter(entry => !interfaceOptions.has(entry.name) && entry.name !== routeOption);
		const advanced = advancedForm(settings.advanced ?? {});
		advanced.ipv6.addEventListener('change', renderInterfaces);
		const details = detailSections(schema, data.devices, interfaces, extraRows, markPending);
		const areas = areaTable(settings.advanced?.areas ?? [], markPending);
		renderInterfaces();
		const routeRules = additionalSettings(Object.fromEntries(Object.entries(data.detail_schema ?? {})
			.filter(([ name ]) => name === routeOption)), data.devices, interfaces,
			(settings.advanced?.details ?? []).filter(entry => entry.name === routeOption),
			{ addLabel: _('Add rule'), empty: _('No exact-prefix rules configured.'), onChange: markPending });
		const migration = section(_('Existing BIRD configuration'),
			_('The first save replaces the existing BIRD configuration and keeps a backup. Other BIRD protocols in that configuration will stop.'),
			[ row(_('Replace existing BIRD configuration'), takeover) ]);
		const basic = [
			section(_('Service'), null, [
				row(_('Enable OSPF'), enabled),
				row(_('Router ID'), router),
				...advanced.general
			]),
			...(data.mode === 'external' ? [ migration ] : [])
		];
		const interfacesPanel = [
			section(_('OSPF interfaces'),
				_('A passive interface advertises its subnet without forming neighbors. On an active link, area, timers and authentication must match the peer.'), [
					add,
					table
				])
		];
		const areasPanel = [
			section(_('Area types and summaries'),
				_('Area 0 must be normal. An area takes effect when assigned to an interface.'), [
					areas.add,
					areas.table
				])
		];
		const routingPanel = [
			section(_('Default route policy'), null, [
				row(_('Default IPv4 route installation policy'), policy)
			]),
			section(_('Exact-prefix rules'),
				_('Exact-prefix rules apply first. The default policy applies only when no rule matches.'), [
					routeRules.add,
					routeRules.table
				])
		];
		const advancedPanel = [
			section(_('BIRD OSPF behavior'), null, advanced.fields),
			...details.fields,
			section(_('Native BIRD configuration'),
				_('Use the native editor for complex expressions or configuration that the structured form does not represent. Applying it switches the file to native management.'), [
					nativeButton()
				])
		];
		dom.content(form, [
			...tabs(form, [
				{ label: _('Basic settings'), content: basic },
				{ label: _('Interfaces'), content: interfacesPanel },
				{ label: _('Areas'), content: areasPanel },
				{ label: _('Routing'), content: routingPanel },
				{ label: _('Advanced'), content: advancedPanel },
				{ label: _('Status'), content: [ panel ] }
			])
		]);
		const save = E('button', { class: 'btn cbi-button cbi-button-apply', type: 'submit' }, _('Save & Apply'));
		form.appendChild(pending);
		form.appendChild(E('div', { class: 'cbi-page-actions' }, [ save ]));
		form.addEventListener('submit', async event => {
			event.preventDefault();
			save.disabled = true;
			form.inert = true;
			try {
				const values = {
					enabled: enabled.checked, router_id: router.value.trim(), policy: policy.value,
					links: interfaces, advanced: advanced.value(), takeover: takeover.checked
				};
				values.advanced.areas = areas.areas;
				values.advanced.details = [ ...details.entries(), ...interfaceRows, ...routeRules.entries ];
				const result = await apply(data.revision, JSON.stringify(values));
				if (!result.ok)
					throw replyError(result, _('Unable to apply OSPF configuration.'));
				pending.hidden = true;
				const next = await status();
				data.revision = next.revision;
				dom.content(panel, report(next));
				migration.remove();
				interfaces.splice(0, interfaces.length, ...next.settings.links);
				const nextDetails = next.settings.advanced?.details ?? [];
				interfaceRows = nextDetails.filter(entry => interfaceOptions.has(entry.name));
				routeRules.refresh(nextDetails.filter(entry => entry.name === routeOption));
				details.refresh(nextDetails);
				renderInterfaces();
				const bootFailed = values.enabled && !result.boot_enabled;
				ui.addNotification(null, E('p', {}, bootFailed ?
					_('Configuration applied, but BIRD could not be enabled at boot.') : _('OSPF configuration applied.')),
					bootFailed ? 'warning' : 'info');
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
