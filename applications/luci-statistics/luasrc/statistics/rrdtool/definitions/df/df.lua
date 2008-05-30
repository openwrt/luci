module("luci.statistics.rrdtool.definitions.df.df", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		per_instance  = true,
		number_format = "%5.1lf%s",

		data = {
			sources = {
				df = { "free", "used" }
			},

			options = {
				df__free = {
					color = "00ff00"
				},

				df__used = {
					color = "ff0000",
					flip  = true
				}
			}
		}
	}
end
