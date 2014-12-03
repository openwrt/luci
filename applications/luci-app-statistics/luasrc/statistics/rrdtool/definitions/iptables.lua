--[[

Luci statistics - iptables plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id: ipt_bytes.lua 2276 2008-06-03 23:18:37Z jow $

]]--

module("luci.statistics.rrdtool.definitions.iptables", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		{
			title = "%H: Firewall: Processed bytes in %pi",
			vlabel = "Bytes/s",
			number_format = "%5.0lf%sB/s",
			totals_format = "%5.0lf%sB",
			data = { 
				types = { "ipt_bytes" },
				options = {
					ipt_bytes = {
						total = true,
						title = "%di"
					}
				}
			}
		},

		{
			title = "%H: Firewall: Processed packets in %pi",
			vlabel = "Packets/s",
			number_format = "%5.1lf P/s",
			totals_format = "%5.0lf%s",
			data = {
				types = { "ipt_packets" },
				options = {
					ipt_packets = {
						total = true,
						title = "%di"
					}
				}
			}
		}
	}
end
