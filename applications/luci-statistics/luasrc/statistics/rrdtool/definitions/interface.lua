--[[

Luci statistics - interface plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.interface", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance )

	--
	-- traffic diagram
	--
	local traffic = {

		-- draw this diagram for each data instance
		per_instance = true,

		-- diagram data description
		data = {
			-- defined sources for data types, if ommitted assume a single DS named "value" (optional)
			sources = {
				if_octets = { "tx", "rx" }
			},

			-- special options for single data lines
			options = {
				if_octets__tx = {
					total = true,		-- report total amount of bytes
					color = "00ff00"	-- tx is green
				},

				if_octets__rx = {
					flip  = true,		-- flip rx line
					total = true,		-- report total amount of bytes
					color = "0000ff"	-- rx is blue
				}
			}
		}
	}


	--
	-- packet diagram
	--
	local packets = {

		-- draw this diagram for each data instance
		per_instance = true,

		-- diagram data description
		data = {
			-- data type order
			types = { "if_packets", "if_errors" },

			-- defined sources for data types
			sources = {
				if_packets = { "tx", "rx" },
				if_errors  = { "tx", "rx" }
			},

			-- special options for single data lines
			options = {
				-- processed packets (tx DS)
				if_packets__tx = {
					overlay = true,		-- don't summarize
					total   = true,		-- report total amount of bytes
					color   = "00ff00"	-- processed tx is green
				},

				-- processed packets (rx DS)
				if_packets__rx = {
					overlay = true,		-- don't summarize
					flip    = true,		-- flip rx line
					total   = true,		-- report total amount of bytes
					color   = "0000ff"	-- processed rx is blue
				},

				-- packet errors (tx DS)
				if_errors__tx = {
					overlay = true,		-- don't summarize
					total   = true,		-- report total amount of packets
					color   = "ff5500"	-- tx errors are orange
				},

				-- packet errors (rx DS)
				if_errors__rx = {
					overlay = true,		-- don't summarize
					flip    = true,		-- flip rx line
					total   = true,		-- report total amount of packets
					color   = "ff0000"	-- rx errors are red
				}
			}
		}
	}

	return { traffic, packets }
end
