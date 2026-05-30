'use strict';
'require view';
'require form';

return view.extend({
	render: function () {
		var docsRefAttrs = 'target="_blank" rel="noreferrer" href="https://emailrelay.sourceforge.net/';
		let m, s, o;

		m = new form.Map('emailrelay', _('Email Server Configuration'),
			_('E-MailRelay Server Configuration.') + '<br />' +
			_('For further information <a %s>check the documentation</a>')
				.format('href="https://openwrt.org/docs/guide-user/services/email/emailrelay" target="_blank" rel="noreferrer"')
		);

		s = m.section(form.GridSection, 'emailrelay', _('Instance config'));
		s.anonymous = false;
		s.addremove = true;
		s.nodescriptions = true;


		o = s.tab('smtp_server', _('SMTP Server'));
		o = s.tab('smtp_client', _('SMTP Client'));
		o = s.tab('pop_server', _('POP3'));
		o = s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('smtp_server', form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;

		o = s.taboption('smtp_server', form.ListValue, 'mode', _('Mode'),
			_('See <a %s>Running E-MailRelay</a>')
				.format(docsRefAttrs + '#userguide_md_Running_E_MailRelay"')
		);
		o.value('server', _('Server: receive incoming mail'));
		o.value('proxy', _('Proxy: submission outgoing mail, store and forward to smarthost SMTP server'));
		o.value('cmdline', _('Manual command line options (deprecated)'));
		o.default = 'server';
		o.rmempty = false;

		o = s.taboption('smtp_server', form.Value, 'port', _('SMTP Port'),
			_('SMTP Port to listen for incoming emails.') + '<br />' +
			_('Incoming mail by default received on <em>25</em> port.') + '<br />' +
			_('Outcoming mail by usually received on <em>587</em> or <em>465</em> (TLS only) ' +
				'but the <em>25</em> is also used often.')
		);
		o.datatype = 'port';
		o.default = '25';

		o = s.taboption('smtp_server', form.Flag, 'remote_clients', _('Allow remote clients'),
			_('Allow connections from the public internet.') + '<br />' +
			_('<b>You may receive spam so be careful</b>.') + '<br />' +
			_('Enable ports in firewall.') + '<br />' +
			_('See <a %s>--remote-clients</a>')
				.format(docsRefAttrs + '#__remote_clients"')
		);
		o.modalonly = true;
		o.default = '0';

		o = s.taboption('smtp_server', form.Flag, 'anonymous', _('Anonymous'),
			_('Reduce the amount of information leaked to remote clients.') + '<br />' +
			_('See <a %s>--anonymous</a>')
				.format(docsRefAttrs + '#__anonymous"')
		);
		o.modalonly = true;
		o.default = '0';

		o = s.taboption('smtp_server', form.Value, 'domain', _('Domain'),
			_('Specifies the server\'s domain name that is used in SMTP EHLO.') + '<br />' +
			_('By default, the local hostname is used.') + '<br />' +
			_('See <a %s>--domain</a>')
				.format(docsRefAttrs + '#__domain"')
		);
		o.datatype = 'hostname';
		o.optional = true;
		o.rmempty = false;
		o.depends('anonymous', '0');

		o = s.taboption('smtp_server', form.FileUpload, 'server_auth', _('Auth file'),
			_('Server/proxy authorization file.') + '<br />' +
			_('See <a %s>Authentication</a>')
				.format(docsRefAttrs + '#reference_md_Authentication"')
		);
		o.datatype = 'file';
		o.root_directory = '/';
		o.default = '/etc/emailrelay.auth';
		o.optional = true;
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('smtp_server', form.Flag, 'server_tls', _('Enable TLS for server'),
			_('Use TLS encryption for SMTP and POP connections.') + '<br />' +
			_('Configure <a %s>acme.sh to issue a TLS cert</a>.')
				.format('href="https://openwrt.org/docs/guide-user/services/tls/acmesh" target="_blank" rel="noreferrer"') + '<br />' +
			_('See <a %s>TLS encryption</a>')
				.format(docsRefAttrs + '#reference_md_TLS_encryption"')
		);
		o.default = '0';
		o.optional = true;
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('smtp_server', form.FileUpload, 'server_tls_key', _('TLS private key'),
			_('Path to TLS private key.') + '<br />' +
			_('E.g. ') + '<code>/etc/ssl/acme/example.com.key</code>'
		);
		o.datatype = 'file';
		o.root_directory = '/';
		o.optional = true;
		o.rmempty = true;
		o.modalonly = true;
		o.depends('server_tls', '1');

		o = s.taboption('smtp_server', form.FileUpload, 'server_tls_certificate', _('TLS certificate'),
			_('Path to TLS cert.') + '<br />' +
			_('E.g. ') + '<code>/etc/ssl/acme/example.com.fullchain.crt</code>'
		);
		o.datatype = 'file';
		o.root_directory = '/';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('server_tls', '1');

		o = s.taboption('smtp_server', form.Value, 'server_tls_verify', _('CA certificate'),
			_('Verify an SMTP and POP client\'s certificates ' +
				'against trusted CA certificates in the specified file or directory.') + '<br />' +
			_('In many use cases this should be your self-signed root certificate.') + '<br />' +
			_('Use <code>&lt;default&gt;</code> to use the system trusted CAs.')
		);
		o.datatype = 'or(file, directory, "<default>")';
		o.default = '<default>';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('server_tls', '1');

		o = s.taboption('smtp_server', form.Value, 'spool_dir', _('Mail storage directory'),
			_('The directory used for holding received mail messages.') + '<br />' +
			_('<b>Note:</b> The <code>/var/</code> is a small in-memory folder and you\'ll lose mail in reboot.') + '<br />' +
			_('Instead, use a mounted disk with enough of space.')
		);
		o.datatype = 'directory';
		o.default = '/var/spool/emailrelay';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;


		o = s.taboption('smtp_client', form.Value, 'smarthost', _('Smarthost'),
			_('The SMTP server to forward emails')
		);
		o.datatype = 'host';
		o.optional = false;
		o.rmempty = false;
		o.depends('mode', 'proxy');

		o = s.taboption('smtp_client', form.FileUpload, 'client_auth', _('Client authorization file'),
			_('A file that contains credentials for SMTP smarthost client.') + '<br />' +
			_('See <a %s>Authentication</a>')
				.format(docsRefAttrs + '#reference_md_Authentication"')
		);
		o.datatype = 'file';
		o.root_directory = '/';
		o.default = '/etc/emailrelay.auth';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('mode', 'proxy');

		o = s.taboption('smtp_client', form.Flag, 'client_tls', _('Enable SMTP client TLS'),
			_('Use TLS encryption for SMTP proxy client.') + '<br />' +
			_('See example for <a %s>Gmail</a>')
				.format(docsRefAttrs + '#userguide_md_Google_mail"')
		);
		o.default = '0';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('mode', 'proxy');

		o = s.taboption('smtp_client', form.FileUpload, 'client_tls_key', _('TLS private key'),
			_('Path to TLS private key.')
		);
		o.datatype = 'file';
		o.root_directory = '/';
		o.optional = true;
		o.rmempty = true;
		o.modalonly = true;
		o.depends('client_tls', '1');

		o = s.taboption('smtp_client', form.FileUpload, 'client_tls_certificate', _('TLS certificate'),
			_('Path to TLS cert.')
		);
		o.datatype = 'file';
		o.root_directory = '/';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('client_tls', '1');

		o = s.taboption('smtp_client', form.Value, 'client_tls_verify', _('CA certificate'),
			_('Verify an SMTP server\'s certificate ' +
				'against trusted CA certificates in the specified file or directory.') + '<br />' +
			_('Use <code>&lt;default&gt;</code> to use the system trusted CAs.')
		);
		o.datatype = 'or(file, directory, "<default>")';
		o.default = '<default>';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('client_tls', '1');


		o = s.taboption('pop_server', form.Flag, 'pop', _('Enable POP3'),
			_('The POP3 used to fetch a mail.') + '<br />' +
			_('See <a %s>Running as a POP server</a>')
				.format(docsRefAttrs + '#userguide_md_Running_as_a_POP_server"')
		);
		o.default = '0';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('mode', 'server');

		o = s.taboption('pop_server', form.FileUpload, 'pop_auth', _('POP Auth file'),
			_('A file containing POP accounts and their credentials.')
		);
		o.datatype = 'file';
		o.root_directory = '/';
		o.default = '/etc/emailrelay.auth';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('pop', '1');

		o = s.taboption('pop_server', form.Flag, 'pop_by_name', _('POP by name'),
			_('Modifies the spool directory used by the POP server to be a sub-directory ' +
				'with the same name as the POP authentication user-id.')
		);
		o.default = '1';
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('pop', '1');


		o = s.taboption('advanced', form.Value, 'dnsbl', _('DNSBL'),
			_('<a %s>DNS Block List (DNSBL)</a> used to block connections from known spammers.')
				.format('href="https://en.wikipedia.org/wiki/DNSBL" target="_blank" rel="noreferrer"') + '<br />' +
			_('Starts with the transport DNS server\'s address:port, a timeout in milliseconds, a rejection threshold and list of DNSBL servers.') + '<br />' +
			_('E.g. ') + '<code>127.0.0.1:53,5000,1,zen.spamhaus.org,bl.mailspike.net</code><br />' +
			_('If the threshold number of servers deny the incoming connection\'s network address then it\'s dropped.') + '<br />' +
			_('A threshold of zero is useful for testing and means only to log a result code but allow a connection.') + '<br />' +
			_('See <a %s>Connection blocking</a>')
				.format(docsRefAttrs + '#reference_md_Connection_blocking"')
		);
		o.datatype = 'string';
		o.optional = true;
		o.rmempty = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'address_verifier', _('Address verifier'),
			_('Runs the specified external program to verify a message recipient\'s email address.') + '<br />' +
			_('See <a %s>Address verification</a>')
				.format(docsRefAttrs + '#reference_md_Address_verification"')
		);
		// o.default = "allow:/etc/emailrelay.auth";
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'filter', _('Filter'),
			_('Runs the specified external filter program whenever a mail message is stored.') + '<br />' +
			_('See <a %s>--filter</a>')
				.format(docsRefAttrs + '#__filter"')
		);
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'extra_cmdline', _('Extra command line options'),
			_('Specify additional arguments that should be passed to the EmailRelay.') + '<br />' +
			_('See <a %s>Command line reference</a>')
				.format(docsRefAttrs + '#reference_md_Reference"')
		);
		o.optional = true;
		o.rmempty = false;
		o.modalonly = true;
		o.modalonly = true;

		return m.render();
	},
});
