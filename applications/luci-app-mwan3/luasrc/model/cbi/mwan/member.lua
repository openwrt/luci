-- Copyright 2014 Aedan Renner <chipdankly@gmail.com>
-- Copyright 2018 Florian Eckert <fe@dev.tdt.de>
-- Licensed to the public under the GNU General Public License v2.

local dsp = require "luci.dispatcher"

local m, s, o

m = Map("mwan3", translate("MWAN - Members"))

s = m:section(TypedSection, "member", nil,
	translate("Members are profiles attaching a metric and weight to an MWAN interface<br />" ..
	"Names may contain characters A-Z, a-z, 0-9, _ and no spaces<br />" ..
	"Members may not share the same name as configured interfaces, policies or rules"))
s.addremove = true
s.dynamic = false
s.sectionhead = translate("Member")
s.sortable = true
s.template = "cbi/tblsection"
s.extedit = dsp.build_url("admin", "network", "mwan", "member", "%s")
function s.create(self, section)
	TypedSection.create(self, section)
	m.uci:save("mwan3")
	luci.http.redirect(dsp.build_url("admin", "network", "mwan", "member", section))
end

o = s:option(DummyValue, "interface", translate("Interface"))
o.rawhtml = true
function o.cfgvalue(self, s)
	return self.map:get(s, "interface") or "&#8212;"
end

o = s:option(DummyValue, "metric", translate("Metric"))
o.rawhtml = true
function o.cfgvalue(self, s)
	return self.map:get(s, "metric") or "1"
end

o = s:option(DummyValue, "weight", translate("Weight"))
o.rawhtml = true
function o.cfgvalue(self, s)
	return self.map:get(s, "weight") or "1"
end

return m
