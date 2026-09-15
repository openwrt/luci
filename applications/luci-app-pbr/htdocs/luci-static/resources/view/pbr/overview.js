// Copyright 2022 Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from [@vsviridov](https://github.com/vsviridov)

"use strict";
"require form";
"require rpc";
"require view";
"require dom";
"require pbr.status as pbr";
/* global pbr */

var pkg = pbr.pkg;

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(pbr.getInitStatus(pkg.Name), {}),
			L.resolveDefault(L.uci.load(pkg.Name), {}),
		]);
	},

	render: function (data) {
		var status, m, s, o;
		var statusData = (data[0] && data[0][pkg.Name]) || {};
		var reply = {
			interfaces: statusData.interfaces || ["wan"],
			interface_labels: statusData.interface_labels || {},
			protocols: statusData.protocols || [],
			platform: statusData.platform || {
				nft_installed: false,
				adguardhome_installed: false,
				dnsmasq_installed: false,
				unbound_installed: false,
				dnsmasq_nftset_support: false,
			},
		};

		status = new pbr.status();
		m = new form.Map(pkg.Name, _("Policy Based Routing - Configuration"));

		s = m.section(form.NamedSection, "config", pkg.Name);
		s.tab("tab_basic", _("Basic Configuration"));
		s.tab(
			"tab_advanced",
			_("Advanced Configuration"),
			_(
				"%sWARNING:%s Please make sure to check the %sREADME%s before changing anything in this section! " +
					"Change any of the settings below with extreme caution!%s"
			).format(
				"<br/>&#160;&#160;&#160;&#160;<b>",
				"</b>",
				'<a href="' +
					pkg.URL +
					'#service-configuration-settings" target="_blank">',
				"</a>",
				"<br/><br/>"
			)
		);

		o = s.taboption(
			"tab_basic",
			form.ListValue,
			"verbosity",
			_("Output verbosity"),
			_("Controls both system log and console output verbosity.")
		);
		o.value("0", _("Suppress/No output"));
		o.value("1", _("Condensed output"));
		o.value("2", _("Verbose output"));
		o.default = "2";

		o = s.taboption(
			"tab_basic",
			form.ListValue,
			"strict_enforcement",
			_("Strict enforcement"),
			_("See the %sREADME%s for details.").format(
				'<a href="' + pkg.URL + '#strict-enforcement" target="_blank">',
				"</a>"
			)
		);
		o.value("0", _("Do not enforce policies when their gateway is down"));
		o.value("1", _("Strictly enforce policies when their gateway is down"));
		o.default = "1";

		var text = "";
		if (reply.platform.dnsmasq_nftset_support === null) {
			text +=
				_("The %s support is unknown.").format("<i>dnsmasq.nftset</i>") +
				"<br />";
		} else if (!reply.platform.dnsmasq_nftset_support) {
			text +=
				_("The %s is not supported on this system.").format(
					"<i>dnsmasq.nftset</i>"
				) + "<br />";
		}
		text += _(
			"Please check the %sREADME%s before changing this option."
		).format(
			'<a href="' + pkg.URL + '#use-resolvers-set-support" target="_blank">',
			"</a>"
		);

		o = s.taboption(
			"tab_basic",
			form.ListValue,
			"resolver_set",
			_("Use resolver set support for domains"),
			text
		);
		o.value("none", _("Disabled"));
		o.default = "none";
		if (reply.platform.dnsmasq_nftset_support) {
			o.value("dnsmasq.nftset", _("Dnsmasq nft set"));
			o.default = "dnsmasq.nftset";
		} else if (
			L.uci.get(pkg.Name, "config", "resolver_set") === "dnsmasq.nftset"
		) {
			// Support detection can fail transiently, for instance when dnsmasq
			// is not installed or not yet running. Without the stored value in
			// the choice list the select falls back to its first entry and
			// saving would silently rewrite resolver_set to "none". The
			// description above already states that support is missing.
			o.value("dnsmasq.nftset", _("Dnsmasq nft set"));
		}
		// luci-base 974b5864e05e removes options whose value equals their
		// default. pbr provisions resolver_set in /etc/config/pbr and in
		// uci-defaults, so without this the stored dnsmasq.nftset would be
		// deleted on the first Save and nft set handling silently disabled.
		o.rmempty = false;

		o = s.taboption(
			"tab_basic",
			form.ListValue,
			"ipv6_enabled",
			_("IPv6 Support")
		);
		o.value("0", _("Disabled"));
		o.value("1", _("Enabled"));

		o = s.taboption(
			"tab_advanced",
			form.DynamicList,
			"supported_interface",
			_("Supported Interfaces"),
			_(
				"Allows to specify the list of interface names to be explicitly supported by the service. " +
					"Can be useful if your OpenVPN tunnels have dev option other than tun* or tap* or specific use cases " +
					"of WireGuard servers. See the %sREADME%s for details."
			).format(
				'<a href="' + pkg.URL + '#wireguard-server-use-cases" target="_blank">',
				"</a>"
			)
		);
		o.optional = false;

		o = s.taboption(
			"tab_advanced",
			form.DynamicList,
			"ignored_interface",
			_("Ignored Interfaces"),
			_(
				"Allows to specify the list of interface names to be ignored by the service. " +
					"Can be useful for an OpenVPN server running on OpenWrt device. WireGuard servers, which " +
					"have a listen_port defined, are handled automatically, do not add those here." +
					"See the %sREADME%s for details."
			).format(
				'<a href="' + pkg.URL + '#wireguard-server-use-cases" target="_blank">',
				"</a>"
			)
		);
		o.optional = false;

		o = s.taboption(
			"tab_advanced",
			form.ListValue,
			"rule_create_option",
			_("Rule Create option"),
			_("Select Add for -A/add and Insert for -I/Insert.")
		);
		o.value("add", _("Add"));
		o.value("insert", _("Insert"));
		o.default = "add";

		o = s.taboption(
			"tab_advanced",
			form.ListValue,
			"icmp_interface",
			_("Default ICMP Interface"),
			_("Force the ICMP protocol interface.")
		);
		o.value("", _("No Change"));
		reply.interfaces.forEach((element) => {
			if (element.toLowerCase() !== "ignore") {
				o.value(element, reply.interface_labels[element] || element);
			}
		});
		o.rmempty = true;

		o = s.taboption(
			"tab_advanced",
			form.Value,
			"uplink_interface",
			_("Default Uplink Interface (IPv4)"),
			_("Force the default IPv4 uplink interface used by the service. " +
				"Select from the list of known interfaces or enter a custom interface name.")
		);
		if (Array.isArray(reply.interfaces)) {
			reply.interfaces.forEach((element) => {
				if (element.toLowerCase() !== "ignore") {
					o.value(element, reply.interface_labels[element] || element);
				}
			});
		}
		o.datatype = "network";
		o.default = "wan";
		// Keeps the default visible in /etc/config/pbr. luci-base 974b5864e05e
		// removes values equal to the default and made forcewrite unreachable
		// in exactly that case, so rmempty is what forces the write now.
		o.rmempty = false;

		o = s.taboption(
			"tab_advanced",
			form.Value,
			"uplink_interface6",
			_("Default Uplink Interface (IPv6)"),
			_("Force the default IPv6 uplink interface used by the service. " +
				"Select from the list of known interfaces or enter a custom interface name.")
		);
		if (Array.isArray(reply.interfaces)) {
			reply.interfaces.forEach((element) => {
				if (element.toLowerCase() !== "ignore") {
					o.value(element, reply.interface_labels[element] || element);
				}
			});
		}
		o.datatype = "network";
		o.default = "wan6";
		// See uplink_interface above.
		o.rmempty = false;
		o.depends("ipv6_enabled", "1");

		o = s.taboption(
			"tab_advanced",
			form.Value,
			"uplink_mark",
			_("Uplink Interface Table FW Mark"),
			_(
				"Starting (Uplink Interface) FW Mark for marks used by the service. High starting mark is " +
					"used to avoid conflict with SQM/QoS. Change with caution together with"
			) +
				" " +
				_("Service FW Mask") +
				"."
		);
		o.rmempty = true;
		o.placeholder = "010000";
		o.datatype = "hexstring";

		o = s.taboption(
			"tab_advanced",
			form.Value,
			"fw_mask",
			_("Service FW Mask"),
			_(
				"FW Mask used by the service. High mask is used to avoid conflict with SQM/QoS. " +
					"Change with caution together with"
			) +
				" " +
				_("WAN Table FW Mark") +
				"."
		);
		o.rmempty = true;
		o.placeholder = "ff0000";
		o.datatype = "hexstring";

		o = s.taboption(
			"tab_advanced",
			form.Value,
			"uplink_ip_rules_priority",
			_("Uplink IP Rules Priority"),
			_(
				"Starting (Uplink/WAN) ip rules priority used by the pbr service. High starting priority is " +
					"used to avoid conflict with other services, this can be changed by user."
			)
		);
		o.rmempty = true;
		o.placeholder = "30000";
		o.datatype = "range(99,32765)";
		o.default = "30000";

		s = m.section(
			form.GridSection,
			"policy",
			_("Policies"),
			_(
				"Name, interface and at least one other field are required. Multiple local and remote " +
					"addresses/devices/domains and ports can be space separated. Placeholders below represent just " +
					"the format/syntax and will not be used if fields are left blank. For more information on options, check the %sREADME%s."
			).format(
				'<a href="' + pkg.URL + '#policy-options" target="_blank">',
				"</a>"
			)
		);
		s.rowcolors = true;
		s.sortable = true;
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, "enabled", _("Enabled"));
		o.default = "1";
		o.editable = true;

		o = s.option(form.Value, "name", _("Name"));

		o = s.option(form.Value, "src_addr", _("Local addresses / devices"));
		o.datatype =
			"list(neg(or(cidr,host,ipmask,ipaddr,macaddr,network,string)))";
		o.rmempty = true;
		o.default = "";

		o = s.option(form.Value, "src_port", _("Local ports"));
		o.datatype = "list(neg(or(portrange,port)))";
		o.placeholder = "0-65535";
		o.rmempty = true;
		o.default = "";

		o = s.option(form.Value, "dest_addr", _("Remote addresses / domains"));
		o.datatype =
			"list(neg(or(cidr,host,ipmask,ipaddr,macaddr,network,string)))";
		o.rmempty = true;
		o.default = "";

		o = s.option(form.Value, "dest_port", _("Remote ports"));
		o.datatype = "list(neg(or(portrange,port)))";
		o.placeholder = "0-65535";
		o.rmempty = true;
		o.default = "";

		o = s.option(form.ListValue, "proto", _("Protocol"));
		o.value("", _("all"));
		o.default = "";
		// 'proto' only ever reaches a rule as a prefix on sport/dport, so a
		// protocol that cannot carry a port cannot work here: with a port it
		// emits e.g. 'icmp dport { 53 }', which nft refuses -- rejecting the
		// whole ruleset -- and without one it is dropped and the policy matches
		// every protocol. reply.protocols is built from /etc/protocols, so most
		// of what it lists is unusable; offer only what nft can actually match.
		// To route ICMP use "Default ICMP Interface" on the Advanced tab.
		var portCapable = ["tcp", "udp", "sctp", "dccp", "udplite"];
		var usableProtos = reply.protocols.filter(function (p) {
			return portCapable.indexOf(p) !== -1;
		});
		// "tcp udp" is a composite value, not a protocol: pbr splits proto on
		// whitespace and emits one rule per token, and it is by far the most
		// common pairing, so it stays as a single convenient choice.
		var popularProtos = ["tcp", "udp", "tcp udp"];
		// Every value actually offered, so the fallback below can tell whether a
		// configured value is still in the list. Added in the same place as
		// o.value() so the two cannot drift apart.
		var offered = [""];
		function offer(p, label) {
			if (offered.indexOf(p) !== -1) return false;
			label ? o.value(p, label) : o.value(p);
			offered.push(p);
			return true;
		}
		var hasPopular = false;
		popularProtos.forEach(function (p) {
			if (p === "tcp udp") {
				if (usableProtos.indexOf("tcp") !== -1 && usableProtos.indexOf("udp") !== -1) {
					if (offer(p)) hasPopular = true;
				}
			} else if (usableProtos.indexOf(p) !== -1) {
				if (offer(p)) hasPopular = true;
			}
		});
		var hasOther = false;
		usableProtos.forEach(function (p) {
			if (popularProtos.indexOf(p) === -1) {
				if (offer(p)) hasOther = true;
			}
		});
		// Keep whatever an existing config already holds, even though it is no
		// longer offered -- otherwise opening this page silently rewrites the
		// policy to 'all' on the next save, changing what it matches.
		L.uci.sections(pkg.Name, "policy", function (sec) {
			var cur = sec.proto;
			if (cur) offer(cur, cur + " " + _("(unsupported)"));
		});
		o.rmempty = true;
		if (hasPopular && hasOther) {
			var _protoRenderWidget = o.renderWidget;
			o.renderWidget = function () {
				var node = _protoRenderWidget.apply(this, arguments);
				var sel = node.querySelector ? node.querySelector("select") : null;
				if (!sel && node.nodeName === "SELECT") sel = node;
				if (sel) {
					var lastOpt = null;
					sel.querySelectorAll("option").forEach(function (opt) {
						if (popularProtos.indexOf(opt.value) !== -1)
							lastOpt = opt;
					});
					if (lastOpt && lastOpt.nextElementSibling) {
						sel.insertBefore(
							E("option", { "disabled": "", "style": "text-align:center" },
								"── " + _("All Protocols") + " ──"),
							lastOpt.nextSibling
						);
					}
				}
				var ul = node.querySelector ? node.querySelector("ul") : null;
				if (ul) {
					var lastLi = null;
					ul.querySelectorAll("li[data-value]").forEach(function (li) {
						if (popularProtos.indexOf(li.getAttribute("data-value")) !== -1)
							lastLi = li;
					});
					if (lastLi && lastLi.nextElementSibling) {
						lastLi.parentNode.insertBefore(
							E("li", {
								"unselectable": "",
								"style": "text-align:center;opacity:0.6;font-size:90%"
							}, "── " + _("All Protocols") + " ──"),
							lastLi.nextSibling
						);
					}
				}
				return node;
			};
		}

		o = s.option(form.ListValue, "chain", _("Chain"));
		o.value("", "prerouting");
		o.value("forward", "forward");
		o.value("output", "output");
		o.default = "";
		o.rmempty = true;

		o = s.option(form.ListValue, "interface", _("Interface"));
		reply.interfaces.forEach((element) => {
			o.value(element, reply.interface_labels[element] || element);
		});
		o.datatype = "network";
		o.rmempty = false;

		s = m.section(
			form.GridSection,
			"dns_policy",
			_("DNS Policies"),
			_(
				"Name, local address and remote DNS fields are required. Multiple local " +
					"addresses/devices can be space separated. For more information on options, check the %sREADME%s."
			).format(
				'<a href="' + pkg.URL + '#dns-policy-options" target="_blank">',
				"</a>"
			)
		);
		s.rowcolors = true;
		s.sortable = true;
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, "enabled", _("Enabled"));
		o.default = "1";
		o.editable = true;

		o = s.option(form.Value, "name", _("Name"));
		o.optional = false;

		o = s.option(form.Value, "src_addr", _("Local addresses / devices"));
		o.optional = false;
		o.datatype =
			"list(neg(or(cidr,host,ipmask,ipaddr,macaddr,network,string)))";
		o.rmempty = true;
		o.default = "";

		o = s.option(form.Value, "dest_dns", _("Remote DNS"));
		o.optional = false;
		o.rmempty = false;
		o.datatype = "list(or(cidr,host,network,ipaddr))";
		reply.interfaces.forEach((element) => {
			element === "ignore" || o.value(element, reply.interface_labels[element] || element);
		});

		o = s.option(form.Value, "dest_dns_port", _("Remote DNS Port"));
		o.optional = true;
		o.rmempty = true;
		o.datatype = "port";
		o.default = "53";

		s = m.section(
			form.NamedSection,
			"config",
			pkg.Name,
			_("DSCP Tagging"),
			_(
				"Set DSCP tags (in range between 1 and 63) for specific interfaces. See the %sREADME%s for details."
			).format(
				'<a href="' + pkg.URL + "#dscp-tag-based-policies" + '" target="_blank">',
				"</a>"
			)
		);
		reply.interfaces.forEach((element) => {
			if (element.toLowerCase() !== "ignore") {
				o = s.option(
					form.Value,
					element + "_dscp",
					element.toUpperCase() + " " + _("DSCP Tag")
				);
				o.datatype = "and(uinteger, min(1), max(63))";
			}
		});

		s = m.section(
			form.GridSection,
			"include",
			_("Custom User File Includes"),
			_(
				"Run the following user files after setting up but before restarting DNSMASQ. " +
					"See the %sREADME%s for details."
			).format(
				'<a href="' + pkg.URL + '#custom-user-files" target="_blank">',
				"</a>"
			)
		);
		s.sortable = true;
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, "enabled", _("Enabled"));
		o.optional = false;
		o.editable = true;
		o.rmempty = false;

		o = s.option(form.Value, "path", _("Path"));
		o.optional = false;
		o.editable = true;
		o.rmempty = false;

		return Promise.all([status.render(), m.render()]).then(function (nodes) {
			var statusNode = nodes[0];

			// Saving settings fires pbr's procd config.change trigger, which
			// reloads the service asynchronously. LuCI reloads the page once the
			// apply completes, so getInitStatus() often lands mid-reload and
			// reports state that is already out of date -- and nothing ever
			// re-checks it. Nothing in this app registers a poll, so whatever is
			// on screen after that first fetch stays there until the user
			// refreshes by hand.
			//
			// Two ways that shows up. A service caught mid-restart reads as
			// stopped and stays "Stopped". And -- since r97 reports a policy's
			// 'proto' and rejects an unusable chain -- a warning the user has
			// just corrected stays on screen, because the reload never makes the
			// service look stopped, so the old check (enabled && !running) never
			// armed for it.
			//
			// So arm whenever there is something that could still change: the
			// service is not running yet, or the status carries messages that a
			// reload may be about to revise.
			//
			// This deliberately uses setTimeout rather than LuCI's poll module
			// (same approach as pollServiceStatus() in pbr/status.js): a
			// registered poll drives LuCI's global auto-refresh indicator, which
			// would sit at "Paused" once we unregistered, as if the page had
			// stalled.
			var hasMessages = function (reply) {
				return (
					((reply.errors || []).length > 0) ||
					((reply.warnings || []).length > 0)
				);
			};

			// Everything the status box shows that a config change can alter.
			// Comparing it across ticks lets us stop as soon as the service has
			// settled, instead of guessing how long a reload takes -- a large
			// config can take the better part of a minute.
			var stateSignature = function (reply) {
				// Sorted, so a reload that reports the same messages in a
				// different order counts as settled instead of flip-flopping
				// until the attempt limit. The order pbr emits them in follows
				// its policy processing and is not something the panel depends
				// on.
				var codes = function (list) {
					return (list || [])
						.map(function (m) {
							return m.code + "\u0000" + m.info;
						})
						.sort();
				};
				return JSON.stringify([
					!!reply.running,
					!!reply.enabled,
					codes(reply.errors),
					codes(reply.warnings),
				]);
			};

			if (statusData.enabled && (!statusData.running || hasMessages(statusData))) {
				var attempts = 0;
				var maxAttempts = 22; // give up after ~90s
				var initialSig = stateSignature(statusData);
				var lastSig = initialSig;

				// Check quickly at first, since a reload normally completes
				// within a few seconds, then ease off so that a slow restart
				// doesn't hammer an RPC this expensive -- and doesn't compete
				// for CPU with the very reload we're waiting on.
				var delayFor = function (done) {
					if (done < 4) return 1500;
					if (done < 8) return 3000;
					return 5000;
				};

				// Re-render only once the state settles, so the service control
				// buttons inside the status box aren't torn out from under the
				// user on every tick.
				var refreshStatus = function () {
					return status.render().then(function (freshNode) {
						if (statusNode.isConnected === false) return;
						dom.content(
							statusNode,
							Array.prototype.slice.call(freshNode.childNodes)
						);
					});
				};

				var checkStatus = function () {
					// Stop if the user has navigated away: LuCI replaces the
					// view but pending timers keep running, and getInitStatus()
					// is expensive enough that polling a page nobody is looking
					// at is worth avoiding. Written as `=== false` so a browser
					// without isConnected simply behaves as before.
					if (statusNode.isConnected === false) return;

					attempts++;
					L.resolveDefault(pbr.getInitStatus(pkg.Name), {})
						.then(function (res) {
							var reply = (res && res[pkg.Name]) || {};
							var sig = stateSignature(reply);

							// Settled once two consecutive reads agree, or we
							// have waited long enough.
							if (sig === lastSig || attempts >= maxAttempts) {
								// Only redraw if what is on screen is actually
								// out of date. A service sitting on a permanent
								// warning therefore costs one extra RPC per page
								// load and no redraw at all.
								if (sig !== initialSig) return refreshStatus();
								return;
							}

							lastSig = sig;
							setTimeout(checkStatus, delayFor(attempts));
						})
						.catch(function () {
							if (attempts < maxAttempts)
								setTimeout(checkStatus, delayFor(attempts));
						});
				};

				setTimeout(checkStatus, delayFor(0));
			}

			return nodes;
		});
	},
});
