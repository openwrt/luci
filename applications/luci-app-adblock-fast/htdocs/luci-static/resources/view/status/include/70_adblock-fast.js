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

var getInitStatus = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getInitStatus",
	params: ["name"],
});

return baseclass.extend({
	title: _("AdBlock-Fast"),

	load: function () {
		return Promise.all([getInitStatus(pkg.Name)]);
	},

	render: function (data) {
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
			statusSuccess: _("Active"),
		};

		var cacheText;
		if (reply.status.outputCacheExists) {
			cacheText = _("Cache file");
		} else if (reply.status.outputGzipExists) {
			cacheText = _("Compressed cache");
		}
		var forceDnsText = "";
		if (reply.status.force_dns_active) {
			reply.status.force_dns_ports.forEach((element) => {
				forceDnsText += element + " ";
			});
		} else {
			forceDnsText = "-";
		}

		var table = E(
			"table",
			{ class: "table", id: "adblock-fast_status_table" },
			[
				E("tr", { class: "tr table-titles" }, [
					E("th", { class: "th" }, _("Status")),
					E("th", { class: "th" }, _("Version")),
					E("th", { class: "th" }, _("DNS Service")),
					E("th", { class: "th" }, _("Blocked Domains")),
					E("th", { class: "th" }, _("Cache")),
					E("th", { class: "th" }, _("Force DNS Ports")),
				]),
				E("tr", { class: "tr" }, [
					E(
						"td",
						{ class: "td" },
						statusTable[reply.status.status] || _("Unknown")
					),
					E("td", { class: "td" }, reply.status.version || _("-")),
					E("td", { class: "td" }, reply.status.dns || _("-")),
					E("td", { class: "td" }, reply.status.entries || _("-")),
					E("td", { class: "td" }, cacheText || _("-")),
					E("td", { class: "td" }, forceDnsText || _("-")),
				]),
			]
		);

		return table;
	},
});
