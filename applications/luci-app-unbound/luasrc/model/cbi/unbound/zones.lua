-- Copyright 2017 Eric Luehrsen <ericluehrsen@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local m5, s5
local ztype, zones, servers, fallback, enabled

local fs = require "nixio.fs"
local ut = require "luci.util"
local sy = require "luci.sys"
local resolvfile = "/tmp/resolv.conf.auto"

m5 = Map("unbound")
s5 = m5:section(TypedSection, "zone", "Zones",
    translatef("This shows extended zones and more details can be "
    .. "changed in Files tab and <a href=\"%s\">Edit:UCI</a> subtab.",
    "/cgi-bin/luci/admin/services/unbound/files" ))

s5.addremove = false
s5.anonymous = true
s5.sortable = true
s5.template = "cbi/tblsection"

ztype = s5:option(DummyValue, "DummyType", translate("Type"))
ztype.rawhtml = true

zones = s5:option(DummyValue, "DummyZones", translate("Zones"))
zones.rawhtml = true

servers = s5:option(DummyValue, "DummyServers", translate("Servers"))
servers.rawhtml = true

fallback = s5:option(Flag, "fallback", translate("Fallback"))
fallback.rmempty = false

enabled = s5:option(Flag, "enabled", translate("Enable"))
enabled.rmempty = false


function ztype.cfgvalue(self, s)
    -- Format a meaninful tile for the Zone Type column
    local itxt = self.map:get(s, "zone_type")
    local itls = self.map:get(s, "tls_upstream")


    if itxt and itxt:match("forward") then
        if itls and (itls == "1") then
            return translate("Forward TLS")

        else
            return translate("Forward")
        end

    elseif itxt and itxt:match("stub") then
        return translate("Recurse")

    elseif itxt and itxt:match("auth") then
        return translate("AXFR")

    else
        return translate("Error")
    end
end


function zones.cfgvalue(self, s)
    -- Format a meaninful sentence for the Zones viewed column
    local xtxt, otxt
    local itxt = self.map:get(s, "zone_name")
    local itype = self.map:get(s, "zone_type")


    for xtxt in ut.imatch(itxt) do
        if (xtxt == ".") then
            -- zone_name lists
            xtxt = translate("(root)")
        end


        if otxt and (#otxt > 0) then
            otxt = otxt .. ", <var>%s</var>" % xtxt

        else
            otxt = "<var>%s</var>" % xtxt
        end
    end


    if itype and itype:match("forward") then
        -- from zone_type create a readable hint for the action
        otxt = translate("accept upstream results for ") .. otxt

    elseif itype and itype:match("stub") then
        otxt = translate("select recursion for ") .. otxt

    elseif itype and itype:match("auth") then
        otxt = translate("prefetch zone files for ") .. otxt

    else
        otxt = translate("unknown action for ") .. otxt
    end


    if otxt and (#otxt > 0) then
        return otxt

    else
        return "(empty)"
    end
end


function servers.cfgvalue(self, s)
    -- Format a meaninful sentence for the Servers (and URL) column
    local xtxt, otxt, rtxt, found
    local itxt = self.map:get(s, "server")
    local iurl = self.map:get(s, "url_dir")
    local itype = self.map:get(s, "zone_type")
    local itls = self.map:get(s, "tls_upstream")
    local iidx = self.map:get(s, "tls_index")
    local irslv = self.map:get(s, "resolv_conf")


    for xtxt in ut.imatch(itxt) do
        if otxt and (#otxt > 0) then
            -- bundle and make pretty the server list
            otxt = otxt .. ", <var>%s</var>" % xtxt

        else
            otxt = "<var>%s</var>" % xtxt
        end
    end


    if otxt and (#otxt > 0)
    and itls and (itls == "1")
    and iidx and (#iidx > 0) then
        -- show TLS certificate name index if provided
        otxt = translatef("use nameservers by <var>%s</var> at ", iidx) .. otxt

    elseif otxt and (#otxt > 0) then
        otxt = translate("use nameservers ") .. otxt
    end


    if iurl and (#iurl > 0) and itype and itype:match("auth") then
        if otxt and (#otxt > 0) then
            -- include optional URL filed for auth-zone: type
            otxt = otxt .. translatef(", and try <var>%s</var>", iurl)

        else
            otxt = translatef("download from <var>%s</var>", iurl)
        end
    end


    if irslv and (irslv == "1") and itype and itype:match("forward") then
        for xtxt in ut.imatch(fs.readfile(resolvfile)) do
            if xtxt:match("nameserver") then
                found = true

            elseif (found == true) then
                if rtxt and (#rtxt > 0) then
                    -- fetch name servers from resolv.conf
                    rtxt = rtxt .. ", <var>%s</var>" % xtxt

                else
                    rtxt = "<var>%s</var>" % xtxt
                end


                found = false
            end
        end


        if otxt and (#otxt > 0) and rtxt and (#rtxt > 0) then
            otxt = otxt
                .. translatef(", and <var>%s</var> entries ", resolvfile) .. rtxt

        elseif rtxt and (#rtxt > 0) then
            otxt = translatef("use <var>%s</var> nameservers ", resolvfile) .. rtxt
        end
    end


    if otxt and (#otxt > 0) then
        return otxt

    else
        return "(empty)"
    end
end


function m5.on_commit(self)
    if sy.init.enabled("unbound") then
        -- Restart Unbound with configuration
        sy.call("/etc/init.d/unbound restart >/dev/null 2>&1")

    else
        sy.call("/etc/init.d/unbound stop >/dev/null 2>&1")
    end
end


return m5

