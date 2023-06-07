'use strict';
'require ui';
'require view';
'require dom';
'require poll';
'require uci';
'require rpc';
'require fs';
'require form';
'require tools.widgets as widgets';

return view.extend({

	NextUpdateStrings : {
		'Verify' : _("Verify"),
		'Run once' : _("Run once"),
		'Disabled' : _("Disabled"),
		'Stopped' : _("Stopped")
	},

	time_res : {
		seconds : 1,
		minutes : 60,
		hours : 3600,
	},

	callGetLogServices: rpc.declare({
		object: 'luci.ddns',
		method: 'get_services_log',
		params: [ 'service_name' ],
		expect: {  },
	}),

	callInitAction: rpc.declare({
		object: 'luci',
		method: 'setInitAction',
		params: [ 'name', 'action' ],
		expect: { result: false }
	}),

	callDDnsGetStatus: rpc.declare({
		object: 'luci.ddns',
		method: 'get_ddns_state',
		expect: {  }
	}),

	callDDnsGetEnv: rpc.declare({
		object: 'luci.ddns',
		method: 'get_env',
		expect: {  }
	}),

	callDDnsGetServicesStatus: rpc.declare({
		object: 'luci.ddns',
		method: 'get_services_status',
		expect: {  }
	}),

	services: {},

	/*
	 * Services list is gen by 3 different source:
	 * 1. /usr/share/ddns/default contains the service installed by opkg
	 * 2. /usr/share/ddns/custom contains any service installed by the
	 *    user or the ddns script (for example when service are
	 *    downloaded)
	 * 3. /usr/share/ddns/list contains all the service that can be
	 *    downloaded by using the ddns script ('service on demand' feature)
	 *
	 * (Special services that requires a dedicated package ARE NOT
	 * supported by the 'service on demand' feature)
	 */
	callGenServiceList: function(m, ev) {
		return Promise.all([
			L.resolveDefault(fs.list('/usr/share/ddns/default'), []),
			L.resolveDefault(fs.list('/usr/share/ddns/custom'), []),
			L.resolveDefault(fs.read('/usr/share/ddns/list'), null)
		]).then(L.bind(function (data) {
			var default_service = data[0],
				custom_service = data[1],
				list_service = data[2] && data[2].split("\n") || [],
				_this = this;

			this.services = {};

			default_service.forEach(function (service) {
				_this.services[service.name.replace('.json','')] = true
			});

			custom_service.forEach(function (service) {
				_this.services[service.name.replace('.json','')] = true
			});

			this.services = Object.fromEntries(Object.entries(this.services).sort());

			list_service.forEach(function (service) {
				if (!_this.services[service])
					_this.services[service] = false;
			});
		}, this))
	},

	/*
	* Check if the service is supported.
	* If the script doesn't find any json assume a 'service on demand' install.
	* If a json is found check if the ip type is supported.
	* Invalidate the service_name if is not supported.
	*/
	handleCheckService : function(s, service_name, ipv6, ev, section_id) {

		var value = service_name.formvalue(section_id);
		s.service_supported = null;
		service_name.triggerValidation(section_id);

		return this.handleGetServiceData(value)
			.then(L.bind(function (service_data) {
				if (value != '-' && service_data) {
					service_data = JSON.parse(service_data);
					if (ipv6.formvalue(section_id) == "1" && !service_data.ipv6) {
						s.service_supported = false;
						return;
					}
				}
				s.service_supported = true;
			}, service_name))
			.then(L.bind(service_name.triggerValidation, service_name, section_id))
	},

	handleGetServiceData: function(service) {
		return Promise.all([
			L.resolveDefault(fs.read('/usr/share/ddns/custom/'+service+'.json'), null),
			L.resolveDefault(fs.read('/usr/share/ddns/default/'+service+'.json'), null)
		]).then(function(data) {
			return data[0] || data[1] || null;
		})
	},

	handleInstallService: function(m, service_name, section_id, section, _this, ev) {
		var service = service_name.formvalue(section_id)
		return fs.exec('/usr/bin/ddns', ['service', 'install', service])
			.then(L.bind(_this.callGenServiceList, _this))
			.then(L.bind(m.render, m))
			.then(L.bind(this.renderMoreOptionsModal, this, section))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	handleRefreshServicesList: function(m, ev) {
		return fs.exec('/usr/bin/ddns', ['service', 'update'])
			.then(L.bind(this.load, this))
			.then(L.bind(this.render, this))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	handleReloadDDnsRule: function(m, section_id, ev) {
		return fs.exec('/usr/lib/ddns/dynamic_dns_lucihelper.sh',
							[ '-S', section_id, '--', 'start' ])
			.then(L.bind(m.load, m))
			.then(L.bind(m.render, m))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	HandleStopDDnsRule: function(m, section_id, ev) {
		return fs.exec('/usr/lib/ddns/dynamic_dns_lucihelper.sh',
							[ '-S', section_id, '--', 'start' ])
			.then(L.bind(m.render, m))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	handleToggleDDns: function(m, ev) {
		return this.callInitAction('ddns', 'enabled')
			.then(L.bind(function (action) { return this.callInitAction('ddns', action ? 'disable' : 'enable')}, this))
			.then(L.bind(function (action) { return this.callInitAction('ddns', action ? 'stop' : 'start')}, this))
			.then(L.bind(m.render, m))
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	handleRestartDDns: function(m, ev) {
		return this.callInitAction('ddns', 'restart')
			.then(L.bind(m.render, m));
	},

	poll_status: function(map, data) {
		var status = data[1] || [], service = data[0] || [], rows = map.querySelectorAll('.cbi-section-table-row[data-sid]'),
			section_id, cfg_detail_ip, cfg_update, cfg_status, host, ip, last_update,
			next_update, service_status, reload, cfg_enabled, stop,
			ddns_enabled = map.querySelector('[data-name="_enabled"]').querySelector('.cbi-value-field'),
			ddns_toggle = map.querySelector('[data-name="_toggle"]').querySelector('button'),
			services_list = map.querySelector('[data-name="_services_list"]').querySelector('.cbi-value-field');

		ddns_toggle.innerHTML = status['_enabled'] ? _('Stop DDNS') : _('Start DDNS')
		services_list.innerHTML = status['_services_list'];

		dom.content(ddns_enabled, function() {
			return E([], [
				E('div', {}, status['_enabled'] ? _('DDNS Autostart enabled') : [
					_('DDNS Autostart disabled'),
					E('div', { 'class' : 'cbi-value-description' },
					_("Currently DDNS updates are not started at boot or on interface events.") + "<br />" +
					_("This is the default if you run DDNS scripts by yourself (i.e. via cron with force_interval set to '0')"))
				]),]);
		});

		for (var i = 0; i < rows.length; i++) {
			section_id = rows[i].getAttribute('data-sid');
			cfg_detail_ip = rows[i].querySelector('[data-name="_cfg_detail_ip"]');
			cfg_update = rows[i].querySelector('[data-name="_cfg_update"]');
			cfg_status = rows[i].querySelector('[data-name="_cfg_status"]');
			reload = rows[i].querySelector('.cbi-section-actions .reload');
			stop = rows[i].querySelector('.cbi-section-actions .stop');
			cfg_enabled = uci.get('ddns', section_id, 'enabled');

			reload.disabled = (status['_enabled'] == 0 || cfg_enabled == 0);

			host = uci.get('ddns', section_id, 'lookup_host') || _('Configuration Error');
			ip =  _('No Data');
			last_update = _('Never');
			next_update = _('Unknown');
			service_status = '<b>' + _('Not Running') + '</b>';

			if (service[section_id]) {
				stop.disabled = (!service[section_id].pid || (service[section_id].pid && cfg_enabled == '1'));
				if (service[section_id].ip)
					ip = service[section_id].ip;
				if (service[section_id].last_update)
					last_update = service[section_id].last_update;
				if (service[section_id].next_update)
					next_update = this.NextUpdateStrings[service[section_id].next_update] || service[section_id].next_update;
				if (service[section_id].pid)
					service_status = '<b>' + _('Running') + '</b> : ' + service[section_id].pid;
			}

			cfg_detail_ip.innerHTML = host + '<br />' + ip;
			cfg_update.innerHTML = last_update + '<br />' + next_update;
			cfg_status.innerHTML = service_status;
		}

		return;
	},

	load: function() {
		return Promise.all([
			this.callDDnsGetServicesStatus(),
			this.callDDnsGetStatus(),
			this.callDDnsGetEnv(),
			this.callGenServiceList(),
			uci.load('ddns')
		]);
	},

	render: function(data) {
		var resolved = data[0] || [];
		var status = data[1] || [];
		var env = data[2] || [];
		var logdir = uci.get('ddns', 'global', 'ddns_logdir') || "/var/log/ddns";

		var _this = this;

		var m, s, o;

		m = new form.Map('ddns', _('Dynamic DNS'));

		s = m.section(form.NamedSection, 'global', 'ddns',);

		s.tab('info', _('Information'));
		s.tab('global', _('Global Settings'));

		o = s.taboption('info', form.DummyValue, '_version', _('Dynamic DNS Version'));
		o.cfgvalue = function() {
			return status[this.option];
		};

		o = s.taboption('info', form.DummyValue, '_enabled', _('State'));
		o.cfgvalue = function() {
			var res = status[this.option];
			if (!res) {
				this.description = _("Currently DDNS updates are not started at boot or on interface events.") + "<br />" +
				_("This is the default if you run DDNS scripts by yourself (i.e. via cron with force_interval set to '0')")
			}
			return res ? _('DDNS Autostart enabled') : _('DDNS Autostart disabled')
		};

		o = s.taboption('info', form.Button, '_toggle');
		o.title      = '&#160;';
		o.inputtitle = _((status['_enabled'] ? 'stop' : 'start').toUpperCase() + ' DDns');
		o.inputstyle = 'apply';
		o.onclick = L.bind(this.handleToggleDDns, this, m);

		o = s.taboption('info', form.Button, '_restart');
		o.title      = '&#160;';
		o.inputtitle = _('Restart DDns');
		o.inputstyle = 'apply';
		o.onclick = L.bind(this.handleRestartDDns, this, m);

		o = s.taboption('info', form.DummyValue, '_services_list', _('Services list last update'));
		o.cfgvalue = function() {
			return status[this.option];
		};

		o = s.taboption('info', form.Button, '_refresh_services');
		o.title      = '&#160;';
		o.inputtitle = _('Update DDns Services List');
		o.inputstyle = 'apply';
		o.onclick = L.bind(this.handleRefreshServicesList, this, m);

		// DDns hints

		if (!env['has_ipv6']) {
			o = s.taboption('info', form.DummyValue, '_no_ipv6');
			o.rawhtml  = true;
			o.title = '<b>' + _("IPv6 not supported") + '</b>';
			o.cfgvalue = function() { return _("IPv6 is currently not (fully) supported by this system") + "<br />" +
			_("Please follow the instructions on OpenWrt's homepage to enable IPv6 support") + "<br />" +
			_("or update your system to the latest OpenWrt Release")};
		}

		if (!env['has_ssl']) {
			o = s.taboption('info', form.DummyValue, '_no_https');
			o.titleref = L.url("admin", "system", "opkg")
			o.rawhtml  = true;
			o.title = '<b>' + _("HTTPS not supported") + '</b>';
			o.cfgvalue = function() { return _("Neither GNU Wget with SSL nor cURL installed to support secure updates via HTTPS protocol.") +
			"<br />- " +
			_("You should install 'wget' or 'curl' or 'uclient-fetch' with 'libustream-*ssl' package.") +
			"<br />- " +
			_("In some versions cURL/libcurl in OpenWrt is compiled without proxy support.")};
		}

		if (!env['has_bindnet']) {
			o = s.taboption('info', form.DummyValue, '_no_bind_network');
			o.titleref = L.url("admin", "system", "opkg")
			o.rawhtml  = true;
			o.title = '<b>' + _("Binding to a specific network not supported") + '</b>';
			o.cfgvalue = function() { return _("Neither GNU Wget with SSL nor cURL installed to select a network to use for communication.") +
			"<br />- " +
			_("You should install 'wget' or 'curl' package.") +
			"<br />- " +
			_("GNU Wget will use the IP of given network, cURL will use the physical interface.") +
			"<br />- " +
			_("In some versions cURL/libcurl in OpenWrt is compiled without proxy support.")};
		}

		if (!env['has_proxy']) {
			o = s.taboption('info', form.DummyValue, '_no_proxy');
			o.titleref = L.url("admin", "system", "opkg")
			o.rawhtml  = true;
			o.title = '<b>' + _("cURL without Proxy Support") + '</b>';
			o.cfgvalue = function() { return _("cURL is installed, but libcurl was compiled without proxy support.") +
			"<br />- " +
			_("You should install 'wget' or 'uclient-fetch' package or replace libcurl.") +
			"<br />- " +
			_("In some versions cURL/libcurl in OpenWrt is compiled without proxy support.")};
		}

		if (!env['has_forceip']) {
			o = s.taboption('info', form.DummyValue, '_no_force_ip');
			o.titleref = L.url("admin", "system", "opkg")
			o.rawhtml  = true;
			o.title = '<b>' + _("Force IP Version not supported") + '</b>';
			o.cfgvalue = function() { return _("BusyBox's nslookup and Wget do not support to specify " +
				"the IP version to use for communication with DDNS Provider!") +
				"<br />- " + _("You should install 'wget' or 'curl' or 'uclient-fetch' package.")
			};
		}

		if (!env['has_bindhost']) {
			o = s.taboption('info', form.DummyValue, '_no_dnstcp');
			o.titleref = L.url("admin", "system", "opkg")
			o.rawhtml  = true;
			o.title = '<b>' + _("DNS requests via TCP not supported") + '</b>';
			o.cfgvalue = function() { return _("BusyBox's nslookup and hostip do not support to specify to use TCP " +
				"instead of default UDP when requesting DNS server!") +
				"<br />- " +
				_("You should install 'bind-host' or 'knot-host' or 'drill' package for DNS requests.")};
		}

		if (!env['has_dnsserver']) {
			o = s.taboption('info', form.DummyValue, '_no_dnsserver');
			o.titleref = L.url("admin", "system", "opkg")
			o.rawhtml  = true;
			o.title = '<b>' + _("Using specific DNS Server not supported") + '</b>';
			o.cfgvalue = function() { return _("BusyBox's nslookup in the current compiled version " +
			"does not handle given DNS Servers correctly!") +
		"<br />- " +
		_("You should install 'bind-host' or 'knot-host' or 'drill' or 'hostip' package, " +
			"if you need to specify a DNS server to detect your registered IP.")};
		}

		if (env['has_ssl'] && !env['has_cacerts']) {
			o = s.taboption('info', form.DummyValue, '_no_certs');
			o.titleref = L.url("admin", "system", "opkg")
			o.rawhtml  = true;
			o.title = '<b>' + _("No certificates found") + '</b>';
			o.cfgvalue = function() { return _("If using secure communication you should verify server certificates!") +
			"<br />- " +
			_("Install 'ca-certificates' package or needed certificates " +
				"by hand into /etc/ssl/certs default directory")};
		}

		// Advanced Configuration Section

		o = s.taboption('global', form.Flag, 'upd_privateip', _("Allow non-public IP's"));
		o.description = _("Non-public and by default blocked IP's") + ':'
		+ '<br /><strong>IPv4: </strong>'
		+ '0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16'
		+ '<br /><strong>IPv6: </strong>'
		+ '::/32, f000::/4"';
		o.default = "0";
		o.optional = true;

		o = s.taboption('global', form.Value, 'ddns_dateformat', _('Date format'));
		o.description = '<a href="http://www.cplusplus.com/reference/ctime/strftime/" target="_blank">'
			+ _("For supported codes look here")
			+ '</a><br />' +
			_('Current setting: ') + '<b>' + status['_curr_dateformat'] + '</b>';
		o.default = "%F %R"
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('global', form.Value, 'ddns_rundir', _('Status directory'));
		o.description = _('Directory contains PID and other status information for each running section.');
		o.default = "/var/run/ddns";
		o.optional = true;
		o.rmempty = true;

		o = s.taboption('global', form.Value, 'ddns_logdir', _('Log directory'));
		o.description = _('Directory contains Log files for each running section.');
		o.default = "/var/log/ddns";
		o.optional = true;
		o.rmempty = true;
		o.validate = function(section_id, formvalue) {
			if (formvalue.indexOf('../') !== -1)
				return _('"../" not allowed in path for Security Reason.')

			return true;
		}

		o = s.taboption('global', form.Value, 'ddns_loglines', _('Log length'));
		o.description = _('Number of last lines stored in log files');
		o.datatype = 'min(1)';
		o.default = '250';

		if (env['has_wget'] && env['has_curl']) {

			o = s.taboption('global', form.Flag, 'use_curl', _('Use cURL'));
			o.description = _('If Wget and cURL package are installed, Wget is used for communication by default.');
			o.default = "0";
			o.optional = true;
			o.rmempty = true;

		}

		o = s.taboption('global', form.Value, 'cacert', _('Ca Certs path'));
		o.description = _('Ca Certs path that will be used to download services data. Set IGNORE to skip certificate validation.');
		o.placeholder = 'IGNORE';

		o = s.taboption('global', form.Value, 'services_url', _('Services URL Download'));
		o.description = _('Url used to download services file. By default is the master openwrt ddns package repo.');
		o.placeholder = 'https://raw.githubusercontent.com/openwrt/packages/master/net/ddns-scripts/files';

		// DDns services
		s = m.section(form.GridSection, 'service', _('Services'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add new services...');

		s.anonymous = true;
		s.addremove = true;
		s.sortable  = true;

		s.handleCreateDDnsRule = function(m, name, service_name, ipv6, ev) {
			var section_id = name.isValid('_new_') ? name.formvalue('_new_') : null,
				service_value = service_name.isValid('_new_') ? service_name.formvalue('_new_') : null,
				ipv6_value = ipv6.isValid('_new_') ? ipv6.formvalue('_new_') : null;

			if (section_id == null || section_id == '' || service_value == null || section_id == '' || ipv6_value == null || ipv6_value == '')
				return;

			return m.save(function() {
				uci.add('ddns', 'service', section_id);
				if (service_value != '-') {
					uci.set('ddns', section_id, 'service_name', service_value);
				}
				uci.set('ddns', section_id, 'use_ipv6', ipv6_value);
			}).then(L.bind(m.children[1].renderMoreOptionsModal, m.children[1], section_id));
		};

		s.handleAdd = function(ev) {
			var m2 = new form.Map('ddns'),
				s2 = m2.section(form.NamedSection, '_new_'),
				name, ipv6, service_name;

			s2.render = function() {
				return Promise.all([
					{},
					this.renderUCISection('_new_')
				]).then(this.renderContents.bind(this));
			};

			name = s2.option(form.Value, 'name', _('Name'));
			name.rmempty = false;
			name.datatype = 'uciname';
			name.placeholder = _('New DDns Service…');
			name.validate = function(section_id, value) {
				if (uci.get('ddns', value) != null)
					return _('The service name is already used');

				return true;
			};

			ipv6 = s2.option( form.ListValue, 'use_ipv6',
				_("IP address version"),
				_("Defines which IP address 'IPv4/IPv6' is send to the DDNS provider"));
			ipv6.default = '0';
			ipv6.value("0", _("IPv4-Address"))
			if (env["has_ipv6"]) {
				ipv6.value("1", _("IPv6-Address"))
			}

			service_name = s2.option(form.ListValue, 'service_name',
					String.format('%s', _("DDNS Service provider")));
			service_name.value('-',"-- " + _("custom") + " --");
			Object.keys(_this.services).sort().forEach(name => service_name.value(name));
			service_name.validate = function(section_id, value) {
				if (value == '') return _("Select a service");
				if (s2.service_supported == null) return _("Checking the service support...");
				if (!s2.service_supported) return _("Service doesn't support this ip type");
				return true;
			};

			ipv6.onchange = L.bind(_this.handleCheckService, _this, s2, service_name, ipv6);
			service_name.onchange = L.bind(_this.handleCheckService, _this, s2, service_name, ipv6);

			m2.render().then(L.bind(function(nodes) {
				ui.showModal(_('Add new services...'), [
					nodes,
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Cancel')), ' ',
						E('button', {
							'class': 'cbi-button cbi-button-positive important',
							'click': ui.createHandlerFn(this, 'handleCreateDDnsRule', m, name, service_name, ipv6)
						}, _('Create service'))
					])
				], 'cbi-modal');

				nodes.querySelector('[id="%s"] input[type="text"]'.format(name.cbid('_new_'))).focus();
			}, this));
		};

		s.renderRowActions = function(section_id) {
			var tdEl = this.super('renderRowActions', [ section_id, _('Edit') ]),
				cfg_enabled = uci.get('ddns', section_id, 'enabled'),
				reload_opt = {
					'class': 'cbi-button cbi-button-neutral reload',
					'click': ui.createHandlerFn(_this, 'handleReloadDDnsRule', m, section_id),
					'title': _('Reload this service'),
				},
				stop_opt = {
					'class': 'cbi-button cbi-button-neutral stop',
					'click': ui.createHandlerFn(_this, 'HandleStopDDnsRule', m, section_id),
					'title': _('Stop this service'),
				};

			if (status['_enabled'] == 0 || cfg_enabled == 0)
				reload_opt['disabled'] = 'disabled';

			if (!resolved[section_id] || !resolved[section_id].pid ||
					(resolved[section_id].pid && cfg_enabled == '1'))
				stop_opt['disabled'] = 'disabled';

			dom.content(tdEl.lastChild, [
				E('button', stop_opt, _('Stop')),
				E('button', reload_opt, _('Reload')),
				tdEl.lastChild.childNodes[0],
				tdEl.lastChild.childNodes[1],
				tdEl.lastChild.childNodes[2]
			]);

			return tdEl;
		};

		s.modaltitle = function(section_id) {
			return _('DDns Service') + ' » ' + section_id;
		};

		s.addModalOptions = function(s, section_id) {

			var service = uci.get('ddns', section_id, 'service_name') || '-',
				ipv6 = uci.get('ddns', section_id, 'use_ipv6'), service_name, use_ipv6;

			return _this.handleGetServiceData(service).then(L.bind(function (service_data) {
				s.service_available = true;
				s.service_supported = true;

				if (service != '-') {
					if (!service_data)
						s.service_available = false;
					else {
						service_data = JSON.parse(service_data);
						if (ipv6 == "1" && !service_data.ipv6)
							s.service_supported = false;
					}
				}

				s.tab('basic', _('Basic Settings'));
				s.tab('advanced', _('Advanced Settings'));
				s.tab('timer', _('Timer Settings'));
				s.tab('logview', _('Log File Viewer'));

				o = s.taboption('basic', form.Flag, 'enabled',
					_('Enabled'),
					_("If this service section is disabled it could not be started.")
					+ "<br />" +
					_("Neither from LuCI interface nor from console."));
				o.modalonly = true;
				o.rmempty  = false;
				o.default = '1';

				o = s.taboption('basic', form.Value, 'lookup_host',
					_("Lookup Hostname"),
					_("Hostname/FQDN to validate, if IP update happen or necessary"));
				o.rmempty = false;
				o.placeholder = "myhost.example.com";
				o.datatype = 'and(minlength(3),hostname("strict"))';
				o.modalonly = true;

				use_ipv6 = s.taboption('basic', form.ListValue, 'use_ipv6',
					_("IP address version"),
					_("Defines which IP address 'IPv4/IPv6' is send to the DDNS provider"));
				use_ipv6.default = '0';
				use_ipv6.modalonly = true;
				use_ipv6.rmempty  = false;
				use_ipv6.value("0", _("IPv4-Address"))
				if (env["has_ipv6"]) {
					use_ipv6.value("1", _("IPv6-Address"))
				}

				service_name = s.taboption('basic', form.ListValue, 'service_name',
					String.format('%s', _("DDNS Service provider")));
				service_name.modalonly = true;
				service_name.value('-',"-- " + _("custom") + " --");
				Object.keys(_this.services).sort().forEach(name => service_name.value(name));
				service_name.cfgvalue = function(section_id) {
					return uci.get('ddns', section_id, 'service_name') || '-';
				};
				service_name.write = function(section_id, service) {
					if (service != '-') {
						uci.set('ddns', section_id, 'update_url', null);
						uci.set('ddns', section_id, 'update_script', null);
						return uci.set('ddns', section_id, 'service_name', service);
					}
					return uci.set('ddns', section_id, 'service_name', null);
				};
				service_name.validate = function(section_id, value) {
					if (value == '') return _("Select a service");
					if (s.service_available == null) return _("Checking the service support...");
					if (!s.service_available) return _('Service not installed');
					if (!s.service_supported) return _("Service doesn't support this ip type");
					return true;
				};

				service_name.onchange = L.bind(_this.handleCheckService, _this, s, service_name, use_ipv6);
				use_ipv6.onchange = L.bind(_this.handleCheckService, _this, s, service_name, use_ipv6);

				if (!s.service_available) {
					o = s.taboption('basic', form.Button, '_download_service');
					o.modalonly  = true;
					o.title      = _('Service not installed');
					o.inputtitle = _('Install Service');
					o.inputstyle = 'apply';
					o.onclick = L.bind(_this.handleInstallService,
						this, m, service_name, section_id, s.section, _this)
				}

				if (!s.service_supported) {
					o = s.taboption('basic', form.DummyValue, '_not_supported', '&nbsp');
					o.cfgvalue = function () {
						return _("Service doesn't support this ip type")
					};
				}

				var service_switch = s.taboption('basic', form.Button, '_switch_proto');
				service_switch.modalonly  = true;
				service_switch.title      = _('Really switch service?');
				service_switch.inputtitle = _('Switch service');
				service_switch.inputstyle = 'apply';
				service_switch.onclick = L.bind(function(ev) {
					if (!s.service_supported) return;

					return s.map.save()
						.then(L.bind(m.load, m))
						.then(L.bind(m.render, m))
						.then(L.bind(this.renderMoreOptionsModal, this, s.section));
				}, this);

				if (s.service_available && s.service_supported) {

					o = s.taboption('basic', form.Value, 'update_url',
						_("Custom update-URL"),
						_("Update URL to be used for updating your DDNS Provider.")
						+ "<br />" +
						_("Follow instructions you will find on their WEB page."));
					o.modalonly = true;
					o.rmempty = true;
					o.optional = true;
					o.depends("service_name","-");
					o.validate = function(section_id, value) {
						var other = this.section.children.filter(function(o) { return o.option == 'update_script' })[0].formvalue(section_id);

						if ((value == "" && other == "") || (value != "" && other != "")) {
							return _("Insert a Update Script OR a Update URL");
						}

						return true;
					};

					o = s.taboption('basic', form.Value, 'update_script',
						_("Custom update-script"),
						_("Custom update script to be used for updating your DDNS Provider."));
					o.modalonly = true;
					o.rmempty = true;
					o.optional = true;
					o.depends("service_name","-");
					o.validate = function(section_id, value) {
						var other = this.section.children.filter(function(o) { return o.option == 'update_url' })[0].formvalue(section_id);

						if ((value == "" && other == "") || (value != "" && other != "")) {
							return _("Insert a Update Script OR a Update URL");
						}

						return true;
					};

					o = s.taboption('basic', form.Value, 'domain',
						_("Domain"),
						_("Replaces [DOMAIN] in Update-URL (URL-encoded)"));
					o.modalonly = true;
					o.rmempty = false;

					o = s.taboption('basic', form.Value, 'username',
						_("Username"),
						_("Replaces [USERNAME] in Update-URL (URL-encoded)"));
					o.modalonly = true;
					o.rmempty = false;

					o = s.taboption('basic', form.Value, 'password',
						_("Password"),
						_("Replaces [PASSWORD] in Update-URL (URL-encoded)"));
					o.password = true;
					o.modalonly = true;
					o.rmempty = false;

					o = s.taboption('basic', form.Value, 'param_enc',
						_("Optional Encoded Parameter"),
						_("Optional: Replaces [PARAMENC] in Update-URL (URL-encoded)"));
					o.optional = true;
					o.modalonly = true;

					o = s.taboption('basic', form.Value, 'param_opt',
						_("Optional Parameter"),
						_("Optional: Replaces [PARAMOPT] in Update-URL (NOT URL-encoded)"));
					o.optional = true;
					o.modalonly = true;

					if (env['has_ssl']) {
						o = s.taboption('basic', form.Flag, 'use_https',
							_("Use HTTP Secure"),
							_("Enable secure communication with DDNS provider"));
						o.optional = true;
						o.modalonly = true;

						o = s.taboption('basic', form.Value, 'cacert',
							_("Path to CA-Certificate"),
							_("directory or path/file")
							+ "<br />" +
							_("or")
							+ '<b>' + " IGNORE " + '</b>' +
							_("to run HTTPS without verification of server certificates (insecure)"));
						o.modalonly = true;
						o.depends("use_https", "1");
						o.placeholder = "/etc/ssl/certs";
						o.rmempty = false;
					};


					o = s.taboption('advanced', form.ListValue, 'ip_source',
						_("IP address source"),
						_("Defines the source to read systems IP-Address from, that will be send to the DDNS provider"));
					o.modalonly = true;
					o.default = "network";
					o.value("network", _("Network"));
					o.value("web", _("URL"));
					o.value("interface", _("Interface"));
					o.value("script", _("Script"));
					o.write = function(section_id, formvalue) {
						switch(formvalue) {
							case 'network':
								uci.set('ddns', section_id, "ip_url",null);
								uci.set('ddns', section_id, "ip_interface",null);
								uci.set('ddns', section_id, "ip_script",null);
								break;
							case 'web':
								uci.set('ddns', section_id, "ip_network",null);
								uci.set('ddns', section_id, "ip_interface",null);
								uci.set('ddns', section_id, "ip_script",null);
								break;
							case 'interface':
								uci.set('ddns', section_id, "ip_network",null);
								uci.set('ddns', section_id, "ip_url",null);
								uci.set('ddns', section_id, "ip_script",null);
								break;
							case 'script':
								uci.set('ddns', section_id, "ip_network",null);
								uci.set('ddns', section_id, "ip_url",null);
								uci.set('ddns', section_id, "ip_interface",null);
								break;
							default:
								break;
						};

						return uci.set('ddns', section_id, 'ip_source', formvalue )
					};

					o = s.taboption('advanced', widgets.NetworkSelect, 'ip_network',
						_("Network"),
						_("Defines the network to read systems IP-Address from"));
					o.depends('ip_source','network');
					o.modalonly = true;
					o.default = 'wan';
					o.multiple = false;

					o = s.taboption('advanced', form.Value, 'ip_url',
						_("URL to detect"),
						_("Defines the Web page to read systems IP-Address from.")
						+ '<br />' +
						String.format('%s %s', _('Example for IPv4'), ': http://checkip.dyndns.com')
						+ '<br />' +
						String.format('%s %s', _('Example for IPv6'), ': http://checkipv6.dyndns.com'));
					o.depends("ip_source", "web")
					o.modalonly = true;

					o = s.taboption('advanced', widgets.DeviceSelect, 'ip_interface',
						_("Interface"),
						_("Defines the interface to read systems IP-Address from"));
					o.modalonly = true;
					o.depends("ip_source", "interface")
					o.multiple = false;
					o.default = 'wan';

					o = s.taboption('advanced', form.Value, 'ip_script',
						_("Script"),
						_("User defined script to read systems IP-Address"));
					o.modalonly = true;
					o.depends("ip_source", "script")
					o.placeholder = "/path/to/script.sh"

					o = s.taboption('advanced', widgets.DeviceSelect, 'interface',
						_("Event Network"),
						_("Network on which the ddns-updater scripts will be started"));
					o.modalonly = true;
					o.multiple = false;
					o.default = 'wan';
					o.depends("ip_source", "web");
					o.depends("ip_source", "script");

					o = s.taboption('advanced', form.DummyValue, '_interface',
						_("Event Network"),
						_("Network on which the ddns-updater scripts will be started"));
					o.depends("ip_source", "interface");
					o.depends("ip_source", "network");
					o.forcewrite = true;
					o.modalonly = true;
					o.cfgvalue = function(section_id) {
						return uci.get('ddns', section_id, 'interface') || _('This will be autoset to the selected interface');
					};
					o.write = function(section_id) {
						var opt = this.section.children.filter(function(o) { return o.option == 'ip_source' })[0].formvalue(section_id);
						var val = this.section.children.filter(function(o) { return o.option == 'ip_'+opt })[0].formvalue(section_id);
						return uci.set('ddns', section_id, 'interface', val);
					};

					if (env['has_bindnet']) {
						o = s.taboption('advanced', widgets.NetworkSelect, 'bind_network',
							_("Bind Network"),
							_('OPTIONAL: Network to use for communication')
							+ '<br />' +
							_("Network on which the ddns-updater scripts will be started"));
						o.depends("ip_source", "web");
						o.optional = true;
						o.rmempty = true;
						o.modalonly = true;
					}

					if (env['has_forceip']) {
						o = s.taboption('advanced', form.Flag, 'force_ipversion',
							_("Force IP Version"),
							_('OPTIONAL: Force the usage of pure IPv4/IPv6 only communication.'));
						o.optional = true;
						o.rmempty = true;
						o.modalonly = true;
					}

					if (env['has_dnsserver']) {
						o = s.taboption("advanced", form.Value, "dns_server",
							_("DNS-Server"),
							_("OPTIONAL: Use non-default DNS-Server to detect 'Registered IP'.")
							+ "<br />" +
							_("Format: IP or FQDN"));
						o.placeholder = "mydns.lan"
						o.optional = true;
						o.rmempty = true;
						o.modalonly = true;
					}

					if (env['has_bindhost']) {
						o = s.taboption("advanced", form.Flag, "force_dnstcp",
							_("Force TCP on DNS"),
							_("OPTIONAL: Force the use of TCP instead of default UDP on DNS requests."));
						o.optional = true;
						o.rmempty = true;
						o.modalonly = true;
					}

					if (env['has_proxy']) {
						o = s.taboption("advanced", form.Value, "proxy",
							_("PROXY-Server"),
							_("OPTIONAL: Proxy-Server for detection and updates.")
							+ "<br />" +
							String.format('%s: <b>%s</b>', _("Format"), "[user:password@]proxyhost:port")
							+ "<br />" +
							String.format('%s: <b>%s</b>', _("IPv6 address must be given in square brackets"), "[2001:db8::1]:8080"));
						o.optional = true;
						o.rmempty = true;
						o.modalonly = true;
					}

					o = s.taboption("advanced", form.ListValue, "use_syslog",
						_("Log to syslog"),
						_("Writes log messages to syslog. Critical Errors will always be written to syslog."));
					o.modalonly = true;
					o.default = "2"
					o.optional = true;
					o.value("0", _("No logging"))
					o.value("1", _("Info"))
					o.value("2", _("Notice"))
					o.value("3", _("Warning"))
					o.value("4", _("Error"))

					o = s.taboption("advanced", form.Flag, "use_logfile",
						_("Log to file"));
					o.default = '1';
					o.optional = true;
					o.modalonly = true;
					o.cfgvalue = function(section_id) {
						this.description = _("Writes detailed messages to log file. File will be truncated automatically.") + "<br />" +
						_("File") + ': "' + logdir + '/' + section_id + '.log"';
						return uci.get('ddns', section_id, 'use_logfile');
					};


					o = s.taboption("timer", form.Value, "check_interval",
						_("Check Interval"));
					o.placeholder = "30";
					o.modalonly = true;
					o.datatype = 'uinteger';
					o.validate = function(section_id, formvalue) {
						var unit = this.section.children.filter(function(o) { return o.option == 'check_unit' })[0].formvalue(section_id),
							time_to_sec = _this.time_res[unit || 'minutes'] * formvalue;

						if (formvalue && time_to_sec < 300)
							return _('Values below 5 minutes == 300 seconds are not supported');

						return true;
					};

					o = s.taboption("timer", form.ListValue, "check_unit",
						_('Check Unit'),
						_("Interval unit to check for changed IP"));
					o.modalonly = true;
					o.default  = "minutes"
					o.value("seconds", _("seconds"));
					o.value("minutes", _("minutes"));
					o.value("hours", _("hours"));

					o = s.taboption("timer", form.Value, "force_interval",
						_("Force Interval"),
						_("Interval to force updates send to DDNS Provider")
						+ "<br />" +
						_("Setting this parameter to 0 will force the script to only run once"));
					o.placeholder = "72";
					o.optional = true;
					o.modalonly = true;
					o.datatype = 'uinteger';
					o.validate = function(section_id, formvalue) {

						if (!formvalue)
							return true;

						var check_unit = this.section.children.filter(function(o) { return o.option == 'check_unit' })[0].formvalue(section_id),
							check_val = this.section.children.filter(function(o) { return o.option == 'check_interval' })[0].formvalue(section_id),
							force_unit = this.section.children.filter(function(o) { return o.option == 'force_unit' })[0].formvalue(section_id),
							check_to_sec = _this.time_res[check_unit || 'minutes'] * ( check_val || '30'),
							force_to_sec = _this.time_res[force_unit || 'minutes'] * formvalue;

						if (force_to_sec != 0 && force_to_sec < check_to_sec)
							return _("Values lower 'Check Interval' except '0' are not supported");

						return true;
					};

					o = s.taboption("timer", form.ListValue, "force_unit",
						_('Force Unit'),
						_("Interval unit to force updates sent to DDNS Provider."));
					o.modalonly = true;
					o.optional = true;
					o.default  = "minutes"
					o.value("minutes", _("minutes"));
					o.value("hours", _("hours"));
					o.value("days", _("days"));

					o = s.taboption("timer", form.Value, "retry_count",
						_("Error Retry Counter"),
						_("On Error the script will stop execution after given number of retrys.")
						+ "<br />" +
						_("The default setting of '0' will retry infinitely."));
					o.placeholder = "0";
					o.optional = true;
					o.modalonly = true;
					o.datatype = 'uinteger';

					o = s.taboption("timer", form.Value, "retry_interval",
						_("Error Retry Interval"),
  						_("The interval between which each succesive retry will commence."));
					o.placeholder = "60";
					o.optional = true;
					o.modalonly = true;
					o.datatype = 'uinteger';

					o = s.taboption("timer", form.ListValue, "retry_unit",
						_('Retry Unit'),
						_("Which time units to use for retry counters."));
					o.modalonly = true;
					o.optional = true;
					o.default  = "seconds"
					o.value("seconds", _("seconds"));
					o.value("minutes", _("minutes"));

					o = s.taboption('logview', form.Button, '_read_log');
					o.title      = '';
					o.depends('use_logfile','1');
					o.modalonly = true;
					o.inputtitle = _('Read / Reread log file');
					o.inputstyle = 'apply';
					o.onclick = L.bind(function(ev, section_id) {
						return _this.callGetLogServices(section_id).then(L.bind(log_box.update_log, log_box));
					}, this);

					var log_box = s.taboption("logview", form.DummyValue, "_logview");
					log_box.depends('use_logfile','1');
					log_box.modalonly = true;

					log_box.update_log = L.bind(function(view, log_data) {
						return document.getElementById('log_area').textContent = log_data.result;
					}, o, this);

					log_box.render = L.bind(function() {
						return E([
							E('p', {}, _('This is the current content of the log file in %h for this service.').format(logdir)),
							E('p', {}, E('textarea', { 'style': 'width:100%', 'rows': 20, 'readonly' : 'readonly', 'id' : 'log_area' }, _('Please press [Read] button') ))
						]);
					}, o, this);
				}

				for (var i = 0; i < s.children.length; i++) {
					o = s.children[i];
					switch (o.option) {
					case '_switch_proto':
						o.depends({ service_name : service, use_ipv6: ipv6, "!reverse": true })
						continue;
					case 'enabled':
					case 'service_name':
					case 'use_ipv6':
					case 'update_script':
					case 'update_url':
					case 'lookup_host':
						continue;

					default:
						if (o.deps.length)
							for (var j = 0; j < o.deps.length; j++) {
								o.deps[j].service_name = service;
								o.deps[j].use_ipv6 = ipv6;
							}
						else
							o.depends({service_name: service, use_ipv6: ipv6 });
					}
				}
			}, this)
		)};

		o = s.option(form.DummyValue, '_cfg_status', _('Status'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var text = '<b>' + _('Not Running') + '</b>';

			if (resolved[section_id] && resolved[section_id].pid)
				text = '<b>' + _('Running') + '</b> : ' + resolved[section_id].pid;

			return text;
		};

		o = s.option(form.DummyValue, '_cfg_name', _('Name'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			return '<b>' + section_id + '</b>';
		};

		o = s.option(form.DummyValue, '_cfg_detail_ip', _('Lookup Hostname') + "<br />" + _('Registered IP'));
		o.rawhtml   = true;
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var host = uci.get('ddns', section_id, 'lookup_host') || _('Configuration Error'),
				ip = _('No Data');
			if (resolved[section_id] && resolved[section_id].ip)
				ip = resolved[section_id].ip;

			return host + '<br />' + ip;
		};

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.rmempty  = false;
		o.editable = true;
		o.modalonly = false;

		o = s.option(form.DummyValue, '_cfg_update', _('Last Update') + "<br />" + _('Next Update'));
		o.rawhtml   = true;
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var last_update = _('Never'), next_update = _('Unknown');
			if (resolved[section_id]) {
				if (resolved[section_id].last_update)
					last_update = resolved[section_id].last_update;
				if (resolved[section_id].next_update)
					next_update = _this.NextUpdateStrings[resolved[section_id].next_update] || resolved[section_id].next_update;
			}

			return  last_update + '<br />' + next_update;
		};

		return m.render().then(L.bind(function(m, nodes) {
			poll.add(L.bind(function() {
				return Promise.all([
					this.callDDnsGetServicesStatus(),
					this.callDDnsGetStatus()
				]).then(L.bind(this.poll_status, this, nodes));
			}, this), 5);
			return nodes;
		}, this, m));
	}
});
