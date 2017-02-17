-- ------ mwan configuration ------ --

ut = require "luci.util"

mwanConfig = "/etc/config/mwan3"


m5 = SimpleForm("luci", nil)
	m5:append(Template("mwan/advanced_mwanconfig")) -- highlight current tab


f = m5:section(SimpleSection, nil,
	translate("This section allows you to modify the contents of /etc/config/mwan3"))

t = f:option(TextValue, "lines")
	t.rmempty = true
	t.rows = 20

	function t.cfgvalue()
		return nixio.fs.readfile(mwanConfig) or ""
	end

	function t.write(self, section, data) -- format and write new data to script
		return nixio.fs.writefile(mwanConfig, "\n" .. ut.trim(data:gsub("\r\n", "\n")) .. "\n")
	end

	function f.handle(self, state, data)
		return true
	end


return m5
