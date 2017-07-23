-- Copyright 2017 Yousong Zhou <yszhou4tech@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local ss = require("luci.model.shadowsocks-libev")

local m, s, o

m = Map("shadowsocks-libev",
	translate("Redir Rules"),
	translate("On this page you can configure how traffics are to be \
		forwarded to ss-redir instances. \
		If enabled, packets will first have their source ip addresses checked \
		against <em>Src ip bypass</em>, <em>Src ip forward</em>, \
		<em>Src ip checkdst</em> and if none matches <em>Src default</em> \
		will give the default action to be taken. \
		If the prior check results in action <em>checkdst</em>, packets will continue \
		to have their destination addresses checked."))


s = m:section(NamedSection, "ss_rules", "ss-rules")
s:tab("general", translate("General Settings"))
s:tab("srcip", translate("Source Settings"))
s:tab("dstip", translate("Destination Settings"))

s:taboption('general', Flag, "disabled", translate("Disable"))
ss.option_install_package(s, 'general')

o = s:taboption('general', ListValue, "redir_tcp",
	translate("ss-redir for TCP"))
ss.values_redir(o, 'tcp')
o = s:taboption('general', ListValue, "redir_udp",
	translate("ss-redir for UDP"))
ss.values_redir(o, 'udp')

o = s:taboption('general', ListValue, "local_default",
	translate("Local-out default"),
	translate("Default action for locally generated packets"))
ss.values_actions(o)
s:taboption('general', Value, "ipt_args",
	translate("Extra arguments"),
	translate("Passes additional arguments to iptables. Use with care!"))

s:taboption('srcip', DynamicList, "src_ips_bypass",
	translate("Src ip bypass"),
	translate("Bypass redir action for packets with source addresses in this list"))
s:taboption('srcip', DynamicList, "src_ips_forward",
	translate("Src ip forward"),
	translate("Go through redir action for packets with source addresses in this list"))
s:taboption('srcip', DynamicList, "src_ips_checkdst",
	translate("Src ip checkdst"),
	translate("Continue to have dst address checked for packets with source addresses in this list"))
o = s:taboption('srcip', ListValue, "src_default",
	translate("Src default"),
	translate("Default action for packets whose source addresses do not match any of the source ip list"))
ss.values_actions(o)

s:taboption('dstip', DynamicList, "dst_ips_bypass",
	translate("Dst ip bypass"),
	translate("Bypass redir action for packets with destination addresses in this list"))
s:taboption('dstip', DynamicList, "dst_ips_forward",
	translate("Dst ip forward"),
	translate("Go through redir action for packets with destination addresses in this list"))

o = s:taboption('dstip', FileBrowser, "dst_ips_bypass_file",
	translate("Dst ip bypass file"),
	translate("File containing ip addresses for the purposes as with <em>Dst ip bypass</em>"))
o.datatype = "file"
s:taboption('dstip', FileBrowser, "dst_ips_forward_file",
	translate("Dst ip forward file"),
	translate("File containing ip addresses for the purposes as with <em>Dst ip forward</em>"))
o.datatype = "file"

return m
