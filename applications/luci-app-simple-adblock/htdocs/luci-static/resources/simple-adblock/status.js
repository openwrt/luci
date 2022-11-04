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
			var status = replyStatus[pkg.Name];
			var outputFile = status.outputFile;
			var outputCache = status.outputCache;
			var statusTable = {
			  statusNoInstall: _("%s is not installed or not found").format(pkg.Name),
			  statusStopped: _("Stopped"),
			  statusStarting: _("Starting"),
			  statusRestarting: _("Restarting"),
			  statusForceReloading: _("Force Reloading"),
			  statusDownloading: _("Downloading"),
			  statusError: _("Error"),
			  statusWarning: _("Warning"),
			  statusFail: _("Fail"),
			  statusSuccess: _("Active")
			};

			var header = E('h2', {}, _("Simple AdBlock - Status"))
			var statusTitle = E('label', { class: 'cbi-value-title' }, _("Service Status"));
			if (status.version) {
				text += _("Version: %s").format(status.version) + " - ";
				switch (status.status) {
					case 'statusSuccess':
						text += statusTable[status.status] + ".";
						text += "<br />" + _("Blocking %s domains (with %s).").format(status.entries, status.dns);
						if (status.outputGzipExists) {
							text += "<br />" + _("Compressed cache file created.");
						}
						if (status.force_dns_active) {
							text += "<br />" + _("Force DNS ports:");
							status.force_dns_ports.forEach(element => {
								text += " " + element;
							});
							text += ".";
						}
						break;
					case 'statusStopped':
						if (status.enabled) {
							text += statusTable[status.status] + ".";
						}
						else {
							text += statusTable[status.status] + _("disabled") + "."
						}
						if (status.outputCacheExists) {
							text += "<br />" + _("Cache file found.");
						}
						else if (status.outputGzipExists) {
							text += "<br />" + _("Compressed cache file found.");
						}
						break;
					case 'statusRestarting':
					case 'statusForceReloading':
					case 'statusDownloading':
						text += statusTable[status.status] + "...";
						break;
					default:
						text += statusTable[status.status] + ".";
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
			if (status.warnings) {
				var warningsTitle = E('label', { class: 'cbi-value-title' }, _("Service Warnings"));
				var warningsText = E('div', {}, status.warnings);
				var warningsField = E('div', { class: 'cbi-value-field' }, warningsText);
				warningsDiv = E('div', { class: 'cbi-value' }, [warningsTitle, warningsField]);
			}

			var errorsDiv = [];
			if ((status.errors).length) {
				var errorTable = {
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
				(status.errors).forEach(element => {
					text += errorTable[element] + ".<br />";
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

			if (status.enabled) {
				btn_enable.disabled = true;
				btn_disable.disabled = false;
				switch (status.status) {
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
						btn_start.disabled = true;
						btn_action.disabled = true;
						btn_stop.disabled = true;
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
			if (status.version) {
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
