'use strict';
'require view';
'require form';
'require uci';
'require corosync.qnetd as qnetd';
/* global qnetd */

return view.extend({
	load: () => Promise.all([ uci.load('corosync-qnetd'), qnetd.status() ]),

	render(data) {
		const status = data[1];
		this.connectedClients = qnetd.clients(status);
		const map = new form.Map('corosync-qnetd', _('Corosync QNetd configuration'),
			_('Changes to the listener can disconnect quorum clients. Apply changes only when cluster quorum remains safe.'));
		const section = map.section(form.NamedSection, 'main', 'qnetd', _('QNetd server'));
		section.addremove = false;

		let option = section.option(form.Flag, 'enabled', _('Enable service'));
		option.default = '0';
		option.rmempty = false;

		option = section.option(form.ListValue, 'address_family', _('Address family'));
		option.value('any', _('IPv4 and IPv6'));
		option.value('ipv4', _('IPv4 only'));
		option.value('ipv6', _('IPv6 only'));
		option.default = 'any';

		option = section.option(form.Value, 'listen_address', _('Listen address'));
		option.datatype = 'ipaddr';
		option.placeholder = _('All local addresses');
		option.rmempty = true;

		option = section.option(form.Value, 'port', _('TCP port'));
		option.datatype = 'port';
		option.default = '5403';
		option.rmempty = false;

		option = section.option(form.ListValue, 'tls', _('TLS policy'));
		option.value('req', _('Required (recommended)'));
		option.value('on', _('Enabled with plaintext fallback'));
		option.value('off', _('Disabled'));
		option.default = 'req';
		option.description = _('Values other than “required” weaken transport security and are highlighted on the overview.');

		option = section.option(form.ListValue, 'client_cert_required', _('Client certificate'));
		option.value('on', _('Required (recommended)'));
		option.value('off', _('Not required'));
		option.default = 'on';

		option = section.option(form.Value, 'max_clients', _('Maximum clients'));
		option.datatype = 'uinteger';
		option.default = '0';
		option.description = _('Zero uses the daemon default.');

		option = section.option(form.ListValue, 'debug', _('Debug level'));
		option.value('0', _('Disabled'));
		option.value('1', _('Debug'));
		option.value('2', _('Verbose debug'));
		option.default = '0';

		if (qnetd.clients(status))
			map.description += ' ' + _('There are currently %d connected clients.').format(qnetd.clients(status));

		return map.render();
	},

	handleSaveApply(ev, mode) {
		if (this.connectedClients && !confirm(_('Applying listener or TLS changes may disconnect %d current client(s). Continue?').format(this.connectedClients)))
			return;
		return this.super('handleSaveApply', [ ev, mode ]);
	}
});
