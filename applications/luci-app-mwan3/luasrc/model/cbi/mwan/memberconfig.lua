-- ------ extra functions ------ --

function cbi_add_interface(field)
	uci.cursor():foreach("mwan3", "interface",
		function (section)
			field:value(section[".name"])
		end
	)
end

-- ------ member configuration ------ --

dsp = require "luci.dispatcher"
arg[1] = arg[1] or ""


m5 = Map("mwan3", translate("MWAN Member Configuration - ") .. arg[1])
	m5.redirect = dsp.build_url("admin", "network", "mwan", "configuration", "member")


mwan_member = m5:section(NamedSection, arg[1], "member", "")
	mwan_member.addremove = false
	mwan_member.dynamic = false


interface = mwan_member:option(Value, "interface", translate("Interface"))
	cbi_add_interface(interface)

metric = mwan_member:option(Value, "metric", translate("Metric"),
	translate("Acceptable values: 1-1000. Defaults to 1 if not set"))
	metric.datatype = "range(1, 1000)"

weight = mwan_member:option(Value, "weight", translate("Weight"),
	translate("Acceptable values: 1-1000. Defaults to 1 if not set"))
	weight.datatype = "range(1, 1000)"


-- ------ currently configured interfaces ------ --

mwan_interface = m5:section(TypedSection, "interface", translate("Currently Configured Interfaces"))
	mwan_interface.addremove = false
	mwan_interface.dynamic = false
	mwan_interface.sortable = false
	mwan_interface.template = "cbi/tblsection"


return m5
