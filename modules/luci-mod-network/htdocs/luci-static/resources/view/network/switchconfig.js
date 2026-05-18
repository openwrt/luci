'use strict';
'require view';
'require uci';
'require ui';
'require network';
'require tools.switchconfig_bridge as svnbr';
'require tools.switchconfig_labels as scLbl';

function netdevOrderedPorts(bridge, netDevices) {
	const raw = svnbr.collectSeenPortsBridge(bridge);
	let sortable = [];

	for (let i = 0; i < raw.length; i++) {
		const dev = network.instantiateDevice(raw[i]);

		if (dev.getType() !== 'wifi' || dev.isUp())
			sortable.push(dev);
	}

	sortable.sort(function(a, b) {
		return L.naturalCompare(a.getName(), b.getName());
	});

	const out = [];
	const seen = {};

	for (let j = 0; j < sortable.length; j++) {
		const n = sortable[j].getName();

		if (seen[n])
			continue;

		seen[n] = true;
		out.push(n);
	}

	if (out.length)
		return out;

	const ndm = svnbr.netdevMap(netDevices);
	const brn = ndm[bridge];

	if (brn != null && typeof brn.getPorts === 'function') {
		for (let p of (brn.getPorts() || [])) {
			const n = p.getName();

			if (!seen[n]) {
				seen[n] = true;
				out.push(n);
			}
		}
	}

	return out;
}

function parseBridgeVlanForPorts(bridge, portIds, netDevices) {
	const ndm = svnbr.netdevMap(netDevices);
	const ports = [];
	const portById = {};

	for (let i = 0; i < portIds.length; i++) {
		const id = portIds[i];
		const d = ndm[id];
		let carrier = false, speed = 0, duplex = null;

		if (d != null) {
			carrier = !!d.getCarrier();
			speed = d.getSpeed() || 0;
			duplex = d.getDuplex();
		}

		const p = {
			id: id,
			native: '',
			tagged: '',
			carrier: carrier,
			speed: speed,
			duplex: duplex,
			_link: null,
			_sx: null
		};

		ports.push(p);
		portById[id] = p;
	}

	const vlanSeen = {};
	const bridgeVlans = [];
	const localByVid = {};
	const secs = uci.sections('network', 'bridge-vlan');

	for (let si = 0; si < secs.length; si++) {
		const s = secs[si];

		if (s.device !== bridge)
			continue;

		const vidStr = String(s.vlan);

		if (!vidStr || vidStr === 'null')
			continue;

		if (!vlanSeen[vidStr]) {
			vlanSeen[vidStr] = true;
			bridgeVlans.push(+vidStr);
		}

		if (s.local != null && s.local !== '')
			localByVid[vidStr] = s.local;

		const pl = L.toArray(s.ports);

		for (let pi = 0; pi < pl.length; pi++) {
			const spec = String(pl[pi]);
			const m = spec.match(/^([^:]+)(?::(.*))?$/);

			if (!m)
				continue;

			const pname = m[1];
			const rest = m[2] || '';
			const pr = portById[pname];

			if (!pr)
				continue;

			if (/t/.test(rest)) {
				const tags = pr.tagged ? pr.tagged.split(/\s+/).filter(Boolean) : [];

				tags.push(vidStr);

				const uniq = {};
				const merged = [];

				for (let ti = 0; ti < tags.length; ti++) {
					const t = tags[ti];

					if (!uniq[t]) {
						uniq[t] = true;
						merged.push(t);
					}
				}

				merged.sort(function(a, b) { return +a - +b; });
				pr.tagged = merged.join(' ');
			}
			else {
				pr.native = vidStr;
			}
		}
	}

	bridgeVlans.sort(function(a, b) { return a - b; });

	return { ports: ports, bridgeVlans: bridgeVlans, localByVid: localByVid };
}

function deepSnapshot(ports, bridgeVlans, localByVid) {
	return {
		ports: ports.map(function(p) {
			return {
				id: p.id, native: p.native, tagged: p.tagged,
				carrier: p.carrier, speed: p.speed, duplex: p.duplex
			};
		}),
		bridgeVlans: bridgeVlans.slice(),
		localByVid: Object.assign({}, localByVid)
	};
}

function flushBridgeVlanUci(bridge, ctx) {
	const wanted = {};

	for (let i = 0; i < ctx.bridgeVlans.length; i++)
		wanted[String(ctx.bridgeVlans[i])] = true;

	/* Remove obsolete sections in one pass */
	uci.sections('network', 'bridge-vlan').forEach(function(s) {
		if (s.device === bridge && !wanted[String(s.vlan)])
			uci.remove('network', s['.name']);
	});

	/* Upsert: snapshot once to avoid repeated re-query inside the loop */
	for (let vi = 0; vi < ctx.bridgeVlans.length; vi++) {
		const vid = ctx.bridgeVlans[vi];
		const vs = String(vid);

		/* Find existing section for this bridge+vlan */
		const existing = uci.sections('network', 'bridge-vlan').filter(function(s) {
			return s.device === bridge && String(s.vlan) === vs;
		})[0];

		const sid = existing
			? existing['.name']
			: uci.add('network', 'bridge-vlan');

		if (!existing) {
			uci.set('network', sid, 'device', bridge);
			uci.set('network', sid, 'vlan', vs);
		}

		const portArr = [];

		for (let k = 0; k < ctx.ports.length; k++) {
			const p = ctx.ports[k];

			if (String(p.native) === vs)
				portArr.push(p.id);
			else if ((p.tagged || '').split(/\s+/).filter(Boolean).indexOf(vs) >= 0)
				portArr.push(p.id + ':t');
		}

		uci.set('network', sid, 'ports', portArr);

		const loc = ctx.localByVid[vs];
		uci.set('network', sid, 'local', (loc != null && loc !== '') ? loc : '1');
	}
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load() {
		if (!document.getElementById('switchconfig-css-sheet'))
			document.querySelector('head').appendChild(E('link', {
				'id': 'switchconfig-css-sheet',
				'rel': 'stylesheet',
				'type': 'text/css',
				'href': L.resource('switchconfig.css')
			}));

		return Promise.all([
			network.getDevices(),
			uci.load('network'),
			uci.load('luci')
		]);
	},

	render(data) {
		const netDevices = data[0];

		if (!svnbr.hasVlanAwareBridgeConfigured())
			return E('div', { 'class': 'alert-message notice' }, [
				E('p', {}, _('Switch config is available after you add a bridge device under Network → Interfaces → Devices. Enable VLAN filtering and VLANs on the bridge there if needed.'))
			]);

		const hint   = svnbr.inferBridgeHint();
		const bridge = svnbr.inferSwitchBridge(netDevices, hint);

		if (!bridge)
			return E('div', { 'class': 'cbi-map' }, [
				E('h2', { 'name': 'content' }, _('Switch config')),
				E('div', { 'class': 'cbi-map-descr' },
					_('No suitable VLAN-aware bridge was found. Configure a bridge with VLAN filtering under Network → Interfaces → Devices.'))
			]);

		const portIds = netdevOrderedPorts(bridge, netDevices);

		if (!portIds.length)
			return E('div', { 'class': 'cbi-map' }, [
				E('h2', { 'name': 'content' }, _('Switch config')),
				E('div', { 'class': 'cbi-map-descr' },
					_('No switch ports were found on bridge "%s".').format(bridge))
			]);

		const parsed = parseBridgeVlanForPorts(bridge, portIds, netDevices);
		const ctx = {
			bridge: bridge,
			ports: parsed.ports,
			bridgeVlans: parsed.bridgeVlans,
			localByVid: parsed.localByVid
		};

		scLbl.pruneSwitchconfigLabels(
			ctx.ports.map(function(p) { return p.id; }),
			ctx.bridgeVlans
		);

		uci.save().catch(function() {});

		const portLabelMap = scLbl.getPortLabelMap();
		const initial     = deepSnapshot(ctx.ports, ctx.bridgeVlans, ctx.localByVid);
		const ndm         = svnbr.netdevMap(netDevices);

		/* ---- helpers ---------------------------------------------------- */

		function chipHtml(pc) {
			const u    = (pc.native || '').trim();
			const t    = (pc.tagged || '').trim();
			const bits = [];

			if (u)
				bits.push(E('span', {}, [ E('strong', {}, [ 'U:' ]), document.createTextNode(u) ]));

			if (t) {
				const tagged = t.split(/\s+/).filter(Boolean).join(', ');
				bits.push(E('span', {}, [ E('em', {}, [ 'T:' ]), document.createTextNode(tagged) ]));
			}

			if (!bits.length)
				return E('span', { 'class': 'chip-empty' }, [ _('No VLAN membership') ]);

			const wrap = E('span', {});

			for (let i = 0; i < bits.length; i++) {
				if (i > 0)
					wrap.appendChild(document.createTextNode(' · '));

				wrap.appendChild(bits[i]);
			}

			return wrap;
		}

		function refreshPortTile(p) {
			const d = ndm[p.id];

			if (d != null) {
				p.carrier = !!d.getCarrier();
				p.speed   = d.getSpeed() || 0;
				p.duplex  = d.getDuplex();
			}

			if (p._link) {
				const up = !!p.carrier;
				const sp = +p.speed || 0;
				const du = p.duplex;
				let descText, titleText;

				if (!up) {
					descText  = _('no link');
					titleText = _('no link');
				}
				else if (sp > 0 && du === 'full') {
					descText  = '%dFD'.format(sp);
					titleText = _('%s, %d MBit/s, %s').format(_('Connected'), sp, _('full-duplex'));
				}
				else if (sp > 0 && du === 'half') {
					descText  = '%dHD'.format(sp);
					titleText = _('%s, %d MBit/s, %s').format(_('Connected'), sp, _('half-duplex'));
				}
				else if (sp > 0) {
					descText  = '%dbaseT'.format(sp);
					titleText = _('%s, %d MBit/s').format(_('Connected'), sp);
				}
				else {
					descText  = _('Connected');
					titleText = _('Connected');
				}

				p._link.className = 'pc-link ' + (up ? 'pc-link--up' : 'pc-link--down');
				p._link.title     = titleText;
				p._link.innerHTML = '';
				p._link.append(
					E('span', { 'class': 'pc-link-ico' }),
					E('span', { 'class': 'pc-link-desc' }, [ descText ])
				);
			}

			if (p._sx) {
				p._sx.innerHTML = '';
				p._sx.appendChild(chipHtml(p));
			}
		}

		function stripVidFromAllPorts(vid) {
			for (let i = 0; i < ctx.ports.length; i++) {
				const p = ctx.ports[i];

				if (+p.native === +vid)
					p.native = '';

				p.tagged = p.tagged.split(/\s+/).filter(Boolean).filter(function(x) {
					return +x !== +vid;
				}).join(' ');

				refreshPortTile(p);
			}
		}

		/* ---- dock elements --------------------------------------------- */

		const selNative = E('select', { 'id': 'scp-unt-select', 'aria-labelledby': 'scp-dock-title-native' });

		const menuTagged = E('ul', { 'class': 'ck-dd-menu', 'id': 'scp-menu-tagged' });
		menuTagged.addEventListener('click', function(e) { e.stopPropagation(); });

		const lblTagged = E('span', { 'id': 'scp-lbl-tagged', 'class': 'ck-dd-label' });
		const ddWrap    = E('div',  { 'class': 'ck-dd', 'id': 'scp-dd-tagged', 'data-dd': true }, [
			E('button', {
				'type': 'button',
				'class': 'ck-dd-toggle',
				'id': 'scp-tagged-toggle',
				'aria-labelledby': 'scp-dock-title-tagged',
				'click': function(ev) {
					ev.preventDefault();
					ev.stopPropagation();
					const opening = !ddWrap.classList.contains('open');
					document.querySelectorAll('.switchconfig-pc [data-dd]').forEach(function(w) {
						w.classList.toggle('open', w === ddWrap && opening);
					});
				}
			}, [ lblTagged, E('span', { 'class': 'dd-caret', 'aria-hidden': 'true' }, [ '\u25bc' ]) ]),
			menuTagged
		]);

		const preview     = E('pre', { 'id': 'scp-preview', 'class': 'switchvlan-preview', 'aria-live': 'polite' });
		const vlanCatalog = E('p',   { 'id': 'scp-vlan-catalog', 'class': 'cbi-section-descr vlan-catalog-line' });
		const vlanTbody   = E('tbody', { 'id': 'scp-vlan-tbody' });
		const portFarm    = E('div',   { 'class': 'pc-grid', 'id': 'scp-port-farm' });
		const selCount    = E('strong', { 'id': 'scp-sel-count' }, [ '0' ]);

		/* ---- UI refresh helpers ----------------------------------------- */

		function refillNativeSelect() {
			const keep = selNative.value;
			const vlm  = scLbl.getVlanLabelMap();

			selNative.innerHTML = '';
			selNative.appendChild(E('option', { 'value': '' }, [ _('(none)') ]));

			for (let i = 0; i < ctx.bridgeVlans.length; i++) {
				const v   = ctx.bridgeVlans[i];
				const lab = vlm[String(v)]
					? _('VLAN %s — %s').format(v, vlm[String(v)])
					: _('VLAN %s').format(v);

				selNative.appendChild(E('option', { 'value': String(v) }, [ lab ]));
			}

			for (let j = 0; j < selNative.options.length; j++) {
				if (selNative.options[j].value === keep) {
					selNative.value = keep;
					break;
				}
			}
		}

		function refreshTaggedMetaButton(menuUl) {
			const btn = menuUl.querySelector('.ck-dd-tag-bulk');

			if (!btn)
				return;

			const inputs = menuUl.querySelectorAll('input[type=checkbox][data-vlan]');

			if (!inputs.length) {
				btn.textContent = _('Select all');
				btn.setAttribute('title', _('No VLANs in catalogue'));
				btn.disabled = true;
				return;
			}

			btn.disabled = false;

			let all = true;
			inputs.forEach(function(inp) {
				if (!inp.checked) all = false;
			});

			if (all) {
				btn.textContent = _('De-select all');
				btn.setAttribute('title', _('De-Select all VLAN tags'));
			}
			else {
				btn.textContent = _('Select all');
				btn.setAttribute('title', _('Select all VLAN tags'));
			}
		}

		function fillMenuUl(ul) {
			const vlm = scLbl.getVlanLabelMap();

			ul.innerHTML = '';

			const metaLi = E('li', { 'class': 'ck-dd-meta' });
			metaLi.appendChild(E('button', { 'type': 'button', 'class': 'ck-dd-tag-bulk' }));
			ul.appendChild(metaLi);

			for (let i = 0; i < ctx.bridgeVlans.length; i++) {
				const v  = ctx.bridgeVlans[i];
				const cb = E('input', { 'type': 'checkbox', 'data-vlan': String(v) });
				const txt = vlm[String(v)]
					? (' VLAN ' + v + ' — ' + vlm[String(v)])
					: (' VLAN ' + v);

				ul.appendChild(E('li', {}, [
					E('label', { 'class': 'ck-dd-vlan' }, [
						cb,
						document.createTextNode(txt)
					])
				]));
			}
		}

		function ddLabelCounts() {
			const tc = document.querySelectorAll('.switchconfig-pc #scp-menu-tagged input[data-vlan]:checked').length;
			lblTagged.textContent = tc
				? _('Tagged VLANs (%d selected)').format(tc)
				: _('Tagged VLANs (multi-select…)');
		}

		function resyncDdListeners() {
			fillMenuUl(menuTagged);
			refreshTaggedMetaButton(menuTagged);

			const bulk = menuTagged.querySelector('.ck-dd-tag-bulk');

			if (bulk) {
				bulk.addEventListener('click', function(ev) {
					ev.preventDefault();
					ev.stopPropagation();

					if (bulk.disabled)
						return;

					const inputs = menuTagged.querySelectorAll('input[type=checkbox][data-vlan]');

					if (!inputs.length)
						return;

					let all = true;
					inputs.forEach(function(inp) {
						if (!inp.checked) all = false;
					});
					inputs.forEach(function(inp) {
						inp.checked = !all;
					});

					refreshTaggedMetaButton(menuTagged);
					ddLabelCounts();
					previewLine();
				});
			}

			menuTagged.querySelectorAll('input[data-vlan]').forEach(function(inp) {
				inp.addEventListener('change', function() {
					refreshTaggedMetaButton(menuTagged);
					ddLabelCounts();
					previewLine();
				});
			});

			ddLabelCounts();
		}

		function selectedTiles() {
			const out = [];
			document.querySelectorAll('.switchconfig-pc .pc-chip.selected').forEach(function(n) {
				out.push(n.dataset.port);
			});
			return out;
		}

		function vidsTagged() {
			const o = [];
			document.querySelectorAll('.switchconfig-pc #scp-menu-tagged input[data-vlan]:checked').forEach(function(c) {
				o.push(+c.dataset.vlan);
			});
			return o.sort(function(a, b) { return a - b; });
		}

		function previewLine() {
			const hv = selectedTiles();

			selCount.textContent = String(hv.length);

			const tags = vidsTagged();
			const lines = [
				_('Selected: %s').format(hv.join(', ')),
				_('Native: %s').format(selNative.value ? _('VLAN %s').format(String(selNative.value)) : _('(none)')),
				_('Tagged: %s').format(tags.length ? tags.join(', ') : _('(none)'))
			];

			preview.textContent = lines.join('\n');
		}

		function clearTaggedMenu() {
			document.querySelectorAll('.switchconfig-pc #scp-menu-tagged input[data-vlan]').forEach(function(c) {
				c.checked = false;
			});
			refreshTaggedMetaButton(menuTagged);
			ddLabelCounts();
		}

		/* ---- VLAN catalogue table --------------------------------------- */

		function renderVlanMaintTable() {
			vlanTbody.innerHTML = '';

			const vlm = scLbl.getVlanLabelMap();

			for (let i = 0; i < ctx.bridgeVlans.length; i++) {
				const vid  = ctx.bridgeVlans[i];
				const vInp = E('input', {
					'type': 'text',
					'class': 'cbi-input-text scp-vlan-label',
					'placeholder': _('Note'),
					'value': vlm[String(vid)] || '',
					'title': _('Stored in /etc/config/luci only; not applied to bridge VLAN settings.')
				});

				vInp.addEventListener('change', function() {
					scLbl.setVlanLabel(vid, vInp.value).catch(function(e) {
						ui.addNotification(null, E('p', [ e ]));
					});
					refillNativeSelect();
					resyncDdListeners();
				});

				const rm = E('button', {
					'type': 'button',
					'class': 'cbi-button cbi-button-remove',
					'data-remove-vid': String(vid),
					'title': _('Remove VLAN %d from bridge and all ports').format(vid)
				}, [ _('Remove') ]);

				vlanTbody.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, [ String(vid) ]),
					E('td', { 'class': 'td' }, [ vInp ]),
					E('td', { 'class': 'td' }, [ rm ])
				]));
			}
		}

		function updateVlanCatalogueUi() {
			scLbl.pruneSwitchconfigLabels(
				ctx.ports.map(function(p) { return p.id; }),
				ctx.bridgeVlans
			);

			uci.save().catch(function() {});

			if (ctx.bridgeVlans.length)
				vlanCatalog.textContent = _('Configured VLAN IDs (%d): %s').format(
					ctx.bridgeVlans.length,
					ctx.bridgeVlans.slice().sort(function(a, b) { return a - b; }).join(', ')
				);
			else
				vlanCatalog.textContent = _('No VLANs configured — add at least one ID above.');

			renderVlanMaintTable();
			refillNativeSelect();
			resyncDdListeners();
			previewLine();
		}

		/* ---- VLAN add / remove ------------------------------------------ */

		function addBridgeVlan(vid, optLabelNote) {
			if (ctx.bridgeVlans.indexOf(vid) !== -1) {
				ui.addNotification(null, E('p', _('VLAN %d is already configured.').format(vid)));
				return false;
			}

			ctx.bridgeVlans.push(vid);
			ctx.bridgeVlans.sort(function(a, b) { return a - b; });
			ctx.localByVid[String(vid)] = '1';

			const t = String(optLabelNote || '').trim();

			if (t)
				scLbl.setVlanLabel(vid, t)
					.then(updateVlanCatalogueUi)
					.catch(function(e) {
						ui.addNotification(null, E('p', [ e ]));
						updateVlanCatalogueUi();
					});
			else
				updateVlanCatalogueUi();

			return true;
		}

		function removeBridgeVlan(vid) {
			const ix = ctx.bridgeVlans.indexOf(vid);

			if (ix === -1)
				return;

			ctx.bridgeVlans.splice(ix, 1);
			delete ctx.localByVid[String(vid)];
			stripVidFromAllPorts(vid);
			updateVlanCatalogueUi();
		}

		/* ---- save / reset ----------------------------------------------- */

		function gatherLabelDraftSpecs() {
			const portSpecs = [];

			for (let pi = 0; pi < ctx.ports.length; pi++) {
				const p = ctx.ports[pi];

				if (p._portLabelInp)
					portSpecs.push({ port: p.id, label: p._portLabelInp.value });
			}

			const vlanSpecs = [];

			vlanTbody.querySelectorAll('tr').forEach(function(tr) {
				const tds = tr.querySelectorAll('td');

				if (tds.length < 2)
					return;

				const vidTxt = String(tds[0].textContent || '').trim();
				const inp = tds[1].querySelector('input.scp-vlan-label');

				if (!/^[1-9][0-9]*$/.test(vidTxt) || !inp)
					return;

				vlanSpecs.push({ vlan: vidTxt, label: inp.value });
			});

			return { portSpecs: portSpecs, vlanSpecs: vlanSpecs };
		}

		function commitToPorts(applyAfterSave) {
			const drafts = gatherLabelDraftSpecs();

			scLbl.syncAllDraftLabels(drafts.portSpecs, drafts.vlanSpecs).then(function() {
				const hv = selectedTiles();

				if (!hv.length) {
					scLbl.pruneSwitchconfigLabels(
						ctx.ports.map(function(p) { return p.id; }),
						ctx.bridgeVlans
					);

					return uci.save().then(function() {
						ui.addNotification(null, E('p', _('LuCI annotations saved (port and VLAN labels).')));

						if (applyAfterSave)
							ui.changes.apply(false);
					});
				}

				const tagStr = vidsTagged().map(String).join(' ');

				for (let i = 0; i < hv.length; i++) {
					const rec = ctx.ports.filter(function(p) { return p.id === hv[i]; })[0];

					if (!rec)
						continue;

					rec.native = selNative.value || '';
					rec.tagged = tagStr;
					refreshPortTile(rec);
				}

				clearTaggedMenu();
				flushBridgeVlanUci(bridge, ctx);

				return uci.save().then(function() {
					scLbl.pruneSwitchconfigLabels(
						ctx.ports.map(function(p) { return p.id; }),
						ctx.bridgeVlans
					);

					return uci.save();
				}).then(function() {
					ui.addNotification(null, E('p', _('Network configuration saved.')));

					if (applyAfterSave)
						ui.changes.apply(false);
				});
			}).catch(function(err) {
				ui.addNotification(null, E('p', [ err ]));
			});

			previewLine();
		}

		function resetAll() {
			ctx.bridgeVlans = initial.bridgeVlans.slice();
			ctx.localByVid  = Object.assign({}, initial.localByVid);

			for (let i = 0; i < initial.ports.length; i++) {
				const src = initial.ports[i];
				const p   = ctx.ports[i];

				p.native = src.native;
				p.tagged = src.tagged;
				refreshPortTile(p);
			}

			selNative.value = '';
			clearTaggedMenu();

			document.querySelectorAll('.switchconfig-pc .pc-chip.selected').forEach(function(z) {
				z.classList.remove('selected');
			});

			/* Flush UCI so the model matches the reset state */
			flushBridgeVlanUci(bridge, ctx);

			updateVlanCatalogueUi();

			const pm = scLbl.getPortLabelMap();

			for (let ri = 0; ri < ctx.ports.length; ri++) {
				const pr = ctx.ports[ri];

				if (pr._portLabelInp)
					pr._portLabelInp.value = pm[pr.id] || '';
			}
		}

		/* ---- event: VLAN table remove button ---------------------------- */

		vlanTbody.addEventListener('click', function(ev) {
			const b = ev.target && ev.target.closest
				? ev.target.closest('button[data-remove-vid]')
				: null;

			if (!b)
				return;

			ev.preventDefault();
			removeBridgeVlan(+b.getAttribute('data-remove-vid'));
		});

		/* ---- build port chips ------------------------------------------- */

		for (let i = 0; i < ctx.ports.length; i++) {
			const pc = ctx.ports[i];
			const el = E('div', {
				'class': 'pc-chip',
				'data-port': pc.id,
				'click': function(ev) {
					ev.preventDefault();
					el.classList.toggle('selected');
					previewLine();
				}
			});

			const nt    = E('div',   { 'class': 'pc-name' }, [ pc.id ]);
			const plInp = E('input', {
				'type': 'text',
				'class': 'pc-port-label',
				'placeholder': _('Label'),
				'value': portLabelMap[pc.id] || '',
				'title': _('Optional note stored in /etc/config/luci (not applied to bridge VLAN settings).')
			});

			plInp.addEventListener('click',    function(ev) { ev.stopPropagation(); });
			plInp.addEventListener('mousedown', function(ev) { ev.stopPropagation(); });
			plInp.addEventListener('keydown',   function(ev) { ev.stopPropagation(); });
			plInp.addEventListener('change', function() {
				scLbl.setPortLabel(pc.id, plInp.value).catch(function(e) {
					ui.addNotification(null, E('p', [ e ]));
				});
			});

			pc._portLabelInp = plInp;

			const lk = E('span', { 'class': 'pc-link' });
			const sx = E('div',  { 'class': 'pc-sum' });

			pc._link = lk;
			pc._sx   = sx;

			el.append(nt, plInp, lk, sx);
			portFarm.appendChild(el);
			refreshPortTile(pc);
		}

		/* ---- global click: close open dropdowns ------------------------- */

		selNative.addEventListener('change', previewLine);

		/* Use capturing on document to avoid stacking listeners on re-render */
		const closeDropdowns = function() {
			document.querySelectorAll('.switchconfig-pc [data-dd].open').forEach(function(x) {
				x.classList.remove('open');
			});
		};

		document.addEventListener('click', closeDropdowns);

		/* ---- VLAN add controls ------------------------------------------ */

		const vlanAddInput = E('input', {
			'type': 'number',
			'id': 'scp-vlan-add',
			'min': 1,
			'max': 4094,
			'step': 1
		});

		const vlanAddLabelInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text scp-vlan-add-label',
			'id': 'scp-vlan-add-label',
			'placeholder': _('Label (optional)'),
			'title': _('Optional note in /etc/config/luci, same as the catalogue table column.')
		});

		function submitNewVlan(ev) {
			if (ev && ev.preventDefault)
				ev.preventDefault();

			const v = +vlanAddInput.value;

			if (!(v >= 1 && v <= 4094)) {
				ui.addNotification(null, E('p', _('Enter a VLAN ID between 1 and 4094.')));
				vlanAddInput.focus();
				return;
			}

			if (addBridgeVlan(v, vlanAddLabelInput.value)) {
				vlanAddInput.value      = '';
				vlanAddLabelInput.value = '';
				vlanAddInput.focus();
			}
		}

		function vlanAddKey(ev) {
			if (ev.key === 'Enter') {
				ev.preventDefault();
				submitNewVlan(ev);
			}
		}

		vlanAddInput.addEventListener('keydown', vlanAddKey);
		vlanAddLabelInput.addEventListener('keydown', vlanAddKey);

		const btnAddVlan = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-add',
			'id': 'scp-vlan-add-btn',
			'click': submitNewVlan
		}, [ _('Add') ]);

		/* ---- assemble the view ------------------------------------------ */

		const root = E('div', { 'class': 'switchconfig-pc' }, [
			E('h2', { 'name': 'content' }, [ _('Switch config') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				E('p', {}, [
					_('Port-centric VLAN management for bridge "%h".').format(bridge)
				]),
				E('p', { 'class': 'cbi-section-descr' }, [
					_('Optional port and VLAN labels.')
				])
			]),
			E('fieldset', { 'class': 'cbi-section' }, [
				E('legend', {}, [ _('Port membership(s)') ]),
				portFarm
			]),
			E('fieldset', { 'class': 'cbi-section vlan-maint-section' }, [
				E('legend', {}, [ _('VLANs') ]),
				E('p', { 'class': 'cbi-section-descr' }, [
					_('Add or remove VLAN IDs. Removing a VLAN strips it from all ports. Use the dock below to assign native (untagged) and tagged memberships.')
				]),
				vlanCatalog,
				E('div', { 'class': 'cbi-value vlan-maint-add' }, [
					E('span', { 'class': 'cbi-value-title' }, [ _('Add VLAN ID') ]),
					E('div',  { 'class': 'cbi-value-field' }, [ vlanAddInput, vlanAddLabelInput, btnAddVlan ])
				]),
				E('table', { 'class': 'table', 'id': 'scp-vlan-table' }, [
					E('thead', {}, [ E('tr', {}, [
						E('th', { 'class': 'th' }, [ _('VLAN ID') ]),
						E('th', { 'class': 'th' }, [ _('Label (note)') ]),
						E('th', { 'class': 'th' }, [ ' ' ])
					]) ]),
					vlanTbody
				])
			]),
			E('div', { 'class': 'assign-dock' }, [
				E('div', { 'class': 'container' }, [
					E('fieldset', { 'class': 'cbi-section' }, [
						E('p', { 'class': 'cbi-section-descr' }, [
							_('Selected: '), selCount, ' ', _('port(s)')
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('span', { 'class': 'cbi-value-title', 'id': 'scp-dock-title-native' }, [ _('Untagged / native VLAN') ]),
							E('div',  { 'class': 'cbi-value-field' }, [
								E('span', { 'class': 'cbi-select' }, [ selNative ])
							])
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('span', { 'class': 'cbi-value-title', 'id': 'scp-dock-title-tagged' }, [ _('Tagged VLANs') ]),
							E('div',  { 'class': 'cbi-value-field' }, [ ddWrap ])
						]),
						E('div', { 'class': 'assign-dock-tools' }, [
							E('button', {
								'type': 'button',
								'class': 'cbi-button',
								'id': 'scp-btn-strip',
								'title': _('Clear native VLAN and all tagged VLANs on selected ports. Choose Save or Save & Apply to write UCI.'),
								'click': function(ev) {
									ev.preventDefault();

									const sel = selectedTiles();

									if (!sel.length) {
										ui.addNotification(null, E('p', _('Select at least one port first.')));
										return;
									}

									for (let i = 0; i < sel.length; i++) {
										const rec = ctx.ports.filter(function(p) { return p.id === sel[i]; })[0];

										if (!rec)
											continue;

										rec.native = '';
										rec.tagged = '';
										refreshPortTile(rec);
									}

									selNative.value = '';
									clearTaggedMenu();
									previewLine();
								}
							}, [ _('Strip all VLAN memberships from selected ports') ]),
							E('button', {
								'type': 'button',
								'class': 'cbi-button',
								'id': 'scp-btn-clear-sel',
								'click': function(ev) {
									ev.preventDefault();
									document.querySelectorAll('.switchconfig-pc .pc-chip.selected').forEach(function(z) {
										z.classList.remove('selected');
									});
									previewLine();
								}
							}, [ _('Clear port selection') ])
						]),
						preview
					]),
					E('div', { 'class': 'cbi-page-actions' }, [
						E('button', {
							'type': 'button',
							'class': 'cbi-button cbi-button-apply important',
							'id': 'scp-save-apply',
							'click': function(ev) {
								ev.preventDefault();
								commitToPorts(true);
							}
						}, [ _('Save & Apply') ]),
						E('button', {
							'type': 'button',
							'class': 'cbi-button cbi-button-save',
							'id': 'scp-save',
							'click': function(ev) {
								ev.preventDefault();
								commitToPorts(false);
							}
						}, [ _('Save') ]),
						E('button', {
							'type': 'button',
							'class': 'cbi-button cbi-button-reset',
							'id': 'scp-reset',
							'click': function(ev) {
								ev.preventDefault();
								resetAll();
							}
						}, [ _('Reset') ])
					])
				])
			])
		]);

		updateVlanCatalogueUi();

		window.requestAnimationFrame(function() {
			for (let i = 0; i < ctx.ports.length; i++) {
				const p = ctx.ports[i];

				if (ndm[p.id])
					refreshPortTile(p);
			}
		});

		return root;
	}
});
