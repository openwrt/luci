'use strict';
// SPDX-License-Identifier: GPL-2.0-or-later
'require view';
'require rpc';
'require ui';
'require poll';

var callStatus = rpc.declare({
	object: '51sdwan',
	method: 'status',
	expect: { '': {} }
});

var callLoginStart = rpc.declare({
	object: '51sdwan',
	method: 'login_start',
	params: [ 'account', 'password' ],
	expect: { '': {} }
});

var callLoginStatus = rpc.declare({
	object: '51sdwan',
	method: 'login_status',
	params: [ 'job_id' ],
	expect: { '': {} }
});

var callConnect = rpc.declare({ object: '51sdwan', method: 'connect', expect: { '': {} } });
var callDisconnect = rpc.declare({ object: '51sdwan', method: 'disconnect', expect: { '': {} } });
var callLogout = rpc.declare({ object: '51sdwan', method: 'logout', expect: { '': {} } });
var callSetMode = rpc.declare({
	object: '51sdwan',
	method: 'set_mode',
	params: [ 'mode' ],
	expect: { '': {} }
});

function safeText(value, fallback) {
	if (value === null || value === undefined || value === '')
		return String(fallback === undefined ? '-' : fallback);
	return String(value);
}

function bytes(value) {
	return '%1024mB'.format(Number(value || 0));
}

function formatTime(epoch) {
	if (!epoch)
		return _('No handshake yet');
	return new Date(Number(epoch) * 1000).toLocaleString();
}

return view.extend({
	load: function() {
		return callStatus();
	},

	request: function(promise, message) {
		ui.showModal(_('51SDWAN'), [
			E('p', { 'class': 'spinning' }, [ message || _('Processing, please wait…') ])
		]);
		return promise.then(function(result) {
			ui.hideModal();
			if (!result || result.ok === false)
				throw new Error(safeText(result && result.error, _('Operation failed')));
			ui.addNotification(null, E('p', {}, [ _('Operation completed') ]), 'info');
			window.setTimeout(function() { window.location.reload(); }, 350);
		}).catch(function(error) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, [ safeText(error && error.message, error) ]), 'error');
		});
	},

	waitForLogin: function(jobId) {
		return new Promise(function(resolve, reject) {
			var deadline = Date.now() + 180000;
			var check = function() {
				callLoginStatus(jobId).then(function(result) {
					if (!result || result.ok === false)
						reject(new Error(safeText(result && result.error, _('Login failed'))));
					else if (result.pending === true) {
						if (Date.now() >= deadline)
							reject(new Error(_('Login timed out; check the network and try again')));
						else
							window.setTimeout(check, 1500);
					}
					else
						resolve(result);
				}).catch(reject);
			};
			window.setTimeout(check, 800);
		});
	},

	renderLogin: function() {
		var account = E('input', {
			'class': 'cbi-input-text sdwan-input',
			'type': 'text',
			'placeholder': _('Phone number or email address'),
			'autocomplete': 'username'
		});
		var password = E('input', {
			'class': 'cbi-input-password sdwan-input',
			'type': 'password',
			'placeholder': _('Member account password'),
			'autocomplete': 'current-password'
		});
		var button = E('button', {
			'class': 'btn cbi-button cbi-button-action sdwan-primary',
			'click': ui.createHandlerFn(this, function() {
				var user = account.value.trim();
				if (!user || !password.value) {
					ui.addNotification(null, E('p', {}, [ _('Enter the member account and password') ]), 'warning');
					return;
				}
				var secret = password.value;
				var self = this;
				password.value = '';
				var login = callLoginStart(user, secret).then(function(result) {
					secret = '';
					if (!result || result.ok === false)
						throw new Error(safeText(result && result.error, _('Login failed')));
					return result.pending === true ? self.waitForLogin(result.job_id) : result;
				});
				return this.request(login, _('Verifying the account and connecting to the gateway…'));
			})
		}, [ _('Log in and connect') ]);

		return E('div', { 'class': 'sdwan-login-card' }, [
			E('div', { 'class': 'sdwan-login-copy' }, [
				E('span', { 'class': 'sdwan-eyebrow' }, [ _('MEMBER ACCESS') ]),
				E('h2', {}, [ _('Log in to 51SDWAN') ]),
				E('p', {}, [ _('Use an existing member account. The router is enrolled as a subscription device and receives its assigned gateway automatically.') ])
			]),
			E('div', { 'class': 'sdwan-login-form' }, [
				E('label', {}, [ _('Member account') ]), account,
				E('label', {}, [ _('Password') ]), password,
				button,
				E('small', {}, [ _('The password is used only for this login request and is not stored on the router.') ])
			])
		]);
	},

	renderDashboard: function(data) {
		var connected = data.connected === true;
		var mode = data.mode || 'smart';
		var nodes = this.statusNodes = {};
		var modeSelect = E('select', {
			'class': 'cbi-input-select',
			'change': ui.createHandlerFn(this, function(ev) {
				return this.request(callSetMode(ev.target.value), _('Switching acceleration mode…'));
			})
		}, [
			E('option', { 'value': 'smart', 'selected': mode === 'smart' ? '' : null }, [ _('Smart acceleration (domestic routes direct)') ]),
			E('option', { 'value': 'global', 'selected': mode === 'global' ? '' : null }, [ _('Global acceleration (all IPv4 traffic)') ])
		]);
		var action = E('button', {
			'class': 'btn cbi-button ' + (connected ? 'cbi-button-negative' : 'cbi-button-action') + ' sdwan-connect',
			'click': ui.createHandlerFn(this, function() {
				return this.request(
					connected ? callDisconnect() : callConnect(),
					connected ? _('Disconnecting safely…') : _('Establishing the secure tunnel…')
				);
			})
		}, [ connected ? _('Disconnect') : _('Start acceleration') ]);

		var logout = E('button', {
			'class': 'btn cbi-button sdwan-logout',
			'click': ui.createHandlerFn(this, function() {
				return ui.showModal(_('Log out of 51SDWAN'), [
					E('p', {}, [ _('Logging out stops acceleration but does not delete the device record from the member portal.') ]),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]),
						E('button', {
							'class': 'btn cbi-button-negative',
							'click': ui.createHandlerFn(this, function() {
								ui.hideModal();
								return this.request(callLogout(), _('Logging out…'));
							})
						}, [ _('Confirm logout') ])
					])
				]);
			})
		}, [ _('Log out') ]);

		nodes.gateway = E('b', {}, [ safeText(data.gateway) ]);
		nodes.tunnel = E('b', {}, [ safeText(data.tunnel_ip) ]);
		nodes.handshake = E('b', {}, [ formatTime(data.latest_handshake) ]);
		nodes.traffic = E('b', {}, [ _('Down %s / Up %s').format(bytes(data.rx_bytes), bytes(data.tx_bytes)) ]);
		nodes.account = E('div', { 'class': 'cbi-value-field' }, [ safeText(data.account) ]);
		nodes.version = E('div', { 'class': 'cbi-value-field' }, [ safeText(data.version) ]);

		return E('div', {}, [
			E('section', { 'class': 'sdwan-status-card ' + (connected ? 'is-connected' : '') }, [
				E('div', { 'class': 'sdwan-status-top' }, [
					E('span', { 'class': 'sdwan-state-dot' }),
					E('span', {}, [ connected ? _('Secure tunnel established') : _('Device logged in and ready to connect') ])
				]),
				E('div', { 'class': 'sdwan-status-body' }, [
					E('div', {}, [
						E('h2', {}, [ connected ? _('Accelerating') : _('Not connected') ]),
						E('p', {}, connected
							? [ safeText(data.gateway, _('51SDWAN gateway')), ' · ', safeText(data.tunnel_ip) ]
							: [ _('Start acceleration to route LAN devices through the assigned gateway.') ])
					]), action
				])
			]),
			data.error ? E('div', { 'class': 'alert-message warning' }, [ safeText(data.error) ]) : '',
			E('div', { 'class': 'sdwan-grid' }, [
				E('section', { 'class': 'cbi-section sdwan-panel' }, [
					E('h3', {}, [ _('Connection settings') ]),
					E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, [ _('Acceleration mode') ]), E('div', { 'class': 'cbi-value-field' }, [ modeSelect ]) ]),
					E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, [ _('Member account') ]), nodes.account ]),
					E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, [ _('Client version') ]), nodes.version ])
				]),
				E('section', { 'class': 'cbi-section sdwan-panel' }, [
					E('h3', {}, [ _('Tunnel status') ]),
					E('div', { 'class': 'sdwan-stat-row' }, [ E('span', {}, [ _('Gateway') ]), nodes.gateway ]),
					E('div', { 'class': 'sdwan-stat-row' }, [ E('span', {}, [ _('Tunnel address') ]), nodes.tunnel ]),
					E('div', { 'class': 'sdwan-stat-row' }, [ E('span', {}, [ _('Latest handshake') ]), nodes.handshake ]),
					E('div', { 'class': 'sdwan-stat-row' }, [ E('span', {}, [ _('Tunnel traffic') ]), nodes.traffic ])
				])
			]),
			E('div', { 'class': 'sdwan-footer-actions' }, [ logout ])
		]);
	},

	updateDashboard: function(data) {
		var nodes = this.statusNodes;
		if (!nodes)
			return;
		nodes.gateway.textContent = safeText(data.gateway);
		nodes.tunnel.textContent = safeText(data.tunnel_ip);
		nodes.handshake.textContent = formatTime(data.latest_handshake);
		nodes.traffic.textContent = _('Down %s / Up %s').format(bytes(data.rx_bytes), bytes(data.tx_bytes));
		nodes.account.textContent = safeText(data.account);
		nodes.version.textContent = safeText(data.version);
	},

	render: function(data) {
		var self = this;
		this.lastStatus = data || {};
		var page = E('div', { 'class': 'cbi-map sdwan-page' }, [
			E('style', {}, [ '\
.sdwan-page{max-width:1120px;color-scheme:light dark}.sdwan-hero{margin-bottom:18px;padding:24px 28px;border-radius:18px;background:linear-gradient(125deg,#062f43,#087f84);color:#fff;display:flex;align-items:center;gap:16px}.sdwan-logo{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#18d7c0,#3b9dff);display:grid;place-items:center;font-size:21px;font-weight:800}.sdwan-hero h1{margin:0 0 4px;color:#fff}.sdwan-hero p{margin:0;color:#b5dce1}.sdwan-eyebrow{font-size:11px;letter-spacing:2px;color:#13bda9}.sdwan-login-card{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:28px;border:1px solid var(--border-color-medium,#ddd);border-radius:16px;background:var(--background-color-high,#fff);color:var(--text-color-highest,#000)}.sdwan-login-copy{padding:18px}.sdwan-login-copy h2{font-size:26px;margin:10px 0}.sdwan-login-copy p{color:var(--text-color-medium,#808080);line-height:1.7}.sdwan-login-form{display:grid;gap:9px;padding:22px;border-radius:14px;background:var(--background-color-medium,#f9f9f9)}.sdwan-login-form label{font-weight:600}.sdwan-input{box-sizing:border-box;width:100%;min-height:44px}.sdwan-primary{margin-top:8px;min-height:44px}.sdwan-login-form small{color:var(--text-color-medium,#808080);text-align:center}.sdwan-status-card{padding:22px 26px;border-radius:18px;background:linear-gradient(125deg,#082f43,#0a6570);color:#fff;box-shadow:0 8px 24px rgba(4,45,64,.16)}.sdwan-status-card.is-connected{background:linear-gradient(125deg,#06364b,#078b83)}.sdwan-status-top{display:flex;align-items:center;gap:8px;color:#bcebe5;font-size:13px}.sdwan-state-dot{width:9px;height:9px;border-radius:50%;background:#ffbd50}.is-connected .sdwan-state-dot{background:#18d7c0;box-shadow:0 0 0 5px rgba(24,215,192,.15)}.sdwan-status-body{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:18px}.sdwan-status-body h2{margin:0 0 6px;color:#fff;font-size:27px}.sdwan-status-body p{margin:0;color:#b9dadd}.sdwan-connect{min-width:150px;min-height:44px}.sdwan-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.sdwan-panel{margin:0!important;border:1px solid var(--border-color-medium,#ddd);border-radius:14px;background:var(--background-color-high,#fff);box-shadow:none}.sdwan-panel h3{margin-top:0}.sdwan-stat-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--border-color-low,#eee)}.sdwan-stat-row:last-child{border:0}.sdwan-stat-row span{color:var(--text-color-medium,#808080)}.sdwan-stat-row b{text-align:right}.sdwan-footer-actions{display:flex;justify-content:flex-end;margin-top:12px}.sdwan-logout{color:var(--text-color-medium,#808080)}@media(max-width:700px){.sdwan-login-card,.sdwan-grid{grid-template-columns:1fr}.sdwan-login-copy{padding:4px}.sdwan-status-body{align-items:stretch;flex-direction:column}.sdwan-connect{width:100%}}\
' ]),
			E('section', { 'class': 'sdwan-hero' }, [
				E('div', { 'class': 'sdwan-logo' }, [ '51' ]),
				E('div', {}, [ E('h1', {}, [ _('51SDWAN') ]), E('p', {}, [ _('OpenWrt private-line access and smart acceleration') ]) ])
			]),
			data && data.configured ? this.renderDashboard(data) : this.renderLogin()
		]);

		poll.add(function() {
			return callStatus().then(function(next) {
				var previous = self.lastStatus || {};
				if (!!next.connected !== !!previous.connected ||
					!!next.configured !== !!previous.configured ||
					next.error !== previous.error || next.mode !== previous.mode) {
					window.location.reload();
					return;
				}
				self.lastStatus = next;
				self.updateDashboard(next);
			});
		}, 5);
		return page;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
