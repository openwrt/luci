'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require poll';


/* Licensed to the public under the Apache License 2.0. */

return view.extend({
	load: function () {
		let self = this;
		self.stream = { ts: new Date().getTime(), timer: 0 };

		poll.add(function () {
			self.render();
		}, 5);

		document
			.querySelector('head')
			.appendChild(
				E('style', { type: 'text/css' }, [
					'.img-preview {display: inline-block !important;height: auto;width: 640px;padding: 4px;line-height: 1.428571429;background-color: #fff;border: 1px solid #ddd;border-radius: 4px;-webkit-transition: all .2s ease-in-out;transition: all .2s ease-in-out;margin-bottom: 5px;display: none;}',
					'@media (prefers-color-scheme: dark){ .img-preview {background-color: #222;border-color: #333;} }',
				]),
			);

		return Promise.all([uci.load('ustreamer')]);
	},
	render: function () {
		let m, s, o;
		let stream = this.stream;

		m = new form.Map(
			'ustreamer', 'µStreamer', _('Lightweight and fast MJPEG-HTTP streamer')
		);


		// preview

		function stream_url() {
			let login = '';
			let user = uci.get('ustreamer', 'video0', 'user');
			let pass = uci.get('ustreamer', 'video0', 'pass');
			let port = uci.get('ustreamer', 'video0', 'port');

			if (port == undefined) {
				port = '8080';
			}

			if (user != undefined) {
				if (pass == undefined) {
					login = user + '@';
				}
				else {
					login = user + ':' + pass + '@';
				}
			}

			return 'http://' + login + location.hostname + ':' + port + '/';
		}

		const url = stream_url();

		const stream_link = E(
			'a',
			{
				'id': 'stream_link',
				'target': '_blank',
				'href': url,
			},
			_('Preview'),
		);

		const s_preview = m.section(form.TypedSection, 'ustreamer', stream_link);
		s_preview.addremove = false;
		s_preview.anonymous = true;

		function _start_stream() {
			let ts = new Date().getTime();
			let dt = ts - stream.ts;
			stream.ts = ts;
			stream.timer = 0;
			console.log('_start_stream ' + dt);

			let img = document.getElementById('video_preview') || video_preview;
			img.src = url + 'snapshot' + '?t=' + new Date().getTime();
		}

		function start_stream() {
			if (stream.timer) {
				return;
			}

			stream.timer = setTimeout(function () {
				_start_stream();
			}, 500);
		}

		function on_error() {
			console.log('on_error');

			let img = document.getElementById('video_preview') || video_preview;
			img.style.display = 'none';

			let status = document.getElementById('stream_status') || stream_status;
			status.style.display = 'block';

			let enabled = uci.get('ustreamer', 'video0', 'enabled');

			if (enabled) {
				start_stream();
			}
		}

		function on_load() {
			console.log('on_load');

			let img = document.getElementById('video_preview') || video_preview;
			img.style.display = 'block';

			let status = document.getElementById('stream_status') || stream_status;
			status.style.display = 'none';
		}

		// HTTP preview
		const video_preview = E(
			'img',
			{
				'id': 'video_preview',
				'class': 'img-preview',
				'error': on_error,
				'load': on_load,
			}
		);

		const stream_status = E(
			'p',
			{
				'id': 'stream_status',
				'style': 'text-align: center; color: orange; font-weight: bold;',
			},
			_('Stream unavailable'),
		);

		start_stream();

		const preview = s_preview.option(form.DummyValue, '_dummy');

		preview.render = L.bind(function (view, section_id) {
			return E([], [
				video_preview,
				stream_status
			]);
		}, preview, this);

		preview.depends('enabled', '1');


		// settings

		s = m.section(form.TypedSection, 'ustreamer', _('Settings'));
		s.addremove = false;
		s.anonymous = true;

		s.tab('general', _('General'));
		s.tab('capture', _('Capture'));
		s.tab('server_http', _('HTTP server'));
		s.tab('sink_jpeg', _('JPEG sink'));
		s.tab('sink_raw', _('RAW sink'));
		s.tab('sink_h264', _('H264 sink'));
		s.tab('logging', _('Logging'));
		s.tab('image_control', _('Image control'));


		// general

		let this_tab = 'general';

		const enabled = s.taboption(
			this_tab, form.Flag, 'enabled', _('Enabled'), _('Enable µStreamer')
		);

		const device = s.taboption(
			this_tab, form.Value, 'device', _('Device'), _(
			'Path to V4L2 device. Default: /dev/video0'
		));

		device.default = '/dev/video0';
		device.value('/dev/video0', '/dev/video0');
		device.value('/dev/video1', '/dev/video1');
		device.value('/dev/video2', '/dev/video2');
		device.optional = true;

		const device_timeout = s.taboption(
			this_tab, form.Value, 'device_timeout', _('Device timeout'), _(
			'Timeout for device querying. Default: 1 second'
		));

		device_timeout.datatype = 'and(uinteger, range(0, 60))';
		device_timeout.placeholder = '5';
		device_timeout.optional = true;

		const input = s.taboption(
			this_tab, form.Value, 'input', _('Input'), _('Input channel. Default: 0')
		);

		input.datatype = 'and(uinteger, range(0, 128))';
		input.placeholder = '0';
		input.optional = true;

		const resolution = s.taboption(
			this_tab, form.Value, 'resolution', _('Resolution'), _(
			'Initial image resolution. Default: 640x480'
		));

		resolution.default = '640x480';
		resolution.value('320x240', '320x240');
		resolution.value('640x480', '640x480');
		resolution.value('800x600', '800x600');
		resolution.value('864x480', '864x480');
		resolution.value('960x544', '960x544');
		resolution.value('960x720', '960x720');
		resolution.value('1280x720', '1280x720');
		resolution.value('1280x960', '1280x960');
		resolution.value('1920x1080', '1920x1080');
		resolution.optional = true;

		const fps = s.taboption(
			this_tab, form.Value, 'desired_fps', _('Frames per second'), _(
			'Desired FPS. Default: maximum possible'
		));

		fps.datatype = 'and(uinteger, min(0))';
		fps.placeholder = '0';
		fps.optional = true;

		const slowdown = s.taboption(
			this_tab, form.Flag, 'slowdown', _('Slowdown'), _(
			'Slowdown capturing to 1 FPS or less when no stream or sink clients are ' +
			'connected.<br />Useful to reduce CPU consumption. Default: disabled'
		));

		const format = s.taboption(
			this_tab, form.Value, 'format', _('Image format'), _('Default: YUYV')
		);

		format.default = 'YUYV';
		format.value('YUYV', 'YUYV');
		format.value('YVYU', 'YVYU');
		format.value('UYVY', 'UYVY');
		format.value('YUV420', 'YUV420');
		format.value('YVU420', 'YVU420');
		format.value('RGB565', 'RGB565');
		format.value('RGB24', 'RGB24');
		format.value('BGR24', 'BGR24');
		format.value('GREY', 'GREY');
		format.value('MJPEG', 'MJPEG');
		format.value('JPEG', 'JPEG');
		format.optional = true;

		const encoder = s.taboption(
			this_tab, form.Value, 'encoder', _('Еncoder'), _(
			'Use specified encoder. It may affect the number of workers<br />' +
			'<li><kbd>CPU  ──────── </kbd>Software MJPEG encoding (default)</li>' +
			'<li><kbd>HW  ───────── </kbd>Use pre-encoded MJPEG frames directly from camera hardware</li>' +
			'<li><kbd>M2M-VIDEO  ── </kbd>GPU-accelerated MJPEG encoding using V4L2 M2M video interface</li>' +
			'<li><kbd>M2M-IMAGE  ── </kbd>GPU-accelerated JPEG encoding using V4L2 M2M image interface</li>'
		));

		encoder.default = 'CPU';
		encoder.value('CPU', 'CPU');
		encoder.value('HW', 'HW');
		encoder.value('M2M-VIDEO', 'M2M-VIDEO');
		encoder.value('M2M-IMAGE', 'M2M-IMAGE');
		encoder.optional = true;

		const quality = s.taboption(
			this_tab, form.Value, 'quality', _('Quality'), _(
			'Set the quality of JPEG encoding: 1 to 100 (best). Default: 80<br />' +
			'If HW encoding is used (JPEG source format), attempts to configure<br />' +
			"the camera or capture device hardware's internal encoder.<br />" +
			'MJPEG will not be recoded to MJPEG to change the quality'
		));

		quality.datatype = 'and(uinteger, range(0, 100))';
		quality.placeholder = '0';
		quality.optional = true;

		const host = s.taboption(
			this_tab, form.Value, 'host', _('Host'), _(
			'Listen on Hostname or IP. Default: 127.0.0.1'
		));

		host.datatype = 'or(ip4addr, ip6addr, host)';
		host.placeholder = '::';
		host.optional = true;

		const port = s.taboption(
			this_tab, form.Value, 'port', _('Port'), _(
			'Bind to this TCP port. Default: 8080'
		));

		port.datatype = 'port';
		port.placeholder = '8080';
		port.optional = true;

		const user = s.taboption(
			this_tab, form.Value, 'user', _('Username'), _(
			'HTTP basic auth user. Default: disabled'
		));

		user.datatype = 'string';
		user.placeholder = '';
		user.optional = true;

		const pass = s.taboption(
			this_tab, form.Value, 'pass', _('Password'), _(
			'HTTP basic auth passwd. Default: empty'
		));

		pass.datatype = 'string';
		pass.placeholder = '';
		pass.password = true;
		pass.optional = true;


		// capture

		this_tab = 'capture';

		const allow_truncated_frames = s.taboption(
			this_tab, form.Flag, 'allow_truncated_frames',
			_('Allow truncated frames'), _(
			'Allows to handle truncated frames. Default: disabled<br />' +
			'Useful if the device produces incorrect but still acceptable frames'
		));

		const format_swap_rgb = s.taboption(
			this_tab, form.Flag, 'format_swap_rgb', _('R-G-B order swap'), _(
			'RGB to BGR and vice versa. Default: disabled'
		));

		const persistent = s.taboption(
			this_tab, form.Flag, 'persistent', _('Persistent'), _(
			"Don't re-initialize device on timeout. Default: disabled"
		));

		const dv_timings = s.taboption(
			this_tab, form.Flag, 'dv_timings', _('DV-timings'), _(
			'Enable DV-timings querying and events processing to automatic ' +
			'resolution change<br />Default: disable'
		));

		const tv_standard = s.taboption(
			this_tab, form.ListValue, 'tv_standard', _('Force TV standard'), _(
			'Default: disabled'
		));

		tv_standard.default = '';
		tv_standard.value('', _('default'));
		tv_standard.value('PAL', 'PAL');
		tv_standard.value('NTSC', 'NTSC');
		tv_standard.value('SECAM', 'SECAM');
		tv_standard.optional = true;

		const io_method = s.taboption(
			this_tab, form.ListValue, 'io_method', _('V4L2 IO method'), _(
			'Changing this parameter may increase the performance. Or not.<br />' +
			'See kernel documentation. Default: MMAP'
		));

		io_method.default = '';
		io_method.value('', _('default'));
		io_method.value('MMAP', 'MMAP');
		io_method.value('USERPTR', 'USERPTR');
		io_method.optional = true;

		const buffers = s.taboption(
			this_tab, form.Value, 'buffers', _('Buffers'), _(
			'The number of buffers to receive data from the device.<br />' +
			'Each buffer may be processed using an independent thread.<br />' +
			'Default: 3 (the number of CPU cores (but not more than 4) + 1)'
		));

		buffers.datatype = 'and(uinteger, range(0, 32))';
		buffers.placeholder = '3';
		buffers.optional = true;

		const workers = s.taboption(
			this_tab, form.Value, 'workers', _('Workers'), _(
			'The number of worker threads but not more than buffers.<br />' +
			'Default: 2 (the number of CPU cores (but not more than 4))'
		));

		workers.datatype = 'and(uinteger, range(0, 32))';
		workers.placeholder = '2';
		workers.optional = true;

		const m2m_device = s.taboption(
			this_tab, form.FileUpload, 'm2m_device', _('M2M device'), _(
			'Path to V4L2 M2M encoder device. Default: auto select'
		));

		m2m_device.root_directory = '/dev';
		m2m_device.directory_create = false;
		m2m_device.enable_download = false;
		m2m_device.enable_upload = false;
		m2m_device.enable_remove = false;
		m2m_device.show_hidden = true;
		m2m_device.optional = true;
		m2m_device.datatype = 'file';

		const min_frame_size = s.taboption(
			this_tab, form.Value, 'min_frame_size', _('Min frame size'), _(
			'Drop frames smaller than this limit. Useful if the device<br />' +
			'produces small-sized garbage frames. Default: 128 bytes'
		));

		min_frame_size.datatype = 'and(uinteger, range(0, 8192))';
		min_frame_size.placeholder = '128';
		min_frame_size.optional = true;

		const device_error_delay = s.taboption(
			this_tab, form.Value, 'device_error_delay', _('Device error delay'), _(
			'Delay before trying to connect to the device again<br />' +
			'after an error (timeout for example). Default: 1 second'
		));

		device_error_delay.datatype = 'and(uinteger, range(0, 60))';
		device_error_delay.placeholder = '1';
		device_error_delay.optional = true;


		// HTTP server

		this_tab = 'server_http';

		const tcp_nodelay = s.taboption(
			this_tab, form.Flag, 'tcp_nodelay', _('TCP no delay'), _(
			'Set TCP_NODELAY flag to the client /stream socket. Only for TCP ' +
			'socket<br >Default: disabled'
		));

		const www = s.taboption(
			this_tab, form.Value, 'static', _('WWW folder'), _(
			'Path to dir with static files instead of embedded root index page<br />' +
			'Symlinks are not supported for security reasons. Default: disabled'
		));

		www.datatype = 'directory';
		www.placeholder = '/www/webcam';
		www.optional = true;

		const unix = s.taboption(
			this_tab, form.Value, 'unix', _('UNIX socket'), _(
			'Bind to UNIX domain socket. Default: disabled'
		));

		unix.datatype = 'file';
		unix.placeholder = '/path/to/socket';
		unix.optional = true;

		const unix_rm = s.taboption(
			this_tab, form.Flag, 'unix_rm', _('UNIX socket remove old'), _(
			'Try to remove old UNIX socket file before binding. Default: disabled'
		));

		function validate_file_mode (section_id, value) {
			if (!value || /^[0-7]{3,4}$/.test(value)) return true;
			return _('Expecting: file mode, e.g. 640 or 0640');
		}

		const unix_mode = s.taboption(
			this_tab, form.Value, 'unix_mode', _('UNIX socket permissions'), _(
			'Set UNIX socket file permissions (like 777). Default: disabled'
		));

		unix_mode.validate = validate_file_mode;
		unix_mode.placeholder = '660';
		unix_mode.optional = true;

		const drop_same_frames = s.taboption(
			this_tab, form.Value, 'drop_same_frames', _('Drop same frames'), _(
			"Don't send identical frames to clients, but no more than specified " +
			"number.<br />" +
			"It can significantly reduce the outgoing traffic, but will increase" +
			"<br />" +
			"the CPU loading. Don't use this option with analog signal sources<br />" +
			"or webcams, it's useless. Default: disabled"
		));

		drop_same_frames.datatype = 'and(uinteger, min(0))';
		drop_same_frames.placeholder = '0';
		drop_same_frames.optional = true;

		const fake_resolution = s.taboption(
			this_tab, form.Value, 'fake_resolution', _('Fake resolution'), _(
			'Override image resolution for the /state. Default: disabled'
		));

		fake_resolution.default = '';
		fake_resolution.keylist = resolution.keylist;
		fake_resolution.vallist = resolution.vallist;
		fake_resolution.optional = true;

		const allow_origin = s.taboption(
			this_tab, form.Value, 'allow_origin', _('Allow origin'), _(
			'Set Access-Control-Allow-Origin header. Default: disabled'
		));

		allow_origin.datatype = 'string';
		allow_origin.optional = true;

		const instance_id = s.taboption(
			this_tab, form.Value, 'instance_id', _('Instance ID'), _(
			'A short string identifier to be displayed in the /state handle.<br />' +
			'It must satisfy regexp ^[a-zA-Z0-9\./+_-]*$. Default: an empty string'
		));

		instance_id.datatype = 'string';
		instance_id.optional = true;

		const server_timeout = s.taboption(
			this_tab, form.Value, 'server_timeout', _('Server timeout'), _(
			'Timeout for client connections. Default: 10 seconds'
		));

		server_timeout.datatype = 'and(uinteger, range(0, 60))';
		server_timeout.placeholder = '10';
		server_timeout.optional = true;


		// JPEG sink

		this_tab = 'sink_jpeg';

		const jpeg_sink = s.taboption(
			this_tab, form.Value, 'jpeg_sink', _('JPEG sink'), _(
			'Use the shared memory to sink JPEG frames. Default: disabled<br />' +
			'The name should end with a suffix .jpg or .jpeg'
		));

		jpeg_sink.datatype = 'file';
		jpeg_sink.placeholder = 'name.jpeg';
		jpeg_sink.optional = true;

		const jpeg_sink_mode = s.taboption(
			this_tab, form.Value, 'jpeg_sink_mode', _('Sink permissions'), _(
			'Set sink file permissions. Default: 660'
		));

		jpeg_sink_mode.validate = validate_file_mode;
		jpeg_sink_mode.placeholder = '660';
		jpeg_sink_mode.optional = true;

		const jpeg_sink_client_ttl = s.taboption(
			this_tab, form.Value, 'jpeg_sink_client_ttl', _('Client TTL'), _(
			'Default: 10 seconds'
		));

		jpeg_sink_client_ttl.datatype = 'and(uinteger, range(0, 60))';
		jpeg_sink_client_ttl.placeholder = '10';
		jpeg_sink_client_ttl.optional = true;

		const jpeg_sink_timeout = s.taboption(
			this_tab, form.Value, 'jpeg_sink_timeout', _('Timeout for lock'), _(
			'Default: 1 second'
		));

		jpeg_sink_timeout.datatype = 'and(uinteger, range(0, 60))';
		jpeg_sink_timeout.placeholder = '1';
		jpeg_sink_timeout.optional = true;

		const jpeg_sink_rm = s.taboption(
			this_tab, form.Flag, 'jpeg_sink_rm', _('Remove on stop'), _(
			'Remove shared memory on stop. Default: disabled'
		));


		// RAW sink

		this_tab = 'sink_raw';

		const raw_sink = s.taboption(
			this_tab, form.Value, 'raw_sink', _('RAW sink'), _(
			'Use the shared memory to sink RAW frames. Default: disabled<br />' +
			'The name should end with a suffix .raw'
		));

		raw_sink.datatype = 'file';
		raw_sink.placeholder = 'name.raw';
		raw_sink.optional = true;

		const raw_sink_mode = s.taboption(
			this_tab, form.Value, 'raw_sink_mode', _('Sink permissions'), _(
			'Set sink file permissions. Default: 660'
		));

		raw_sink_mode.validate = validate_file_mode;
		raw_sink_mode.placeholder = '660';
		raw_sink_mode.optional = true;

		const raw_sink_client_ttl = s.taboption(
			this_tab, form.Value, 'raw_sink_client_ttl', _('Client TTL'), _(
			'Default: 10 seconds'
		));

		raw_sink_client_ttl.datatype = 'and(uinteger, range(0, 60))';
		raw_sink_client_ttl.placeholder = '10';
		raw_sink_client_ttl.optional = true;

		const raw_sink_timeout = s.taboption(
			this_tab, form.Value, 'raw_sink_timeout', _('Timeout for lock'), _(
			'Default: 1 second'
		));

		raw_sink_timeout.datatype = 'and(uinteger, range(0, 60))';
		raw_sink_timeout.placeholder = '1';
		raw_sink_timeout.optional = true;

		const raw_sink_rm = s.taboption(
			this_tab, form.Flag, 'raw_sink_rm', _('Remove on stop'), _(
			'Remove shared memory on stop. Default: disabled'
		));


		// H264 sink

		this_tab = 'sink_h264';

		const h264_sink = s.taboption(
			this_tab, form.Value, 'h264_sink', _('H264 sink'), _(
			'Use the shared memory to sink H264 frames. Default: disabled<br />' +
			'The name should end with a suffix .h264'
		));

		h264_sink.datatype = 'file';
		h264_sink.placeholder = 'name.h264';
		h264_sink.optional = true;

		const h264_sink_mode = s.taboption(
			this_tab, form.Value, 'h264_sink_mode', _('Sink permissions'), _(
			'Set sink file permissions. Default: 660'
		));

		h264_sink_mode.validate = validate_file_mode;
		h264_sink_mode.placeholder = '660';
		h264_sink_mode.optional = true;

		const h264_sink_client_ttl = s.taboption(
			this_tab, form.Value, 'h264_sink_client_ttl', _('Client TTL'), _(
			'Default: 10 seconds'
		));

		h264_sink_client_ttl.datatype = 'and(uinteger, range(0, 60))';
		h264_sink_client_ttl.placeholder = '10';
		h264_sink_client_ttl.optional = true;

		const h264_sink_timeout = s.taboption(
			this_tab, form.Value, 'h264_sink_timeout', _('Timeout for lock'), _(
			'Default: 1 second'
		));

		h264_sink_timeout.datatype = 'and(uinteger, range(0, 60))';
		h264_sink_timeout.placeholder = '1';
		h264_sink_timeout.optional = true;

		const h264_sink_rm = s.taboption(
			this_tab, form.Flag, 'h264_sink_rm', _('Remove on stop'), _(
			'Remove shared memory on stop. Default: disabled'
		));

		const h264_boost = s.taboption(
			this_tab, form.Flag, 'h264_boost', _('H264 boost'), _(
			'Increase encoder performance on PiKVM V4. Default: disabled'
		));

		const h264_bitrate = s.taboption(
			this_tab, form.Value, 'h264_bitrate', _('Bitrate (kbps)'), _(
			'Default: 5000 kbps'
		));

		h264_bitrate.datatype = 'and(uinteger, range(25, 20000))';
		h264_bitrate.placeholder = '5000';
		h264_bitrate.optional = true;

		const h264_gop = s.taboption(
			this_tab, form.Value, 'h264_gop', _('Keyframe interval'), _(
			'Default: 30'
		));

		h264_gop.datatype = 'and(uinteger, range(0, 60))';
		h264_gop.placeholder = '30';
		h264_gop.optional = true;

		const h264_m2m_device = s.taboption(
			this_tab, form.FileUpload, 'h264_m2m_device', _('M2M device'), _(
			'Path to V4L2 M2M encoder device. Default: auto select'
		));

		h264_m2m_device.root_directory = '/dev';
		h264_m2m_device.directory_create = false;
		h264_m2m_device.enable_download = false;
		h264_m2m_device.enable_upload = false;
		h264_m2m_device.enable_remove = false;
		h264_m2m_device.show_hidden = true;
		h264_m2m_device.optional = true;
		h264_m2m_device.datatype = 'file';


		// logging

		this_tab = 'logging';

		const log_level = s.taboption(
			this_tab, form.ListValue, 'log_level', _('Log level'), _(
			'Verbosity level of messages from 0 (info) to 3 (debug)<br />' +
			'Enabling debugging messages can slow down the program<br />' +
			'Default: 0 (info)'
		));

		log_level.default = '';
		log_level.datatype = 'and(uinteger, range(0, 3))';
		log_level.value('', _('default'));
		log_level.value('0', '0 ' + _('Info'));
		log_level.value('1', '1 ' + _('Performance'));
		log_level.value('2', '2 ' + _('Verbose'));
		log_level.value('3', '3 ' + _('Debug'));
		log_level.optional = true;

		const exit_on_no_clients = s.taboption(
			this_tab, form.Value, 'exit_on_no_clients', _('Exit on no clients'), _(
			'Exit the program if there have been no stream or sink clients<br />' +
			'or any HTTP requests in the last N seconds. Default: 0 (disabled)'
		));

		exit_on_no_clients.datatype = 'and(uinteger, range(0, 86400))';
		exit_on_no_clients.placeholder = '0';
		exit_on_no_clients.optional = true;


		// image control

		this_tab = 'image_control';

		const image_default = s.taboption(
			this_tab, form.Flag, 'image_default', _('Image default'), _(
			'Reset all image settings below to default. Unchecked: no change'
		));

		function validate_int_default (section_id, value) {
			if (!value || (value == 'default')) return true;
			value = parseInt(value);
			if (!isNaN(value)) return true;
			return _('Expecting: number | default');
		}

		function validate_int_default_auto (section_id, value) {
			if (!value || (value == 'default') || (value == 'auto')) return true;
			value = parseInt(value);
			if (!isNaN(value)) return true;
			return _('Expecting: number | default | auto');
		}

		const brightness = s.taboption(
			this_tab, form.Value, 'brightness', _('Brightness'), _(
			'number | default | auto. Blank: no change'
		));

		brightness.validate = validate_int_default_auto;
		brightness.placeholder = '128 | default | auto';
		brightness.optional = true;

		const contrast = s.taboption(
			this_tab, form.Value, 'contrast', _('Contrast'), _(
			'number | default. Blank: no change'
		));

		contrast.validate = validate_int_default;
		contrast.placeholder = '128 | default';
		contrast.optional = true;

		const saturation = s.taboption(
			this_tab, form.Value, 'saturation', _('Saturation'), _(
			'number | default. Blank: no change'
		));

		saturation.validate = validate_int_default;
		saturation.placeholder = '128 | default';
		saturation.optional = true;

		const gamma = s.taboption(
			this_tab, form.Value, 'gamma', _('Gamma'), _(
			'number | default. Blank: no change'
		));

		gamma.validate = validate_int_default;
		gamma.placeholder = 'default';
		gamma.optional = true;

		const gain = s.taboption(
			this_tab, form.Value, 'gain', _('Gain'), _(
			'number | default | auto. Blank: no change'
		));

		gain.validate = validate_int_default_auto;
		gain.placeholder = '0 | default | auto';
		gain.optional = true;

		const hue = s.taboption(
			this_tab, form.Value, 'hue', _('Hue'), _(
			'number | default | auto. Blank: no change'
		));

		hue.validate = validate_int_default_auto;
		hue.placeholder = 'number | default | auto';
		hue.optional = true;

		const sharpness = s.taboption(
			this_tab, form.Value, 'sharpness', _('Sharpness'), _(
			'number | default. Blank: no change'
		));

		sharpness.validate = validate_int_default;
		sharpness.placeholder = '128 | default';
		sharpness.optional = true;

		const color_effect = s.taboption(
			this_tab, form.Value, 'color_effect', _('Colour effect'), _(
			'number | default. Blank: no change'
		));

		color_effect.validate = validate_int_default;
		color_effect.placeholder = 'default';
		color_effect.optional = true;

		const white_balance = s.taboption(
			this_tab, form.Value, 'white_balance', _('White balance'), _(
			'temperature | default | auto. Blank: no change'
		));

		white_balance.validate = validate_int_default_auto;
		white_balance.placeholder = '4000 | default | auto';
		white_balance.optional = true;

		const backlight_compensation = s.taboption(
			this_tab, form.Value, 'backlight_compensation',
			_('Backlight compensation'), _(
			'number | default. Blank: no change'
		));

		backlight_compensation.validate = validate_int_default;
		backlight_compensation.placeholder = '0 | default';
		backlight_compensation.optional = true;

		const flip_horizontal = s.taboption(
			this_tab, form.Value, 'flip_horizontal', _('Flip horizontal'), _(
			'number | default. Blank: no change'
		));

		flip_horizontal.validate = validate_int_default;
		flip_horizontal.placeholder = '0 | default';
		flip_horizontal.optional = true;

		const flip_vertical = s.taboption(
			this_tab, form.Value, 'flip_vertical', _('Flip vertical'), _(
			'number | default. Blank: no change'
		));

		flip_vertical.validate = validate_int_default;
		flip_vertical.placeholder = '0 | default';
		flip_vertical.optional = true;

		const rotate = s.taboption(
			this_tab, form.Value, 'rotate', _('Rotate'), _(
			'number | default. Blank: no change'
		));

		rotate.validate = validate_int_default;
		rotate.placeholder = '0 | default';
		rotate.optional = true;


		return m.render();
	},
});
