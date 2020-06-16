-- /usr/lib/lua/luci/statistics/rrdtool/definitions/sqm.lua
-- Licensed to the public under the Apache License 2.0.

module("luci.statistics.rrdtool.definitions.sqm", package.seeall)

function item()
	return luci.i18n.translate("SQM")
end

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		per_instance = true,
		title = "%H: SQM qdisc on %pi",
		rrdopts = { "--logarithmic" },
		vlabel = " ",
		alt_autoscale = true,
		number_format = "%5.0lf",
		data = {
			types = { "qdisc_bytes", "qdisc_backlog", "qdisc_drops" },
			options = {
				qdisc_bytes = {
					title = "kb/s:",
					overlay = true,
					noarea = false,
					color = "0000ff",
					transform_rpn = "125,/"
				},
				qdisc_backlog = {
					title = "Backlog/B:",
					overlay = true,
					noarea = true,
					color = "8000ff"
				},
				qdisc_drops = {
					title = "Drops/s:",
					overlay = true,
					noarea = true,
					color = "00ffff"
				},
			}
		}
	}
end
