/* Licensed to the public under the Apache License 2.0. */

'use strict';

return L.Class.extend({
	title: _('DSL'),

	rrdargs:  function(graph, host, plugin, plugin_instance, dtype) {
		var g = [];
		var dtypes = graph.dataTypes(host, plugin, plugin_instance);

		const d_snr = {
			title: _("DSL Signal"),
			vlabel: "dB",
			data: {
				types: ["snr"],
				options: {
					snr_latn_up: {
						title: _("Line Attenuation Up (LATN)"),
						noarea: true,
						overlay: true
					},
					snr_latn_down: {
						title: _("Line Attenuation Down (LATN)"),
						noarea: true,
						overlay: true
					},
					snr_satn_up: {
						title: _("Signal Attenuation Up (SATN)"),
						noarea: true,
						overlay: true
					},
					snr_satn_down: {
						title: _("Signal Attenuation Down (SATN)"),
						noarea: true,
						overlay: true
					},
					snr_snr_up: {
						title: _("Noise Margin Up (SNR)"),
						noarea: true,
						overlay: true
					},
					snr_snr_down: {
						title: _("Noise Margin Down (SNR)"),
						noarea: true,
						overlay: true
					},
				}
			}
		};
		const d_uptime = {
			title: _("DSL Line Uptime"),
			vlabel: "seconds",
			data: {
				types: ["uptime"],
				options: {
					uptime: {
						title: _("Uptime"),
						noarea: true
					}
				}
			}
		};
		const d_flags = {
			title: _("DSL Flags"),
			data: {
				instances: {
					bool: [
						"bitswap_up",
						"bitswap_down",
						"vector_up",
						"vector_down"
					]
				},
				options: {
					bool_bitswap_up: {
						title: _("Bitswap Up"),
						noarea: true,
						overlay: true
					},
					bool_bitswap_down: {
						title: _("Bitswap Down"),
						noarea: true,
						overlay: true
					},
					bool_vector_up: {
						title: _("Vectoring Up"),
						noarea: true,
						overlay: true
					},
					bool_vector_down: {
						title: _("Vectoring Down"),
						noarea: true,
						overlay: true
					},
				}
			}
		};
		const d_bitrate = {
			title: _("Bitrate"),
			vlabel: "b/s",
			data: {
				instances: {
					bitrate: [
						"attndr_up",
						"attndr_down",
						"data_rate_up",
						"data_rate_down"
					]
				},
				options: {
					bitrate_attndr_up: {
						title: _("Max. Attainable Data Rate (ATTNDR) Up"),
						noarea: true,
						overlay: true
					},
					bitrate_attndr_down: {
						title: _("Max. Attainable Data Rate (ATTNDR) Down"),
						noarea: true,
						overlay: true
					},
					bitrate_data_rate_up: {
						title: _("Data Rate Up"),
						noarea: true,
						overlay: true
					},
					bitrate_data_rate_down: {
						title: _("Data Rate Down"),
						noarea: true,
						overlay: true
					}
				}
			}
		};
			const d_count = {
			title: _("Errors"),
			vlabel: "count",
			data: {
				types: ["errors"],
				options: {
					errors_rx_corrupted_far: {
						title: _("Rx Corrupted Far"),
						noarea: true,
						overlay: true
					},
					errors_rx_corrupted_near: {
						title: _("Rx Corrupted Near"),
						noarea: true,
						overlay: true
					},
					errors_rx_retransmitted_far: {
						title: _("Rx Retransmitted Far"),
						noarea: true,
						overlay: true
					},
					errors_tx_retransmitted_far: {
						title: _("Tx Retransmitted Far"),
						noarea: true,
						overlay: true
					},
					errors_rx_retransmitted_near: {
						title: _("Rx Retransmitted Near"),
						noarea: true,
						overlay: true
					},
					errors_tx_retransmitted_near: {
						title: _("Tx Retransmitted Near"),
						noarea: true,
						overlay: true
					},
				}
			}
		};

		if (dtypes.includes("snr")) {
			g.push(d_snr);
		}
		if (dtypes.includes("uptime")) {
			g.push(d_uptime);
		}
		if (dtypes.includes("bool")) {
			g.push(d_flags);
		}
		if (dtypes.includes("bitrate")) {
			g.push(d_bitrate);
		}
		if (dtypes.includes("count")) {
			g.push(d_count);
		}

		return g;
	}
});
