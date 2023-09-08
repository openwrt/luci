'use strict';
'require view';
'require fs';
'require uci';
'require form';
'require tools.widgets as widgets';

var CBIMiniDLNAStatus = form.DummyValue.extend({
	load: function() {
		var port = +uci.get_first('minidlna', 'minidlna', 'port');

		if (isNaN(port) || port < 0 || port > 65535)
			port = 8200;

		return L.resolveDefault(fs.exec_direct('/usr/bin/wget', [ '-q', 'http://127.0.0.1:%d/'.format(port), '-O', '-' ]), null)
			.then(L.bind(function(html) {
				if (html == null) {
					this.default = E('em', {}, [ _('The miniDLNA service is not running.') ]);
				}
				else {
					var audio = html.match(/Audio files<\/td><td>(\d+)/),
					    video = html.match(/Video files<\/td><td>(\d+)/),
					    image = html.match(/Image files<\/td><td>(\d+)/);

					this.default = _('The miniDLNA service is active, serving %d audio, %d video and %d image files.')
						.format(audio ? +audio[1] : 0, video ? +video[1] : 0, image ? +image[1] : 0);
				}
			}, this));
	}
});

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('minidlna', _('miniDLNA'), _('MiniDLNA is server software with the aim of being fully compliant with DLNA/UPnP-AV clients.'));

		s = m.section(form.TypedSection);
		s.title = _('Status');
		s.anonymous = true;
		s.cfgsections = function() { return [ '_status' ] };

		o = s.option(CBIMiniDLNAStatus);


		s = m.section(form.TypedSection, 'minidlna', 'miniDLNA Settings');
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enable'));

		o = s.taboption('general', form.Value, 'port', _('Port'),
			_('Port for HTTP (descriptions, SOAP, media transfer) traffic.'));
		o.default = '8200';

		o = s.taboption('general', widgets.DeviceSelect, 'interface', _('Interfaces'), _('Network interfaces to serve.'));
		o.multiple = true;
		o.noaliases = true;
		o.cfgvalue = function(section_id) {
			return L.toArray(uci.get('minidlna', section_id, 'interface')).join(',').split(/[ \t,]+/);
		};
		o.write = function(section_id, value) {
			return uci.set('minidlna', section_id, 'interface', L.toArray(value).join(','));
		};

		o = s.taboption('general', form.Value, 'friendly_name', _('Friendly name'), _('Set this if you want to customize the name that shows up on your clients.'));

		o = s.taboption('general', form.ListValue, 'root_container', _('Root container'));
		o.value('.', _('Standard container'));
		o.value('B', _('Browse directory'));
		o.value('M', _('Music'));
		o.value('V', _('Video'));
		o.value('P', _('Pictures'));

		o = s.taboption('general', form.DynamicList, 'media_dir', _('Media directories'), _('Set this to the directory you want scanned. If you want to restrict the directory to a specific content type, you can prepend the type (\'A\' for audio, \'V\' for video, \'P\' for images), followed by a comma, to the directory (eg. A,/mnt/media/Music). Multiple directories can be specified.'));

		o = s.taboption('advanced', form.DynamicList, 'album_art_names', _('Album art names'), _('This is a list of file names to check for when searching for album art.'));
		o.cfgvalue = function(section_id) {
			return L.toArray(uci.get('minidlna', section_id, 'album_art_names')).join('/').split(/\//);
		};
		o.write = function(section_id, value) {
			return uci.set('minidlna', section_id, 'album_art_names', L.toArray(value).join('/'));
		};

		o = s.taboption('advanced', form.Value, 'db_dir', _('Database directory'), _('Set this if you would like to specify the directory where you want MiniDLNA to store its database and album art cache.'));

		o = s.taboption('advanced', form.Flag, 'inotify', _('Enable inotify'), _('Set this to enable inotify monitoring to automatically discover new files.'));

		o = s.taboption('advanced', form.Flag, 'enable_tivo', _('Enable TIVO'), _('Set this to enable support for streaming .jpg and .mp3 files to a TiVo supporting HMO.'));

		o = s.taboption('advanced', form.Flag, 'wide_links', _('Allow wide links'), _('Set this to allow serving content outside the media root (via symlinks).'));

		o = s.taboption('advanced', form.Flag, 'strict_dlna', _('Strict to DLNA standard'), _('Set this to strictly adhere to DLNA standards. This will allow server-side downscaling of very large JPEG images, which may hurt JPEG serving performance on (at least) Sony DLNA products.'));

		o = s.taboption('advanced', form.Value, 'presentation_url', _('Presentation URL'));

		o = s.taboption('advanced', form.Value, 'notify_interval', _('Notify interval'), _('Notify interval in seconds.'));
		o.placeholder = '900';

		o = s.taboption('advanced', form.Value, 'serial', _('Announced serial number'), _('Serial number the miniDLNA daemon will report to clients in its XML description.'));
		o.placeholder = '12345678';

		o = s.taboption('advanced', form.Value, 'uuid', _('Announced UUID'));
		o.placeholder = '019f9a56-ff60-44c0-9edc-eae88d09fa05';

		o = s.taboption('advanced', form.Value, 'model_number', _('Announced model number'), _('Model number the miniDLNA daemon will report to clients in its XML description.'));
		o.placeholder = '1';

		o = s.taboption('advanced', form.Value, 'minissdpsocket', _('miniSSDP socket'), _('Specify the path to the MiniSSDPd socket.'));

		return m.render();
	}
});
