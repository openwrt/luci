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

modulename        = "pbx-calls"
voipmodulename    = "pbx-voip"
googlemodulename  = "pbx-google"
usersmodulename   = "pbx-users"
allvalidaccounts  = {}
nallvalidaccounts = 0
validoutaccounts  = {}
nvalidoutaccounts = 0
validinaccounts   = {}
nvalidinaccounts  = 0
allvalidusers     = {}
nallvalidusers    = 0
validoutusers     = {}
nvalidoutusers    = 0


-- Checks whether the entered extension is valid syntactically.
function is_valid_extension(exten)
   return (exten:match("[#*+0-9NXZ]+$") ~= nil)
end


m = Map (modulename, translate("Call Routing"),
         translate("This is where you indicate which Google/SIP accounts are used to call what \
                   country/area codes, which users can use what SIP/Google accounts, how incoming \
                   calls are routed, what numbers can get into this PBX with a password, and what \
                   numbers are blacklisted."))

-- Recreate the config, and restart services after changes are commited to the configuration.
function m.on_after_commit(self)
        luci.sys.call("/etc/init.d/pbx-" .. server .. " restart 1\>/dev/null 2\>/dev/null")
        luci.sys.call("/etc/init.d/"     .. server .. " restart 1\>/dev/null 2\>/dev/null")
end

-- Add Google accounts to all valid accounts, and accounts valid for incoming and outgoing calls.
m.uci:foreach(googlemodulename, "gtalk_jabber", 
              function(s1)
                 -- Add this provider to list of valid accounts.
                 if s1.username ~= nil and s1.name ~= nil then
                    allvalidaccounts[s1.name] = s1.username
                    nallvalidaccounts = nallvalidaccounts + 1

                    if s1.make_outgoing_calls == "yes" then
                       -- Add provider to the associative array of valid outgoing accounts.
                       validoutaccounts[s1.name] = s1.username
                       nvalidoutaccounts = nvalidoutaccounts + 1
                    end

                    if s1.register == "yes" then
                       -- Add provider to the associative array of valid outgoing accounts.
                       validinaccounts[s1.name]  = s1.username
                       nvalidinaccounts = nvalidinaccounts + 1
                    end
                 end
              end)

-- Add SIP accounts to all valid accounts, and accounts valid for incoming and outgoing calls.
m.uci:foreach(voipmodulename, "voip_provider", 
              function(s1)
                 -- Add this provider to list of valid accounts.
                 if s1.defaultuser ~= nil and s1.host ~= nil and s1.name ~= nil then
                    allvalidaccounts[s1.name] = s1.defaultuser .. "@" .. s1.host
                    nallvalidaccounts = nallvalidaccounts + 1

                    if s1.make_outgoing_calls == "yes" then
                       -- Add provider to the associative array of valid outgoing accounts.
                       validoutaccounts[s1.name] = s1.defaultuser .. "@" .. s1.host
                       nvalidoutaccounts = nvalidoutaccounts + 1
                    end

                    if s1.register == "yes" then
                       -- Add provider to the associative array of valid outgoing accounts.
                       validinaccounts[s1.name]  = s1.defaultuser .. "@" .. s1.host
                       nvalidinaccounts = nvalidinaccounts + 1
                    end
                 end
              end)

-- Add Local User accounts to all valid users, and users allowed to make outgoing calls.
m.uci:foreach(usersmodulename, "local_user",
              function(s1)
                 -- Add user to list of all valid users.
                 if s1.defaultuser ~= nil then
                    allvalidusers[s1.defaultuser] = true
                    nallvalidusers = nallvalidusers + 1
                    
                    if s1.can_call == "yes" then
                       validoutusers[s1.defaultuser] = true
                       nvalidoutusers = nvalidoutusers + 1
                    end
                 end
              end)


----------------------------------------------------------------------------------------------------
-- If there are no accounts configured, or no accounts enabled for outgoing calls, display a warning.
-- Otherwise, display the usual help text within the section.
if     nallvalidaccounts == 0 then
   text = translate("NOTE: There are no Google or SIP provider accounts configured.")
elseif nvalidoutaccounts == 0 then
   text = translate("NOTE: There are no Google or SIP provider accounts enabled for outgoing calls.")
else
   text = translate("If you have more than one account that can make outgoing calls, you \
   should enter a list of phone numbers and/or prefixes in the following fields for each \
   provider listed. Invalid prefixes are removed silently, and only 0-9, X, Z, N, #, *, \
   and + are valid characters. The letter X matches 0-9, Z matches 1-9, and N matches 2-9. \
   For example to make calls to Germany through a provider, you can enter 49. To make calls \
   to North America, you can enter 1NXXNXXXXXX. If one of your providers can make \"local\" \
   calls to an area code like New York's 646, you can enter 646NXXXXXX for that \
   provider. You should leave one account with an empty list to make calls with \
   it by default, if no other provider's prefixes match. The system will automatically \
   replace an empty list with a message that the provider dials all numbers not matched by another \
   provider's prefixes. Be as specific as possible (i.e. 1NXXNXXXXXX is better than 1). Please note \
   all international dial codes are discarded (e.g. 00, 011, 010, 0011). Entries can be made in a \
   space-separated list, and/or one per line by hitting enter after every one.")
end


s = m:section(NamedSection, "outgoing_calls", "call_routing", translate("Outgoing Calls"), text)
s.anonymous = true

for k,v in pairs(validoutaccounts) do
   patterns = s:option(DynamicList, k, v)
   
   -- If the saved field is empty, we return a string
   -- telling the user that this account would dial any exten.
   function patterns.cfgvalue(self, section)
      value = self.map:get(section, self.option)
      
      if value == nil then
         return {translate("Dials numbers unmatched elsewhere")}
      else
         return value
      end
   end
   
   -- Write only valid extensions into the config file.
   function patterns.write(self, section, value)
      newvalue = {}
      nindex = 1
      for index, field in ipairs(value) do
         val = luci.util.trim(value[index])
         if is_valid_extension(val) == true then
            newvalue[nindex] = val
            nindex = nindex + 1
         end
      end
      DynamicList.write(self, section, newvalue)
   end
end

----------------------------------------------------------------------------------------------------
-- If there are no accounts configured, or no accounts enabled for incoming calls, display a warning.
-- Otherwise, display the usual help text within the section.
if     nallvalidaccounts == 0 then
   text = translate("NOTE: There are no Google or SIP provider accounts configured.")
elseif nvalidinaccounts == 0 then
   text = translate("NOTE: There are no Google or SIP provider accounts enabled for incoming calls.")
else
   text = translate("For each provider enabled for incoming calls, here you can restrict which users to\
                ring on incoming calls. If the list is empty, the system will indicate that all users \
                enabled for incoming calls will ring. Invalid usernames will be rejected \
                silently. Also, entering a username here overrides the user's setting to not receive \
                incoming calls. This way, you can make certain users ring only for specific providers. \
                Entries can be made in a space-separated list, and/or one per line by hitting enter after \
                every one.")
end


s = m:section(NamedSection, "incoming_calls", "call_routing", translate("Incoming Calls"), text)
s.anonymous = true

for k,v in pairs(validinaccounts) do
   users = s:option(DynamicList, k, v)
   
   -- If the saved field is empty, we return a string
   -- telling the user that this account would dial any exten.
   function users.cfgvalue(self, section)
      value = self.map:get(section, self.option)
      
      if value == nil then
         return {translate("Rings users enabled for incoming calls")}
      else
         return value
      end
   end
   
   -- Write only valid user names.
   function users.write(self, section, value)
      newvalue = {}
      nindex = 1
      for index, field in ipairs(value) do
         trimuser = luci.util.trim(value[index])
         if allvalidusers[trimuser] == true then
            newvalue[nindex] = trimuser
            nindex = nindex + 1
         end
      end
      DynamicList.write(self, section, newvalue)
   end
end


----------------------------------------------------------------------------------------------------
-- If there are no user accounts configured, no user accounts enabled for outgoing calls,
-- display a warning. Otherwise, display the usual help text within the section.
if     nallvalidusers == 0 then
   text = translate("NOTE: There are no local user accounts configured.")
elseif nvalidoutusers == 0 then
   text = translate("NOTE: There are no local user accounts enabled for outgoing calls.")
else
   text = translate("For each user enabled for outgoing calls you can restrict what providers the user \
        can use for outgoing calls. By default all users can use all providers. To show up in the list \
        below the user should be allowed to make outgoing calls in the \"User Accounts\" page. Enter VoIP \
        providers in the format username@some.host.name, as listed in \"Outgoing Calls\" above. It's \
        easiest to copy and paste the providers from above. Invalid entries, including providers not \
        enabled for outgoing calls, will be rejected silently. Entries can be made in a space-separated \
        list, and/or one per line by hitting enter after every one.")
end


s = m:section(NamedSection, "providers_user_can_use", "call_routing",
     translate("Providers Used for Outgoing Calls"), text)
s.anonymous = true

for k,v in pairs(validoutusers) do
   providers = s:option(DynamicList, k, k)

   -- If the saved field is empty, we return a string
   -- telling the user that this account would dial any exten.
   function providers.cfgvalue(self, section)
      value = self.map:get(section, self.option)
      
      if value == nil then
         return {translate("Uses providers enabled for outgoing calls")}
      else
         newvalue = {}
         -- Convert internal names to user@host values.
         for i,v in ipairs(value) do
            newvalue[i] = validoutaccounts[v]
         end
         return newvalue
      end
   end
   
   -- Cook the new values prior to entering them into the config file.
   -- Also, enter them only if they are valid.
   function providers.write(self, section, value)
      cookedvalue = {}
      cindex = 1
      for index, field in ipairs(value) do
         cooked = string.gsub(luci.util.trim(value[index]), "%W", "_")
         if validoutaccounts[cooked] ~= nil then
            cookedvalue[cindex] = cooked
            cindex = cindex + 1
         end
      end
      DynamicList.write(self, section, cookedvalue)
   end
end

----------------------------------------------------------------------------------------------------
s = m:section(TypedSection, "callthrough_numbers", translate("Call-through Numbers"),
        translate("Designate numbers that are allowed to call through this system and which user's \
                  privileges it will have."))
s.anonymous = true
s.addremove = true

num = s:option(DynamicList, "callthrough_number_list", translate("Call-through Numbers"))
num.datatype = "uinteger"

p = s:option(ListValue, "enabled", translate("Enabled"))
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

user = s:option(Value, "defaultuser",  translate("User Name"),
         translate("The number(s) specified above will be able to dial out with this user's providers. \
                   Invalid usernames, including users not enabled for outgoing calls, are dropped silently. \
                   Please verify that the entry was accepted."))
function user.write(self, section, value)
   trimuser = luci.util.trim(value)
   if allvalidusers[trimuser] == true then
      Value.write(self, section, trimuser)
   end
end

pwd = s:option(Value, "pin", translate("PIN"),
               translate("Your PIN disappears when saved for your protection. It will be changed \
                         only when you enter a value different from the saved one. Leaving the PIN \
                         empty is possible, but please beware of the security implications."))
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

----------------------------------------------------------------------------------------------------
s = m:section(NamedSection, "blacklisting", "call_routing", translate("Blacklisted Numbers"),
              translate("Enter phone numbers that you want to decline calls from automatically. \
              You should probably omit the country code and any leading zeroes, but please \
              experiment to make sure you are blocking numbers from your desired area successfully."))
s.anonymous = true

b = s:option(DynamicList, "blacklist1", translate("Dynamic List of Blacklisted Numbers"),
            translate("Specify numbers individually here. Press enter to add more numbers."))
b.cast = "string"
b.datatype = "uinteger"

b = s:option(Value, "blacklist2", translate("Space-Separated List of Blacklisted Numbers"),
            translate("Copy-paste large lists of numbers here."))
b.template = "cbi/tvalue"
b.rows = 3

return m
