// Copyright 2023 MOSSDeF, Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from:
// - [@jow-](https://github.com/jow-)
// - [@stokito](https://github.com/stokito)
// - [@vsviridov](https://github.com/vsviridov)
// noinspection JSAnnotator

"use strict";
"require form";
"require rpc";
"require uci";
"require view";
"require https-dns-proxy.status as hdp";

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

	templateToResolver: function (template, args) {
		return template.replace(/{(\w+)}/g, (_, v) => args[v]);
	},
};

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(hdp.getPlatformSupport(pkg.Name), {}),
			L.resolveDefault(hdp.getProviders(pkg.Name), {}),
			uci.load(pkg.Name),
			uci.load("dhcp"),
		]);
	},

	render: function (data) {
		var reply = {
			platform: (data[0] && data[0][pkg.Name]) || {
				http2_support: null,
				http3_support: null,
			},
			providers: (data[1] && data[1][pkg.Name]) || { providers: [] },
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

		o = s.option(
			form.ListValue,
			"dnsmasq_config_update",
			_("Update DNSMASQ Config on Start/Stop"),
			_(
				"If update option is selected, the %s'DNS forwardings' section of DHCP and DNS%s will be automatically updated to use selected DoH providers (%smore information%s)."
			).format(
				'<a href="' + L.url("admin", "network", "dhcp") + '">',
				"</a>",
				'<a href="' + pkg.URL + "#default-settings" + '" target="_blank">',
				"</a>"
			)
		);
		o.value("*", _("Update all configs"));

		var sections = uci.sections("dhcp", "dnsmasq");
		sections.forEach((element) => {
			var description;
			var key;
			if (element[".name"] === uci.resolveSID("dhcp", element[".name"])) {
				key = element[".index"];
				description = "dnsmasq[" + element[".index"] + "]";
			} else {
				key = element[".name"];
				description = element[".name"];
			}
			o.value(key, _("Update %s only").format(description));
		});
		o.value("-", _("Do not update configs"));
		o.default = "*";

		o = s.option(
			form.ListValue,
			"force_dns",
			_("Force Router DNS"),
			_("Forces Router DNS use on local devices, also known as DNS Hijacking.")
		);
		o.value("0", _("Let local devices use their own DNS servers if set"));
		o.value("1", _("Force Router DNS server to all local devices"));
		o.default = "1";

		o = s.option(
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

		o = s.option(
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
				let resolver = uci.get(pkg.Name, section_id, "resolver_url");
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
			uci.set(pkg.Name, section_id, "resolver_url", formvalue);
		};

		reply.providers.forEach((prov, i) => {
			if (prov.http2_only && !reply.platform.http2_support) return;
			if (prov.http3_only && !reply.platform.http3_support) return;
			_provider.value(prov.template, _(prov.title));
			if (
				prov.params &&
				prov.params.option &&
				prov.params.option.type &&
				prov.params.option.type === "select"
			) {
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
				_paramList.write = function (section_id, formvalue) {
					let template = this.map.data.get(
						this.map.config,
						section_id,
						"resolver_url"
					);
					if (_paramList.template !== template) return 0;
					let resolver = pkg.templateToResolver(template, {
						option: formvalue || "",
					});
					uci.set(pkg.Name, section_id, "resolver_url", resolver);
				};
				_paramList.remove = _paramList.write;
			} else if (
				prov.params &&
				prov.params.option &&
				prov.params.option.type &&
				prov.params.option.type === "text"
			) {
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
				_paramText.write = function (section_id, formvalue) {
					let template = this.map.data.get(
						this.map.config,
						section_id,
						"resolver_url"
					);
					if (_paramText.template !== template) return 0;
					let resolver = pkg.templateToResolver(template, {
						option: formvalue || "",
					});
					uci.set(pkg.Name, section_id, "resolver_url", resolver);
				};
				_paramText.remove = _paramText.write;
			}
		});

		o = s.option(form.Value, "bootstrap_dns", _("Bootstrap DNS"));
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "listen_addr", _("Listen Address"));
		o.datatype = "ipaddr";
		o.default = "";
		o.optional = true;
		o.placeholder = "127.0.0.1";

		o = s.option(form.Value, "listen_port", _("Listen Port"));
		o.datatype = "port";
		o.default = "";
		o.optional = true;
		o.placeholder = "5053";

		o = s.option(form.Value, "user", _("Run As User"));
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "group", _("Run As Group"));
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "dscp_codepoint", _("DSCP Codepoint"));
		o.datatype = "and(uinteger, range(0,63))";
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "verbosity", _("Logging Verbosity"));
		o.datatype = "and(uinteger, range(0,4))";
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "logfile", _("Logging File Path"));
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "polling_interval", _("Polling Interval"));
		o.datatype = "and(uinteger, range(5,3600))";
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.Value, "proxy_server", _("Proxy Server"));
		o.default = "";
		o.modalonly = true;
		o.optional = true;

		o = s.option(form.ListValue, "use_http1", _("Use HTTP/1"));
		o.modalonly = true;
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use negotiated HTTP version"));
		o.value("1", _("Force use of HTTP/1"));
		o.default = "";

		o = s.option(
			form.ListValue,
			"use_ipv6_resolvers_only",
			_("Use IPv6 resolvers")
		);
		o.modalonly = true;
		o.optional = true;
		o.rmempty = true;
		o.value("", _("Use any family DNS resolvers"));
		o.value("1", _("Force use of IPv6 DNS resolvers"));
		o.default = "";

		return Promise.all([status.render(), m.render()]);
	},
});
