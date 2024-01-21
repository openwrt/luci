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
		} catch (e) { }
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
	load: function() {
		return Promise.all([
			uci.load('cloudflared')
		]);
	},

	render: function(data) {
		var docsUrl = 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/tunnel-run-parameters/';
		var m, s, o;

		m = new form.Map('cloudflared', _('Cloudflared'),
			_('Zero Trust Security services from Cloudflare to help you get maximum security both from outside and within the network.') + '<br />' +
			_('See <a %s>documentation</a> about the tunnel configuration parameters.')
				.format('href="' + docsUrl + '" target="_blank"')
		);

		s = m.section(form.NamedSection, 'config', 'cloudflared');

		o = s.option(form.DummyValue, 'service_status', _('Status'));
		o.load = function () {
			poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function (res) {
					var view = document.getElementById('cbi-cloudflared-config-service_status');
					view.innerHTML = renderStatus(res);
				});
			});
		}
		o.value = _('Collecting data...');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Value, 'token', _('Token'));
		o.optional = true;
		o.rmempty = false;

		o = s.option(form.FileUpload, 'config', _('Config file'),
			_('The path to a configuration file in YAML format.')
		);
		o.default = '/etc/cloudflared/config.yml';
		o.root_directory = '/';

		o = s.option(form.FileUpload, 'origincert', _('Certificate of Origin'),
			_('The account certificate for your zones authorizing the client to serve as an origin for that zone') + '<br />' +
			_('You can obtain a certificate <a %s>here</a>.').format('href="https://dash.cloudflare.com/argotunnel" target="_blank"')
		);
		o.default = '/etc/cloudflared/cert.pem';
		o.root_directory = '/';

		o = s.option(form.Value, 'region', _('Region'),
			_('Choose the region to which connections are established.') + '<br />' +
			_('Currently the only available is <code>us</code> e.g. United States.')
		);

		o = s.option(form.ListValue, 'loglevel', _('Debug level'));
		o.value('fatal', _('Fatal'));
		o.value('error', _('Error'));
		o.value('warn', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.default = 'info';

		o = s.option(form.Button, '_panel', _('Cloudflare Zero Trust'),
			_('Create or manage your cloudflared network.'));
		o.inputtitle = _('Open website');
		o.inputstyle = 'apply';
		o.onclick = function () {
			window.open('https://one.dash.cloudflare.com', '_blank');
		}

		return m.render();
	}
});