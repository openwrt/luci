// Copyright 2023 MOSSDeF, Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from:
// - [@stokito](https://github.com/stokito)
// - [@vsviridov](https://github.com/vsviridov)

"use strict";
"require form";
"require view";
"require ui";
"require adblock-fast.status as adb";
/* globals adb */

var pkg = adb.pkg;

return view.extend({
	// Helper function to parse cron entry into config values
	parseCronEntry: function (cronEntry) {
		var defaults = {
			auto_update_enabled: "0",
			auto_update_mode: "daily",
			auto_update_hour: "4",
			auto_update_minute: "0",
			auto_update_weekday: "0",
			auto_update_monthday: "1",
			auto_update_every_ndays: "3",
			auto_update_every_nhours: "6",
		};

		if (!cronEntry || cronEntry.trim() === "") {
			return defaults;
		}

		var commented = cronEntry.trim().startsWith("#");
		var parts = cronEntry.replace(/^#\s*/, "").trim().split(/\s+/);
		if (parts.length < 6) {
			return defaults;
		}

		var minute = parts[0];
		var hour = parts[1];
		var dom = parts[2];
		var month = parts[3];
		var dow = parts[4];

		var isNumber = function (val) {
			return /^[0-9]+$/.test(val);
		};
		var isStep = function (val) {
			return /^\*\/[0-9]+$/.test(val);
		};

		if (month !== "*" || !isNumber(minute)) {
			return defaults;
		}

		var config = Object.assign({}, defaults, {
			auto_update_enabled: commented ? "0" : "1",
			auto_update_minute: minute,
		});

		if (isStep(hour)) {
			if (dom !== "*" || dow !== "*") {
				return defaults;
			}
			config.auto_update_mode = "every_n_hours";
			config.auto_update_every_nhours = hour.split("/")[1];
			return config;
		}

		if (!isNumber(hour)) {
			return defaults;
		}

		if (isStep(dom)) {
			if (dow !== "*") {
				return defaults;
			}
			config.auto_update_mode = "every_n_days";
			config.auto_update_hour = hour;
			config.auto_update_every_ndays = dom.split("/")[1];
			return config;
		}

		if (dom !== "*") {
			if (!isNumber(dom) || dow !== "*") {
				return defaults;
			}
			config.auto_update_mode = "monthly";
			config.auto_update_hour = hour;
			config.auto_update_monthday = dom;
			return config;
		}

		if (dow !== "*") {
			if (!isNumber(dow)) {
				return defaults;
			}
			config.auto_update_mode = "weekly";
			config.auto_update_hour = hour;
			config.auto_update_weekday = dow;
			return config;
		}

		config.auto_update_mode = "daily";
		config.auto_update_hour = hour;
		return config;
	},

	// Helper function to generate cron entry from config values
	generateCronEntry: function (config) {
		if (config.auto_update_enabled !== "1") {
			return "";
		}

		var minute = config.auto_update_minute || "0";
		var hour,
			dom = "*",
			dow = "*";

		switch (config.auto_update_mode) {
			case "every_n_hours":
				hour = "*/" + (config.auto_update_every_nhours || "6");
				break;
			case "every_n_days":
				hour = config.auto_update_hour || "4";
				dom = "*/" + (config.auto_update_every_ndays || "3");
				break;
			case "monthly":
				hour = config.auto_update_hour || "4";
				dom = config.auto_update_monthday || "1";
				break;
			case "weekly":
				hour = config.auto_update_hour || "4";
				dow = config.auto_update_weekday || "0";
				break;
			default: // daily
				hour = config.auto_update_hour || "4";
				break;
		}

		return (
			minute +
			" " +
			hour +
			" " +
			dom +
			" * " +
			dow +
			" /etc/init.d/adblock-fast dl # adblock-fast-auto"
		);
	},

	load: function () {
		return Promise.all([
			L.resolveDefault(adb.getInitStatus(pkg.Name), {}),
			L.resolveDefault(adb.getCronStatus(pkg.Name), {}),
			L.resolveDefault(L.uci.load(pkg.Name), {}),
			L.resolveDefault(L.uci.load("dhcp"), {}),
			L.resolveDefault(L.uci.load("smartdns"), {}),
		]);
	},

	render: function (data) {
		var initData = (data[0] && data[0][pkg.Name]) || {};
		var reply = {
			sizes: initData.file_url || [],
			platform: initData.platform || {
				ipset_installed: false,
				nft_installed: false,
				dnsmasq_installed: false,
				dnsmasq_ipset_support: false,
				dnsmasq_nftset_support: false,
				smartdns_installed: false,
				smartdns_ipset_support: false,
				smartdns_nftset_support: false,
				unbound_installed: false,
				leds: [],
			},
			cronEntry:
				(data[1] && data[1][pkg.Name] && data[1][pkg.Name]["entry"]) || "",
			cronStatus: (data[1] && data[1][pkg.Name]) || {},
			pkg: (!pkg.isObjEmpty(data[2]) && data[2]) || null,
			dhcp: (!pkg.isObjEmpty(data[3]) && data[3]) || null,
			smartdns: (!pkg.isObjEmpty(data[4]) && data[4]) || null,
		};

		// Parse cron entry into virtual config values
		var cronConfig = this.parseCronEntry(reply.cronEntry);

		var status, m, s1, s2, s3, o;

		status = new adb.status();
		m = new form.Map(pkg.Name, _("AdBlock-Fast - Configuration"));
		this._map = m;

		s1 = m.section(form.NamedSection, "config", pkg.Name);
		s1.tab("tab_basic", _("Basic Configuration"));
		s1.tab("tab_schedule", _("List Updates Schedule"));
		s1.tab("tab_advanced", _("Advanced Configuration"));

		var text = _(
			"DNS resolution option, see the %sREADME%s for details.",
		).format(
			'<a href="' + pkg.URL + '#dns-resolver-option" target="_blank">',
			"</a>",
		);
		if (!reply.platform.dnsmasq_installed) {
			text +=
				"<br />" +
				_("Please note that %s is not supported on this system.").format(
					"<i>dnsmasq.addnhosts</i>",
				);
			text +=
				"<br />" +
				_("Please note that %s is not supported on this system.").format(
					"<i>dnsmasq.conf</i>",
				);
			text +=
				"<br />" +
				_("Please note that %s is not supported on this system.").format(
					"<i>dnsmasq.ipset</i>",
				);
			text +=
				"<br />" +
				_("Please note that %s is not supported on this system.").format(
					"<i>dnsmasq.servers</i>",
				);
		} else {
			if (!reply.platform.dnsmasq_ipset_support) {
				text +=
					"<br />" +
					_("Please note that %s is not supported on this system.").format(
						"<i>dnsmasq.ipset</i>",
					);
			}
			if (!reply.platform.dnsmasq_nftset_support) {
				text +=
					"<br />" +
					_("Please note that %s is not supported on this system.").format(
						"<i>dnsmasq.nftset</i>",
					);
			}
		}
		if (!reply.platform.smartdns_installed) {
			text =
				text +
				"<br />" +
				_("Please note that %s is not supported on this system.").format(
					"<i>smartdns.domainset</i>",
				);
		} else {
			if (!reply.platform.smartdns_ipset_support) {
				text +=
					"<br />" +
					_("Please note that %s is not supported on this system.").format(
						"<i>smartdns.ipset</i>",
					);
			}
			if (!reply.platform.smartdns_nftset_support) {
				text +=
					"<br />" +
					_("Please note that %s is not supported on this system.").format(
						"<i>smartdns.nftset</i>",
					);
			}
		}
		if (!reply.platform.unbound_installed) {
			text =
				text +
				"<br />" +
				_("Please note that %s is not supported on this system.").format(
					"<i>unbound.adb_list</i>",
				);
		}

		o = s1.taboption(
			"tab_basic",
			form.ListValue,
			"dns",
			_("DNS Service"),
			text,
		);
		if (reply.platform.dnsmasq_installed) {
			o.value("dnsmasq.addnhosts", _("dnsmasq additional hosts"));
			o.value("dnsmasq.conf", _("dnsmasq config"));
			if (reply.platform.dnsmasq_ipset_support) {
				o.value("dnsmasq.ipset", _("dnsmasq ipset"));
			}
			if (reply.platform.dnsmasq_nftset_support) {
				o.value("dnsmasq.nftset", _("dnsmasq nft set"));
			}
			o.value("dnsmasq.servers", _("dnsmasq servers file"));
		}
		if (reply.platform.smartdns_installed) {
			o.value("smartdns.domainset", _("smartdns domain set"));
			if (reply.platform.smartdns_ipset_support) {
				o.value("smartdns.ipset", _("smartdns ipset"));
			}
			if (reply.platform.smartdns_nftset_support) {
				o.value("smartdns.nftset", _("smartdns nft set"));
			}
		}
		if (reply.platform.unbound_installed) {
			o.value("unbound.adb_list", _("unbound adblock list"));
		}
		o.default = "dnsmasq.servers";

		o = s1.taboption(
			"tab_basic",
			form.Value,
			"dnsmasq_config_file_url",
			_("Dnsmasq Config File URL"),
			_(
				"URL to the external dnsmasq config file, see the %sREADME%s for details.",
			).format(
				'<a href="' + pkg.URL + '#dnsmasq_config_file_url" target="_blank">',
				"</a>",
			),
		);
		o.depends("dns", "dnsmasq.conf");

		if (reply.platform.dnsmasq_installed && reply.dhcp) {
			o = s1.taboption(
				"tab_basic",
				form.ListValue,
				"dnsmasq_instance_option",
				_("Use ad-blocking on the dnsmasq instance(s)"),
				_(
					"You can limit the ad-blocking to the specific dnsmasq instance(s) (%smore information%s).",
				).format(
					'<a href="' + pkg.URL + "#dnsmasq_instance" + '" target="_blank">',
					"</a>",
				),
			);
			o.value("*", _("Ad-blocking on all instances"));
			o.value("+", _("Ad-blocking on select instances"));
			o.value("-", _("No Ad-blocking on dnsmasq"));
			o.default = "*";
			o.depends("dns", "dnsmasq.addnhosts");
			o.depends("dns", "dnsmasq.servers");
			o.retain = true;
			o.cfgvalue = function (section_id) {
				let val = this.map.data.get(
					this.map.config,
					section_id,
					"dnsmasq_instance",
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
				if (formvalue !== "+") {
					L.uci.set(pkg.Name, section_id, "dnsmasq_instance", [formvalue]);
				}
			};

			o = s1.taboption(
				"tab_basic",
				form.MultiValue,
				"dnsmasq_instance",
				_("Pick the dnsmasq instance(s) for ad-blocking"),
			);
			Object.values(L.uci.sections("dhcp", "dnsmasq")).forEach(
				function (element) {
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
				},
			);
			o.depends("dnsmasq_instance_option", "+");
			o.retain = true;
		}

		if (reply.platform.smartdns_installed && reply.smartdns) {
			o = s1.taboption(
				"tab_basic",
				form.ListValue,
				"smartdns_instance_option",
				_("Use ad-blocking on the SmartDNS instance(s)"),
				_(
					"You can limit the ad-blocking to the specific SmartDNS instance(s) (%smore information%s).",
				).format(
					'<a href="' + pkg.URL + "#smartdns_instance" + '" target="_blank">',
					"</a>",
				),
			);
			o.value("*", _("Ad-blocking on all instances"));
			o.value("+", _("Ad-blocking on select instances"));
			o.value("-", _("No Ad-blocking on SmartDNS"));
			o.default = "*";
			o.depends("dns", "smartdns.domainset");
			o.retain = true;
			o.cfgvalue = function (section_id) {
				let val = this.map.data.get(
					this.map.config,
					section_id,
					"smartdns_instance",
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
				if (formvalue !== "+") {
					L.uci.set(pkg.Name, section_id, "smartdns_instance", [formvalue]);
				}
			};

			o = s1.taboption(
				"tab_basic",
				form.MultiValue,
				"smartdns_instance",
				_("Pick the SmartDNS instance(s) for ad-blocking"),
			);
			Object.values(L.uci.sections("smartdns", "smartdns")).forEach(
				function (element) {
					var description;
					var key;
					if (
						element[".name"] === L.uci.resolveSID("smartdns", element[".name"])
					) {
						key = element[".index"];
						description = "smartdns[" + element[".index"] + "]";
					} else {
						key = element[".name"];
						description = element[".name"];
					}
					o.value(key, description);
				},
			);
			o.depends("smartdns_instance_option", "+");
			o.retain = true;
		}
		o = s1.taboption(
			"tab_basic",
			form.ListValue,
			"force_dns",
			_("Force Router DNS"),
			_("Forces Router DNS use on local devices, also known as DNS Hijacking."),
		);
		o.value("0", _("Let local devices use their own DNS servers if set"));
		o.value("1", _("Force Router DNS server to all local devices"));
		o.default = "1";

		o = s1.taboption(
			"tab_basic",
			form.ListValue,
			"verbosity",
			_("Output Verbosity Setting"),
			_("Controls system log and console output verbosity."),
		);
		o.value("0", _("Suppress output"));
		o.value("1", _("Some output"));
		o.value("2", _("Verbose output"));
		o.default = "2";

		if (reply.platform.leds.length) {
			o = s1.taboption(
				"tab_basic",
				form.ListValue,
				"led",
				_("LED to indicate status"),
				_(
					"Pick the LED not already used in %sSystem LED Configuration%s.",
				).format('<a href="' + L.url("admin", "system", "leds") + '">', "</a>"),
			);
			o.value("", _("none"));
			reply.platform.leds.forEach((element) => {
				o.value(element);
			});
			o.rmempty = true;
		}

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_enabled",
			_("Automatic List Update"),
			_("Enable scheduled list redownloads via /etc/init.d/adblock-fast dl."),
		);
		o.value("0", _("Disable"));
		o.value("1", _("Enable"));
		o.default = "0";
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_enabled;
		};

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_mode",
			_("Schedule Type"),
		);
		o.description = _("Select how often the update should run.");
		o.value("daily", _("Daily"));
		o.value("weekly", _("Weekly"));
		o.value("monthly", _("Monthly"));
		o.value("every_n_days", _("Every N days"));
		o.value("every_n_hours", _("Every N hours"));
		o.default = "daily";
		o.depends("auto_update_enabled", "1");
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_mode;
		};

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_every_ndays",
			_("Every N days"),
			_("Run once every N days."),
		);
		for (let i = 1; i <= 31; i++) {
			o.value(String(i), String(i));
		}
		o.default = "3";
		o.depends({ auto_update_enabled: "1", auto_update_mode: "every_n_days" });
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_every_ndays;
		};

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_every_nhours",
			_("Every N hours"),
			_("Run once every N hours."),
		);
		for (let i = 1; i <= 23; i++) {
			o.value(String(i), String(i));
		}
		o.default = "6";
		o.depends({ auto_update_enabled: "1", auto_update_mode: "every_n_hours" });
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_every_nhours;
		};

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_weekday",
			_("Day of Week"),
			_("Run on the selected weekday."),
		);
		o.value("0", _("Sunday"));
		o.value("1", _("Monday"));
		o.value("2", _("Tuesday"));
		o.value("3", _("Wednesday"));
		o.value("4", _("Thursday"));
		o.value("5", _("Friday"));
		o.value("6", _("Saturday"));
		o.default = "0";
		o.depends({ auto_update_enabled: "1", auto_update_mode: "weekly" });
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_weekday;
		};

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_monthday",
			_("Day of Month"),
			_("Run on the selected day of month."),
		);
		for (let i = 1; i <= 31; i++) {
			o.value(String(i), String(i));
		}
		o.default = "1";
		o.depends({ auto_update_enabled: "1", auto_update_mode: "monthly" });
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_monthday;
		};

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_hour",
			_("Update Hour"),
			_("Hour of day to run the update (0-23)."),
		);
		for (let i = 0; i < 24; i++) {
			var hourLabel = i < 10 ? "0" + i : "" + i;
			o.value(String(i), hourLabel);
		}
		o.default = "4";
		o.depends({ auto_update_enabled: "1", auto_update_mode: "daily" });
		o.depends({ auto_update_enabled: "1", auto_update_mode: "weekly" });
		o.depends({ auto_update_enabled: "1", auto_update_mode: "monthly" });
		o.depends({ auto_update_enabled: "1", auto_update_mode: "every_n_days" });
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_hour;
		};

		o = s1.taboption(
			"tab_schedule",
			form.ListValue,
			"auto_update_minute",
			_("Update Minute"),
			_(
				"Minute of hour to run the update (0-59). In 'Every N hours' mode, updates run at the selected minute within each interval.",
			),
		);
		for (let i = 0; i < 60; i++) {
			var minuteLabel = i < 10 ? "0" + i : "" + i;
			o.value(String(i), minuteLabel);
		}
		o.default = "0";
		o.depends("auto_update_enabled", "1");
		// Override to use cron data instead of UCI
		o.cfgvalue = function (section_id) {
			return cronConfig.auto_update_minute;
		};

		o = s1.taboption(
			"tab_advanced",
			form.ListValue,
			"config_update_enabled",
			_("Automatic Config Update"),
			_("Perform config update before downloading the block/allow-lists."),
		);
		o.value("0", _("Disable"));
		o.value("1", _("Enable"));
		o.default = "0";

		o = s1.taboption(
			"tab_advanced",
			form.ListValue,
			"ipv6_enabled",
			_("IPv6 Support"),
			_("Add IPv6 entries to block-list."),
		);
		o.value("", _("Do not add IPv6 entries"));
		o.value("1", _("Add IPv6 entries"));
		o.depends("dns", "dnsmasq.addnhosts");
		o.depends("dns", "dnsmasq.nftset");
		o.default = "";
		o.rmempty = true;
		o.retain = true;

		o = s1.taboption(
			"tab_advanced",
			form.Value,
			"download_timeout",
			_("Download time-out (in seconds)"),
			_("Stop the download if it is stalled for set number of seconds."),
		);
		o.default = "20";
		o.datatype = "range(1,60)";

		o = s1.taboption(
			"tab_advanced",
			form.Value,
			"curl_max_file_size",
			_("Curl maximum file size (in bytes)"),
			_(
				"If curl is installed and detected, it would not download files bigger than this.",
			),
		);
		o.default = "";
		o.datatype = "uinteger";
		o.rmempty = true;

		o = s1.taboption(
			"tab_advanced",
			form.Value,
			"curl_retry",
			_("Curl download retry"),
			_(
				"If curl is installed and detected, it would retry download this many times on timeout/fail.",
			),
		);
		o.default = "3";
		o.datatype = "range(0,30)";

		o = s1.taboption(
			"tab_advanced",
			form.ListValue,
			"parallel_downloads",
			_("Simultaneous processing"),
			_(
				"Launch all lists downloads and processing simultaneously, reducing service start time.",
			),
		);
		o.value("0", _("Do not use simultaneous processing"));
		o.value("1", _("Use simultaneous processing"));
		o.default = "1";

		o = s1.taboption(
			"tab_advanced",
			form.ListValue,
			"compressed_cache",
			_("Store compressed cache file on router"),
			_(
				"Attempt to create a compressed cache of block-list in the persistent memory.",
			),
		);
		o.value("0", _("Do not store compressed cache"));
		o.value("1", _("Store compressed cache"));
		o.default = "0";

		o = s1.taboption(
			"tab_advanced",
			form.Value,
			"compressed_cache_dir",
			_("Directory for compressed cache file"),
			_(
				"Directory for compressed cache file of block-list in the persistent memory.",
			),
		);
		o.datatype = "string";
		o.rmempty = true;
		o.default = "/etc";
		o.depends("compressed_cache", "1");
		o.retain = true;

		o = s1.taboption(
			"tab_advanced",
			form.ListValue,
			"dnsmasq_sanity_check",
			_("Enable dnsmasq sanity check"),
			_(
				"Enable sanity check for dnsmasq block-list processing to detect and report issues.",
			),
		);
		o.value("0", _("Disable"));
		o.value("1", _("Enable"));
		o.default = "1";

		o = s1.taboption(
			"tab_advanced",
			form.ListValue,
			"dnsmasq_validity_check",
			_("Enable dnsmasq domain validation"),
			_(
				"Enable RFC 1123 compliant domain validation for dnsmasq block-lists to remove invalid entries.",
			),
		);
		o.value("0", _("Disable"));
		o.value("1", _("Enable"));
		o.default = "0";

		o = s1.taboption(
			"tab_advanced",
			form.ListValue,
			"debug",
			_("Enable Debugging"),
			_("Enables debug output to /tmp/adblock-fast.log."),
		);
		o.value("0", _("Disable Debugging"));
		o.value("1", _("Enable Debugging"));
		o.default = "0";

		s2 = m.section(
			form.NamedSection,
			"config",
			"adblock-fast",
			_("AdBlock-Fast - Allowed and Blocked Domains"),
		);
		o.addremove = true;
		o.rmempty = true;

		o = s2.option(
			form.DynamicList,
			"allowed_domain",
			_("Allowed Domains"),
			_("Individual domains to be allowed."),
		);
		o.addremove = true;

		o = s2.option(
			form.DynamicList,
			"blocked_domain",
			_("Blocked Domains"),
			_("Individual domains to be blocked."),
		);
		o.addremove = true;

		s3 = m.section(
			form.GridSection,
			"file_url",
			_("AdBlock-Fast - Allowed and Blocked Lists URLs"),
			_("URLs to file(s) containing lists to be allowed or blocked."),
		);
		s3.rowcolors = true;
		s3.sortable = true;
		s3.anonymous = true;
		s3.addremove = true;

		o = s3.option(form.DummyValue, "_size", _("Size"));
		o.modalonly = false;
		o.cfgvalue = function (section_id) {
			let url = L.uci.get(pkg.Name, section_id, "url");
			let ret = _("Unknown");
			reply.sizes.forEach((element) => {
				if (element.url === url) {
					ret = element.size === 0 ? ret : pkg.humanFileSize(element.size);
				}
			});
			return _("Size: %s").format(ret);
		};

		o = s3.option(form.Flag, "enabled", _("Enable"));
		o.editable = true;
		o.default = "1";

		o = s3.option(form.ListValue, "action", _("Action"));
		o.value("allow", _("Allow"));
		o.value("block", _("Block"));
		o.default = "block";
		o.textvalue = function (section_id) {
			var val = this.cfgvalue(section_id);
			return val == "allow" ? _("Allow") : _("Block");
		};

		o = s3.option(form.DummyValue, "_name", _("Name/URL"));
		o.modalonly = false;
		o.cfgvalue = function (section_id) {
			let name = L.uci.get(pkg.Name, section_id, "name");
			let url = L.uci.get(pkg.Name, section_id, "url");
			let ret = _("Unknown");
			return name ? name : url;
		};

		o = s3.option(form.Value, "name", _("Name"));
		o.modalonly = true;
		o.optional = true;

		o = s3.option(form.Value, "url", _("URL"));
		o.modalonly = true;
		o.optional = false;

		return Promise.all([status.render(), m.render()]);
	},

	handleSave: function (ev) {
		var map = this._map;
		if (!map) {
			return this.super("handleSave", [ev]);
		}

		// Collect virtual scheduling values
		var schedulingConfig = {};
		var schedulingFields = [
			"auto_update_enabled",
			"auto_update_mode",
			"auto_update_hour",
			"auto_update_minute",
			"auto_update_weekday",
			"auto_update_monthday",
			"auto_update_every_ndays",
			"auto_update_every_nhours",
		];

		schedulingFields.forEach(function (fieldName) {
			var match = map.lookupOption(fieldName, "config");
			if (match && match[0].isValid("config")) {
				schedulingConfig[fieldName] = match[0].formvalue("config");
			}
		});

		// Generate cron entry from config
		var cronEntry = this.generateCronEntry(schedulingConfig);

		// Save cron entry directly
		var savePromise = L.resolveDefault(adb.setCronEntry(pkg.Name, cronEntry), {
			result: false,
		}).then(function (result) {
			if (!result || result.result === false) {
				ui.addNotification(
					null,
					E("p", {}, _("Failed to update cron schedule.")),
				);
				return Promise.reject(new Error("Failed to update cron schedule"));
			}

			// Remove scheduling values from UCI before saving
			schedulingFields.forEach(function (fieldName) {
				var match = map.lookupOption(fieldName, "config");
				if (match) {
					match[0].remove("config");
				}
			});

			// Save the rest of UCI config
			return Promise.resolve();
		});

		return savePromise.then(() => {
			return this.super("handleSave", [ev]);
		});
	},

	handleSaveApply: function (ev, mode) {
		return this.handleSave(ev).then(function () {
			return ui.changes.apply(mode == "0");
		});
	},
});
