// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
"use strict";
"require form";
"require uci";
"require fs";
"require rpc";
"require ui";
"require view";

return L.view.extend({
	load: function() {
		return Promise.all([
			uci.load("snmpd"),
		]);
	},

	__init__: function() {
		this.super("__init__", arguments);

		this.ro_community = null;
		this.ro_community_src = null;
		this.rw_community = null;
		this.rw_community_src = null;
		this.oid = null;
		this.ip_protocol = null;
		this.snmp_version = null;
	},

	populateSystemSettings: function(tab, s, data) {
		var g, go, o;

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "system", null,
			_("Here you can configure system settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		function snmpd_sys_cfgvalue(section) {
			var s = uci.get_first('snmpd', 'system');
			return s && uci.get('snmpd', s['.name'], this.option || '');
		};

		function snmpd_sys_remove(section) {
			var s = uci.get_first('snmpd', 'system');
			if (s)
				uci.unset('snmpd', s['.name'], this.option);
		};

		function snmpd_sys_write(section, value) {
			var s = uci.get_first('snmpd', 'system');
			var sid = s ? s['.name'] : uci.add('snmpd', 'system');
			uci.set('snmpd', sid, this.option, value);
		};

		go = g.option(form.Value, "sysName", _("Name"),
			_("System Name"));
		go.cfgvalue = snmpd_sys_cfgvalue;
		go.write = snmpd_sys_write;
		go.remove = snmpd_sys_remove;

		go = g.option(form.Value, "sysContact", _("Contact"),
			_('System contact'));
		go.cfgvalue = snmpd_sys_cfgvalue;
		go.write = snmpd_sys_write;
		go.remove = snmpd_sys_remove;
		
		go = g.option(form.Value, "sysLocation", _("Location"),
			_('System location'));
		go.cfgvalue = snmpd_sys_cfgvalue;
		go.write = snmpd_sys_write;
		go.remove = snmpd_sys_remove;
	},
	
	populateGlobalSettings: function(tab, s, data) {
		var go, g, o;

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "snmpd", null,
			_("Here you can configure agent settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		go = g.option(form.Flag, "enabled", _("Enable SNMP"),
			_("Enable to use SNMP"));
		go.default = "0";
		go.rmempty = false;

		this.ip_protocol = g.option(form.ListValue, 'ip_protocol', _('IP version'));
		this.ip_protocol.value('ipv4', _('Only IPv4'));
		this.ip_protocol.value('ipv6', _('Only IPv6'));
		this.ip_protocol.value('ipv4/ipv6', _('IPv4 and IPv6'));
		this.ip_protocol.optional = false;
		this.ip_protocol.forcewrite = true;
		this.ip_protocol.default = "ipv4";
		this.ip_protocol.rmempty = false;

		this.ip_protocol.cfgvalue = function(section_id) {
			var ip_protocol = uci.get('snmpd', section_id, 'ip_protocol');

			if (!ip_protocol) {
				var s = uci.get_first('snmpd', 'agent');
				if (!s)
					return null;

				var addr = uci.get('snmpd', s['.name'], 'agentaddress');
				var p = [];

				if (!addr)
					return null;

				addr = addr.toUpperCase();

				if (addr.match(/UDP:\d+/g))
					p.push('ipv4');

				if (addr.match(/UDP6:\d+/g))
					p.push('ipv6');

				ip_protocol = p.join('/');
			}

			return ip_protocol;
		};

		go = g.option(form.Value, "snmp_port", _("Port"));
		go.rmempty = false;
		go.default = '161';
		go.datatype = 'port';
		go.forcewrite = true;
		go.cfgvalue = function(section_id) {
			var port = uci.get('snmpd', section_id, 'snmp_port');
			if (!port) {
				var s = uci.get_first('snmpd', 'agent');
				var addr = uci.get('snmpd', s['.name'], 'agentaddress');

				if (!addr)
					return null;

				addr = addr.toUpperCase();
				port = addr.match(/UDP6?:(\d+)/i);

				if (Array.isArray(port) && (port.length > 1))
					port = port[1];
			}
			return port;
		},

		go.write = L.bind(function(protocol, section_id, value) {
			var addr = [];
			var port = parseInt(value);
			var ip_protocol = protocol.formvalue(section_id);

			if (ip_protocol.match(/ipv4/g))
				addr.push('UDP:%d'.format(port));

			if (ip_protocol.match(/ipv6/g))
				addr.push('UDP6:%d'.format(port));

			if (addr.length > 0) {
				var s = uci.get_first('snmpd', 'agent');
				if (s)
					uci.set('snmpd', s['.name'], 'agentaddress', addr.join(','));
			}

			return form.Value.prototype.write.apply(this, [section_id, value]);
		}, go, this.ip_protocol);

		this.snmp_version = g.option(form.ListValue, 'snmp_version',
			_('SNMP version'),
			_('SNMP version used to monitor and control the device'));
		this.snmp_version.default = 'v1/v2c';
		this.snmp_version.rmempty = false;
		this.snmp_version.forcewrite = true;
		this.snmp_version.value('v1/v2c', _('SNMPv1 and SNMPv2c'));
		this.snmp_version.value('v1/v2c/v3', _('SNMPv1, SNMPv2c and SNMPv3'));
		this.snmp_version.value('v3', _('Only SNMPv3'));

		go = g.option(form.Value, "__agentxsocket", _("AgentX socket path"),
			_("Empty for disable AgentX"));
		go.rmempty = true;
		go.forcewrite = true;
		go.cfgvalue = function(section_id) {
			var s = uci.get_first('snmpd', 'agentx');
			var socket = uci.get('snmpd', s['.name'], 'agentxsocket');
			if (!socket)
				socket = this.default;
			return socket;
		};

		go.remove = function(section_id) {
			var s = uci.get_first('snmpd', 'agentx');
			if (s)
				s.remove('snmpd', s['.name']);
		};

		go.write = function(section_id, value) {
			var s = uci.get_first('snmpd', 'agentx');
			var sid = s ? s['.name'] : uci.add('snmpd', 'agentx');
			uci.set('snmpd', sid, 'agentxsocket', value);
		};
	},

	populateAdvancedSettings(tab, s, data) {
		var o, g, go;

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.GridSection, "com2sec", null,
			_("Here you can configure com2sec options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;
		g.modaltitle = "com2sec Settings";

		go = g.option(form.Value, "secname", _("Secname"),
			_("Arbitrary label for use in group settings"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "source", _("Source"),
			_("Source describes a host or network"));
		go.rmempty = false;

		go = g.option(form.Value, "community", _("Community"),
			_("The community name that is used"));
		go.optional = false;
		go.rmempty = false;

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.GridSection, "group", null,
			_("Here you can configure group options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;
		g.modaltitle = "Group Settings";

		go = g.option(form.Value, "group", _("Group"),
			_("A group maps com2sec names to access names"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "version", _("Version"),
			_("The used version for the group"));
		go.value('v1', _('SNMPv1'));
		go.value('v2c', _('SNMPv2c'));
		go.value('usm', _('SNMPv3'));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "secname", _("Secname"),
			_("Here you define which secname is mapped to the group"));
		go.optional = false;
		go.rmempty = false;

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.GridSection, "access", null,
			_("Here you can configure access options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;
		g.modaltitle = "Access Settings";

		go = g.option(form.Value, "group", _("Group"),
			_("The group that is mapped to the views (Read, Write, Notify)"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "context", _("Context"),
			_("The context of the request"));
		go.default = 'none';
		go.modalonly = true;

		go = g.option(form.Value, "version", _("Version"),
			_("The used version for access configuration"));
		go.value('any', _('Any version'));
		go.value('v1', _('SNMPv1'));
		go.value('v2c', _('SNMPv2c'));
		go.value('usm', _('SNMPv3'));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "level", _("Level"),
			_("Level of security"));
		go.value('noauth', _('No authentication (standard for SNMPv1/v2c)'));
		go.value('auth', _('Authentication'));
		go.value('priv', _('Authentication and encryption'));
		go.default = 'noauth';
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "prefix", _("Prefix"),
			_("Specification how context of requests is matched to context"));
		go.value('exact', _('Exact'));
		go.value('prefix', _('Prefix'));
		go.optional = false;
		go.default = 'exact';
		go.rmempty = false;

		go = g.option(form.Value, "read", _("Read"),
			_("Read access modification for groups"));
		go.value('all', _('All'));
		go.value('none', _('None'));
		go.default = 'none';
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		go = g.option(form.Value, "write", _("Write"),
			_("Write access modification for groups"));
		go.value('all', _('All'));
		go.value('none', _('None'));
		go.default = 'none';
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		go = g.option(form.Value, "notify", _("Notify"),
			_("Notify access modification for groups"));
		go.value('all', _('All'));
		go.value('none', _('None'));
		go.default = 'none';
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;
	},

	populateV1V2CSettings: function(subsection, desc, access, s, data) {
		var g, go, o, community, community_src, mode, mask;

		o = s.taboption("v1/v2c", form.SectionValue, "__v1/v2c__",
			form.GridSection, subsection, null, desc);

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;
		g.modaltitle = desc;

		go = g.option(form.ListValue, "Mode", _("Access Control"),
			_("Access restriction to readonly or Read/Write"));
		go.value("rwcommunity", _("Read/Write"));
		go.value("rocommunity", _("Readonly"));

		community = g.option(form.Value, "CommunityName",
			_("Community Name"),
			_("Community that is used for SNMP"));
		community.datatype = "string";
		community.default = "";
		community.optional = false;
		community.rmempty = false;
		if(access == null) {
			if (uci.get("snmpd", "access_default", "Mode") === "rwcommunity") {
				this.rw_community_src = "default";
			} else {
				this.ro_community_src = "default";
			}
		}

		if (access !== null) {
			community_src = g.option(form.Value, access,
				_("Community source"),
				_("Trusted source for SNMP read community access (hostname or IP)"));
			community_src.value("default", _("any (default)"));
			community_src.value("localhost", _("localhost"));
			community_src.default = "default";
			community_src.optional = false;
			community_src.rmempty = false;
			community_src.datatype = "host(0)";

			if (access == "HostIP") {
				mask = g.option(form.Value, "IPMask",
					_("IPMask"),
					_("Prefix"));
				mask.rmempty = false;
				mask.datatype = "and(ip6prefix, ip4prefix)";
				mask.size = 2;
			}
		}

		go = g.option(form.ListValue, "RestrictOID",
			_("OID-Restriction"),
			_("Restriction to specific OID"));
		go.value("no", _("No"));
		go.value("yes", _("Yes"));
		go.default = "no";
		go.optional = false;
		go.rmempty = false;

		this.oid = g.option(form.Value,
			"RestrictedOID",
			_("OID"),
			_("Defined OID-branch that is restricted to"));
		this.oid.datatype = "string";
		this.oid.depends("RestrictOID", "yes");

		if (go === "rocommunity") {
			this.ro_community = community;
			this.ro_community_src = community_src;
		} else {
			this.rw_community = community;
			this.rw_community_src = community_src;
		}
	},

	populateV3Settings: function(tab, s, data){
		var g, go, o;

		o = s.taboption(tab, form.SectionValue, '__v3__',
			form.GridSection, 'v3',
			null, _('Here you can configure SNMPv3 settings'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;
		g.modaltitle = "SNMPv3";

		go = g.option(form.Value, 'username',
			_('username'),
			_('Set username to access SNMP'));
		go.rmempty = false;
		go.optional = false;
		go.modalonly = true;

		go = g.option(form.Flag, 'allow_write',
			_('Allow write'));
		go.rmempty = false;
		go.default = '0';

		go = g.option(form.ListValue, 'auth_type',
			_('SNMPv3 authentication type'));
		go.value('', _('none'));
		go.value('SHA', _('SHA'));
		go.value('MD5', _('MD5'));
		go.rmempty = false;
		go.default = 'SHA';

		// SNMPv3 auth pass
		go = g.option(form.Value, 'auth_pass',
			_('SNMPv3 authentication passphrase'));
		go.password = true;
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;
		go.depends({'auth_type': "", "!reverse": true});

		// SNMPv3 privacy/encryption type
		go = g.option(form.ListValue, 'privacy_type',
			_('SNMPv3 encryption type'));
		go.value('', _('none'));
		go.value('AES', _('AES'));
		go.value('DES', _('DES'));
		go.rmempty = false;
		go.default = 'AES';

		// SNMPv3 privacy/encryption pass
		go = g.option(form.Value, 'privacy_pass',
			_('SNMPv3 encryption passphrase'));
		go.password = true;
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;
		go.depends({'privacy_type': "", "!reverse": true});

		go = g.option(form.ListValue, 'RestrictOID',
			_('OID-Restriction'));
		go.value('no', _('No'));
		go.value('yes', _('Yes'));
		go.default = 'no';
		go.optional = false;
		go.rmempty = false;

		this.oid = g.option(form.Value,
			'RestrictedOID',
			_('OID'));
		this.oid.datatype = 'string';
		this.oid.depends('RestrictOID', 'yes');
	},

	populateTrapsSettings: function(subsection, desc, s, type, data) {
		var g, go, o;
		
		o = s.taboption('traps', form.SectionValue, '__traps__',
			form.GridSection, subsection, null, desc);

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;
		g.modaltitle = desc;

		go = g.option(form.Value,
			type,
			_(type));
		if (type == 'HostIP'){
			go.datatype = 'ipaddr';
		}else{
			go.datatype = 'hostname';
		}
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value,
			'Port',
			_('Port'));
		go.datatype = 'port'
		go.default = '162'
		go.optional = true;
		go.rmempty = false;

		go = g.option(form.Value,
			'Community',
			_('Community'));
		go.datatype = 'string';
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.ListValue,
			'Type',
			_('Type'));
		go.value('trapsink', _('SNMPv1 Trap Receiver'));
		go.value('trap2sink', _('SNMPv2c Trap Receiver'));
		go.value('informsink', _('SNMPv2c Inform Receiver'));
		go.default = 'trapsink';
		go.optional = false;
		go.rmempty = false;
	},

	populateLogSettings: function(tab, s, data) {
		var g, go, o;

		o = s.taboption(tab, form.SectionValue, '__log__',
			form.GridSection, tab, null,
			_('Here you can configure Logging settings'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;

		go = g.option(form.Flag, 'log_file',
			_('Enable logging to file'));
		go.default = '0';
		go.rmempty = false;
		go.optional = false;

		go = g.option(form.Value, 'log_file_path',
			_('Path to log file'));
		go.default = '/var/log/snmpd.log';
		go.rmempty = false;
		go.placeholder = '/var/log/snmpd.log';
		go.depends('log_file', '1');

		go = g.option(form.ListValue, 'log_file_priority',
			_('Priority for file logging'),
			_('Will log messages of selected priority and above.'));
		go.default = 'info';
		go.value('emerg', _('LOG_EMERG'));
		go.value('alert', _('LOG_ALERT'));
		go.value('crit', _('LOG_CRIT'));
		go.value('err', _('LOG_ERR'));
		go.value('warn', _('LOG_WARNING'));
		go.value('notice', _('LOG_NOTICE'));
		go.value('info', _('LOG_INFO'));
		go.value('debug', _('LOG_DEBUG'));
		go.depends('log_file', '1');

		go = g.option(form.Flag, 'log_syslog',
			_('Enable logging to syslog'));
		go.default = '0';
		go.rmempty = false;
		go.optional = false;

		go = g.option(form.ListValue, 'log_syslog_facility',
			_('Syslog facility'));
		go.default = 'info';
		go.value('daemon', _('LOG_DAEMON'));
		go.value('user', _('LOG_USER'));
		go.value('local0', _('LOG_LOCAL0'));
		go.value('local1', _('LOG_LOCAL1'));
		go.value('local2', _('LOG_LOCAL2'));
		go.value('local3', _('LOG_LOCAL3'));
		go.value('local4', _('LOG_LOCAL4'));
		go.value('local5', _('LOG_LOCAL5'));
		go.value('local6', _('LOG_LOCAL6'));
		go.value('local7', _('LOG_LOCAL7'));
		go.depends('log_syslog', '1');

		go = g.option(form.ListValue, 'log_syslog_priority',
			_('Priority for syslog logging'),
			_('Will log messages of selected priority and above.'));
		go.default = 'i';
		go.value('emerg', _('LOG_EMERG'));
		go.value('alert', _('LOG_ALERT'));
		go.value('crit', _('LOG_CRIT'));
		go.value('err', _('LOG_ERR'));
		go.value('warn', _('LOG_WARNING'));
		go.value('notice', _('LOG_NOTICE'));
		go.value('info', _('LOG_INFO'));
		go.value('debug', _('LOG_DEBUG'));
		go.depends('log_syslog', '1');
	},

	render: function(data) {
		var m, s, o, g, go;

		m = new form.Map("snmpd",
			_("SNMP Settings"),
			_("On this page you may configure SNMP settings"));

		s = m.section(form.TypedSection, "snmpd");
		s.anonymous = true;
		s.addremove = false;

		s.tab("general", _("SNMP - General"));

		this.populateSystemSettings('general', s, data);
		this.populateGlobalSettings('general', s, data);

		s.tab("advanced", _("Advanced Settings"));
		this.populateAdvancedSettings('advanced', s, data);

		s.tab("v1/v2c", _("SNMPv1/SNMPv2c"));
		this.populateV1V2CSettings("access_default",
			_("Communities for any hosts"), null, s, data);
		this.populateV1V2CSettings("access_HostName",
			_("Communities via hostname"), "HostName", s, data);
		this.populateV1V2CSettings("access_HostIP",
			_("Communities via IP-Address range"), "HostIP", s, data);

		s.tab("v3", _("SNMPv3"));
		this.populateV3Settings('v3', s, data);

		s.tab("traps", _("Traps", "SNMP"));
		this.populateTrapsSettings('trap_HostName', 'Traps via Hostname',
			s, "HostName", data);
		this.populateTrapsSettings('trap_HostIP', 'Traps via IP-Address',
			s, "HostIP", data);


		s.tab("log", _("Logging"));
		this.populateLogSettings("log", s, data);

		return m.render();
	}
});
