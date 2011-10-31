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

modulename = "pbx"

function mysplit(inputstr, sep)
        if sep == nil then
                sep = "%s"
        end
        t={} ; i=1
        for str in string.gmatch(inputstr, "([^"..sep.."]+)") do
                t[i] = str
                i = i + 1
        end
        return t
end

function format_two_indices(string, ind1, ind2)
	lines=mysplit(string, "\n")

	words={}
	for index,value in ipairs(lines) do
	        words[index]=mysplit(value)
	end

	output = ""
	for index,value in ipairs(words) do
	        if value[ind1] ~= nil and value[ind2] ~= nil then
	                output = output .. string.format("%-40s \t %-20s\n", value[ind1], value[ind2])
	        end
	end
	return output
end

function format_one_index(string, ind1)
	lines=mysplit(string, "\n")

	words={}
	for index,value in ipairs(lines) do
	        words[index]=mysplit(value)
	end

	output = ""
	for index,value in ipairs(words) do
	        if value[ind1] ~= nil then
	                output = output .. string.format("%-40s\n", value[ind1])
	        end
	end
	return output
end

m = Map (modulename, translate("PBX Main Page"),
	 translate("This configuration page allows you to configure a phone system (PBX) service which\
      permits making phone calls through multiple Google and SIP (like Sipgate,\
      SipSorcery, and Betamax) accounts and sharing them among many SIP devices. \
      Note that Google accounts, SIP accounts, and local user accounts are configured in the \
      \"Google Accounts\", \"SIP Accounts\", and \"User Accounts\" sub-sections. \
      You must add at least one User Account to this PBX, and then configure a SIP device or softphone \
      to use the account, in order to make and receive calls with your Google/SIP accounts. \
      Configuring multiple users will allow you to make free calls between all users, and share the configured \
      Google and SIP accounts. If you have more than one Google and SIP accounts set up, \
      you should probably configure how calls to and from them are routed in the \"Call Routing\" page. \
      If you're interested in using your own PBX from anywhere in the world, \
      then visit the \"Remote Usage\" section in the \"Advanced Settings\" page."))

----------------------------------------------------------------------------------------------------
s = m:section(NamedSection, "connection_status", "main", translate("Service Control and Connection Status"))
s.anonymous = true

s:option (DummyValue, "status", translate("Service Status"))

sts = s:option(DummyValue, "_sts") 
sts.template = "cbi/tvalue"
sts.rows = 20

function sts.cfgvalue(self, section)

   if server == "asterisk" then
      reg  = luci.sys.exec("asterisk -rx 'sip show registry' | sed 's/peer-//'")
      jab  = luci.sys.exec("asterisk -rx 'jabber show connections' | grep onnected")
      usrs = luci.sys.exec("asterisk -rx 'sip show users'")
      chan = luci.sys.exec("asterisk -rx 'core show channels'")
      return format_two_indices(reg, 1, 5) .. format_two_indices(jab, 2, 4) .. "\n" 
             .. format_one_index(usrs, 1) .. "\n" .. chan
   elseif server == "freeswitch" then
      return "Freeswitch is not supported yet.\n"
   else
      return "Neither Asterisk nor FreeSwitch discovered, please install Asterisk, as Freeswitch is not supported yet.\n"
   end
end

return m
