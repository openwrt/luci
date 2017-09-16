-- Copyright 2016 Eric Luehrsen <ericluehrsen@hotmail.com>
-- Licensed to the public under the Apache License 2.0.

local filename = "/etc/unbound/unbound_ext.conf"
local m4, s4, frm

m4 = SimpleForm("editing", nil)
m4.submit = translate("Save")
m4.reset = false

s4 = m4:section(SimpleSection, "Unbound Extended Conf",
  translatef("This allows you to edit %s which is copied to"
  .. " /var/ and 'include:' last for 'forward:' and other clauses", filename))

frm = s4:option(TextValue, "data")
frm.datatype = "string"
frm.rows = 20


function frm.cfgvalue()
  return nixio.fs.readfile(filename) or ""
end


function frm.write(self, section, data)
  return nixio.fs.writefile(filename, data)
end


return m4

