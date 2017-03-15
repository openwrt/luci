-- ------ hotplug script configuration ------ --

fs = require "nixio.fs"
sys = require "luci.sys"
ut = require "luci.util"

script = "/etc/hotplug.d/iface/16-mwancustom"
scriptBackup = "/etc/hotplug.d/iface/16-mwancustombak"

if luci.http.formvalue("cbid.luci.1._restorebak") then -- restore button has been clicked
	luci.http.redirect(luci.dispatcher.build_url("admin/network/mwan/advanced/hotplugscript") .. "?restore=yes")
elseif luci.http.formvalue("restore") == "yes" then -- restore script from backup
	os.execute("cp -f " .. scriptBackup .. " " .. script)
end


m5 = SimpleForm("luci", nil)
	m5:append(Template("mwan/advanced_hotplugscript")) -- highlight current tab

f = m5:section(SimpleSection, nil,
	translate("This section allows you to modify the contents of /etc/hotplug.d/iface/16-mwancustom<br />" ..
	"This is useful for running system commands and/or scripts based on interface ifup or ifdown hotplug events<br /><br />" ..
	"Notes:<br />" ..
	"The first line of the script must be &#34;#!/bin/sh&#34; without quotes<br />" ..
	"Lines beginning with # are comments and are not executed<br /><br />" ..
	"Available variables:<br />" ..
	"$ACTION is the hotplug event (ifup, ifdown)<br />" ..
	"$INTERFACE is the interface name (wan1, wan2, etc.)<br />" ..
	"$DEVICE is the device name attached to the interface (eth0.1, eth1, etc.)"))


restore = f:option(Button, "_restorebak", translate("Restore default hotplug script"))
	restore.inputtitle = translate("Restore...")
	restore.inputstyle = "apply"

t = f:option(TextValue, "lines")
	t.rmempty = true
	t.rows = 20

	function t.cfgvalue()
		local hps = fs.readfile(script)
		if not hps or hps == "" then -- if script does not exist or is blank restore from backup
			sys.call("cp -f " .. scriptBackup .. " " .. script)
			return fs.readfile(script)
		else
			return hps
		end
	end

	function t.write(self, section, data) -- format and write new data to script
		return fs.writefile(script, ut.trim(data:gsub("\r\n", "\n")) .. "\n")
	end


return m5
