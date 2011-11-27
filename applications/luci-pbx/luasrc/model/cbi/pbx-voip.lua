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

modulename = "pbx-voip"

m = Map (modulename, translate("SIP Accounts"),
         translate("This is where you set up your SIP (VoIP) accounts ts like Sipgate, SipSorcery, \
        the popular Betamax providers, and any other providers with SIP settings in order to start \
        using them for dialing and receiving calls (SIP uri and real phone calls). Click \"Add\" to \
        add as many accounts as you wish."))

-- Recreate the config, and restart services after changes are commited to the configuration.
function m.on_after_commit(self)
   commit = false
   -- Create a field "name" for each account that identifies the account in the backend.
   m.uci:foreach(modulename, "voip_provider", 
                 function(s1)
                    if s1.defaultuser ~= nil and s1.host ~= nil then
                       name=string.gsub(s1.defaultuser.."_"..s1.host, "%W", "_")
                       if s1.name ~= name then
                          m.uci:set(modulename, s1['.name'], "name", name)
                          commit = true
                       end
                    end
                 end)
   if commit == true then m.uci:commit(modulename) end

   luci.sys.call("/etc/init.d/pbx-" .. server .. " restart 1\>/dev/null 2\>/dev/null")
   luci.sys.call("/etc/init.d/"     .. server .. " restart 1\>/dev/null 2\>/dev/null")
end

-----------------------------------------------------------------------------
s = m:section(TypedSection, "voip_provider", translate("SIP Provider Accounts"))
s.anonymous = true
s.addremove = true

s:option(Value, "defaultuser",  translate("User Name"))
pwd = s:option(Value, "secret", translate("Password"),
               translate("When your password is saved, it disappears from this field and is not displayed \
                         for your protection. The previously saved password will be changed only when you \
                         enter a value different from the saved one."))



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

h = s:option(Value, "host", translate("SIP Server/Registrar"))
h.datatype = "host"

p = s:option(ListValue, "register", translate("Enable Incoming Calls (Register via SIP)"),
             translate("This option should be set to \"Yes\" if you have a DID \(real telephone number\) \
                        associated with this SIP account or want to receive SIP uri calls through this \
                        provider.")) 
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

p = s:option(ListValue, "make_outgoing_calls", translate("Enable Outgoing Calls"),
             translate("Use this account to make outgoing calls."))
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

from = s:option(Value, "fromdomain",
                translate("SIP Realm (needed by some providers)"))
from.optional = true
from.datatype = "host"

port = s:option(Value, "port", translate("SIP Server/Registrar Port"))
port.optional = true
port.datatype = "port"

op = s:option(Value, "outboundproxy", translate("Outbound Proxy"))
op.optional = true
op.datatype = "host"

return m
