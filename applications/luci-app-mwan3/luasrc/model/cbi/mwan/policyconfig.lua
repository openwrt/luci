-- ------ extra functions ------ --

function policyCheck() -- check to see if this policy's name exceed the maximum of 15 characters
	policyNameLength = string.len(arg[1])
	if policyNameLength > 15 then
		nameTooLong = 1
	end
end

function policyWarn() -- display status and warning messages at the top of the page
	if nameTooLong == 1 then
		return "<font color=\"ff0000\"><strong>WARNING: this policy's name is " .. policyNameLength .. " characters exceeding the maximum of 15!</strong></font>"
	else
		return ""
	end
end

function cbiAddMember(field)
	uci.cursor():foreach("mwan3", "member",
		function (section)
			field:value(section[".name"])
		end
	)
end

-- ------ policy configuration ------ --

dsp = require "luci.dispatcher"
arg[1] = arg[1] or ""

nameTooLong = 0
policyCheck()


m5 = Map("mwan3", translate("MWAN Policy Configuration - " .. arg[1]),
	translate(policyWarn()))
	m5.redirect = dsp.build_url("admin", "network", "mwan", "configuration", "policy")


mwan_policy = m5:section(NamedSection, arg[1], "policy", "")
	mwan_policy.addremove = false
	mwan_policy.dynamic = false


use_member = mwan_policy:option(DynamicList, "use_member", translate("Member used"))
	cbiAddMember(use_member)

last_resort = mwan_policy:option(ListValue, "last_resort", translate("Last resort"),
	translate("When all policy members are offline use this behavior for matched traffic"))
	last_resort.default = "unreachable"
	last_resort:value("unreachable", translate("unreachable (reject)"))
	last_resort:value("blackhole", translate("blackhole (drop)"))
	last_resort:value("default", translate("default (use main routing table)"))


-- ------ currently configured members ------ --

mwan_member = m5:section(TypedSection, "member", translate("Currently Configured Members"))
	mwan_member.addremove = false
	mwan_member.dynamic = false
	mwan_member.sortable = false
	mwan_member.template = "cbi/tblsection"


return m5
