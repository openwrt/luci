--[[

Luci statistics - processes plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.processes.ps_state", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = {
			instances = {
				ps_state = {
					"sleeping", "running", "paging", "blocked", "stopped", "zombies"
				}
			},

			options = {
				ps_state_sleeping = { color = "0000ff" },
				ps_state_running  = { color = "008000" },
				ps_state_paging   = { color = "ffff00" },
				ps_state_blocked  = { color = "ff5000" },
				ps_state_stopped  = { color = "555555" },
				ps_state_zombies  = { color = "ff0000" }
			}
		}
	}
end
