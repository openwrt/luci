// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
'use strict';
'require form';
'require ui';
'require view';

var desc = _(""
    + "SNMPD is a master daemon/agent for SNMP, from the <a href='http://www.net-snmp.org'>"
    + "net-snmp project</a>. "
    + "Note, OpenWrt has mostly complete UCI support for snmpd, but this LuCI applet "
    + "only covers a few of those options. In particular, there is very little/no validation "
    + "or help. See /etc/config/snmpd for manual configuration."
);

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map("snmpd", _("net-snmp's SNMPD"), desc);

		s = m.section(form.TypedSection, "agent", _("Agent settings"));
		s.anonymous = true;
		o = s.option(form.Value, "agentaddress", _("The address the agent should listen on"),
			_("Eg: UDP:161, or UDP:10.5.4.3:161 to only listen on a given interface"));

		s = m.section(form.TypedSection, "agentx", _("AgentX settings"),
			_("Delete this section to disable AgentX"));
		s.anonymous = true;
		o = s.option(form.Value, "agentxsocket", _("The address the agent should allow AgentX connections to"),
			_("This is only necessary if you have subagents using the agentX "
			+ "socket protocol. Eg: /var/run/agentx.sock"));
		s.addremove = true;

		s = m.section(form.TypedSection, "com2sec", _("com2sec security"));
		o = s.option(form.Value, "secname", "secname");
		o = s.option(form.Value, "source", "source");
		o = s.option(form.Value, "community", "community");

		s = m.section(form.TypedSection, "group", "group", _("Groups help define access methods"));
		s.addremove = true;
		s.option(form.Value, "group", "group");
		s.option(form.Value, "version", "version");
		s.option(form.Value, "secname", "secname");

		s = m.section(form.TypedSection, "access", "access");
		s.option(form.Value, "group", "group");
		s.option(form.Value, "context", "context");
		s.option(form.Value, "version", "version");
		s.option(form.Value, "level", "level");
		s.option(form.Value, "prefix", "prefix");
		s.option(form.Value, "read", "read");
		s.option(form.Value, "write", "write");
		s.option(form.Value, "notify", "notify");

		s = m.section(form.TypedSection, "system", _("System"), _("Values used in the MIB2 System tree"));
		s.anonymous = true;
		s.option(form.Value, "sysLocation", "sysLocation");
		s.option(form.Value, "sysContact", "sysContact");
		s.option(form.Value, "sysName", "sysName");

		return m.render();
	}
});
