module("luci.statistics.rrdtool.definitions.processes.ps_state", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		title  = "Prozesse",
		vlabel = "Anzahl/s",

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
