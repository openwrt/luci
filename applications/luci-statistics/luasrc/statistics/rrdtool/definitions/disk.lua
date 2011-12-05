--[[

Luci statistics - df plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id: df.lua 2274 2008-06-03 23:15:16Z jow $

]]--

module("luci.statistics.rrdtool.definitions.disk", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )
	return {
		{
			title = "%H: Disk I/O operations on %pi",
			vlabel = "Operations/s",
			number_format = "%5.1lf%sOp/s",

			data = {
				types = { "disk_ops" },
				sources = {
					disk_ops = { "read", "write" },
				},

				options = {
					disk_ops__read = {
						title = "Reads",
						color = "00ff00",
						flip  = false
					},

					disk_ops__write = {
						title = "Writes",
						color = "ff0000",
						flip  = true
					}
				}
			}
		},

		{
			title = "%H: Disk I/O bandwidth on %pi",
			vlabel = "Bytes/s",
			number_format = "%5.1lf%sB/s",

			detail = true,

			data = {
				types = { "disk_octets" },
				sources = {
					disk_octets = { "read", "write" }
				},
				options = {
					disk_octets__read = {
						title = "Read",
						color = "00ff00",
						flip  = false
					},
					disk_octets__write = {
						title = "Write",
						color = "ff0000",
						flip  = true
					}
				}
			}
		}
	}
end
