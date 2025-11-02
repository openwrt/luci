"require ui";
"require rpc";
"require form";
"require baseclass";
"require adblock-fast.status as adb";

const { pkg } = adb;

return baseclass.extend({
	title: _("AdBlock-Fast"),

	load: function () {
		return Promise.all([adb.getInitStatus(pkg.Name)]);
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
						pkg.statusTable[reply.status.status] || _("Unknown")
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
