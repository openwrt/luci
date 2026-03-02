"require ui";
"require rpc";
"require uci";
"require form";
"require baseclass";
"require https-dns-proxy.status as hdp";
/* globals hdp */

var pkg = hdp.pkg;

return baseclass.extend({
	title: _("HTTPS DNS Proxy Instances"),

	load: function () {
		return Promise.all([
			hdp.getInitStatus(pkg.Name),
			hdp.getProviders(pkg.Name),
			hdp.getServiceInfo(pkg.Name),
		]);
	},

	render: function (data) {
		try {
			var reply = {
				status: (data[0] && data[0][pkg.Name]) || {},
				providers: (data[1] && data[1][pkg.Name]) || [],
				runtime: (data[2] && data[2][pkg.Name]) || {},
			};
			if (Array.isArray(reply.providers)) {
				reply.providers.sort(function (a, b) {
					return _(a.title).localeCompare(_(b.title));
				});
			} else {
				reply.providers = [];
			}
			reply.providers.push({
				title: "Custom",
				template: "{option}",
				params: { option: { type: "text" } },
			});

			var forceDnsText = "-";
			if (reply.status.force_dns_active && Array.isArray(reply.status.force_dns_ports)) {
				var ports = reply.status.force_dns_ports.join(" ");
				if (ports) forceDnsText = ports;
			}

			var table = E(
				"table",
				{ class: "table", id: "https-dns-proxy_status_table" },
				[
					E("tr", { class: "tr table-titles" }, [
						E("th", { class: "th" }, _("Name / Type")),
						E("th", { class: "th" }, _("Listen Address")),
						E("th", { class: "th" }, _("Listen Port")),
						E("th", { class: "th" }, _("Force DNS Ports")),
					]),
				]
			);

			var rows = [];
			var instances = (reply.runtime && reply.runtime.instances) || {};
			Object.values(instances).forEach((element) => {
				var resolver;
				var address;
				var port;
				var name;
				var option;
				var found;
				if (Array.isArray(element.command)) {
					element.command.forEach((param, index, arr) => {
						if (param === "-r") resolver = arr[index + 1];
						if (param === "-a") address = arr[index + 1];
						if (param === "-p") port = arr[index + 1];
					});
				}
				resolver = resolver || "Unknown";
				address = address || "127.0.0.1";
				port = port || "Unknown";
				reply.providers.forEach((prov) => {
					let regexp = pkg.templateToRegexp(prov.template);
					if (!found && regexp.test(resolver)) {
						found = true;
						name = _(prov.title);
						let match = resolver.match(regexp);
						if (match && match[1] != null) {
							if (
								prov.params &&
								prov.params.option &&
								Array.isArray(prov.params.option.options)
							) {
								prov.params.option.options.forEach((opt) => {
									if (opt.value === match[1]) option = _(opt.description);
								});
								if (option) name += " (" + option + ")";
							} else {
								if (match[1] !== "") name += " (" + match[1] + ")";
							}
						}
					}
				});
				rows.push([name || _("Unknown"), address, port, forceDnsText]);
			});
			cbi_update_table(table, rows, E("em", _("There are no active instances.")));

			return table;
		} catch (e) {
			return E("div", { class: "alert-message warning" },
				_("Unable to retrieve %s status").format("HTTPS DNS Proxy"));
		}
	},
});
