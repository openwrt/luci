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

modulename = "pbx"


if     nixio.fs.access("/etc/init.d/asterisk")   then
   server = "asterisk"
elseif nixio.fs.access("/etc/init.d/freeswitch") then
   server = "freeswitch"
else
   server = ""
end


-- Returns formatted output of string containing only the words at the indices
-- specified in the table "indices".
function format_indices(string, indices)
   if indices == nil then
      return "Error: No indices to format specified.\n" 
   end

   -- Split input into separate lines.
   lines = luci.util.split(luci.util.trim(string), "\n")
   
   -- Split lines into separate words.
   splitlines = {}
   for lpos,line in ipairs(lines) do
      splitlines[lpos] = luci.util.split(luci.util.trim(line), "%s+", nil, true)
   end
   
   -- For each split line, if the word at all indices specified
   -- to be formatted are not null, add the formatted line to the
   -- gathered output.
   output = ""
   for lpos,splitline in ipairs(splitlines) do
      loutput = ""
      for ipos,index in ipairs(indices) do
         if splitline[index] ~= nil then
            loutput = loutput .. string.format("%-40s", splitline[index])
         else
            loutput = nil
            break
         end
      end
      
      if loutput ~= nil then
         output = output .. loutput .. "\n"
      end
   end
   return output
end


m = Map (modulename, translate("PBX Main Page"),
      translate("This configuration page allows you to configure a phone system (PBX) service which \
      permits making phone calls through multiple Google and SIP (like Sipgate, \
      SipSorcery, and Betamax) accounts and sharing them among many SIP devices. \
      Note that Google accounts, SIP accounts, and local user accounts are configured in the \
      \"Google Accounts\", \"SIP Accounts\", and \"User Accounts\" sub-sections. \
      You must add at least one User Account to this PBX, and then configure a SIP device or \
      softphone to use the account, in order to make and receive calls with your Google/SIP \
      accounts. Configuring multiple users will allow you to make free calls between all users, \
      and share the configured Google and SIP accounts. If you have more than one Google and SIP \
      accounts set up, you should probably configure how calls to and from them are routed in \
      the \"Call Routing\" page. If you're interested in using your own PBX from anywhere in the \
      world, then visit the \"Remote Usage\" section in the \"Advanced Settings\" page."))

-----------------------------------------------------------------------------------------
s = m:section(NamedSection, "connection_status", "main",
              translate("PBX Service Status"))
s.anonymous = true

s:option (DummyValue, "status", translate("Service Status"))

sts = s:option(DummyValue, "_sts") 
sts.template = "cbi/tvalue"
sts.rows = 20

function sts.cfgvalue(self, section)

   if server == "asterisk" then
      regs = luci.sys.exec("asterisk -rx 'sip show registry' | sed 's/peer-//'")
      jabs = luci.sys.exec("asterisk -rx 'jabber show connections' | grep onnected")
      usrs = luci.sys.exec("asterisk -rx 'sip show users'")
      chan = luci.sys.exec("asterisk -rx 'core show channels'")

      return format_indices(regs, {1, 5}) ..
             format_indices(jabs, {2, 4}) .. "\n" ..
             format_indices(usrs, {1}   ) .. "\n" .. chan

   elseif server == "freeswitch" then
      return "Freeswitch is not supported yet.\n"
   else
      return "Neither Asterisk nor FreeSwitch discovered, please install Asterisk, as Freeswitch is not supported yet.\n"
   end
end

return m
