'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';
'require fs';

var callUciCommit = rpc.declare({
	object: 'uci',
	method: 'commit',
	params: [ 'config' ]
});

var callLuciSetPassword = rpc.declare({
	object: 'luci',
	method: 'setPassword',
	params: [ 'username', 'password' ],
	reject: true
});

var callSystemValidateFirmwareImage = rpc.declare({
	object: 'system',
	method: 'validate_firmware_image',
	params: [ 'path' ],
	reject: true
});

var cbiPasswordStrengthIndicator = form.DummyValue.extend({
	setStrength: function(section_id, password) {
		var node = this.map.findElement('id', this.cbid(section_id)),
		    segments = node ? node.firstElementChild.childNodes : [],
		    colors = [ '#d44', '#d84', '#ee4', '#4e4' ],
		    labels = [ _('too short', 'Password strength'), _('weak', 'Password strength'), _('medium', 'Password strength'), _('strong', 'Password strength') ],
		    strongRegex = new RegExp('^(?=.{8,})(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*\\W).*$', 'g'),
		    mediumRegex = new RegExp('^(?=.{7,})(((?=.*[A-Z])(?=.*[a-z]))|((?=.*[A-Z])(?=.*[0-9]))|((?=.*[a-z])(?=.*[0-9]))).*$', 'g'),
		    enoughRegex = new RegExp('(?=.{6,}).*', 'g'),
		    strength;

		if (strongRegex.test(password))
			strength = 3;
		else if (mediumRegex.test(password))
			strength = 2;
		else if (enoughRegex.test(password))
			strength = 1;
		else
			strength = 0;

		for (var i = 0; i < segments.length; i++)
			segments[i].style.background = (i <= strength) ? colors[strength] : '';

		if (node)
			node.lastElementChild.firstChild.data = labels[strength];
	},

	renderWidget: function(section_id, option_index, cfgvalue) {
		return E('div', { 'id': this.cbid(section_id), 'style': 'display:flex' }, [
			E('div', { 'style': 'align-self:center; display:flex; border:1px solid #aaa; height:.4rem; width:200px; margin:.2rem' }, [
				E('div', { 'style': 'flex:1 1 25%; border-right:1px solid #aaa' }),
				E('div', { 'style': 'flex:1 1 25%; border-right:1px solid #aaa' }),
				E('div', { 'style': 'flex:1 1 25%; border-right:1px solid #aaa' }),
				E('div', { 'style': 'flex:1 1 25%' })
			]),
			E('span', { 'style': 'margin-left:.5rem' }, [ '' ])
		]);
	}
});

var cbiClickableCheckbox = form.Flag.extend({
	renderWidget: function(/* ... */) {
		var w = this.super('renderWidget', arguments);

		if (typeof(this.onclick) == 'function')
			w.querySelector('input[type="checkbox"]').addEventListener('click', this.onclick);

		return w;
	}
});

function showProgress(text, ongoing) {
	var dlg = ui.showModal(null, [
		E('p', ongoing ? { 'class': 'spinning' } : {}, [ text ])
	]);

	dlg.removeChild(dlg.firstElementChild);

	if (!ongoing) {
		window.setTimeout(function() {
			ui.hideIndicator('uci-changes');
			ui.hideModal();
		}, 750);
	}
}


return view.extend({
	load: function() {
		return Promise.all([
			uci.load('firewall'),
			uci.load('uhttpd')
		]).then(function() {
			return Promise.all([
				L.resolveDefault(fs.stat(uci.get('uhttpd', 'main', 'cert')), {}),
				L.resolveDefault(fs.stat(uci.get('uhttpd', 'main', 'key')), {})
			]);
		});
	},

	handleChangePassword: function() {
		var formdata = { password: {} };
		var m, s, o;

		m = new form.JSONMap(formdata);
		s = m.section(form.NamedSection, 'password', 'password');

		o = s.option(form.Value, 'pw1', _('Enter new password'));
		o.password = true;
		o.validate = function(section_id, value) {
			this.section.children.filter(function(oo) { return oo.option == 'strength' })[0].setStrength(section_id, value);
			return true;
		};

		o = s.option(cbiPasswordStrengthIndicator, 'strength', ' ');

		o = s.option(form.Value, 'pw2', _('Confirm new password'));
		o.password = true;
		o.validate = function(section_id, value) {
			var other = this.section.children.filter(function(oo) { return oo.option == 'pw1' })[0].formvalue(section_id);

			if (other != value)
				return _('The given passwords do not match!');

			return true;
		};

		return m.render().then(L.bind(function(nodes) {
			ui.showModal(_('Change Login Password'), [
				nodes,
				E('div', { 'class': 'right' }, [
					E('button', {
						'click': ui.hideModal
					}, [ _('Cancel') ]),
					E('button', {
						'class': 'important',
						'click': ui.createHandlerFn(this, function(m) {
							return m.save(null, true).then(function() {
								showProgress(_('Setting login password…'), true);
								return callLuciSetPassword('root', formdata.password.pw1).then(function() {
									showProgress(_('Password has been changed.'), false);
								}).catch(function(err) {
									ui.hideModal();
									ui.addNotification(null, _('Unable to change the login password: %s').format(err))
								});
							}).catch(function() {
								var inval = nodes.querySelector('input.cbi-input-invalid');
								if (inval)
									inval.focus();
							});
						}, m)
					}, [ 'Change password' ])
				])
			]);
		}, this));
	},

	handleAllowGuestAccess: function(ev) {
		if (ev.currentTarget.checked) {
			var section_id = uci.add('firewall', 'rule', 'luci_guest_access');
			uci.set('firewall', section_id, 'name', 'Allow access to LuCI from guest network');
			uci.set('firewall', section_id, 'src', 'guest');
			uci.set('firewall', section_id, 'proto', 'tcp');
			uci.set('firewall', section_id, 'dest_port', [ '80', '443' ]);
			uci.set('firewall', section_id, 'target', 'ACCEPT');

			showProgress(_('Enabling guest network access…'), true);

			return uci.save().then(function() {
				return callUciCommit('firewall').then(function() {
					showProgress(_('Guest network access enabled.'), false);
				});
			});
		}
		else {
			uci.remove('firewall', 'luci_guest_access');

			showProgress(_('Disabling guest network access…'), true);

			return uci.save().then(function() {
				return callUciCommit('firewall').then(function() {
					showProgress(_('Guest network access disabled.'), false);
				});
			});
		}
	},

	handleEnforceHTTPS: function(ev) {
		var en = ev.currentTarget.checked;

		uci.set('uhttpd', 'main', 'redirect_https', en ? '1' : null);

		showProgress(en ? _('Enforcing HTTPS access…') : _('Making HTTPS access optional…'), true);

		return uci.save().then(function() {
			return callUciCommit('uhttpd').then(function() {
				showProgress(en ? _('HTTPS access enforced.') : _('HTTPS access made optional.'), false);
			});
		});
	},

	handleFirmwareFlash: function(ev) {
		return ui.uploadFile('/tmp/firmware.bin').then(function(res) {
			showProgress(_('Validating image…'), true);

			return callSystemValidateFirmwareImage('/tmp/firmware.bin');
		}).then(function(res) {
			if (!res.valid) {
				showProgress(_('The uploaded firmware image is invalid!'), false);
				return L.resolveDefault(fs.remove('/tmp/firmware.bin'));
			}

			var m, s, o;
			var formdata = { settings: { keep: res.allow_backup ? '1' : null } };

			m = new form.JSONMap(formdata);
			s = m.section(form.NamedSection, 'settings', 'settings');

			if (res.allow_backup) {
				o = s.option(form.Flag, 'keep', _('Keep current system settings over reflash'));
			}
			else {
				o = s.option(form.DummyValue, 'keep');
				o.default = '<em>%h</em>'.format(_('System settings will be reset to factory defaults.'));
				o.rawhtml = true;
			}

			return m.render().then(function(nodes) {
				ui.showModal('Confirm Firmware Flash', [
					E('p', [ _('The uploaded file contains a valid firmware image. Press "Continue" below to start the flash process.') ]),
					nodes,
					E('div', { 'class': 'right' }, [
						E('button', {
							'click': ui.createHandlerFn({}, function() {
								return L.resolveDefault(fs.remove('/tmp/firmware.bin')).then(function() {
									showProgress(_('Upgrade process aborted.'), false);
								});
							})
						}, [ _('Cancel') ]),
						E('button', {
							'class': 'cbi-button-negative',
							'click': ui.createHandlerFn({}, function() {
								return m.save(null, true).then(function() {
									var keep = (formdata.settings.keep == '1'),
									    args = (keep ? [] : [ '-n' ]).concat([ '/tmp/firmware.bin' ]);

									fs.exec('/sbin/sysupgrade', args); /* does not return */

									showProgress(E([], [
										_('The firmware image is flashing now.'),
										E('br'),
										E('em', [ _('Do NOT power off the device until the process is complete!') ])
									]), true);

									window.setTimeout(function() {
										/* FIXME: clarify default IP / domainname */
										ui.awaitReconnect.apply(ui, keep ? [ window.location.host ] : [ '192.168.1.1', 'openwrt.lan', 'prplwrt.lan' ]);
									}, 3000);
								});
							})
						}, [ _('Continue') ])
					])
				]);
			});
		}).catch(function(err) {
			showProgress(_('Firmware upload failed.'), false);
			ui.addNotification(null, _('Unable to upload firmware image: %s').format(err));
		});
	},

	handleSettingsReset: function(ev) {
		ui.showModal(_('Confirm Reset'), [
			E('p', [ _('Do you really want to reset all system settings?') ]),
			E('p', [
				E('em', [  _('Any changes made, including wireless passwords, DHCP reservations, block rules etc. will be erased!') ])
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'click': ui.hideModal }, [ _('Cancel') ]),
				E('button', {
					'class': 'cbi-button-negative',
					'click': function() {
						showProgress(_('Resetting system configuration…'), true);

						fs.exec('/sbin/firstboot', [ '-r', '-y' ]).then(function() {
							ui.awaitReconnect();
						}).catch(function(err) {
							showProgress(_('Reset command failed.'), false);
							ui.addNotification(null, _('Unable to execute reset command: %s').format(err));
						});
					}
				}, [ _('Reset') ])
			])
		]);
	},

	handleReboot: function(ev) {
		ui.showModal(_('Confirm Reboot'), [
			E('p', [ _('Do you really want to reboot the device?') ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'click': ui.hideModal }, [ _('Cancel') ]),
				E('button', {
					'class': 'important',
					'click': function() {
						showProgress(_('Rebooting device…'), true);

						fs.exec('/sbin/reboot').then(function() {
							ui.awaitReconnect();
						}).catch(function(err) {
							showProgress(_('Reboot command failed.'), false);
							ui.addNotification(null, _('Unable to execute reboot command: %s').format(err));
						});
					}
				}, [ _('Reboot') ])
			])
		]);
	},

	render: function(cert_key) {
		var m, s, o;
		var formdata = {
			access: {
				guest_access: (uci.get('firewall', 'luci_guest_access') != null) ? '1' : '0',
				require_ssl: (uci.get('uhttpd', 'main', 'redirect_https') == '1') ? '1' : '0'
			},
			maintenance: {}
		};

		m = new form.JSONMap(formdata, _('System'));
		m.tabbed = true;

		s = m.section(form.NamedSection, 'access', 'access', _('Administrative Access'));

		o = s.option(form.Button, 'password', _('Set login password'));
		o.inputtitle = _('Change password…');
		o.onclick = ui.createHandlerFn(this, 'handleChangePassword');

		o = s.option(cbiClickableCheckbox, 'guest_access', _('Allow access from guest network'));
		o.onclick = ui.createHandlerFn(this, 'handleAllowGuestAccess');

		o = s.option(cbiClickableCheckbox, 'require_ssl', _('Enforce HTTPS access'));
		o.readonly = (cert_key[0].type != 'file' || cert_key[1].type != 'file');
		o.onclick = o.readonly ? null : ui.createHandlerFn(this, 'handleEnforceHTTPS');

		s = m.section(form.NamedSection, 'maintenance', 'maintenance', _('System Maintenance'));

		o = s.option(form.Button, 'upgrade', _('Flash device firmware'));
		o.inputtitle = _('Upload firmware image…');
		o.onclick = ui.createHandlerFn(this, 'handleFirmwareFlash');

		o = s.option(form.Button, 'reset', _('Reset system settings'));
		o.inputtitle = _('Restore system defaults…');
		o.onclick = ui.createHandlerFn(this, 'handleSettingsReset');

		o = s.option(form.Button, 'reboot', _('Restart device'));
		o.inputtitle = _('Reboot…');
		o.onclick = ui.createHandlerFn(this, 'handleReboot');

		return m.render();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
