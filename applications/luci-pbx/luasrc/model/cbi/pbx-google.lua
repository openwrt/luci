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

modulename           = "pbx-google"
googlemodulename     = "pbx-google"
defaultstatus        = "dnd"
defaultstatusmessage = "PBX online, may lose messages"

m = Map (modulename, translate("Google Accounts"),
         translate("This is where you set up your Google (Talk and Voice) Accounts, in order to start \
                using them for dialing and receiving calls (voice chat and real phone calls). Please \
                make at least one voice call using the Google Talk plugin installable through the \
                GMail interface, and then log out from your account everywhere. Click \"Add\" \
                to add as many accounts as you wish."))

-- Recreate the config, and restart services after changes are commited to the configuration.
function m.on_after_commit(self)
   -- Create a field "name" for each account that identifies the account in the backend.
   commit = false
   m.uci:foreach(modulename, "gtalk_jabber", 
                 function(s1)
                    if s1.username ~= nil then
                       name=string.gsub(s1.username, "%W", "_")
                       if s1.name ~= name then
                          m.uci:set(modulename, s1['.name'], "name", name)
                          commit = true
                       end
                    end
                 end)
   if commit == true then  m.uci:commit(modulename) end
   
   luci.sys.call("/etc/init.d/pbx-" .. server .. " restart 1\>/dev/null 2\>/dev/null")
   luci.sys.call("/etc/init.d/asterisk             restart 1\>/dev/null 2\>/dev/null")
end

-----------------------------------------------------------------------------
s = m:section(TypedSection, "gtalk_jabber", translate("Google Voice/Talk Accounts"))
s.anonymous = true
s.addremove = true

s:option(Value, "username",     translate("Email"))

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


p = s:option(ListValue, "register",
             translate("Enable Incoming Calls (set Status below)"),
             translate("When somebody starts voice chat with your GTalk account or calls the GVoice, \
                       number (if you have Google Voice), the call will be forwarded to any users \
                        that are online (registered using a SIP device or softphone) and permitted to \
                        receive the call. If you have Google Voice, you must go to your GVoice settings and \
                        forward calls to Google chat in order to actually receive calls made to your \
                        GVoice number. If you have trouble receiving calls from GVoice, experiment \
                        with the Call Screening option in your GVoice Settings. Finally, make sure no other \
                        client is online with this account (browser in gmail, mobile/desktop Google Talk \
                        App) as it may interfere."))
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

p = s:option(ListValue, "make_outgoing_calls", translate("Enable Outgoing Calls"),
      translate("Use this account to make outgoing calls as configured in the \"Call Routing\" section."))
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

st = s:option(ListValue, "status", translate("Google Talk Status"))
st:depends("register", "yes")
st:value("dnd", translate("Do Not Disturb"))
st:value("away",  translate("Away"))
st:value("available",  translate("Available"))
st.default = defaultstatus

stm = s:option(Value, "statusmessage", translate("Google Talk Status Message"),
             translate("Avoid using anything but alpha-numeric characters, space, comma, and period."))
stm:depends("register", "yes")
stm.default = defaultstatusmessage

return m
