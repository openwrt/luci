// Copyright 2022 Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from [@vsviridov](https://github.com/vsviridov)

"require ui";
"require rpc";
"require form";
"require baseclass";

var pkg = {
	get Name() { return 'simple-adblock'; },
	get URL() { return 'https://docs.openwrt.melmac.net/' + pkg.Name + '/'; },
};

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
	on: function on(event, callback) {
		var pair = { event: event, callback: callback }
		this.listeners.push(pair);
		return function unsubscribe() {
			this.listeners = this.listeners.filter(function (listener) {
				return listener !== pair;
			});
		}.bind(this);
	},
	emit: function emit(event, data) {
		this.listeners.forEach(function (listener) {
			if (listener.event === event) {
				listener.callback(data);
			}
		});
	},
	getInitList: function getInitList(name) {
		getInitList(name).then(function (result) {
			this.emit('getInitList', result);
		}.bind(this));
	},
	getInitStatus: function getInitStatus(name) {
		getInitStatus(name).then(function (result) {
			this.emit('getInitStatus', result);
		}.bind(this));
	},
	getPlatformSupport: function getPlatformSupport(name) {
		getPlatformSupport(name).then(function (result) {
			this.emit('getPlatformSupport', result);
		}.bind(this));
	},
	setInitAction: function setInitAction(name, action) {
		_setInitAction(name, action).then(function (result) {
			this.emit('setInitAction', result);
		}.bind(this));
	},
}

var status = baseclass.extend({
	render: function () {
		return Promise.all([
			L.resolveDefault(getInitStatus(), {}),
		]).then(function (data) {
			var replyStatus = data[0];
			var text ="";
			var reply = replyStatus[pkg.Name];
			var outputFile = reply.outputFile;
			var outputCache = reply.outputCache;
			var statusTable = {
				statusNoInstall: _("%s is not installed or not found").format(pkg.Name),
				statusStopped: _("Stopped"),
				statusStarting: _("Starting"),
				statusProcessing: _("Processing lists"),
				statusRestarting: _("Restarting"),
				statusForceReloading: _("Force Reloading"),
				statusDownloading: _("Downloading lists"),
				statusError: _("Error"),
				statusWarning: _("Warning"),
				statusFail: _("Fail"),
				statusSuccess: _("Active")
			};

			var header = E('h2', {}, _("Simple AdBlock - Status"))
			var statusTitle = E('label', { class: 'cbi-value-title' }, _("Service Status"));
			if (reply.version) {
				text += _("Version: %s").format(reply.version) + " - ";
				switch (reply.status) {
					case 'statusSuccess':
						text += statusTable[reply.status] + ".";
						text += "<br />" + _("Blocking %s domains (with %s).").format(reply.entries, reply.dns);
						if (reply.outputGzipExists) {
							text += "<br />" + _("Compressed cache file created.");
						}
						if (reply.force_dns_active) {
							text += "<br />" + _("Force DNS ports:");
							reply.force_dns_ports.forEach(element => {
								text += " " + element;
							});
							text += ".";
						}
						break;
					case 'statusStopped':
						if (reply.enabled) {
							text += statusTable[reply.status] + ".";
						}
						else {
							text += statusTable[reply.status] + _("disabled") + "."
						}
						if (reply.outputCacheExists) {
							text += "<br />" + _("Cache file found.");
						}
						else if (reply.outputGzipExists) {
							text += "<br />" + _("Compressed cache file found.");
						}
						break;
					case 'statusRestarting':
					case 'statusForceReloading':
					case 'statusDownloading':
					case 'statusProcessing':
						text += statusTable[reply.status] + "...";
						break;
					default:
						text += statusTable[reply.status] + ".";
						break;
				}
			}
			else {
				text = _("Not installed or not found");
			}
			var statusText = E('div', {}, text);
			var statusField = E('div', { class: 'cbi-value-field' }, statusText);
			var statusDiv = E('div', { class: 'cbi-value' }, [statusTitle, statusField]);

			var warningsDiv = [];
			if (reply.warnings && reply.warnings.length) {
				var warningTable = {
					warningExternalDnsmasqConfig: _("use of external dnsmasq config file detected, please set '%s' option to '%s'").format("dns", "dnsmasq.conf"),
					warningMissingRecommendedPackages: _("some recommended packages are missing")
				}
				var warningsTitle = E('label', { class: 'cbi-value-title' }, _("Service Warnings"));
				var text = "";
				(reply.warnings).forEach(element => {
					text += (warningTable[element.id]).format(element.extra || ' ') + "<br />";
				});
				var warningsText = E('div', {}, text);
				var warningsField = E('div', { class: 'cbi-value-field' }, warningsText);
				warningsDiv = E('div', { class: 'cbi-value' }, [warningsTitle, warningsField]);
			}

			var errorsDiv = [];
			if (reply.errors && reply.errors.length) {
				var errorTable = {
					errorConfigValidationFail: _("config (%s) validation failure!").format('/etc/config/' + pkg.Name),
					errorServiceDisabled: _("%s is currently disabled").format(pkg.Name),
					errorNoDnsmasqIpset: _("dnsmasq ipset support is enabled, but dnsmasq is either not installed or installed dnsmasq does not support ipset"),
					errorNoIpset: _("dnsmasq ipset support is enabled, but ipset is either not installed or installed ipset does not support '%s' type").format("hash:net"),
					errorNoDnsmasqNftset: _("dnsmasq nft set support is enabled, but dnsmasq is either not installed or installed dnsmasq does not support nft set"),
					errorNoNft: _("dnsmasq nft sets support is enabled, but nft is not installed"),
					errorNoWanGateway: _("the %s failed to discover WAN gateway").format(pkg.Name),
					errorOutputDirCreate: _("failed to create directory for %s file"),
					errorOutputFileCreate: _("failed to create '%s' file").format(outputFile),
					errorFailDNSReload: _("failed to restart/reload DNS resolver"),
					errorSharedMemory: _("failed to access shared memory"),
					errorSorting: _("failed to sort data file"),
					errorOptimization: _("failed to optimize data file"),
					errorAllowListProcessing: _("failed to process allow-list"),
					errorDataFileFormatting: _("failed to format data file"),
					errorMovingDataFile: _("failed to move temporary data file to '%s'").format(outputFile),
					errorCreatingCompressedCache: _("failed to create compressed cache"),
					errorRemovingTempFiles: _("failed to remove temporary files"),
					errorRestoreCompressedCache: _("failed to unpack compressed cache"),
					errorRestoreCache: _("failed to move '%s' to '%s'").format(outputCache, outputFile),
					errorOhSnap: _("failed to create block-list or restart DNS resolver"),
					errorStopping: _("failed to stop %s").format(pkg.Name),
					errorDNSReload: _("failed to reload/restart DNS resolver"),
					errorDownloadingConfigUpdate: _("failed to download Config Update file"),
					errorDownloadingList: _("failed to download"),
					errorParsingConfigUpdate: _("failed to parse Config Update file"),
					errorParsingList: _("failed to parse"),
					errorNoSSLSupport: _("no HTTPS/SSL support on device"),
					errorCreatingDirectory: _("failed to create output/cache/gzip file directory")
				}
				var errorsTitle = E('label', { class: 'cbi-value-title' }, _("Service Errors"));
				var text = "";
				(reply.errors).forEach(element => {
					text += (errorTable[element.id]).format(element.extra || ' ') + "<br />";
				});
				var errorsText = E('div', {}, text);
				var errorsField = E('div', { class: 'cbi-value-field' }, errorsText);
				errorsDiv = E('div', { class: 'cbi-value' }, [errorsTitle, errorsField]);
			}

			var btn_gap = E('span', {}, '&#160;&#160;');
			var btn_gap_long = E('span', {}, '&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;');

			var btn_start = E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				disabled: true,
				click: function (ev) {
					ui.showModal(null, [
						E('p', { 'class': 'spinning' }, _('Starting %s service').format(pkg.Name))
					]);
					return RPC.setInitAction(pkg.Name, 'start');
				}
			}, _('Start'));

			var btn_action = E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				disabled: true,
				click: function (ev) {
					ui.showModal(null, [
						E('p', { 'class': 'spinning' }, _('Force re-downloading %s block lists').format(pkg.Name))
					]);
					return RPC.setInitAction(pkg.Name, 'dl');
				}
			}, _('Force Re-Download'));

			var btn_stop = E('button', {
				'class': 'btn cbi-button cbi-button-reset',
				disabled: true,
				click: function (ev) {
					ui.showModal(null, [
						E('p', { 'class': 'spinning' }, _('Stopping %s service').format(pkg.Name))
					]);
					return RPC.setInitAction(pkg.Name, 'stop');
				}
			}, _('Stop'));

			var btn_enable = E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				disabled: true,
				click: function (ev) {
					ui.showModal(null, [
						E('p', { 'class': 'spinning' }, _('Enabling %s service').format(pkg.Name))
					]);
					return RPC.setInitAction(pkg.Name, 'enable');
				}
			}, _('Enable'));

			var btn_disable = E('button', {
				'class': 'btn cbi-button cbi-button-reset',
				disabled: true,
				click: function (ev) {
					ui.showModal(null, [
						E('p', { 'class': 'spinning' }, _('Disabling %s service').format(pkg.Name))
					]);
					return RPC.setInitAction(pkg.Name, 'disable');
				}
			}, _('Disable'));

			if (reply.enabled) {
				btn_enable.disabled = true;
				btn_disable.disabled = false;
				switch (reply.status) {
					case 'statusSuccess':
						btn_start.disabled = true;
						btn_action.disabled = false;
						btn_stop.disabled = false;
						break;
					case 'statusStopped':
						btn_start.disabled = false;
						btn_action.disabled = true;
						btn_stop.disabled = true;
						break;
					default:
						btn_start.disabled = false;
						btn_action.disabled = true;
						btn_stop.disabled = false;
						btn_enable.disabled = true;
						btn_disable.disabled = true;
					break;
				}
			}
			else {
				btn_start.disabled = true;
				btn_action.disabled = true;
				btn_stop.disabled = true;
				btn_enable.disabled = false;
				btn_disable.disabled = true;
			}

			var buttonsDiv = [];
			var buttonsTitle = E('label', { class: 'cbi-value-title' }, _("Service Control"))
			var buttonsText = E('div', {}, [btn_start, btn_gap, btn_action, btn_gap, btn_stop, btn_gap_long, btn_enable, btn_gap, btn_disable]);
			var buttonsField = E('div', { class: 'cbi-value-field' }, buttonsText);
			if (reply.version) {
				buttonsDiv = E('div', { class: 'cbi-value' }, [buttonsTitle, buttonsField]);
			}

			return E('div', {}, [header, statusDiv, warningsDiv, errorsDiv, buttonsDiv]);
		});
	},
});

RPC.on('setInitAction', function (reply) {
	ui.hideModal();
	location.reload();
});

return L.Class.extend({
	status: status,
	getPlatformSupport: getPlatformSupport
});
