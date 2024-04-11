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
	get URL() {
		return "https://docs.openwrt.melmac.net/" + pkg.Name + "/";
	},
};

var getGateways = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getGateways",
	params: ["name"],
});

var getInitList = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getInitList",
	params: ["name"],
});

var getInitStatus = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getInitStatus",
	params: ["name"],
});

var getInterfaces = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getInterfaces",
	params: ["name"],
});

var getPlatformSupport = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getPlatformSupport",
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
	getInitList: function (name) {
		getInitList(name).then(
			function (result) {
				this.emit("getInitList", result);
			}.bind(this)
		);
	},
	getInitStatus: function (name) {
		getInitStatus(name).then(
			function (result) {
				this.emit("getInitStatus", result);
			}.bind(this)
		);
	},
	getGateways: function (name) {
		getGateways(name).then(
			function (result) {
				this.emit("getGateways", result);
			}.bind(this)
		);
	},
	getPlatformSupport: function (name) {
		getPlatformSupport(name).then(
			function (result) {
				this.emit("getPlatformSupport", result);
			}.bind(this)
		);
	},
	getInterfaces: function (name) {
		getInterfaces(name).then(
			function (result) {
				this.emit("getInterfaces", result);
			}.bind(this)
		);
	},
	setInitAction: function (name, action) {
		_setInitAction(name, action).then(
			function (result) {
				this.emit("setInitAction", result);
			}.bind(this)
		);
	},
};

var status = baseclass.extend({
	render: function () {
		return Promise.all([
			L.resolveDefault(getInitStatus(pkg.Name), {}),
			//			L.resolveDefault(getGateways(pkg.Name), {}),
		]).then(function (data) {
			//			var replyStatus = data[0];
			//			var replyGateways = data[1];
			var reply;
			var text;

			if (data[0] && data[0][pkg.Name]) {
				reply = data[0][pkg.Name];
			} else {
				reply = {
					enabled: null,
					running: null,
					running_iptables: null,
					running_nft: null,
					running_nft_file: null,
					version: null,
					gateways: null,
					errors: [],
					warnings: [],
				};
			}

			var header = E("h2", {}, _("Policy Based Routing - Status"));
			var statusTitle = E(
				"label",
				{ class: "cbi-value-title" },
				_("Service Status")
			);
			if (reply.version) {
				text = _("Version %s").format(reply.version) + " - ";
				if (reply.running) {
					text += _("Running");
					if (reply.running_iptables) {
						text += " (" + _("iptables mode") + ").";
					} else if (reply.running_nft_file) {
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
			var statusText = E("div", {}, text);
			var statusField = E("div", { class: "cbi-value-field" }, statusText);
			var statusDiv = E("div", { class: "cbi-value" }, [
				statusTitle,
				statusField,
			]);

			var gatewaysDiv = [];
			if (reply.gateways) {
				var gatewaysTitle = E(
					"label",
					{ class: "cbi-value-title" },
					_("Service Gateways")
				);
				text = _(
					"The %s indicates default gateway. See the %sREADME%s for details."
				).format(
					"<strong>✓</strong>",
					'<a href="' + pkg.URL + '#AWordAboutDefaultRouting" target="_blank">',
					"</a>"
				);
				var gatewaysDescr = E("div", { class: "cbi-value-description" }, text);
				var gatewaysText = E("div", {}, reply.gateways);
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
				var textLabelsTable = {
					warningResolverNotSupported: _(
						"Resolver set (%s) is not supported on this system."
					).format(L.uci.get(pkg.Name, "config", "resolver_set")),
					warningAGHVersionTooLow: _(
						"Installed AdGuardHome (%s) doesn't support 'ipset_file' option."
					),
					warningPolicyProcessCMD: _("%s"),
					warningTorUnsetParams: _(
						"Please unset 'src_addr', 'src_port' and 'dest_port' for policy '%s'"
					),
					warningTorUnsetProto: _(
						"Please unset 'proto' or set 'proto' to 'all' for policy '%s'"
					),
					warningTorUnsetChainIpt: _(
						"Please unset 'chain' or set 'chain' to 'PREROUTING' for policy '%s'"
					),
					warningTorUnsetChainNft: _(
						"Please unset 'chain' or set 'chain' to 'prerouting' for policy '%s'"
					),
					warningInvalidOVPNConfig: _(
						"Invalid OpenVPN config for %s interface"
					),
					warningOutdatedWebUIApp: _(
						"The WebUI application is outdated (version %s), please update it"
					),
					warningBadNftCallsInUserFile: _(
						"Incompatible nft calls detected in user include file, disabling fw4 nft file support."
					),
					warningDnsmasqInstanceNoConfdir: _(
						"Dnsmasq instance (%s) targeted in settings, but it doesn't have its own confdir."
					),
				};
				var warningsTitle = E(
					"label",
					{ class: "cbi-value-title" },
					_("Service Warnings")
				);
				var text = "";
				reply.warnings.forEach((element) => {
					if (element.id && textLabelsTable[element.id]) {
						if (element.id !== "warningPolicyProcessCMD") {
							text +=
								(textLabelsTable[element.id] + ".").format(
									element.extra || " "
								) + "<br />";
						}
					} else {
						text += _("Unknown warning") + "<br />";
					}
				});
				var warningsText = E("div", {}, text);
				var warningsField = E(
					"div",
					{ class: "cbi-value-field" },
					warningsText
				);
				warningsDiv = E("div", { class: "cbi-value" }, [
					warningsTitle,
					warningsField,
				]);
			}

			var errorsDiv = [];
			if (reply.errors && reply.errors.length) {
				var textLabelsTable = {
					errorConfigValidation: _("Config (%s) validation failure").format(
						"/etc/config/" + pkg.Name
					),
					errorNoIpFull: _("%s binary cannot be found").format("ip-full"),
					errorNoIptables: _("%s binary cannot be found").format("iptables"),
					errorNoIpset: _(
						"Resolver set support (%s) requires ipset, but ipset binary cannot be found"
					).format(L.uci.get(pkg.Name, "config", "resolver_set")),
					errorNoNft: _(
						"Resolver set support (%s) requires nftables, but nft binary cannot be found"
					).format(L.uci.get(pkg.Name, "config", "resolver_set")),
					errorResolverNotSupported: _(
						"Resolver set (%s) is not supported on this system"
					).format(L.uci.get(pkg.Name, "config", "resolver_set")),
					errorServiceDisabled: _(
						"The %s service is currently disabled"
					).format(pkg.Name),
					errorNoWanGateway: _(
						"The %s service failed to discover WAN gateway"
					).format(pkg.Name),
					errorNoWanInterface: _(
						"The %s inteface not found, you need to set the 'pbr.config.procd_wan_interface' option"
					),
					errorNoWanInterfaceHint: _(
						"Refer to https://docs.openwrt.melmac.net/pbr/#procd_wan_interface"
					),
					errorIpsetNameTooLong: _(
						"The ipset name '%s' is longer than allowed 31 characters"
					),
					errorNftsetNameTooLong: _(
						"The nft set name '%s' is longer than allowed 255 characters"
					),
					errorUnexpectedExit: _(
						"Unexpected exit or service termination: '%s'"
					),
					errorPolicyNoSrcDest: _(
						"Policy '%s' has no source/destination parameters"
					),
					errorPolicyNoInterface: _("Policy '%s' has no assigned interface"),
					errorPolicyUnknownInterface: _(
						"Policy '%s' has an unknown interface"
					),
					errorPolicyProcessCMD: _("%s"),
					errorFailedSetup: _("Failed to set up '%s'"),
					errorFailedReload: _("Failed to reload '%s'"),
					errorUserFileNotFound: _("Custom user file '%s' not found or empty"),
					errorUserFileSyntax: _("Syntax error in custom user file '%s'"),
					errorUserFileRunning: _("Error running custom user file '%s'"),
					errorUserFileNoCurl: _(
						"Use of 'curl' is detected in custom user file '%s', but 'curl' isn't installed"
					),
					errorNoGateways: _("Failed to set up any gateway"),
					errorResolver: _("Resolver '%s'"),
					errorPolicyProcessNoIpv6: _(
						"Skipping IPv6 policy '%s' as IPv6 support is disabled"
					),
					errorPolicyProcessUnknownFwmark: _(
						"Unknown packet mark for interface '%s'"
					),
					errorPolicyProcessMismatchFamily: _(
						"Mismatched IP family between in policy '%s'"
					),
					errorPolicyProcessUnknownProtocol: _(
						"Unknown protocol in policy '%s'"
					),
					errorPolicyProcessInsertionFailed: _(
						"Insertion failed for both IPv4 and IPv6 for policy '%s'"
					),
					errorPolicyProcessInsertionFailedIpv4: _(
						"Insertion failed for IPv4 for policy '%s'"
					),
					errorInterfaceRoutingEmptyValues: _(
						"Received empty tid/mark or interface name when setting up routing"
					),
					errorFailedToResolve: _("Failed to resolve '%s'"),
					errorInvalidOVPNConfig: _(
						"Invalid OpenVPN config for '%s' interface"
					),
					errorNftFileInstall: _("Failed to install fw4 nft file '%s'"),
					errorNoDownloadWithSecureReload: _(
						"Policy '%s' refers to URL which can't be downloaded in 'secure_reload' mode!"
					),
					errorDownloadUrlNoHttps: _(
						"Failed to download '%s', HTTPS is not supported!"
					),
					errorDownloadUrl: _("Failed to download '%s'!"),
					errorFileSchemaRequiresCurl: _(
						"The file:// schema requires curl, but it's not detected on this system!"
					),
					errorTryFailed: _("Command failed: %s"),
				};
				var errorsTitle = E(
					"label",
					{ class: "cbi-value-title" },
					_("Service Errors")
				);
				var text = "";
				reply.errors.forEach((element) => {
					if (element.id && textLabelsTable[element.id]) {
						if (element.id !== "errorPolicyProcessCMD") {
							text +=
								(textLabelsTable[element.id] + "!").format(
									element.extra || " "
								) + "<br />";
						}
					} else {
						text += _("Unknown error!") + "<br />";
					}
				});
				text += _("Errors encountered, please check the %sREADME%s!").format(
					'<a href="' + pkg.URL + '" target="_blank">',
					"</a><br />"
				);
				var errorsText = E("div", {}, text);
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
				"&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;"
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
								_("Starting %s service").format(pkg.Name)
							),
						]);
						return RPC.setInitAction(pkg.Name, "start");
					},
				},
				_("Start")
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
								_("Restarting %s service").format(pkg.Name)
							),
						]);
						return RPC.setInitAction(pkg.Name, "restart");
					},
				},
				_("Restart")
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
								_("Stopping %s service").format(pkg.Name)
							),
						]);
						return RPC.setInitAction(pkg.Name, "stop");
					},
				},
				_("Stop")
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
								_("Enabling %s service").format(pkg.Name)
							),
						]);
						return RPC.setInitAction(pkg.Name, "enable");
					},
				},
				_("Enable")
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
								_("Disabling %s service").format(pkg.Name)
							),
						]);
						return RPC.setInitAction(pkg.Name, "disable");
					},
				},
				_("Disable")
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
				{ class: "cbi-value-title" },
				_("Service Control")
			);
			var buttonsText = E("div", {}, [
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
			return E("div", {}, [
				header,
				statusDiv,
				gatewaysDiv,
				warningsDiv,
				errorsDiv,
				buttonsDiv,
			]);
		});
	},
});

RPC.on("setInitAction", function (reply) {
	ui.hideModal();
	location.reload();
});

return L.Class.extend({
	status: status,
	getInterfaces: getInterfaces,
	getPlatformSupport: getPlatformSupport,
});
