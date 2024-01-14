/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>
 */

'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('cloudflared'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['cloudflared']['instances']['cloudflared']['running'];
		} catch (ignored) {}
		return isRunning;
	});
}

function renderStatus(isRunning) {
	var spanTemp = '<label class="cbi-value-title">Status</label><div class="cbi-value-field"><em><span style="color:%s">%s</span></em></div>';
	var renderHTML;
	if (isRunning) {
		renderHTML = String.format(spanTemp, 'green', _('Running'));
	} else {
		renderHTML = String.format(spanTemp, 'red', _('Not Running'));
	}

	return renderHTML;
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('cloudflared')
		]);
	},

	render: function (data) {
		var m, s, o;

		m = new form.Map('cloudflared', _('Cloudflare Zero Trust Tunnel'),
			_('Cloudflare Zero Trust Security services help you get maximum security both from outside and within the network.') + '<br />' +
			_('Create and manage your network on the <a %s>Cloudflare Zero Trust</a> dashboard.')
				.format('href="https://one.dash.cloudflare.com" target="_blank"') + '<br />' +
			_('See <a %s>documentation</a>.')
				.format('href="https://openwrt.org/docs/guide-user/services/vpn/cloudfare_tunnel" target="_blank"')
		);

		s = m.section(form.NamedSection, 'config', 'cloudflared');

		o = s.option(form.DummyValue, 'service_status', _('Status'));
		o.load = function () {
			poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function (res) {
					var view = document.getElementById('cbi-cloudflared-config-service_status');
					if (view) {
						view.innerHTML = renderStatus(res);
					}
				});
			});
		};
		o.value = _('Collecting data...');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.TextValue, 'token', _('Token'),
			_('The tunnel token is shown in the dashboard once you create a tunnel.')
		);
		o.optional = true;
		o.rmempty = false;
		o.monospace = true;

		o = s.option(form.FileUpload, 'config', _('Config file path'),
			_('See <a %s>documentation</a>.')
				.format('href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/" target="_blank"')
		);
		o.default = '/etc/cloudflared/config.yml';
		o.root_directory = '/etc/cloudflared/';
		o.optional = true;

		o = s.option(form.FileUpload, 'origincert', _('Certificate of Origin'),
			_('The account certificate for your zones authorizing the client to serve as an Origin for that zone') + '<br />' +
			_('Obtain a certificate <a %s>here</a>.')
				.format('href="https://dash.cloudflare.com/argotunnel" target="_blank"')
		);
		o.default = '/etc/cloudflared/cert.pem';
		o.root_directory = '/etc/cloudflared/';
		o.optional = true;

		o = s.option(form.ListValue, 'region', _('Region'),
			_('The region to which connections are established.')
		);
		o.value('us', _('United States'));
		o.optional = true;

		o = s.option(form.ListValue, 'loglevel', _('Debug level'));
		o.value('fatal', _('Fatal'));
		o.value('error', _('Error'));
		o.value('warn', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.default = 'info';

		return m.render();
	}
});