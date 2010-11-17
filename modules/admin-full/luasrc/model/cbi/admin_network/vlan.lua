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

		-- Parse some common switch properties from swconfig help output.
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

				elseif line:match(": pvid") or line:match(": tag") or line:match(": vid") then
					if is_vlan_attr then has_vlan4k = line:match(": (%w+)") end
					if is_port_attr then has_ptpvid = line:match(": (%w+)") end

				end
			end

			swc:close()
		end


		-- The PVID options (if any) are added to this table so that
		-- section create below can add the just created vlan to the
		-- choice list of the PVID options...
		local pvid_opts = { }

		-- This function re-reads all existing vlan ids and populates
		-- PVID options choice lists
		local function populate_pvids()
			local vlan_ids = { }
			m.uci:foreach("network", "switch_vlan",
				function(s)
					local vid = s[has_vlan4k or "vlan"] or s["vlan"]
					if vid ~= nil then
						vlan_ids[#vlan_ids+1] = vid
					end
				end)

			local opt, vid
			for _, opt in ipairs(pvid_opts) do
				opt:reset_values()
				opt:value("", translate("none"))
				for _, vid in luci.util.vspairs(vlan_ids) do
					opt:value(vid, translatef("VLAN %d", tonumber(vid)))
				end
			end
		end

		-- Switch properties
		s = m:section(NamedSection, x['.name'], "switch", translatef("Switch %q", switch_name))
		s.addremove = false

		s:option(Flag, "enable", translate("Enable this switch"))
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end

		s:option(Flag, "enable_vlan", translate("Enable VLAN functionality"))
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end

		s:option(Flag, "reset", translate("Reset switch during setup"))
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end


		-- VLAN table
		s = m:section(TypedSection, "switch_vlan", translatef("VLANs on %q", switch_name))
		s.template = "cbi/tblsection"
		s.addremove = true
		s.anonymous = true

		-- Override cfgsections callback to enforce row ordering by vlan id.
		s.cfgsections = function(self)
			local osections = TypedSection.cfgsections(self)
			local sections = { }
			local section

			for _, section in luci.util.spairs(
				osections,
				function(a, b)
					return (tonumber(m.uci:get("network", osections[a], has_vlan4k or "vlan")) or 9999)
						<  (tonumber(m.uci:get("network", osections[b], has_vlan4k or "vlan")) or 9999)
				end
			) do
				sections[#sections+1] = section
			end

			return sections
		end

		-- When creating a new vlan, preset it with the highest found vid + 1.
		-- Repopulate the PVID choice lists afterwards.
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

			-- add newly created vlan to the pvid choice list
			populate_pvids()

			return sid
		end

		-- Repopulate PVId choice lists if a vlan gets removed.
		s.remove = function(self, section)
			local rv = TypedSection.remove(self, section)

			-- repopulate pvid choices
			populate_pvids()

			return rv
		end


		local port_opts = { }
		local untagged  = { }

		-- Parse current tagging state from the "ports" option.
		local portvalue = function(self, section)
			local pt
			for pt in (m.uci:get("network", section, "ports") or ""):gmatch("%w+") do
				local pc, tu = pt:match("^(%d+)([tu]*)")
				if pc == self.option then return (#tu > 0) and tu or "u" end
			end
			return ""
		end

		-- Validate port tagging. Ensure that a port is only untagged once,
		-- bail out if not.
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
		vid.forcewrite = true

		-- Validate user provided VLAN ID, make sure its within the bounds
		-- allowed by the switch.
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

		-- When writing the "vid" or "vlan" option, serialize the port states
		-- as well and write them as "ports" option to uci.
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

		-- Fallback to "vlan" option if "vid" option is supported but unset.
		vid.cfgvalue = function(self, section)
			return m.uci:get("network", section, has_vlan4k or "vlan")
				or m.uci:get("network", section, "vlan")
		end

		-- Build per-port off/untagged/tagged choice lists.
		local pt
		for pt = 0, num_ports - 1 do
			local po = s:option(ListValue, tostring(pt),
				(pt == cpu_port) and translate("CPU") or translatef("Port %d", (pt + 1)))

			po:value("", translate("off"))
			po:value("u" % pt, translate("untagged"))
			po:value("t" % pt, translate("tagged"))

			po.cfgvalue = portvalue
			po.validate = portvalidate
			po.write    = function() end

			port_opts[#port_opts+1] = po
		end


		-- Does this switch support PVIDs?
		if has_ptpvid then

			-- Spawn a "virtual" section. We just attach it to the global
			-- switch section here, the overrides below take care of writing
			-- the actual values to the correct uci sections.
			s = m:section(TypedSection, "switch",
				translatef("Port PVIDs on %q", switch_name),
				translate("Port <abbr title=\"Primary VLAN IDs\">PVIDs</abbr> specify " ..
					"the default VLAN ID added to received untagged frames."))

			s.template  = "cbi/tblsection"
			s.addremove = false
			s.anonymous = true

			-- Build port list, store pointers to the option objects in the
			-- pvid_opts array so that other callbacks can repopulate their
			-- choice lists.
			local pt
			for pt = 0, num_ports - 1 do
				local po = s:option(ListValue, tostring(pt),
					(pt == cpu_port) and translate("CPU") or translatef("Port %d", (pt + 1)))

				-- When cbi queries the current config value for this post,
				-- lookup the associated switch_port section (if any) and
				-- return its "pvid" or "vlan" option value.
				po.cfgvalue = function(self, section)
					local val
					m.uci:foreach("network", "switch_port",
						function(s)
							if s.port == self.option then
								val = s[has_ptpvid]
								return false
							end
						end)
					return val
				end

				-- On write, find the actual switch_port section associated
				-- to this port and set the value there. Create a new
				-- switch_port section for this port if there is none yet.
				po.write = function(self, section, value)
					local found = false

					m.uci:foreach("network", "switch_port",
						function(s)
							if s.port == self.option then
								m.uci:set("network", s['.name'], has_ptpvid, value)
								found = true
								return false
							end
						end)

					if not found then
						m.uci:section("network", "switch_port", nil, {
							["port"]     = self.option,
							[has_ptpvid] = value
						})
					end
				end

				-- If the user cleared the PVID value on this port, find
				-- the associated switch_port section and clear it.
				-- If the section does not contain any other unrelated
				-- options (like led or blinkrate) then remove it completely,
				-- else just clear out the "pvid" option.
				po.remove = function(self, section)
					m.uci:foreach("network", "switch_port",
						function(s)
							if s.port == self.option then
								local k, found
								local empty = true

								for k, _ in pairs(s) do
									if k:sub(1,1) ~= "." and k ~= "port" and k ~= has_ptpvid then
										empty = false
										break
									end
								end

								if empty then
									m.uci:delete("network", s['.name'])
								else
									m.uci:delete("network", s['.name'], has_ptpvid)
								end

								return false
							end
						end)
				end

				-- The referenced VLAN might just have been removed, simply
				-- return "" (none) in this case to avoid triggering a
				-- validation error.
				po.validate = function(...)
					return ListValue.validate(...) or ""
				end

				pvid_opts[#pvid_opts+1] = po
			end

			populate_pvids()
		end
	end
)

return m
