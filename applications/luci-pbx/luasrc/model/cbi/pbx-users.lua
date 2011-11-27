--[[
    Copyright 2011 Iordan Iordanov <iiordanov (AT) gmail.com>

    This file is part of luci-pbx.

    luci-pbx is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    luci-pbx is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with luci-pbx.  If not, see <http://www.gnu.org/licenses/>.
]]--

if     nixio.fs.access("/etc/init.d/asterisk")   then
   server = "asterisk"
elseif nixio.fs.access("/etc/init.d/freeswitch") then
   server = "freeswitch"
else
   server = ""
end

modulename         = "pbx-users"
modulenamecalls    = "pbx-calls"
modulenameadvanced = "pbx-advanced"

        
m = Map (modulename, translate("User Accounts"), 
        translate("Here you must configure at least one SIP account, that you \
                will use to register with this service. Use this account either in an Analog Telephony \
                Adapter (ATA), or in a SIP software like CSipSimple, Linphone, or Sipdroid on your \
                smartphone, or Ekiga, Linphone, or X-Lite on your computer. By default, all SIP accounts \
                will ring simultaneously if a call is made to one of your VoIP provider accounts or GV \
                numbers."))

-- Recreate the config, and restart services after changes are commited to the configuration.
function m.on_after_commit(self)
        luci.sys.call("/etc/init.d/pbx-" .. server .. " restart 1\>/dev/null 2\>/dev/null")
        luci.sys.call("/etc/init.d/"     .. server .. " restart 1\>/dev/null 2\>/dev/null")
end

externhost = m.uci:get(modulenameadvanced, "advanced", "externhost")
bindport   = m.uci:get(modulenameadvanced, "advanced", "bindport")
ipaddr     = m.uci:get("network", "lan", "ipaddr")

-----------------------------------------------------------------------------
s = m:section(NamedSection, "server", "user", translate("Server Setting"))
s.anonymous = true

if ipaddr == nil or ipaddr == "" then
   ipaddr = "(IP address not static)"
end

if bindport ~= nil then
   just_ipaddr = ipaddr
   ipaddr = ipaddr .. ":" .. bindport
end

s:option(DummyValue, "ipaddr", translate("Server Setting for Local SIP Devices"),
         translate("Enter this IP (or IP:port) in the Server/Registrar setting of SIP devices you will \
                   use ONLY locally and never from a remote location.")).default = ipaddr

if externhost ~= nil then
   if bindport ~= nil then
      just_externhost = externhost
      externhost = externhost .. ":" .. bindport
   end
   s:option(DummyValue, "externhost", translate("Server Setting for Remote SIP Devices"),
            translate("Enter this hostname (or hostname:port) in the Server/Registrar setting of SIP \
                      devices you will use from a remote location (they will work locally too).")
                     ).default = externhost
end

if bindport ~= nil then
        s:option(DummyValue, "bindport", translate("Port Setting for SIP Devices"),
        translatef("If setting Server/Registrar to %s or %s does not work for you, try setting \
        it to %s or %s and entering this port number in a separate field that specifies the \
        Server/Registrar port number. Beware that some devices have a confusing \
        setting that sets the port where SIP requests originate from on the SIP \
        device itself (the bind port). The port specified on this page is NOT this bind port \
        but the port this service listens on.", 
        ipaddr, externhost, just_ipaddr, just_externhost)).default = bindport
end

-----------------------------------------------------------------------------
s = m:section(TypedSection, "local_user", translate("SIP Device/Softphone Accounts"))
s.anonymous = true
s.addremove = true

s:option(Value, "fullname", translate("Full Name"),
         translate("You can specify a real name to show up in the Caller ID here."))

du = s:option(Value, "defaultuser",  translate("User Name"),
         translate("Use (four to five digit) numeric user name if you are connecting normal telephones \
                   with ATAs to this system (so they can dial user names)."))
du.datatype = "uciname"

pwd = s:option(Value, "secret", translate("Password"),
               translate("Your password disappears when saved for your protection. It will be changed \
                         only when you enter a value different from the saved one."))
pwd.password = true
pwd.rmempty = false

-- We skip reading off the saved value and return nothing.
function pwd.cfgvalue(self, section)
    return "" 
end

-- We check the entered value against the saved one, and only write if the entered value is
-- something other than the empty string, and it differes from the saved value.
function pwd.write(self, section, value)
    local orig_pwd = m:get(section, self.option)
    if value and #value > 0 and orig_pwd ~= value then
        Value.write(self, section, value)
    end
end

p = s:option(ListValue, "ring", translate("Receives Incoming Calls"))
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

p = s:option(ListValue, "can_call", translate("Makes Outgoing Calls"))
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

return m
