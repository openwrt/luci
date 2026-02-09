'use strict';
'require form';
'require fs';
'require poll';
'require uci';
'require ui';
'require view';

/*  Licensed to the public under the Apache License 2.0. */

return view.extend({
	load() {
		document
			.querySelector('head')
			.appendChild(
				E('style', { type: 'text/css' }, [
					'.img-preview {display: inline-block !important;height: auto;width: 640px;padding: 4px;line-height: 1.428571429;background-color: #fff;border: 1px solid #ddd;border-radius: 4px;-webkit-transition: all .2s ease-in-out;transition: all .2s ease-in-out;margin-bottom: 5px;display: none;}',
				]),
			);

		return Promise.all([
			L.resolveDefault(fs.list('/dev/'), []).then(entries => entries.filter(e => /^video.*$/.test(e.name)) ),
			uci.load('ustreamer'),
		]);
	},
	render([video_devs]) {
		let m, s, o;

		let self = this;
		poll.add(() => {
			self.load().then(([video_devs]) => {
				self.render([video_devs]);
			});
		}, 5);

		m = new form.Map('ustreamer', 'ustreamer',
			_('µStreamer is a lightweight and very quick server to stream MJPEG video from any V4L2 device to the net.'));

		//General settings

		const section_gen = m.section(form.TypedSection, 'ustreamer', _('General'));
		section_gen.addremove = false;
		section_gen.anonymous = true;

		const enabled = section_gen.option(form.Flag, 'enabled', _('Enabled'));

		const log_level = section_gen.option(form.Value, 'log_level', _('Log level'));
		log_level.placeholder = _('info');
		log_level.value('0', _('info'));
		log_level.value('1', _('performance'));
		log_level.value('2', _('verbose'));
		log_level.value('3', _('debug'));

		//Plugin settings

		s = m.section(form.TypedSection, 'ustreamer', _('Plugin settings'));
		s.addremove = true;
		s.anonymous = true;

		s.tab('h264_sink', _('H264 sink'));
		s.tab('output_http', _('HTTP output'));
		s.tab('image_control', _('Image control'));
		s.tab('jpeg_sink', _('JPEG sink'));
		s.tab('raw_sink', _('RAW sink'));
		s.tab('input_uvc', _('UVC input'));

		// Input UVC settings

		let this_tab = 'input_uvc';

		const device = s.taboption(this_tab, form.Value, 'device', _('Device'));
		device.placeholder = '/dev/video0';
		for (const dev of video_devs)
			device.value(`/dev/${dev.name}`);
		device.optional = false;
		device.rmempty = false;

		const dtimeout = s.taboption(this_tab, form.Value, 'timeout', _('Timeout'), _('units: seconds'));
		dtimeout.placeholder = '5';
		dtimeout.datatype = 'uinteger';

		const input = s.taboption(this_tab, form.Flag, 'input', _('Input'));
		input.default = input.disabled;

		const resolution = s.taboption(this_tab, form.Value, 'resolution', _('Resolution'));
		resolution.placeholder = '640x480';
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

		const fps = s.taboption(this_tab, form.Value, 'desired_fps', _('Frames per second'),
			_('Default: maximum possible.'));
		fps.datatype = 'and(uinteger, min(1))';
		fps.placeholder = '5';
		fps.optional = true;

		const format = s.taboption(this_tab, form.Value, 'format', _('Format'));
		format.placeholder = 'YUYV';
		format.value('BGR24');
		format.value('GREY');
		format.value('JPEG');
		format.value('MJPEG');
		format.value('RGB24');
		format.value('RGB565');
		format.value('UYVY');
		format.value('YUV420');
		format.value('YUYV');
		format.value('YVU420');
		format.value('YVYU');

		const encoder = s.taboption(this_tab, form.Value, 'encoder', _('Encoder'));
		encoder.value('CPU');
		encoder.value('HW');

		const quality = s.taboption(
			this_tab,
			form.Value,
			'quality',
			_('Quality'),
			_('Set the quality in percent.'),
		);
		quality.datatype = 'range(0, 100)';


		const allow_truncated_frames = s.taboption(this_tab, form.Flag, 'allow_truncated_frames', _('Allow truncated frames'));
		allow_truncated_frames.default = allow_truncated_frames.disabled;

		const format_swap_rgb = s.taboption(this_tab, form.Flag, 'format_swap_rgb', _('Format: Swap RGB'),
			_('Enable R-G-B order swapping: RGB to BGR and vice versa.'));
		format_swap_rgb.default = format_swap_rgb.disabled;

		const persistent = s.taboption(this_tab, form.Flag, 'persistent', _('Persistent'),
			_("Don't re-initialize device on timeout. Default: disabled."));
		persistent.default = persistent.disabled;

		const dv_timings = s.taboption(this_tab, form.Flag, 'dv_timings', _('DV Timings'),
			_("Enable DV-timings querying and events processing to automatic resolution change. Default: disabled."));
		dv_timings.default = dv_timings.disabled;

		const tv_standard = s.taboption(this_tab, form.Value, 'tv_standard', _('TV standard'));
		tv_standard.placeholder = '';
		tv_standard.value('PAL');
		tv_standard.value('NTSC');
		tv_standard.value('SECAM');

		const io_method = s.taboption(this_tab, form.Value, 'io_method', _('IO method'));
		io_method.placeholder = 'MMAP';
		io_method.value('MMAP');
		io_method.value('USERPTR');

		const buffers = s.taboption(this_tab, form.Value, 'buffers', _('Buffers'),
			_('The number of buffers to receive data from the device.') + '<br/>' +
			_('Each buffer may processed using an independent thread.') + '<br/>' +
			_('Default: 3 (the number of CPU cores (but not more than 4) + 1).'));
		buffers.datatype = 'and(uinteger, min(1))';
		buffers.placeholder = '3';
		buffers.optional = true;

		const workers = s.taboption(this_tab, form.Value, 'workers', _('Workers'),
			_('The number of worker threads but not more than buffers.') + '<br/>' +
			_('Default: 2 (the number of CPU cores (but not more than 4)).'));
		workers.datatype = 'and(uinteger, min(1))';
		workers.placeholder = '2';
		workers.optional = true;

		const m2m_device = s.taboption(this_tab, form.FileUpload, 'm2m_device', _('M2M device'));
		m2m_device.root_directory = '/dev';
		m2m_device.show_hidden = true;
		m2m_device.directory_create = false;
		m2m_device.enable_download = false;
		m2m_device.enable_upload = false;
		m2m_device.enable_remove = false;
		m2m_device.optional = true;
		m2m_device.datatype = 'file';

		const min_frame_size = s.taboption(
			this_tab,
			form.Value,
			'min_frame_size',
			_('Drop frames smaller than this limit'),
			_('Set the minimum size if the webcam produces small-sized garbage frames. May happen under low light conditions'),
		);
		min_frame_size.datatype = 'uinteger';
		min_frame_size.placeholder = '128';

		const device_error_delay = s.taboption(this_tab, form.Value, 'device_error_delay', _('Device error delay'));
		device_error_delay.datatype = 'and(uinteger, min(1))';
		device_error_delay.placeholder = '1';
		device_error_delay.optional = true;

		// Output HTTP settings

		this_tab = 'output_http';

		const host = s.taboption(this_tab, form.Value, 'host', _('Host'), _('TCP host for this HTTP server'));
		host.datatype = 'host';
		host.placeholder = '::';
		host.datatype = 'or(hostname,ipaddr)';
		host.optional = false;

		const port = s.taboption(this_tab, form.Value, 'port', _('Port'), _('TCP port for this HTTP server'));
		port.datatype = 'port';
		port.placeholder = '8080';
		port.optional = false;

		const enable_auth = s.taboption(this_tab, form.Flag, 'enable_auth', _('Authentication required'), _('Ask for username and password on connect'));
		enable_auth.default = false;

		const username = s.taboption(this_tab, form.Value, 'user', _('Username'));
		username.depends('enable_auth', '1');
		username.optional = false;

		const password = s.taboption(this_tab, form.Value, 'pass', _('Password'));
		password.depends('enable_auth', '1');
		password.password = true;
		password.optional = false;
		password.default = false;

		const staticres = s.taboption(this_tab, form.Value, 'static', _('WWW folder'), _('Folder that contains webpages'));
		staticres.datatype = 'directory';
		staticres.placeholder = '/www/webcam/';
		staticres.optional = false;

		const unix = s.taboption(this_tab, form.Value, 'unix', _('Socket'), _('Folder that contains the socket'));
		unix.datatype = 'file';
		unix.placeholder = '/path/to/socket';

		const unix_mode = s.taboption(this_tab, form.Value, 'unix_mode', _('Socket Permissions'));
		unix_mode.datatype = 'string';
		unix_mode.placeholder = '660';

		const drop_same_frames = s.taboption(this_tab, form.Flag, 'drop_same_frames', _('Drop same frames'));
		drop_same_frames.default = drop_same_frames.disabled;

		const fake_resolution = s.taboption(this_tab, form.Value, 'fake_resolution', _('Fake resolution'));
		fake_resolution.placeholder = '640x480';
		fake_resolution.keylist = resolution.keylist;
		fake_resolution.vallist = resolution.vallist;

		const allow_origin = s.taboption(this_tab, form.Value, 'allow_origin', _('Allow origin'));
		allow_origin.values = resolution.values;

		const instance_id = s.taboption(this_tab, form.Value, 'instance_id', _('Instance ID'));

		const server_timeout = s.taboption(this_tab, form.Value, 'server_timeout', _('Server timeout'));
		server_timeout.datatype = 'uinteger';
		server_timeout.placeholder = '10';



		function init_stream() {
			console.debug('init_stream');
			start_stream();
		}

		function _start_stream() {
			console.debug('_start_stream');

			const port = uci.get('ustreamer', 'core', 'port');
			let login;

			if (uci.get('ustreamer', 'core', 'enable_auth') == '1') {
				const user = uci.get('ustreamer', 'core', 'username');
				const pass = uci.get('ustreamer', 'core', 'password');
				login = `${user}:${pass}@`;
			} else {
				login = '';
			}

			const img = document.getElementById('video_preview') || video_preview;
			img.src = 'http://' + login + location.hostname + ':' + port + '/?action=snapshot' + '&t=' + new Date().getTime();
		}

		function start_stream() {
			console.debug('start_stream');

			setTimeout(function () {
				_start_stream();
			}, 5000);
		}

		function on_error() {
			console.warn('on_error');

			const img = video_preview;
			img.style.display = 'none';

			const stream_stat = document.getElementById('stream_status') || stream_status;
			stream_stat.style.display = 'block';

			// start_stream();
		}

		function on_load() {
			console.debug('on_load');

			const img = video_preview;
			img.style.display = 'block';

			const stream_stat = stream_status;
			stream_stat.style.display = 'none';
		}

		//HTTP preview
		const video_preview = E('img', {
			'id': 'video_preview',
			'class': 'img-preview',
			'error': on_error,
			'load': on_load,
		});

		const stream_status = E('p', {
				'id': 'stream_status',
				'style': 'text-align: center; color: orange; font-weight: bold;',
			},
			_('Stream unavailable'),
		);


		init_stream();

		const preview = s.taboption(this_tab, form.DummyValue, '_dummy');
		preview.render = L.bind(function (view, section_id) {
			return E([], [
				video_preview,
				stream_status
			]);
		}, preview, this);
		preview.depends('output', 'http');

		// JPEG sink settings

		this_tab = 'jpeg_sink';

		const jpeg_sink = s.taboption(this_tab, form.Value, 'jpeg_sink', _('JPEG sink'),
			_('Use the shared memory to sink JPEG frames. Default: disabled.') + '<br/>' +
			_('The name should end with a suffix ".jpeg".') + '<br/>' +
			_('Default: disabled.'));
		jpeg_sink.placeholder = 'name.jpeg';
		jpeg_sink.optional = true;

		const jpeg_sink_mode = s.taboption(this_tab, form.Value, 'jpeg_sink_mode', _('JPEG sink mode'),
			_('Set JPEG sink permissions (like 777). Default: 660.'));
		jpeg_sink_mode.datatype = 'string';
		jpeg_sink_mode.placeholder = '660';
		jpeg_sink_mode.optional = true;

		const jpeg_sink_client_ttl = s.taboption(this_tab, form.Value, 'jpeg_sink_client_ttl', _('Client TTL'),
			_('Default: 10.'));
		jpeg_sink_client_ttl.datatype = 'uinteger';
		jpeg_sink_client_ttl.placeholder = '10';
		jpeg_sink_client_ttl.optional = true;

		const jpeg_sink_timeout = s.taboption(this_tab, form.Value, 'jpeg_sink_timeout', _('JPEG sink timeout'),
			_('Timeout for lock. Default: 1.'));
		jpeg_sink_timeout.datatype = 'uinteger';
		jpeg_sink_timeout.placeholder = '1';
		jpeg_sink_timeout.optional = true;

		const jpeg_sink_rm = s.taboption(this_tab, form.Flag, 'jpeg_sink_rm', _('Remove JPEG sink'),
			_('Remove JPEG sink file on exit'));
		jpeg_sink_rm.default = jpeg_sink_rm.disabled;

		// RAW sink settings

		this_tab = 'raw_sink';

		const raw_sink = s.taboption(this_tab, form.Value, 'raw_sink', _('RAW sink'),
			_('Use the shared memory to sink RAW frames. Default: disabled.') + '<br/>' +
			_('The name should end with a suffix ".raw".') + '<br/>' +
			_('Default: disabled.'));
		raw_sink.placeholder = 'name.raw';
		raw_sink.optional = true;

		const raw_sink_mode = s.taboption(this_tab, form.Value, 'raw_sink_mode', _('RAW sink mode'),
			_('Set RAW sink permissions (like 777). Default: 660.'));
		raw_sink_mode.datatype = 'string';
		raw_sink_mode.placeholder = '660';
		raw_sink_mode.optional = true;

		const raw_sink_client_ttl = s.taboption(this_tab, form.Value, 'raw_sink_client_ttl', _('RAW sink client TTL'),
			_('Client TTL. Default: 10.'));
		raw_sink_client_ttl.datatype = 'uinteger';
		raw_sink_client_ttl.placeholder = '10';
		raw_sink_client_ttl.optional = true;

		const raw_sink_timeout = s.taboption(this_tab, form.Value, 'raw_sink_timeout', _('RAW sink timeout'),
			_('Timeout for lock. Default: 1.'));
		raw_sink_timeout.datatype = 'uinteger';
		raw_sink_timeout.placeholder = '1';
		raw_sink_timeout.optional = true;

		const raw_sink_rm = s.taboption(this_tab, form.Flag, 'raw_sink_rm', _('Remove RAW sink'),
			_('Remove shared memory on stop. Default: disabled.'));
		raw_sink_rm.default = raw_sink_rm.disabled;

		// H264 sink settings

		this_tab = 'h264_sink';

		const h264_sink = s.taboption(this_tab, form.Value, 'h264_sink', _('H264 sink'),
			_('Use the shared memory to sink H264 frames. Default: disabled.') + '<br/>' +
			_('The name should end with a suffix ".h264"') + '<br/>' +
			_('Default: disabled.'));
		h264_sink.placeholder = 'name.h264';
		h264_sink.optional = true;

		const h264_sink_mode = s.taboption(this_tab, form.Value, 'h264_sink_mode', _('H264 sink mode'),
			_('Set H264 sink permissions (like 777). Default: 660.'));
		h264_sink_mode.datatype = 'string';
		h264_sink_mode.placeholder = '660';
		h264_sink_mode.optional = true;

		const h264_sink_rm = s.taboption(this_tab, form.Flag, 'h264_sink_rm', _('Remove'),
			_('Remove shared memory on stop. Default: disabled.'));
		h264_sink_rm.default = h264_sink_rm.disabled;

		const h264_sink_client_ttl = s.taboption(this_tab, form.Value, 'h264_sink_client_ttl', _('Sink client TTL'),
			_('Client TTL. Default: 10.'));
		h264_sink_client_ttl.datatype = 'uinteger';
		h264_sink_client_ttl.placeholder = '10';
		h264_sink_client_ttl.optional = true;

		const h264_sink_timeout = s.taboption(this_tab, form.Value, 'h264_sink_timeout', _('Sink timeout'),
			_('Timeout for lock. Default: 1.'));
		h264_sink_timeout.datatype = 'uinteger';
		h264_sink_timeout.placeholder = '1';
		h264_sink_timeout.optional = true;

		const h264_bitrate = s.taboption(this_tab, form.Value, 'h264_bitrate', _('Bitrate'),
			_('H264 bitrate in Kbps. Default: 5000.'));
		h264_bitrate.datatype = 'uinteger';
		h264_bitrate.placeholder = '5000';
		h264_bitrate.optional = true;

		const h264_gop = s.taboption(this_tab, form.Value, 'h264_gop', _('H264 GOP'),
			_('Interval between keyframes. Default: 30.'));
		h264_gop.datatype = 'uinteger';
		h264_gop.placeholder = '30';
		h264_gop.optional = true;

		const h264_m2m_device = s.taboption(this_tab, form.FileUpload, 'h264_m2m_device', _('H264 M2M device'),
			_('Path to V4L2 M2M encoder device. Default: auto select.'));
		h264_m2m_device.root_directory = '/dev';
		h264_m2m_device.show_hidden = true;
		h264_m2m_device.directory_create = false;
		h264_m2m_device.enable_download = false;
		h264_m2m_device.enable_upload = false;
		h264_m2m_device.enable_remove = false;
		h264_m2m_device.optional = true;
		h264_m2m_device.datatype = 'file';

		const h264_boost = s.taboption(this_tab, form.Flag, 'h264_boost', _('H264 boost'),
			_('Increase encoder performance on PiKVM V4. Default: disabled.'));
		h264_boost.default = h264_boost.disabled;

		const exit_on_no_clients = s.taboption(this_tab, form.Flag, 'exit_on_no_clients', _('Exit on no clients'),
			_('Exit the program if there have been no stream or sink clients ') + 
			_('or any HTTP requests in the last N seconds. Default: 0 (disabled).'));
		exit_on_no_clients.default = exit_on_no_clients.disabled;

		// Image control settings

		this_tab = 'image_control';

		const image_default = s.taboption(this_tab, form.Flag, 'image_default', _('Use device defaults'));
		image_default.default = image_default.disabled;

		const brightness = s.taboption(this_tab, form.Value, 'brightness', _('Brightness'));
		brightness.placeholder = '128 | auto';
		brightness.optional = true;

		const contrast = s.taboption(this_tab, form.Value, 'contrast', _('Contrast'));
		contrast.placeholder = '128';
		contrast.optional = true;

		const saturation = s.taboption(this_tab, form.Value, 'saturation', _('Saturation'));
		saturation.placeholder = '128';
		saturation.optional = true;

		const hue = s.taboption(this_tab, form.Value, 'hue', _('Hue'));
		hue.placeholder = '128 | auto';
		hue.optional = true;

		const gamma = s.taboption(this_tab, form.Value, 'gamma', _('Gamma'));
		gamma.placeholder = '128';
		gamma.optional = true;

		const sharpness = s.taboption(this_tab, form.Value, 'sharpness', _('Sharpness'));
		sharpness.placeholder = '128';
		sharpness.optional = true;

		const backlight_compensation = s.taboption(this_tab, form.Value, 'backlight_compensation', _('Backlight compensation'));
		backlight_compensation.placeholder = '128';
		backlight_compensation.optional = true;

		const white_balance = s.taboption(this_tab, form.Value, 'white_balance', _('White balance'));
		white_balance.placeholder = '128 | auto';
		white_balance.optional = true;

		const gain = s.taboption(this_tab, form.Value, 'gain', _('Gain'));
		gain.placeholder = '128 | auto';
		gain.optional = true;

		const color_effect = s.taboption(this_tab, form.Value, 'color_effect', _('Color effect'));
		color_effect.placeholder = '128';
		color_effect.optional = true;

		const rotate = s.taboption(this_tab, form.Value, 'rotate', _('Rotate'));
		rotate.datatype = 'uinteger';
		rotate.optional = true;

		const flip_horizontal = s.taboption(this_tab, form.Flag, 'flip_horizontal', _('Flip horizontally'));
		flip_horizontal.default = flip_horizontal.disabled;

		const flip_vertical = s.taboption(this_tab, form.Flag, 'flip_vertical', _('Flip vertically'));
		flip_vertical.default = flip_vertical.disabled;

		return m.render();
	},
});
