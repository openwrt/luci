'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require poll';
'require ui';

var status = '';
var url = 'http://127.0.0.1:%d/';
var port = 8888;
var isenabled = true;
var TinyproxyStatus = form.DummyValue.extend({
	load: function() {
		this.default=E('div', { 'id': 'tinyproxystatusid' },'');
	}
});


var Tinyproxybuttons = form.DummyValue.extend({
	load: function() {
		var buttons = E([]);
		var restartButton = E('button', { 
			'id': 'restartbutton',
			'class': 'cbi-button cbi-button-neutral',
			}, _('Restart tinyproxy')
		);
		restartButton.addEventListener('click', function() {
			fs.exec('/etc/init.d/tinyproxy', ['restart']);
		});

		var reloadButton = E('button', { 
			'id': 'reloadbutton',
			'class': 'cbi-button cbi-button-neutral',
			}, _('Reload settings into tinyproxy')
		);
		reloadButton.addEventListener('click', function() {
			fs.exec('/etc/init.d/tinyproxy', ['reload']);
		});

		buttons.appendChild(E('div', { }, [restartButton, reloadButton ]));

		this.default= E('div', {}, [restartButton,reloadButton]);
	}
});

return view.extend({

	poll_status: function(nodes, data) {
		const element = document.getElementById('tinyproxystatusid');
		if (element) {
			element.innerHTML = '';
			let tempDiv = document.createElement('div');
			if ((data == null) || (data == '')) {
				if (isenabled == 1) {
					tempDiv.innerHTML = _('Waiting for data from url:') + ' ' + url.format(port);
				} else {
					tempDiv.innerHTML = _('Tinyproxy is disabled');
				}
			} else {
				tempDiv.innerHTML = data;
			}
			let styles = tempDiv.querySelectorAll('style');
			styles.forEach(style => style.remove());
			let elements = tempDiv.querySelectorAll('*');
			elements.forEach(el => el.removeAttribute('style'));
			element.appendChild(tempDiv);
		}
	},


	load: function() {
	},


	render: function () {
		var m, s, o, t, ta, v;

		m = new form.Map('tinyproxy', _('Tinyproxy'),_('Tinyproxy is a small and fast non-caching HTTP(S)-Proxy'));

		s = m.section(form.TypedSection);
		s.title = _('Status');
		s.anonymous = true;


		o = s.option(TinyproxyStatus);
		o = s.option(Tinyproxybuttons);


		s = m.section(form.TypedSection, 'tinyproxy', _('Server Settings'));
		s.anonymous = true;


		s.tab('general', _('General settings'));
		s.tab('privacy', _('Privacy settings'));
		s.tab('filteracl', _('Filtering and ACLs'));
		s.tab('limits', _('Server limits'));


		o = s.taboption('general', form.Flag, 'enabled', _('Enable Tinyproxy server'))
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'Port', _('Listen port'),
			_('Specifies the HTTP port Tinyproxy is listening on for requests'));

		o.optional = true;
		o.datatype = 'port';
		o.placeholder = 8888;


		o = s.taboption('general', form.Value, 'Listen', _('Listen address'),
			_('Specifies the addresses Tinyproxy is listening on for requests'));

		o.optional = true;
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';


		o = s.taboption('general', form.Value, 'Bind', _('Bind address'),
			_('Specifies the address Tinyproxy binds to for outbound forwarded requests'));

		o.optional = true;
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';


		o = s.taboption('general', form.Value, 'DefaultErrorFile', _('Error page'),
			_('HTML template file to serve when HTTP errors occur'));

		o.optional = true;
		o.default = '/usr/share/tinyproxy/default.html';


		o = s.taboption('general', form.Value, 'StatFile', _('Statistics page'),
			_('HTML template file to serve for stat host requests'));

		o.optional = true;
		o.default = '/usr/share/tinyproxy/stats.html';


		o = s.taboption('general', form.Flag, 'Syslog', _('Use syslog'),
			_('Writes log messages to syslog instead of a log file'));


		o = s.taboption('general', form.Value, 'LogFile', _('Log file'),
			_('Log file to use for dumping messages'));

		o.default = '/var/log/tinyproxy.log';
		o.depends('Syslog', '');


		o = s.taboption('general', form.ListValue, 'LogLevel', _('Log level'),
			_('Logging verbosity of the Tinyproxy process'));

		o.value('Critical');
		o.value('Error');
		o.value('Warning');
		o.value('Notice');
		o.value('Connect');
		o.value('Info');


		o = s.taboption('general', form.Value, 'User', _('User'),
			_('Specifies the user name the Tinyproxy process is running as'));

		o.default = 'nobody';


		o = s.taboption('general', form.Value, 'Group', _('Group'),
			_('Specifies the group name the Tinyproxy process is running as'));

		o.default = 'nogroup';


		//
		// Privacy
		//

		o = s.taboption('privacy', form.Flag, 'XTinyproxy', _('X-Tinyproxy header'),
			_('Adds an \'X-Tinyproxy\' HTTP header with the client IP address to forwarded requests'));


		o = s.taboption('privacy', form.Value, 'ViaProxyName', _('Via hostname'),
			_('Specifies the Tinyproxy hostname to use in the Via HTTP header'));

		o.placeholder = 'tinyproxy';
		o.datatype = 'hostname';


		s.taboption('privacy', form.DynamicList, 'Anonymous', _('Header whitelist'),
			_('Specifies HTTP header names which are allowed to pass-through, all others are discarded. Leave empty to disable header filtering'));


		//
		// Filter
		//

		o = s.taboption('filteracl', form.DynamicList, 'Allow', _('Allowed clients'),
			_('List of IP addresses or ranges which are allowed to use the proxy server'));

		o.placeholder = '0.0.0.0';
		o.datatype = 'ipaddr';


		o = s.taboption('filteracl', form.DynamicList, 'ConnectPort', _('Allowed connect ports'),
			_('List of allowed ports for the CONNECT method. A single value \'0\' disables CONNECT completely, an empty list allows all ports'));

		o.placeholder = 0;
		o.datatype = 'port';


		s.taboption('filteracl', form.FileUpload, 'Filter', _('Filter file'),
			_('Plaintext file with URLs or domains to filter. One entry per line'));


		s.taboption('filteracl', form.Flag, 'FilterURLs', _('Filter by URLs'),
			_('By default, filtering is done based on domain names. Enable this to match against URLs instead'));


		s.taboption('filteracl', form.Flag, 'FilterExtended', _('Filter by RegExp'),
			_('By default, basic POSIX expressions are used for filtering. Enable this to activate extended regular expressions'));


		 s.taboption('filteracl', form.Flag, 'FilterCaseSensitive', _('Filter case-sensitive'),
			_('By default, filter strings are treated as case-insensitive. Enable this to make the matching case-sensitive'));


		s.taboption('filteracl', form.Flag, 'FilterDefaultDeny', _('Default deny'),
			_('By default, the filter rules act as blacklist. Enable this option to allow matched URLs or domain names only'));


		//
		// Limits
		//

		o = s.taboption('limits', form.Value, 'Timeout', _('Connection timeout'),
			_('Maximum number of seconds an inactive connection is held open'));

		o.optional = true;
		o.datatype = 'uinteger';
		o.default = 600;


		o = s.taboption('limits', form.Value, 'MaxClients', _('Max. clients'),
			_('Maximum allowed number of concurrently connected clients'));

		o.datatype = 'uinteger';
		o.default = 10;


		o = s.taboption('limits', form.Value, 'MinSpareServers', _('Min. spare servers'),
			_('Minimum number of prepared idle processes'));

		o.datatype = 'uinteger';
		o.default = 5;


		o = s.taboption('limits', form.Value, 'MaxSpareServers', _('Max. spare servers'),
			_('Maximum number of prepared idle processes'));

		o.datatype = 'uinteger';
		o.default = 10;


		o = s.taboption('limits', form.Value, 'StartServers', _('Start spare servers'),
			_('Number of idle processes to start when launching Tinyproxy'));

		o.datatype = 'uinteger';
		o.default = 5;


		o = s.taboption('limits', form.Value, 'MaxRequestsPerChild', _('Max. requests per server'),
			_('Maximum allowed number of requests per process. If it is exeeded, the process is restarted. Zero means unlimited.'));

		o.datatype = 'uinteger';
		o.default = 0;


		//
		// Upstream
		//

		s = m.section(form.TypedSection, 'upstream', _('Upstream Proxies'),
			_('Upstream proxy rules define proxy servers to use when accessing certain IP addresses or domains.'));

		s.anonymous = true;
		s.addremove = true;


		t = s.option(form.ListValue, 'type', _('Policy'),
			_('<em>Via proxy</em> routes requests to the given target via the specified upstream proxy, <em>Reject access</em> disables any upstream proxy for the target'));

		t.value('proxy', _('Via proxy'));
		t.value('reject', _('Reject access'));


		ta = s.option(form.Value, 'target', _('Target host'),
			_('Can be either an IP address or range, a domain name or \'.\' for any host without domain'));

		ta.rmempty = true;
		ta.placeholder = '0.0.0.0/0';
		ta.datatype = 'host(1)';


		v = s.option(form.Value, 'via', _('Via proxy'),
			_('Specifies the upstream proxy to use for accessing the target host. Format is <code>address:port</code> or <code>socks5 address:port</code>'));

		v.depends({type: 'proxy'});
		v.placeholder = '10.0.0.1:8080';


		v.write = function(section_id, value) {
			if (value.match(/^\d+\.\d+\.\d+\.\d+:\d+/) || 
				value.match(/^socks5 \d+\.\d+\.\d+\.\d+:\d+/)) {
				return form.Value.prototype.write.apply(this, [section_id, value]);;
			} else {
				return
			}
		};



		
		return m.render().then(L.bind(function(m, nodes) {
			poll.add(L.bind(function() {
				return uci.load('tinyproxy').then(function() {
					port = uci.get_first('tinyproxy', 'tinyproxy', 'Port');
					isenabled = uci.get_first('tinyproxy', 'tinyproxy', 'enabled');
					if (isNaN(port) || port < 0 || port > 65535)
						port = 8888;

					return L.resolveDefault(fs.exec_direct('/usr/bin/wget', [ '-q', url.format(port), '-O', '-' ]), null);
				}).then(L.bind(this.poll_status, this, nodes));
			}, this), 5);
			return nodes;
		}, this, m));
	},
	handleSaveApply: function (ev, mode) {
		var Fn = L.bind(function() {
			fs.exec('/etc/init.d/tinyproxy', ['reload']);
			document.removeEventListener('uci-applied',Fn);
		});
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	}
});
