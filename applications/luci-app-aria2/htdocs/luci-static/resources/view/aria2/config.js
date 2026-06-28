'use strict';
'require dom';
'require form';
'require fs';
'require poll';
'require rpc';
'require tools.widgets as widgets';
'require ui';
'require view';

var CBIAria2Status, CBIRpcSecret, CBIRpcUrl;

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} },
	filter: function (data, args, extra) {
		var i, res = data[args.name] || {};
		for (i = 0; (i < extra.length) && (Object.keys(res).length > 0); ++i)
			res = res[extra[i]] || {};
		return res;
	}
});

CBIAria2Status = form.DummyValue.extend({
	renderWidget: function() {
		var extra = ['instances', 'aria2.main'];
		var node = E('div', {}, E('p', {}, E('em', {}, _('Collecting data...'))));
		poll.add(function() {
			return Promise.all([
				callServiceList('aria2', extra)
				.then(function(res) {
					return E('p', {}, E('em', {}, res.running
						? _('The Aria2 service is running.')
						: _('The Aria2 service is not running.'))
					);
				}),
				getWebFrontInstalled()
				.then(function(installed) {
					var btns = [E('label'), _('Installed web interface: ')];
					for (var i in installed) {
						btns.push(E('button', {
							'class': 'btn cbi-button',
							'click': openWebInterface.bind(this, i)
						}, installed[i]));
					}
					return btns.length > 0 ? E('p', btns) : null;
				})
			]).then(function(res) {
				res = res.filter(function(r) { return r ? 1 : 0 });
				dom.content(node, res);
			});
		});
		return node;
	}
});

CBIRpcSecret = form.Value.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var node = this.super('renderWidget', [section_id, option_index, cfgvalue]);
		dom.append(node, [
			E('br'),
			E('span', { 'class': 'control-group' },
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': this.clickFn.bind(this, section_id)
				}, this.btnTitle)
			)
		]);
		return node;
	}
});

CBIRpcUrl = form.DummyValue.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var inputEl = new ui.Textfield('', {'id': this.cbid(section_id), 'readonly': true});
		return E([inputEl.render(),
			E('br'),
			E('span', { 'class': 'control-group' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': this.clickFn.bind(this, section_id, 0, inputEl)
				}, 'HTTP(s)'),
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': this.clickFn.bind(this, section_id, 1, inputEl)
				}, 'WebSocket(s)')
			])
		]);
	}
});

function getToken(section_id) {
	var len = 32, randomStr = '';
	var inputLength = prompt(_('Please input token length:'), len);
	if (inputLength === null || inputLength === '') {
		return;
	} else if (/^\d+$/.test(inputLength)) {
		len = parseInt(inputLength);
	}

	while(len - randomStr.length > 0) {
		randomStr += Math.random().toString(36).substring(2, 2 + len - randomStr.length);
	}
	document.getElementById('widget.' + this.cbid(section_id)).value = randomStr;
};

function getWebFrontInstalled() {
	var supported = {'ariang': 'AriaNg', 'webui-aria2': 'WebUI-Aria2', 'yaaw': 'YAAW'};
	var actions = [];

	for (var s in supported) {
		actions.push(fs.stat('/www/' + s + '/index.html')
		.then(L.bind(function(s) { return s; }, this, s))
		.catch(function(err) { return null; }));
	}

	return Promise.all(actions).then(function(res) {
		var installed = {};
		for (var i = 0; i < res.length; ++i)
			if (res[i])
				installed[res[i]] = supported[res[i]];
		return installed;
	});
}

function openWebInterface(path) {
	var host = window.location.host;
	var protocol = window.location.protocol;
	window.open(protocol + '//' + host + '/' + path);
};

function showRPCURL(section_id, useWS, inputEl) {
	var getOptVal = L.bind(function(opt, default_val) {
		default_val = default_val || null;
		return this.section.formvalue(section_id, opt) || default_val;
	}, this);

	var port = getOptVal('rpc_listen_port', 6800);
	var authMethod = getOptVal('rpc_auth_method', 'none');
	var secure = JSON.parse(getOptVal('rpc_secure', false));

	var protocol = useWS
		? (secure ? 'wss' : 'ws')
		: (secure ? 'https' : 'http');
	var url = protocol + '://';

	if (authMethod == 'token') {
		var authToken = getOptVal('rpc_secret');
		if (authToken)
			url += 'token:' + authToken + '@';
	} else if (authMethod == 'user_pass') {
		var authUser = getOptVal('rpc_user');
		var authPasswd = getOptVal('rpc_passwd');
		if (authUser && authPasswd)
			url += authUser + ':' + authPasswd + '@';
	}
	url += window.location.hostname + ':' + port + '/jsonrpc';
	inputEl.setValue(url);
};

return view.extend({
	load: function() {
		return fs.exec_direct('/usr/bin/aria2c', [ '-v' ]).then(function(res) {
			var info = {}, lines = res.split(/\r?\n|\r/g);

			for (var i = 0; i < lines.length; ++i) {
				if (/^aria2 version/.exec(lines[i])) {
					info.version = lines[i].match(/(\d+\.){2}\d+/)[0];
				}
				else if (/^Enabled Features/.exec(lines[i])) {
					info.gzip = lines[i].search(/GZip/) >= 0;
					info.https = lines[i].search(/HTTPS/) >= 0;
					info.bt = lines[i].search(/BitTorrent/) >= 0;
					info.sftp = lines[i].search(/SFTP/) >= 0;
					info.adns = lines[i].search(/Async DNS/) >= 0;
					info.cookie = lines[i].search(/Firefox3 Cookie/) >= 0;
				}
			}
			return info;
		});
	},

	render: function(aria2) {
		let m, s, o;

		m = new form.Map('aria2', '%s - %s'.format(_('Aria2'), _('Settings')), '<p>%s</p><p>%s</p>'.format(
			_('Aria2 is a lightweight multi-protocol &amp; multi-source, cross platform download utility.'),
			_('For more information, please visit: %s.')
			.format('<a href="https://aria2.github.io" target="_blank">https://aria2.github.io</a>')));

		s = m.section(form.TypedSection);
		s.title = '%s - %s'.format(_('Aria2'), _('Running Status'));
		s.anonymous = true;
		s.cfgsections = function() { return [ 'status' ] };

		o = s.option(CBIAria2Status);

		s = m.section(form.NamedSection, 'main', 'aria2');
		s.addremove = false;
		s.anonymous = true;

		s.tab('basic', _('Basic Options'));

		o = s.taboption('basic', form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;

		o = s.taboption('basic', widgets.UserSelect, 'user', _('Run daemon as user'),
			_('Leave blank to use default user.'));

		o = s.taboption('basic', form.Value, 'dir', _('Download directory'),
			_('The directory to store the downloaded file. For example <code>/mnt/sda1</code>.'));
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'config_dir', _('Config file directory'),
			_('The directory to store the config file, session file and DHT file.'));
		o.placeholder = '/var/etc/aria2';

		o = s.taboption('basic', form.Flag, 'enable_logging', _('Enable logging'));
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'log', _('Log file'),
			_('The file name of the log file.'));
		o.depends('enable_logging', '1');
		o.placeholder = '/var/log/aria2.log';

		o = s.taboption('basic', form.ListValue, 'log_level', _('Log level'));
		o.depends('enable_logging', '1');
		o.value('debug', _('Debug'));
		o.value('info', _('Info'));
		o.value('notice', _('Notice'));
		o.value('warn', _('Warn'));
		o.value('error', _('Error'));
		o.default = 'warn';

		o = s.taboption('basic', form.Value, 'max_concurrent_downloads', _('Max concurrent downloads'));
		o.placeholder = '5';

		s.tab('rpc', _('RPC Options'))

		o = s.taboption('rpc', form.Flag, 'pause', _('Pause'), _('Pause download after added.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'false';

		o = s.taboption('rpc', form.Flag, 'pause_metadata', _('Pause metadata'),
			_('Pause downloads created as a result of metadata download.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'false';

		o = s.taboption('rpc', form.Value, 'rpc_listen_port', _('RPC port'));
		o.datatype = 'range(1024,65535)';
		o.placeholder = '6800';

		o = s.taboption('rpc', form.ListValue, 'rpc_auth_method', _('RPC authentication method'));
		o.value('none', _('No Authentication'));
		o.value('user_pass', _('Username & Password'));
		o.value('token', _('Token'));

		o = s.taboption('rpc', form.Value, 'rpc_user', _('RPC username'));
		o.depends('rpc_auth_method', 'user_pass');

		o = s.taboption('rpc', form.Value, 'rpc_passwd', _('RPC password'));
		o.depends('rpc_auth_method', 'user_pass');
		o.password  =  true;

		o = s.taboption('rpc', CBIRpcSecret, 'rpc_secret', _('RPC token'));
		o.depends('rpc_auth_method', 'token');
		o.btnTitle = _('Generate Randomly');
		o.clickFn = getToken;
		o.password  =  true;

		if (aria2.https) {
			o = s.taboption('rpc', form.Flag, 'rpc_secure', _('RPC secure'),
				_('RPC transport will be encrypted by SSL/TLS. The RPC clients must use https'
				+ ' scheme to access the server. For WebSocket client, use wss scheme.'));
			o.enabled = 'true';
			o.disabled = 'false';
			o.rmempty = false;

			o = s.taboption('rpc', form.Value, 'rpc_certificate', _('RPC certificate'),
				_('Use the certificate in FILE for RPC server. The certificate must be either'
				+ ' in PKCS12 (.p12, .pfx) or in PEM format.<br/>PKCS12 files must contain the'
				+ ' certificate, a key and optionally a chain of additional certificates. Only PKCS12'
				+ ' files with a blank import password can be opened!<br/>When using PEM, you have to'
				+ ' specify the "RPC private key" as well.'));
			o.depends('rpc_secure', 'true');
			o.optional = false;
			o.rmempty = false;

			o = s.taboption('rpc', form.Value, 'rpc_private_key', _('RPC private key'),
				_('Use the private key in FILE for RPC server. The private key must be'
				+ ' decrypted and in PEM format.'));
			o.depends('rpc_secure', 'true');
			o.optional = false;
			o.rmempty = false;
		}

		o = s.taboption('rpc', CBIRpcUrl, '_rpc_url', _('Json-RPC URL'));
		o.clickFn = showRPCURL;

		s.tab('http', _('HTTP/FTP/SFTP Options'));

		o = s.taboption('http', form.Flag, 'enable_proxy', _('Enable proxy'));
		o.rmempty = false;

		o = s.taboption('http', form.Value, 'all_proxy', _('All proxy'),
			_('Use a proxy server for all protocols.'));
		o.depends('enable_proxy', '1');
		o.placeholder = '[http://][USER:PASSWORD@]HOST[:PORT]';

		o = s.taboption('http', form.Value, 'all_proxy_user', _('Proxy user'));
		o.depends('enable_proxy', '1');

		o = s.taboption('http', form.Value, 'all_proxy_passwd', _('Proxy password'));
		o.depends('enable_proxy', '1');
		o.password = true;

		if (aria2.https) {
			o = s.taboption('http', form.Flag, 'check_certificate', _('Check certificate'),
				_('Verify the peer using certificates specified in "CA certificate" option.'));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'true';
			o.rmempty = false;

			o = s.taboption('http', form.Value, 'ca_certificate', _('CA certificate'),
				_('Use the certificate authorities in FILE to verify the peers. The certificate'
				+ ' file must be in PEM format and can contain multiple CA certificates.'));
			o.depends('check_certificate', 'true');

			o = s.taboption('http', form.Value, 'certificate', _('Certificate'),
				_('Use the client certificate in FILE. The certificate must be either in PKCS12'
				+ ' (.p12, .pfx) or in PEM format.<br/>PKCS12 files must contain the certificate, a'
				+ ' key and optionally a chain of additional certificates. Only PKCS12 files with a'
				+ ' blank import password can be opened!<br/>When using PEM, you have to specify the'
				+ ' "Private key" as well.'));

			o = s.taboption('http', form.Value, 'private_key', _('Private key'),
				_('Use the private key in FILE. The private key must be decrypted and in PEM'
				+ ' format. The behavior when encrypted one is given is undefined.'));
		}

		if (aria2.gzip) {
			o = s.taboption('http', form.Flag, 'http_accept_gzip', _('HTTP accept gzip'),
				_('Send <code>Accept: deflate, gzip</code> request header and inflate response'
				+ ' if remote server responds with <code>Content-Encoding: gzip</code> or'
				+ ' <code>Content-Encoding: deflate</code>.'));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'false';
		}

		o = s.taboption('http', form.Flag, 'http_no_cache', _('HTTP no cache'),
			_('Send <code>Cache-Control: no-cache</code> and <code>Pragma: no-cache</code>'
			+ ' header to avoid cached content. If disabled, these headers are not sent and you'
			+ ' can add Cache-Control header with a directive you like using "Header" option.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'false';

		o = s.taboption('http', form.DynamicList, 'header', _('Header'),
			_('Append HEADERs to HTTP request header.'));

		o = s.taboption('http', form.Value, 'connect_timeout', _('Connect timeout'),
			_('Set the connect timeout in seconds to establish connection to HTTP/FTP/proxy server.' +
			' After the connection is established, this option makes no effect and "Timeout" option is used instead.'));
		o.datatype = 'uinteger';
		o.placeholder = '60';

		o = s.taboption('http', form.Value, 'timeout', _('Timeout'));
		o.datatype = 'uinteger';
		o.placeholder = '60';

		o = s.taboption('http', form.Value, 'lowest_speed_limit', _('Lowest speed limit'),
			'%s %s'.format(
				_('Close connection if download speed is lower than or equal to this value (bytes per sec). ' +
			'0 means has no lowest speed limit.'),
				_('You can append K or M.')
			));
		o.placeholder = '0';

		o = s.taboption('http', form.Value, 'max_connection_per_server', _('Max connection per server'),
			_('The maximum number of connections to one server for each download.'));
		o.datatype = 'uinteger';
		o.placeholder = '1';

		o = s.taboption('http', form.Value, 'split', _('Max number of split'),
			_('Download a file using N connections.'));
		o.datatype = 'uinteger';
		o.placeholder = '5';

		o = s.taboption('http', form.Value, 'min_split_size', _('Min split size'),
			_('Don\'t split less than 2*SIZE byte range. Possible values: 1M-1024M.'));
		o.placeholder = '20M';

		o = s.taboption('http', form.Value, 'max_tries', _('Max tries'));
		o.datatype = 'uinteger';
		o.placeholder = '5';

		o = s.taboption('http', form.Value, 'retry_wait', _('Retry wait'),
			_('Set the seconds to wait between retries.'));
		o.datatype = 'uinteger';
		o.placeholder = '0';

		o = s.taboption('http', form.Value, 'user_agent', _('User agent'),
			_('Set user agent for HTTP(S) downloads.'));
		o.placeholder = 'aria2/%s'.format(aria2.version ? aria2.version : '$VERSION');

		if (aria2.bt) {
			s.tab('bt', _('BitTorrent Options'));

			o = s.taboption('bt', form.Flag, 'enable_dht', _('IPv4 <abbr title="Distributed Hash Table">DHT</abbr> enabled'),
				'%s %s'.format(
					_('Enable IPv4 DHT functionality. It also enables UDP tracker support.'),
					_('This option will be ignored if a private flag is set in a torrent.')
				));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'true';
			o.rmempty = false;

			o = s.taboption('bt', form.Flag, 'enable_dht6', _('IPv6 <abbr title="Distributed Hash Table">DHT</abbr> enabled'),
				'%s %s'.format(
					_('Enable IPv6 DHT functionality.'),
					_('This option will be ignored if a private flag is set in a torrent.')
				));
			o.enabled = 'true';
			o.disabled = 'false';

			o = s.taboption('bt', form.Flag, 'bt_enable_lpd', _('<abbr title="Local Peer Discovery">LPD</abbr> enabled'),
				'%s %s'.format(
					_('Enable Local Peer Discovery.'),
					_('This option will be ignored if a private flag is set in a torrent.')
				));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'false';

			o = s.taboption('bt', form.Flag, 'enable_peer_exchange', _('Enable peer exchange'),
				'%s %s'.format(
					_('Enable Peer Exchange extension.'),
					_('This option will be ignored if a private flag is set in a torrent.')
				));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'true';
			o.rmempty = false;

			o = s.taboption('bt', form.Flag, 'bt_save_metadata', _('Save metadata'),
				_('Save meta data as ".torrent" file. This option has effect only when BitTorrent'
				+ ' Magnet URI is used. The file name is hex encoded info hash with suffix ".torrent".'));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'false';

			o = s.taboption('bt', form.Flag, 'bt_remove_unselected_file', _('Remove unselected file'),
				_('Removes the unselected files when download is completed in BitTorrent. Please'
				+ ' use this option with care because it will actually remove files from your disk.'));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'false';

			o = s.taboption('bt', form.Flag, 'bt_seed_unverified', _('Seed unverified'),
				_('Seed previously downloaded files without verifying piece hashes.'));
			o.enabled = 'true';
			o.disabled = 'false';
			o.default = 'false';

			o = s.taboption('bt', form.Value, 'listen_port', _('BitTorrent listen port'),
				_('Set TCP port number for BitTorrent downloads. Accept format: "6881,6885",'
				+ ' "6881-6999" and "6881-6889,6999". Make sure that the specified ports are open'
				+ ' for incoming TCP traffic.'));
			o.placeholder = '6881-6999';

			o = s.taboption('bt', form.Value, 'dht_listen_port', _('DHT Listen port'),
				_('Set UDP listening port used by DHT (IPv4, IPv6) and UDP tracker. Make sure that the '
				+ 'specified ports are open for incoming UDP traffic.'));
			o.depends('enable_dht', 'true');
			o.depends('enable_dht6', 'true');
			o.placeholder = '6881-6999';

			o = s.taboption('bt', form.ListValue, 'follow_torrent', _('Follow torrent'));
			o.value('true', _('True'));
			o.value('false', _('False'));
			o.value('mem', _('Keep in memory'));

			o = s.taboption('bt', form.Value, 'max_overall_upload_limit', _('Max overall upload limit'),
				'%s %s'.format(
					_('Set max overall upload speed in bytes/sec. 0 means unrestricted.'),
					_('You can append K or M.')
				));
			o.placeholder = '0';

			o = s.taboption('bt', form.Value, 'max_upload_limit', _('Max upload limit'),
				'%s %s'.format(
					_('Set max upload speed per each torrent in bytes/sec. 0 means unrestricted.'),
					_('You can append K or M.')
				));
			o.placeholder = '0';

			o = s.taboption('bt', form.Value, 'bt_max_open_files', _('Max open files'),
				_('Specify maximum number of files to open in multi-file BitTorrent download globally.'));
			o.datatype = 'uinteger';
			o.placeholder = '100';

			o = s.taboption('bt', form.Value, 'bt_max_peers', _('Max peers'),
				_('Specify the maximum number of peers per torrent, 0 means unlimited.'));
			o.datatype = 'uinteger';
			o.placeholder = '55';

			o = s.taboption('bt', form.Value, 'bt_request_peer_speed_limit', _('Request peer speed limit'),
				'%s %s'.format(
					_('If the whole download speed of every torrent is lower than SPEED, aria2'
					+ ' temporarily increases the number of peers to try for more download speed.'
					+ ' Configuring this option with your preferred download speed can increase your'
					+ ' download speed in some cases.'),
					_('You can append K or M.')
				));
			o.placeholder = '50K';

			o = s.taboption('bt', form.Value, 'bt_stop_timeout', _('Stop timeout'),
				_('Stop BitTorrent download if download speed is 0 in consecutive N seconds. If 0 is'
				+ ' given, this feature is disabled.'));
			o.datatype = 'uinteger';
			o.placeholder = '0';

			o = s.taboption('bt', form.Value, 'peer_id_prefix', _('Prefix of peer ID'),
				_('Specify the prefix of peer ID. The peer ID in BitTorrent is 20 byte length.'
				+ ' If more than 20 bytes are specified, only first 20 bytes are used. If less than 20'
				+ ' bytes are specified, random byte data are added to make its length 20 bytes.'));
			o.placeholder = 'A2-%s-'.format(
				aria2.version ? aria2.version.replace(/\./g, '-') : '$MAJOR-$MINOR-$PATCH'
			);

			o = s.taboption('bt', form.Value, 'seed_ratio', _('Seed ratio'),
				_('Specify share ratio. Seed completed torrents until share ratio reaches RATIO.'
				+ ' You are strongly encouraged to specify equals or more than 1.0 here. Specify 0.0 if'
				+ ' you intend to do seeding regardless of share ratio.'));
			o.datatype = 'ufloat';
			o.placeholder = '1.0';

			o = s.taboption('bt', form.Value, 'seed_time', _('Seed time'),
				_('Specify seeding time in minutes. If "Seed ratio" option is'
				+ ' specified along with this option, seeding ends when at least one of the conditions'
				+ ' is satisfied. Specifying 0 disables seeding after download completed.'));
			o.datatype = 'ufloat';

			o = s.taboption('bt', form.DynamicList, 'bt_tracker', _('Additional BT tracker'),
				_('List of additional BitTorrent tracker\'s announce URI.'));
			o.placeholder = 'http://tracker.example.com/announce';
		}

		s.tab('advance', _('Advanced Options'));

		o = s.taboption('advance', form.Flag, 'disable_ipv6', _('IPv6 disabled'),
			_('Disable IPv6. This is useful if you have to use broken DNS and want to avoid terribly'
			+ ' slow AAAA record lookup.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'false';

		o = s.taboption('advance', form.Value, 'auto_save_interval', _('Auto save interval'),
			_('Save a control file (*.aria2) every N seconds. If 0 is given, a control file is not'
			+ ' saved during download.'));
		o.datatype = 'range(0, 600)';
		o.placeholder = '60';

		o = s.taboption('advance', form.Value, 'save_session_interval', _('Save session interval'),
			_('Save error/unfinished downloads to session file every N seconds. If 0 is given, file'
			+ ' will be saved only when aria2 exits.'));
		o.datatype = 'uinteger';
		o.placeholder = '0';

		o = s.taboption('advance', form.Value, 'disk_cache', _('Disk cache'),
			'%s %s'.format(
				_('Enable disk cache (in bytes), set 0 to disabled.'),
				_('You can append K or M.')
			));
		o.placeholder = '16M';

		o = s.taboption('advance', form.ListValue, 'file_allocation', _('File allocation'),
			_('Specify file allocation method. If you are using newer file systems such as ext4'
			+ ' (with extents support), btrfs, xfs or NTFS (MinGW build only), "falloc" is your best choice.'
			+ ' It allocates large(few GiB) files almost instantly, but it may not be available if your system'
			+ ' doesn\'t have posix_fallocate(3) function. Don\'t use "falloc" with legacy file systems such as'
			+ ' ext3 and FAT32 because it takes almost same time as "prealloc" and it blocks aria2 entirely'
			+ ' until allocation finishes.'));
		o.value('none', _('None'));
		o.value('prealloc', _('prealloc'));
		o.value('trunc', _('trunc'));
		o.value('falloc', _('falloc'));
		o.default = 'prealloc';

		o = s.taboption('advance', form.Flag, 'force_save', _('Force save'),
			_('Save download to session file even if the download is completed or removed.'
			+ ' This option also saves control file in that situations. This may be useful to save'
			+ ' BitTorrent seeding which is recognized as completed state.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'false';

		o = s.taboption('advance', form.Value, 'max_overall_download_limit', _('Max overall download limit'),
			'%s %s'.format(
				_('Set max overall download speed in bytes/sec. 0 means unrestricted.'),
				_('You can append K or M.')
			));
		o.placeholder = '0';

		o = s.taboption('advance', form.Value, 'max_download_limit', _('Max download limit'),
			'%s %s'.format(
				_('Set max download speed per each download in bytes/sec. 0 means unrestricted.'),
				_('You can append K or M.')
			));
		o.placeholder = '0';

		s = m.section(form.NamedSection, 'main', 'aria2', _('Extra Settings'),
			_('Settings in this section will be added to config file.'));
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.DynamicList, 'extra_settings', _('Settings list'),
			_('List of extra settings. Format: option=value, eg. <code>netrc-path=/tmp/.netrc</code>.'));
		o.placeholder = 'option=value';

		return m.render();
	}
});
