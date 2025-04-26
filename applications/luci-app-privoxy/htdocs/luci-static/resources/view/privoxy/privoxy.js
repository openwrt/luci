'use strict';
'require uci';
'require form';
'require rpc';
'require tools.widgets as widgets';
'require fs';
'require view';

return view.extend({

	render: function(data) {
		const m = new form.Map('privoxy', _('Privoxy'),
			_('Configure the Privoxy proxy daemon settings.'));

		const s = m.section(form.NamedSection, 'privoxy', 'privoxy', _('Privoxy Settings'));


		// Tab: System
		s.tab('sys', _('System'));
		s.taboption('sys', form.Flag, '_enabled', _('Enabled'), _('Enable/Disable autostart of Privoxy'))

		let bootDelay = s.taboption('sys', form.Value, 'boot_delay', _('Boot delay'),
			_('Delay (in seconds) during system boot before Privoxy starts.'));

		bootDelay.datatype = 'uinteger';
		bootDelay.placeholder = '10';
		bootDelay.default = '10';


		// Tab: Documentation
		s.tab('doc', _('Documentation'), _("If you intend to operate Privoxy for more users than just yourself, "
		+ "it might be a good idea to let them know how to reach you, what you block "
		+ "and why you do that, your policies, etc."));

		s.taboption('doc', form.Value, 'hostname', _('Hostname'),
			_('The hostname shown on the CGI pages.'))
		//.placeholder = sys.hostname();

		s.taboption('doc', form.Value, 'user_manual', _('User Manual'),
			_('Location of the Privoxy User Manual.')).placeholder = 'http://www.privoxy.org/user-manual/';

		let adminEmail = s.taboption('doc', form.Value, 'admin_address', _('Admin Email'),
			_('Email address for the Privoxy administrator.'));
		adminEmail.datatype = 'email';
		adminEmail.placeholder = 'privoxy.admin@example.com';

		s.taboption('doc', form.Value, 'proxy_info_url', _('Proxy Info URL'),
			_('URL to documentation about the local Privoxy setup.'));

		s.taboption('doc', form.Value, 'trust_info_url', _('Trust Info URL'),
			_('URL shown if access to an untrusted page is denied. Only applies if trust mechanism is enabled.'));


		// Tab: Filter
		s.tab('filtering', _('Files and Directories'), _("Privoxy can (and normally does) use a number of other files "
		+ "for additional configuration, help and logging. This section of "
		+ "the configuration file tells Privoxy where to find those other files."));

		// LOGDIR
		let logdir = s.taboption('filtering', form.Value, 'logdir', _('Log Directory'),
			_('The directory where all logging takes place (i.e. where the logfile is located).<br />No trailing "/", please.'));
		logdir.default = '/var/log';
		logdir.rmempty = false;

		// LOGFILE
		let logfile = s.taboption('filtering', form.Value, 'logfile', _('Log File'),
			_('The log file to use. File name, relative to log directory.'));
		logfile.default = 'privoxy.log';
		logfile.rmempty = false;
		logfile.validate = function(section_id, value) {
			if (!value || value.trim() === '')
				return _('Mandatory Input: No File given!');
			return true;
		};

		// CONFDIR
		let confdir = s.taboption('filtering', form.Value, 'confdir', _('Configuration Directory'),
			_('The directory where the other configuration files are located.'));
		confdir.default = '/var/etc/privoxy';
		confdir.rmempty = false;

		// TEMPLDIR
		let templdir = s.taboption('filtering', form.Value, 'templdir', _('Template Directory'),
			_('An alternative directory where the templates are loaded from.<br />No trailing "/", please.'));
		templdir.placeholder = '/etc/privoxy/templates';
		templdir.rmempty = true;

		// TEMPORARY DIRECTORY
		let tmpdir = s.taboption('filtering', form.Value, 'temporary_directory', _('Temporary Directory'),
			_("A directory where Privoxy can create temporary files.<br /><strong>Only when using 'external filters', Privoxy has to create temporary files.</strong>"));
		tmpdir.rmempty = true;
		tmpdir.placeholder = '/tmp';
		tmpdir.default = '/tmp';

		// ACTIONSFILE
		let actionsfile = s.taboption('filtering', form.DynamicList, 'actionsfile', _('Action Files'),
			_('The actions file(s) to use. Multiple actionsfile lines are permitted, and are in fact recommended!') +
			'<br /><strong>match-all.action := </strong>' + _('Actions that are applied to all sites and maybe overruled later on.') +
			'<br /><strong>default.action := </strong>' + _('Main actions file') +
			'<br /><strong>user.action := </strong>' + _('User customizations'));
		actionsfile.rmempty = true;

		// FILTERFILE
		let filterfile = s.taboption('filtering', form.DynamicList, 'filterfile', _('Filter files'),
			_('The filter files contain content modification rules that use regular expressions.'));
		filterfile.rmempty = true;


		// TRUSTFILE
		let trustfile = s.taboption('filtering', form.Value, 'trustfile', _('Trust file'),
			_('The trust mechanism is an experimental feature for building white-lists and should be used with care.') +
			'<br /><strong>' + _('It is NOT recommended for the casual user.') + '</strong>');
		trustfile.placeholder = 'user.trust';
		trustfile.rmempty = true;


		// Tab: Access
		s.tab('access', _('Access Control'), _("This tab controls the security-relevant aspects of Privoxy's configuration."));

		// LISTEN ADDRESS
		let listen = s.taboption('access', form.DynamicList, 'listen_address', _('Listen addresses'),
			_('The address and TCP port on which Privoxy will listen for client requests.') + '<br />' +
			_('Syntax: ') + 'IPv4:Port / [IPv6]:Port / Host:Port');
		listen.default = '127.0.0.1:8118';
		listen.rmempty = false;
		listen.datatype = 'or(hostport,ipaddrport(1))';

		// PERMIT ACCESS
		let permit = s.taboption('access', form.DynamicList, 'permit_access', _('Permit access'),
			_('Who can access what.') + '<br /><strong>' + _('Please read Privoxy manual for details!') + '</strong>');
		permit.rmempty = true;
		permit.datatype = 'ipmask';

		// DENY ACCESS
		let deny = s.taboption('access', form.DynamicList, 'deny_access', _('Deny access'),
			_('Who can access what.') + '<br /><strong>' + _('Please read Privoxy manual for details!') + '</strong>');
		deny.rmempty = true;
		deny.datatype = 'ipmask';

		// BUFFER LIMIT
		let buffer = s.taboption('access', form.Value, 'buffer_limit', _('Buffer Limit'),
			_('Maximum size (in KB) of the buffer for content filtering.') + '<br />' +
			_('Value range 1 to 4096, no entry defaults to 4096'));
		buffer.default = 4096;
		buffer.rmempty = true;
		buffer.datatype = 'and(uinteger,min(1),max(4096))'

		// TOGGLE
		let toggle = s.taboption('access', form.Flag, 'toggle', _('Toggle Status'),
			_('Enable/Disable filtering when Privoxy starts.') + '<br />' +
			_('Disabled == Transparent Proxy Mode'));
		toggle.default = '1';
		toggle.rmempty = false;

		// ENABLE REMOTE TOGGLE
		let remoteToggle = s.taboption('access', form.Flag, 'enable_remote_toggle', _('Enable remote toggle'),
			_('Whether or not the web-based toggle feature may be used.'));
		remoteToggle.rmempty = true;

		// ENABLE REMOTE HTTP TOGGLE
		let httpToggle = s.taboption('access', form.Flag, 'enable_remote_http_toggle', _('Enable remote toggle via HTTP'),
			_('Whether or not Privoxy recognizes special HTTP headers to change toggle state.') + '<br /><strong>' +
			_('This option will be removed in future releases as it has been obsoleted by the more general header taggers.') + '</strong>');
		httpToggle.rmempty = true;

		// ENABLE EDIT ACTIONS
		let editActions = s.taboption('access', form.Flag, 'enable_edit_actions', _('Enable action file editor'),
			_('Whether or not the web-based actions file editor may be used.'));
		editActions.rmempty = true;

		// ENFORCE BLOCKS
		let enforce = s.taboption('access', form.Flag, 'enforce_blocks', _('Enforce page blocking'),
			_('If enabled, Privoxy hides the "go there anyway" link. The user obviously should not be able to bypass any blocks.'));
		enforce.rmempty = true;


		// Tab: Forward
		s.tab('forward', _('Forwarding'), ("Configure here the routing of HTTP requests through a chain of multiple proxies. "
		+ "Note that parent proxies can severely decrease your privacy level. "
		+ "Also specified here are SOCKS proxies."));
		let o = s.taboption("forward", form.Flag, "enable_proxy_authentication_forwarding", _("Enable proxy authentication forwarding"));
		o.description = _("Whether or not proxy authentication through Privoxy should work.") +
		    "<br /><strong>" + _("Enabling this option is NOT recommended if there is no parent proxy that requires authentication!") + "</strong>";

		o = s.taboption("forward", form.DynamicList, "forward", _("Forward HTTP"));
		o.description = _("To which parent HTTP proxy specific requests should be routed.") +
		    "<br />" + _("Syntax: target_pattern http_parent[:port]");

		o = s.taboption("forward", form.DynamicList, "forward_socks4", _("Forward SOCKS 4"));
		o.description = _("Through which SOCKS proxy (and optionally to which parent HTTP proxy) specific requests should be routed.") +
		    "<br />" + _("Syntax: target_pattern socks_proxy[:port] http_parent[:port]");

		o = s.taboption("forward", form.DynamicList, "forward_socks4a", _("Forward SOCKS 4A"));
		o.description = _("Through which SOCKS proxy (and optionally to which parent HTTP proxy) specific requests should be routed.") +
		    "<br />" + _("Syntax: target_pattern socks_proxy[:port] http_parent[:port]");

		o = s.taboption("forward", form.DynamicList, "forward_socks5", _("Forward SOCKS 5"));
		o.description = _("Through which SOCKS proxy (and optionally to which parent HTTP proxy) specific requests should be routed.") +
		    "<br />" + _("Syntax: target_pattern [user:pass@]socks_proxy[:port] http_parent[:port]");

		o = s.taboption("forward", form.DynamicList, "forward_socks5t", _("Forward SOCKS 5t"));
		o.description = _("Through which SOCKS proxy (and optionally to which parent HTTP proxy) specific requests should be routed.") +
		    "<br />" + _("Syntax: target_pattern [user:pass@]socks_proxy[:port] http_parent[:port]");


		// Tab: Misc
		s.tab('misc', _('Misc'));

		o = s.taboption("misc", form.Flag, "accept_intercepted_requests", _("Accept intercepted requests"));
		o.description = _("Whether intercepted requests should be treated as valid.");
		o.orientation = "horizontal";

		o = s.taboption("misc", form.Flag, "allow_cgi_request_crunching", _("Allow CGI request crunching"));
		o.description = _("Whether requests to Privoxy's CGI pages can be blocked or redirected.");
		o.orientation = "horizontal";

		o = s.taboption("misc", form.Flag, "split_large_forms", _("Split large forms"));
		o.description = _("Whether the CGI interface should stay compatible with broken HTTP clients.");
		o.orientation = "horizontal";

		o = s.taboption("misc", form.Value, "keep_alive_timeout", _("Keep-alive timeout"));
		o.description = _("Number of seconds after which an open connection will no longer be reused.");
		o.datatype = 'uinteger';

		o = s.taboption("misc", form.Flag, "tolerate_pipelining", _("Tolerate pipelining"));
		o.description = _("Whether or not pipelined requests should be served.");
		o.orientation = "horizontal";

		o = s.taboption("misc", form.Value, "default_server_timeout", _("Default server timeout"));
		o.description = _("Assumed server-side keep-alive timeout (in seconds) if not specified by the server.");
		o.datatype = 'uinteger';

		o = s.taboption("misc", form.Flag, "connection_sharing", _("Connection sharing"));
		o.description = _("Whether or not outgoing connections that have been kept alive should be shared between different incoming connections.");
		o.orientation = "horizontal";

		o = s.taboption("misc", form.Value, "socket_timeout", _("Socket timeout"));
		o.default = 300;
		o.description = _("Number of seconds after which a socket times out if no data is received.");
		o.datatype = 'and(uinteger,min(1),max(300))'

		o = s.taboption("misc", form.Value, "max_client_connections", _("Max. client connections"));
		o.default = 128;
		o.description = _("Maximum number of client connections that will be served.");
		o.datatype = 'uinteger';

		o = s.taboption("misc", form.Flag, "handle_as_empty_doc_returns_ok", _("Handle as empty doc returns ok"));
		o.description = _("The status code Privoxy returns for pages blocked with +handle-as-empty-document.");
		o.orientation = "horizontal";

		o = s.taboption("misc", form.Flag, "enable_compression", _("Enable compression"));
		o.description = _("Whether or not buffered content is compressed before delivery.");
		o.orientation = "horizontal";

		o = s.taboption("misc", form.Value, "compression_level", _("Compression level"));
		o.default = 1;
		o.description = _("The compression level that is passed to the zlib library when compressing buffered content.");
		o.datatype = 'and(uinteger,min(1),max(9))'

		o = s.taboption("misc", form.Value, "client_header_order", _("Client header order"));
		o.description = _("The order in which client headers are sorted before forwarding them.") +
			"<br />" + _("Syntax: Client header names delimited by spaces.");


		// Tab: Debug
		s.tab('debug', _('Debug'));

		o = s.taboption("debug", form.Flag, "single_threaded", _("Single Threaded"));
		o.description = _("Whether to run only one server thread.") +
		    "<br /><strong>" + _("This option is only there for debugging purposes. It will drastically reduce performance.") + "</strong>";
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_1", _("Debug 1"));
		o.description = _("Log the destination for each request Privoxy let through. See also 'Debug 1024'.");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_2", _("Debug 2"));
		o.description = _("Show each connection status");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_4", _("Debug 4"));
		o.description = _("Show I/O status");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_8", _("Debug 8"));
		o.description = _("Show header parsing");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_16", _("Debug 16"));
		o.description = _("Log all data written to the network");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_32", _("Debug 32"));
		o.description = _("Debug force feature");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_64", _("Debug 64"));
		o.description = _("Debug regular expression filters");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_128", _("Debug 128"));
		o.description = _("Debug redirects");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_256", _("Debug 256"));
		o.description = _("Debug GIF de-animation");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_512", _("Debug 512"));
		o.description = _("Common Log Format");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_1024", _("Debug 1024"));
		o.description = _("Log the destination for requests Privoxy didn't let through, and the reason why.");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_2048", _("Debug 2048"));
		o.description = _("CGI user interface");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_4096", _("Debug 4096"));
		o.description = _("Startup banner and warnings.");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_8192", _("Debug 8192"));
		o.description = _("Non-fatal errors - *we highly recommended enabling this*");
		o.orientation = "horizontal";

		// debug_16384 is skipped

		o = s.taboption("debug", form.Flag, "debug_32768", _("Debug 32768"));
		o.description = _("Log all data read from the network");
		o.orientation = "horizontal";

		o = s.taboption("debug", form.Flag, "debug_65536", _("Debug 65536"));
		o.description = _("Log the applying actions");
		o.orientation = "horizontal";


		return m.render();
	}
});
