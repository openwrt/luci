--[[
    Copyright 2011 Iordan Iordanov <iiordanov (AT) gmail.com>

    This file is part of luci-pbx-voicemail.

    luci-pbx-voicemail is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    luci-pbx-voicemail is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with luci-pbx-voicemail.  If not, see <http://www.gnu.org/licenses/>.
]]--

if     nixio.fs.access("/etc/init.d/asterisk")   then
   server = "asterisk"
elseif nixio.fs.access("/etc/init.d/freeswitch") then
   server = "freeswitch"
else
   server = ""
end

modulename = "pbx-voicemail"
vmlogfile  = "/tmp/last_sent_voicemail.log"

m = Map (modulename, translate("Voicemail Setup"),
         translate("Here you can configure a global voicemail for this PBX. Since this system is \
         intended to run on embedded systems like routers, there is no local storage of voicemail - \
         it must be sent out by email. Therefore you need to configure an outgoing mail (SMTP) server \
         (for example your ISP's, Google's, or Yahoo's SMTP server), and provide a list of \
         addresses that receive recorded voicemail."))

-- Recreate the config, and restart services after changes are commited to the configuration.
function m.on_after_commit(self)
        luci.sys.call("/etc/init.d/pbx-" .. server .. " restart 1\>/dev/null 2\>/dev/null")
        luci.sys.call("/etc/init.d/"     .. server .. " restart 1\>/dev/null 2\>/dev/null")
end


----------------------------------------------------------------------------------------------------
s = m:section(NamedSection, "global_voicemail", "voicemail", translate("Global Voicemail Setup"),
              translate("When you enable voicemail, you will have the opportunity to specify \
              email addresses that receive recorded voicemail. You must also set up an SMTP server below."))
s.anonymous = true

enable = s:option(ListValue, "enabled", translate("Enable Voicemail"))
enable:value("yes", translate("Yes"))
enable:value("no",  translate("No"))
enable.default = "no"

emails = s:option(DynamicList, "global_email_addresses",
                  translate("Email Addresses that Receive Voicemail"))
emails:depends("enabled", "yes")

savepath = s:option(Value, "global_save_path", translate("Local Storage Directory"),
                    translate("You can also retain copies of voicemail messages on the device running \
                              your PBX. The path specified here will be created if it doesn't exist. \
                              Beware of limited space on embedded devices like routers, and enable this \
                              option only if you know what you are doing."))
savepath.optional = true

if     nixio.fs.access("/etc/pbx-voicemail/recordings/greeting.gsm")   then
   m1 = s:option(DummyValue, "_m1")
   m1:depends("enabled", "yes")
   m1.default = "NOTE: Found a voicemail greeting. To check or change your voicemail greeting, dial *789 \
                 and the system will play back your current greeting. After that, a long beep will sound and \
                 you can press * in order to record a new message. Hang up to avoid recording a message. \
                 If you press *, a second long beep will sound, and you can record a new greeting. \
                 Hang up or press # to stop recording. When # is pressed the system will play back the \
                 new greeting."
else
   m1 = s:option(DummyValue, "_m1")
   m1:depends("enabled", "yes")
   m1.default = "WARNING: Could not find voicemail greeting. Callers will hear only a beep before \
                 recording starts. To record a greeting, dial *789, and press * after the long beep. \
                 If you press *, a second long beep will sound, and you can record a new greeting. \
                 Hang up or press # to stop recording. When # is pressed the system will play back the \
                 new greeting."
end


----------------------------------------------------------------------------------------------------
s = m:section(NamedSection, "voicemail_smtp", "voicemail", translate("Outgoing mail (SMTP) Server"),
              translate("In order for this PBX to send emails containing voicemail recordings, you need to \
              set up an SMTP server here. Your ISP usually provides an SMTP server for that purpose. \
              You can also set up a third party SMTP server such as the one provided by Google or Yahoo."))
s.anonymous = true

serv = s:option(Value, "smtp_server", translate("SMTP Server Hostname or IP Address"))
serv.datatype = "host"

port = s:option(Value, "smtp_port", translate("SMTP Port Number"))
port.datatype = "port"
port.default = "25"

tls = s:option(ListValue, "smtp_tls", translate("Secure Connection Using TLS"))
tls:value("on",  translate("Yes"))
tls:value("off", translate("No"))
tls.default = "on"

auth = s:option(ListValue, "smtp_auth", translate("SMTP Server Authentication"))
auth:value("on",  translate("Yes"))
auth:value("off", translate("No"))
auth.default = "off"

user = s:option(Value, "smtp_user", translate("SMTP User Name"))
user:depends("smtp_auth", "on")

pwd = s:option(Value, "smtp_password", translate("SMTP Password"),
               translate("Your real SMTP password is not shown for your protection. It will be changed \
                         only when you change the value in this box."))
pwd.password = true
pwd:depends("smtp_auth", "on")
                            
-- We skip reading off the saved value and return nothing.
function pwd.cfgvalue(self, section)
   return "Password Not Displayed"
end
   
-- We check the entered value against the saved one, and only write if the entered value is
-- something other than the empty string, and it differes from the saved value.
function pwd.write(self, section, value)
   local orig_pwd = m:get(section, self.option)
   if value == "Password Not Displayed" then value = "" end
   if value and #value > 0 and orig_pwd ~= value then
      Value.write(self, section, value)
   end
end

----------------------------------------------------------------------------------------------------
s = m:section(NamedSection, "voicemail_log", "voicemail", translate("Last Sent Voicemail Log"))
s.anonymous = true

s:option (DummyValue, "vmlog")

sts = s:option(DummyValue, "_sts") 
sts.template = "cbi/tvalue"
sts.rows = 5

function sts.cfgvalue(self, section)
   log = nixio.fs.readfile(vmlogfile)
   if log == nil or log == "" then
      log = "No errors or messages reported."
   end
   return log
end

return m
