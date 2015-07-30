--[[
 adkill 配置页面
 Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
]]--

m = Map("adkill", translate("Ad-Killer"),
	translatef("A kernel module which can be configured to remove advertisements in some video sites.")
)

s = m:section(TypedSection, "adkill_base", translate("Basic Settings"))
s.anonymous = true
o = s:option(Flag, "enabled", translate("Enable Ad-Killer"))

s = m:section(TypedSection, "rule_404", translate("Rules - 404"), translate("The requests which match the rule will be blocked with \"404 Not Found\" error."))
s.anonymous = true
s.addremove = true
s.template = "cbi/tblsection"
s:option(Value, "host", translate("Host")).optional=false
s:option(Value, "url", translate("URL")).optional=false

s = m:section(TypedSection, "rule_502", translate("Rules - 502"), translate("The requests which match the rule will be blocked with \"502 Bad Gateway\" error."))
s.anonymous = true
s.addremove = true
s.template = "cbi/tblsection"
s:option(Value, "host", translate("Host")).optional=false
s:option(Value, "url", translate("URL")).optional=false

s = m:section(TypedSection, "rule_302", translate("Rules - 302"), translate("The requests which match the source URL will be redirected to the destination URL.This rule is usually used to replace the flash player on the website."))
s.anonymous = true
s.addremove = true
s.template = "cbi/tblsection"
s:option(Value, "shost", translate("Source Host")).optional=false
s:option(Value, "surl", translate("Source URL")).optional=false
s:option(Value, "dhost", translate("Destination Host")).optional=false
s:option(Value, "durl", translate("Destination URL")).optional=false

s = m:section(TypedSection, "rule_modify", translate("Rules - Modifying"), translate("A part of the request URL (after the Keyword) will be replaced with the Value."))
s.anonymous = true
s.addremove = true
s.template = "cbi/tblsection"
s:option(Value, "host", translate("Host")).optional=false
s:option(Value, "mark", translate("Keyword")).optional=false
s:option(Value, "val", translate("Value")).optional=false

return m
