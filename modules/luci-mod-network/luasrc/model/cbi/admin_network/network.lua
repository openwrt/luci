-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

local fs = require "nixio.fs"
local tpl = require "luci.template"
local ntm = require "luci.model.network".init()
local fwm = require "luci.model.firewall".init()
local json = require "luci.jsonc"

m = Map("network", translate("Interfaces"))
m:chain("wireless")
m:chain("firewall")
m:chain("dhcp")
m.pageaction = false


local tpl_networks = tpl.Template(nil, [[
	<div class="cbi-section-node">
		<div class="table">
			<%
				for i, net in ipairs(netlist) do
					local z = net[3]
					local c = z and z:get_color() or "#EEEEEE"
					local t = z and translate("Part of zone %q" % z:name()) or translate("No zone assigned")
					local disabled = (net[4]:get("auto") == "0")
					local dynamic = net[4]:is_dynamic()
			%>
				<div class="tr cbi-rowstyle-<%=i % 2 + 1%>">
					<div class="td col-3 center middle">
						<div class="ifacebox">
							<div class="ifacebox-head" style="background-color:<%=c%>" title="<%=pcdata(t)%>">
								<strong><%=net[1]:upper()%></strong>
							</div>
							<div class="ifacebox-body" id="<%=net[1]%>-ifc-devices" data-network="<%=net[1]%>">
								<img src="<%=resource%>/icons/ethernet_disabled.png" style="width:16px; height:16px" /><br />
								<small>?</small>
							</div>
						</div>
					</div>
					<div class="td col-5 left middle" id="<%=net[1]%>-ifc-description">
						<em><%:Collecting data...%></em>
					</div>
					<div class="td cbi-section-actions">
						<div>
							<input type="button" class="cbi-button cbi-button-neutral" onclick="iface_reconnect('<%=net[1]%>')" title="<%:Reconnect this interface%>" value="<%:Restart%>"<%=ifattr(disabled or dynamic, "disabled", "disabled")%> />

							<% if disabled then %>
								<input type="hidden" name="cbid.network.<%=net[1]%>.__disable__" value="1" />
								<input type="submit" name="cbi.apply" class="cbi-button cbi-button-neutral" onclick="this.previousElementSibling.value='0'" title="<%:Reconnect this interface%>" value="<%:Connect%>"<%=ifattr(dynamic, "disabled", "disabled")%> />
							<% else %>
								<input type="hidden" name="cbid.network.<%=net[1]%>.__disable__" value="0" />
								<input type="submit" name="cbi.apply" class="cbi-button cbi-button-neutral" onclick="this.previousElementSibling.value='1'" title="<%:Shutdown this interface%>" value="<%:Stop%>"<%=ifattr(dynamic, "disabled", "disabled")%> />
							<% end %>

							<input type="button" class="cbi-button cbi-button-action important" onclick="location.href='<%=url("admin/network/network", net[1])%>'" title="<%:Edit this interface%>" value="<%:Edit%>" id="<%=net[1]%>-ifc-edit"<%=ifattr(dynamic, "disabled", "disabled")%> />

							<input type="hidden" name="cbid.network.<%=net[1]%>.__delete__" value="" />
							<input type="submit" name="cbi.apply" class="cbi-button cbi-button-negative" onclick="iface_delete(event)" value="<%:Delete%>"<%=ifattr(dynamic, "disabled", "disabled")%> />
						</div>
					</div>
				</div>
			<% end %>
		</div>
	</div>
	<div class="cbi-section-create">
		<input type="button" class="cbi-button cbi-button-add" value="<%:Add new interface...%>" onclick="location.href='<%=url("admin/network/iface_add")%>'" />
	</div>
]])

local _, net
local ifaces, netlist = { }, { }

for _, net in ipairs(ntm:get_networks()) do
	if net:name() ~= "loopback" then
		local zn = net:zonename()
		local z = zn and fwm:get_zone(zn) or fwm:get_zone_by_network(net:name())

		local w = 1
		if net:is_alias() then
			w = 2
		elseif net:is_dynamic() then
			w = 3
		end

		ifaces[#ifaces+1] = net:name()
		netlist[#netlist+1] = {
			net:name(), z and z:name() or "-", z, net, w
		}
	end
end

table.sort(netlist,
	function(a, b)
		if a[2] ~= b[2] then
			return a[2] < b[2]
		elseif a[5] ~= b[5] then
			return a[5] < b[5]
		else
			return a[1] < b[1]
		end
	end)

s = m:section(TypedSection, "interface", translate("Interface Overview"))

function s.sections(self)
	local _, net, sl = nil, nil, { }

	for _, net in ipairs(netlist) do
		sl[#sl+1] = net[1]
	end

	return sl
end

function s.render(self)
	tpl_networks:render({
		netlist = netlist
	})
end

o = s:option(Value, "__disable__")

function o.cfgvalue(self, sid)
	return (m:get(sid, "auto") == "0") and "1" or "0"
end

function o.write(self, sid, value)
	if value ~= "1" then
		m:set(sid, "auto", "")
	else
		m:set(sid, "auto", "0")
	end
end

o.remove = o.write

o = s:option(Value, "__delete__")

function o.write(self, sid, value)
	ntm:del_network(sid)
end


m:section(SimpleSection).template = "admin_network/iface_overview_status"

if fs.access("/etc/init.d/dsl_control") then
	local ok, boarddata = pcall(json.parse, fs.readfile("/etc/board.json"))
	local modemtype = (ok == true)
		and (type(boarddata) == "table")
		and (type(boarddata.dsl) == "table")
		and (type(boarddata.dsl.modem) == "table")
		and boarddata.dsl.modem.type

	dsl = m:section(TypedSection, "dsl", translate("DSL"))
	dsl.anonymous = true

	annex = dsl:option(ListValue, "annex", translate("Annex"))
	annex:value("a", translate("Annex A + L + M (all)"))
	annex:value("b", translate("Annex B (all)"))
	annex:value("j", translate("Annex J (all)"))
	annex:value("m", translate("Annex M (all)"))
	annex:value("bdmt", translate("Annex B G.992.1"))
	annex:value("b2", translate("Annex B G.992.3"))
	annex:value("b2p", translate("Annex B G.992.5"))
	annex:value("at1", translate("ANSI T1.413"))
	annex:value("admt", translate("Annex A G.992.1"))
	annex:value("alite", translate("Annex A G.992.2"))
	annex:value("a2", translate("Annex A G.992.3"))
	annex:value("a2p", translate("Annex A G.992.5"))
	annex:value("l", translate("Annex L G.992.3 POTS 1"))
	annex:value("m2", translate("Annex M G.992.3"))
	annex:value("m2p", translate("Annex M G.992.5"))

	tone = dsl:option(ListValue, "tone", translate("Tone"))
	tone:value("", translate("auto"))
	tone:value("a", translate("A43C + J43 + A43"))
	tone:value("av", translate("A43C + J43 + A43 + V43"))
	tone:value("b", translate("B43 + B43C"))
	tone:value("bv", translate("B43 + B43C + V43"))

	if modemtype == "vdsl" then
		xfer_mode = dsl:option(ListValue, "xfer_mode", translate("Encapsulation mode"))
		xfer_mode:value("", translate("auto"))
		xfer_mode:value("atm", translate("ATM (Asynchronous Transfer Mode)"))
		xfer_mode:value("ptm", translate("PTM/EFM (Packet Transfer Mode)"))

		line_mode = dsl:option(ListValue, "line_mode", translate("DSL line mode"))
		line_mode:value("", translate("auto"))
		line_mode:value("adsl", translate("ADSL"))
		line_mode:value("vdsl", translate("VDSL"))

		ds_snr = dsl:option(ListValue, "ds_snr_offset", translate("Downstream SNR offset"))
		ds_snr.default = "0"
		for i = -100, 100, 5 do
			ds_snr:value(i, translatef("%.1f dB", i / 10))
		end
	end

	firmware = dsl:option(Value, "firmware", translate("Firmware File"))

	m.pageaction = true
end

-- Show ATM bridge section if we have the capabilities
if fs.access("/usr/sbin/br2684ctl") then
	atm = m:section(TypedSection, "atm-bridge", translate("ATM Bridges"),
		translate("ATM bridges expose encapsulated ethernet in AAL5 " ..
			"connections as virtual Linux network interfaces which can " ..
			"be used in conjunction with DHCP or PPP to dial into the " ..
			"provider network."))

	atm.addremove = true
	atm.anonymous = true

	atm.create = function(self, section)
		local sid = TypedSection.create(self, section)
		local max_unit = -1

		m.uci:foreach("network", "atm-bridge",
			function(s)
				local u = tonumber(s.unit)
				if u ~= nil and u > max_unit then
					max_unit = u
				end
			end)

		m.uci:set("network", sid, "unit", max_unit + 1)
		m.uci:set("network", sid, "atmdev", 0)
		m.uci:set("network", sid, "encaps", "llc")
		m.uci:set("network", sid, "payload", "bridged")
		m.uci:set("network", sid, "vci", 35)
		m.uci:set("network", sid, "vpi", 8)

		return sid
	end

	atm:tab("general", translate("General Setup"))
	atm:tab("advanced", translate("Advanced Settings"))

	vci    = atm:taboption("general", Value, "vci", translate("ATM Virtual Channel Identifier (VCI)"))
	vpi    = atm:taboption("general", Value, "vpi", translate("ATM Virtual Path Identifier (VPI)"))
	encaps = atm:taboption("general", ListValue, "encaps", translate("Encapsulation mode"))
	encaps:value("llc", translate("LLC"))
	encaps:value("vc", translate("VC-Mux"))

	atmdev  = atm:taboption("advanced", Value, "atmdev", translate("ATM device number"))
	unit    = atm:taboption("advanced", Value, "unit", translate("Bridge unit number"))
	payload = atm:taboption("advanced", ListValue, "payload", translate("Forwarding mode"))
	payload:value("bridged", translate("bridged"))
	payload:value("routed", translate("routed"))
	m.pageaction = true
end

local network = require "luci.model.network"
if network:has_ipv6() then
	local s = m:section(NamedSection, "globals", "globals", translate("Global network options"))
	local o = s:option(Value, "ula_prefix", translate("IPv6 ULA-Prefix"))
	o.datatype = "ip6addr"
	o.rmempty = true
	m.pageaction = true
end


return m
