// Copyright 2022 Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from [@vsviridov](https://github.com/vsviridov)

"require ui";
"require rpc";
"require form";
"require baseclass";

var pkg = {
	get Name() {
		return "pbr";
	},
	// Must equal pbr's pkg.compat and rpcdCompat in luci.pbr. Any change to
	// pbr's error/warning catalog bumps all five in lockstep: pbr pkg.uc,
	// pbr files/etc/init.d/pbr, pbr tests/04_policies/01_start_dynamic_routing,
	// this getter, and rpcdCompat. A mismatch trips isVersionMismatch() below
	// and tells the user their WebUI is outdated, so the two packages have to
	// be released together.
	get LuciCompat() {
		return 37;
	},
	get ReadmeCompat() {
		return "1.2.4";
	},
	get URL() {
		return (
			"https://docs.mossdef.org/" +
			pkg.Name +
			"/" +
			(pkg.ReadmeCompat ? pkg.ReadmeCompat + "/" : "")
		);
	},
	get DonateURL() {
		return (
			"https://docs.mossdef.org/" +
			pkg.Name +
			"/" +
			(pkg.ReadmeCompat ? pkg.ReadmeCompat + "/" : "") +
			"#donate"
		);
	},
	isVersionMismatch: function (luci, pkg, rpcd) {
		return luci !== pkg || pkg !== rpcd || luci !== rpcd;
	},
	// HTML-escape an untrusted scalar value with LuCI's %h format specifier so
	// config-derived text reflected into status messages cannot inject markup
	// when appended via innerHTML by E()/dom.create. Trusted array infos built
	// in this file (e.g. anchor tags) are passed through unchanged.
	escapeInfo: function (info) {
		return Array.isArray(info)
			? info
			: info != null && info !== "" ? "%h".format(info) : info;
	},
	formatMessage: function (info, template) {
		if (!template) return _("Unknown message") + "<br />";
		return (
			(Array.isArray(info)
				? template.format(...info)
				: template.format(info || " ")) + "<br />"
		);
	},
	buildGatewayElements: function (gw) {
		const gateways = Array.isArray(gw) ? gw : Object.values(gw);
		const ipv6Enabled = L.uci.get(pkg.Name, "config", "ipv6_enabled") === "1";
		const elements = [];
		gateways.forEach(function (g) {
			const iface = g.name;
			if (!iface) return;
			if (elements.length) elements.push(E("br"));
			// Prefer the labeled form (e.g. "mwan4:wan", "netifd:wan") sent by
			// the principal app; fall back to the canonical iface name for
			// older principal-app versions that don't emit `label`.
			const display = g.label || iface;
			const parts = [display];
			if (g.device_ipv4 && g.device_ipv4 !== iface) parts.push(g.device_ipv4);
			parts.push(g.gateway_ipv4 || "0.0.0.0");
			if (ipv6Enabled) {
				if (g.device_ipv6 && g.device_ipv6 !== iface) parts.push(g.device_ipv6);
				parts.push(g.gateway_ipv6 || "::0");
			}
			var line = parts.join("/");
			if (g.default) {
				elements.push(line + " ");
				elements.push(E("strong", {}, "✓"));
			} else {
				elements.push(line);
			}
		});
		return elements;
	},
};

var getInitStatus = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getInitStatus",
	params: ["name"],
});

var _setInitAction = rpc.declare({
	object: "luci." + pkg.Name,
	method: "setInitAction",
	params: ["name", "action"],
	expect: { result: false },
});

var RPC = {
	listeners: [],
	on: function (event, callback) {
		var pair = { event: event, callback: callback };
		this.listeners.push(pair);
		return function unsubscribe() {
			this.listeners = this.listeners.filter(function (listener) {
				return listener !== pair;
			});
		}.bind(this);
	},
	emit: function (event, data) {
		this.listeners.forEach(function (listener) {
			if (listener.event === event) {
				listener.callback(data);
			}
		});
	},
	setInitAction: function (name, action) {
		_setInitAction(name, action)
			.then(
				function (result) {
					this.emit("setInitAction", { result: result, action: action });
				}.bind(this),
			)
			.catch(
				function (error) {
					// Even if RPC call fails/times out, emit event to start polling
					// This handles cases where the backend task starts but RPC times out
					this.emit("setInitAction", { timeout: true, action: action });
				}.bind(this),
			);
	},
};

// Poll service status until the expected running state is reached.
// expectRunning: true for start/restart/reload, false for stop.
var pollServiceStatus = function (expectRunning, callback) {
	var maxAttempts = 300; // Max 5 minutes of polling
	var attempt = 0;

	var checkStatus = function () {
		attempt++;

		L.resolveDefault(getInitStatus(pkg.Name), {})
			.then(function (statusData) {
				var isRunning =
					statusData && statusData[pkg.Name] && statusData[pkg.Name].running;

				// Check if the expected state has been reached
				if (expectRunning ? isRunning === true : isRunning !== true) {
					callback(true);
				}
				// Check if timed out
				else if (attempt >= maxAttempts) {
					callback(false, "timeout");
				}
				// Continue polling
				else {
					setTimeout(checkStatus, 1000);
				}
			})
			.catch(function (err) {
				// Retry on error unless timed out
				if (attempt < maxAttempts) {
					setTimeout(checkStatus, 1000);
				} else {
					callback(false, "error");
				}
			});
	};

	// Start polling after a delay to give the backend time to start the task
	setTimeout(checkStatus, 3000);
};

var status = baseclass.extend({
	render: function () {
		return L.resolveDefault(getInitStatus(pkg.Name), {}).then(function (initStatus) {
			var reply = initStatus?.[pkg.Name] || {};
			reply = {
				enabled: reply.enabled || false,
				running: reply.running || false,
				running_nft: reply.running_nft || false,
				running_nft_file: reply.running_nft_file || false,
				version: reply.version || null,
				packageCompat: reply.packageCompat || 0,
				rpcdCompat: reply.rpcdCompat || 0,
				gateways: reply.gatewaysList || [],
				errors: (reply.errors || []).map(function (e) {
					return Object.assign({}, e, { info: pkg.escapeInfo(e.info) });
				}),
				warnings: (reply.warnings || []).map(function (e) {
					return Object.assign({}, e, { info: pkg.escapeInfo(e.info) });
				}),
			};

			if (
				pkg.isVersionMismatch(
					pkg.LuciCompat,
					reply.packageCompat,
					reply.rpcdCompat,
				)
			) {
				reply.warnings.push({
					code: "warningInternalVersionMismatch",
					info: [
						reply.packageCompat,
						pkg.LuciCompat,
						reply.rpcdCompat,
						'<a href="' +
							pkg.URL +
							'#Warning:InternalVersionMismatch" target="_blank">',
						"</a>",
					],
				});
			}

			var text;
			var header = E("h2", {}, _("Policy Based Routing - Status"));
			var statusTitle = E(
				"label",
				{ class: "cbi-value-title", for: pkg.Name + "-status" },
				_("Service Status"),
			);
			if (reply.version) {
				text = _("Version %s").format(reply.version) + " - ";
				if (reply.running) {
					text += _("Running");
					if (reply.running_nft_file) {
						text += " (" + _("fw4 nft file mode") + ").";
					} else if (reply.running_nft) {
						text += " (" + _("nft mode") + ").";
					} else {
						text += ".";
					}
				} else {
					if (reply.enabled) {
						text += _("Stopped.");
					} else {
						text += _("Stopped (Disabled).");
					}
				}
			} else {
				text = _("Not installed or not found");
			}
			var statusText = E("output", { id: pkg.Name + "-status" }, text);
			var statusField = E("div", { class: "cbi-value-field" }, statusText);
			var statusDiv = E("div", { class: "cbi-value" }, [
				statusTitle,
				statusField,
			]);

			var gatewaysDiv = [];
			if (reply.gateways) {
				var gatewaysTitle = E(
					"label",
					{ class: "cbi-value-title", for: pkg.Name + "-gateways" },
					_("Service Gateways"),
				);
				var gatewaysDescr = E("div", { class: "cbi-value-description" },
					_(
						"The %s indicates default gateway. See the %sREADME%s for details.",
					).format(
						"<strong>✓</strong>",
						'<a href="' +
							pkg.URL +
							'#AWordAboutDefaultRouting" target="_blank">',
						"</a>",
					) +
					"<br />" +
					"<br />" +
					_(
						"Please %sdonate%s to support development of this project.",
					).format(
						"<a href='" + pkg.DonateURL + "' target='_blank'>",
						"</a>",
					));
				var gatewaysText = E("output", { id: pkg.Name + "-gateways" }, pkg.buildGatewayElements(reply.gateways));
				var gatewaysField = E("div", { class: "cbi-value-field" }, [
					gatewaysText,
					gatewaysDescr,
				]);
				gatewaysDiv = E("div", { class: "cbi-value" }, [
					gatewaysTitle,
					gatewaysField,
				]);
			}

			var warningsDiv = [];
			if (reply.warnings && reply.warnings.length) {
				var warningTable = {
					warningInternalVersionMismatch: _(
						"Internal version mismatch (package: %s, luci app: %s, luci rpcd: %s), you may need to update packages or reboot the device, please check the %sREADME%s.",
					),
					warningResolverNotSupported: _(
						"Resolver set (%s) is not supported on this system.",
					).format(pkg.escapeInfo(L.uci.get(pkg.Name, "config", "resolver_set"))),
					warningAGHVersionTooLow: _(
						"Installed AdGuardHome (%s) doesn't support 'ipset_file' option.",
					),
					warningPolicyProcessCMD: _("%s"),
					warningPolicyProtoNoPort: _(
						"Policy %s: 'proto' is ignored without a port, so every protocol is routed; set the port range to '0-65535' to match all of it",
					),
					warningPolicyProtoPortless: _(
						"Policy %s: this protocol cannot be matched by a policy and is ignored; to route ICMP use the 'Default ICMP Interface' setting instead",
					),
					warningTorUnsetSrcPort: _(
						"Please unset 'src_port' for policy '%s': it produces an invalid rule",
					),
					warningTorUnsetDestPort: _(
						"Please unset 'dest_port' for policy '%s': it is ignored",
					),
					warningTorUnsetProto: _(
						"Please unset 'proto' or set 'proto' to 'all' for policy '%s'",
					),
					warningTorUnsetChainNft: _(
						"Please unset 'chain' or set 'chain' to 'prerouting' for policy '%s'",
					),
					warningInvalidOVPNConfig: _(
						"Invalid OpenVPN config for %s interface",
					),
					warningOutdatedLuciPackage: _(
						"The WebUI application (luci-app-pbr) is outdated, please update it",
					),
					warningOutdatedPrincipalPackage: _(
						"The principal package (pbr) is outdated, please update it",
					),
					warningBadNftCallsInUserFile: _(
						"Incompatible nft calls detected in user include file, disabling fw4 nft file support",
					),
					warningDnsmasqInstanceNoConfdir: _(
						"Dnsmasq instance (%s) targeted in settings, but it doesn't have its own confdir",
					),
					warningDhcpLanForce: _(
						_(
							"Please set 'dhcp.%%s.force=1' to speed up service start-up %s(more info)%s",
						).format(
							"<a href='" +
								pkg.URL +
								"#Warning:Pleasesetdhcp.lan.force1" +
								"' target='_blank'>",
							"</a>",
						),
					),
					warningSummary: _("Warnings encountered, please check %s"),
					warningIncompatibleDHCPOption6: _(
						"Incompatible DHCP Option 6 for interface %s",
					),
					warningNetifdMissingInterfaceLocal: _(
						"Netifd setup: option netifd_interface_local is missing, assuming '%s'",
					),
					warningUplinkDown: _(
						"Uplink/WAN interface is still down, going back to boot mode",
					),
					warningDynamicRoutingMode: _(
						"Running in dynamic routing tables mode. Consider installing netifd extensions or mwan4 for more efficient operation. See %sREADME%s.",
					).format(
						'<a href="' + pkg.URL + '#routing-tables-modes" target="_blank">',
						"</a>",
					),
					warningInterfaceRoutingUnknownGateway4: _(
						"Unknown IPv4 gateway for '%s'",
					),
					warningInterfaceRoutingUnknownGateway6: _(
						"Unknown IPv6 gateway for '%s'",
					),
				};
				var warningsTitle = E(
					"label",
					{ class: "cbi-value-title", for: pkg.Name + "-warnings" },
					_("Service Warnings"),
				);
				text = "";
				reply.warnings.forEach((element) => {
					if (element.code && warningTable[element.code]) {
						text += pkg.formatMessage(element.info, warningTable[element.code]);
					} else {
						text += _("Unknown warning") + "<br />";
					}
				});
				text += _("Warnings encountered, please check the %sREADME%s").format(
					'<a href="' + pkg.URL + '#warning-messages-details" target="_blank">',
					"</a>!<br />",
				);
				var warningsText = E("output", { id: pkg.Name + "-warnings", class: "cbi-value-description" }, text);
				var warningsField = E(
					"div",
					{ class: "cbi-value-field" },
					warningsText,
				);
				warningsDiv = E("div", { class: "cbi-value" }, [
					warningsTitle,
					warningsField,
				]);
			}

			var errorsDiv = [];
			if (reply.errors && reply.errors.length) {
				var errorTable = {
					errorConfigValidation: _("Config (%s) validation failure").format(
						"/etc/config/" + pkg.Name,
					),
					errorNoNft: _(
						"Resolver set support (%s) requires nftables, but nft binary cannot be found",
					).format(pkg.escapeInfo(L.uci.get(pkg.Name, "config", "resolver_set"))),
					errorResolverNotSupported: _(
						"Resolver set (%s) is not supported on this system",
					).format(pkg.escapeInfo(L.uci.get(pkg.Name, "config", "resolver_set"))),
					errorServiceDisabled: _(
						"The %s service is currently disabled",
					).format(pkg.Name),
					errorNoUplinkGateway: _(
						"The %s service failed to discover uplink gateway",
					).format(pkg.Name),
					errorNoUplinkInterface: _(
						"The %s interface not found, you need to set the 'pbr.config.uplink_interface' option",
					),
					errorNoUplinkInterfaceHint: _(
						"Refer to %sREADME%s for details",
					).format(
						'<a href="' + pkg.URL + '#uplink_interface" target="_blank">',
						"</a>!<br />",
					),
					errorNftsetNameTooLong: _(
						"The nft set name '%s' is longer than allowed 255 characters",
					),
					errorUnexpectedExit: _(
						"Unexpected exit or service termination: '%s'",
					),
					errorPolicyNoSrcDest: _(
						"Policy '%s' has no source/destination parameters",
					),
					errorPolicyNoInterface: _("Policy '%s' has no assigned interface"),
					errorPolicyNoDns: _("Policy '%s' has no assigned DNS"),
					errorPolicyProcessNoInterfaceDns: _(
						"Interface '%s' has no assigned DNS",
					),
					errorPolicyUnknownInterface: _(
						"Policy '%s' has an unknown interface",
					),
					errorPolicyProcessCMD: _("%s"),
					errorFailedSetup: _("Failed to set up '%s'"),
					errorFailedReload: _("Failed to reload '%s'"),
					errorUserFileNotFound: _("Custom user file '%s' not found or empty"),
					errorUserFileSyntax: _("Syntax error in custom user file '%s'"),
					errorUserFileRunning: _("Error running custom user file '%s'"),
					errorUserFileNoCurl: _(
						"Use of 'curl' is detected in custom user file '%s', but 'curl' isn't installed",
					),
					errorNoGateways: _("Failed to set up any gateway"),
					errorResolver: _("Resolver '%s'"),
					errorPolicyProcessNoIpv6: _(
						"Skipping IPv6 policy '%s' as IPv6 support is disabled",
					),
					errorPolicyProcessUnknownFwmark: _(
						"Unknown packet mark for interface '%s'",
					),
					errorPolicyProcessMismatchFamily: _(
						"Mismatched IP family between in policy '%s'",
					),
					errorPolicyProtoPortNotSupported: _(
						"Policy %s: this protocol cannot match a port; unset the port, otherwise nft rejects the whole ruleset",
					),
					errorPolicyProcessUnknownProtocol: _(
						"Unknown protocol in policy '%s'",
					),
					errorPolicyProcessInsertionFailed: _(
						"Insertion failed for both IPv4 and IPv6 for policy '%s'",
					),
					errorPolicyProcessInsertionFailedIpv4: _(
						"Insertion failed for IPv4 for policy '%s'",
					),
					errorPolicyProcessUnknownEntry: _("Unknown entry in policy '%s'"),
					errorInterfaceRoutingEmptyValues: _(
						"Received empty tid/mark or interface name when setting up routing",
					),
					errorInterfaceMarkOverflow: _(
						"Interface mark for '%s' exceeds the fwmask value",
					),
					errorInterfacePriorityExhausted: _(
						"No IP rule priority left to allocate for '%s'",
					),
					errorFailedToResolve: _("Failed to resolve '%s'"),
					errorInvalidOVPNConfig: _(
						"Invalid OpenVPN config for '%s' interface",
					),
					errorNftMainFileInstall: _("Failed to install fw4 nft file '%s'"),
					errorNoDownloadWithSecureReload: _(
						"Policy '%s' refers to URL which can't be downloaded in 'secure_reload' mode",
					),
					errorDownloadUrlNoHttps: _(
						"Failed to download '%s', HTTPS is not supported",
					),
					errorDownloadUrl: _("Failed to download '%s'"),
					errorFileSchemaRequiresCurl: _(
						"The '%s' schema requires curl, but it's not detected on this system",
					).format("file://"),
					errorTryFailed: _("Command failed: '%s'"),
					errorIncompatibleUserFile: _(
						"Incompatible custom user file detected '%s'",
					),
					errorUserFileUnsafeNft: _(
						"Unsafe nft command in custom user file '%s'",
					),
					errorDefaultFw4TableMissing: _("Default fw4 table '%s' is missing"),
					errorDefaultFw4ChainMissing: _("Default fw4 chain '%s' is missing"),
					errorRequiredBinaryMissing: _("Required binary '%s' is missing"),
					errorInterfaceRoutingUnknownDevType: _(
						"Unknown IPv6 Link type for device '%s'",
					),
					errorMktempFileCreate: _(
						"Failed to create temporary file with mktemp mask: '%s'",
					),
					errorSummary: _("Errors encountered, please check %s"),
					errorNftNetifdFileInstall: _(
						"Netifd setup: failed to install fw4 netifd nft file '%s'",
					),
					errorNftNetifdFileDelete: _(
						"Netifd setup: failed to delete fw4 netifd nft file '%s'",
					),
					errorNetifdMissingOption: _(
						"Netifd setup: required option '%s' is missing",
					),
					errorNetifdInvalidGateway4: _(
						"Netifd setup: invalid value of netifd_interface_default option '%s'",
					),
					errorNetifdInvalidGateway6: _(
						"Netifd setup: invalid value of netifd_interface_default6 option '%s'",
					),
					errorUplinkDown: _(
						"Uplink/WAN interface is still down, increase value of 'procd_boot_trigger_delay' option",
					),
				};
				var errorsTitle = E(
					"label",
					{ class: "cbi-value-title", for: pkg.Name + "-errors" },
					_("Service Errors"),
				);
				text = "";
				reply.errors.forEach((element) => {
					if (element.code && errorTable[element.code]) {
						text += pkg.formatMessage(element.info, errorTable[element.code]);
					} else {
						text += _("Unknown error") + "<br />";
					}
				});
				text += _("Errors encountered, please check the %sREADME%s").format(
					'<a href="' + pkg.URL + '#error-messages-details" target="_blank">',
					"</a>!<br />",
				);
				var errorsText = E("output", { id: pkg.Name + "-errors", class: "cbi-value-description" }, text);
				var errorsField = E("div", { class: "cbi-value-field" }, errorsText);
				errorsDiv = E("div", { class: "cbi-value" }, [
					errorsTitle,
					errorsField,
				]);
			}

			var btn_gap = E("span", {}, "&#160;&#160;");
			var btn_gap_long = E(
				"span",
				{},
				"&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;",
			);

			var btn_start = E(
				"button",
				{
					class: "btn cbi-button cbi-button-apply",
					disabled: true,
					click: function (ev) {
						ui.showModal(null, [
							E(
								"p",
								{ class: "spinning" },
								_("Starting %s service").format(pkg.Name),
							),
						]);
						return RPC.setInitAction(pkg.Name, "start");
					},
				},
				_("Start"),
			);

			var btn_action = E(
				"button",
				{
					class: "btn cbi-button cbi-button-apply",
					disabled: true,
					click: function (ev) {
						ui.showModal(null, [
							E(
								"p",
								{ class: "spinning" },
								_("Restarting %s service").format(pkg.Name),
							),
						]);
						return RPC.setInitAction(pkg.Name, "restart");
					},
				},
				_("Restart"),
			);

			var btn_stop = E(
				"button",
				{
					class: "btn cbi-button cbi-button-reset",
					disabled: true,
					click: function (ev) {
						ui.showModal(null, [
							E(
								"p",
								{ class: "spinning" },
								_("Stopping %s service").format(pkg.Name),
							),
						]);
						return RPC.setInitAction(pkg.Name, "stop");
					},
				},
				_("Stop"),
			);

			var btn_enable = E(
				"button",
				{
					class: "btn cbi-button cbi-button-apply",
					disabled: true,
					click: function (ev) {
						ui.showModal(null, [
							E(
								"p",
								{ class: "spinning" },
								_("Enabling %s service").format(pkg.Name),
							),
						]);
						return RPC.setInitAction(pkg.Name, "enable");
					},
				},
				_("Enable"),
			);

			var btn_disable = E(
				"button",
				{
					class: "btn cbi-button cbi-button-reset",
					disabled: true,
					click: function (ev) {
						ui.showModal(null, [
							E(
								"p",
								{ class: "spinning" },
								_("Disabling %s service").format(pkg.Name),
							),
						]);
						return RPC.setInitAction(pkg.Name, "disable");
					},
				},
				_("Disable"),
			);

			if (reply.enabled) {
				btn_enable.disabled = true;
				btn_disable.disabled = false;
				if (reply.running) {
					btn_start.disabled = true;
					btn_action.disabled = false;
					btn_stop.disabled = false;
				} else {
					btn_start.disabled = false;
					btn_action.disabled = true;
					btn_stop.disabled = true;
				}
			} else {
				btn_start.disabled = true;
				btn_action.disabled = true;
				btn_stop.disabled = true;
				btn_enable.disabled = false;
				btn_disable.disabled = true;
			}

			var buttonsTitle = E(
				"label",
				{ class: "cbi-value-title", for: pkg.Name + "-buttons" },
				_("Service Control"),
			);
			var buttonsText = E("output", { id: pkg.Name + "-buttons" }, [
				btn_start,
				btn_gap,
				btn_action,
				btn_gap,
				btn_stop,
				btn_gap_long,
				btn_enable,
				btn_gap,
				btn_disable,
			]);
			var buttonsField = E("div", { class: "cbi-value-field" }, buttonsText);
			var buttonsDiv = reply.version
				? E("div", { class: "cbi-value" }, [buttonsTitle, buttonsField])
				: "";

			var donateTitle = E(
				"label",
				{ class: "cbi-value-title", for: pkg.Name + "-donate" },
				_("Donate to the Project"),
			);
			var donateText = E(
				"div",
				{ class: "cbi-value-field" },
				E(
					"output",
					{ id: pkg.Name + "-donate", class: "cbi-value-description" },
					_("Please %sdonate%s to support development of this project.").format(
						"<a href='" + pkg.DonateURL + "' target='_blank'>",
						"</a>",
					),
				),
			);

			var donateDiv = reply.version
				? E("div", { class: "cbi-value" }, [donateTitle, donateText])
				: "";

			return E("div", {}, [
				header,
				statusDiv,
				gatewaysDiv,
				warningsDiv,
				errorsDiv,
				buttonsDiv,
				//			donateDiv,
			]);
		});
	},
});

RPC.on("setInitAction", function (reply) {
	var action = reply && reply.action;
	if (action === "start" || action === "restart" || action === "reload") {
		// Long-running: poll until service is running
		pollServiceStatus(true, function () {
			ui.hideModal();
			location.reload();
		});
	} else if (action === "stop") {
		// Poll until service has stopped
		pollServiceStatus(false, function () {
			ui.hideModal();
			location.reload();
		});
	} else {
		// enable/disable are fast, just reload immediately
		ui.hideModal();
		location.reload();
	}
});

return L.Class.extend({
	status: status,
	pkg: pkg,
	getInitStatus: getInitStatus,
});
