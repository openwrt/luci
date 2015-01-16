-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

m = Map("freifunk", translate("Contact"), translate("Please fill in your contact details below."))

c = m:section(NamedSection, "contact", "public", "")

c:option(Value, "nickname", translate("Nickname"))
c:option(Value, "name", translate("Realname"))
c:option(DynamicList, "homepage", translate("Homepage"))
c:option(Value, "mail", translate("E-Mail"))
c:option(Value, "phone", translate("Phone"))
c:option(TextValue, "note", translate("Notice")).rows = 10

return m
