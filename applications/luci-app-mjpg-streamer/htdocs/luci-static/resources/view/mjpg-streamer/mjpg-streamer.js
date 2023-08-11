'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require poll';

/* Copyright 2014 Roger D < rogerdammit@gmail.com>
Licensed to the public under the Apache License 2.0. */

return view.extend({
	load: function () {
		var self = this;
		poll.add(function () {
			self.render();
		}, 5);

		document
			.querySelector('head')
			.appendChild(
				E('style', { type: 'text/css' }, [
					'.img-preview {display: inline-block !important;height: auto;width: 640px;padding: 4px;line-height: 1.428571429;background-color: #fff;border: 1px solid #ddd;border-radius: 4px;-webkit-transition: all .2s ease-in-out;transition: all .2s ease-in-out;margin-bottom: 5px;display: none;}',
				]),
			);

		return Promise.all([uci.load('mjpg-streamer')]);
	},
	render: function () {
		var m, s, o;

		m = new form.Map('mjpg-streamer', 'MJPG-streamer', _('mjpg streamer is a streaming application for Linux-UVC compatible webcams'));

		//General settings

		var section_gen = m.section(form.TypedSection, 'mjpg-streamer', _('General'));
		section_gen.addremove = false;
		section_gen.anonymous = true;

		var enabled = section_gen.option(form.Flag, 'enabled', _('Enabled'), _('Enable MJPG-streamer'));

		var input = section_gen.option(form.ListValue, 'input', _('Input plugin'));
		input.depends('enabled', '1');
		input.value('uvc', 'UVC');
		// input: value("file", "File")
		input.optional = false;

		var output = section_gen.option(form.ListValue, 'output', _('Output plugin'));
		output.depends('enabled', '1');
		output.value('http', 'HTTP');
		output.value('file', 'File');
		output.optional = false;

		//Plugin settings

		s = m.section(form.TypedSection, 'mjpg-streamer', _('Plugin settings'));
		s.addremove = false;
		s.anonymous = true;

		s.tab('output_http', _('HTTP output'));
		s.tab('output_file', _('File output'));
		s.tab('input_uvc', _('UVC input'));
		// s: tab("input_file", _("File input"))

		// Input UVC settings

		var this_tab = 'input_uvc';

		var device = s.taboption(this_tab, form.Value, 'device', _('Device'));
		device.default = '/dev/video0';
		//device.datatype = "device"
		device.value('/dev/video0', '/dev/video0');
		device.value('/dev/video1', '/dev/video1');
		device.value('/dev/video2', '/dev/video2');
		device.optional = false;

		var resolution = s.taboption(this_tab, form.Value, 'resolution', _('Resolution'));
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

		var fps = s.taboption(this_tab, form.Value, 'fps', _('Frames per second'));
		fps.datatype = 'and(uinteger, min(1))';
		fps.placeholder = '5';
		fps.optional = true;

		var yuv = s.taboption(this_tab, form.Flag, 'yuv', _('Enable YUYV format'), _('Automatic disabling of MJPEG mode'));

		var quality = s.taboption(
			this_tab,
			form.Value,
			'quality',
			_('JPEG compression quality'),
			_('Set the quality in percent. This setting activates YUYV format, disables MJPEG'),
		);
		quality.datatype = 'range(0, 100)';

		var minimum_size = s.taboption(
			this_tab,
			form.Value,
			'minimum_size',
			_('Drop frames smaller than this limit'),
			_('Set the minimum size if the webcam produces small-sized garbage frames. May happen under low light conditions'),
		);
		minimum_size.datatype = 'uinteger';

		var no_dynctrl = s.taboption(this_tab, form.Flag, 'no_dynctrl', _("Don't initialize dynctrls"), _('Do not initialize dynctrls of Linux-UVC driver'));

		var led = s.taboption(this_tab, form.ListValue, 'led', _('Led control'));
		led.value('on', _('On'));
		led.value('off', _('Off'));
		led.value('blink', _('Blink'));
		led.value('auto', _('Auto'));
		led.optional = true;

		// Output HTTP settings

		this_tab = 'output_http';

		var port = s.taboption(this_tab, form.Value, 'port', _('Port'), _('TCP port for this HTTP server'));
		port.datatype = 'port';
		port.placeholder = '8080';

		var enable_auth = s.taboption(this_tab, form.Flag, 'enable_auth', _('Authentication required'), _('Ask for username and password on connect'));
		enable_auth.default = false;

		var username = s.taboption(this_tab, form.Value, 'username', _('Username'));
		username.depends('enable_auth', '1');
		username.optional = false;

		var password = s.taboption(this_tab, form.Value, 'password', _('Password'));
		password.depends('enable_auth', '1');
		password.password = true;
		password.optional = false;
		password.default = false;

		var www = s.taboption(this_tab, form.Value, 'www', _('WWW folder'), _('Folder that contains webpages'));
		www.datatype = 'directory';
		www.default = '/www/webcam/';
		www.optional = false;


		function init_stream() {
			console.log('init_stream');
			start_stream();
		}

		function _start_stream() {
			console.log('_start_stream');

			var port = uci.get('mjpg-streamer', 'core', 'port');

			if (uci.get('mjpg-streamer', 'core', 'enable_auth') == '1') {
				var user = uci.get('mjpg-streamer', 'core', 'username');
				var pass = uci.get('mjpg-streamer', 'core', 'password');
				var login = user + ':' + pass + '@';
			} else {
				var login = '';
			}

			var img = document.getElementById('video_preview') || video_preview;
			img.src = 'http://' + login + location.hostname + ':' + port + '/?action=snapshot' + '&t=' + new Date().getTime();
		}

		function start_stream() {
			console.log('start_stream');

			setTimeout(function () {
				_start_stream();
			}, 500);
		}

		function on_error() {
			console.log('on_error');

			var img = video_preview;
			img.style.display = 'none';

			var stream_stat = document.getElementById('stream_status') || stream_status;
			stream_stat.style.display = 'block';

			start_stream();
		}

		function on_load() {
			console.log('on_load');

			var img = video_preview;
			img.style.display = 'block';

			var stream_stat = stream_status;
			stream_stat.style.display = 'none';
		}

		//HTTP preview
		var video_preview = E('img', {
			'id': 'video_preview',
			'class': 'img-preview',
			'error': on_error,
			'load': on_load,
		});

		var stream_status = E(
			'p',
			{
				'id': 'stream_status',
				'style': 'text-align: center; color: orange; font-weight: bold;',
			},
			_('Stream unavailable'),
		);


		init_stream();

		var preview = s.taboption(this_tab, form.DummyValue, '_dummy');
		preview.render = L.bind(function (view, section_id) {
			return E([], [
				video_preview,
				stream_status
			]);
		}, preview, this);
		preview.depends('output', 'http');

		//Output file settings

		this_tab = 'output_file';

		var folder = s.taboption(this_tab, form.Value, 'folder', _('Folder'), _('Set folder to save pictures'));
		folder.placeholder = '/tmp/images';
		folder.datatype = 'directory';

		//mjpeg=s.taboption(this_tab, Value, "mjpeg", _("Mjpeg output"), _("Check to save the stream to an mjpeg file"))

		var delay = s.taboption(this_tab, form.Value, 'delay', _('Interval between saving pictures'), _('Set the interval in millisecond'));
		delay.placeholder = '5000';
		delay.datatype = 'uinteger';

		var ringbuffer = s.taboption(this_tab, form.Value, 'ringbuffer', _('Ring buffer size'), _('Max. number of pictures to hold'));
		ringbuffer.placeholder = '10';
		ringbuffer.datatype = 'uinteger';

		var exceed = s.taboption(this_tab, form.Value, 'exceed', _('Exceed'), _('Allow ringbuffer to exceed limit by this amount'));
		exceed.datatype = 'uinteger';

		var command = s.taboption(
			this_tab,
			form.Value,
			'command',
			_('Command to run'),
			_('Execute command after saving picture. Mjpg-streamer parses the filename as first parameter to your script.'),
		);

		var link = s.taboption(this_tab, form.Value, 'link', _('Link newest picture to fixed file name'), _('Link the last picture in ringbuffer to fixed named file provided.'));

		return m.render();
	},
});
