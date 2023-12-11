// Copyright MOSSDeF, 2023 Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from:
// - [@stokito](https://github.com/stokito)
// - [@vsviridov](https://github.com/vsviridov)
// noinspection JSAnnotator

"require ui";
"require rpc";
"require form";
"require baseclass";

var pkg = {
	get Name() {
		return "https-dns-proxy";
	},
	get URL() {
		return "https://docs.openwrt.melmac.net/" + pkg.Name + "/";
	},
	templateToRegexp: function (template) {
		return RegExp(
			"^" +
				template
					.split(/(\{\w+\})/g)
					.map((part) => {
						let placeholder = part.match(/^\{(\w+)\}$/);
						if (placeholder) return `(?<${placeholder[1]}>.*?)`;
						else return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
					})
					.join("") +
				"$"
		);
	},
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

var getProviders = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getProviders",
	params: ["name"],
});

var getRuntime = rpc.declare({
	object: "luci." + pkg.Name,
	method: "getRuntime",
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
	getPlatformSupport: function (name) {
		getPlatformSupport(name).then(
			function (result) {
				this.emit("getPlatformSupport", result);
			}.bind(this)
		);
	},
	getProviders: function (name) {
		getProviders(name).then(
			function (result) {
				this.emit("getProviders", result);
			}.bind(this)
		);
	},
	getRuntime: function (name) {
		getRuntime(name).then(
			function (result) {
				this.emit("getRuntime", result);
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
			L.resolveDefault(getProviders(pkg.Name), {}),
			L.resolveDefault(getRuntime(pkg.Name), {}),
		]).then(function (data) {
			var text;
			var reply = {
				status: (data[0] && data[0][pkg.Name]) || {
					enabled: null,
					running: null,
					force_dns_active: null,
					version: null,
				},
				providers: (data[1] && data[1][pkg.Name]) || { providers: [] },
				runtime: (data[2] && data[2][pkg.Name]) || { instances: [] },
			};
			reply.providers.sort(function (a, b) {
				return _(a.title).localeCompare(_(b.title));
			});
			reply.providers.push({
				title: "Custom",
				template: "{option}",
				params: { option: { type: "text" } },
			});

			var header = E("h2", {}, _("HTTPS DNS Proxy - Status"));
			var statusTitle = E(
				"label",
				{ class: "cbi-value-title" },
				_("Service Status")
			);
			if (reply.status.version) {
				if (reply.status.running) {
					text = _("Version %s - Running.").format(reply.status.version);
					if (reply.status.force_dns_active) {
						text += "<br />" + _("Force DNS ports:");
						reply.status.force_dns_ports.forEach((element) => {
							text += " " + element;
						});
						text += ".";
					}
				} else {
					if (reply.status.enabled) {
						text = _("Version %s - Stopped.").format(reply.status.version);
					} else {
						text = _("Version %s - Stopped (Disabled).").format(
							reply.status.version
						);
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

			var instancesDiv = [];
			if (reply.runtime.instances) {
				var instancesTitle = E(
					"label",
					{ class: "cbi-value-title" },
					_("Service Instances")
				);
				text = _("See the %sREADME%s for details.").format(
					'<a href="' +
						pkg.URL +
						'#a-word-about-default-routing " target="_blank">',
					"</a>"
				);
				var instancesDescr = E("div", { class: "cbi-value-description" }, "");

				text = "";
				Object.values(reply.runtime.instances).forEach((element) => {
					var resolver;
					var address;
					var port;
					var name;
					var option;
					var found;
					element.command.forEach((param, index, arr) => {
						if (param === "-r") resolver = arr[index + 1];
						if (param === "-a") address = arr[index + 1];
						if (param === "-p") port = arr[index + 1];
					});
					resolver = resolver || "Unknown";
					address = address || "127.0.0.1";
					port = port || "Unknown";
					reply.providers.forEach((prov) => {
						let regexp = pkg.templateToRegexp(prov.template);
						if (!found && regexp.test(resolver)) {
							found = true;
							name = _(prov.title);
							let match = resolver.match(regexp);
							if (match[1] != null) {
								if (
									prov.params &&
									prov.params.option &&
									prov.params.option.options
								) {
									prov.params.option.options.forEach((opt) => {
										if (opt.value === match[1]) option = _(opt.description);
									});
									name += " (" + option + ")";
								} else {
									if (match[1] !== "") name += " (" + match[1] + ")";
								}
							}
						}
					});
					if (address === "127.0.0.1")
						text += _("%s%s%s proxy on port %s.%s").format(
							"<strong>",
							name,
							"</strong>",
							port,
							"<br />"
						);
					else
						text += _("%s%s%s proxy at %s on port %s.%s").format(
							"<strong>",
							name,
							"</strong>",
							address,
							port,
							"<br />"
						);
				});
				var instancesText = E("div", {}, text);
				var instancesField = E("div", { class: "cbi-value-field" }, [
					instancesText,
					instancesDescr,
				]);
				instancesDiv = E("div", { class: "cbi-value" }, [
					instancesTitle,
					instancesField,
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

			if (reply.status.enabled) {
				btn_enable.disabled = true;
				btn_disable.disabled = false;
				if (reply.status.running) {
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
			var buttonsDiv = reply.status.version
				? E("div", { class: "cbi-value" }, [buttonsTitle, buttonsField])
				: "";
			return E("div", {}, [header, statusDiv, instancesDiv, buttonsDiv]);
		});
	},
});

RPC.on("setInitAction", function (reply) {
	ui.hideModal();
	location.reload();
});

return L.Class.extend({
	status: status,
	getPlatformSupport: getPlatformSupport,
	getProviders: getProviders,
	getRuntime: getRuntime,
});
