// Copyright MOSSDeF, 2023 Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from:
// - [@vsviridov](https://github.com/vsviridov)

"require ui";
"require rpc";
"require form";
"require baseclass";

var pkg = {
	get Name() {
		return "adblock-fast";
	},
	get URL() {
		return "https://docs.openwrt.melmac.net/" + pkg.Name + "/";
	},
};

var getFileUrlFilesizes = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getFileUrlFilesizes",
	params: ["name", "url"],
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
		return Promise.all([L.resolveDefault(getInitStatus(pkg.Name), {})]).then(
			function (data) {
				var reply = {
					status: (data[0] && data[0][pkg.Name]) || {
						enabled: false,
						status: null,
						running: null,
						version: null,
						errors: [],
						warnings: [],
						force_dns_active: null,
						force_dns_ports: [],
						entries: null,
						dns: null,
						outputFile: null,
						outputCache: null,
						outputGzip: null,
						outputFileExists: null,
						outputCacheExists: null,
						outputGzipExists: null,
						leds: [],
					},
				};
				var text = "";
				var outputFile = reply.status.outputFile;
				var outputCache = reply.status.outputCache;
				var statusTable = {
					statusNoInstall: _("%s is not installed or not found").format(
						pkg.Name
					),
					statusStopped: _("Stopped"),
					statusStarting: _("Starting"),
					statusProcessing: _("Processing lists"),
					statusRestarting: _("Restarting"),
					statusForceReloading: _("Force Reloading"),
					statusDownloading: _("Downloading lists"),
					statusFail: _("Failed to start"),
					statusSuccess: _("Active"),
				};

				var header = E("h2", {}, _("AdBlock-Fast - Status"));
				var statusTitle = E(
					"label",
					{ class: "cbi-value-title" },
					_("Service Status")
				);
				if (reply.status.version) {
					text += _("Version %s").format(reply.status.version) + " - ";
					switch (reply.status.status) {
						case "statusSuccess":
							text += statusTable[reply.status.status] + ".";
							text +=
								"<br />" +
								_("Blocking %s domains (with %s).").format(
									reply.status.entries,
									reply.status.dns
								);
							if (reply.status.outputGzipExists) {
								text += "<br />" + _("Compressed cache file created.");
							}
							if (reply.status.force_dns_active) {
								text += "<br />" + _("Force DNS ports:");
								reply.status.force_dns_ports.forEach((element) => {
									text += " " + element;
								});
								text += ".";
							}
							break;
						case "statusStopped":
							if (reply.status.enabled) {
								text += statusTable[reply.status.status] + ".";
							} else {
								text +=
									statusTable[reply.status.status] +
									" (" +
									_("Disabled") +
									").";
							}
							if (reply.status.outputCacheExists) {
								text += "<br />" + _("Cache file found.");
							} else if (reply.status.outputGzipExists) {
								text += "<br />" + _("Compressed cache file found.");
							}
							break;
						case "statusRestarting":
						case "statusForceReloading":
						case "statusDownloading":
						case "statusProcessing":
							text += statusTable[reply.status.status] + "...";
							break;
						default:
							text += statusTable[reply.status.status] + ".";
							break;
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

				var warningsDiv = [];
				if (reply.status.warnings && reply.status.warnings.length) {
					var warningTable = {
						warningExternalDnsmasqConfig: _(
							"Use of external dnsmasq config file detected, please set '%s' option to '%s'"
						).format("dns", "dnsmasq.conf"),
						warningMissingRecommendedPackages: _(
							"Some recommended packages are missing"
						),
						warningInvalidCompressedCacheDir: _(
							"Invalid compressed cache directory '%s'"
						),
						warningFreeRamCheckFail: _("Can't detect free RAM"),
					};
					var warningsTitle = E(
						"label",
						{ class: "cbi-value-title" },
						_("Service Warnings")
					);
					var text = "";
					reply.status.warnings.forEach((element) => {
						if (element.id && warningTable[element.id])
							text +=
								warningTable[element.id].format(element.extra || " ") +
								"<br />";
						else text += _("Unknown warning") + "<br />";
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
				if (reply.status.errors && reply.status.errors.length) {
					var errorTable = {
						errorConfigValidationFail: _(
							"Config (%s) validation failure!"
						).format("/etc/config/" + pkg.Name),
						errorServiceDisabled: _("%s is currently disabled").format(
							pkg.Name
						),
						errorNoDnsmasqIpset: _(
							"The dnsmasq ipset support is enabled, but dnsmasq is either not installed or installed dnsmasq does not support ipset"
						),
						errorNoIpset: _(
							"The dnsmasq ipset support is enabled, but ipset is either not installed or installed ipset does not support '%s' type"
						).format("hash:net"),
						errorNoDnsmasqNftset: _(
							"The dnsmasq nft set support is enabled, but dnsmasq is either not installed or installed dnsmasq does not support nft set"
						),
						errorNoNft: _(
							"The dnsmasq nft sets support is enabled, but nft is not installed"
						),
						errorNoWanGateway: _(
							"The %s failed to discover WAN gateway"
						).format(pkg.Name),
						errorOutputDirCreate: _("Failed to create directory for %s file"),
						errorOutputFileCreate: _("Failed to create '%s' file").format(
							outputFile
						),
						errorFailDNSReload: _("Failed to restart/reload DNS resolver"),
						errorSharedMemory: _("Failed to access shared memory"),
						errorSorting: _("Failed to sort data file"),
						errorOptimization: _("Failed to optimize data file"),
						errorAllowListProcessing: _("Failed to process allow-list"),
						errorDataFileFormatting: _("Failed to format data file"),
						errorMovingDataFile: _(
							"Failed to move temporary data file to '%s'"
						).format(outputFile),
						errorCreatingCompressedCache: _(
							"Failed to create compressed cache"
						),
						errorRemovingTempFiles: _("Failed to remove temporary files"),
						errorRestoreCompressedCache: _("Failed to unpack compressed cache"),
						errorRestoreCache: _("Failed to move '%s' to '%s'").format(
							outputCache,
							outputFile
						),
						errorOhSnap: _(
							"Failed to create block-list or restart DNS resolver"
						),
						errorStopping: _("Failed to stop %s").format(pkg.Name),
						errorDNSReload: _("Failed to reload/restart DNS resolver"),
						errorDownloadingConfigUpdate: _(
							"Failed to download Config Update file"
						),
						errorDownloadingList: _("Failed to download %s"),
						errorParsingConfigUpdate: _("Failed to parse Config Update file"),
						errorParsingList: _("Failed to parse %s"),
						errorNoSSLSupport: _("No HTTPS/SSL support on device"),
						errorCreatingDirectory: _(
							"Failed to create output/cache/gzip file directory"
						),
						errorDetectingFileType: _("Failed to detect format %s"),
						errorNothingToDo: _(
							"No blocked list URLs nor blocked-domains enabled"
						),
						errorTooLittleRam: _(
							"Free ram (%s) is not enough to process all enabled block-lists"
						),
					};
					var errorsTitle = E(
						"label",
						{ class: "cbi-value-title" },
						_("Service Errors")
					);
					var text = "";
					reply.status.errors.forEach((element) => {
						if (element.id && errorTable[element.id])
							text +=
								errorTable[element.id].format(element.extra || " ") + "!<br />";
						else text += _("Unknown error") + "<br />";
					});
					text += _("Errors encountered, please check the %sREADME%s").format(
						'<a href="' + pkg.URL + '" target="_blank">',
						"</a>!<br />"
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

				var btn_action_dl = E(
					"button",
					{
						class: "btn cbi-button cbi-button-apply",
						disabled: true,
						click: function (ev) {
							ui.showModal(null, [
								E(
									"p",
									{ class: "spinning" },
									_("Force redownloading %s block lists").format(pkg.Name)
								),
							]);
							return RPC.setInitAction(pkg.Name, "dl");
						},
					},
					_("Redownload")
				);

				var btn_action_pause = E(
					"button",
					{
						class: "btn cbi-button cbi-button-apply",
						disabled: true,
						click: function (ev) {
							ui.showModal(null, [
								E("p", { class: "spinning" }, _("Pausing %s").format(pkg.Name)),
							]);
							return RPC.setInitAction(pkg.Name, "pause");
						},
					},
					_("Pause")
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

				if (reply.status.enabled) {
					btn_enable.disabled = true;
					btn_disable.disabled = false;
					switch (reply.status.status) {
						case "statusSuccess":
							btn_start.disabled = true;
							btn_action_dl.disabled = false;
							btn_action_pause.disabled = false;
							btn_stop.disabled = false;
							break;
						case "statusStopped":
							btn_start.disabled = false;
							btn_action_dl.disabled = true;
							btn_action_pause.disabled = true;
							btn_stop.disabled = true;
							break;
						default:
							btn_start.disabled = false;
							btn_action_dl.disabled = true;
							btn_action_pause.disabled = true;
							btn_stop.disabled = false;
							btn_enable.disabled = true;
							btn_disable.disabled = true;
							break;
					}
				} else {
					btn_start.disabled = true;
					btn_action_dl.disabled = true;
					btn_action_pause.disabled = true;
					btn_stop.disabled = true;
					btn_enable.disabled = false;
					btn_disable.disabled = true;
				}

				var buttonsDiv = [];
				var buttonsTitle = E(
					"label",
					{ class: "cbi-value-title" },
					_("Service Control")
				);
				var buttonsText = E("div", {}, [
					btn_start,
					btn_gap,
					// btn_action_pause,
					// btn_gap,
					btn_action_dl,
					btn_gap,
					btn_stop,
					btn_gap_long,
					btn_enable,
					btn_gap,
					btn_disable,
				]);
				var buttonsField = E("div", { class: "cbi-value-field" }, buttonsText);
				if (reply.status.version) {
					buttonsDiv = E("div", { class: "cbi-value" }, [
						buttonsTitle,
						buttonsField,
					]);
				}

				return E("div", {}, [
					header,
					statusDiv,
					warningsDiv,
					errorsDiv,
					buttonsDiv,
				]);
			}
		);
	},
});

RPC.on("setInitAction", function (reply) {
	ui.hideModal();
	location.reload();
});

return L.Class.extend({
	status: status,
	getFileUrlFilesizes: getFileUrlFilesizes,
	getPlatformSupport: getPlatformSupport,
});
