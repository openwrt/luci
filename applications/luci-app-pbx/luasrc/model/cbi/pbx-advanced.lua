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

appname         = "PBX"
modulename      = "pbx-advanced"
defaultbindport = 5060
defaultrtpstart = 19850
defaultrtpend   = 19900

-- Returns all the network related settings, including a constructed RTP range
function get_network_info()
        externhost = m.uci:get(modulename, "advanced", "externhost")
        ipaddr     = m.uci:get("network", "lan", "ipaddr")
        bindport   = m.uci:get(modulename, "advanced", "bindport")
        rtpstart   = m.uci:get(modulename, "advanced", "rtpstart")
        rtpend     = m.uci:get(modulename, "advanced", "rtpend")

        if bindport == nil then bindport = defaultbindport end
        if rtpstart == nil then rtpstart = defaultrtpstart end
        if rtpend   == nil then rtpend   = defaultrtpend   end

        if rtpstart == nil or rtpend == nil then
                rtprange = nil
        else
                rtprange = rtpstart .. "-" .. rtpend
        end

        return bindport, rtprange, ipaddr, externhost
end

-- If not present, insert empty rules in the given config & section named PBX-SIP and PBX-RTP
function insert_empty_sip_rtp_rules(config, section)

                -- Add rules named PBX-SIP and PBX-RTP if not existing
                found_sip_rule = false
                found_rtp_rule = false
                m.uci:foreach(config, section,
                        function(s1)
                                if     s1._name == 'PBX-SIP' then
                                        found_sip_rule = true
                                elseif s1._name == 'PBX-RTP' then
                                        found_rtp_rule = true
                                end
                        end)
                
                if found_sip_rule ~= true then
                        newrule=m.uci:add(config, section)
                        m.uci:set(config, newrule, '_name', 'PBX-SIP')
                end
                if found_rtp_rule ~= true then
                        newrule=m.uci:add(config, section)
                        m.uci:set(config, newrule, '_name', 'PBX-RTP')
                end
end

-- Delete rules in the given config & section named PBX-SIP and PBX-RTP
function delete_sip_rtp_rules(config, section)

                -- Remove rules named PBX-SIP and PBX-RTP
                commit = false
                m.uci:foreach(config, section,
                        function(s1)
                                if s1._name == 'PBX-SIP' or s1._name == 'PBX-RTP' then
                                        m.uci:delete(config, s1['.name'])
                                        commit = true
                                end
                        end)

        -- If something changed, then we commit the config.
        if commit == true then m.uci:commit(config) end
end

-- Deletes QoS rules associated with this PBX.
function delete_qos_rules()
        delete_sip_rtp_rules ("qos", "classify")
end


function insert_qos_rules()
        -- Insert empty PBX-SIP and PBX-RTP rules if not present.
        insert_empty_sip_rtp_rules ("qos", "classify")

        -- Get the network information
        bindport, rtprange, ipaddr, externhost = get_network_info()

        -- Iterate through the QoS rules, and if there is no other rule with the same port
        -- range at the priority service level, insert this rule.
        commit = false
        m.uci:foreach("qos", "classify",
                function(s1)
                        if     s1._name == 'PBX-SIP' then
                                if s1.ports ~= bindport or s1.target ~= "Priority" or s1.proto ~= "udp" then
                                        m.uci:set("qos", s1['.name'], "ports",  bindport)
                                        m.uci:set("qos", s1['.name'], "proto",  "udp")
                                        m.uci:set("qos", s1['.name'], "target", "Priority")
                                        commit = true
                                end
                        elseif s1._name == 'PBX-RTP' then
                                if s1.ports ~= rtprange or s1.target ~= "Priority" or s1.proto ~= "udp" then
                                        m.uci:set("qos", s1['.name'], "ports",  rtprange)
                                        m.uci:set("qos", s1['.name'], "proto",  "udp")
                                        m.uci:set("qos", s1['.name'], "target", "Priority")
                                        commit = true
                                end
                        end
                end)

        -- If something changed, then we commit the qos config.
        if commit == true then m.uci:commit("qos") end
end

-- This function is a (so far) unsuccessful attempt to manipulate the firewall rules from here
-- Need to do more testing and eventually move to this mode.
function maintain_firewall_rules()
        -- Get the network information
        bindport, rtprange, ipaddr, externhost = get_network_info()

        commit = false
        -- Only if externhost is set, do we control firewall rules.
        if externhost ~= nil and bindport ~= nil and rtprange ~= nil then
                -- Insert empty PBX-SIP and PBX-RTP rules if not present.
                insert_empty_sip_rtp_rules ("firewall", "rule")

                -- Iterate through the firewall rules, and if the dest_port and dest_ip setting of the\
                -- SIP and RTP rule do not match what we want configured, set all the entries in the rule\
                -- appropriately.
                m.uci:foreach("firewall", "rule",
                        function(s1)
                                if     s1._name == 'PBX-SIP' then
                                        if s1.dest_port ~= bindport then
                                                m.uci:set("firewall", s1['.name'], "dest_port", bindport)
                                                m.uci:set("firewall", s1['.name'], "src", "wan")
                                                m.uci:set("firewall", s1['.name'], "proto", "udp")
                                                m.uci:set("firewall", s1['.name'], "target", "ACCEPT")
                                                commit = true
                                        end
                                elseif s1._name == 'PBX-RTP' then
                                        if s1.dest_port ~= rtprange then
                                                m.uci:set("firewall", s1['.name'], "dest_port", rtprange)
                                                m.uci:set("firewall", s1['.name'], "src", "wan")
                                                m.uci:set("firewall", s1['.name'], "proto", "udp")
                                                m.uci:set("firewall", s1['.name'], "target", "ACCEPT")
                                                commit = true
                                        end
                                end
                        end)
        else
                -- We delete the firewall rules if one or more of the necessary parameters are not set.
                sip_rule_name=nil
                rtp_rule_name=nil
        
                -- First discover the configuration names of the rules.
                m.uci:foreach("firewall", "rule",
                        function(s1)
                                if     s1._name == 'PBX-SIP' then
                                        sip_rule_name = s1['.name']
                                elseif s1._name == 'PBX-RTP' then
                                        rtp_rule_name = s1['.name']
                                end
                        end)
                
                -- Then, using the names, actually delete the rules.
                if sip_rule_name ~= nil then
                        m.uci:delete("firewall", sip_rule_name)
                        commit = true
                end
                if rtp_rule_name ~= nil then
                        m.uci:delete("firewall", rtp_rule_name)
                        commit = true
                end
        end

        -- If something changed, then we commit the firewall config.
        if commit == true then m.uci:commit("firewall") end
end

m = Map (modulename, translate("Advanced Settings"),
         translate("This section contains settings that do not need to be changed under \
         normal circumstances. In addition, here you can configure your system \
         for use with remote SIP devices, and resolve call quality issues by enabling \
         the insertion of QoS rules."))

-- Recreate the voip server config, and restart necessary services after changes are commited
-- to the advanced configuration. The firewall must restart because of "Remote Usage".
function m.on_after_commit(self)

        -- Make sure firewall rules are in place
        maintain_firewall_rules()

        -- If insertion of QoS rules is enabled
        if m.uci:get(modulename, "advanced", "qos_enabled") == "yes" then
                insert_qos_rules()
        else
                delete_qos_rules()
        end

        luci.sys.call("/etc/init.d/pbx-" .. server .. " restart 1\>/dev/null 2\>/dev/null")
        luci.sys.call("/etc/init.d/"     .. server .. " restart 1\>/dev/null 2\>/dev/null")
        luci.sys.call("/etc/init.d/firewall             restart 1\>/dev/null 2\>/dev/null")
end

-----------------------------------------------------------------------------
s = m:section(NamedSection, "advanced", "settings", translate("Advanced Settings"))
s.anonymous = true

s:tab("general",  translate("General Settings"))
s:tab("remote_usage", translate("Remote Usage"),
      translatef("You can use your SIP devices/softphones with this system from a remote location \
      as well, as long as your Internet Service Provider gives you a public IP. \
      You will be able to call other local users for free (e.g. other Analog Telephone Adapters (ATAs)) \
      and use your VoIP providers to make calls as if you were local to the PBX. \
      After configuring this tab, go back to where users are configured and see the new \
      Server and Port setting you need to configure the remote SIP devices with. Please note that if this \
      PBX is not running on your router/gateway, you will need to configure port forwarding (NAT) on your \
      router/gateway. Please forward the ports below (SIP port and RTP range) to the IP address of the \
      device running this PBX."))

s:tab("qos",  translate("QoS Settings"), 
      translate("If you experience jittery or high latency audio during heavy downloads, you may want \
      to enable QoS. QoS prioritizes traffic to and from your network for specified ports and IP \
      addresses, resulting in better latency and throughput for sound in our case. If enabled below, \
      a QoS rule for this service will be configured by the PBX automatically, but you must visit the \
      QoS configuration page (Network->QoS) to configure other critical QoS settings like Download \
      and Upload speed."))

ringtime = s:taboption("general", Value, "ringtime", translate("Number of Seconds to Ring"),
                 translate("Set the number of seconds to ring users upon incoming calls before hanging up \
                 or going to voicemail, if the voicemail is installed and enabled."))
ringtime.datatype = "port"
ringtime.default = 30

ua = s:taboption("general", Value, "useragent", translate("User Agent String"),
                 translate("This is the name that the VoIP server will use to identify itself when \
                 registering to VoIP (SIP) providers. Some providers require this to a specific \
                 string matching a hardware SIP device."))
ua.default = appname

h = s:taboption("remote_usage", Value, "externhost", translate("Domain/IP Address/Dynamic Domain"),
                translate("You can enter your domain name, external IP address, or dynamic domain name here. \
                The best thing to input is a static IP address. If your IP address is dynamic and it changes, \
                your configuration will become invalid. Hence, it's recommended to set up Dynamic DNS in this case. \
                and enter your Dynamic DNS hostname here. You can configure Dynamic DNS with the luci-app-ddns package."))
h.datatype = "host"

p = s:taboption("remote_usage", Value, "bindport", translate("External SIP Port"),
                translate("Pick a random port number between 6500 and 9500 for the service to listen on. \
                Do not pick the standard 5060, because it is often subject to brute-force attacks. \
                When finished, (1) click \"Save and Apply\", and (2) look in the \
                \"SIP Device/Softphone Accounts\" section for updated Server and Port settings \
                for your SIP Devices/Softphones."))
p.datatype = "port"

p = s:taboption("remote_usage", Value, "rtpstart", translate("RTP Port Range Start"),
                translate("RTP traffic carries actual voice packets. This is the start of the port range \
                that will be used for setting up RTP communication. It's usually OK to leave this \
                at the default value."))
p.datatype = "port"
p.default = defaultrtpstart

p = s:taboption("remote_usage", Value, "rtpend", translate("RTP Port Range End"))
p.datatype = "port"
p.default = defaultrtpend

p = s:taboption("qos", ListValue, "qos_enabled", translate("Insert QoS Rules"))
p:value("yes", translate("Yes"))
p:value("no",  translate("No"))
p.default = "yes"

return m
