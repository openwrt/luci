'use strict';
'require view';
'require dom';
'require form';
'require rpc';
'require fs';
'require ui';
'require tools.ucentral as uctool';

var callSystemValidateFirmwareImage = rpc.declare({
	object: 'system',
	method: 'validate_firmware_image',
	params: [ 'path' ],
	expect: { '': { valid: false, forcable: true } }
});

var callReboot = rpc.declare({
	object: 'system',
	method: 'reboot',
	expect: { result: 0 }
});


var mapdata = { actions: {}, config: {} };

return view.extend({
	load: function() {
		var tasks = [
			fs.trimmed('/proc/mtd'),
			fs.trimmed('/proc/mounts')
		];

		return Promise.all(tasks);
	},

	handleFirstboot: function(ev) {
		if (!confirm(_('Do you really want to erase all settings?')))
			return;

		uctool.showProgress(_('The system is erasing the configuration partition now and will reboot itself when finished.'));

		/* Currently the sysupgrade rpc call will not return, hence no promise handling */
		fs.exec('/sbin/firstboot', [ '-r', '-y' ]);

		ui.awaitReconnect('192.168.1.1', 'openwrt.lan');
	},

	handleSysupgrade: function(ev) {
		return ui.uploadFile('/tmp/firmware.bin', ev.target.firstChild)
			.then(L.bind(function(btn, reply) {
				btn.firstChild.data = _('Checking image…');
				uctool.showProgress(_('Verifying the uploaded image file.'));

				return callSystemValidateFirmwareImage('/tmp/firmware.bin')
					.then(function(res) { return [ reply, res ]; });
			}, this, ev.target))
			.then(L.bind(function(btn, reply) {
				return fs.exec('/sbin/sysupgrade', [ '--test', '/tmp/firmware.bin' ])
					.then(function(res) { reply.push(res); return reply; });
			}, this, ev.target))
			.then(L.bind(function(btn, res) {
				var is_valid = res[1].valid,
				    body = [];

				if (is_valid) {
					body.push(E('p', _("The firmware image was uploaded. Compare the checksum and file size listed below with the original file to ensure data integrity. <br /> Click 'Continue' below to start the flash procedure.")));
					body.push(E('ul', {}, [
						res[0].size ? E('li', {}, '%s: %1024.2mB'.format(_('Size'), res[0].size)) : '',
						res[0].checksum ? E('li', {}, '%s: %s'.format(_('MD5'), res[0].checksum)) : '',
						res[0].sha256sum ? E('li', {}, '%s: %s'.format(_('SHA256'), res[0].sha256sum)) : ''
					]));
				}
				else {
					body.push(E('p', _("The firmware image is invalid and cannot be flashed. Check the diagnostics below for further details.")));

					if (res[2].stderr)
						body.push(E('pre', { 'class': 'alert-message' }, [ res[2].stderr ]));
				}

				var cntbtn = E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleSysupgradeConfirm', btn),
					'disabled': !is_valid
				}, [ _('Continue') ]);

				body.push(E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.createHandlerFn(this, function(ev) {
							return fs.remove('/tmp/firmware.bin').finally(ui.hideModal);
						})
					}, [ _('Cancel') ]), ' ', cntbtn
				]));

				ui.showModal(is_valid ? _('Flash image?') : _('Invalid image'), body);
			}, this, ev.target))
			.catch(function(e) { uctool.showError(e.message) })
			.finally(L.bind(function(btn) {
				btn.firstChild.data = _('Flash image…');
			}, this, ev.target));
	},

	handleSysupgradeConfirm: function(btn, ev) {
		btn.firstChild.data = _('Flashing…');

		uctool.showProgress(_('The system is flashing now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings.'));

		/* Currently the sysupgrade rpc call will not return, hence no promise handling */
		fs.exec('/sbin/sysupgrade', [ '-n', '/tmp/firmware.bin' ]);

		ui.awaitReconnect('192.168.1.1', 'openwrt.lan');
	},

	handleReboot: function(ev) {
		return callReboot().then(function(res) {
			if (res != 0) {
				uctool.showError(_('The reboot command failed with code %d').format(res));
				L.raise('Error', 'Reboot failed');
			}

			uctool.showProgress(_('The device is rebooting now. This page will try to reconnect automatically once the device is fully booted.'));

			ui.awaitReconnect();
		})
		.catch(function(e) { uctool.showError(e.message) });
	},

	render: function(rpc_replies) {
		var procmtd = rpc_replies[0],
		    procmounts = rpc_replies[1],
		    has_rootfs_data = (procmtd.match(/"rootfs_data"/) != null) || (procmounts.match("overlayfs:\/overlay \/ ") != null),
		    m, s, o, ss;

		m = new form.JSONMap(mapdata);
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'actions');


		o = s.option(form.SectionValue, 'actions', form.NamedSection, 'actions', 'actions', _('Reboot device'),
			_('Issue a reboot and restart the operating system on this device.'));

		ss = o.subsection;

		o = ss.option(form.Button, 'reboot');
		o.inputstyle = 'action important';
		o.inputtitle = _('Reboot');
		o.onclick = L.bind(this.handleReboot, this);


		o = s.option(form.SectionValue, 'actions', form.NamedSection, 'actions', 'actions', _('Reset to defaults'),
			_('Reset the system to its initial state and discard any configuration changes.'));
		ss = o.subsection;

		if (has_rootfs_data) {
			o = ss.option(form.Button, 'reset');
			o.inputstyle = 'negative important';
			o.inputtitle = _('Perform reset');
			o.onclick = this.handleFirstboot;
		}


		o = s.option(form.SectionValue, 'actions', form.NamedSection, 'actions', 'actions', _('Firmware upgrade'),
			_('Upload a compatible firmware image here to upgrade the running system.'));

		ss = o.subsection;

		o = ss.option(form.Button, 'sysupgrade');
		o.inputstyle = 'action important';
		o.inputtitle = _('Flash image…');
		o.onclick = L.bind(this.handleSysupgrade, this);


		return m.render();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
