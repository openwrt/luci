// SPDX-License-Identifier: Apache-2.0

'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require validation';
'require view';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('openlist'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['openlist']['instances']['instance1']['running'];
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
		renderHTML = spanTemp.format('green', _('OpenList'), _('RUNNING')) + button;
	} else {
		renderHTML = spanTemp.format('red', _('OpenList'), _('NOT RUNNING'));
	}

	return renderHTML;
}

var stubValidator = {
	factory: validation,
	apply: function(type, value, args) {
		if (value != null)
			this.value = value;

		return validation.types[type].apply(this, args);
	},
	assert: function(condition) {
		return !!condition;
	}
};

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('openlist')
		]);
	},

	render: function(data) {
		let m, s, o;
		var webport = uci.get(data[0], 'config', 'listen_http_port') || '5244';

		m = new form.Map('openlist', _('OpenList'),
			_('A file list/WebDAV program that supports multiple storages, powered by Gin and Solidjs.') + '<br />' +
			_('Default webUI/WebDAV login username is %s and password is %s.').format('<code>admin</code>', '<code>password</code>'));

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
					E('p', { id: 'service_status' }, _('Collecting data...'))
			]);
		}

		s = m.section(form.NamedSection, 'config', 'openlist');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'listen_addr', _('Listen address'));
		o.placeholder = '0.0.0.0';
		o.validate = function(section_id, value) {
			if (section_id && value) {
				var m4 = value.match(/^([^\[\]:]+)$/),
				    m6 = value.match(/^\[(.+)\]$/ );

				if ((!m4 && !m6) || !stubValidator.apply('ipaddr', m4 ? m4[1] : m6[1]))
					return _('Expecting: %s').format(_('valid IP address'));
			}
			return true;
		}

		o = s.option(form.Value, 'listen_http_port', _('Listen port'));
		o.datatype = 'port';
		o.placeholder = '5244';

		o = s.option(form.Value, 'site_login_expire', _('Login expiration time'),
			_('User login expiration time (in hours).'));
		o.datatype = 'uinteger';
		o.placeholder = '48';

		o = s.option(form.Value, 'site_max_connections', _('Max connections'),
			_('The maximum number of concurrent connections at the same time (0 = unlimited).'));
		o.datatype = 'uinteger';
		o.placeholder = '0';

		o = s.option(form.Flag, 'site_tls_insecure', _('Allow insecure connection'),
			_('Allow connection even if the remote TLS certificate is invalid (<strong>not recommended</strong>).'));

		o = s.option(form.Flag, 'log_enable', _('Enable logging'));
		o.default = o.enabled;

		o = s.option(form.Value, 'log_max_size', _('Max log size'),
			_('The maximum size in megabytes of the log file before it gets rotated.'));
		o.datatype = 'uinteger';
		o.placeholder = '5';
		o.depends('log_enable', '1');

		o = s.option(form.Value, 'log_max_backups', _('Max log backups'),
			_('The maximum number of old log files to retain.'));
		o.datatype = 'uinteger';
		o.placeholder = '1';
		o.depends('log_enable', '1');

		o = s.option(form.Value, 'log_max_age', _('Max log age'),
			_('The maximum days of the log file to retain.'));
		o.datatype = 'uinteger';
		o.placeholder = '15';
		o.depends('log_enable', '1');

		return m.render();
	}
});
