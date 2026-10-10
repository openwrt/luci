'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';

var callGetCertStatus = rpc.declare({
	object: 'weechat',
	method: 'get_certificate_status',
	params: [ 'path' ],
	expect: { '': {} }
});

var callGenerateCert = rpc.declare({
	object: 'weechat',
	method: 'generate_certificate',
	params: [ 'cn', 'san', 'path' ],
	expect: { '': {} }
});

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

var callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ]
});

/* Mirrors check_path() in the init script, which refuses to start otherwise */
function validatePath(value, allowPercent) {
	if (!value)
		return true;
	if (value.charAt(0) !== '/' || /[\r\n]/.test(value) || /(^|\/)\.\.?(\/|$)/.test(value))
		return _('Must be an absolute path without . or .. components');
	if (value !== value.trim())
		return _('Must not start or end with a space');
	if (value.indexOf('${') !== -1)
		return _('Must not contain "${"');
	if (!allowPercent && value.indexOf('%') !== -1)
		return _('Must not contain "%"');
	return true;
}

/* WeeChat only reads the certificate when it starts, so restart a running relay */
function restartIfRunning() {
	return callServiceList('weechat').then(function(res) {
		var instances = (res && res.weechat && res.weechat.instances) || {};
		var running = Object.keys(instances).some(function(k) { return instances[k].running; });

		if (!running)
			return false;

		return callRcInit('weechat', 'restart').then(function(ret) {
			if (ret)
				throw new Error(_('Command failed with return code %d').format(ret));
			return true;
		});
	});
}

return view.extend({
	load: function() {
		return uci.load('weechat');
	},

	render: function() {
		var m, s, o;
		var defaultPath = '/etc/weechat/tls/relay.pem';
		var refreshCertStatus = null;

		/* Only certificates in this directory are checked and generated here */
		function isManagedPath(path) {
			return /^\/etc\/weechat\/tls\/[A-Za-z0-9._-]+\.pem$/.test(path) && path.indexOf('..') === -1;
		}

		/* IPv6 literals come with brackets, which are not valid in a SAN */
		var hostname = (window.location.hostname || 'OpenWrt').replace(/^\[(.*)\]$/, '$1');
		var defaultSan = hostname;

		m = new form.Map('weechat', _('WeeChat - Relay'),
			_('Configure the WeeChat relay and chat logging.'));

		/* Relay */
		s = m.section(form.NamedSection, 'weechat', 'weechat', _('Relay'));

		var optRelayEnabled = s.option(form.Flag, 'relay_enabled', _('Enable Relay Server'));
		optRelayEnabled.default = optRelayEnabled.disabled;
		optRelayEnabled.rmempty = false;

		o = s.option(form.Value, 'relay_address', _('Listen Address'),
			_('IP address to bind (leave empty for all interfaces). The address must exist when WeeChat starts.'));
		o.datatype = 'ipaddr("nomask")';
		o.placeholder = _('All interfaces');
		/* WeeChat cannot bind to it and the init script refuses it */
		o.validate = function(section_id, value) {
			var m = (value || '').match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
			if (m && m[1].split('.').some(function(p) { return p.length > 1 && p.charAt(0) === '0'; }))
				return _('Leading zeros are not allowed in an IPv4 address');
			return true;
		};
		o.rmempty = true;
		o.depends('relay_enabled', '1');

		o = s.option(form.Value, 'relay_port', _('Port'),
			_('Port for relay connections (WebSocket).'));
		o.datatype = 'and(port,min(1))';
		o.default = '9000';
		o.placeholder = '9000';
		o.depends('relay_enabled', '1');

		/* Security */
		s = m.section(form.NamedSection, 'weechat', 'weechat', _('Security'));

		o = s.option(form.Flag, 'relay_tls', _('Enable TLS'),
			_('Encrypt relay connections with TLS.'));
		o.default = o.disabled;

		var optCertKey = s.option(form.Value, 'relay_cert_key', _('Certificate'),
			_('PEM file containing the certificate and private key. It must be readable by the weechat user.'));
		optCertKey.placeholder = defaultPath;
		optCertKey.rmempty = true;
		optCertKey.depends('relay_tls', '1');
		optCertKey.validate = function(section_id, value) {
			return validatePath(value, true);
		};
		optCertKey.onchange = function() {
			if (refreshCertStatus)
				refreshCertStatus();
		};

		/* An empty field means the default path, as in the init script */
		function getActiveCertPath() {
			var val = optCertKey.formvalue('weechat');
			if (val == null)
				val = uci.get('weechat', 'weechat', 'relay_cert_key');
			return (val || '').trim() || defaultPath;
		}

		/* Certificate status widget */
		var optCertStatus = s.option(form.DummyValue, '_cert_status', _('Certificate status'));
		optCertStatus.depends('relay_tls', '1');

		optCertStatus.renderWidget = function(section_id, option_index, cfgvalue) {
			var container = E('div', { 'class': 'cbi-value-field' });
			var isReadonly = (this.readonly != null) ? this.readonly : this.map.readonly;

			function updateWidget(path) {
				while (container.firstChild)
					container.removeChild(container.firstChild);

				if (!isManagedPath(path)) {
					container.appendChild(E('div', { 'class': 'alert-message notice' },
						_('This certificate is managed outside of LuCI, so it is not checked here. The service refuses to start if the file does not exist.')));
					return;
				}

				container.appendChild(E('em', {}, _('Checking certificate status…')));

				callGetCertStatus(path || defaultPath).then(function(res) {
					while (container.firstChild)
						container.removeChild(container.firstChild);

					var elements = [];

					if (res && res.exists && res.has_cert && res.has_key) {
						elements.push(E('div', {}, [
							E('span', { 'class': 'label success' }, [ '● ', _('Certificate and key present') ])
						]));

						elements.push(E('p', { 'class': 'cbi-value-description' }, [
							E('strong', {}, _('File: ')),
							E('code', {}, res.path)
						]));

						elements.push(E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'type': 'button',
							'disabled': isReadonly || null,
							'click': function(ev) {
								ev.preventDefault();
								showGenerateDialog(getActiveCertPath(), res.generator_available);
							}
						}, _('Generate new certificate')));
					} else if (res && res.exists && (!res.has_cert || !res.has_key)) {
						elements.push(E('div', { 'class': 'alert-message warning' },
							_('Certificate file exists but is incomplete (must contain both certificate and private key).')));

						elements.push(E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'type': 'button',
							'disabled': isReadonly || null,
							'click': function(ev) {
								ev.preventDefault();
								showGenerateDialog(getActiveCertPath(), res.generator_available);
							}
						}, _('Generate self-signed certificate')));
					} else {
						elements.push(E('div', { 'class': 'alert-message warning' },
							_('TLS is enabled but no certificate file was found.')));

						elements.push(E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'type': 'button',
							'disabled': isReadonly || null,
							'click': function(ev) {
								ev.preventDefault();
								showGenerateDialog(getActiveCertPath(), res && res.generator_available);
							}
						}, _('Generate self-signed certificate')));
					}

					if (res && res.generator_available === false) {
						elements.push(E('div', { 'class': 'alert-message warning' },
							_('Certificate generation requires the %s or %s utility.').format('px5g', 'openssl')));
					}

					for (var i = 0; i < elements.length; i++)
						container.appendChild(elements[i]);
				}).catch(function(err) {
					while (container.firstChild)
						container.removeChild(container.firstChild);
					container.appendChild(E('div', { 'class': 'alert-message error' },
						_('Unable to verify certificate status: %s').format(err.message || err)));
				});
			}

			function showGenerateDialog(targetPath, generatorAvailable) {
				var inputCn, inputSan, btnGenerate, btnCancel, msgBox;

				var modalContent = [
					E('div', { 'class': 'alert-message notice' }, [
						E('p', {},
							_('A self-signed certificate will be generated for WeeChat Relay at %s.').format(targetPath)),
						E('p', {},
							E('strong', {}, _('Self-signed certificates provide encryption but are not trusted automatically by browsers.'))),
						E('p', {},
							_('For Internet-facing deployments, use a certificate issued by a trusted CA.'))
					]),

					E('h5', {}, _('Certificate identity')),

					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Common name')),
						E('div', { 'class': 'cbi-value-field' }, [
							inputCn = E('input', {
								'type': 'text',
								'class': 'cbi-input-text',
								'value': hostname,
								'placeholder': 'router.local'
							}),
							E('div', { 'class': 'cbi-value-description' },
								_('Host name identifying this router.'))
						])
					]),

					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Subject alternative names')),
						E('div', { 'class': 'cbi-value-field' }, [
							inputSan = E('input', {
								'type': 'text',
								'class': 'cbi-input-text',
								'value': defaultSan,
								'placeholder': 'router.local, 192.168.1.1'
							}),
							E('div', { 'class': 'cbi-value-description' },
								_('Comma-separated list of host names and IP addresses used to reach the relay.'))
						])
					]),

					msgBox = E('div', {}),

					E('div', { 'class': 'right' }, [
						btnCancel = E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': ui.hideModal
						}, _('Cancel')),
						' ',
						btnGenerate = E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function(ev) {
								ev.preventDefault();
								var cnVal = inputCn.value.trim();
								var sanVal = inputSan.value.trim();

								if (!cnVal) {
									ui.addNotification(null, E('p', _('Please enter a valid Common Name.')), 'warning');
									return;
								}

								btnGenerate.disabled = true;
								btnCancel.disabled = true;
								btnGenerate.textContent = _('Generating…');

								while (msgBox.firstChild)
									msgBox.removeChild(msgBox.firstChild);
								msgBox.appendChild(E('p', { 'class': 'spinning' }, _('Generating self-signed certificate…')));

								callGenerateCert(cnVal, sanVal, targetPath).then(function(res) {
									if (res && res.success) {
										ui.hideModal();
										updateWidget(getActiveCertPath());
										/* Only the saved relay settings decide which certificate WeeChat loads */
										(res.in_use ? restartIfRunning() : Promise.resolve(null)).then(function(restarted) {
											var msg;
											if (restarted === true)
												msg = _('Self-signed certificate generated for %s. WeeChat was restarted to use it.');
											else if (restarted === false)
												msg = _('Self-signed certificate generated for %s. WeeChat uses it from its next start.');
											else
												msg = _('Self-signed certificate generated for %s. Save and apply TLS with this certificate to use it.');
											ui.addNotification(null, E('p', msg.format(cnVal)), 'info');
										}).catch(function(err) {
											ui.addNotification(null, E('p',
												_('Self-signed certificate generated for %s, but WeeChat could not be restarted: %s').format(cnVal, err.message || err)),
												'warning');
										});
									} else {
										btnGenerate.disabled = false;
										btnCancel.disabled = false;
										btnGenerate.textContent = _('Generate');
										while (msgBox.firstChild)
											msgBox.removeChild(msgBox.firstChild);
										msgBox.appendChild(E('div', { 'class': 'alert-message error' },
											res && res.error ? res.error : _('Certificate generation failed.')));
									}
								}).catch(function(err) {
									btnGenerate.disabled = false;
									btnCancel.disabled = false;
									btnGenerate.textContent = _('Generate');
									while (msgBox.firstChild)
										msgBox.removeChild(msgBox.firstChild);
									msgBox.appendChild(E('div', { 'class': 'alert-message error' },
										err.message || err));
								});
							}
						}, _('Generate'))
					])
				];

				if (generatorAvailable === false) {
					btnGenerate.disabled = true;
					msgBox.appendChild(E('div', { 'class': 'alert-message error' },
						_('Cannot generate certificate: neither %s nor %s is installed on this router.').format('px5g', 'openssl')));
				}

				ui.showModal(_('Generate certificate?'), modalContent);
			}

			refreshCertStatus = function() {
				updateWidget(getActiveCertPath());
			};

			/* The field is not in the page yet while rendering, start from its stored value */
			updateWidget(String(optCertKey.cfgvalue(section_id) || '').trim() || defaultPath);

			return container;
		};

		o = s.option(form.Value, 'relay_password', _('Relay Password'),
			_('Password required by clients to connect.'));
		o.password = true;
		o.validate = function(section_id, value) {
			var formVal = optRelayEnabled ? optRelayEnabled.formvalue(section_id) : null;
			var isEnabled = (formVal !== null) ? (formVal === '1') : (uci.get('weechat', section_id, 'relay_enabled') === '1');
			if (isEnabled && (!value || !value.trim())) {
				return _('Relay password is required when relay server is enabled.');
			}
			return true;
		};

		/* Logging */
		s = m.section(form.NamedSection, 'weechat', 'weechat', _('Logging'));

		o = s.option(form.Flag, 'log_enabled', _('Enable Logging'),
			_('Record chat logs to disk. Disabled by default to protect flash memory.'));
		o.default = o.disabled;

		o = s.option(form.Value, 'log_dir', _('Log Directory'),
			_('Directory where WeeChat stores chat logs. The default /var/log/weechat is created automatically, any other directory must exist and be writable by the weechat user.'));
		o.placeholder = '/var/log/weechat';
		o.depends('log_enabled', '1');
		o.validate = function(section_id, value) {
			return validatePath(value, false);
		};

		/* Web Client */
		s = m.section(form.NamedSection, 'weechat', 'weechat', _('Web Client'));

		o = s.option(form.DummyValue, '_gb_info');
		o.cfgvalue = function() {
			return E('div', {}, [
				E('p', { 'style': 'margin-bottom: 12px; line-height: 1.5;' },
					_('Glowing Bear is a web client that connects to WeeChat using the relay configured above.')),
				E('a', {
					'class': 'btn cbi-button cbi-button-action',
					'href': 'https://www.glowing-bear.org/',
					'target': '_blank',
					'rel': 'noreferrer noopener',
					'style': 'margin-bottom: 6px; display: inline-block;'
				}, [ _('Open Glowing Bear (Hosted)'), ' ↗' ])
			]);
		};

		return m.render();
	}
});
