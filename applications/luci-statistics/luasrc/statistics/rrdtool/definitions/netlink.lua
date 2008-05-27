module("luci.statistics.rrdtool.definitions.netlink", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance )

	local diagram_list = { }

	-- diagram names
	local dtypes_names = {
		"Verkehr",
		"Pakete",
		"Multicast-Pakete",
		"Paketkollisionen",
		"Paketfehler",
		"RX-Fehler",
		"TX-Fehler"
	}

	-- diagram units
	local dtypes_units = {
		"Bytes/s",
		"Pakete/s",
		"Pakete/s",
		"Kollisionen/s",
		"Fehler/s",				-- (?)
		"Fehler/s",
		"Fehler/s"
	}

	-- data source overrides
	local dtypes_sources = {
		if_errors  = { "tx", "rx" },		-- if_errors has tx and rx
		if_octets  = { "tx", "rx" },		-- if_octets has tx and rx
		if_packets = { "tx", "rx" },		-- if_packets has tx and rx
		if_dropped = { "tx", "rx" },		-- if_dopped has tx and rx
	}

	-- diagram data types
	local dtypes_list  = {

		-- diagram 1: interface traffic statistics
		{
			if_octets     = { "" } 		-- bytes/s
		},

		-- diagram 2: combined interface packet statistics
		{ 
			if_dropped    = { "" }, 	-- packets/s
			if_packets    = { "" }		-- packets/s
		},

		-- diagram 3: multicast count
		{
			if_multicast  = { "" }		-- packets/s
		},

		-- diagram 4: interface collision statistics
		{
			if_collisions = { "" } 		-- collisions/s
		},

		-- diagram 5: interface error statistics
		{
			if_errors     = { "" }		-- errors/s (?)
		},

		-- diagram 6: interface rx error statistics
		{
			if_rx_errors  = {		-- errors/s
				"length", "missed", "over", "crc", "fifo", "frame"
			}
		},

		-- diagram 7: interface tx error statistics
		{
			if_tx_errors  = {		-- errors/s
				"aborted", "carrier", "fifo", "heartbeat", "window"
			}
		}
	}

	-- diagram colors
	local dtypes_colors = {

		-- diagram 1
		{
			if_octets__tx_  = "00ff00",
			if_octets__rx_  = "0000ff"
		},

		-- diagram 2
		{
			if_dropped__tx_ = "ff0000",
			if_dropped__rx_ = "ff5500",
			if_packets__tx_ = "00ff00",
			if_packets__rx_ = "0000ff"
		},

		-- diagram 3
		{
			if_multicast    = "0000ff"
		},

		-- diagram 4
		{
			if_collisions   = "ff0000"
		},

		-- diagram 5
		{
			if_errors__tx_  = "ff0000",
			if_errors__rx_  = "ff5500"
		},

		-- diagram 6
		{
                        length          = "0000ff",
			missed          = "ff5500",
			over            = "ff0066",
			crc             = "ff0000",
			fifo            = "00ff00",
			frame           = "ffff00"
		},

		-- diagram 7
		{
			aborted         = "ff0000",
			carrier         = "ffff00",
			fifo            = "00ff00",
			heartbeat       = "0000ff",
			window	        = "8800ff"
		}
	}


	for i, name in ipairs(dtypes_names) do

		local dtypes = dtypes_list[i]
		local opts   = { }

		opts.sources = { }
		opts.image   = graph:mkpngpath( host, plugin, plugin_instance, "netlink" .. i )
		opts.title   = host .. ": Netlink Statistiken - " .. name .. " auf " .. plugin_instance
		opts.rrd     = { "-v", dtypes_units[i] }
		opts.colors  = dtypes_colors[i]

		for dtype, dinstances in pairs(dtypes) do
			for i, inst in ipairs(dinstances) do

				local name = inst
				if name:len() == 0 then name = dtype end

				-- check for data source override
				if dtypes_sources[dtype] then

					-- has override
					for i, ds in ipairs(dtypes_sources[dtype]) do
						table.insert( opts.sources, {
							ds    = ds,	-- override
							name  = name .. " (" .. ds .. ")",
							rrd   = graph:mkrrdpath( host, plugin, plugin_instance, dtype, inst ),
							flip  = ( ds == "rx" ),
							total = ( ds == "rx" or ds == "tx" )
						} )
					end
				else
					-- no override, assume single "value" data source
					table.insert( opts.sources, {
						name  = name,
						rrd   = graph:mkrrdpath( host, plugin, plugin_instance, dtype, inst ),
						total = ( name == "if_multicast" )
					} )
				end
			end
		end

		table.insert( diagram_list, opts )
	end

	return diagram_list
end
