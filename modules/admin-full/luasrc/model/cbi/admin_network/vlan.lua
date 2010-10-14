--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("network", translate("Switch"), translate("The network ports on your router can be combined to several <abbr title=\"Virtual Local Area Network\">VLAN</abbr>s in which computers can communicate directly with each other. <abbr title=\"Virtual Local Area Network\">VLAN</abbr>s are often used to separate different network segments. Often there is by default one Uplink port for a connection to the next greater network like the internet and other ports for a local network."))

m.uci:foreach("network", "switch",
	function(x)
		local switch_name = x.name or x['.name']
		local has_vlan4k  = nil
		local has_ptpvid  = nil
		local max_vid     = 16
		local num_vlans   = 16
		local num_ports   = 5
		local cpu_port    = 5

		local swc = io.popen("swconfig dev %q help 2>/dev/null" % switch_name)
		if swc then

			local is_port_attr = false
			local is_vlan_attr = false

			while true do
				local line = swc:read("*l")
				if not line then break end

				if line:match("^%s+%-%-vlan") then
					is_vlan_attr = true

				elseif line:match("^%s+%-%-port") then
					is_vlan_attr = false
					is_port_attr = true

				elseif line:match("^Switch %d+:") then
					num_ports, cpu_port, num_vlans =
						line:match("ports: (%d+) %(cpu @ (%d+)%), vlans: (%d+)")

					num_ports = tonumber(num_ports or  5)
					num_vlans = tonumber(num_vlans or 16)
					cpu_port  = tonumber(cpu_port  or  5)

				elseif line:match("%-%-pvid") or line:match("%-%-tag") or line:match("%-%-vid") then
					if is_vlan_attr then has_vlan4k = line:match("%-%-(%w+)") end
					if is_port_attr then has_ptpvid = line:match("%-%-(%w+)") end

				end
			end

			swc:close()
		end

		-- Switch properties
		s = m:section(NamedSection, x['.name'], "switch", "Switch %q" % switch_name)
		s.addremove = false

		s:option(Flag, "enable", "Enable this switch")
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end

		s:option(Flag, "enable_vlan", "Enable VLAN functionality")
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end

		s:option(Flag, "reset", "Reset switch during setup")
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end


		-- VLAN table
		s = m:section(TypedSection, "switch_vlan", "VLANs on %q" % switch_name)
		s.template = "cbi/tblsection"
		s.addremove = true
		s.anonymous = true

		s.cfgsections = function(self)
			local osections = TypedSection.cfgsections(self)
			local sections = { }
			local section

			for _, section in luci.util.spairs(
				osections,
				function(a, b)
					return (tonumber(m.uci:get("network", osections[a], has_vlan4k or "vlan") or 9999) or 0)
						<  (tonumber(m.uci:get("network", osections[b], has_vlan4k or "vlan") or 9999) or 0)
				end
			) do
				sections[#sections+1] = section
			end

			return sections
		end

		s.create = function(self, section)
			local sid = TypedSection.create(self, section)

			local max_nr = 0
			local max_id = 0

			m.uci:foreach("network", "switch_vlan",
				function(s)
					local nr = tonumber(s.vlan)
					local id = has_vlan4k and tonumber(s[has_vlan4k])
					if nr ~= nil and nr > max_nr then max_nr = nr end
					if id ~= nil and id > max_id then max_id = id end
				end)

			m.uci:set("network", sid, "vlan", max_nr + 1)

			if has_vlan4k then
				m.uci:set("network", sid, has_vlan4k, max_id + 1)
			end

			return sid
		end


		local port_opts = { }
		local untagged  = { }

		local portvalue = function(self, section)
			local pt
			for pt in (m.uci:get("network", section, "ports") or ""):gmatch("%w+") do
				local pc, tu = pt:match("^(%d+)([tu]*)")
				if pc == self.option then return (#tu > 0) and tu or "u" end
			end
			return ""
		end

		local portvalidate = function(self, value, section)
			-- ensure that the ports appears untagged only once
			if value == "u" then
				if not untagged[self.option] then
					untagged[self.option] = true
				else
					return nil,
						translatef("Port %d is untagged in multiple VLANs!", tonumber(self.option) + 1)
				end
			end
			return value
		end


		local vid = s:option(Value, has_vlan4k or "vlan", "VLAN ID")

		vid.rmempty = false

		vid.validate = function(self, value, section)
			local v = tonumber(value)
			local m = has_vlan4k and 4094 or (num_vlans - 1)
			if v ~= nil and v > 0 and v <= m then
				return value
			else
				return nil,
					translatef("Invalid VLAN ID given! Only IDs between %d and %d are allowed.", 1, m)
			end
		end

		vid.write = function(self, section, value)
			local o
			local p = { }

			for _, o in ipairs(port_opts) do
				local v = o:formvalue(section)
				if v == "t" then
					p[#p+1] = o.option .. v
				elseif v == "u" then
					p[#p+1] = o.option
				end
			end

			m.uci:set("network", section, "ports", table.concat(p, " "))
			return Value.write(self, section, value)
		end


		local pt
		for pt = 0, num_ports - 1 do
			local po = s:option(ListValue, tostring(pt),
				(pt == cpu_port) and "CPU" or "Port %d" % (pt + 1))

			po:value("", translate("off"))
			po:value("u" % pt, translate("untagged"))
			po:value("t" % pt, translate("tagged"))

			po.cfgvalue = portvalue
			po.validate = portvalidate

			port_opts[#port_opts+1] = po
		end
	end
)

return m
