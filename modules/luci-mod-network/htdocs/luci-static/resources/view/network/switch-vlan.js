/* Switch/VLAN configuration view.
 *
 * Operates on a single vlan-aware bridge identified by bvtool.findActiveBridge
 * (every member must be a physical ethernet/DSA port). Renders two blocks:
 * a Ports section (clickable port tiles whose selection drives the rest of the
 * view) and a VLANs section (one row per bridge-vlan with tri-state T/U
 * buttons that assign/remove tagged/untagged membership across the current
 * port selection).
 *
 * UCI mutations go through bvtool.setBridgeVlanPorts (anti-stacking) and are
 * auto-stashed to the rpcd session after every user action so the global
 * "Unsaved Changes" indicator updates live. */

'use strict';
'require view';
'require ui';
'require uci';
'require poll';
'require network';
'require tools.bridgevlan as bvtool';


/* =============================================================================
 * Module-level helpers
 * ============================================================================= */

/* Parse a bridge-vlan section's `ports` option into { portName -> parsedSpec }. */
function loadPortMap(section_id) {
	const portMap = {};
	L.toArray(uci.get('network', section_id, 'ports')).forEach(spec => {
		const p = bvtool.parsePortSpec(spec);
		if (p)
			portMap[p.port] = p;
	});
	return portMap;
}

/* Serialise a portMap back into a sorted array of `name` / `name:t` specs. */
function portMapToSpecs(portMap) {
	return Object.keys(portMap).sort(L.naturalCompare).map(name =>
		portMap[name].tagged ? name + ':t' : name
	);
}

/* Full-page replacement when the bridge VLAN config can't be modelled here. */
function renderUnsupportedBlocker(bridgeName, issues) {
	return E('div', { 'class': 'cbi-section' }, [
		E('h2', _('Switch / VLAN Configuration')),
		E('div', { 'class': 'alert-message error' }, [
			E('h4', _('Unsupported VLAN configuration')),
			E('p', [
				_('The bridge device "%s" has a VLAN configuration that this view cannot represent. ').format(bridgeName || '?'),
				_('Most commonly this means that a port has its primary VLAN (PVID) set to a different VLAN than its untagged egress VLAN — a combination that is allowed by 802.1Q but very rarely intentional.')
			]),
			E('ul', issues.map(msg => E('li', msg))),
			E('p', [
				_('Please review the configuration via the legacy '),
				E('a', { 'href': L.url('admin/network/network') }, _('Bridge VLAN filtering dialog')),
				_(' and either correct the unusual configuration or remove the offending VLAN assignments before returning here.')
			])
		])
	]);
}

/* Full-page replacement when no eligible bridge is configured. */
function renderNoBridgeBlocker() {
	return E('div', { 'class': 'cbi-section' }, [
		E('h2', _('Switch / VLAN Configuration')),
		E('div', { 'class': 'alert-message warning' }, [
			E('h4', _('No managed switch found')),
			E('p', _('No bridge eligible for switch-style configuration was found. This view requires a bridge with VLAN filtering enabled (explicitly or implicitly via bridge-vlan sections) whose member ports are all physical ethernet or DSA switch ports. Bridges containing wireless, tunnel, VLAN sub-interfaces or other virtual members are intentionally excluded.')),
			E('p', [
				_('You can enable VLAN filtering on a bridge from the '),
				E('a', { 'href': L.url('admin/network/network') }, _('Interfaces → Devices')),
				_(' page.')
			])
		])
	]);
}


return view.extend({
	bridge: null,
	ports: [],
	vlans: [],
	portLabels: {},
	vlanLabels: {},
	selection: null,


	/* =========================================================================
	 * Lifecycle: load, render, full refresh
	 * ========================================================================= */

	load() {
		return Promise.all([
			uci.load('network'),
			uci.load('luci'),
			network.getDevices()
		]);
	},

	loadState() {
		this.ports = bvtool.collectBridgePorts(this.bridge);
		this.vlans = bvtool.collectBridgeVlans(this.bridge);

		this.portLabels = {};
		this.ports.forEach(p => { this.portLabels[p] = bvtool.readPortLabel(p); });

		this.vlanLabels = {};
		this.vlans.forEach(v => { this.vlanLabels[v.vlan] = bvtool.readVlanLabel(v.vlan); });
	},

	render() {
		this.bridge = bvtool.findActiveBridge();

		if (!this.bridge)
			return renderNoBridgeBlocker();

		const issues = bvtool.checkUnsupportedConfig(this.bridge);

		if (issues.length)
			return renderUnsupportedBlocker(this.bridge.name, issues);

		this.loadState();

		bvtool.pruneOrphanLabels(this.ports, this.vlans.map(v => v.vlan));

		if (this.selection == null)
			this.selection = new Set();

		this.portsBlock = this.renderPortsSection();
		this.vlansBlock = this.renderVlansSection();

		const root = E('div', { 'class': 'cbi-section', 'id': 'switch-vlan-view' }, [
			E('link', { 'rel': 'stylesheet', 'href': L.resource('view/network/switch-vlan.css') }),
			E('h2', _('Switch / VLAN Configuration')),
			E('div', { 'class': 'cbi-section-descr' }, [
				_('Configure VLANs and per-port VLAN membership on bridge device '),
				E('code', this.bridge.name),
				_('. Select ports, then use T and U on each VLAN row to assign or remove tagged or untagged (native) membership (empty, partial, or full for the current selection). Optional labels for ports and VLANs are stored in the LuCI configuration and are for human reference only.')
			]),
			this.portsBlock,
			this.vlansBlock
		]);

		this.root = root;

		poll.add(() => this.refreshLinkStatus(), 5);

		Promise.resolve().then(() => this.refreshLinkStatus());

		Promise.resolve().then(() => this.onSelectionChange());

		Promise.resolve().then(() => this.showExperimentalDisclaimer());

		return root;
	},

	showExperimentalDisclaimer() {
		ui.showModal(_('Experimental view'), [
			E('p', _('The Switch / VLAN configuration view is new and still considered experimental. Bugs in this view may result in network misconfiguration that can leave your device unreachable over the network.')),
			E('p', _('Before making changes, make sure you have an alternative way to access the device (e.g. a serial or out-of-band connection) and review every change in "Unsaved Changes" before applying.')),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': function() {
						ui.hideModal();
						if (window.history.length > 1)
							window.history.back();
						else
							window.location.href = L.url('admin/network/network');
					}
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.hideModal
				}, _('I understand, continue'))
			])
		]);
	},

	refreshAll() {
		this.loadState();

		const newPorts = this.renderPortsSection();
		const newVlans = this.renderVlansSection();

		if (this.portsBlock && this.portsBlock.parentNode)
			this.portsBlock.parentNode.replaceChild(newPorts, this.portsBlock);

		if (this.vlansBlock && this.vlansBlock.parentNode)
			this.vlansBlock.parentNode.replaceChild(newVlans, this.vlansBlock);

		this.portsBlock = newPorts;
		this.vlansBlock = newVlans;

		for (let name of this.selection)
			if (this.ports.indexOf(name) === -1)
				this.selection.delete(name);

		this.refreshLinkStatus();
		this.onSelectionChange();
	},

	refreshLinkStatus() {
		if (!this.root || !this.bridge)
			return Promise.resolve();

		return network.getDevices().then(devices => {
			const byName = {};
			devices.forEach(d => { byName[d.getName()] = d; });

			this.ports.forEach(name => {
				const dev = byName[name] || network.instantiateDevice(name);
				const tile = this.root.querySelector('.svc-port-tile[data-port="%s"]'.format(name));
				if (!tile)
					return;

				const linkEl = tile.querySelector('.svc-port-link');
				const speedEl = tile.querySelector('.svc-port-speed');
				if (!linkEl || !speedEl)
					return;

				const carrier = dev ? dev.getCarrier() : false;
				const speed = dev ? dev.getSpeed() : null;
				const duplex = dev ? dev.getDuplex() : null;

				let state = 'down';
				let speedText = _('no link');

				if (carrier && speed && speed > 0) {
					state = 'up';
					speedText = '%d%s'.format(speed, duplex == 'full' ? 'FD' : (duplex == 'half' ? 'HD' : ''));
				}
				else if (carrier) {
					state = 'up';
					speedText = _('up');
				}

				linkEl.setAttribute('data-state', state);
				speedEl.textContent = speedText;
			});
		});
	},


	/* =========================================================================
	 * Ports section: rendering, tile clicks, selection state
	 * ========================================================================= */

	renderPortsSection() {
		const portState = bvtool.buildPortState(this.bridge, this.ports);

		const content = this.ports.length
			? E('div', { 'class': 'svc-ports' }, this.ports.map(name => this.renderPortTile(name, portState[name])))
			: E('p', { 'class': 'svc-empty' }, _('No ports are configured on this bridge.'));

		const clearBtn = E('button', {
			'class': 'cbi-button cbi-button-neutral svc-port-btn-clear',
			'type': 'button',
			'click': () => this.handleClearSelection()
		}, _('Clear selection'));

		const selectAllBtn = E('button', {
			'class': 'cbi-button cbi-button-neutral svc-port-btn-select-all',
			'type': 'button',
			'click': () => this.handleSelectAll()
		}, _('Select all ports'));

		this.clearSelectionBtn = clearBtn;
		this.selectAllBtn = selectAllBtn;

		return E('div', { 'class': 'svc-block' }, [
			E('div', { 'class': 'svc-block-header' }, [
				E('h3', _('Ports')),
				E('span', { 'class': 'svc-port-header-actions' }, [ clearBtn, selectAllBtn ])
			]),
			content
		]);
	},

	renderPortTile(name, state) {
		const selected = this.selection.has(name);
		const labelValue = this.portLabels[name] || '';

		const labelInput = E('input', {
			'type': 'text',
			'class': 'svc-port-label',
			'placeholder': _('label'),
			'value': labelValue,
			'maxlength': 32,
			'spellcheck': 'false'
		});

		labelInput.addEventListener('click', ev => ev.stopPropagation());
		labelInput.addEventListener('mousedown', ev => ev.stopPropagation());
		labelInput.addEventListener('blur', ev => this.handlePortLabelChange(name, ev));

		const nativeNode = E('span', { 'class': 'svc-port-vlan native' },
			state.native != null ? [ E('span', { 'class': 'svc-port-tag-prefix' }, 'U:'), '%d'.format(state.native) ] : '');

		const taggedNode = E('span', { 'class': 'svc-port-vlan tagged' },
			state.tagged.length ? [
				E('span', { 'class': 'svc-port-tag-prefix' }, 'T:'),
				state.tagged.map(v => '%d'.format(v)).join(', ')
			] : '');

		const tile = E('div', {
			'class': 'svc-port-tile' + (selected ? ' selected' : ''),
			'data-port': name,
			'role': 'button',
			'tabindex': '0'
		}, [
			E('div', { 'class': 'svc-port-header' }, [
				E('span', { 'class': 'svc-port-name' }, name),
				E('span', { 'class': 'svc-port-link', 'data-state': 'unknown' }, [
					E('span', { 'class': 'svc-port-dot' }),
					E('span', { 'class': 'svc-port-speed' }, '—')
				])
			]),
			labelInput,
			E('div', { 'class': 'svc-port-vlans' }, [ nativeNode, taggedNode ])
		]);

		tile.addEventListener('click', ev => this.handlePortClick(name, ev));
		tile.addEventListener('keydown', ev => {
			if (ev.key === ' ' || ev.key === 'Enter') {
				ev.preventDefault();
				this.handlePortClick(name, ev);
			}
		});

		return tile;
	},

	handlePortClick(name, ev) {
		if (ev && ev.target && ev.target.classList.contains('svc-port-label'))
			return;

		if (this.selection.has(name))
			this.selection.delete(name);
		else
			this.selection.add(name);

		const tile = this.root.querySelector('.svc-port-tile[data-port="%s"]'.format(name));
		if (tile)
			tile.classList.toggle('selected', this.selection.has(name));

		this.onSelectionChange();
	},

	handlePortLabelChange(name, ev) {
		const value = (ev.target.value || '').trim();

		if (value === (this.portLabels[name] || ''))
			return;

		this.portLabels[name] = value;
		bvtool.writePortLabel(name, value);
		this.stashNetworkChanges();
	},

	handleClearSelection() {
		this.selection.clear();
		this.refreshPortSelectionDom();
		this.onSelectionChange();
	},

	handleSelectAll() {
		this.ports.forEach(name => this.selection.add(name));
		this.refreshPortSelectionDom();
		this.onSelectionChange();
	},

	refreshPortSelectionDom() {
		if (!this.root)
			return;

		const tiles = this.root.querySelectorAll('.svc-port-tile');

		tiles.forEach(tile => {
			const name = tile.getAttribute('data-port');
			tile.classList.toggle('selected', this.selection.has(name));
		});
	},

	onSelectionChange() {
		this.refreshSelectionUi();
	},

	refreshSelectionUi() {
		const hasSelection = this.selection.size > 0;
		const allSelected = this.ports.length > 0 && this.selection.size === this.ports.length;

		this.clearSelectionBtn?.toggleAttribute('disabled', !hasSelection);
		this.selectAllBtn?.toggleAttribute('disabled', allSelected);

		if (!this.root)
			return;

		this.refreshVlanRowStates();
	},

	requireSelection() {
		if (this.selection.size > 0)
			return true;

		ui.addNotification(null, E('p', _('Select one or more ports first.')), 'warning');
		return false;
	},


	/* =========================================================================
	 * VLANs section: rendering, tri-state buttons, per-row interactions
	 * ========================================================================= */

	renderVlansSection() {
		const portState = bvtool.buildPortState(this.bridge, this.ports);
		const counts = {};

		this.vlans.forEach(v => {
			counts[v.vlan] = { tagged: 0, untagged: 0 };
		});

		this.ports.forEach(name => {
			const st = portState[name];
			if (st.native != null && counts[st.native])
				counts[st.native].untagged++;
			st.tagged.forEach(vid => {
				if (counts[vid])
					counts[vid].tagged++;
			});
		});

		const rows = [
			this.renderVlanHeader(),
			...this.vlans.map(v => this.renderVlanRow(v, counts[v.vlan])),
			this.renderVlanAddRow()
		];

		const container = E('div', { 'class': 'svc-vlans' }, rows);

		return E('div', { 'class': 'svc-block' }, [
			E('div', { 'class': 'svc-block-header' }, [
				E('h3', _('VLANs'))
			]),
			container
		]);
	},

	renderVlanHeader() {
		return E('div', { 'class': 'svc-vlan-header' }, [
			E('span', { 'class': 'svc-vlan-cell svc-vlan-cell-id' }, _('VLAN ID')),
			E('span', { 'class': 'svc-vlan-cell svc-vlan-cell-label' }, _('Label')),
			E('span', { 'class': 'svc-vlan-cell svc-vlan-cell-local' }, _('Local')),
			E('span', { 'class': 'svc-vlan-cell svc-vlan-cell-select' }, _('Select ports')),
			E('span', { 'class': 'svc-vlan-cell svc-vlan-cell-assign' }, _('Assign membership')),
			E('span', { 'class': 'svc-vlan-cell svc-vlan-cell-action' })
		]);
	},

	renderVlanRow(v, count) {
		const labelInput = E('input', {
			'type': 'text',
			'class': 'svc-vlan-label',
			'placeholder': _('label'),
			'value': this.vlanLabels[v.vlan] || '',
			'maxlength': 32,
			'spellcheck': 'false'
		});

		labelInput.addEventListener('blur', ev => this.handleVlanLabelChange(v.vlan, ev));

		const localCb = E('input', {
			'type': 'checkbox',
			'checked': v.local ? '' : null
		});

		localCb.addEventListener('change', ev => this.handleVlanLocalChange(v.vlan, ev));

		const localLabel = E('label', {
			'class': 'cbi-checkbox',
			'title': _('Mark VLAN as locally terminated on the bridge')
		}, [ localCb ]);

		const taggedBtn = E('button', {
			'class': 'cbi-button cbi-button-neutral svc-vlan-btn-tagged',
			'disabled': count.tagged ? null : '',
			'title': _('Select all ports having VLAN %d assigned as tagged (%d)').format(v.vlan, count.tagged)
		}, [ E('span', { 'class': 'svc-vlan-btn-prefix' }, 'T') ]);

		taggedBtn.addEventListener('click', ev => this.handleSelectByRole(v.vlan, 'tagged', ev));

		const untaggedBtn = E('button', {
			'class': 'cbi-button cbi-button-neutral svc-vlan-btn-untagged',
			'disabled': count.untagged ? null : '',
			'title': _('Select all ports having VLAN %d assigned as untagged / native (%d)').format(v.vlan, count.untagged)
		}, [ E('span', { 'class': 'svc-vlan-btn-prefix' }, 'U') ]);

		untaggedBtn.addEventListener('click', ev => this.handleSelectByRole(v.vlan, 'untagged', ev));

		const assignTaggedToggle = this.createAssignToggle(v.vlan, 'tagged', 'T');
		const assignUntaggedToggle = this.createAssignToggle(v.vlan, 'untagged', 'U');

		const removeBtn = E('button', {
			'class': 'cbi-button cbi-button-remove svc-vlan-btn-remove',
			'title': _('Remove VLAN %d').format(v.vlan)
		}, _('Remove'));

		removeBtn.addEventListener('click', () => this.handleVlanRemove(v));

		const row = E('div', {
			'class': 'svc-vlan-row',
			'data-vlan': '%d'.format(v.vlan)
		}, [
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-id' }, [
				E('span', { 'class': 'svc-vlan-id' }, '%d'.format(v.vlan))
			]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-label' }, [ labelInput ]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-local' }, [ localLabel ]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-select' }, [
				E('span', { 'class': 'svc-vlan-select-group' }, [ taggedBtn, untaggedBtn ])
			]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-assign' }, [
				E('span', { 'class': 'svc-vlan-assign-group' }, [ assignTaggedToggle, assignUntaggedToggle ])
			]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-action' }, [ removeBtn ])
		]);

		row.addEventListener('mouseenter', () => this.handleVlanHover(v.vlan, true));
		row.addEventListener('mouseleave', () => this.handleVlanHover(v.vlan, false));
		row.addEventListener('focusin', () => this.handleVlanHover(v.vlan, true));
		row.addEventListener('focusout', () => this.handleVlanHover(v.vlan, false));

		return row;
	},

	renderVlanAddRow() {
		const vidInput = E('input', {
			'type': 'number',
			'class': 'svc-vlan-id-input',
			'placeholder': _('VLAN'),
			'min': '%d'.format(bvtool.MIN_VLAN_ID),
			'max': '%d'.format(bvtool.MAX_VLAN_ID),
			'step': '1'
		});

		const labelInput = E('input', {
			'type': 'text',
			'class': 'svc-vlan-label',
			'placeholder': _('label (optional)'),
			'maxlength': 32,
			'spellcheck': 'false'
		});

		const localCb = E('input', {
			'type': 'checkbox',
			'checked': ''
		});

		const addBtn = E('button', {
			'class': 'cbi-button cbi-button-add svc-vlan-btn-add'
		}, _('Add'));

		const localLabel = E('label', {
			'class': 'cbi-checkbox',
			'title': _('Mark VLAN as locally terminated on the bridge')
		}, [ localCb ]);

		const row = E('div', { 'class': 'svc-vlan-row svc-vlan-add-row' }, [
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-id' }, [ vidInput ]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-label' }, [ labelInput ]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-local' }, [ localLabel ]),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-select svc-vlan-cell-empty' }),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-assign svc-vlan-cell-empty' }),
			E('div', { 'class': 'svc-vlan-cell svc-vlan-cell-action' }, [ addBtn ])
		]);

		const submit = () => this.handleVlanAdd(vidInput, labelInput, localCb);
		const submitOnEnter = ev => {
			if (ev.key === 'Enter') {
				ev.preventDefault();
				submit();
			}
		};

		addBtn.addEventListener('click', submit);
		vidInput.addEventListener('keydown', submitOnEnter);
		labelInput.addEventListener('keydown', submitOnEnter);

		return row;
	},

	createAssignToggle(vid, role, prefix) {
		const btn = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-neutral svc-vlan-assign-btn svc-vlan-btn-assign-%s'.format(role),
			'click': ev => this.handleAssignToggleClick(vid, role, ev)
		}, [
			E('span', { 'class': 'svc-vlan-btn-prefix' }, prefix)
		]);

		const roleState = this.computeAssignRoleState(vid);
		this.refreshAssignButton(btn, vid, role, roleState[role], !this.selection.size);

		return btn;
	},

	refreshVlanRowStates() {
		if (!this.root)
			return;

		const portState = bvtool.buildPortState(this.bridge, this.ports);
		const counts = {};

		this.vlans.forEach(v => counts[v.vlan] = { tagged: 0, untagged: 0 });
		this.ports.forEach(name => {
			const st = portState[name];
			if (st.native != null && counts[st.native])
				counts[st.native].untagged++;
			st.tagged.forEach(vid => {
				if (counts[vid]) counts[vid].tagged++;
			});
		});

		const noSelection = !this.selection.size;

		this.root.querySelectorAll('.svc-vlan-row[data-vlan]').forEach(row => {
			const vid = +row.getAttribute('data-vlan');
			const count = counts[vid];
			if (!count)
				return;

			this.refreshSelectButton(row.querySelector('.svc-vlan-select-group .svc-vlan-btn-tagged'),
				vid, 'tagged', count.tagged);
			this.refreshSelectButton(row.querySelector('.svc-vlan-select-group .svc-vlan-btn-untagged'),
				vid, 'untagged', count.untagged);

			const roleState = this.computeAssignRoleState(vid, portState);
			this.refreshAssignButton(row.querySelector('.svc-vlan-btn-assign-tagged'),
				vid, 'tagged', roleState.tagged, noSelection);
			this.refreshAssignButton(row.querySelector('.svc-vlan-btn-assign-untagged'),
				vid, 'untagged', roleState.untagged, noSelection);
		});
	},

	refreshSelectButton(btn, vid, role, n) {
		if (!btn)
			return;
		btn.toggleAttribute('disabled', !n);
		btn.title = role === 'tagged'
			? _('Select all ports having VLAN %d assigned as tagged (%d)').format(vid, n)
			: _('Select all ports having VLAN %d assigned as untagged / native (%d)').format(vid, n);
	},

	refreshAssignButton(btn, vid, role, state, noSelection) {
		if (!btn)
			return;
		btn.classList.toggle('svc-vlan-assign-checked', !noSelection && state === 'checked');
		btn.classList.toggle('svc-vlan-assign-mixed', !noSelection && state === 'mixed');
		btn.classList.toggle('svc-vlan-assign-disabled', noSelection);

		if (noSelection) {
			btn.title = _('Select one or more ports first');
			return;
		}

		if (role === 'tagged')
			btn.title = state === 'unchecked'
				? _('Assign VLAN %d as tagged on selected ports').format(vid)
				: state === 'mixed'
					? _('Remove VLAN %d as tagged from selected ports that have it').format(vid)
					: _('Remove VLAN %d as tagged from all selected ports').format(vid);
		else
			btn.title = state === 'unchecked'
				? _('Assign VLAN %d as untagged (native) on selected ports').format(vid)
				: state === 'mixed'
					? _('Remove VLAN %d as untagged (native) from selected ports that have it').format(vid)
					: _('Remove VLAN %d as untagged (native) from all selected ports').format(vid);
	},

	computeAssignRoleState(vid, portState) {
		const total = this.selection.size;
		if (!total)
			return { tagged: 'unchecked', untagged: 'unchecked' };

		portState ??= bvtool.buildPortState(this.bridge, this.ports);
		let taggedN = 0, untaggedN = 0;

		this.selection.forEach(name => {
			const st = portState[name];
			if (!st)
				return;
			if (st.tagged.some(t => +t === +vid)) taggedN++;
			if (+st.native === +vid) untaggedN++;
		});

		const tri = n => n === 0 ? 'unchecked' : n === total ? 'checked' : 'mixed';
		return { tagged: tri(taggedN), untagged: tri(untaggedN) };
	},

	handleVlanHover(vid, enter) {
		if (!this.root)
			return;

		if (!enter) {
			this.root.querySelectorAll('.svc-port-tile.highlight-tagged, .svc-port-tile.highlight-untagged')
				.forEach(t => t.classList.remove('highlight-tagged', 'highlight-untagged'));
			return;
		}

		const portState = bvtool.buildPortState(this.bridge, this.ports);

		this.ports.forEach(name => {
			const tile = this.root.querySelector('.svc-port-tile[data-port="%s"]'.format(name));
			if (!tile)
				return;

			const st = portState[name];
			if (st.native === vid)
				tile.classList.add('highlight-untagged');
			else if (st.tagged.indexOf(vid) !== -1)
				tile.classList.add('highlight-tagged');
		});
	},

	handleSelectByRole(vid, role, ev) {
		if (ev) {
			ev.preventDefault();
			ev.stopPropagation();
		}

		const portState = bvtool.buildPortState(this.bridge, this.ports);

		this.selection.clear();

		this.ports.forEach(name => {
			const st = portState[name];
			if (role === 'untagged' && +st.native === +vid)
				this.selection.add(name);
			else if (role === 'tagged' && st.tagged.some(t => +t === +vid))
				this.selection.add(name);
		});

		this.refreshPortSelectionDom();
		this.onSelectionChange();
	},

	handleVlanLocalChange(vid, ev) {
		const section = this.findVlanSection(vid);
		if (!section)
			return;

		const checked = !!ev.target.checked;

		/* netifd treats an absent "local" option as local=true, so unchecking
		 * must write '0' explicitly rather than unsetting the option. */
		uci.set('network', section.section_id, 'local', checked ? '1' : '0');

		for (let v of this.vlans) {
			if (+v.vlan === +vid) {
				v.local = checked;
				break;
			}
		}

		this.stashNetworkChanges();
	},

	handleVlanLabelChange(vid, ev) {
		const value = (ev.target.value || '').trim();

		if (value === (this.vlanLabels[vid] || ''))
			return;

		this.vlanLabels[vid] = value;
		bvtool.writeVlanLabel(vid, value);
		this.stashNetworkChanges();
	},

	handleVlanAdd(vidInput, labelInput, localCb) {
		const raw = (vidInput.value || '').trim();
		const vid = parseInt(raw, 10);

		if (!raw || !(vid >= bvtool.MIN_VLAN_ID && vid <= bvtool.MAX_VLAN_ID)) {
			ui.addNotification(null, E('p', _('Please enter a VLAN ID between %d and %d.').format(bvtool.MIN_VLAN_ID, bvtool.MAX_VLAN_ID)), 'warning');
			vidInput.focus();
			return;
		}

		if (this.vlans.some(v => v.vlan === vid)) {
			ui.addNotification(null, E('p', _('VLAN %d is already configured.').format(vid)), 'warning');
			vidInput.focus();
			return;
		}

		const section_id = uci.add('network', 'bridge-vlan');
		uci.set('network', section_id, 'device', this.bridge.name);
		uci.set('network', section_id, 'vlan', '%d'.format(vid));

		uci.set('network', section_id, 'local', localCb.checked ? '1' : '0');

		const labelValue = (labelInput.value || '').trim();
		if (labelValue)
			bvtool.writeVlanLabel(vid, labelValue);

		this.refreshAll();
		this.stashNetworkChanges();

		const newRow = this.root.querySelector('.svc-vlan-row[data-vlan="%d"]'.format(vid));
		if (newRow)
			newRow.classList.add('flash');
	},

	handleVlanRemove(v) {
		const portState = bvtool.buildPortState(this.bridge, this.ports);
		const affected = this.ports.filter(name =>
			portState[name].native === v.vlan ||
			portState[name].tagged.indexOf(v.vlan) !== -1);

		const portList = affected.length ? affected.join(', ') : _('none');
		const labelText = this.vlanLabels[v.vlan] ? ' (%s)'.format(this.vlanLabels[v.vlan]) : '';

		ui.showModal(_('Remove VLAN %d?').format(v.vlan), [
			E('p', _('You are about to remove VLAN %d%s. This will also remove the VLAN from every port that currently has it assigned (tagged or untagged).').format(v.vlan, labelText)),
			E('p', [ E('strong', _('Affected ports: ')), portList ]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative important',
					'click': ui.createHandlerFn(this, function() {
						this.doVlanRemove(v);
						ui.hideModal();
					})
				}, _('Remove'))
			])
		]);
	},

	doVlanRemove(v) {
		const section = this.findVlanSection(v.vlan);
		if (!section)
			return;

		uci.remove('network', section.section_id);

		bvtool.writeVlanLabel(v.vlan, '');

		this.refreshAll();
		this.stashNetworkChanges();
	},


	/* =========================================================================
	 * VLAN membership mutations: T/U click pipeline
	 * ========================================================================= */

	handleAssignToggleClick(vid, role, ev) {
		ev.preventDefault();
		ev.stopPropagation();

		if (ev.currentTarget.classList.contains('svc-vlan-assign-disabled'))
			return;

		if (!this.requireSelection()) {
			this.refreshVlanRowStates();
			return;
		}

		const portState = bvtool.buildPortState(this.bridge, this.ports);
		const state = this.computeAssignRoleState(vid, portState)[role];

		if (state === 'unchecked') {
			const conflicts = this.findAssignConflicts(vid, role, portState);
			if (conflicts.length) {
				this.showTaggedConflict(conflicts);
				this.refreshVlanRowStates();
				return;
			}
			if (role === 'tagged')
				this.applyTaggedChangeToSelection(vid, true);
			else
				this.applyUntaggedVlanToSelection(vid);
		}
		else if (role === 'tagged') {
			this.applyTaggedChangeToSelection(vid, false);
		}
		else {
			this.applyRemoveUntaggedFromSelection(vid);
		}

		this.refreshAll();
		/* Auto-stash so the global "Unsaved Changes" counter updates immediately,
		 * matching every other action in this view. Trade-off: if the user toggles,
		 * the autosave reaches the server's pending state, and then toggles back,
		 * bvtool.setBridgeVlanPorts clears the *local* pending change but cannot
		 * undo the already-saved server entry — the counter then shows a phantom
		 * change that nets to no-op on Apply. Cosmetic only. */
		this.stashNetworkChanges();
	},

	findAssignConflicts(vid, role, portState) {
		const conflicts = [];
		this.selection.forEach(name => {
			const st = portState[name];
			const conflicts_with = role === 'tagged'
				? +st.native === +vid
				: st.tagged.some(t => +t === +vid);
			if (conflicts_with)
				conflicts.push({ port: name, vlan: vid });
		});
		return conflicts;
	},

	showTaggedConflict(conflicts) {
		const lines = conflicts.slice(0, 6).map(c =>
			_('Port "%s" already has VLAN %d as its native (untagged) VLAN.').format(c.port, c.vlan));

		if (conflicts.length > 6)
			lines.push(_('… and %d more.').format(conflicts.length - 6));

		ui.addNotification(null, E('div', { 'class': 'svc-vlan-conflict' }, [
			E('p', _('The requested change conflicts with the existing native VLAN assignment of one or more selected ports. No change was made; a port cannot have the same VLAN as both native and tagged.')),
			E('div', { 'class': 'svc-vlan-conflict-ports' }, lines.map(l =>
				E('p', { 'class': 'svc-vlan-conflict-port' }, l)))
		]), 'warning');
	},

	/* Re-scan via uci.sections() rather than reading this.vlans: the cache is
	 * only refreshed by loadState() and can be stale between a user edit and
	 * the next refreshAll/syncStateAfterUciSave, so rapid Add-VLAN-then-assign
	 * sequences would otherwise miss the new section_id. */
	findVlanSection(vid) {
		const devname = this.bridge ? this.bridge.name : null;
		let section_id = null;
		let local = true;

		if (!devname)
			return null;

		uci.sections('network', 'bridge-vlan', s => {
			if (s.device != devname || +s.vlan !== +vid)
				return;

			section_id = s['.name'];
			local = bvtool.parseLocal(s.local);
		});

		if (!section_id)
			return null;

		return { vlan: +vid, section_id, local };
	},

	applyTaggedChangeToSelection(vid, check) {
		const section = this.findVlanSection(vid);
		if (!section)
			return;

		const portMap = loadPortMap(section.section_id);
		let changed = false;

		this.selection.forEach(name => {
			const existing = portMap[name];
			if (check) {
				if (!existing || (!existing.tagged && existing.untagged)) {
					portMap[name] = { port: name, tagged: true, untagged: false, pvid: false };
					changed = true;
				}
			}
			else if (existing && existing.tagged) {
				if (existing.untagged)
					portMap[name] = { port: name, tagged: false, untagged: true, pvid: true };
				else
					delete portMap[name];
				changed = true;
			}
		});

		if (changed)
			bvtool.setBridgeVlanPorts(section.section_id, portMapToSpecs(portMap));
	},

	applyUntaggedVlanToSelection(vid) {
		const portState = bvtool.buildPortState(this.bridge, this.ports);
		const oldNatives = new Set();

		this.selection.forEach(name => {
			if (portState[name].native != null && portState[name].native !== vid)
				oldNatives.add(portState[name].native);
		});

		oldNatives.forEach(oldVid => {
			const section = this.findVlanSection(oldVid);
			if (!section)
				return;

			const ports = L.toArray(uci.get('network', section.section_id, 'ports'));
			const filtered = ports.filter(spec => {
				const p = bvtool.parsePortSpec(spec);
				return !p || !this.selection.has(p.port) || (p.tagged && !p.untagged);
			});

			if (filtered.length !== ports.length)
				bvtool.setBridgeVlanPorts(section.section_id, filtered);
		});

		const section = this.findVlanSection(vid);
		if (!section) {
			ui.addNotification(null, E('p', _('VLAN %d does not exist.').format(vid)), 'warning');
			return;
		}

		const portMap = loadPortMap(section.section_id);
		let changed = false;

		this.selection.forEach(name => {
			if (!portMap[name] || !portMap[name].untagged) {
				portMap[name] = { port: name, tagged: false, untagged: true, pvid: true };
				changed = true;
			}
		});

		if (changed)
			bvtool.setBridgeVlanPorts(section.section_id, portMapToSpecs(portMap));
	},

	applyRemoveUntaggedFromSelection(vid) {
		const section = this.findVlanSection(vid);
		if (!section)
			return;

		const portMap = loadPortMap(section.section_id);
		let changed = false;

		this.selection.forEach(name => {
			const existing = portMap[name];
			if (!existing || !existing.untagged)
				return;

			if (existing.tagged)
				portMap[name] = { port: name, tagged: true, untagged: false, pvid: false };
			else
				delete portMap[name];
			changed = true;
		});

		if (changed)
			bvtool.setBridgeVlanPorts(section.section_id, portMapToSpecs(portMap));
	},


	/* =========================================================================
	 * Stash, save, apply, reset
	 * ========================================================================= */

	hasPendingLocalChanges() {
		for (const conf of [ 'network', 'luci' ]) {
			if (uci.state.creates[conf] && Object.keys(uci.state.creates[conf]).length)
				return true;
			if (uci.state.changes[conf] && Object.keys(uci.state.changes[conf]).length)
				return true;
			if (uci.state.deletes[conf] && Object.keys(uci.state.deletes[conf]).length)
				return true;
		}

		return false;
	},

	/* Serialised via _stashChain: concurrent uci.save() RPCs race on the rpcd
	 * session state, so each stash must wait for the previous one to settle. */
	async stashNetworkChanges() {
		this._stashChain = (this._stashChain ?? Promise.resolve()).then(async () => {
			try {
				const doSave = this.hasPendingLocalChanges();
				if (doSave)
					await uci.save();
				ui.changes.renderChangeIndicator(await uci.changes());
				if (doSave)
					this.syncStateAfterUciSave();
			}
			catch (err) {
				ui.addNotification(null, E('p', _('Failed to save configuration: %s').format(err.message)), 'danger');
			}
		});

		return this._stashChain;
	},

	syncStateAfterUciSave() {
		this.loadState();
		this.refreshVlanRowStates();
	},

	handleSave(ev) {
		return this.stashNetworkChanges().then(() => {
			ui.addNotification(null, E('p', _('Changes have been staged. Use "Save & Apply" or the "Unsaved Changes" indicator to apply them.')), 'info');
		});
	},

	handleSaveApply(ev, mode) {
		return this.stashNetworkChanges().then(() => {
			ui.changes.apply(mode == '0');
		});
	},

	handleReset(ev) {
		ui.changes.revert();
	},

});
