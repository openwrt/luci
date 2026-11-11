'use strict';
'require view';
'require form';
'require ui';
'require nes-emulator as nesEmulator';

const callRotateToken = nesEmulator.declareLongRunningRpc({
	object: 'nes-emulator',
	method: 'rotate_token',
	expect: { '': {} }
});

function validateDataDir(sectionId, value) {
	if (!value || value[0] !== '/')
		return _('An absolute directory path is required');
	if (value.includes('\0') || value.includes('\n') ||
	    value.includes(':') || value.includes(';') ||
	    value.includes(',') || value.includes('//'))
		return _('The directory contains unsupported characters');

	const parts = value.split('/');
	if (parts.includes('.') || parts.includes('..'))
		return _('Relative path components are not allowed');

	const forbidden = [
		'/', '/bin', '/boot', '/dev', '/etc', '/home', '/lib',
		'/lib64', '/mnt', '/opt', '/overlay', '/proc', '/root',
		'/run', '/sbin', '/sys', '/tmp', '/usr', '/var'
	];
	if (forbidden.includes(value.replace(/\/+$/, '') || '/'))
		return _('Choose a dedicated subdirectory, not a system root');
	return true;
}

function validateOptionalDataDir(sectionId, value) {
	if (!value)
		return true;
	return validateDataDir(sectionId, value);
}

function validateOrigin(sectionId, value) {
	if (!value)
		return true;
	try {
		const parsed = new URL(value);
		if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
		    parsed.username || parsed.password || parsed.search ||
		    parsed.hash || parsed.pathname !== '/' ||
		    value !== parsed.origin)
			throw new Error();
		return true;
	}
	catch (error) {
		return _('Enter an exact Origin such as https://192.168.1.1');
	}
}

function validateRom(sectionId, value) {
	if (!value)
		return true;
	const dirResult = validateDataDir(sectionId, value);
	if (dirResult !== true)
		return dirResult;
	if (!/\.(nes|fds|unf|unif)$/i.test(value))
		return _('Expected a .nes, .fds, .unf or .unif file');
	return true;
}

return view.extend({
	render() {
		const map = new form.Map(
			'nes-emulator',
			_('NES Emulator settings'),
			_('nesd contains a statically linked FCEUmm core. Emulation, PPU rendering and JPEG encoding stay on the router CPU.')
		);

		const section = map.section(
			form.TypedSection,
			'nes-emulator',
			_('Service')
		);
		section.anonymous = true;
		section.addremove = false;

		let option;

		option = section.option(
			form.Flag,
			'enabled',
			_('Start at boot'),
			_('Keep disabled unless the emulator should start on every boot. Loading a ROM starts it on demand for the current uptime.')
		);
		option.default = option.disabled;
		option.rmempty = false;

		option = section.option(
			form.DummyValue,
			'_core',
			_('Emulator core')
		);
		option.cfgvalue = () => _('FCEUmm (statically linked into nesd)');

		option = section.option(
			form.Value,
			'rom_dir',
			_('Primary ROM directory'),
			_('Validated LuCI uploads are stored here')
		);
		option.default = '/etc/nes-emulator/roms';
		option.rmempty = false;
		option.validate = validateDataDir;

		option = section.option(
			form.Flag,
			'extra_rom_dirs_enabled',
			_('Enable extra ROM directories'),
			_('Hard-disable scanning and daemon access to every extra directory while keeping the saved paths ready for re-enabling.')
		);
		option.default = option.disabled;
		option.rmempty = false;

		option = section.option(
			form.DynamicList,
			'extra_rom_dir',
			_('Extra ROM directories'),
			_('Read-only USB or SD paths to scan, for example /mnt/sda1/roms')
		);
		option.placeholder = '/mnt/sda1/roms';
		option.validate = validateOptionalDataDir;
		option.retain = true;
		option.depends('extra_rom_dirs_enabled', '1');

		option = section.option(
			form.Value,
			'system_dir',
			_('System directory')
		);
		option.default = '/etc/nes-emulator/system';
		option.rmempty = false;
		option.validate = validateDataDir;

		option = section.option(
			form.Value,
			'save_dir',
			_('Save directory'),
			_('Battery-backed SRAM and full save states are written here using atomic replacement')
		);
		option.default = '/etc/nes-emulator/saves';
		option.rmempty = false;
		option.validate = validateDataDir;

		option = section.option(
			form.Value,
			'bind',
			_('Bind address'),
			_('Use 0.0.0.0 for LAN access. Requests still require the generated token.')
		);
		option.datatype = 'ipaddr';
		option.default = '0.0.0.0';
		option.rmempty = false;

		option = section.option(
			form.Value,
			'port',
			_('HTTP / WebSocket port')
		);
		option.datatype = 'port';
		option.default = '29876';
		option.rmempty = false;

		option = section.option(
			form.Value,
			'allowed_origin',
			_('Restrict browser Origin'),
			_('Optional exact Origin for a cross-origin custom client. The built-in game page is same-origin with nesd, so normally leave this empty.')
		);
		option.placeholder = 'https://client.example';
		option.validate = validateOrigin;

		option = section.option(
			form.Button,
			'_rotate_token',
			_('Access token'),
			_('The token is generated automatically and is required by every API and WebSocket client.')
		);
		option.inputtitle = _('Rotate token');
		option.inputstyle = 'action';
		option.onclick = async () => {
			ui.showModal(
				_('Rotating access token'),
				E('p', {}, _('Restarting nesd…'))
			);
			try {
				const reply = await callRotateToken();
				if (!reply || reply.error || reply.ok === false)
					throw new Error(reply && reply.error || _('Operation failed'));
				ui.hideModal();
				ui.addNotification(
					null,
					E('p', {}, _('Access token rotated; old game windows were disconnected.')),
					'info'
				);
			}
			catch (error) {
				ui.hideModal();
				ui.addNotification(
					null,
					E('p', {}, _('Token rotation failed: %s')
						.format(error.message || error)),
					'error'
				);
			}
		};

		option = section.option(
			form.ListValue,
			'stream_format',
			_('Video stream format'),
			_('Each raw RGB565 frame is 120 KiB: video uses about 2.0 Mbit/s at the default 2 FPS and 59.0 Mbit/s at 60 FPS. PCM 48 kHz stereo int16 adds about 1.54 Mbit/s, for roughly 3.5 or 60.5 Mbit/s total before WebSocket and Wi-Fi overhead. Raw is pixel-perfect but can consume substantial LAN airtime. JPEG reduces video bandwidth but is encoded in software on the router.')
		);
		option.value('raw', _('Raw RGB565 (pixel-perfect)'));
		option.value('jpeg', _('Software JPEG (lower bandwidth)'));
		option.default = 'raw';
		option.rmempty = false;

		option = section.option(
			form.Value,
			'jpeg_quality',
			_('JPEG quality')
		);
		option.datatype = 'range(1,100)';
		option.default = '92';
		option.rmempty = false;
		option.depends('stream_format', 'jpeg');

		option = section.option(
			form.Value,
			'stream_fps',
			_('Maximum streamed FPS'),
			_('Allowed range: 1–60 FPS. This only limits frame delivery; FCEUmm keeps the ROM region’s native 50/60 FPS timing. Raw bandwidth scales directly with this value, so use 1–2 FPS on slow or shared Wi-Fi.')
		);
		option.datatype = 'range(1,60)';
		option.default = '2';
		option.rmempty = false;

		option = section.option(
			form.Flag,
			'show_fps',
			_('Show FPS counter'),
			_('Draw only the browser-painted FPS number as a FCEUX-like pixel OSD directly over the NES canvas in its top-right corner, without a separate browser widget. The number reflects delivery, decode and paint slowdowns rather than the ROM’s native frame rate or the configured stream limit. The setting is applied after Save & Apply and the game window reconnects.')
		);
		option.default = option.enabled;
		option.rmempty = false;

		option = section.option(
			form.Flag,
			'show_touch_controls',
			_('Show on-screen controls'),
			_('Show the clickable and touch-friendly NES buttons in the game window. Disable this on a computer to free screen space; keyboard and gamepad controls remain available. Save & Apply, then reconnect the game window to apply the setting.')
		);
		option.default = option.enabled;
		option.rmempty = false;

		option = section.option(
			form.Value,
			'rom',
			_('Autoload ROM path')
		);
		option.placeholder = '/etc/nes-emulator/roms/game.nes';
		option.validate = validateRom;

		return map.render();
	}
});
