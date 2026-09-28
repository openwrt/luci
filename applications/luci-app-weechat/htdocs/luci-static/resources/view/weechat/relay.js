'use strict';
'require view';
'require form';
'require fs';
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

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('weechat'),
			L.resolveDefault(fs.stat('/www/glowing-bear/index.html'), null)
		]);
	},

	render: function(data) {
		var m, s, o;
		var gbStat = data ? data[1] : null;
		var hasLocalGb = !!(gbStat && gbStat.type === 'file');
		var defaultPath = '/etc/weechat/tls/relay.pem';
		var configuredCert = uci.get('weechat', 'weechat', 'relay_cert_key') || defaultPath;

		var hostname = window.location.hostname || 'OpenWrt';
		var defaultSan = hostname;

		m = new form.Map('weechat', _('WeeChat - Relay'),
			_('Configure the WeeChat relay and chat logging.'));

		/* Relay */
		s = m.section(form.NamedSection, 'weechat', 'weechat', _('Relay'));

		var optRelayEnabled = s.option(form.Flag, 'relay_enabled', _('Enable Relay Server'));
		optRelayEnabled.default = optRelayEnabled.disabled;
		optRelayEnabled.rmempty = false;

		o = s.option(form.Value, 'relay_address', _('Listen Address'),
			_('IP address to bind (leave empty for all interfaces).'));
		o.datatype = 'ipaddr';
		o.placeholder = _('All interfaces');
		o.rmempty = true;
		o.depends('relay_enabled', '1');

		o = s.option(form.Value, 'relay_port', _('Port'),
			_('Port for relay connections (WebSocket).'));
		o.datatype = 'port';
		o.default = '9000';
		o.placeholder = '9000';
		o.depends('relay_enabled', '1');

		/* Security */
		s = m.section(form.NamedSection, 'weechat', 'weechat', _('Security'));

		o = s.option(form.Flag, 'relay_tls', _('Enable TLS'),
			_('Encrypt relay connections with TLS.'));
		o.default = o.disabled;

		var optCertKey = s.option(form.Value, 'relay_cert_key', _('Certificate'),
			_('PEM file containing the certificate and private key.'));
		optCertKey.placeholder = defaultPath;
		optCertKey.rmempty = true;
		optCertKey.depends('relay_tls', '1');

		/* Certificate status widget */
		var optCertStatus = s.option(form.DummyValue, '_cert_status', _('Certificate status'));
		optCertStatus.depends('relay_tls', '1');

		optCertStatus.renderWidget = function(section_id, option_index, cfgvalue) {
			var container = E('div', { 'class': 'cbi-value-field' });

			function updateWidget(path) {
				while (container.firstChild)
					container.removeChild(container.firstChild);

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
							'click': function(ev) {
								ev.preventDefault();
								showGenerateDialog(getActiveCertPath(), res && res.generator_available);
							}
						}, _('Generate self-signed certificate')));
					}

					if (res && res.generator_available === false) {
						elements.push(E('div', { 'class': 'alert-message warning' }, [
							E('p', {},
								_('Certificate generation requires the %s or %s utility.').format(
									E('code', {}, 'px5g'), E('code', {}, 'openssl')
								))
						]));
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
										ui.addNotification(null,
											E('p', _('Self-signed certificate generated successfully for %s.').format(cnVal)),
											'info');
										updateWidget(getActiveCertPath());
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
					msgBox.appendChild(E('div', { 'class': 'alert-message error' }, [
						E('p', {},
							_('Cannot generate certificate: neither %s nor %s is installed on this router.').format(
								E('code', {}, 'px5g'), E('code', {}, 'openssl')
							))
					]));
				}

				ui.showModal(_('Generate certificate?'), modalContent);
			}

			function getActiveCertPath() {
				var inputEl = document.querySelector('[name="cbid.weechat.weechat.relay_cert_key"]');
				if (inputEl && inputEl.value && inputEl.value.trim())
					return inputEl.value.trim();
				return configuredCert || defaultPath;
			}

			requestAnimationFrame(function() {
				var inputEl = document.querySelector('[name="cbid.weechat.weechat.relay_cert_key"]');
				if (inputEl) {
					inputEl.addEventListener('change', function() {
						updateWidget(getActiveCertPath());
					});
				}
			});

			updateWidget(getActiveCertPath());

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
			_('Directory where WeeChat stores chat logs.'));
		o.placeholder = '/var/log/weechat';
		o.depends('log_enabled', '1');

		/* Web Client */
		s = m.section(form.NamedSection, 'weechat', 'weechat', _('Web Client'));

		o = s.option(form.DummyValue, '_gb_info');
		o.cfgvalue = function() {
			var buttons = [];

			if (hasLocalGb) {
				buttons.push(E('a', {
					'class': 'btn cbi-button cbi-button-action',
					'href': '/glowing-bear/',
					'target': '_blank',
					'rel': 'noreferrer noopener',
					'style': 'margin-right: 10px; margin-bottom: 6px; display: inline-block;'
				}, [ _('Open Glowing Bear (Local)'), ' ↗' ]));
				buttons.push(E('a', {
					'class': 'btn cbi-button',
					'href': 'https://www.glowing-bear.org/',
					'target': '_blank',
					'rel': 'noreferrer noopener',
					'style': 'margin-bottom: 6px; display: inline-block;'
				}, [ _('Open Glowing Bear (Hosted)'), ' ↗' ]));
			} else {
				buttons.push(E('a', {
					'class': 'btn cbi-button cbi-button-action',
					'href': 'https://www.glowing-bear.org/',
					'target': '_blank',
					'rel': 'noreferrer noopener',
					'style': 'margin-bottom: 6px; display: inline-block;'
				}, [ _('Open Glowing Bear (Hosted)'), ' ↗' ]));
			}

			var desc = [
				E('p', { 'style': 'margin-bottom: 12px; line-height: 1.5;' },
					_('Glowing Bear is a web client that connects to WeeChat using the relay configured above.'))
			];

			if (hasLocalGb) {
				desc.push(E('div', { 'style': 'margin-bottom: 14px;' }, [
					E('span', { 'class': 'label success' }, [ '● ', _('Self-hosted Glowing Bear is installed') ])
				]));
			} else {
				desc.push(E('div', { 'class': 'cbi-value-description', 'style': 'margin-bottom: 14px;' },
					_('Self-hosted Glowing Bear is not installed on this router. You can use the hosted web client instead.')));
			}

			desc.push(E('div', { 'style': 'margin-top: 6px;' }, buttons));

			return E('div', {}, desc);
		};

		return m.render();
	}
});
