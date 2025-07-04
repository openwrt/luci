// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
'use strict';
'require form';
'require ui';
'require view';

return L.view.extend({
	render: function() {
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

		go = g.option(form.Value, 'agentaddress', _('The address the agent should listen on'),
			_('Eg: UDP:161, or UDP:10.5.4.3:161 to only listen on a given interface'));

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
