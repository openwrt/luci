--[[

Luci statistics - cpu plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.cpu.cpu",package.seeall)

function rrdargs( graph, host, plugin, plugin_instance, dtype )

	return {
		data = {
			instances = { 
				cpu = { "idle", "user", "system", "nice" }
			},

			options = {
				cpu_idle      = { color = "ffffff" },
				cpu_nice      = { color = "00e000" },
				cpu_user      = { color = "0000ff" },
				cpu_wait      = { color = "ffb000" },
				cpu_system    = { color = "ff0000" },
				cpu_softirq   = { color = "ff00ff" },
				cpu_interrupt = { color = "a000a0" },
				cpu_steal     = { color = "000000" }
			}
		}
	}
end
