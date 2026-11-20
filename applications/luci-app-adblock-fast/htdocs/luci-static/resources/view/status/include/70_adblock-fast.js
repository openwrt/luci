"require ui";
"require rpc";
"require form";
"require baseclass";
"require adblock-fast.status as adb";
/* globals adb */

const { pkg } = adb;

return baseclass.extend({
	title: _("AdBlock-Fast"),

	load: function () {
		return Promise.all([adb.getInitStatus(pkg.Name)]);
	},

	render: function (data) {
		try {
			var status = (data[0] && data[0][pkg.Name]) || {};

			var cacheText = "-";
			if (status.outputCacheExists) {
				cacheText = _("Cache file");
			} else if (status.outputGzipExists) {
				cacheText = _("Compressed cache");
			}

			var forceDnsText = "-";
			if (status.force_dns_active && Array.isArray(status.force_dns_ports)) {
				var ports = status.force_dns_ports.join(" ");
				if (ports) forceDnsText = ports;
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
							(pkg.statusTable && pkg.statusTable[status.status]) || _("Unknown")
						),
						E("td", { class: "td" }, status.version || _("-")),
						E("td", { class: "td" }, status.dns || _("-")),
						E("td", { class: "td" }, status.entries != null ? String(status.entries) : _("-")),
						E("td", { class: "td" }, cacheText),
						E("td", { class: "td" }, forceDnsText),
					]),
				]
			);

			return table;
		} catch (e) {
			return E("div", { class: "alert-message warning" },
				_("Unable to retrieve %s status").format("AdBlock-Fast"));
		}
	},
});
