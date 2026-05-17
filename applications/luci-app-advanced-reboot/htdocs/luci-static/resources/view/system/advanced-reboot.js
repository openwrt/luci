"use strict";
"require view";
"require rpc";
"require ui";
"require uci";
"require fs";

var pkg = {
	get Name() {
		return "luci-app-advanced-reboot";
	},
	get URL() {
		return "https://docs.openwrt.melmac.ca/" + pkg.Name + "/";
	},
};

return view.extend({
	translateTable: {
		NO_BOARD_NAME: function (args) {
			return _("Unable to find Device Board Name.");
		},
		NO_DUAL_FLAG: function (args) {
			return _("Unable to find Dual Boot Flag Partition.");
		},
		NO_DUAL_FLAG_BLOCK: function (args) {
			return _(
				"The Dual Boot Flag Partition: %s is not a block device."
			).format(args[0]);
		},
		ERR_SET_DUAL_FLAG: function (args) {
			return _(
				"Unable to set Dual Boot Flag Partition entry for partition: %s."
			).format(args[0]);
		},
		NO_FIRM_ENV: function (args) {
			return _("Unable to obtain firmware environment variable: %s.").format(
				args[0]
			);
		},
		ERR_SET_ENV: function (args) {
			return _("Unable to set firmware environment variable: %s to %s.").format(
				args[0],
				args[1]
			);
		},
		BOARD_NAME_MATCH_FILE_READ: function (args) {
			var b = args && args[0] ? args[0] : "";
			return _("Error accessing the device definition for board: %s").format(b);
		},
		NO_BOARD_NAME_MATCH: function (args) {
			var b = args && args[0] ? args[0] : "";
			/* This entry is unused in generic error banner; we render a dedicated warning below. */
			return _("Unknown or unsupported dual-partition device: %s").format(b);
		},
		INVALID_ARG: function (args) {
			var d = args && args[0] ? args[0] : _("invalid argument");
			return _("Invalid request: %s.").format(d);
		},
		PARTITION_NOT_FOUND: function (args) {
			var n = args && args[0] ? args[0] : "?";
			return _("Partition %s was not found in the device definition.").format(
				n
			);
		},
		ERR_SAVE_ENV: function (args) {
			return _("Unable to save environment changes.");
		},
		NO_TARGET_FLAG: function (args) {
			return _("Target partition flag is not defined for this device.");
		},
	},

	callReboot: rpc.declare({
		object: "system",
		method: "reboot",
		expect: { result: 0 },
	}),

	callObtainDeviceInfo: rpc.declare({
		object: "luci.advanced-reboot",
		method: "obtain_device_info",
		expect: {},
	}),

	callBootPartition: rpc.declare({
		object: "luci.advanced-reboot",
		method: "boot_partition",
		params: ["number"],
		expect: {},
	}),

	callPowerOff: function () {
		return fs.exec("/sbin/poweroff").then(function () {
			ui.showModal(_("Shutting down..."), [
				E(
					"p",
					{ class: "spinning" },
					_(
						"The system is shutting down now.<br /> DO NOT POWER OFF THE DEVICE!<br /> It might be necessary to renew the address of your computer to reach the device again, depending on your settings."
					)
				),
			]);
		});
	},

	handlePowerOff: function () {
		ui.showModal(_("Power Off Device"), [
			E(
				"p",
				_(
					"WARNING: Power off might result in a reboot on a device which doesn't support power off.<br /><br />" +
					"Click \"Proceed\" below to power off your device."
				)
			),
			E("div", { class: "right" }, [
				E(
					"button",
					{
						class: "btn",
						click: ui.hideModal,
					},
					_("Cancel")
				),
				" ",
				E(
					"button",
					{
						class: "btn cbi-button cbi-button-positive important",
						click: L.bind(this.callPowerOff, this),
					},
					_("Proceed")
				),
			]),
		]);
	},

	handleReboot: function (ev) {
		return this.callReboot()
			.then(function (res) {
				if (res != 0) {
					ui.addNotification(
						null,
						E("p", _("The reboot command failed with code %d").format(res))
					);
					L.raise("Error", "Reboot failed");
				}

				ui.showModal(_("Rebooting…"), [
					E("p", { class: "spinning" }, _("Waiting for device...")),
				]);

				window.setTimeout(function () {
					ui.showModal(_("Rebooting…"), [
						E(
							"p",
							{ class: "spinning alert-message warning" },
							_("Device unreachable! Still waiting for device...")
						),
					]);
				}, 150000);

				ui.awaitReconnect();
			})
			.catch(function (e) {
				ui.addNotification(null, E("p", e.message));
			});
	},

	handleTogglePartition: function (ev) {
		return this.callTogglePartition().then(
			L.bind(function (res) {
				if (res.error) {
					ui.hideModal();
					return ui.addNotification(
						null,
						E("p", this.translateTable[res.error](res.args))
					);
				}

				return this.callReboot()
					.then(function (res) {
						if (res != 0) {
							ui.addNotification(
								null,
								E("p", _("The reboot command failed with code %d").format(res))
							);
							L.raise("Error", "Reboot failed");
						}

						ui.showModal(_("Rebooting…"), [
							E(
								"p",
								{ class: "spinning" },
								_(
									"The system is rebooting to an alternative partition now.<br /> DO NOT POWER OFF THE DEVICE!<br /> " +
									"Wait a few minutes before you try to reconnect." +
									" It might be necessary to renew the address of your computer to reach the device again, depending on your settings."
								)
							),
						]);

						window.setTimeout(function () {
							ui.showModal(_("Rebooting…"), [
								E(
									"p",
									{ class: "spinning alert-message warning" },
									_("Device unreachable! Still waiting for device...")
								),
							]);
						}, 150000);

						ui.awaitReconnect();
					})
					.catch(function (e) {
						ui.addNotification(null, E("p", e.message));
					});
			}, this)
		);
	},

	handleAlternativeReboot: function (number, ev) {
		var pn = Number(number);

		if (Number.isNaN(pn)) {
			// fall back / safety
			ui.addNotification(null, E("p", _("Missing partition number")));
			return Promise.resolve();
		}
		return Promise.all([]).then(
			L.bind(function (data) {
				ui.showModal(
					_("Reboot Device to Partition: %s").format(
						String(pn).padStart(2, "0")
					),
					[
						E(
							"p",
							_(
								"WARNING: An alternative partition might have its own settings and completely different firmware.<br /><br />" +
								"As your network configuration and WiFi SSID/password on alternative partition might be different," +
								" you might have to adjust your computer settings to be able to access your device once it reboots.<br /><br />" +
								"Please also be aware that alternative partition firmware might not provide an easy way to switch active partition" +
								" and boot back to the currently active partition.<br /><br />" +
								"Click \"Proceed\" below to reboot device to the selected partition."
							)
						),
						E("div", { class: "right" }, [
							E(
								"button",
								{
									class: "btn",
									click: ui.hideModal,
								},
								_("Cancel")
							),
							" ",
							E(
								"button",
								{
									class: "btn cbi-button cbi-button-positive important",
									click: L.bind(function () {
										this.callBootPartition(String(pn))
											.then(
												L.bind(function (res) {
													ui.hideModal();
													if (res && res.error) {
														var fn = this.translateTable[res.error];
														var a = Array.isArray(res.args) ? res.args : [];
														if (res.detail) a = [res.detail].concat(a);

														var msg =
															typeof fn === "function"
																? fn(a)
																: _("Unexpected error: %s").format(
																	String(res.error)
																);

														return ui.addNotification(null, E("p", msg));
													}
													return this.handleReboot();
												}, this)
											)
											.catch(function (e) {
												ui.addNotification(null, E("p", e.message));
											});
									}, this),
								},
								_("Proceed")
							),
						]),
					]
				);
			}, this)
		);
	},

	parsePartitions: function (partitions, activeNumber) {
		var res = [];
		var active = activeNumber != null ? String(Number(activeNumber)) : null;

		(partitions || []).forEach(
			L.bind(function (partition) {
				var isActive =
					active != null && String(Number(partition.number)) === active;
				var func = isActive ? "handleReboot" : "handleAlternativeReboot";
				var status = isActive ? _("Current") : _("Alternative");
				var text = isActive
					? _("Reboot to current partition")
					: _("Reboot to this partition...");

				var fwLabel = partition.label || _("Unknown");
				fwLabel +=
					partition.os && partition.os != ""
						? " (Linux " + partition.os + ")"
						: "";

				res.push([
					String(Number(partition.number || 0)).padStart(2, "0"),
					status,
					fwLabel,
					E(
						"button",
						{
							class: "btn cbi-button cbi-button-apply important",
							click: ui.createHandlerFn(
								this,
								func,
								String(Number(partition.number))
							),
						},
						text
					),
				]);
			}, this)
		);

		return res;
	},

	load: function () {
		return Promise.all([
			uci.changes(),
			L.resolveDefault(fs.stat("/sbin/poweroff"), null),
			this.callObtainDeviceInfo(),
		]);
	},

	render: function (data) {
		var changes = data[0],
			poweroff_supported = data[1] != null ? true : false,
			device_info = data[2];

		var body = E([E("h2", _("Advanced Reboot"))]);

		var device_name = "";
		var active_num = null;
		var partitions = [];
		if (device_info && device_info.device && device_info.partitions) {
			var d = device_info.device;
			device_name = [d.vendor || "", d.model || ""].filter(Boolean).join(" ");
			active_num =
				d.partition_active != null ? String(d.partition_active) : null;
			partitions = device_info.partitions || [];
		}

		for (var config in changes || {}) {
			body.appendChild(
				E(
					"p",
					{ class: "alert-message warning" },
					_("Warning: There are unsaved changes that will get lost on reboot!")
				)
			);
			break;
		}

		/* Error handling */
		if (device_info && device_info.error) {
			if (device_info.error === "NO_BOARD_NAME_MATCH") {
				var warnBoard = device_info.rom_board_name || "";
				body.appendChild(
					E(
						"p",
						{ class: "alert-message warning" },
						_(
							"Warning: Device (%s) is unknown or isn't a dual-firmware device!" +
							"%s" +
							"If you are seeing this on an OpenWrt dual-firmware supported device," +
							"%s" +
							"please refer to " +
							"%sHow to add a new device section of the README%s."
						).format(
							warnBoard,
							"<br /><br />",
							"<br />",
							'<a href="' +
							pkg.URL +
							'#how-to-add-a-new-device" target="_blank">',
							"</a>"
						)
					)
				);
			} else {
				var err = device_info.error;
				var fn = this.translateTable[err];
				var args = [];
				if (device_info.detail) args = [device_info.detail];
				else if (device_info.rom_board_name)
					args = [device_info.rom_board_name];

				if (typeof fn === "function") {
					body.appendChild(
						E("p", { class: "alert-message warning" }, _("ERROR: ") + fn(args))
					);
				} else {
					body.appendChild(
						E(
							"p",
							{ class: "alert-message warning" },
							_("ERROR: %s").format(err)
						)
					);
				}
			}
		}

		body.appendChild(E("h3", (device_name || "") + _(" Partitions")));

		if (
			device_info &&
			device_info.device &&
			Array.isArray(partitions) &&
			partitions.length
		) {
			/* render table as before */
			var partitions_table = E("table", { class: "table" }, [
				E("tr", { class: "tr table-titles" }, [
					E("th", { class: "th" }, [_("Partition")]),
					E("th", { class: "th" }, [_("Status")]),
					E("th", { class: "th" }, [_("Firmware")]),
					E("th", { class: "th" }, [_("Reboot")]),
				]),
			]);

			cbi_update_table(
				partitions_table,
				this.parsePartitions(partitions, active_num)
			);

			body.appendChild(partitions_table);
		} else if (!device_info || !device_info.error) {
			/* no partitions and no explicit error */
			body.appendChild(
				E(
					"p",
					{ class: "alert-message warning" },
					_("Warning: Unable to obtain device information!")
				)
			);
		}

		body.appendChild(E("hr"));
		body.appendChild(
			poweroff_supported
				? E(
					"button",
					{
						class: "btn cbi-button cbi-button-apply important",
						click: ui.createHandlerFn(this, "handlePowerOff"),
					},
					_("Perform power off...")
				)
				: E(
					"p",
					{ class: "alert-message warning" },
					_("Warning: This system does not support powering off!")
				)
		);

		return body;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});
