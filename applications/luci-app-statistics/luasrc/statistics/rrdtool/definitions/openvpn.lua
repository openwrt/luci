-- Copyright 2015 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.statistics.rrdtool.definitions.openvpn", package.seeall)

function rrdargs( graph, plugin, plugin_instance )
	local inst = plugin_instance:gsub("^openvpn%.(.+)%.status$", "%1")

	return {
		{
			title = "%%H: OpenVPN \"%s\" - Traffic" % inst,
			vlabel = "Bytes/s",
			data = {
				instances = {
					if_octets = { "traffic", "overhead" }
				},
				sources = {
					if_octets = { "tx", "rx" }
				},
				options = {
					if_octets_traffic_tx  = { title = "Bytes    (TX)", total = true, color = "00ff00" },
					if_octets_overhead_tx = { title = "Overhead (TX)", total = true, color = "ff9900" },
					if_octets_traffic_rx  = { title = "Bytes    (RX)", total = true, flip = true, color = "0000ff" },
					if_octets_overhead_rx = { title = "Overhead (RX)", total = true, flip = true, color = "ff00ff" }
				}
			}
		},

		{
			title = "%%H: OpenVPN \"%s\" - Compression" % inst,
			vlabel = "Bytes/s",
			data = {
				instances = {
					compression = { "data_out", "data_in" }
				},
				sources = {
					compression = { "uncompressed", "compressed" }
				},
				options = {
					compression_data_out_compressed   = { title = "Compressed   (TX)", total = true, color = "008800" },
					compression_data_out_uncompressed = { title = "Uncompressed (TX)", total = true, color = "00ff00" },
					compression_data_in_compressed    = { title = "Compressed   (RX)", total = true, flip = true, color = "000088" },
					compression_data_in_uncompressed  = { title = "Uncompressed (RX)", total = true, flip = true, color = "0000ff" }
				}
			}
		}
	}
end
