// Copyright 2022 Stan Grishin <stangri@melmac.ca>
// This code wouldn't have been possible without help from [@vsviridov](https://github.com/vsviridov)

'use strict';
'require form';
'require rpc';
'require uci';
'require view';
'require pbr.status as pbr';

var pkg = {
	get Name() { return 'pbr'; },
	get URL() { return 'https://docs.openwrt.melmac.net/' + pkg.Name + '/'; }
};

return view.extend({
	load: function () {
		return Promise.all([
			uci.load(pkg.Name)
		]);
	},

	render: function () {
		return Promise.all([
			L.resolveDefault(pbr.getInterfaces(), {}),
			L.resolveDefault(pbr.getPlatformSupport(), {}),
		]).then(function (data) {
			var arrInterfaces;
			var replyPlatform;
			var status, m, s, o;

			if (data[0] && data[0][pkg.Name] && data[0][pkg.Name].interfaces) {
				arrInterfaces = data[0][pkg.Name].interfaces;
			}
			else {
				arrInterfaces = ["wan"];
			}

			if (data[1] && data[1][pkg.Name]) {
				replyPlatform = data[1][pkg.Name];
			}
			else {
				replyPlatform = {
					ipset_installed: null,
					nft_installed: null,
					adguardhome_installed: null,
					dnsmasq_installed: null,
					unbound_installed: null,
					adguardhome_ipset_support: null,
					dnsmasq_ipset_support: null,
					dnsmasq_nftset_support: null,
				};
			}

			status = new pbr.status();
			m = new form.Map(pkg.Name, _("Policy Based Routing - Configuration"));

			s = m.section(form.NamedSection, 'config', pkg.Name);
			s.tab("tab_basic", _("Basic Configuration"));
			s.tab("tab_advanced", _("Advanced Configuration"),
				_("%sWARNING:%s Please make sure to check the %sREADME%s before changing anything in this section! " +
					"Change any of the settings below with extreme caution!%s").format(
						"<br/>&#160;&#160;&#160;&#160;<b>", "</b>",
						"<a href=\"" + pkg.URL + "#service-configuration-settings \" target=\"_blank\">", "</a>", "<br/><br/>"));
			s.tab("tab_webui", _("Web UI Configuration"))

			o = s.taboption("tab_basic", form.ListValue, "verbosity", _("Output verbosity"),
				_("Controls both system log and console output verbosity."));
			o.value("0", _("Suppress/No output"));
			o.value("1", _("Condensed output"));
			o.value("2", _("Verbose output"));
			o.default = "2";

			o = s.taboption("tab_basic", form.ListValue, "strict_enforcement", _("Strict enforcement"),
				_("See the %sREADME%s for details.").format(
					"<a href=\"" + pkg.URL + "#strict-enforcement\" target=\"_blank\">", "</a>"));
			o.value("0", _("Do not enforce policies when their gateway is down"));
			o.value("1", _("Strictly enforce policies when their gateway is down"));
			o.default = "1";

			var text = "";
			if (replyPlatform.adguardhome_ipset_support === null) {
				text += _("The %s support is unknown.").format("<i>adguardhome.ipset</i>") + "<br />"
			}
			else if (!(replyPlatform.adguardhome_ipset_support)) {
				text += _("The %s is not supported on this system.").format("<i>adguardhome.ipset</i>") + "<br />"
			}
			if (replyPlatform.dnsmasq_ipset_support === null) {
				text += _("The %s support is unknown.").format("<i>dnsmasq.ipset</i>") + "<br />"
			}
			else if (!(replyPlatform.dnsmasq_ipset_support)) {
				text += _("The %s is not supported on this system.").format("<i>dnsmasq.ipset</i>") + "<br />"
			}
			if (replyPlatform.dnsmasq_nftset_support === null) {
				text += _("The %s support is unknown.").format("<i>dnsmasq.nftset</i>") + "<br />"
			}
			else if (!(replyPlatform.dnsmasq_nftset_support)) {
				text += _("The %s is not supported on this system.").format("<i>dnsmasq.nftset</i>") + "<br />"
			}
			text += _("Please check the %sREADME%s before changing this option.").format(
				"<a href=\"" + pkg.URL + "#use-resolvers-set-support\" target=\"_blank\">", "</a>");
			o = s.taboption("tab_basic", form.ListValue, "resolver_set", _("Use resolver set support for domains"), text);
			o.value("none", _("Disabled"));
			if (replyPlatform.adguardhome_ipset_support) {
				o.value("adguardhome.ipset", _("AdGuardHome ipset"));
				o.default = ("adguardhome.ipset", _("AdGuardHome ipset"));
			}
			if (replyPlatform.dnsmasq_ipset_support) {
				o.value("dnsmasq.ipset", _("Dnsmasq ipset"));
				o.default = ("dnsmasq.ipset", _("Dnsmasq ipset"));
			}
			if (replyPlatform.dnsmasq_nftset_support) {
				o.value("dnsmasq.nftset", _("Dnsmasq nft set"));
				o.default = ("dnsmasq.nftset", _("Dnsmasq nft set"));
			}

			o = s.taboption("tab_basic", form.ListValue, "ipv6_enabled", _("IPv6 Support"));
			o.value("0", _("Disabled"));
			o.value("1", _("Enabled"));

			o = s.taboption("tab_advanced", form.DynamicList, "supported_interface", _("Supported Interfaces"),
				_("Allows to specify the list of interface names (in lower case) to be explicitly supported by the service. " +
					"Can be useful if your OpenVPN tunnels have dev option other than tun* or tap*."));
			o.optional = false;

			o = s.taboption("tab_advanced", form.DynamicList, "ignored_interface", _("Ignored Interfaces"),
				_("Allows to specify the list of interface names (in lower case) to be ignored by the service. " +
					"Can be useful if running both VPN server and VPN client on the router."));
			o.optional = false;

			o = s.taboption("tab_advanced", form.ListValue, "rule_create_option", _("Rule Create option"),
				_("Select Add for -A/add and Insert for -I/Insert."));
			o.value("add", _("Add"));
			o.value("insert", _("Insert"));
			o.default = "add";

			o = s.taboption("tab_advanced", form.ListValue, "icmp_interface", _("Default ICMP Interface"),
				_("Force the ICMP protocol interface."));
			o.value("", _("No Change"));
			arrInterfaces.forEach(element => {
				if (element.toLowerCase() !== "ignore") {
					o.value(element);
				}
			});
			o.rmempty = true;

			o = s.taboption("tab_advanced", form.Value, "wan_tid", _("WAN Table ID"),
				_("Starting (WAN) Table ID number for tables created by the service."));
			o.rmempty = true;
			o.placeholder = "201";
			o.datatype = "and(uinteger, min(201))";

			o = s.taboption("tab_advanced", form.Value, "wan_mark", _("WAN Table FW Mark"),
				_("Starting (WAN) FW Mark for marks used by the service. High starting mark is " +
					"used to avoid conflict with SQM/QoS. Change with caution together with") +
				" " + _("Service FW Mask") + ".");
			o.rmempty = true;
			o.placeholder = "010000";
			o.datatype = "hexstring";

			o = s.taboption("tab_advanced", form.Value, "fw_mask", _("Service FW Mask"),
				_("FW Mask used by the service. High mask is used to avoid conflict with SQM/QoS. " +
					"Change with caution together with") + " " + _("WAN Table FW Mark") + ".");
			o.rmempty = true;
			o.placeholder = "ff0000";
			o.datatype = "hexstring";

			o = s.taboption("tab_webui", form.ListValue, "webui_show_ignore_target", _("Add Ignore Target"),
				_("Adds 'ignore' to the list of interfaces for policies. See the %sREADME%s for details.").format(
					"<a href=\"" + pkg.URL + "#ignore-target\" target=\"_blank\">", "</a>"));
			o.value("0", _("Disabled"))
			o.value("1", _("Enabled"))
			o.default = "0";
			o.optional = false;

			o = s.taboption("tab_webui", form.DynamicList, "webui_supported_protocol", _("Supported Protocols"),
				_("Display these protocols in protocol column in Web UI."));
			o.optional = false;

			s = m.section(form.GridSection, 'policy', _('Policies'),
				_("Name, interface and at least one other field are required. Multiple local and remote " +
					"addresses/devices/domains and ports can be space separated. Placeholders below represent just " +
					"the format/syntax and will not be used if fields are left blank."));
			s.rowcolors = true;
			s.sortable = true;
			s.anonymous = true;
			s.addremove = true;

			o = s.option(form.Flag, "enabled", _("Enabled"));
			o.default = "1";
			o.editable = true;

			o = s.option(form.Value, "name", _("Name"));

			o = s.option(form.Value, "src_addr", _("Local addresses / devices"));
			o.datatype = "list(neg(or(cidr,host,ipmask,ipaddr,macaddr,network)))";
			o.rmempty = true;
			o.default = "";

			o = s.option(form.Value, "src_port", _("Local ports"));
			o.datatype = "list(neg(or(portrange,port)))";
			o.placeholder = "0-65535";
			o.rmempty = true;
			o.default = "";

			o = s.option(form.Value, "dest_addr", _("Remote addresses / domains"));
			o.datatype = "list(neg(or(cidr,host,ipmask,ipaddr,macaddr,network)))";
			o.rmempty = true;
			o.default = "";

			o = s.option(form.Value, "dest_port", _("Remote ports"));
			o.datatype = "list(neg(or(portrange,port)))";
			o.placeholder = "0-65535";
			o.rmempty = true;
			o.default = "";

			o = s.option(form.ListValue, "proto", _("Protocol"));
			var proto = L.toArray(uci.get(pkg.Name, "config", "webui_supported_protocol"));
			if (!proto.length) {
				proto = ["all", "tcp", "udp", "tcp udp", "icmp"]
			}
			proto.forEach(element => {
				if (element === "all") {
					o.value("", _("all"));
					o.default = ("", _("all"));
				}
				else {
					o.value(element.toLowerCase());
				}
			});
			o.rmempty = true;

			o = s.option(form.ListValue, "chain", _("Chain"));
			o.value("", "prerouting");
			o.value("forward", "forward");
			o.value("input", "input");
			o.value("output", "output");
			o.value("postrouting", "postrouting");
			o.default = ("", "prerouting");
			o.rmempty = true;

			o = s.option(form.ListValue, "interface", _("Interface"));
			arrInterfaces.forEach(element => {
				o.value(element);
			});
			o.datatype = "network";
			o.rmempty = false;

			s = m.section(form.NamedSection, 'config', pkg.Name, _("DSCP Tagging"),
				_("Set DSCP tags (in range between 1 and 63) for specific interfaces. See the %sREADME%s for details.").format(
					"<a href=\"" + pkg.URL + "#dscp-tag-based-policies" + "\" target=\"_blank\">", "</a>"));
			arrInterfaces.forEach(element => {
				if (element.toLowerCase() !== "ignore") {
					o = s.option(form.Value, element + "_dscp", element.toUpperCase() + " " + _("DSCP Tag"));
					o.datatype = "and(uinteger, min(1), max(63))";
				}
			});

			s = m.section(form.GridSection, 'include', _("Custom User File Includes"),
				_("Run the following user files after setting up but before restarting DNSMASQ. " +
					"See the %sREADME%s for details.").format(
						"<a href=\"" + pkg.URL + "#custom-user-files\" target=\"_blank\">", "</a>"));
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

			return Promise.all([status.render(), m.render()]);
		})
	}
});
