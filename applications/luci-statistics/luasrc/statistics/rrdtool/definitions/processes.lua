--[[

Luci statistics - processes plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.processes", package.seeall)

function rrdargs( graph, plugin, plugin_instance )

	if plugin_instance == "" then
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
	else
		return {

			{
				data = {
					sources = {
						ps_cputime = { "syst", "user" }
					},

					options = {
						ps_cputime__user = {
							color   = "0000ff",
							overlay = true
						},

						ps_cputime__syst = {
							color   = "ff0000",
							overlay = true
						}
					}
				}
			},

			{
				data = {
					sources = {
						ps_count = { "threads", "processes" }
					},

					options = {
						ps_count__threads   = { color = "00ff00" },
						ps_count__processes = { color = "0000bb" }
					}
				}
			},

			{
				data = {
					sources = {
						ps_pagefaults = { "minflt", "majflt" }
					},

					options = {
						ps_pagefaults__minflt = { color = "ff0000" },
						ps_pagefaults__majflt = { color = "ff5500" }
					}
				}
			},

			{
				number_format = "%5.1lf%s",

				data = {
					types = { "ps_rss" },

					options = {
						ps_rss = { color = "0000ff" }
					}
				}
			}
		}
	end
end
