-- Copyright 2016 Eric Luehrsen <ericluehrsen@hotmail.com>
-- Licensed to the public under the Apache License 2.0.

local filename = "/etc/unbound/unbound.conf"
local m2, s2, frm

m2 = SimpleForm("editing", nil)
m2.submit = translate("Save")
m2.reset = false

s2 = m2:section(SimpleSection, "Unbound Conf",
  translatef("This allows you to edit raw %s which is copied to"
  .. " /var/ for Unbound's base conf when you don't use UCI", filename))

frm = s2:option(TextValue, "data")
frm.datatype = "string"
frm.rows = 20


function frm.cfgvalue()
  return nixio.fs.readfile(filename) or ""
end


function frm.write(self, section, data)
  return nixio.fs.writefile(filename, data)
end


return m2

