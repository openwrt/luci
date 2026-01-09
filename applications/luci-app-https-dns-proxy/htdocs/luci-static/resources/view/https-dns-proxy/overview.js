// Copyright 2023 MOSSDeF, Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from:
// - [@jow-](https://github.com/jow-)
// - [@stokito](https://github.com/stokito)
// - [@vsviridov](https://github.com/vsviridov)
// noinspection JSAnnotator

"use strict";
"require form";
"require rpc";
"require view";
"require https-dns-proxy.status as hdp";

var pkg = hdp.pkg;

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(hdp.getPlatformSupport(pkg.Name), {}),
			L.resolveDefault(hdp.getProviders(pkg.Name), {}),
			L.resolveDefault(L.uci.load(pkg.Name), {}),
			L.resolveDefault(L.uci.load("dhcp"), {}),
		]);
	},

	render: function (data) {
		var reply = {
			platform: (data[0] && data[0][pkg.Name]) || {
				http2_support: null,
				http3_support: null,
			},
			providers: (data[1] && data[1][pkg.Name]) || [{ title: "empty" }],
		};
		reply.providers.sort(function (a, b) {
			return _(a.title).localeCompare(_(b.title));
		});
		reply.providers.push({
			title: "Custom",
			template: "{option}",
			params: { option: { type: "text" } },
		});

		var status, m, s, o, p;
		var text;

		status = new hdp.status();

		m = new form.Map(pkg.Name, _("HTTPS DNS Proxy - Configuration"));
		s = m.section(form.NamedSection, "config", pkg.Name);

		s.tab("service", _("Service Options"));
		s.tab("global", _("Global Instance Options"));

		var dhcp_dnsmasq_values = Object.values(L.uci.sections("dhcp", "dnsmasq"));
		function isEmpty(obj) {
			return Object.keys(obj).length === 0;
		}

		if (!isEmpty(dhcp_dnsmasq_values)) {
			o = s.taboption(
				"service",
				form.ListValue,
				"dnsmasq_config_update_option",
				_("Update DNSMASQ Config on Start/Stop"),
				_(
					"If update option is selected, the %s'DNS Forwards' section of DHCP and DNS%s will be automatically updated to use selected DoH providers (%smore information%s)."
				).format(
					'<a href="' + L.url("admin", "network", "dhcp") + '">',
					"</a>",
					'<a href="' + pkg.URL + "#default-settings" + '" target="_blank">',
					"</a>"
				)
			);
			o.value("*", _("Update all configs"));
			o.value("+", _("Update select configs"));
			o.value("-", _("Do not update configs"));
			o.default = "*";
			o.retain = true;
			o.cfgvalue = function (section_id) {
				let val = this.map.data.get(
					this.map.config,
					section_id,
					"dnsmasq_config_update"
				);
				if (val && val[0]) {
					switch (val[0]) {
						case "*":
						case "-":
							return val[0];
						default:
							return "+";
					}
				} else return "*";
			};
			o.write = function (section_id, formvalue) {
				L.uci.set(pkg.Name, section_id, "dnsmasq_config_update", formvalue);
			};

			o = s.taboption(
				"service",
				form.MultiValue,
				"dnsmasq_config_update",
				_("Select the DNSMASQ Configs to update")
			);

			dhcp_dnsmasq_values.forEach(function (element) {
				var description;
				var key;
				if (element[".name"] === L.uci.resolveSID("dhcp", element[".name"])) {
					key = element[".index"];
					description = "dnsmasq[" + element[".index"] + "]";
				} else {
					key = element[".name"];
					description = element[".name"];
				}
				o.value(key, description);
			});
			o.depends("dnsmasq_config_update_option", "+");
			o.retain = true;
		}

		o = s.taboption(
			"service",
			form.ListValue,
			"force_dns",
			_("Force Router DNS"),
			_(
				"Forces Router DNS use on local devices, also known as DNS Hijacking. Only works on `lan` interface by default (%smore information%s)."
			).format(
				'<a href="' + pkg.URL + "#force_dns" + '" target="_blank">',
				"</a>"
			)
		);
		o.value("0", _("Let local devices use their own DNS servers if set"));
		o.value("1", _("Force Router DNS server to all local devices"));
		o.default = "1";

		o = s.taboption(
			"service",
			form.ListValue,
			"canary_domains_icloud",
			_("Canary Domains iCloud"),
			_(
				"Blocks access to iCloud Private Relay resolvers, forcing local devices to use router for DNS resolution (%smore information%s)."
			).format(
				'<a href="' + pkg.URL + "#canary_domains_icloud" + '" target="_blank">',
				"</a>"
			)
		);
		o.value("0", _("Let local devices use iCloud Private Relay"));
		o.value("1", _("Force Router DNS server to all local devices"));
		o.depends("force_dns", "1");
		o.default = "1";

		o = s.taboption(
			"service",
			form.ListValue,
			"canary_domains_mozilla",
			_("Canary Domains Mozilla"),
			_(
				"Blocks access to Mozilla Encrypted resolvers, forcing local devices to use router for DNS resolution (%smore information%s)."
			).format(
				'<a href="' +
				pkg.URL +
				"#canary_domains_mozilla" +
				'" target="_blank">',
				"</a>"
			)
		);
		o.value("0", _("Let local devices use Mozilla Private Relay"));
		o.value("1", _("Force Router DNS server to all local devices"));
		o.depends("force_dns", "1");
		o.default = "1";

		o = s.taboption(
			"service",
			form.Value,
			"heartbeat_domain",
			_("Heartbeat Domain"),
			_(
				"The domain used for connectivity checks (%smore information%s)."
			).format(
				'<a href="' + pkg.URL + "#heartbeat_domain" + '" target="_blank">',
				"</a>"
			)
		);
		o.optional = true;
		o.placeholder = "heartbeat.melmac.ca";

		o = s.taboption(
			"service",
			form.Value,
			"heartbeat_sleep_timeout",
			_("Heartbeat Sleep Timeout"),
			_("Time to wait before checking connectivity (seconds).")
		);
		o.datatype = "uinteger";
		o.optional = true;
		o.placeholder = "10";

		o = s.taboption(
			"service",
			form.Value,
			"heartbeat_wait_timeout",
			_("Heartbeat Wait Timeout"),
			_("Time to wait for connectivity check response (seconds).")
		);
		o.datatype = "uinteger";
		o.optional = true;
		o.placeholder = "30";

		o = s.taboption(
			"global",
			form.ListValue,
			"force_http1",
			_("Use HTTP/1")
		);
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use negotiated HTTP version"));
		o.value("1", _("Force use of HTTP/1"));
		o.default = "";

		o = s.taboption(
			"global",
			form.ListValue,
			"force_http3",
			_("Use HTTP/3 (QUIC)")
		);
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use negotiated HTTP version"));
		o.value("1", _("Force use of HTTP/3 (QUIC)"));
		o.default = "";
		o.depends("force_http1", "");

		o = s.taboption(
			"global",
			form.ListValue,
			"force_ipv6_resolvers",
			_("Use IPv6 resolvers")
		);
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use any family DNS resolvers"));
		o.value("1", _("Force use of IPv6 DNS resolvers"));
		o.default = "";

		o = s.taboption("global", form.ListValue, "verbosity", _("Logging Verbosity Level"));
		o.optional = true;
		o.value("", _("0: Fatal"));
		o.value("1", _("1: Error"));
		o.value("2", _("2: Warning"));
		o.value("3", _("3: Info"));
		o.value("4", _("4: Debug"));
		o.default = "";

		o = s.taboption("global", form.Value, "listen_addr", _("Listen Address"));
		o.datatype = "ipaddr('nomask')";
		o.optional = true;
		o.placeholder = "127.0.0.1";

		o = s.taboption("global", form.Value, "user", _("Run As User"));
		o.optional = true;
		o.placeholder = "nobody";

		o = s.taboption("global", form.Value, "group", _("Run As Group"));
		o.optional = true;
		o.placeholder = "nogroup";

		o = s.taboption("global", form.Value, "source_addr", _("Source Address"));
		o.datatype = "ipaddr('nomask')";
		o.optional = true;
		o.placeholder = "";

		o = s.taboption("global", form.Value, "logfile", _("Logging File Path"));
		o.datatype = "file";
		o.optional = true;
		o.placeholder = "";

		o = s.taboption("global", form.Value, "polling_interval", _("Polling Interval"));
		o.datatype = "range(5,3600)";
		o.optional = true;
		o.placeholder = "120";

		o = s.taboption("global", form.Value, "proxy_server", _("Proxy Server"));
		o.optional = true;

		o = s.taboption("global", form.Value, "ca_certs_file", _("CA Certs File"));
		o.datatype = "file";
		o.optional = true;

		o = s.taboption("global", form.Value, "conn_loss_time", _("Connection Loss Time"));
		o.datatype = "uinteger";
		o.optional = true;
		o.placeholder = "15";

		o = s.taboption("global", form.Value, "log_limit", _("Log Limit"));
		o.datatype = "uinteger";
		o.optional = true;
		o.placeholder = "0";

		o = s.taboption("global", form.Value, "max_idle_time", _("Max Idle Time"));
		o.datatype = "uinteger";
		o.optional = true;
		o.placeholder = "118";

		o = s.taboption("global", form.Value, "statistic_interval", _("Statistic Interval"));
		o.datatype = "uinteger";
		o.optional = true;
		o.placeholder = "0";

		o = s.taboption("global", form.Value, "tcp_client_limit", _("TCP Client Limit"));
		o.datatype = "uinteger";
		o.optional = true;
		o.placeholder = "20";

		text = "";
		if (!reply.platform.http2_support)
			text +=
				_(
					"Please note that %s is not supported on this system (%smore information%s)."
				).format(
					"<i>HTTP/2</i>",
					'<a href="' + pkg.URL + "#http2-support" + '" target="_blank">',
					"</a>"
				) + "<br />";
		if (!reply.platform.http3_support)
			text +=
				_(
					"Please note that %s is not supported on this system (%smore information%s)."
				).format(
					"<i>HTTP/3 (QUIC)</i>",
					'<a href="' + pkg.URL + "#http3-quic-support" + '" target="_blank">',
					"</a>"
				) + "<br />";

		s = m.section(
			form.GridSection,
			"https-dns-proxy",
			_("HTTPS DNS Proxy - Instances"),
			text
		);
		s.rowcolors = true;
		s.sortable = true;
		s.anonymous = true;
		s.addremove = true;

		s.sectiontitle = (section_id) => {
			var provText;
			var found;
			reply.providers.forEach((prov) => {
				var option;
				let regexp = pkg.templateToRegexp(prov.template);
				let resolver = L.uci.get(pkg.Name, section_id, "resolver_url");
				resolver = resolver === undefined ? null : resolver;
				if (!found && resolver && regexp.test(resolver)) {
					found = true;
					provText = _(prov.title);
					let match = resolver.match(regexp);
					if (match[1] != null) {
						if (
							prov.params &&
							prov.params.option &&
							prov.params.option.options
						) {
							prov.params.option.options.forEach((opt) => {
								if (opt.value === match[1]) {
									option = _(opt.description);
								}
							});
							provText += " (" + option + ")";
						} else {
							if (match[1] !== "") provText += " (" + match[1] + ")";
						}
					}
				}
			});
			return provText || _("Unknown");
		};

		var _provider;
		_provider = s.option(form.ListValue, "_provider", _("Provider"));
		_provider.modalonly = true;
		_provider.cfgvalue = function (section_id) {
			let resolver = this.map.data.get(
				this.map.config,
				section_id,
				"resolver_url"
			);
			if (resolver === undefined || resolver === null) return null;
			let found;
			let ret;
			reply.providers.forEach((prov, i) => {
				let regexp = pkg.templateToRegexp(prov.template);
				if (!found && regexp.test(resolver)) {
					found = true;
					ret = prov.template;
				}
			});
			return ret || "";
		};

		_provider.write = function (section_id, formvalue) {
			let providerTemplate = formvalue;
			let resolverUrl = providerTemplate;
			let bootstrapDns = "";
			let section = this.section;

			reply.providers.forEach((prov, i) => {
				if (prov.template === providerTemplate) {
					let paramValue = "";
					let paramWidgetOption = "";

					if (prov.params && prov.params.option) {
						if (prov.params.option.type === "select") {
							paramWidgetOption = "_paramList_" + i;
						} else if (prov.params.option.type === "text") {
							paramWidgetOption = "_paramText_" + i;
						}
					}

					if (paramWidgetOption) {
						// Find the widget object to get the value safely
						let widget = section.children.find(w => w.option === paramWidgetOption);
						if (widget) {
							paramValue = widget.formvalue(section_id) || "";
						}
					}

					resolverUrl = pkg.templateToResolver(providerTemplate, {
						option: paramValue
					});

					let bootWidget = section.children.find(w => w.option === "_bootstrap_dns_" + i);
					if (bootWidget) {
						bootstrapDns = bootWidget.formvalue(section_id);
					}

					// Fallback to default if empty
					if (!bootstrapDns) {
						bootstrapDns = prov.bootstrap_dns || "";
					}
				}
			});

			if (resolverUrl) {
				L.uci.set(pkg.Name, section_id, "resolver_url", resolverUrl);
			}

			if (bootstrapDns) {
				L.uci.set(pkg.Name, section_id, "bootstrap_dns", bootstrapDns);
			} else {
				L.uci.unset(pkg.Name, section_id, "bootstrap_dns");
			}
		};
		_provider.remove = function (section_id) {
			L.uci.unset(pkg.Name, section_id, "resolver_url");
			L.uci.unset(pkg.Name, section_id, "bootstrap_dns");
		};

		function createProviderWidget(s, i, prov) {
			if (
				prov.params &&
				prov.params.option &&
				prov.params.option.type
			) {
				if (prov.params.option.type === "select") {
					let optName = prov.params.option.description || _("Parameter");
					var _paramList = s.option(form.ListValue, "_paramList_" + i, optName);
					_paramList.template = prov.template;
					_paramList.modalonly = true;
					if (prov.params.option.default) {
						_paramList.default = prov.params.option.default;
					}
					prov.params.option.options.forEach((opt) => {
						let val = opt.value || "";
						let descr = opt.description || "";
						_paramList.value(val, descr);
					});
					_paramList.depends("_provider", prov.template);
					_paramList.write = function (section_id, formvalue) { };
					_paramList.remove = function (section_id, formvalue) { };
				} else if (prov.params.option.type === "text") {
					let optName = prov.params.option.description || _("Parameter");
					var _paramText = s.option(form.Value, "_paramText_" + i, optName);
					_paramText.template = prov.template;
					_paramText.modalonly = true;
					_paramText.depends("_provider", prov.template);
					_paramText.optional = !(
						prov.params.option.default && prov.params.option.default !== ""
					);
					_paramText.cfgvalue = function (section_id) {
						let resolver = this.map.data.get(
							this.map.config,
							section_id,
							"resolver_url"
						);
						if (resolver === undefined || resolver === null) return null;
						let regexp = pkg.templateToRegexp(prov.template);
						let match = resolver.match(regexp);
						return (match && match[1]) || null;
					};
					_paramText.write = function (section_id, formvalue) { };
					_paramText.remove = function (section_id, formvalue) { };
				}
			}
		}

		function createBootstrapWidget(s, i, prov) {
			const _boot_dns = s.option(
				form.Value,
				"_bootstrap_dns_" + i,
				_("Bootstrap DNS")
			);
			_boot_dns.template = prov.template;
			_boot_dns.modalonly = true;
			_boot_dns.depends("_provider", prov.template);
			_boot_dns.cfgvalue = function (section_id) {
				const c_value = this.map.data.get(
					this.map.config,
					section_id,
					"bootstrap_dns"
				);
				return c_value || prov.bootstrap_dns || "";
			};
			_boot_dns.write = function (section_id, formvalue) { };
			_boot_dns.remove = function (section_id, formvalue) { };
		}

		reply.providers.forEach((prov, i) => {
			if (prov.http2_only && !reply.platform.http2_support) return;
			if (prov.http3_only && !reply.platform.http3_support) return;
			_provider.value(prov.template, _(prov.title));
			createProviderWidget(s, i, prov);
			createBootstrapWidget(s, i, prov);
		});

		o = s.option(form.Value, "listen_addr", _("Listen Address"));
		o.datatype = "ipaddr('nomask')";
		o.optional = true;
		o.placeholder = "127.0.0.1";
		o.textvalue = function (section_id) {
			var value = this.cfgvalue(section_id);
			if (value) return value;
			var globalValue = this.map.data.get(this.map.config, "config", "listen_addr");
			return globalValue || this.placeholder || _("auto");
		};

		o = s.option(form.Value, "listen_port", _("Listen Port"));
		o.datatype = "port";
		o.optional = true;
		o.placeholder = "5053";
		o.textvalue = function (section_id) {
			var value = this.cfgvalue(section_id);
			return value || _("auto");
		};

		o = s.option(form.Value, "source_addr", _("Source (Bind To) Address"));
		o.datatype = "ipaddr('nomask')";
		o.optional = true;
		o.textvalue = function (section_id) {
			var value = this.cfgvalue(section_id);
			return value || _("*");
		};

		o = s.option(form.Value, "user", _("Run As User"));
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "nobody";

		o = s.option(form.Value, "group", _("Run As Group"));
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "nogroup";

		o = s.option(form.Value, "dscp_codepoint", _("DSCP Codepoint"));
		o.datatype = "range(0,63)";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.ListValue, "verbosity", _("Logging Verbosity Level"));
		o.modalonly = true;
		o.optional = true;
		o.value("", _("0: Fatal"));
		o.value("1", _("1: Error"));
		o.value("2", _("2: Warning"));
		o.value("3", _("3: Info"));
		o.value("4", _("4: Debug"));
		o.default = "";

		o = s.option(form.Value, "logfile", _("Logging File Path"));
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "polling_interval", _("Polling Interval"));
		o.datatype = "range(5,3600)";
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "120";

		o = s.option(form.Value, "proxy_server", _("Proxy Server"));
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "ca_certs_file", _("CA Certs File"));
		o.datatype = "file";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "conn_loss_time", _("Connection Loss Time"));
		o.datatype = "uinteger";
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "15";

		o = s.option(form.Value, "log_limit", _("Log Limit"));
		o.datatype = "uinteger";
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "0";

		o = s.option(form.Value, "max_idle_time", _("Max Idle Time"));
		o.datatype = "uinteger";
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "118";

		o = s.option(form.Value, "statistic_interval", _("Statistic Interval"));
		o.datatype = "uinteger";
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "0";

		o = s.option(form.Value, "tcp_client_limit", _("TCP Client Limit"));
		o.datatype = "uinteger";
		o.modalonly = true;
		o.optional = true;
		o.placeholder = "20";

		o = s.option(form.ListValue, "force_http1", _("Use HTTP/1"));
		o.modalonly = true;
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use negotiated HTTP version"));
		o.value("1", _("Force use of HTTP/1"));
		o.default = "";

		o = s.option(form.ListValue, "force_http3", _("Use HTTP/3 (QUIC)"));
		o.modalonly = true;
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use negotiated HTTP version"));
		o.value("1", _("Force use of HTTP/3 (QUIC)"));
		o.default = "";
		o.depends("force_http1", "");

		o = s.option(form.ListValue, "force_ipv6_resolvers", _("Use IPv6 resolvers"));
		o.modalonly = true;
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use any family DNS resolvers"));
		o.value("1", _("Force use of IPv6 DNS resolvers"));
		o.default = "";

		return Promise.all([status.render(), m.render()]);
	},
});
