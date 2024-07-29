// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
'use strict';
'require form';
'require uci';
'require fs';
'require rpc';
'require ui';
'require view';

return L.view.extend({
	load: function() {
		return Promise.all([
			uci.load('snmpd'),
		]);
	},

	__init__: function() {
		this.super('__init__', arguments);

		this.ip_protocol = null;
		this.snmp_version = null;
	},

	render: function(data) {
		let m, s, o, g, go;

		m = new form.Map('snmpd',
			_('SNMP Settings'),
			_('On this page you may configure SNMP settings'));

		s = m.section(form.TypedSection, 'snmpd');
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('SNMP - General'));

		o = s.taboption('general', form.SectionValue, '__general__',
			form.TypedSection, 'system', _('System settings'),
			_('Here you can configure system settings'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		go = g.option(form.Value, 'sysLocation', 'sysLocation');
		go = g.option(form.Value, 'sysContact', 'sysContact');
		go = g.option(form.Value, 'sysName', 'sysName');

		o = s.taboption('general', form.SectionValue, '__general__',
			form.TypedSection, 'snmpd', _('Common Settings'),
			_('Here you can configure common settings'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		go = g.option(form.Flag, 'enabled', _('Enable SNMP'),
			_('Enable to use SNMP'));
		go.default = '0';
		go.rmempty = false;

		this.ip_protocol = g.option(form.ListValue, 'ip_protocol', _('IP version'));
		this.ip_protocol.value('ipv4', _('Only IPv4'));
		this.ip_protocol.value('ipv6', _('Only IPv6'));
		this.ip_protocol.value('ipv4/ipv6', _('IPv4 and IPv6'));
		this.ip_protocol.optional = false;
		this.ip_protocol.forcewrite = true;
		this.ip_protocol.default = 'ipv4';
		this.ip_protocol.rmempty = false;

		this.ip_protocol.cfgvalue = function(section_id) {
			let ip_protocol = uci.get('snmpd', section_id, 'ip_protocol');

			if (!ip_protocol) {
				const s = uci.get_first('snmpd', 'agent');
				if (!s)
					return null;

				const rawAddr = uci.get('snmpd', s['.name'], 'agentaddress');
				if (!rawAddr)
					return null;

				const addr = rawAddr.toUpperCase();
				const p = [];

				if (addr.match(/UDP:\d+/g))
					p.push('ipv4');

				if (addr.match(/UDP6:\d+/g))
					p.push('ipv6');

				ip_protocol = p.join('/');
			}

			return ip_protocol;
		};

		go = g.option(form.Value, 'agentaddress', _('The address the agent should listen on'),
			_('Eg: UDP:161, or UDP:10.5.4.3:161 to only listen on a given interface'));

		this.snmp_version = g.option(form.ListValue, 'snmp_version',
			_('SNMP version'),
			_('SNMP version used to monitor and control the device'));
		this.snmp_version.default = 'v1/v2c';
		this.snmp_version.rmempty = false;
		this.snmp_version.forcewrite = true;
		this.snmp_version.value('v1/v2c', _('SNMPv1 and SNMPv2c'));
		this.snmp_version.value('v1/v2c/v3', _('SNMPv1, SNMPv2c and SNMPv3'));
		this.snmp_version.value('v3', _('Only SNMPv3'));

		go = g.option(form.Value,  'agentxsocket', _('The address the agent should allow AgentX connections to'),
			_('This is only necessary if you have subagents using the agentX '
			+ 'socket protocol. Eg: /var/run/agentx.sock'));

		s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('advanced', form.SectionValue, '__advanced__',
			form.GridSection, 'com2sec', null,
			_('Here you can configure com2sec options'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, 'secname', _('Secname'),
			_('Arbitrary label for use in group settings'));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, 'source', _('Source'),
			_('Source describes a host or network'));
		go.rmempty = false;

		go = g.option(form.Value, 'community', _('Community'),
			_('The community name that is used'));
		go.optional = false;
		go.rmempty = false;

		o = s.taboption('advanced', form.SectionValue, '__advanced__',
			form.GridSection, 'group', null,
			_('Here you can configure group options'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, 'group', _('Group'),
			_('A group maps com2sec names to access names'));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, 'version', _('Version'),
			_('The used version for the group'));
		go.value('v1', _('SNMPv1'));
		go.value('v2c' _('SNMPv2c'));
		go.value('usm', _('SNMPv3'));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, 'secname', _('Secname'),
			_('Here you define which secname is mapped to the group'));
		go.optional = false;
		go.rmempty = false;

		o = s.taboption('advanced', form.SectionValue, '__advanced__',
			form.GridSection, 'access', null,
			_('Here you can configure access options'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, 'group', _('Group'),
			_('The group that is mapped to the views (Read, Write, Notify)'));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, 'context', _('Context'),
			_('The context of the request'));
		go.default = 'none';
		go.modalonly = true;

		go = g.option(form.Value, 'version', _('Version'),
			_('The used version for access configuration'));
		go.value('any', _('Any version'));
		go.value('v1', _('SNMPv1'));
		go.value('v2c' _('SNMPv2c'));
		go.value('usm', _('SNMPv3'));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, 'level', _('Level'),
			_('Level of security'));
		go.value('noauth', _('No authentication (standard for SNMPv1/v2c)'));
		go.value('auth', _('Authentication'));
		go.value('priv', _('Authentication and encryption'));
		go.default = 'noauth';
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, 'prefix', _('Prefix'),
			_('Specification how context of requests is matched to context'));
		go.value('exact', _('Exact'));
		go.value('prefix', _('Prefix'));
		go.optional = false;
		go.default = 'excact';
		go.rmempty = false;

		go = g.option(form.Value, 'read', _('Read'),
			_('Read access modification for groups'));
		go.value('all', _('All'));
		go.value('none', _('None'));
		go.default = 'none';
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		go = g.option(form.Value, 'write', _('Write'),
			_('Write access modification for groups'));
		go.value('all', _('All'));
		go.value('none', _('None'));
		go.default = 'none';
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		go = g.option(form.Value, 'notify', _('Notify'),
			_('Notify access modification for groups'));
		go.value('all', _('All'));
		go.value('none', _('None'));
		go.default = 'none';
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		return m.render();
	}
});
