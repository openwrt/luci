module("ffluci.statistics.rrdtool.definitions.iptables.ipt_packets", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance, dtype )

	dtype_instances = graph.tree:data_instances( plugin, plugin_instance, dtype )
	opts            = { }

	for i, inst in ipairs(dtype_instances) do

		opts[i]		= { }
		opts[i].image	= graph:mkpngpath( host, plugin, plugin_instance, dtype, inst )
		opts[i].title	= host .. ": Firewall - " .. inst:gsub("_"," ")
		opts[i].rrd 	= { "-v", "Pakete/s" }

		opts[i].colors  = { 

		}

		opts[i].sources = { {
			name = inst,
			rrd  = graph:mkrrdpath( host, plugin, plugin_instance, dtype, inst )
		} }
	end

	return opts
end
