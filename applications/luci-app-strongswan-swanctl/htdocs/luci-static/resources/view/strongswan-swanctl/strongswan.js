'use strict';
'require form';
'require view';
'require tools.widgets as widgets';

return view.extend({
	render: function (result) {
		let m, s, o;

		m = new form.Map('ipsec', _('Service configuration'),
			_('On this page, you can configure the IPsec service.'));
		m.tabbed = true;

		// general settings
		s = m.section(form.NamedSection, 'globals', 'globals', _('General Settings'),
			_('Configure global service parameters.'));

		o = s.option(widgets.NetworkSelect, 'interface', _('Listening Interfaces'),
			_('Interfaces that accept VPN traffic.') + '<br /> ' +
			_('Select an interface or leave empty for all interfaces.'));
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;

		// syslog plugin settings
		s = m.section(form.NamedSection, 'syslog', 'plugin' , _('Syslog Settings'),
			_('Configure how strongswan logs events, errors, and debug information.'));

		o = s.option(form.ListValue, 'app', 'app', _('Applications other than daemons'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'asn', 'asn', _('Low-level encoding/decoding (ASN.1, X.509 etc.)'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'cfg', 'cfg', _('Configuration management and plugins'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'chd', 'chd', _('CHILD_SA/IPsec_SA'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'dmn', 'dmn', _('Main daemon setup/cleanup/signal handling'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'enc', 'enc', _('Packet encoding/decoding encryption/decryption operations'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'esp', 'esp', '%s (%s)'.format(_('Library messages'), 'libipsec'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'ike', 'ike', _('IKE_SA / ISAKMP SA'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'imc', 'imc', _('Integrity Measurement Collector'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'imv', 'imv', _('Integrity Measurement Verifier'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'job', 'job', _('Jobs queuing/processing and thread pool management'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'wch', 'wch', _('File descriptor watcher'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'knl', 'knl', _('IPsec/Networking kernel interface'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'lib', 'lib', '%s (%s)'.format(_('Library messages'), 'libstrongswan'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'mgr', 'mgr', _('IKE_SA manager, handling synchronization for IKE_SA access'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'net', 'net', _('IKE network communication'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'pts', 'pts', _('Platform Trust Service'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'tls', 'tls', '%s (%s)'.format(_('Library messages'), 'libtls'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		o = s.option(form.ListValue, 'tnc', 'tnc', _('Trusted Network Connect'));
		o.value('-1', _('Absolutely silent'));
		o.value('0', _('Very basic auditing logs'));
		o.value('', _('Generic control flow with errors (default)'));
		o.value('2', _('More detailed debugging control flow'));
		o.value('3', _('Including RAW data dumps in hex'));
		o.value('4', _('Also include sensitive material in dumps, e.g. keys'));
		o.default = '';

		return m.render();
	}
});
