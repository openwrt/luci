'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('v2raya'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['v2raya']['instances']['v2raya']['running'];
		} catch (e) { }
		return isRunning;
	});
}

function renderStatus(isRunning, port) {
	var spanTemp = '<span style="color:%s"><strong>%s %s</strong></span>';
	var renderHTML;
	if (isRunning) {
		var button = String.format('&#160;<a class="btn cbi-button" href="http://%s:%s" target="_blank" rel="noreferrer noopener">%s</a>',
			window.location.hostname, port, _('Open Web Interface'));
		renderHTML = spanTemp.format('green', _('v2rayA'), _('RUNNING')) + button;
	} else {
		renderHTML = spanTemp.format('red', _('v2rayA'), _('NOT RUNNING'));
	}

	return renderHTML;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('v2raya')
		]);
	},

	render: function(data) {
		let m, s, o;
		var webport = (uci.get(data[0], 'config', 'address') || '0.0.0.0:2017').split(':').slice(-1)[0];

		m = new form.Map('v2raya', _('v2rayA'),
			_('v2rayA is a V2Ray Linux client supporting global transparent proxy, compatible with SS, SSR, Trojan(trojan-go), PingTunnel protocols.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function () {
			poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function (res) {
					var view = document.getElementById('service_status');
					view.innerHTML = renderStatus(res, webport);
				});
			});

			return E('div', { class: 'cbi-section', id: 'status_bar' }, [
					E('p', { id: 'service_status' }, _('Collecting data…'))
			]);
		}

		s = m.section(form.NamedSection, 'config', 'v2raya');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Value, 'address', _('Listening address'));
		o.datatype = 'ipaddrport(1)';
		o.placeholder = '0.0.0.0:2017';

		o = s.option(form.ListValue, 'ipv6_support', _('IPv6 support'),
			_('Requires working IPv6 connectivity.'));
		o.value('auto', _('Auto'));
		o.value('on', _('On'));
		o.value('off', _('Off'));
		o.default = 'auto';

		o = s.option(form.ListValue, 'nftables_support', _('Nftables support'),
			_('Requires nftables.'));
		o.value('auto', _('Auto'));
		o.value('on', _('On'));
		o.value('off', _('Off'));
		o.default = 'auto';

		o = s.option(form.ListValue, 'log_level', _('Log level'));
		o.value('trace', _('Trace'));
		o.value('debug', _('Debug'));
		o.value('info', _('Info'));
		o.value('warn', _('Warn'));
		o.value('error', _('Error'));
		o.default = 'info';

		o = s.option(form.Value, 'log_max_days', _('Max log retention period'),
			_('Unit: days.'));
		o.datatype = 'uinteger';
		o.placeholder = '3';

		o = s.option(form.Flag, 'log_disable_color', _('Disable log color output'));

		o = s.option(form.Flag, 'log_disable_timestamp', _('Disable log timestamp'));

		return m.render();
	}
});
