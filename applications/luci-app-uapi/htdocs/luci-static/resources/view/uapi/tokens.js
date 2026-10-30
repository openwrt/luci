'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require uapi.helpers as h';

const callListTokens = rpc.declare({
	object: 'luci.uapi',
	method: 'list_tokens'
});

const callCreateToken = rpc.declare({
	object: 'luci.uapi',
	method: 'create_token',
	params: [ 'name', 'scopes', 'expires_in_seconds', 'allowed_cidrs', 'rate', 'burst', 'force' ]
});

const callRevokeToken = rpc.declare({
	object: 'luci.uapi',
	method: 'revoke_token',
	params: [ 'name' ]
});

// Valid scopes come from the installed uapi (uapi-token scopes), so the picker
// matches whatever uapi version is present.
const callListScopes = rpc.declare({
	object: 'luci.uapi',
	method: 'list_scopes'
});

return view.extend({
	load: function () {
		return Promise.all([
			callListTokens(),
			callListScopes()
		]);
	},

	revoke: function (name) {
		const self = this;
		ui.showModal(_('Revoke token'), [
			E('p', {}, _('Permanently revoke token <strong>%h</strong>? Any client using it will be denied immediately.').format(name)),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': ui.createHandlerFn(this, function () {
						return callRevokeToken(name).then(function (res) {
							ui.hideModal();
							if (res && res.error)
								ui.addNotification(null, E('p', {}, [ res.error ]), 'error');
							return self.refresh();
						});
					})
				}, [ _('Revoke') ])
			])
		]);
	},

	showBearer: function (name, bearer) {
		ui.showModal(_('Token created'), [
			E('p', {}, _('Token <strong>%h</strong> was created. Copy the bearer value now: it is shown only once and cannot be retrieved again.').format(name)),
			E('div', { 'class': 'cbi-section' }, [
				E('textarea', {
					'readonly': 'readonly',
					'rows': 2,
					'wrap': 'off',
					'style': 'width:100%;font-family:monospace',
					'click': function (ev) { ev.target.select(); }
				}, [ bearer ])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button-action',
					'click': function () {
						navigator.clipboard && navigator.clipboard.writeText(bearer);
					}
				}, [ _('Copy') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-positive',
					'click': ui.hideModal
				}, [ _('Done') ])
			])
		]);
	},

	create: function () {
		const self = this;
		const known = this.knownScopes || [];

		// Plain DOM inputs (not ui.* widgets) so building the modal can never
		// throw a widget-API error: createHandlerFn swallows a synchronous throw
		// and leaves the button spinning forever, which reads as "nothing happens".
		const nameEl = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'terraform_prod' });
		const expiresEl = E('input', { 'type': 'number', 'min': '0', 'value': '0', 'class': 'cbi-input-text', 'style': 'width:6em' });
		const unitEl = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': '86400' }, [ _('days') ]),
			E('option', { 'value': '3600' }, [ _('hours') ]),
			E('option', { 'value': '60' }, [ _('minutes') ]),
			E('option', { 'value': '1' }, [ _('seconds') ])
		]);
		const cidrEl = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:100%', 'placeholder': '10.0.0.0/24, 192.168.1.0/24' });
		const rateEl = E('input', { 'type': 'number', 'min': '0', 'class': 'cbi-input-text', 'style': 'width:7em', 'placeholder': _('default') });
		const burstEl = E('input', { 'type': 'number', 'min': '0', 'class': 'cbi-input-text', 'style': 'width:7em', 'placeholder': _('default') });

		function splitList(s) {
			return (s || '').split(/[\s,]+/).filter(function (x) { return x.length; });
		}

		function field(label, node, help) {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ label ]),
				E('div', { 'class': 'cbi-value-field' }, [
					node,
					help ? E('div', { 'class': 'cbi-value-description' }, [ help ]) : ''
				])
			]);
		}

		// Scope picker driven by the installed uapi's own scope tree: one
		// none/read-only/read-write selector per resource, grouped by domain.
		// Falls back to a free-text field if the list could not be read.
		const selects = {};
		let scopeNode, collectScopes, scopeHelp;

		if (known.length) {
			scopeHelp = _('Grant read-only or read-write per resource (read-write includes read). At least one required.');
			const mkSelect = function (path) {
				const s = E('select', { 'class': 'cbi-input-select' }, [
					E('option', { 'value': '' }, [ _('(none)') ]),
					E('option', { 'value': 'ro' }, [ _('read-only') ]),
					E('option', { 'value': 'rw' }, [ _('read-write') ])
				]);
				selects[path] = s;
				return s;
			};
			const rowEl = function (path, label, indent) {
				return E('div', {
					'style': 'display:flex;align-items:center;justify-content:space-between;gap:1em;padding:3px 0' + (indent ? ';padding-left:1.5em' : '')
				}, [ E('code', {}, [ label ]), mkSelect(path) ]);
			};
			const box = E('div', {
				'style': 'max-height:38vh;overflow-y:auto;border:1px solid rgba(128,128,128,.35);border-radius:4px;padding:.4em .75em'
			});
			if (known.indexOf('*') >= 0)
				box.appendChild(rowEl('*', _('* (all resources)'), false));
			const groups = {}, order = [];
			known.forEach(function (p) {
				if (p === '*') return;
				const d = (p.indexOf(':') < 0) ? p : p.slice(0, p.indexOf(':'));
				if (!groups[d]) { groups[d] = []; order.push(d); }
				groups[d].push(p);
			});
			order.forEach(function (d) {
				box.appendChild(E('div', { 'style': 'font-weight:bold;margin:.6em 0 .15em' }, [ d ]));
				groups[d].sort().forEach(function (p) {
					box.appendChild(rowEl(p, (p === d) ? _('(entire domain)') : p.slice(d.length + 1), p !== d));
				});
			});
			scopeNode = box;
			collectScopes = function () {
				const out = [];
				for (const p in selects)
					if (selects[p].value) out.push(p + ':' + selects[p].value);
				return out;
			};
		} else {
			scopeHelp = _('Space- or comma-separated, e.g. "firewall:rw dhcp:ro" or "*:ro". At least one required.');
			const scopesEl = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:100%', 'placeholder': 'firewall:rw  *:ro' });
			scopeNode = scopesEl;
			collectScopes = function () { return splitList(scopesEl.value); };
		}

		ui.showModal(_('Create token'), [
			E('p', {}, [ _('Mints a bearer token via the uapi-token CLI. The cleartext value is shown once, at creation.') ]),
			field(_('Name'), nameEl, _('Letters, digits and underscores only.')),
			field(_('Scopes'), scopeNode, scopeHelp),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ _('Expires in') ]),
				E('div', { 'class': 'cbi-value-field', 'style': 'display:flex;gap:.5em;align-items:center' }, [
					expiresEl, unitEl, E('span', {}, [ _('(0 = never)') ])
				])
			]),
			field(_('Allowed source CIDRs'), cidrEl, _('Optional, space- or comma-separated. Restrict the token to these source networks.')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ _('Rate limit') ]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('div', { 'style': 'display:flex;gap:.5em;align-items:center' }, [
						E('span', {}, [ _('rate') ]), rateEl,
						E('span', {}, [ _('req/s, burst') ]), burstEl
					]),
					E('div', { 'class': 'cbi-value-description' }, [
						_('Optional per-token override of the global rate limit (uapi 3.0.0+). Leave blank to use the Settings value.')
					])
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-positive',
					'click': ui.createHandlerFn(this, function () {
						const name = (nameEl.value || '').trim();
						const scopes = collectScopes();
						const cidrs = splitList(cidrEl.value);
						const expires = (parseInt(expiresEl.value, 10) || 0) * (parseInt(unitEl.value, 10) || 1);

						if (!/^[A-Za-z0-9_]+$/.test(name)) {
							ui.addNotification(null, E('p', {}, [ _('A valid name is required (letters, digits, underscores).') ]), 'warning');
							return;
						}
						if (!scopes.length) {
							ui.addNotification(null, E('p', {}, [ _('Select at least one scope.') ]), 'warning');
							return;
						}

						const rate = parseInt(rateEl.value, 10) || 0;
						const burst = parseInt(burstEl.value, 10) || 0;

						return callCreateToken(name, scopes, expires, cidrs, rate, burst, false).then(function (res) {
							if (res && res.error) {
								ui.addNotification(null, E('p', {}, [ res.error ]), 'error');
								return;
							}
							// Reveal the once-only bearer before anything that can
							// fail; never gate it on the token-list refresh.
							ui.hideModal();
							self.showBearer(res.name, res.bearer);
							self.refresh();
						}).catch(function (e) {
							ui.addNotification(null, E('p', {}, [ _('Token creation failed: %s').format(e) ]), 'error');
						});
					})
				}, [ _('Create') ])
			])
		]);
	},

	renderTable: function (tokens) {
		const self = this;
		const rows = (tokens || []).map(function (t) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [
					E('strong', {}, [ t.name ]),
					t.expired ? E('span', { 'style': 'margin-left:.5em' }, [ h.warnBadge(_('expired')) ]) : ''
				]),
				E('td', { 'class': 'td' }, (t.scopes || []).map(function (s) {
					return E('code', { 'style': 'margin-right:.4em' }, [ s ]);
				})),
				E('td', { 'class': 'td' }, [ t.expires_at ? h.fmtTime(t.expires_at) : _('never') ]),
				E('td', { 'class': 'td' }, [ (t.allowed_cidrs && t.allowed_cidrs.length) ? t.allowed_cidrs.join(', ') : _('any') ]),
				E('td', { 'class': 'td' }, [ (t.rate || t.burst)
					? '%s/%s'.format(t.rate || _('default'), t.burst || _('default'))
					: _('default') ]),
				E('td', { 'class': 'td' }, [ t.last_used_at ? h.fmtTime(t.last_used_at) + (t.last_used_ip ? ' (' + t.last_used_ip + ')' : '') : _('never') ]),
				E('td', { 'class': 'td right' }, [
					E('button', {
						'class': 'btn cbi-button-negative',
						'click': ui.createHandlerFn(self, 'revoke', t.name)
					}, [ _('Revoke') ])
				])
			]);
		});

		if (!rows.length)
			rows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': 7 }, [ _('No tokens yet. Create one to start using the API.') ])
			]));

		return E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Name') ]),
				E('th', { 'class': 'th' }, [ _('Scopes') ]),
				E('th', { 'class': 'th' }, [ _('Expires') ]),
				E('th', { 'class': 'th' }, [ _('Allowed CIDRs') ]),
				E('th', { 'class': 'th' }, [ _('Rate limit') ]),
				E('th', { 'class': 'th' }, [ _('Last used') ]),
				E('th', { 'class': 'th right' }, [ _('Actions') ])
			])
		].concat(rows));
	},

	refresh: function () {
		const self = this;
		return callListTokens().then(function (res) {
			const container = document.getElementById('uapi-tokens');
			if (container)
				dom.content(container, self.renderTable((res || {}).tokens));
		}).catch(function (e) {
			ui.addNotification(null, E('p', {}, [ _('Failed to load tokens: %s').format(e) ]), 'error');
		});
	},

	render: function (data) {
		data = data || [];
		const tokens = (data[0] || {}).tokens;
		this.knownScopes = (data[1] || {}).scopes || [];

		return E('div', {}, [
			E('h2', {}, [ _('uAPI Tokens') ]),
			E('div', { 'class': 'cbi-section-descr' }, [
				_('Bearer tokens authenticate API clients. The cleartext value is shown only at creation; the router stores only a salted hash.')
			]),
			E('div', { 'style': 'margin-bottom:1em' }, [
				E('button', {
					'class': 'btn cbi-button-add',
					'click': ui.createHandlerFn(this, 'create')
				}, [ _('Create token') ])
			]),
			E('div', { 'id': 'uapi-tokens' }, [ this.renderTable(tokens) ])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
