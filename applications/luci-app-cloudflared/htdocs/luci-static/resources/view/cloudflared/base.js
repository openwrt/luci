/* SPDX-License-Identifier: GPL-3.0-only
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
		var m, s, o;

		m = new form.Map('cloudflared', _('Cloudflared'),
			_('Zero Trust Security services from Cloudflare to help you get maximum security both from outside and within the network.'));

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
		o.value = _('Collectiong data...');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.DynamicList, 'token', _('Token'));
		o.rmempty = false;

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
