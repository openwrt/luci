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

		-- Switch properties
		s = m:section(NamedSection, x['.name'], "switch", "Switch: %s" % x['.name'])
		s.addremove = false

		s:option(Flag, "enable", "Enable this switch")
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end

		s:option(Flag, "enable_vlan", "Enable VLAN functionality")
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end

		s:option(Flag, "reset", "Reset switch during setup")
			.cfgvalue = function(self, section) return Flag.cfgvalue(self, section) or self.enabled end


		-- VLAN table
		s = m:section(TypedSection, "switch_vlan", "VLANs: %s" % x['.name'])
		s.template = "cbi/tblsection"
		s.rowcolors = true
		s.addremove = true

		s.sectiontitle = function(self, section)
			return "VLAN #%d" % (m.uci:get("network", section, "vlan") or 0)
		end

		s.filter = function(self, section)
			return m.uci:get("network", section, "device") == x['.name']
				or m.uci:get("network", section, "device") == nil -- needed for just created vlan sections
		end

		s.cfgsections = function(self)
			local osections = TypedSection.cfgsections(self)
			local sections = { }
			local section	

			for _, section in luci.util.spairs(
				osections,
				function(a, b)
					return (tonumber(m.uci:get("network", osections[a], "vlan")) or 0)
						<  (tonumber(m.uci:get("network", osections[b], "vlan")) or 0)
				end
			) do
				sections[#sections+1] = section
			end

			return sections
		end

		s.create = function(self, section)
			local n = tonumber(section)
			if n ~= nil and n >= 0 then
				local sn = "%s_%d" %{ x['.name'], n }
				local rv = TypedSection.create(self, sn)
				m.uci:set("network", sn, "device", x['.name'])
				m.uci:set("network", sn, "vlan", n)
				return rv
			end
			return nil
		end


		p0 = s:option(Flag, "0", "Port 0")
		p1 = s:option(Flag, "1", "Port 1")
		p2 = s:option(Flag, "2", "Port 2")
		p3 = s:option(Flag, "3", "Port 3")
		p4 = s:option(Flag, "4", "Port 4")
		p5 = s:option(Flag, "5", "CPU"   )


		p0.cfgvalue = function(self, section)
			local pts = (m.uci:get("network", section, "ports") or "")
			return (pts:match("%f[%w]" .. self.option .. "%f[%W]") and self.enabled or self.disabled)
		end

		p1.cfgvalue = p0.cfgvalue
		p2.cfgvalue = p0.cfgvalue
		p3.cfgvalue = p0.cfgvalue
		p4.cfgvalue = p0.cfgvalue
		p5.cfgvalue = p0.cfgvalue


		p0.parse = function(self, section)
			local pts = { }
			if p0:formvalue(section) then pts[#pts+1] = 0 end
			if p1:formvalue(section) then pts[#pts+1] = 1 end
			if p2:formvalue(section) then pts[#pts+1] = 2 end
			if p3:formvalue(section) then pts[#pts+1] = 3 end
			if p4:formvalue(section) then pts[#pts+1] = 4 end
			if p5:formvalue(section) then pts[#pts+1] = 5 end
			m.uci:set("network", section, "ports", table.concat(pts, " "))
		end

		p1.parse = function() end
		p2.parse = p1.parse
		p3.parse = p1.parse
		p4.parse = p1.parse
		p5.parse = p1.parse
	end
)

return m
