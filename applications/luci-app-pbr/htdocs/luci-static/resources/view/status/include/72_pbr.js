"require ui";
"require rpc";
"require form";
"require baseclass";
"require pbr.status as pbr";

var pkg = pbr.pkg;

return baseclass.extend({
	title: _("Policy Based Routing"),

	load: function () {
		return Promise.all([pbr.getInitStatus(pkg.Name)]);
	},

	render: function (data) {
		var reply;
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

		var versionText,
			statusText = "",
			modeText = "";
		if (reply.version) {
			versionText = reply.version;
			if (reply.running) {
				statusText = _("Active");
				if (reply.running_iptables) {
					modeText = _("iptables mode");
				} else if (reply.running_nft_file) {
					modeText = _("fw4 nft file mode");
				} else if (reply.running_nft) {
					modeText = _("nft mode");
				} else {
					modeText = _("unknown");
				}
			} else {
				if (reply.enabled) {
					statusText = _("Inactive");
				} else {
					statusText = _("Inactive (Disabled)");
				}
			}
		} else {
			versionText = _("Not installed or not found");
		}

		var table = E("table", { class: "table", id: "pbr_status_table" }, [
			E("tr", { class: "tr table-titles" }, [
				E("th", { class: "th" }, _("Status")),
				E("th", { class: "th" }, _("Version")),
				E("th", { class: "th" }, _("Mode")),
			]),
			E("tr", { class: "tr" }, [
				E("td", { class: "td" }, statusText),
				E("td", { class: "td" }, versionText),
				E("td", { class: "td" }, modeText),
			]),
		]);

		return table;
	},
});
