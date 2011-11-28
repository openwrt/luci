--[[

Luci statistics - olsrd plugin diagram definition

Copyright 2011 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0
]]--

module("luci.statistics.rrdtool.definitions.olsrd", package.seeall)

local tree = luci.statistics.datatree.Instance()

function rrdargs( graph, plugin, plugin_instance, dtype, is_index )

	local g = { }

	if plugin_instance == "routes" then

		g[#g+1] = {
	                -- diagram data description
			title = "%H: Total amount of OLSR routes", vlabel = "n",
			number_format = "%5.0lf", data = {
                        	types = { "routes" },
				options = {
					routes = {
						color = "ff0000",
						title = "Total number of routes"
					}
				}
	                }
        	}

		if not is_index then
			g[#g+1] = {
				title = "%H: Average route ETX", vlabel = "ETX",
				number_format = "%5.1lf",data = {
					instances = { "average" }, -- falls es irgendwann mal welche pro ip gibt, wie bei links, dann werden die hier excludiert
					types = { "route_etx" },
					options = {
						route_etx = {
							title = "Average route ETX"
						}
					}
				}
			}

			g[#g+1] = {
				title = "%H: Average route metric", vlabel = "metric",
				number_format = "%5.1lf", data = {
					instances = { "average" }, -- falls es irgendwann mal welche pro ip gibt, wie bei links, dann werden die hier excludiert
					types = { "route_metric" },
					options = {
						route_metric = {
							title = "Average route metric"
						}
					}
				}
			}
		end

	elseif plugin_instance == "links" then

		g[#g+1] = {
			-- diagram data description
			title = "%H: Total amount of OLSR neighbours", vlabel = "n",
			number_format = "%5.0lf", data = {
				instances = { "" },
				types = { "links" },
				options = {
					links = {
						color = "00ff00",
						title = "Number of neighbours"
					}
				}
			}
		}

		if not is_index then
			local instances = tree:data_instances(plugin, plugin_instance, "signal_quality")
			table.sort(instances)

			-- define one diagram per host, containing the rx and lq values
			local i
			for i = 1, #instances, 2 do
				local dsn1 = "signal_quality_%s_value" % instances[i]:gsub("[^%w]+", "_")
				local dsn2 = "signal_quality_%s_value" % instances[i+1]:gsub("[^%w]+", "_")
				local host = instances[i]:match("^[^%-]+%-([^%-]+)%-.+")

				g[#g+1] = {
				title = "%H: Signal Quality" .. " (" .. (host or "avg") ..")", vlabel = "ETX",
				number_format = "%5.2lf", data = {
						types = { "signal_quality" },
	
						instances = {
							signal_quality = { instances[i], instances[i+1] },
						},

						options = {
							[dsn1] = {
								color = "00ff00",
								title = "LQ (%s)" % (host or "avg"),
							},
							[dsn2] = {
								color = "0000ff",
								title = "NLQ (%s)" % (host or "avg"),
								flip  = true
							}
						}
					}
				}
			end
		end

	elseif plugin_instance == "topology" then

		g[#g+1] = {
			title= "%H: Total amount of OLSR links", vlabel = "n",
			number_format = "%5.0lf", data = {
				instances = { "" },
	                        types = { "links" },
				options = {
					links = { -- or: links__value is aber egal weils eh nur eines davon gibt
						color = "0000ff",
						title = "Total number of links"
					}
				}
			}
	        }

		if not is_index then
			g[#g+1] = {
				title= "%H: Average signal quality", vlabel = "n",
				number_format = "%5.2lf", data = {
					instances = { "average" }, -- exclude possible per-ip stuff
					types = { "signal_quality" },
					options = {
						signal_quality = {
							color = "0000ff",
							title = "Average signal quality"
						}
					}
				}
			}
		end
	end

	return g
end
