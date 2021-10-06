'use strict';
'require view';
'require rpc';
'require ui';
'require uci';
'require fs';

return view.extend({
	translateTable: {
		NO_BOARD_NAME : function(args) { return _('Unable to find Device Board Name.')},
		NO_DUAL_FLAG: function (args) { return _('Unable to find Dual Boot Flag Partition.') },
		NO_DUAL_FLAG_BLOCK: function (args) { return _('The Dual Boot Flag Partition: %s is not a block device.').format(args[0])},
		ERR_SET_DUAL_FLAG : function(args) { return _('Unable to set Dual Boot Flag Partition entry for partition: %s.').format(args[0])},
		NO_FIRM_ENV : function(args) { return _('Unable to obtain firmware environment variable: %s.').format(args[0])},
		ERR_SET_ENV : function(args) { return _('Unable to set firmware environment variable: %s to %s.').format(args[0],args[1])}
	},

	callReboot: rpc.declare({
		object: 'system',
		method: 'reboot',
		expect: { result: 0 }
	}),

	callObtainDeviceInfo: rpc.declare({
		object: 'luci.advanced_reboot',
		method: 'obtain_device_info',
		expect: {  }
	}),

	callTogglePartition: rpc.declare({
		object: 'luci.advanced_reboot',
		method: 'toggle_boot_partition',
		expect: {  }
	}),

	callPowerOff: function() {
		return fs.exec('/sbin/poweroff').then(function() {
			ui.showModal(_('Shutting down...'), [
				E('p', { 'class': 'spinning' }, _('The system is shutting down now.<br /> DO NOT POWER OFF THE DEVICE!<br /> It might be necessary to renew the address of your computer to reach the device again, depending on your settings.'))
			]);
		})
	},

	handlePowerOff: function() {

		ui.showModal(_('Power Off Device'), [
			E('p', _("WARNING: Power off might result in a reboot on a device which doesn't support power off.<br /><br />\
			Click \"Proceed\" below to power off your device.")),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, _('Cancel')), ' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'click': L.bind(this.callPowerOff, this)
				}, _('Proceed'))
			])
		]);

	},

	handleReboot: function(ev) {
		return this.callReboot().then(function(res) {
			if (res != 0) {
				ui.addNotification(null, E('p', _('The reboot command failed with code %d').format(res)));
				L.raise('Error', 'Reboot failed');
			}

			ui.showModal(_('Rebooting…'), [
				E('p', { 'class': 'spinning' }, _('Waiting for device...'))
			]);

			window.setTimeout(function() {
				ui.showModal(_('Rebooting…'), [
					E('p', { 'class': 'spinning alert-message warning' },
						_('Device unreachable! Still waiting for device...'))
				]);
			}, 150000);

			ui.awaitReconnect();
		})
		.catch(function(e) { ui.addNotification(null, E('p', e.message)) });
	},

	handleTogglePartition: function(ev) {
		return this.callTogglePartition().then(L.bind(function(res) {
			if (res.error) {
				ui.hideModal()
				return ui.addNotification(null, E('p', this.translateTable[res.error](res.args)));
			}

			return this.callReboot().then(function(res) {
				if (res != 0) {
					ui.addNotification(null, E('p', _('The reboot command failed with code %d').format(res)));
					L.raise('Error', 'Reboot failed');
				}

				ui.showModal(_('Rebooting…'), [
					E('p', { 'class': 'spinning' }, _('The system is rebooting to an alternative partition now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings.'))
				]);

				window.setTimeout(function() {
					ui.showModal(_('Rebooting…'), [
						E('p', { 'class': 'spinning alert-message warning' },
							_('Device unreachable! Still waiting for device...'))
					]);
				}, 150000);

				ui.awaitReconnect();
			})
			.catch(function(e) { ui.addNotification(null, E('p', e.message)) });
		}, this));
	},

	handleAlternativeReboot: function(ev) {
		return Promise.all([
			L.resolveDefault(fs.stat('/usr/sbin/fw_printenv'), null),
			L.resolveDefault(fs.stat('/usr/sbin/fw_setenv'), null),
		]).then(L.bind(function (data) {
			if (!data[0] || !data[1]) {
				return ui.addNotification(null, E('p', _('No access to fw_printenv or fw_printenv!')));
			}

			ui.showModal(_('Reboot Device to an Alternative Partition') + " - " + _("Confirm"), [
				E('p', _("WARNING: An alternative partition might have its own settings and completely different firmware.<br /><br />\
				As your network configuration and WiFi SSID/password on alternative partition might be different,\
					you might have to adjust your computer settings to be able to access your device once it reboots.<br /><br />\
				Please also be aware that alternative partition firmware might not provide an easy way to switch active partition\
					and boot back to the currently active partition.<br /><br />\
				Click \"Proceed\" below to reboot device to an alternative partition.")),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.hideModal
					}, _('Cancel')), ' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive important',
						'click': L.bind(this.handleTogglePartition, this)
					}, _('Proceed'))
				])
			]);
		}, this))
	},

	parsePartitions: function(partitions) {
		var res = [];

		partitions.forEach(L.bind(function(partition) {
			var func, text;

			if (partition.state == 'Current') {
				func = 'handleReboot';
				text = _('Reboot to current partition');
			} else {
				func = 'handleAlternativeReboot';
				text = _('Reboot to alternative partition...');
			}

			res.push([
				(partition.number+0x100).toString(16).substr(-2).toUpperCase(),
				_(partition.state),
				partition.os.replace("Unknown", _("Unknown")).replace("Compressed", _("Compressed")),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply important',
					'click': ui.createHandlerFn(this, func)
				}, text)
			])
		}, this));

		return res;
	},

	load: function() {
		return Promise.all([
			uci.changes(),
			L.resolveDefault(fs.stat('/sbin/poweroff'), null),
			this.callObtainDeviceInfo()
		]);
	},

	render: function(data) {
		var changes = data[0],
			poweroff_supported = data[1] != null ? true : false,
			device_info = data[2];

		var body = E([
			E('h2', _('Advanced Reboot'))
		]);

		for (var config in (changes || {})) {
			body.appendChild(E('p', { 'class': 'alert-message warning' },
				_('Warning: There are unsaved changes that will get lost on reboot!')));
			break;
		}

		if (device_info.error)
			body.appendChild(E('p', { 'class' : 'alert-message warning'}, _("ERROR: ") + this.translateTable[device_info.error]()));

		body.appendChild(E('h3', (device_info.device_name || '') + _(' Partitions')));
		if (device_info.device_name) {
			var partitions_table = E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, [ _('Partition') ]),
					E('th', { 'class': 'th' }, [ _('Status') ]),
					E('th', { 'class': 'th' }, [ _('Firmware') ]),
					E('th', { 'class': 'th' }, [ _('Reboot') ])
				])
			]);

			cbi_update_table(partitions_table, this.parsePartitions(device_info.partitions));

			body.appendChild(partitions_table);
		} else {
			body.appendChild(E('p', { 'class' : 'alert-message warning'},
			device_info.rom_board_name ? _("Warning: Device (%s) is unknown or isn't a dual-partition device!").format(device_info.rom_board_name)
				: _('Warning: Unable to obtain device information!')
			));
		}

		body.appendChild(E('hr'));
		body.appendChild(
			poweroff_supported ? E('button', {
				'class': 'btn cbi-button cbi-button-apply important',
				'click': ui.createHandlerFn(this, 'handlePowerOff')
			}, _('Perform power off...'))

			: E('p', { 'class' : 'alert-message warning'},
			_('Warning: This system does not support powering off!'))
		);

		return body;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
