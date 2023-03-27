'use strict';
'require view';
'require fs';
'require uci';
'require rpc';
'require form';
'require tools.widgets as widgets';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { 'transmission': {} }
});

function setFlagBool(o) {
	o.enabled = 'true';
	o.disabled = 'false';
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callServiceList('transmission')),
			L.resolveDefault(fs.stat('/usr/share/transmission/public_html/index.html')),
			uci.load('transmission')
		]);
	},
	render: function(res) {
		var port = uci.get_first('transmission', 'transmission', 'rpc_port') || '9091';

		var running = Object.keys(res[0].instances || {}).length > 0;

		var webinstalled = res[1] || !!uci.get_first('transmission', 'transmission', 'web_home');

		var button = '';
		if (running && webinstalled)
			button = '&#160;<a class="btn" href="http://' + window.location.hostname + ':' + port + '" target="_blank" rel="noreferrer noopener">' + _('Open Web Interface') + '</a>';

		var m, s, o;

		m = new form.Map('transmission', 'Transmission', _('Transmission daemon is a simple bittorrent client, here you can configure the settings.') + button);

		s = m.section(form.TypedSection, 'transmission', _('Global settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;

		o = s.option(form.Value, 'config_dir', _('Config file directory'));
		o = s.option(widgets.UserSelect, 'user', _('Run daemon as user'));
		o = s.option(widgets.GroupSelect, 'group', _('Run daemon as group'));
		o = s.option(form.Value, 'web_home', _('Custom Web UI directory'));


		s = m.section(form.TypedSection, 'transmission', _('Bandwidth settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'alt_speed_enabled', _('Alternative speed enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'alt_speed_up', _('Alternative upload speed'), 'KB/s');
		o.depends('alt_speed_enabled', 'true');

		o = s.option(form.Value, 'alt_speed_down', _('Alternative download speed'), 'KB/s');
		o.depends('alt_speed_enabled', 'true');

		o = s.option(form.Flag, 'speed_limit_down_enabled', _('Speed limit down enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'speed_limit_down', _('Speed limit down'), 'KB/s');
		o.depends('speed_limit_down_enabled', 'true');

		o = s.option(form.Flag, 'speed_limit_up_enabled', _('Speed limit up enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'speed_limit_up', _('Speed limit up'), 'KB/s');
		o.depends('speed_limit_up_enabled', 'true');

		o = s.option(form.Value, 'upload_slots_per_torrent', _('Upload slots per torrent'));


		s = m.section(form.TypedSection, 'transmission', _('Blocklists'));
		s.anonymous = true;

		o = s.option(form.Flag, 'blocklist_enabled', _('Block list enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'blocklist_url', _('Blocklist URL'));
		o.depends('blocklist_enabled', 'true');
		o.placeholder = 'http://www.example.com/blocklist';


		s = m.section(form.TypedSection, 'transmission', _('Files and Locations'));
		s.anonymous = true;

		s.option(form.Value, 'download_dir', _('Download directory'));

		o = s.option(form.Flag, 'incomplete_dir_enabled', _('Incomplete directory enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'incomplete_dir', _('Incomplete directory'));
		o.depends('incomplete_dir_enabled', 'true');

		o = s.option(form.ListValue, 'preallocation', _('Preallocation'));
		o.value('0', _('Off'));
		o.value('1', _('Fast'));
		o.value('2', _('Full'));

		o = s.option(form.Flag, 'rename_partial_files', _('Rename partial files'));
		setFlagBool(o);

		o = s.option(form.Flag, 'start_added_torrents', _('Automatically start added torrents'));
		setFlagBool(o);

		o = s.option(form.Flag, 'trash_original_torrent_files', _('Trash original torrent files'));
		setFlagBool(o);

		o = s.option(form.Value, 'umask', 'umask');

		o = s.option(form.Flag, 'watch_dir_enabled', _('Enable watch directory'));
		setFlagBool(o);

		o = s.option(form.Value, 'watch_dir', _('Watch directory'));
		o.depends('watch_dir_enabled', 'true');


		s = m.section(form.TypedSection, 'transmission', _('Miscellaneous'));
		s.anonymous = true;

		o = s.option(form.Value, 'cache_size_mb', _('Cache size in MB'));

		o = s.option(form.Flag, 'dht_enabled', _('DHT enabled'));
		setFlagBool(o);

		o = s.option(form.ListValue, 'encryption', _('Encryption'));
		o.value('0', _('Prefer unencrypted'));
		o.value('1', _('Prefer encrypted'));
		o.value('2', _('Require encrypted'));

		o = s.option(form.Flag, 'lazy_bitfield_enabled', _('Lazy bitfield enabled'));
		setFlagBool(o);

		o = s.option(form.Flag, 'lpd_enabled', _('LPD enabled'));
		setFlagBool(o);

		o = s.option(form.ListValue, 'message_level', _('Message level'));
		o.value('0', _('None'));
		o.value('1', _('Error'));
		o.value('2', _('Info'));
		o.value('3', _('Debug'));

		o = s.option(form.Flag, 'pex_enabled', _('PEX enabled'));
		setFlagBool(o);

		o = s.option(form.Flag, 'prefetch_enabled', _('Prefetch enabled'));

		o = s.option(form.Flag, 'scrape_paused_torrents_enabled', _('Scrape paused torrents enabled'));
		setFlagBool(o);

		o = s.option(form.Flag, 'script_torrent_done_enabled', _('Script torrent done enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'script_torrent_done_filename', _('Script torrent done filename'));
		o.depends('script_torrent_done_enabled', 'true');

		o = s.option(form.Flag, 'utp_enabled', _('uTP enabled'));
		setFlagBool(o);


		s = m.section(form.TypedSection, 'transmission', _('Peer settings'));
		s.anonymous = true;

		o = s.option(form.Value, 'bind_address_ipv4', _('Binding address IPv4'));

		o = s.option(form.Value, 'bind_address_ipv6', _('Binding address IPv6'));

		o = s.option(form.Value, 'peer_congestion_algorithm', _('Peer congestion algorithm'),
			_('This is documented on <a href="https://www.irif.fr/~jch/software/bittorrent/tcp-congestion-control.html" target="_blank" rel="noreferrer noopener">tcp-congestion-control</a>.'));

		o = s.option(form.Value, 'peer_id_ttl_hours', _('Recycle peer id after'), _('hours'));

		o = s.option(form.Value, 'peer_limit_global', _('Global peer limit'));

		o = s.option(form.Value, 'peer_limit_per_torrent', _('Peer limit per torrent'));

		o = s.option(form.Value, 'peer_socket_tos', _('Peer socket <abbr title="Type of Service">TOS</abbr>'));


		s = m.section(form.TypedSection, 'transmission', _('Peer Port settings'));
		s.anonymous = true;

		o = s.option(form.Value, 'peer_port', _('Peer port'));

		o = s.option(form.Flag, 'peer_port_random_on_start', _('Peer port random on start'));
		setFlagBool(o);

		o = s.option(form.Value, 'peer_port_random_high', _('Peer port random high'));
		o.depends('peer_port_random_on_start', 'true');

		o = s.option(form.Value, 'peer_port_random_low', _('Peer port random low'));
		o.depends('peer_port_random_on_start', 'true');

		o = s.option(form.Flag, 'port_forwarding_enabled', _('Port forwarding enabled'));
		setFlagBool(o);


		s = m.section(form.TypedSection, 'transmission', _('Queueing'));
		s.anonymous = true;

		o = s.option(form.Flag, 'download_queue_enabled', _('Download queue enabled'));
		setFlagBool(o);

		o = s.option(form.Flag, 'queue_stalled_enabled', _('Queue stalled enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'download_queue_size', _('Download queue size'));
		o.depends('download_queue_enabled', 'true');

		o = s.option(form.Flag, 'seed_queue_enabled', _('Seed queue enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'queue_stalled_minutes', _('Queue stalled minutes'));
		o.depends('queue_stalled_enabled', 'true');

		o = s.option(form.Value, 'seed_queue_size', _('Seed queue size'));
		o.depends('seed_queue_enabled', 'true');


		s = m.section(form.TypedSection, 'transmission', _('RPC settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'rpc_enabled', _('RPC enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'rpc_bind_address', _('RPC bind address'));
		o.depends('rpc_enabled', 'true');

		o = s.option(form.Value, 'rpc_port', _('RPC port'));
		o.depends('rpc_enabled', 'true');

		o = s.option(form.Value, 'rpc_url', _('RPC URL'));
		o.depends('rpc_enabled', 'true');

		o = s.option(form.Flag, 'rpc_host_whitelist_enabled', _('RPC host whitelist enabled'));
		setFlagBool(o);
		o.depends('rpc_enabled', 'true');

		o = s.option(form.Value, 'rpc_host_whitelist', _('RPC host whitelist'));
		o.depends('rpc_host_whitelist_enabled', 'true');

		o = s.option(form.Flag, 'rpc_whitelist_enabled', _('RPC whitelist enabled'));
		setFlagBool(o);
		o.depends('rpc_enabled', 'true');

		o = s.option(form.Value, 'rpc_whitelist', _('RPC whitelist'));
		o.depends('rpc_whitelist_enabled', 'true');

		o = s.option(form.Flag, 'rpc_authentication_required', _('RPC authentication required'));
		setFlagBool(o);
		o.depends('rpc_enabled', 'true');

		o = s.option(form.Value, 'rpc_username', _('RPC username'));
		o.depends('rpc_authentication_required', 'true');

		o = s.option(form.Value, 'rpc_password', _('RPC password'));
		o.depends('rpc_authentication_required', 'true');
		o.password = true;


		s = m.section(form.TypedSection, 'transmission', _('Scheduling'));
		s.anonymous = true;

		o = s.option(form.Flag, 'alt_speed_time_enabled', _('Alternative speed timing enabled'), _('When enabled, this will toggle the <b>alt-speed-enabled</b> setting'));
		setFlagBool(o);

		o = s.option(form.Value, 'alt_speed_time_begin', _('Alternative speed time begin'), _('in minutes from midnight'));
		o.depends('alt_speed_time_enabled', 'true');

		o = s.option(form.Value, 'alt_speed_time_end', _('Alternative speed time end'), _('in minutes from midnight'));
		o.depends('alt_speed_time_enabled', 'true');
		
		o = s.option(form.Value, 'alt_speed_time_day', _('Alternative speed time day'), _('Number/bitfield. Start with 0, then for each day you want the scheduler enabled, add a value. For Sunday - 1, Monday - 2, Tuesday - 4, Wednesday - 8, Thursday - 16, Friday - 32, Saturday - 64'));
		o.depends('alt_speed_time_enabled', 'true');

		o = s.option(form.Flag, 'idle_seeding_limit_enabled', _('Idle seeding limit enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'idle_seeding_limit', _('Idle seeding limit'));
		o.depends('idle_seeding_limit_enabled', 'true');

		o = s.option(form.Flag, 'ratio_limit_enabled', _('Ratio limit enabled'));
		setFlagBool(o);

		o = s.option(form.Value, 'ratio_limit', _('Ratio limit'));
		o.depends('ratio_limit_enabled', 'true');

		return m.render();
	}
});
